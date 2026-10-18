-- ReStitch: one row per user holding their body, closet and tools as JSON.
-- Run this once in Supabase → SQL Editor → New query → Run.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- Each signed-in user can only see and change their own row.
drop policy if exists "read own data" on public.user_data;
create policy "read own data" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "insert own data" on public.user_data;
create policy "insert own data" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own data" on public.user_data;
create policy "update own data" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own data" on public.user_data;
create policy "delete own data" on public.user_data
  for delete using (auth.uid() = user_id);

-- Explore: every project in the feed. The launch catalog (supabase/seed.sql)
-- has no user_id and a slug; posts people share belong to them. Anyone can
-- read; a signed-in user can post as themselves. New rows stream to open feeds live.
create table if not exists public.posts (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        default auth.uid() references auth.users (id) on delete cascade,
  slug         text,
  username     text        not null,
  title        text        not null,
  description  text        not null default '',
  aesthetic    text        not null,
  difficulty   text        not null,
  hours        numeric     not null default 1,
  kind         text,
  color        text,
  trim_color   text,
  tools        text[]      not null default '{}',
  materials    text[]      not null default '{}',
  steps        text[]      not null,
  image_path   text        not null,
  image_width  int         not null,
  image_height int         not null,
  likes        int         not null default 0,
  avatar       int,
  created_at   timestamptz not null default now()
);

-- Upgrades a posts table made by an earlier version of this file.
alter table public.posts
  add column if not exists slug text,
  add column if not exists trim_color text,
  add column if not exists likes int not null default 0,
  add column if not exists avatar int;
alter table public.posts alter column user_id drop not null;

-- Constraints are dropped and re-added so re-running this file updates them.
alter table public.posts
  drop constraint if exists posts_slug_key,
  drop constraint if exists posts_slug_check,
  drop constraint if exists posts_username_check,
  drop constraint if exists posts_title_check,
  drop constraint if exists posts_description_check,
  drop constraint if exists posts_aesthetic_check,
  drop constraint if exists posts_difficulty_check,
  drop constraint if exists posts_hours_check,
  drop constraint if exists posts_kind_check,
  drop constraint if exists posts_color_check,
  drop constraint if exists posts_trim_color_check,
  drop constraint if exists posts_tools_check,
  drop constraint if exists posts_materials_check,
  drop constraint if exists posts_steps_check,
  drop constraint if exists posts_image_path_check,
  drop constraint if exists posts_image_width_check,
  drop constraint if exists posts_image_height_check,
  drop constraint if exists posts_likes_check,
  drop constraint if exists posts_avatar_check,
  drop constraint if exists posts_catalog_check;
alter table public.posts
  add constraint posts_slug_key unique (slug),
  add constraint posts_slug_check check (slug ~ '^[a-z0-9-]{1,60}$'),
  add constraint posts_username_check check (username ~ '^[a-z0-9._]{2,30}$'),
  add constraint posts_title_check check (char_length(title) between 1 and 120),
  add constraint posts_description_check check (char_length(description) <= 2000),
  add constraint posts_aesthetic_check check (aesthetic in ('Streetwear', 'Y2K', 'Vintage', 'Minimalist', 'Cottagecore')),
  add constraint posts_difficulty_check check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  add constraint posts_hours_check check (hours > 0 and hours <= 200),
  -- Garment kinds the 3D try-on can draw (src/shell/tryOn.js KIND_SHAPES).
  add constraint posts_kind_check check (kind in ('denim', 'cami', 'halter', 'vest', 'longsleeve', 'blouse', 'crop', 'cardigan', 'hoodie', 'jacket', 'wrap', 'shirt', 'tee', 'skirt', 'jeans', 'trousers', 'dress')),
  add constraint posts_color_check check (color ~ '^#[0-9a-f]{6}$'),
  add constraint posts_trim_color_check check (trim_color ~ '^#[0-9a-f]{6}$'),
  add constraint posts_tools_check check (cardinality(tools) <= 10),
  add constraint posts_materials_check check (cardinality(materials) <= 30),
  add constraint posts_steps_check check (cardinality(steps) between 1 and 30),
  -- An uploaded photo in the post-images bucket, or a catalog photo bundled with the site.
  add constraint posts_image_path_check check (image_path ~ '^([0-9a-f-]{36}/[0-9a-f-]{36}\.jpg|/explore/photos/[a-z0-9-]+\.jpg)$'),
  add constraint posts_image_width_check check (image_width > 0),
  add constraint posts_image_height_check check (image_height > 0),
  add constraint posts_likes_check check (likes >= 0),
  add constraint posts_avatar_check check (avatar between 0 and 7),
  -- Only the catalog may have a slug, a like count, an avatar or a bundled photo.
  add constraint posts_catalog_check check (user_id is null or (slug is null and likes = 0 and avatar is null and image_path not like '/%'));

alter table public.posts enable row level security;

drop policy if exists "anyone reads posts" on public.posts;
create policy "anyone reads posts" on public.posts
  for select using (true);

drop policy if exists "post as yourself" on public.posts;
create policy "post as yourself" on public.posts
  for insert to authenticated with check (auth.uid() = user_id);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then
    alter publication supabase_realtime add table public.posts;
  end if;
end $$;

-- Post photos: public to read, each user uploads into a folder named by their id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "upload own post images" on storage.objects;
create policy "upload own post images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

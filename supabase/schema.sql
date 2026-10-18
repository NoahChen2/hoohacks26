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

-- Explore: projects people share with everyone. Anyone can read them; a
-- signed-in user can post as themselves. New rows stream to open feeds live.
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  username     text        not null check (username ~ '^[a-z0-9._]{2,30}$'),
  title        text        not null check (char_length(title) between 1 and 120),
  description  text        not null default '' check (char_length(description) <= 2000),
  aesthetic    text        not null check (aesthetic in ('Streetwear', 'Y2K', 'Vintage', 'Minimalist', 'Cottagecore')),
  difficulty   text        not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')),
  hours        numeric     not null default 1 check (hours > 0 and hours <= 200),
  kind         text        check (kind in ('tee', 'shirt', 'blouse', 'cami', 'crop', 'hoodie', 'cardigan', 'jacket', 'vest', 'dress', 'skirt', 'jeans', 'trousers')),
  color        text        check (color ~ '^#[0-9a-f]{6}$'),
  tools        text[]      not null default '{}' check (cardinality(tools) <= 10),
  materials    text[]      not null default '{}' check (cardinality(materials) <= 30),
  steps        text[]      not null check (cardinality(steps) between 1 and 30),
  image_path   text        not null check (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  image_width  int         not null check (image_width > 0),
  image_height int         not null check (image_height > 0),
  created_at   timestamptz not null default now()
);

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

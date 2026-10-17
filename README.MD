# ReStitch

Run `npm install` and `npm run dev` to start locally.

Supabase is optional. Without configuration, the app runs in guest mode and saves
measurements and closet data in this browser.

To enable accounts, copy `.env.example` to `.env.local` and set
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project's URL and public
anon key. Run `supabase/schema.sql` in your Supabase SQL editor to create the
storage table.

Set `VITE_SUPABASE_ENABLED=false` to force guest mode even when keys are present.
Missing, blank, or invalid configuration also falls back to guest mode. Restart
the dev server after changing environment variables; production builds must be
rebuilt for environment changes to take effect.

Body geometry and customization architecture, scope, asset requirements and
validation: [Character Studio phases 1–2](docs/character-studio.md).

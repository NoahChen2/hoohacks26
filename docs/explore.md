# ReThread Explore — Step 2

Routes: `/explore` and `/project/:id`. The existing ReStitch fitting studio remains
at `/`, with one Explore navigation link added. `src/entry.js` loads only the
appropriate page; discovery does not initialize Three.js or account persistence.
No framework, AI Studio, authentication, or existing fitting workflow was changed.
Production hosting must serve `index.html` for these routes (Vite dev/preview
already support this history fallback).

- `src/explore/projects.js`: 24 fictional projects with creators, categories,
  difficulty, materials, estimated times, and individual step summaries.
- `src/explore/page.js`: search/category/saved filters, cards, project details,
  not-found state, accessible like/save controls, and cross-tab storage updates.
- `src/explore/storage.js`: isolated `rethread.explore.v1` persistence with safe
  parsing and an in-memory fallback when storage is blocked or full.
- `src/explore/style.css`: scoped responsive masonry (2 mobile, 3 tablet/small
  desktop, 4 wide desktop), matching project details and reduced-motion support.
- `public/explore`: original CC0 SVG covers and avatars, all bundled locally.
  These are illustrations, not photos of real finished projects. See LICENSE.txt.
- `scripts/generate-explore-assets.mjs`: reproducible asset generation.

Search and category selections are reflected in the URL and retained when opening
and returning from a project. Likes/saves are local to the browser, independent of
existing Supabase/guest settings. Demo creator profiles and counts are fictional;
there is no backend social network in Step 2.

Validation: `npm run lint` checks the new discovery modules, entry point, tests,
and asset generator. `npm test` runs the existing geometry/persistence tests plus
project-data, filtering, bundled-image, and engagement persistence tests.
`npm run build` includes the existing TypeScript check.

Production browser checks covered all 24 image/creator pairs, 2/3/4-column
breakpoints, search and no-results recovery, category filters, like/save toggles,
refresh persistence, saved-only filtering, direct detail-route refresh, not-found
routes, and the original studio boot. Desktop feed/detail and mobile feed/scrolled
views were visually inspected; no JavaScript errors occurred.

The subsequent image-interactions review adds guest boards at `/profile` and
upgrades save controls without discarding existing data. See
[pinterest-interactions.md](pinterest-interactions.md) for migration details,
changed files, validation, and review steps. Visual search remains deferred.

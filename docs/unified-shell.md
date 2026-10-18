# Unified shell, space styles and the 3D body everywhere

Every page (Explore, AI Studio, Fitting Room, Academy, Settings, Saved, project
pages) shares one header, one name (**ReThread**) and one space style.

## Shell (`src/shell/`)

- `shell.js`: `siteHeader(active, { savedCount, account })` returns the header
  markup; `installShell()` binds the header world picker. `entry.js` imports it
  first, so `html[data-world]` and `html[data-space]` are set before any page
  renders. The theme follows the world saved in preferences
  (`preferences.world`: `cultivation` | `fairy` | `fantasy` | `runway` |
  `cyberpunk` | `space` | `furry`), chosen in Settings step 4 or the header
  picker. `WORLD_STAGE` maps each world to the base space and 3D stage backdrop
  (`celestial` | `night` | `daylight`); `previewWorld()` tries one on without
  saving. A stage change fires a `spacechange` window event; the Fitting Room
  and body cards switch their 3D stage on it.
- `worlds.css`: shared world mechanics. It imports one file per world from
  `worlds/<id>.css`, puts the world's photo (`--world-image`) full-screen on
  the root, and lays a flat `--world-scrim` colour over it via `body::before`
  (the Fitting Room keeps its 3D stage). Each world file owns only selectors
  scoped to `html[data-world="<id>"]` or `[data-world-scope="<id>"]` (the
  samples on the Settings world cards): tokens, fonts, buttons, cards. Worlds
  use no gradients; photos and flat colour only.
- `public/worlds/<id>.jpg` and `<id>-card.jpg`: the world photos (CC0, from
  Wikimedia Commons; source and author in `<id>.credit.txt`).
- `theme.css`: per-space tokens (`--bg`, `--surface`, `--surface-2`,
  `--surface-3`, `--line`, `--ink`, `--ink-2`, `--ink-3`, `--accent`,
  `--accent-2`, `--on-accent`, `--danger`, `--ok`, `--warn`, `--scrim`) and the
  fonts (`--font-display` Gloock, `--font-body` Familjen Grotesk, `--font-mono`
  Martian Mono). Also the flat rules: no border radius, no backdrop blur, no
  translucent surfaces, no smooth gradients (hard-stop colour bands are used
  instead), plus the Fitting Room override layer over the legacy `style.css`.
  In Celestial, elements with class `planet` (`data-planet="1..4"`) render as
  banded planets with the label on top: the main nav, the Body/Closet/Upcycle
  steps and the body-type choice.
- The page stylesheets (`src/explore`, `src/studio`, `src/learn`,
  `src/tutorial`) were converted from hard-coded colours to these tokens.

## The 3D body on every page

- `bodyCard.js`: `bodyCard(options)` markup + `mountBodyCards(root)` lazily
  starts a small viewer (`createScene(..., { framing: 'card' })`) with the saved
  body, outfit and space style. Re-rendered markup reuses the live viewer
  instead of opening another WebGL context.
- `tryOnBody(spec)` previews an idea on a visible card, or on a docked viewer
  when none is on screen. `tryOn.js` turns an Explore project
  (`garmentSpecFromProject`) or an AI Studio analysis (`garmentSpecFromAnalysis`)
  into a garment and `sizeGarmentToBody` keeps the default garment's ease but
  follows the saved measurements.
- Explore try-ons match their cover illustration. `ILLUSTRATION_PALETTES` in
  `src/explore/projects.js` is shared by the SVG generator and the try-on
  (`project.art.cloth` / `.trim`), so the 3D garment has the picture's cloth
  colour, Cottagecore covers become a floral print in the trim colour, and each
  project kind maps to the drawn cut (`KIND_SHAPES` in `tryOn.js`): a strapless
  laced corset, halter tops, knee-length A-line skirts, a short-sleeve A-line
  dress. Sleeveless garments take `neckline: 'strapless' | 'halter'` in
  `model.js` (3D cut) and `flats.js` (2D flat); the painted sports top is
  hidden under them. A try-on takes off the layers that would cover it.
- Speed: built canonical body meshes are stored in IndexedDB
  (`src/character/meshCache.js`) under a version hash of every file in
  `src/character/` (Vite virtual module `virtual:body-mesh-version`), so a
  returning visitor's body appears without a worker build and code changes
  invalidate the cache. Pages with a body card start the body worker and the
  viewer module at boot (`entry.js`). The Fitting Room builds the other body
  shapes in the background after the first one shows, so switching body type
  is an instant morph.

## Measurements

Inches are the default display unit (`state.units`, toggle in the Body and
Closet panels); everything is still stored in centimetres. Sizes run XS–6XL and
ranges were widened (hips to 190 cm, waist and chest to 185 cm, thigh to
105 cm). Larger bodies hang their arms at a wider A-pose (13–30°) so the hands
clear the hips, and carry part of the waist girth as a soft front belly,
redistributed within the measured girth.

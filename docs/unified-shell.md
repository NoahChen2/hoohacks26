# Unified shell, space styles and the 3D body everywhere

Every page (Explore, AI Studio, Fitting Room, Academy, Settings, Saved, project
pages) shares one header, one name (**ReThread**) and one space style.

## Shell (`src/shell/`)

- `shell.js`: `siteHeader(active, { savedCount, account })` returns the header
  markup; `installShell()` binds the space picker. `entry.js` imports it first,
  so `html[data-space]` is set before any page renders. The space style is the
  same setting as the 3D stage backdrop (`localStorage['restitch.stage']`:
  `celestial` | `night` | `daylight`). Changing it fires a `spacechange` window
  event; the Fitting Room and body cards switch their 3D stage on it.
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

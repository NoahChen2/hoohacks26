> Latest correction: the desktop image now opens the focused circular menu directly on hover. The Save pill and visible three-dot trigger have been removed. Touch users hold the image; keyboard users have a focus-only Image actions entry. The four actions sweep along one circle at 205°, 167°, 129°, and 91°, matching the supplied side-arc reference rather than a symmetric arch. Older hover-button descriptions below record the previous iteration.

# Priority fix: contextual actions and long-press image interaction

## Diagnosis

The previous card function returned only a three-dot trigger. It had no hover
Save control and no long-press timer or pointer-drag/release path. The radial
menu did mount after clicking the trigger in a native top-layer dialog; card
`overflow:hidden` and transformed stacking contexts were not clipping that menu.
Mobile compact layouts were intentional rather than a stacking failure. Visual
Search was an explicitly disabled placeholder, not an existing selector.

The fix refactors those same components rather than installing another menu.
The page remains vanilla Vite/JavaScript. A native dialog attached to body is the
framework-neutral equivalent of the requested portal; adding React solely for a
portal would replace the existing stack. Cards and project data are unchanged.

## Interaction changes

- Desktop image hover reveals a coral Save control at top-right, an action
  trigger at bottom-right, and a mild image-only scrim. Titles, avatars and like
  counts remain outside that scrim. All controls are absolutely positioned.
- Clicking the trigger or holding an image for 350ms opens one focus dialog with
  four Lucide controls. Image opacity stays 1, including its transform animation.
- Pointer movement over 10px cancels a pending hold. Native pan and pinch zoom
  remain available before activation. Pointer capture moves to the focus dialog
  once activated. Pointer movement highlights a circular target; release calls
  the shared action dispatcher once. Release outside dismisses without action.
- Gesture tracking uses Pointer Events. A tiny non-passive touchmove guard stops
  native pan only during an already-active hold; it does not implement a second
  touch gesture tracker. It is needed because changing touch-action after
  pointerdown does not change the browser's pan policy for that active pointer.
- The synthetic click following a completed hold is consumed. A fresh pointerdown
  clears that suppression, so the user's next tap still works.
- The arch uses four equally spaced polar angles from pi to 0, centered at 62.5%
  of image height. Buttons are 52px on desktop and 48px elsewhere. A minimum
  radius guarantees 12px between button rectangles. Safe backdrop space can
  extend an arc slightly beyond a narrow card, so 375px phones get a real arc.
  Image and menu shift together by the smallest required viewport correction.
- Short images can use a compact row/grid. Safe areas, visual viewport offsets,
  resize handling, keyboard focus, Escape, outside dismissal, and reduced motion
  remain supported. CSS is consolidated to remove conflicting old corner rules.

## Actions and search

Save uses the existing board dialog and state. Favorite uses the existing liked
array/counter. Share uses the existing native-share/clipboard service.

To make the fourth action usable, the old Visual Search placeholder is replaced
with a local crop-and-match interface: draw, move, resize or keyboard-adjust a
normalized selection; canvas extracts its real pixels; matching searches only
existing project images. Results have tutorials, creators, difficulty and the
same Save-to-Board action. Filters cover style, clothing type, beginner projects
and saved projects. No-results and error states are included.

Matching is **not AI garment recognition**. It uses a real 64-bin RGB histogram
and 8-bin edge-orientation descriptor, compared with cosine similarity. Each
catalog image has three precomputed regions; the index is cached once per page,
not recomputed on every search. The UI explicitly describes color/edge matching
and its limitations. There are no fake confidence percentages or placeholder
results, external uploads, API keys, or additional backend dependencies. Local
SVG assets keep canvas origin-clean. Similar-colored garments can outrank a
semantically similar garment; a trained image embedding model would be needed
for high-quality semantic visual retrieval.

## Files

- Updated: `image-actions.js`, `image-focus.js`, `focus-layout.js`,
  `radial-menu.js`, `page.js`, `interactions.css`, and `types.ts` in `src/explore`.
- Added: `long-press.js`, `visual-search.js`, `crop-geometry.js`, and
  `image-similarity.js` in `src/explore`.
- Tests updated: `tests/explore-focus.test.mjs` and
  `tests/explore-interactions.test.mjs`.
- Tests added: `tests/explore-search.test.mjs`.

## Validation

Build, lint and all 27 tests pass. Existing geometry, fit and persistence tests
remain included. Pure layout tests check non-overlapping targets, aspect ratio
and viewport bounds over 1,920 scenarios. Crop and pixel-matching tests cover
normalized coordinates, movement/resizing, pixel extraction, ranking and filters.

Production Chrome was tested at 1440px desktop and 375px mobile. Native touch
input through Chrome DevTools Protocol verified the 350ms hold, drag highlighting,
release execution, outside release cancellation, ordinary vertical swipes,
subsequent taps and normal tutorial navigation. All four action branches were
executed: Save, Favorite, real clipboard Share, and crop/search. Further touch
checks verified corner resizing, moving, normalized selection after resizing
375 to 430px, result links and saving a match. Desktop checks verified the hover
Save control, four-button arc, opaque image, crop search, filters and empty state.
No JavaScript errors were reported.

Open-state screenshots were captured and inspected for desktop hover, desktop
focus, mobile focus, mobile drag highlight, and search results. Native OS share
sheet completion remains outside headless automation; its existing adapter is
covered by unit mocks. Clipboard fallback was verified against the real browser
clipboard in both desktop and mobile contexts.

## Direct-circle correction validation

All 27 tests, lint, and build pass. Production browser checks verified direct
hover with no visible dots/Save pill, the side arc without overlapping targets,
dismissal and re-entry, favorite/share/board/search actions, native mobile hold
and drag release, and normal image-to-tutorial navigation. Updated open desktop
and 375px mobile screenshots were captured and inspected.

> Current behavior: [priority-image-interactions.md](priority-image-interactions.md) supersedes the earlier trigger-only/placeholder behavior described below.

# Selected-image focus and radial actions

This is an interaction-only update over the existing Explore/detail image controls.
The original images, cards, masonry columns, typography, filters, board storage,
favorites and share service remain. No React runtime was added to this vanilla
Vite application. Lucide's framework-neutral package supplies the same icon set;
CSS transforms/opacity provide the animation without a new animation framework.

## Changed files

- `src/explore/image-actions.js`: replaces four corner controls with one accessible
  three-dot dialog trigger; the existing canonical URL and share service remain.
- `src/explore/image-focus.js`: one activeProjectId, native top-layer focus dialog,
  passive elevated image, source-bounds measurement, focus/dismissal handling and
  coalesced viewport updates. Does not duplicate handlers on the image copy.
- `src/explore/radial-menu.js`: reusable action markup and Lucide icons.
- `src/explore/focus-layout.js`: pure image placement and polar/fallback layout.
- `src/explore/page.js`: both page controls and focus-layer controls call the same
  action dispatcher; existing favorite, board and share code is reused. Favorites
  update in place and stay open. Save closes focus and opens the existing dialog.
- `src/explore/interactions.css`: removes conflicting corner/hover rules and adds
  the trigger, dark backdrop, floating image and staggered radial animations.
  Existing board/profile styles are retained.
- `tests/explore-focus.test.mjs`: bounds, aspect-ratio, safe-area and non-overlap
  checks across breakpoints, image shapes, viewport edges and visual offsets.
- `tests/explore-interactions.test.mjs`: trigger contract updated; sharing/storage
  tests retained. `package.json` / lockfile add the `lucide` dependency.

## Positioning

Source bounds come from getBoundingClientRect on the original image; object-fit:
contain letterboxing is accounted for. The elevated image has the same aspect
ratio and targets 1.045x the source dimensions. It scales down when necessary to
fit viewport margins and the close control. Its center stays at the source center
unless the image needs the smallest possible translation to fit the viewport.

The focus dialog is appended directly to body and displayed in the browser's
native top layer. Its backdrop uses rgba(0,0,0,.75). The selected image is a passive
copy above that backdrop, avoiding all card overflow and transformed stacking
contexts. The original page is inert while focus is open. Closing restores focus
to the source trigger; underlying navigation remains ordinary links.

For four actions, angles are pi, 2pi/3, pi/3 and 0:

    x = centerX + radius * cos(angle)
    y = centerY - radius * sin(angle)

The radius is bounded by 118px and the image width. An arch is accepted only if
its height fits and radius >= (buttonDiameter + 12) / sin(pi/3). This preserves
at least a 12px gap even between axis-aligned hit boxes. Buttons use 50px on
wide desktop and 44px elsewhere. Narrow images use a 2x2 grid; short images can
use a horizontal row in the surrounding safe area. The whole menu is translated
into the viewport as a group, so clamping never collapses distances between
buttons. Close is positioned separately above the image's safe top edge.

Background/image entry takes 200/210ms; action buttons fade/translate in over
180ms with 35ms staggering. Reduced motion disables animations and closes
immediately. Scrolling is locked during focus. Resize, visualViewport resize and
viewport scrolling are coalesced with requestAnimationFrame, with pending work
canceled on close. Favorite re-renders do not reposition the elevated image.

## Existing Visual Search limitation

The repository has no crop selector or visual-search implementation. Its existing
aria-disabled placeholder and explanatory notice are preserved. This redesign
does not pretend to transition to a nonexistent selection mode or introduce a
new search feature. Save, Favorite and Share retain their existing behavior.

## Verification

- `npm test`: all 25 tests pass. The layout test covers 1,920 combinations of
  widths, heights, source widths, source aspect ratios and viewport edges.
- `npm run lint`, `npm run build`, and `git diff --check` pass.
- Production Chrome: desktop trigger reveal and focus, unchanged source height,
  only one menu, favorite update without closing, real clipboard copy, board
  dialog transition/save, deferred-search notice, Tab wrapping/focus restoration,
  Escape/outside dismissal, scrolled bottom cards, live resize through 320, 375,
  430, 768, 1024 and 1440px, detail-image controls, touch activation at three
  phone widths, normal image navigation after dismissal and reduced motion.
- Button rectangles and selected images were checked against viewport bounds;
  button hit targets were checked for intersections in the rendered browser.
- Desktop and all three phone-width screenshots were actually inspected. No
  JavaScript errors were reported. Native OS sharing is not automated; existing
  native success/cancel/fallback adapters remain covered by unit mocks.

Review: open /explore, hover an image and click its dots, or tap the dots on a
phone. Try Favorite, Save to Board, and Share. Escape, X, or the dark background
closes focus. Resize while open and inspect a card after scrolling down the feed.

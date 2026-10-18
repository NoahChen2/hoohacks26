> Current behavior: [priority-image-interactions.md](priority-image-interactions.md) supersedes the earlier trigger-only/placeholder behavior described below.

# Image interactions and guest boards — Phases 1 and 2

The existing vanilla JavaScript / Vite stack and editorial feed/detail styles
are retained. These phases add image actions, favorites, sharing, and boards.
Visual Search is a keyboard-focusable, aria-disabled placeholder explaining that
it belongs to the next stage. No crop selector, search provider, API, embeddings,
or search results were implemented.

## Files

- `src/explore/image-actions.js`: reusable overlay plus canonical URL/native-share/
  clipboard service. Shares never contain feed filters. Canceling a native share
  does not copy a link or claim success. Failed native sharing falls back to
  clipboard; unavailable/denied clipboard access shows an honest error.
- `src/explore/ui.js`: shared escaped HTML and SVG icons.
- `src/explore/board-dialog.js`: native modal dialog, checkboxes for multiple board
  memberships, inline creation and validation, Escape/Done/backdrop dismissal,
  focus restoration and scroll preservation.
- `src/explore/library.js`: immutable board updates and read-only additive legacy
  migration over the existing discovery localStorage key. Legacy bookmarks are
  assigned to My Inspiration; existing favorites and unknown fields survive.
- `src/explore/boards.js`: profile Saved Boards, collages, counts, galleries,
  removal controls, and favorites. Profile is at `/profile`; each collection has
  a bookmarkable local route `/profile?board=ID` (its contents remain browser-local).
- `src/explore/types.ts`: Board, SavedBoardItem and ProjectLibrary types.
- `src/explore/interactions.css`: scoped 180 ms image overlays, touch menus,
  modal and profile styles; reduced-motion support.
- `src/explore/page.js`, `src/entry.js`: route and event integration; existing
  favorite counts and filtered feeds remain connected to the same state.
- `tsconfig.json`, `eslint.config.js`, `package.json`: include new types/tests in
  checks. `tests/explore-interactions.test.mjs`: migration, board membership,
  idempotency, sharing, errors and deferred-search behavior.

## Data behavior

The same `rethread.explore.v1` key now contains a version-2 snapshot with `boards`
in addition to existing `liked` and `saved` arrays. `saved` is the unique union
of board memberships, so saving to three boards still counts as one saved
project. Removing from one board retains the other memberships. Saved filtering
continues to work. Reading legacy data never writes to storage. Favorites reuse
`liked` rather than adding a second counter or favorites array.

The default boards are My Inspiration, Denim Upcycling, and Projects to Try.
Custom board names must be 1–60 characters and unique ignoring case. Board names
are rendered as text/escaped HTML. Data remains local to this browser, works in
guest mode, and never requires credentials or modifies the studio account data.
Blocked/full storage retains changes in memory with an explicit notice. Different
browser tabs refresh on storage events. Concurrent simultaneous edits are last
writer wins, matching the existing local-storage persistence behavior.

## Manual review

1. Open `/explore`. Hover an image or Tab to its actions. Check that the image
   size and feed spacing stay the same. On a phone, tap the floating `…` button;
   tap again, outside the image, or press Escape to close the action menu.
2. Toggle Favorite, then refresh. Verify the filled heart and one-count change in
   the existing like control. Repeat on a project-detail image.
3. Choose Save to Board. Check My Inspiration and Denim Upcycling; create a new
   board, and verify it is automatically selected for that project. Reopen and
   uncheck one board; the project stays in the other boards. Duplicate names
   produce an inline validation message, not a second board.
4. Open Saved in the header (`/profile`). Review collages and counts; open a
   board gallery and remove a project. Refresh to verify persistence. Create a
   blank board from the profile and check its empty state.
5. Share: supported devices open their native share sheet. Other browsers copy
   the canonical `/project/:id` link. Review the toast, and paste to verify the
   URL. Dismissing the native share sheet does not claim it was shared.
6. Close the board dialog with Escape and check focus returns to the invoking
   action. Keyboard navigation stays inside the native dialog while it is open.
7. Visual Search explains that it is coming in the next stage. No search runs.

## Validation

`npm run lint`, `npm test` (23 tests), and `npm run build` pass.
Production Chrome checks cover desktop hover dimensions, keyboard favorite
activation, touch menu open/close and favorite actions, legacy saves, creating
and saving to multiple boards, removal, duplicate names, profile/galleries,
refresh persistence, clipboard copying with real browser clipboard permission,
and the native-share adapter using a mock. Native OS share-sheet completion
cannot be automated in headless Chrome; its success/cancellation/fallback paths
are covered with mocks. No actual message was sent to another person.
Desktop overlays/dialog/profile and mobile controls/profile were visually
inspected. Existing unit tests still cover canonical measurements, garments,
guest persistence, and GLB mapping. No claim of visual search functionality is
made in this review stage.

Additional browser checks passed for clipboard rejection, blocked storage with
in-memory saves, UUID fallback, explicit Tab wrapping and Escape focus return,
scroll restoration, project image navigation with filter return, and studio boot.

## Subsequent interaction redesign

The original corner controls described above are now replaced by a selected-image
focus layer and responsive radial menu. See [image-focus-redesign.md](image-focus-redesign.md)
for current behavior, files, geometry calculations and validation. Boards and
persistence remain as documented here.

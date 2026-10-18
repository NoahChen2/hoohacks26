# Guided upcycling tutorials (Step 5)

`/project/[id]` now includes materials and tools checklists, step completion, progress, safety notes, optional before/after photos, and a completion celebration. Supply checks are preparation aids; finishing requires all instruction steps and an explicit confirmation that an existing garment was reused. Completed projects keep their original completion records and cannot be completed again for rewards.

## Local persistence and shared rewards

- Progress: `rethread.tutorial.progress.v1.<projectId>` in localStorage.
- Completed project / reward / reuse record: `rethread.tutorial.completion.v1.<projectId>` in localStorage.
- Saved generated project: `rethread.tutorial.generated.v1.<sha256>` in localStorage.
- Optional photo blobs: `rethread-tutorial-photos` IndexedDB database, `photos` store, keyed by project and before/after slot. They are not uploaded to a server. The existing Studio upload itself is not saved.

`awardProjectCompletion(storage, project)` in `src/tutorial/store.js` is the shared completion/reward function. It checks persisted step progress before writing one completion record with 100 XP, 40 currency, timestamp, source, and one user-confirmed garment-reuse entry. `getRewardSummary(storage)` derives totals from these per-project records. There is no independently incremented wallet that can be incremented twice. Repeated writes to the same project key cannot multiply totals; shared garment IDs prevent multiple ideas for the same uploaded garment from counting more than once in the reuse total. Completed-project count still counts individual completed projects.

Storage errors do not announce an award. Existing legacy board/account/studio keys are untouched. These are local, user-controlled MVP records, not a tamper-proof server economy. The reuse record is prepared for a future sustainability dashboard; no water, carbon, or weight savings are invented.

## AI tutorial saving

In Studio, open a result and choose **Save & open tutorial**. The full validated idea, warnings, demo/live source and garment reference are stored. A SHA-256 of normalized project content gives the same idea a stable ID, preventing duplicate saves and repeat rewards for that identical idea. The tutorial opens at `/project/ai-…` and appears under **Saved → Saved AI tutorials**. Photos are not required or saved as part of this action. Generated tutorials use a clearly labeled bundled placeholder illustration, not a predicted outcome image.

Generated tutorials stay in the browser that saved them. They are not publicly published and links do not transfer their data to another browser. Demo ideas retain their “photo was not analyzed” disclosure and warnings. Profile/Saved shows XP, currency, completed-project and unique garment-reuse totals alongside completed project links.

## Verification

Build, lint and automated tests cover existing features plus tutorial metadata, progress restoration, invalid indices, storage failures, exact rewards, duplicate prevention, shared garment reuse, stable generated IDs, schema validation, and legacy storage preservation.

Browser checks cover seeded tutorials, persistent checklists, before-photo save/reload/remove, completion and celebration, repeat completion prevention after refresh, saving a real demo Studio response as a tutorial, re-opening it from Saved, and mobile layout. Desktop and mobile rendered pages were visually inspected.

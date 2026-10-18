# Interactive Sewing Academy (Step 6)

`/learn` contains reusable cards grouped into Beginner (5), Intermediate (3), and Advanced (3). All 11 requested topics are implemented with written explanations, estimated duration, difficulty, a native SVG learning area, and five original multiple-choice questions with answer explanations. Running stitch and backstitch include a keyboard-accessible tracing slider. Lesson links use `/learn?lesson=<id>` and invalid IDs show a not-found view.

## Quiz flow

Answers save immediately to `rethread.academy.progress.v1.<lessonId>`. Refresh restores partial answers or the last submitted quiz, attempt count and best score. Submitting requires all five answers. Four correct answers (80%) pass. Every submitted question displays the correct answer and an explanation. Retry clears current answers while retaining attempt history, best score, and earned completion records. Completed quizzes remain available for practice.

Storage failures show an error and roll the changed radio selection back rather than claiming it was saved. No existing board, tutorial, onboarding or studio keys are migrated or removed.

## Shared rewards

`awardLessonCompletion` in `src/tutorial/store.js` writes one immutable `rethread.academy.completion.v1.<lessonId>` record on a first pass: 50 XP, 20 base currency, timestamp and passing score. Repeated practice does not add another reward. Corrupt completion records are preserved with an error rather than overwritten.

The existing `getRewardSummary` now combines lesson rewards and tutorial rewards. It exposes `completedLessons` separately from `completedProjects`; learning never increases garment reuse. Saved/Profile and the academy show the shared balance. This remains the existing local, user-controlled MVP reward system, not a server-authoritative economy.

## Validation

- `npm run lint`, `npm test`, `npm run build`: pass; 50 automated tests total.
- New tests cover all requested topics, complete content and quiz metadata, the exact 80% passing boundary, invalid/incomplete answers, partial restoration, failed attempt → retry → pass, duplicate prevention, mixed tutorial/lesson balances, unchanged reuse counts, corrupt entries and blocked storage.
- Browser checks cover 11 cards, saved partial quizzes, feedback after failure, 80% pass, first reward, practice without repeat reward, completion after refresh, running-stitch interaction, shared balances, blocked-storage feedback and mobile overflow.
- Desktop catalog and mobile lesson/visual areas were visually inspected.

These are written guides with schematic illustrations; there are no embedded tutorial videos, paid services or additional AI calls. No broader gamification pages are added in Step 6.

# Personalized onboarding (Step 3)

- `/onboarding`: four validated steps for aesthetics, sewing experience, tools, and world. Chinese Cultivation is the initial world. Skip stores the selections made so far with a skipped status.
- First visits to `/explore` open onboarding. Completed/skipped visitors go directly to Explore, including when revisiting `/onboarding`.
- `/settings`: edit the same preferences, with Save and Cancel. A Settings link appears in the discovery header.
- Preferences are isolated in `rethread.preferences.v1`; existing boards, likes, account and studio storage are untouched. Settings changes are committed only on Save.
- Storage failures display an error and an explicit link to Explore for that visit, rather than reporting that preferences were saved.
- Explore filters first, then ranks results: explicit aesthetic match +100; exact skill +30; easier skill +15. Original catalog order breaks ties. No random scores or invented aesthetic metadata. Tools and world are saved but do not affect ranking.
- Coquette, Alternative, and Bohemian are selectable preferences; the demo catalog does not yet contain those aesthetics.
- World visuals are original CSS previews with sample ranks. No game progression, XP, or theme changes to the studio are implemented.

Validation: `npm run lint`, `npm test`, `npm run build`. Browser checks cover the complete flow, validation, back navigation, exclusive tools, refresh, returning visits, skip, settings, ranking, and a 375px mobile viewport. Desktop and mobile world selections were visually inspected.

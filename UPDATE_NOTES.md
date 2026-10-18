ReThread progression update

Changed files
- src/progression.js: shared world configuration, eight unchanged tier thresholds, versioned progression migration, deduplicated project rewards, event attribution, local Monday boundaries, seeded makers, ranking calculations.
- src/ui/rankCrest.js: original SVG crests and school emblems.
- src/ui/communityPanel.js: profile/progression overview, optional school search and preview, community detail, three ranking views, periods, school filters, podiums, showcases and shared goal.
- src/state.js: safe migration, immediate local reward/membership persistence and account cache isolation. Existing body, closet and tools remain intact. Demo progression is intentionally excluded from cloud snapshots.
- src/ui/upcyclePanel.js: once-per-garment/project completion, reward feedback, rank-up display and community links.
- src/main.js, index.html, src/style.css: studio integration, hash routing and responsive/reduced-motion styling.
- package.json, package-lock.json, tests/: reproducible unit and browser checks.

Manual flow
1. Run npm.cmd install, then npm.cmd run dev. Open the displayed URL.
2. Open Ranks & schools. Select each world to see its ranks, currency labels and community vocabulary. Global rankings work without joining a school.
3. Choose a school type, search for a school, open its preview and join. Joining adds no XP. Inspect the demo disclosure, weekly goal, showcase and members.
4. Open Upcycle, open a ready project's Step-by-step instructions, and click I completed this project. Receive 100 XP and 40 world currency, with rank progress and school attribution. Reopening that same garment/project cannot award again.
5. Return to Ranks & schools. Inspect Global Makers, My Community and School Communities; switch week/all time and high school/university filters.
6. Change worlds and refresh. Membership, XP, currency and contributions persist. Leave or switch schools, complete a different project, and inspect localStorage restitch.v1 progression.events: old events retain their original communityId and new events use the new school.
7. Repeat on a 375px viewport and with reduced motion enabled. Controls support keyboard focus; selected states have explicit pressed semantics and crests have accessible labels.

Checks
- npm.cmd test: six tests covering migration, legacy XP, school attribution, deduplication, theme invariance, weekly boundaries, all 40 crest variants, and reload persistence.
- npm.cmd run build: production build.
- npm.cmd run test:browser (with dev server running): real Chromium checks joining, theme switching, refresh, completing a project, repeat prevention, school switching, school filter, mobile overflow and JavaScript errors. Install the browser once with npx.cmd playwright install chromium.
- No lint or typecheck script existed in this JavaScript repository; neither is claimed as run.

Demo scope and repository differences
This checkout was ReStitch's 3D studio and had no existing ranks, five worlds, completion system, Explore feed, or typed storage layer. The update adds a shared progression model with JSDoc event types, preserving the existing studio and storage key. It does not invent an unrelated Explore feed; showcase imagery uses existing garment illustrations rather than a new photography feed. Profile and progression share the Ranks & schools overview.
Community routes use #/community/schools/[id] so existing Vite routes remain intact. Real school names identify demo communities only. Other makers, member totals, rankings and seeded project activity are simulated and cannot synchronize between devices. Membership is unverified and requests no school email. Shared weekly goals award nothing extra. All Time personal scores include legacy XP without fabricated reward dates; school scores only include attributed events. Demo activity is generated for the browser's current week.
The build retains Vite's large-chunk advisory for the Three.js bundle.

Visual world follow-up
- Expanded the community section to the full studio width and added original, world-specific vector scenery, ornamental headings, world seals, and tinted backgrounds.
- Crests now contain title-specific motifs across all 40 world/rank combinations: sprouts and moonflowers, shields and forge tools, scissors and couture silhouettes, circuits and signal bars, silk and celestial symbols.
- Added rank flavor text and an eight-rank journey gallery with current/reached/ahead states.
- Higher tiers gain brighter halo effects, rotating orbital rings, and a top-tier shimmer. Reduced-motion preferences stop these animations.
- Verified all five worlds at desktop and 375px widths, high-tier animation and reduced motion, plus the existing complete browser flow, six logic tests and production build. The additional presentation check is npm.cmd run test:worlds (dev server required).

Icon, typography, and motion polish
- Rank icons now use beveled metallic SVG gradients, dark enamel, engraved world-specific frames, faceted gem inlays, dimensional title symbols, and Roman numeral tier plates. Community emblems now feature architectural crests, laurel details, and open books.
- Bundled Cinzel, Cormorant Garamond, Uncial Antiqua, Bodoni Moda, and Orbitron locally, with their OFL licenses, for distinct world titles and rank labels.
- Added drifting petals, rising runes, silk-like light sweeps, traveling circuit signals, floating badges, enamel shimmer, and rotating celestial details. Reduced-motion preferences stop all continuous effects.
- Browser presentation checks verify that all five local fonts load and apply, each world animates, SVG gradient IDs are unique, mobile layouts fit, and reduced motion disables particle, badge, orbit, and shimmer animations.

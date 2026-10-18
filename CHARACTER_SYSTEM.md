# ReThread character and artifact system

Open **Ranks & schools → Open character pavilion**, or `#/character`.

## Implemented

- One layered SVG character renderer for all five worlds: scene, aura, ground formation, body, hair, outfit, embroidery, handheld, orbiting equipment, particles, crest, name and title. Original artwork uses jade/ink/ivory/gold, mountains, spiritual thread, embroidered garments, and needle artifacts.
- Nine equipment slots, per-world loadouts, colors, backgrounds, display name, Off/Low/Full intensity, persistent pause, equip/unequip, and zoomed item previews. Clearing a slot remains cleared after refresh.
- 125 defined cosmetics: 37 free starter items, 40 milestone variants (eight per world), and 48 shop items. Each other world has a full nine-slot starter look and a nine-slot advanced shop look.
- All eight requested cultivation artifacts have their specified rank gates, costs and illustrated effects. Seven-Stitch Needle Array has seven orbiting needles in Full, three stationary needles in Low, and a complete seven-needle illustration in Off/static mode.
- Seven parameterized cultivation auras. Foundation Thread and Void Refinement are free milestones. Other cultivation aura prices are Quiet Chi 30, Golden Core 120, Lotus Soul 180, Soul Transformation 240, and Immortal Weaver 480 Chi. No loot boxes or gameplay bonuses.
- All eight free rank milestones, automatically granted once through stable IDs; each includes an equivalent cosmetic for the other worlds. Existing higher-rank profiles receive their eligible cosmetics during migration without a ceremony or currency deduction.
- A focused, skippable breakthrough dialog with a 3.2-second visual sequence, highest new rank, all newly crossed milestone rewards, Equip Reward and Continue. It is triggered only by newly earned reward results; no pending celebration is saved or replayed on refresh/theme changes. Multiple crossed ranks produce one dialog.
- Profile displays the equipped character. Leaderboards use small static vector portraits and the equipped frame for the current user. There are no particle systems in leaderboard rows. Project completion adds a brief thread of light through the XP bar and names the next free cosmetic.
- Version 3 progression migration preserves XP, currency, school attribution, completions, achievements and unknown legacy fields. Avatar state has its own version and preserves unknown item IDs in an archive with an explicit unavailable-renderer explanation.
- Shared purchase/equip validation prevents duplicate purchases, overspending, rank bypasses, wrong slots/worlds and unowned equipment. Cosmetic changes do not affect XP or community scores.
- Scenes pause offscreen, under a modal, and when the document is hidden. Reduced motion defaults new profiles to Low and disables continuous animation. Normal character effects use at most 18 SVG particles; ceremonies add at most six threads (24 combined). No canvas, sound, camera shake, full-screen distortion, or pose controls.
- Elaborate scene, pavilion, and breakthrough code loads through dynamic imports. Static portraits do not import the scene renderer. Outfit changes do not rebuild the unrelated Three.js garment/body scene.

## Main files

- `src/avatar/items.js`: typed item fields, all cosmetic catalog entries, starter looks and milestone definitions.
- `src/avatar/inventory.js`: safe avatar migration, grants and shared inventory/equipment validation.
- `src/avatar/effects.js`: checked JSDoc aura registry and world palettes.
- `src/avatar/artwork.js`, `layers.js`, `CharacterScene.js`: original reusable SVG assets and shared layered rendering.
- `src/avatar/lifecycle.js`: visibility and modal animation lifecycle.
- `src/avatar/pavilion.js`, `ItemPreview.js`, `BreakthroughDialog.js`, `portrait.js`, `avatar.css`: interface, previews, celebrations and static portraits.
- `src/ranks.js`, `src/progression.js`, `src/state.js`: shared rank math, reward integration and persistence migration.
- `src/main.js`, `src/ui/communityPanel.js`, `src/ui/upcyclePanel.js`, `src/style.css`: navigation, profile, leaderboard and completion integration.
- `package.json`, `package-lock.json`, `tests/avatar.test.js`, `tests/avatar-browser.mjs`, existing tests: verification scripts and TypeScript checker dependency.

## Verification

- `npm.cmd test`: 14 tests for migration, milestone idempotence, catalog metadata, purchases, rank/slot/world/ownership checks, unequip persistence, loadout switching, contribution invariance, multiple-rank reward handling, effects caps, weekly dates, saved progress and duplicate completions.
- `npm.cmd run typecheck`: TypeScript checks the JSDoc effect registry. This is a focused registry check, not a claim that the existing JavaScript application is fully typed.
- `npm.cmd run build`: production Vite build; retains the existing large Three.js bundle advisory. Character scenes, wardrobe and breakthrough are separate lazy chunks.
- With `npm.cmd run dev` running: `npm.cmd run test:avatar`, `npm.cmd run test:browser`, and `npm.cmd run test:worlds` exercise real Chromium flows, purchases and grants, preview-only behavior, exact array modes, persistent equipment/preferences, all world looks, static portraits, reduced motion, offscreen/tab/modal pause, multiple-rank ceremony, responsive layouts and browser errors.
- No lint configuration exists in this repository.

## Manual review

1. Open Profile through Ranks & schools, then the character pavilion. Inspect starter equipment, all nine slots, and the free milestone shelf.
2. Open a ready Upcycle project, read the steps and mark it completed. The first completion awards 100 XP / 40 currency. The first breakthrough grants Sage Sash (or the corresponding world cosmetic). Equip Reward or skip; both keep the free item owned. Reopening the same garment/project does not award twice.
3. At 100 XP, preview and buy Jade Thread Shuttle for 40 Chi, then equip it. Confirm the balance, outfit and artifact; refresh. Try unaffordable and higher-rank items to see their locked states.
4. Change color, background, display name, intensity and pause. Clear a slot and refresh; it stays cleared. Select each world and return to see the prior world's saved loadout and colors.
5. Earn further rank thresholds (300 / 700 / 1400 / 2500 / 4000 / 6000 XP) to receive milestones. Shop previews can be inspected while locked. At 300 XP, buy the Seven-Stitch Needle Array and compare Full, Low and Off.
6. Review the Profile character and static leaderboard portraits. Community membership and scores must stay unchanged when cosmetics/worlds change.
7. Review at 375px width, with keyboard navigation and reduced motion enabled. Scroll the profile character offscreen to pause it; switch tabs or open a preview to pause covered scenes.

## Scope and limitations

The repository is a vanilla JavaScript/Vite studio, so the reusable components are SVG-generating modules rather than React components. The character uses one front pose; unavailable rotation controls are intentionally absent. There was no Explore feed in this checkout, so no feed or student directory was added. Existing fashion/garment content and studio routes remain in place.

Progression, inventory and communities retain the existing device-local demo behavior; this update does not add account-wide inventory synchronization. Unknown legacy item IDs remain owned, but require a known renderer before they can be equipped. Other leaderboard makers remain explicitly simulated; their portraits are demo looks. No requested core pavilion, shop, aura, milestone, equipment or breakthrough feature is intentionally left as a placeholder.

Reference-driven art direction update
- Used the supplied visual references for broad manhwa qualities: strong ink silhouettes, hard cel-shaded faces, detailed hair sections, flowing layered garments, concentrated edge light, dark presentation panels, and energy trails.
- Added src/avatar/characterDrawing.js with original body, face, hair and outfit drawings. Kept precise shared equipment anchors, per-world costume details and all existing inventory behavior.
- Reworked aura silhouettes and added slow ink-like energy sheets, stitch-light traces, hair and fabric motion; static/low/reduced-motion/pause behaviors remain supported.
- Restyled only the pavilion and item/breakthrough dialogs with dark ink surfaces and jade/gold accents. Updated static leaderboard portraits to match the redrawn character.
- Reference images are inspiration only; no panels, dialogue, existing characters, logos, or source image files are embedded in the application.

Painted graphics replacement and reactive effects
- Replaced the vector avatar and material thumbnails with seven original generated artwork atlases under public/art/manhwa. Five character atlases provide starter/advanced looks and distinct neutral, wave and celebration poses. Environment and artifact atlases provide illustrated scenery and dimensional material assets.
- Added src/avatar/artManifest.js, paintedArt.js and interactionEffects.js. CharacterScene, ItemArt, portraits, equipment layers, item previews and breakthroughs now consume the local artwork.
- Added Wave / Focus / Celebrate controls, keyboard-activated character interaction, gentle breathing and pointer parallax. Mist or cyberpunk lightning reacts at pointer locations across the application, with transient state and capped particle counts.
- Reworked the pavilion's backgrounds and translucent wardrobe, progression banners, navigation and studio backdrop. Removed the former vector characterDrawing.js. Preserved the inventory model, XP, currency, milestones, school scores, and per-world settings.
- Outfit colors tint painted cloth on demand rather than flattening the entire character illustration. Pose clipping prevents neighboring atlas frames appearing in the viewport.
- Asset paths, generation mode, prompt specifications and runtime details are documented in public/art/manhwa/ART_DIRECTION.md.

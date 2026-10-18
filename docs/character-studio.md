# Character Studio — phase 1 and phase 2 review

## Inspection and scope

ReStitch is a **Vite / vanilla JavaScript** application, not React. Its renderer is
Three.js r169. The engine supports `SkinnedMesh`, skeletons and glTF morph targets;
the repository did not contain any GLB/glTF assets, rig or morph target mappings.
The original mannequin used separate elliptical ring surfaces and spheres.

Only anatomy, body starting points and visual body proportions are implemented in
this iteration. Face controls, hair, skin controls, new garment categories, a
six-tab studio and additional camera modes are intentionally deferred. Studio
lighting, orbit camera, closet and upcycling workflows remain. The Clothing
visibility toggle is provided for reviewing the body under garments.

The studio stage is celestial (`src/stage.js`): a galaxy sky, a glowing
pedestal with no solid floor, drifting nebula clouds and twinkling stars, with a
sparkle "wish reveal" on garment changes. The sky animates at full rate on
desktop, at 30 fps on mobile, and stays still on the lowest tier or when reduced
motion is requested.

The adaptive body profile (Frame & maternity, Accessibility panes) shapes the 3D
character where it is modelled: the body frame selects the feminine, neutral
(an in-between blend) or masculine shape; bust volume follows chest projection
and chest minus underbust, and either side (the person's own left or right) can
be flat; maternity trimester or a custom belly projection adds an abdomen after
the girth calibration, so measured chest, waist and hips are unchanged and
garments conform over it. Posture, stature, limb-to-torso ratio and limb
differences are saved with the profile but are not yet shown on the 3D
character; the panel says so.

The figure and clothes render in a comic style: flat cartoon colours, one hard
shadow band with halftone dots, ink rim lines and a constant-width inverted-hull
outline (`src/materials.js`). Face, hair, muscle definition, underwear and shoes
are line art painted by the body shader in measured coordinates, so they follow
every proportion slider; they are not geometry and not customizable yet.

## Architecture

- `src/character/measurements.js`: existing centimetre body model and ellipse
  perimeter formulas, moved without changing their fitting behavior.
- `src/character/sections.js`: calibrated polar torso sections and conservative
  clearance between the procedural body and existing garment surfaces.
- `src/character/geometry.js`: signed-distance volume with smooth unions and one
  closed, connected marching-cubes surface. The neck, shoulders, hands, ankles
  and feet are joined before extraction rather than rendered as separate pieces.
- `src/character/body.worker.js` / `service.js`: builds one **canonical** body per
  shape (`canonical.js`) off the main thread: marching cubes, welded to an
  indexed mesh, Taubin-smoothed (`finish.js`), with ambient occlusion baked from
  the distance field, skin weights and morph regions. `src/boot.js` starts this
  worker before the app bundle loads (`main.js` is a 3 kB entry that then
  imports `app.js`). The canonical mesh also carries the sculpted face planes,
  hair volume (short spiky cut or bob with side curtains) and jointed fingers.
- `src/character/morph.js`: every measurement change morphs the canonical mesh
  in a few milliseconds instead of re-meshing it. Torso vertices land on the
  target's calibrated polar sections; legs and arms follow their measured radius
  profiles and joints; head, hands and feet scale with stature. Region weights
  blend the maps at the joints. Camera position is not reset on customization.
- `src/character/presentation.js`: explicitly approximate visual proportions.
  This same transformation is applied to the body and clothing. Smooth normals
  are transformed with local tangent vectors rather than recomputed per triangle.
- `src/character/types.ts` / `settings.ts`: typed customization data, shape and
  build options, defaults and additive normalization.
- `src/character/assets.ts`: GLTFLoader path, skeleton/morph inventory, calibrated
  morph application with unsupported/out-of-range reporting, asset disposal.
- `src/model.js`: existing garment mesh generation, fit warnings and exports.
- `src/flats.js`: unchanged flat-lay garment landmarks and cutting-guide geometry.
- `src/upcycle.js`: unchanged measurement-based project/cut calculations.
- `src/ui/bodyPanel.js`: shape/build options, existing XS–XL measurement controls,
  plus an explicitly separated appearance section.
- `src/character/rig.js`: eight-bone skeleton (spine, head, upper/lower arms,
  a hem bone), skin weights baked by the body worker, garment weight transfer
  and the cycling animation clips (Idle, Wave, Stretch, Twist, Check sleeve,
  Shrug). Toggle with **Animate**; poses never affect fit calculations.
- `src/quality.js`: device tier (high, mobile, low; `?quality=` overrides) for
  pixel ratio, MSAA, shadows, body mesh resolution and frame rate.
- `src/state.js`: additive local migration and character data in the existing
  cloud snapshot; no new database table or authentication flow.

## Measurement contract and limitations

Canonical inputs are centimetres. XS, S, M, L and XL measurement values are
unchanged. Selecting feminine/masculine changes a shape prior and keeps current
measurements. Selecting a build sets editable measurement values; either body
shape can use every build and garment. Size presets restore their original
measurement values. Cosmetic changes do not alter garment data or fit warnings.

The procedural torso's chest, waist and hip **cross-section perimeters** are
numerically calibrated to the measurement model (tested within 1.5% before
cosmetic transforms). This does not establish clinical or tailoring accuracy for
the full rendered anatomy. Smooth unions at joints, interpolation, bust
assumptions, depth distribution and finite voxel resolution remain approximations.
Measurements alone do not determine bust distribution, soft tissue or anatomy.

Appearance-only sliders deliberately change visible dimensions. They are labeled
as such: rendered dimensions may then differ from tape measurements. Torso length
and leg ratio are coupled to preserve overall height. Upper-arm, thigh, calf,
fullness and muscle controls are procedural approximations, not calibrated
anatomical morphs. Exact new anatomical measurements need an authored morph set
and calibration data. Implausible inseam/height combinations show a preview
limitation while measurements remain saved.

The fallback has a light procedural rig, is not a body scan, and is not AAA or
Fortnite-quality. Rendered proportions follow standard anthropometric ratios
(head ~13% of stature, trapezius meeting the neck near 0.85 H, fingertips near
0.38 H, feet ~15% of stature); arm length is taped from the shoulder point.
Legs are deliberately stylized shorter: the rendered crotch sits 4.5% of stature
(~8 cm at 172 cm) below the measured inseam and the torso lengthens to keep
stature (`LEG_STYLE` in `presentation.js`); arms move with the shoulder rather
than stretching. This is appearance only: fit checks and garment cutting use the
measured inseam. The leg-to-torso slider adjusts around this baseline.
Hands have a palm, thumb and finger grouping but no articulated finger rig.

No cloth simulation is introduced. Each garment vertex copies the averaged skin
weights of the body surface nearest it (only sleeves may bind to arm skin) and
is pushed out along that skin normal if it lies within clearance, so clothing
moves with the same transforms as the skin beneath it. Linear blend skinning
still thins the shoulder at extreme poses, and loose cloth does not swing.
Existing procedural fabrics, folds and fit colors are retained; clothes are
given clearance without changing their measured data.

Performance: the welded body has ~6x fewer vertices than the raw surface;
measurement changes are a main-thread morph (no worker round trip), garment
materials persist (shader programs compile once, in parallel at startup via
`compileAsync`), garment textures are cached, and the exact garment weight
transfer runs time-sliced after input settles. The line art is data (a stroke
texture read in one loop) so the body shader stays small: Direct3D shader
compilers on Windows unroll and inline code, and the earlier hard-coded strokes
took over three seconds to link. All materials are Lambert-based; there is no
environment map. Frames are only drawn while animating, turning or after a change.

## Importing a licensed rigged character

No external character models were downloaded. Supply original or appropriately
licensed assets and attribution. The scene has an optional integration point:

```js
const scene = createScene(viewport, { characterAsset: manifest });
```

The default is `characterAsset: null`, which uses the clearly labeled procedural
fallback. `CharacterAssetManifest` defines URL, license, attribution, units and an
**asset-specific** mapping from canonical inputs to authored morph names/ranges.
The loader preserves the actual skinned meshes, skeleton, animations and native
materials; centimetres are used in the scene. It loads once per scene, applies
morphs on subsequent changes and does not apply procedural vertex warping to a
skinned asset. Unsupported controls or ranges are reported and trigger an
explicit procedural fallback rather than claiming an unsupported deformation.
The loader disposes rejected assets; the viewer disposes replaced/cached data.

Required assets before production-quality character rendering can be claimed:

1. A licensed neutral A-pose human GLB with +Y up, front +Z, feet at the origin,
   coherent body topology, hand/foot detail, skeleton and known units. Match the
   current 13-degree arm A-pose or provide a calibrated pose/garment adapter.
2. Authored and calibrated morphs for height, chest/bust, waist, hips, shoulders,
   arm length, inseam, neck and thigh; a feminine shape blend (`feminine` binding,
   0–1); and each supported visual proportion, including its neutral value.
   Current mappings use linear 0–1 influences over declared min/max ranges. A
   non-linear or multi-morph asset needs its own calibrated mapping adapter.
3. Landmark and circumference fixtures to verify the asset's actual deformed
   sections, height, bone positions and permitted morph combinations. Merely
   having a similarly named morph is not evidence of fit accuracy.
4. Compatible authored garments with the same skeleton and calibrated garment
   morphs before asset-quality clothing conformance can be claimed. Existing
   procedural garments remain an approximate preview when a GLB is supplied.
5. Future face/hair assets and material maps for later phases, with mobile LODs.

Do not use ripped Fortnite, Roblox, The Sims or JoJo models.

## Persistence

Old `restitch.v1` data is read without overwriting it on load. Missing character
settings receive defaults in memory; measurements, garment IDs, sketches, tools
and unknown legacy fields are preserved. Shape, build, selected size and visual
proportions are saved through the existing debounced local save and included in
`user_data.data` for Supabase. Per-account caches remain separate. Loading an
older snapshot without character data preserves the current character settings.
Missing/disabled Supabase configuration still uses existing guest-only mode.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run build` (build includes typechecking).
The tests cover both body shapes at XS, M and XL; a single connected, closed
surface; finite attributes; height; numerical circumferences; every current
garment category; snug/oversized measurements; cosmetic/measurement separation;
legacy persistence and cloud payloads; and skeleton/morph mapping behavior with
a synthetic skinned mesh. They do not establish quality or calibration of an
external GLB: no suitable GLB is currently installed.

Browser review should additionally cover front/side/back, body/build controls,
clothing and fit-map toggles, restoration after reload, rapid slider changes,
existing closet/upcycling actions and a narrow viewport. Screenshots alone do
not establish tailoring accuracy.

### Review record for this implementation

- 14 automated tests pass; TypeScript checks and the production build pass.
- Both shape options were rendered at XS, M and XL and the front, side and back
  screenshots were inspected. The neutral head, simplified hands and stylized
  shading remain visibly procedural; no asset-quality claim is made.
- Production-browser checks passed for all six builds, appearance controls,
  unchanged measurement/fit results during cosmetic edits, restoration after
  refresh, guest mode, closet selection, fit-map toggling, and step-by-step
  upcycling guides with cutting diagrams.
- Unsupported inseam/height settings produced a visible limitation and recovered
  when a valid size was selected. An actual GLTFLoader call on an unrigged local
  fixture was rejected with the skeleton requirement; morph behavior was tested
  using a synthetic skinned mesh, not a professional character asset.
- Desktop and a 390 px mobile viewport were checked, including horizontal
  overflow and toolbar clearance. No JavaScript or shader errors were reported.
- Test scripts use Node's native TypeScript type stripping (Node 22.18+;
  validated with Node 24). Live Supabase account authentication was not tested;
  the existing snapshot contract and separate local account caches were tested.

Animated rig proportions may additionally need an asset-specific bone adjustment
adapter; position morph names alone do not guarantee correct bone lengths or
animation deformation. Professional asset calibration remains a prerequisite.

import { defaultCharacter, normalizeCharacter, SKIN_TONES, HAIR_COLORS } from './character/settings.ts';
import { CharacterGeometryService } from './character/service.js';
import { meshCache } from './character/meshCache.js';
import { applyPresentation, presentationPoint } from './character/presentation.js';
import { createTorsoSampler, conformToCharacter } from './character/sections.js';
import { addStage } from './stage.js';
import { createRig } from './character/rig.js';
import { morphBody } from './character/morph.js';
import { vertexNormals } from './character/finish.js';
import { CANONICAL_MEASUREMENTS, canonicalCharacter } from './character/canonical.js';
import { assertPreviewRange } from './character/measurements.js';
import { detectQuality } from './quality.js';
import { bodyMaterial, bodyOutlineMaterial, updateBodyArt, updateBodyAppearance, fabricGloss, comicMaterial, outlineMaterial, paintComicGrain, addCoverageMask, comicDot } from './materials.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bodyModel, buildGarment, fitWord, outfitEnvelope } from './model.js';
import { paintPattern, shade } from './patterns.js';
import { flawSpots, topLandmarks } from './flats.js';
import { GARMENT_TYPES, garmentLayer, layerOrder } from './garments.js';

const CM = 0.01;
const TEX_W = 220; // cm across the texture
const TEX_H = 200;
const MARGIN = 12;
const PPC = 6; // px per cm

export function createScene(container, { characterAsset = null, quality = detectQuality(), stageTheme = 'celestial', prewarmShapes = true, framing = 'studio' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = quality.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.domElement.dataset.quality = quality.name;
  // Shader-error queries wait for each compile to finish; keep them for development.
  renderer.debug.checkShaderErrors = !import.meta.env.PROD;
  comicDot.value = 4.5 * renderer.getPixelRatio();
  container.appendChild(renderer.domElement);

  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.background = null;
  // The stage and the figure turn together on the turntable.
  const stageGroup = new THREE.Group();
  scene.add(stageGroup);
  let sky = addStage(stageTheme, scene, stageGroup);
  // Ambient sky motion; still on the lowest tier and when reduced motion is asked for.
  const ambientMotion = quality.name !== 'low' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Every material is Lambert-based (no environment map or PBR shaders), which
  // keeps shader compilation and per-pixel cost low on every device.

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.8;
  controls.maxDistance = 7;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  // Cards embedded in scrolling pages only turn the figure; the wheel scrolls the page.
  if (framing === 'card') controls.enableZoom = controls.enablePan = false;

  scene.add(new THREE.HemisphereLight('#fff6ea', '#6b8197', .65));
  const key = new THREE.DirectionalLight('#fff5e6', 1.9);
  key.position.set(1.6, 3.2, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  key.shadow.camera.left = -1.5;
  key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 2.5;
  key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.004;
  key.shadow.radius = 3;
  key.shadow.camera.near = .1;
  key.shadow.camera.far = 8;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#cd89fa', 1.25);
  rim.position.set(-2.5, 2, -2.5);
  scene.add(rim);
  // Front fill keeps the comic shadow band where it was tuned.
  const fill = new THREE.DirectionalLight('#c5dcff', .6);
  fill.position.set(-3, 2, 2);
  scene.add(fill);
  const revealLight = new THREE.PointLight('#adf8ff', 0, 5.5, 1.8);
  revealLight.position.set(0, 1.15, 1.15);
  scene.add(revealLight);
  let revealStarted = -Infinity;

  const figure = new THREE.Group();
  figure.scale.setScalar(CM);
  stageGroup.add(figure);

  const bodyGroup = new THREE.Group();
  const garmentGroup = new THREE.Group();
  figure.add(bodyGroup, garmentGroup);

  const skinMat = bodyMaterial();
  const outlineMat = bodyOutlineMaterial();
  // Skin under trousers is hidden from the body shader; the garments write
  // garmentCoverage and the uniform only uses it while clothing is shown.
  const garmentCoverage = new THREE.Vector3(0,-1,0), noCoverage = new THREE.Vector3(0,-1,0);
  const coverage = { value: garmentCoverage };
  addCoverageMask(skinMat,coverage);
  addCoverageMask(outlineMat,coverage);
  // Garment materials live as long as the viewer: rebuilding a garment only swaps
  // its texture and colours, so their shader programs compile exactly once.
  const blank = new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  blank.needsUpdate = true;
  const garmentMats = {
    fabric: comicMaterial({ map: blank }),
    trim: comicMaterial(),
    hardware: comicMaterial({ gloss: .9, side: THREE.FrontSide }),
    ink: outlineMaterial(.0021),
    fit: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }),
  };
  // One fabric/trim/hardware set per worn garment. Extra sets share the compiled
  // programs (same cache key), so wearing more layers never recompiles shaders.
  const wardrobeMats = [garmentMats];
  const matsFor = (i) => (wardrobeMats[i] ||= {
    fabric: comicMaterial({ map: blank }),
    trim: comicMaterial(),
    hardware: comicMaterial({ gloss: .9, side: THREE.FrontSide }),
  });
  let garmentTextures = new Map(); // garment JSON → texture

  // Compile every program the figure needs in parallel (KHR_parallel_shader_compile)
  // while the worker builds the body, instead of one blocking compile after
  // another on the first draw. Frames wait for it, up to a safety timeout.
  let compiling = true;
  {
    const geometry = new THREE.BufferGeometry(), blankAttribute = (size, Type = Float32Array) => new THREE.BufferAttribute(new Type(3 * size), size);
    for (const [name, size] of [['position',3],['normal',3],['basePosition',3],['uv',2],['ao',1],['skinWeight',4],['color',3]]) geometry.setAttribute(name, blankAttribute(size));
    geometry.setAttribute('skinIndex', blankAttribute(4, Uint16Array));
    geometry.setIndex([0,1,2]);
    const skeleton = new THREE.Skeleton([new THREE.Bone()]);
    const probes = [skinMat, outlineMat, garmentMats.fabric, garmentMats.trim, garmentMats.hardware, garmentMats.ink].map(material => {
      const mesh = new THREE.SkinnedMesh(geometry, material);
      mesh.bind(skeleton); mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
      return mesh;
    });
    figure.add(...probes);
    const done = () => {
      if (!compiling) return;
      compiling = false;
      figure.remove(...probes); geometry.dispose(); skeleton.dispose(); invalidate();
    };
    renderer.compileAsync(scene, camera).then(done, done);
    setTimeout(done, 4000);
  }

  const characterService = new CharacterGeometryService({ resolution: quality.bodyResolution, store: meshCache });
  // Frames are drawn on demand: while animating or turning, or after a change.
  let dirty = true;
  const invalidate = () => { dirty = true; };
  let character = defaultCharacter();
  let sampler = null;
  let bodyRevision = 0;
  let disposed = false;
  let importedAsset = null;
  let importedLoad = null;
  let assetTools = null;
  const bodyStatus = document.createElement('div');
  bodyStatus.className = 'character-view-status';
  bodyStatus.setAttribute('role','status');
  container.parentElement.appendChild(bodyStatus);
  let model = null;
  let rig = null;
  const retiredSkeletons = [];
  const releaseSkeletons = () => retiredSkeletons.splice(0).forEach(s=>s.dispose());
  let animatable = false;
  let opts = { showBody: true, showClothing: true, fitMap: false, spin: false, animate: true };
  let lastBodyKey = '';
  let current = { garment: null, garments: [], checks: [] };
  let lastGarmentKey = null;

  function disposeGroup(grp) {
    const geometries=new Set();
    grp.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    geometries.forEach(g=>g.dispose());grp.clear();
  }

  // One canonical mesh per body shape and hairstyle is built once in the
  // worker; every measurement change morphs it on the main thread in a few
  // milliseconds. `hair` null is "auto by body type". Least recently used
  // meshes beyond a few are dropped (never the one on screen).
  // Progressive: a coarse draft mesh (quality.draftResolution, a fraction of a
  // second to build) is shown first and swapped for the full mesh when the
  // background build finishes. Both are cached across visits (meshCache).
  const progressive = quality.draftResolution < quality.bodyResolution;
  const canonicals = new Map();
  const canonicalKey = (preset, hair) => { const shape = canonicalCharacter(preset, hair); return `${shape.bodyPreset}|${shape.hair}`; };
  function canonicalFor(preset, hair = null, { warm = false } = {}) {
    const key = canonicalKey(preset, hair);
    let entry = canonicals.get(key);
    if (entry) { canonicals.delete(key); canonicals.set(key, entry); }
    else {
      const shape = canonicalCharacter(preset, hair), measured = bodyModel({ ...CANONICAL_MEASUREMENTS });
      entry = { shape, from: { model: measured, sampler: createTorsoSampler(measured, shape) }, value: null, draft: null, promise: null, draftPromise: null };
      canonicals.set(key, entry);
      for (const [k, e] of canonicals) {
        if (canonicals.size <= 6) break;
        if (e !== entry && e.value?.base !== body?.base && e.draft?.base !== body?.base) canonicals.delete(k);
      }
    }
    const current = entry;
    // Draft: in the foreground when the body is needed now (this also promotes a
    // queued warm-up draft), in the background when only warming up.
    if (progressive && !entry.draft && !entry.value && (!entry.draftPromise || !warm)) {
      entry.draftPromise = characterService.request(CANONICAL_MEASUREMENTS, entry.shape, { resolution: quality.draftResolution, background: warm })
        .then(base => (current.draft = { base, from: current.from }));
      entry.draftPromise.catch(() => { current.draftPromise = null; });
    }
    if (!entry.promise && (!warm || !progressive)) {
      entry.promise = characterService.request(CANONICAL_MEASUREMENTS, entry.shape, { background: progressive || warm })
        .then(base => (current.value = { base, from: current.from }));
      entry.promise.catch(() => { current.promise = null; });
    }
    return entry;
  }
  // Warm up the other shapes (with the current hairstyle) once the body is
  // showing, as drafts only: switching body type is then an instant morph,
  // refined to the full mesh in the background. Warm-up work queues behind
  // anything the person asks for and never delays it.
  let warming = false;
  const currentHair = () => character.appearance?.hair ?? null;
  async function prewarm() {
    if (warming) return;
    warming = true;
    let hair;
    do {
      hair = currentHair();
      for (const preset of ['feminine', 'neutral', 'masculine']) {
        if (disposed || hair !== currentHair()) break;
        const entry = canonicals.get(canonicalKey(preset, hair));
        if (entry?.draft || entry?.value) continue;
        const warm = canonicalFor(preset, hair, { warm: true });
        try { await (progressive ? warm.draftPromise : warm.promise); } catch { /* retried on demand */ }
      }
    } while (!disposed && hair !== currentHair());
    warming = false;
  }
  // Skin and hair colours are uniforms: instant, no rebuild.
  function applyAppearance(appearance) {
    const skin = SKIN_TONES.find(tone => tone.id === appearance.skin) ?? SKIN_TONES[2];
    const hair = HAIR_COLORS.find(color => color.id === appearance.hairColor) ?? HAIR_COLORS[1];
    updateBodyAppearance(skinMat, { skin: skin.color, hair: hair.color });
    renderer.domElement.dataset.skinTone = skin.id;
    renderer.domElement.dataset.hairColor = hair.id;
  }

  let body = null; // { base, geometry, mesh, outline }
  function clearBody() {
    for (const child of [...bodyGroup.children]) bodyGroup.remove(child);
    body?.geometry.dispose();
    body = null;
  }
  // Index, UVs, skin weights and occlusion are shared with the canonical mesh and
  // uploaded once; only positions and normals are rewritten per change.
  function showBody({ base, from }, measuredModel, settings) {
    if (body?.base !== base) {
      clearBody();
      const n = base.attributes.position.count, geometry = new THREE.BufferGeometry();
      geometry.setIndex(base.index);
      for (const name of ['uv','skinIndex','skinWeight','ao','hairMask']) if (base.attributes[name]) geometry.setAttribute(name, base.attributes[name]);
      for (const name of ['position','normal','basePosition']) geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n*3),3));
      const mesh = new THREE.SkinnedMesh(geometry,skinMat), outline = new THREE.SkinnedMesh(geometry,outlineMat);
      mesh.castShadow = mesh.receiveShadow = true;
      outline.renderOrder = -1;mesh.add(outline);bodyGroup.add(mesh);
      body = { base, geometry, mesh, outline };
      renderer.domElement.dataset.bodyVertices = n;
    }
    const { geometry } = body, { position, normal, basePosition } = geometry.attributes;
    morphBody(base.attributes.position.array, base.regions, from, { model: measuredModel, sampler }, basePosition.array);
    position.array.set(basePosition.array);
    applyPresentation(geometry, measuredModel, settings.proportions, { normals: false });
    vertexNormals(position.array, geometry.index.array, normal.array);
    position.needsUpdate = normal.needsUpdate = basePosition.needsUpdate = true;
    // Bounds only feed draw sorting (culling is off for the posed figure).
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    rig.skinBody(geometry, base.skinWeights);
    updateBodyArt(skinMat, measuredModel, settings);
    figure.updateMatrixWorld(true);
    rig.bind(body.mesh); rig.bind(body.outline);
    releaseSkeletons();
  }

  function setBody(b, customization = defaultCharacter()) {
    if(disposed)return model;
    const settings = normalizeCharacter(customization);
    applyAppearance(settings.appearance);
    // Colours are not part of the body key: they never rebuild body or garments.
    const { appearance, ...shapeSettings } = settings;
    const hairStyle = canonicalCharacter(settings.bodyPreset, appearance.hair).hair;
    const keyStr = JSON.stringify([b,shapeSettings,hairStyle]);
    if (keyStr === lastBodyKey) { character = structuredClone(settings); invalidate(); return model; }
    lastBodyKey = keyStr;
    character = structuredClone(settings);
    model = bodyModel({...b});
    sampler = createTorsoSampler(model,character);
    if (rig) { figure.remove(rig.root); retiredSkeletons.push(rig.skeleton); }
    rig = createRig(model,settings.proportions,sampler);
    rig.attach(figure);
    const revision = ++bodyRevision, measuredModel = model;
    const ready = source => {
      renderer.domElement.dataset.characterState = 'ready';
      renderer.domElement.dataset.bodyPreset = settings.bodyPreset;
      renderer.domElement.dataset.hairStyle = hairStyle;
      renderer.domElement.dataset.characterMeasurements = JSON.stringify(measuredModel.b);
      renderer.domElement.dataset.characterProportions = JSON.stringify(settings.proportions);
      renderer.domElement.dataset.characterSource = source;
      animatable = source === 'procedural-fallback';
      if (!animatable) rig.rest();
    };
    const fail = message => {
      bodyStatus.textContent = message;
      bodyStatus.hidden = false;
      renderer.domElement.dataset.characterState = 'error';
      clearBody();invalidate();
    };
    const showProcedural = (reason = '') => {
      try { assertPreviewRange(measuredModel); } catch (error) { fail(error.message); return; }
      const finish = canon => {
        if (revision !== bodyRevision || disposed) return;
        showBody(canon, measuredModel, settings);
        transferSoon();
        bodyStatus.textContent = reason ? `${reason} Using procedural preview.` : '';
        bodyStatus.hidden = !reason;
        ready('procedural-fallback');
        invalidate();
        if (prewarmShapes) setTimeout(prewarm, 400);
      };
      const canon = canonicalFor(settings.bodyPreset, appearance.hair);
      if (canon.value) return finish(canon.value);
      if (canon.draft) finish(canon.draft);
      else {
        bodyStatus.textContent = 'Building body…';
        bodyStatus.hidden = false;
        renderer.domElement.dataset.characterState = 'loading';
        canon.draftPromise?.then(() => { if (!canon.value) finish(canon.draft); }).catch(() => {});
      }
      canon.promise.then(() => finish(canon.value)).catch(error => { if (revision === bodyRevision && !body) fail(error.message); });
    };
    if (characterAsset) {
      (async () => {
        assetTools ||= await import('./character/assets.ts');
        importedLoad ||= assetTools.loadCharacterAsset(characterAsset,measuredModel.b).catch(error=>{importedLoad=null;throw error;});
        const loaded = await importedLoad;
        if(disposed){assetTools.disposeCharacterAsset(loaded.root);return;}
        importedAsset = loaded;
        if (revision !== bodyRevision) return;
        const report = assetTools.applyCharacterMorphs(importedAsset.root,characterAsset,{
          ...measuredModel.b,...settings.proportions,feminine:settings.bodyPreset==='feminine'?1:0,
        });
        const unsupported=[...report.unsupported,...report.outOfRange];
        if(unsupported.length)throw new Error(`Asset cannot represent ${unsupported.join(', ')}.`);
        clearBody();importedAsset.root.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
        bodyGroup.add(importedAsset.root);
        bodyStatus.textContent='Imported character; garment drape is a procedural approximation.';
        bodyStatus.hidden=false;ready('glb');invalidate();
      })().catch(error=>{if(revision===bodyRevision)showProcedural(error.message);});
    } else showProcedural();
    return model;
  }

  function garmentTexture(g) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W * PPC;
    canvas.height = TEX_H * PPC;
    const ctx = canvas.getContext('2d');
    paintPattern(ctx, canvas.width, canvas.height, g, PPC);
    paintComicGrain(ctx, canvas.width, canvas.height, g.material);
    const toPx = (x, y) => [(0.5 + x / TEX_W) * canvas.width, (y + MARGIN) * PPC];
    const kind = GARMENT_TYPES[g.type].kind;
    // construction details
    ctx.strokeStyle = 'rgba(21,18,26,.75)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    if (kind === 'top' || kind === 'dress') {
      const T = topLandmarks(g);
      if (kind === 'top') {
        const [x0, y0] = toPx(-TEX_W / 2, g.length - 2.2);
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(canvas.width, y0);
        ctx.stroke();
        void x0;
      }
      if (g.type === 'buttonup') {
        ctx.setLineDash([]);
        const [px] = toPx(0, 0);
        ctx.fillStyle = shade(g.color, -0.15);
        ctx.fillRect(px - 1.6 * PPC, 0, 3.2 * PPC, canvas.height);
        for (let y = 6; y < g.length - 3; y += 9) {
          const [bx, by] = toPx(0, y);
          ctx.fillStyle = '#f2efe8';
          ctx.beginPath();
          ctx.arc(bx, by, 0.7 * PPC, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (g.type === 'polo') {
        ctx.setLineDash([]);
        const [px] = toPx(0, 0);
        ctx.fillStyle = shade(g.color, -0.15);
        ctx.fillRect(px - 1.4 * PPC, 0, 2.8 * PPC, (MARGIN + 15) * PPC);
      }
      if (g.type === 'jacket' || g.type === 'coat' || g.type === 'sweater' || g.type === 'cardigan') {
        // Ribbed or banded hem.
        ctx.setLineDash([]);
        ctx.fillStyle = shade(g.color, -0.1);
        const [, hy] = toPx(0, g.length - (g.type === 'coat' ? 3 : 5));
        ctx.fillRect(0, hy, canvas.width, (g.type === 'coat' ? 3 : 5) * PPC);
      }
      if (g.type === 'hoodie') {
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(21,18,26,.85)';
        ctx.lineWidth = 3;
        const [px, py] = toPx(-12, g.length - 26);
        ctx.strokeRect(px, py, 24 * PPC, 16 * PPC);
      }
      void T;
    }
    if (kind === 'bottom') {
      ctx.setLineDash([6, 5]);
      const [, wy] = toPx(0, 4);
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.lineTo(canvas.width, wy);
      ctx.stroke();
      ctx.setLineDash([]);
      if (g.type === 'joggers' || g.type === 'leggings') {
        // Elastic waistband (and a drawstring on joggers) instead of a button fly.
        ctx.fillStyle = shade(g.color, -0.12);
        ctx.fillRect(0, toPx(0, 0)[1], canvas.width, 4 * PPC);
        if (g.type === 'joggers') {
          ctx.strokeStyle = '#f2ede0';
          ctx.lineWidth = 2.2;
          for (const side of [-1, 1]) {
            const [x0, y0] = toPx(side * 1.5, 3), [x1, y1] = toPx(side * 3, 12);
            ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          }
        }
      } else {
        ctx.fillStyle = '#c9a24a';
        const [bx, by] = toPx(0, 2);
        ctx.beginPath();
        ctx.arc(bx, by, 0.9 * PPC, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.setLineDash([]);
    const stitch = (points, color = 'rgba(231,221,201,.55)', dashed = true) => {
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=dashed?1.6:3;ctx.setLineDash(dashed?[4,4]:[]);
      points.forEach(([x,y],i)=>{const p=toPx(x,y);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.stroke();
    };
    if(kind==='top'||kind==='dress') {
      if(kind==='top')for(const d of [1.1,1.55])stitch([[-TEX_W/2,g.length-d],[TEX_W/2,g.length-d]],'rgba(21,18,26,.55)');
      for(const side of [-1,1])stitch([[side*g.chest*.25,18],[side*g.waist*.25,g.length-2]],'rgba(21,18,26,.8)',false);
    }
    if(kind==='bottom' && g.type!=='leggings' && g.type!=='joggers') {
      const thread=g.material==='denim'?'#f0c25a':'rgba(21,18,26,.6)';
      for(const y of [1,1.65,4,4.6])stitch([[-TEX_W/2,y],[TEX_W/2,y]],thread);
      for(const side of [-1,1]) {
        stitch([[side*7,5],[side*10,9],[side*14,12],[side*19,13]],thread);
        stitch([[side*7.6,5],[side*10.6,9],[side*14.6,12],[side*19.6,13]],thread);
        for(const offset of [0,.55])stitch([[side*(g.hips*.25+offset),5],[side*(g.hips*.25+offset),g.rise+g.inseam-1]],thread);
      }
      stitch([[1.4,5],[1.4,g.rise*.70],[0,g.rise*.80]],thread);
    }
    ctx.setLineDash([]);
    // flaws
    const spots = flawSpots(g);
    if (g.stains) {
      const [x, y] = toPx(...spots.stain);
      ctx.fillStyle = 'rgba(120,90,40,.5)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3.2 * PPC, 2.4 * PPC, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (g.holes) {
      const [x, y] = toPx(...spots.hole);
      ctx.fillStyle = '#1b1b1b';
      ctx.beginPath();
      ctx.ellipse(x, y, 1.4 * PPC, 1 * PPC, 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    // user sketch layer (async)
    if (g.sketch && g.sketchBox) {
      const img = new Image();
      img.onload = () => {
        const b = g.sketchBox;
        const [x, y] = toPx(b.x, b.y);
        ctx.drawImage(img, x, y, b.w * PPC, b.h * PPC);
        // sketch also on the back panel so designs read from behind
        tex.needsUpdate = true;
        invalidate();
      };
      img.src = g.sketch;
    }
    return tex;
  }

  // Every garment surface inherits the weights of the skin beneath it. The exact
  // transfer (and clearance push) runs once input settles; while a slider is
  // being dragged, garments follow the instant analytic weights.
  // The exact transfer is time-sliced, one garment piece per task, so it never
  // blocks input; a newer change cancels it.
  let transferTimer = 0, transferRun = 0;
  function transferSoon() {
    clearTimeout(transferTimer);
    const run = ++transferRun;
    transferTimer = setTimeout(() => {
      const pieces = garmentGroup.children.filter(m => m.isSkinnedMesh);
      const next = () => {
        if (disposed || run !== transferRun || !rig) return;
        const m = pieces.shift();
        if (!m) return;
        skinPiece(m, true);
        invalidate();
        setTimeout(next, 0);
      };
      next();
    }, 160);
  }
  function skinPiece(m, transfer) {
    const {trim,button}=m.geometry.userData;
    rig.skinGarment(m.geometry,{lift:m.userData.lift,arms:m.userData.region==='sleeve',clearance:(trim?.3:button?.8:.45)+(m.userData.layer||0),transfer});
    figure.updateMatrixWorld(true);
    rig.bind(m);
    for (const edge of m.children) if (edge.isSkinnedMesh) rig.bind(edge);
  }
  function skinGarments(transfer) {
    if (!rig) return;
    for (const m of garmentGroup.children) if (m.isSkinnedMesh) skinPiece(m, transfer);
  }

  // Painting a 1320 x 1200 garment canvas is skipped when only the body or the
  // rest of the outfit changed.
  function garmentTexturesFor(list) {
    const next = new Map();
    for (const g of list) {
      const key = JSON.stringify(g);
      next.set(key, garmentTextures.get(key) || next.get(key) || garmentTexture(g));
    }
    for (const [key, texture] of garmentTextures) if (!next.has(key)) texture.dispose();
    garmentTextures = next;
    return list.map((g) => next.get(JSON.stringify(g)));
  }

  // Dress the body in an outfit. Garments are built inside-out, each one clear of
  // the layers beneath it. `focus` picks whose fit checks the caption reports.
  function setGarments(list, { focus = null } = {}) {
    const outfit = layerOrder((list || []).filter((g) => g && GARMENT_TYPES[g.type]));
    const key = JSON.stringify([outfit,focus,lastBodyKey]);
    if(key===lastGarmentKey)return current;
    lastGarmentKey=key;
    const target = outfit.find((g) => g.id === focus) || outfit.at(-1) || null;
    current.garment = target;
    current.garments = outfit;
    garmentCoverage.set(0,-1,0);
    disposeGroup(garmentGroup);
    current.checks = [];
    if (!outfit.length || !model) return current;
    const textures = garmentTexturesFor(outfit);
    const envelopes = [];
    outfit.forEach((g, index) => {
      const kind = GARMENT_TYPES[g.type].kind;
      const built = buildGarment(g, model, {
        under: envelopes.length ? outfitEnvelope(envelopes) : null,
        // Outerwear hangs open when there is something underneath to show.
        open: !!GARMENT_TYPES[g.type].open && outfit.slice(0, index).some((o) => ['top', 'dress'].includes(GARMENT_TYPES[o.type].kind)),
      });
      envelopes.push(built.envelope);
      if (g === target) current.checks = built.checks;
      if(kind==='bottom') {
        const hem=Math.max(model.lm.crotchY-g.inseam,1.5);
        const lower = Math.max(model.lm.crotchY-8,hem+.7), upper = built.topY-.6;
        garmentCoverage.set(presentationPoint(0,lower,0,model,character.proportions)[1],presentationPoint(0,upper,0,model,character.proportions)[1],(model.profileAt(model.lm.hipY).rx+1)*(1+Math.max(0,character.proportions.fullness)*.12));
      }
      const lift = ['top','dress'].includes(kind);
      // Each layer stands a little further off the skin than the one beneath.
      const layer = index * .55 + Math.max(0, garmentLayer(g) - 1) * .25;
      const { fabric, trim, hardware } = matsFor(index);
      const { ink, fit: fitMat } = garmentMats;
      fabric.map = textures[index];
      fabric.userData.uniforms.comicGloss.value = fabricGloss(g);
      trim.color.set(shade(g.color,-.12));
      hardware.color.set(['jeans','jacket'].includes(g.type)&&g.material==='denim'?'#e3a93c':'#f2ede0');
      for (const p of built.parts) {
        const geos = Array.isArray(p.geo) ? p.geo : [p.geo];
        for (const geo of geos) {
          geo.userData.layer = layer;
          conformToCharacter(geo,p.region,model,sampler);
          applyPresentation(geo,model,character.proportions);
          const surface = geo.userData.button ? hardware : geo.userData.trim ? trim : fabric;
          const m = new THREE.SkinnedMesh(geo, opts.fitMap && geo.getAttribute('color') ? fitMat : surface);
          m.userData.lift = lift && p.region !== 'sleeve';
          m.userData.region = p.region;
          m.userData.layer = layer;
          m.userData.fabric = surface;
          m.userData.fit = geo.getAttribute('color') ? fitMat : surface;
          m.castShadow = true;
          m.receiveShadow = true;
          const edge = new THREE.SkinnedMesh(geo, ink);
          edge.userData.outline = true;
          m.add(edge);
          garmentGroup.add(m);
        }
      }
    });
    skinGarments(false);
    transferSoon();
    invalidate();
    return current;
  }
  const setGarment = (g) => setGarments(g ? [g] : [], { focus: g?.id });

  function setOptions(o) {
    opts = { ...opts, ...o };
    invalidate();
    bodyGroup.visible = opts.showBody;
    garmentGroup.visible = opts.showClothing;
    coverage.value = opts.showClothing ? garmentCoverage : noCoverage;
    garmentGroup.traverse((m) => {
      if (m.isMesh && !m.userData.outline) m.material = opts.fitMap ? m.userData.fit : m.userData.fabric;
    });
  }

  function resetCamera() {
    const h = (model?.lm.H || 172) * CM;
    // Whole figure in view with room for the toolbar above the head; the card
    // framing (other pages) sits a little closer.
    const far = framing === 'card' ? 2.15 : 2.45;
    camera.position.set(0.7, h * 0.66, h * far);
    controls.target.set(0, h * 0.52, 0);
    stageGroup.rotation.y = 0;
    controls.update();
    invalidate();
  }

  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / Math.max(h, 1);
    // Keep the figure centred in the space beside the side panel.
    const sidebarOffset = framing === 'studio' && w > 860 ? Math.min(230, w * 0.18) : 0;
    camera.setViewOffset(w, h, -sidebarOffset, 0, w, h);
    camera.updateProjectionMatrix();
    invalidate();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  controls.addEventListener('change', invalidate);
  const clock = new THREE.Clock();
  let animationTime = 0, sinceFrame = 0, posed = false;
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (document.hidden) return;
    const animating = opts.animate && animatable && !!rig;
    const ambientSky = ambientMotion && sky.animated;
    const revealAge = performance.now() - revealStarted, revealing = revealAge < 700;
    revealLight.intensity = revealAge < 150 ? 7.5 * Math.sin((revealAge / 150) * Math.PI) : revealAge < 650 ? 1.8 * (1 - (revealAge - 150) / 500) : 0;
    if (opts.spin) stageGroup.rotation.y += dt * 0.6;
    if (animating) animationTime += dt;
    controls.update();
    sinceFrame += dt;
    // Mobile animates the sky at 30 fps; the lowest tier keeps it still.
    const fps = animating || revealing || opts.spin ? quality.fps : Math.min(quality.fps, quality.name === 'high' ? 60 : 30);
    if (compiling || !(dirty || ambientSky || opts.spin || animating || posed || revealing) || sinceFrame < .97 / fps) return;
    if (ambientSky) sky.update(sinceFrame, clock.elapsedTime);
    sinceFrame = 0;
    if (rig) {
      if (animating) rig.pose(animationTime);
      else rig.rest();
      posed = animating;
      renderer.domElement.dataset.pose = animating ? rig.clip : 'rest';
    }
    renderer.render(scene, camera);
    dirty = false;
  });

  return {
    setBody,
    setGarment,
    setGarments,
    setOptions,
    resetCamera,
    flashReveal() {
      revealStarted = performance.now();
    },
    setStage(theme) {
      sky.dispose();
      sky = addStage(theme, scene, stageGroup);
      invalidate();
    },
    get checks() {
      return current.checks;
    },
    fitWord,
    dispose() {
      if(disposed)return;
      disposed=true;bodyRevision++;
      characterService.dispose();resizeObserver.disconnect();controls.dispose();
      renderer.setAnimationLoop(null);
      if(importedAsset){bodyGroup.remove(importedAsset.root);assetTools.disposeCharacterAsset(importedAsset.root);}
      clearTimeout(transferTimer);
      clearBody();disposeGroup(garmentGroup);sky.dispose();
      for (const set of wardrobeMats) for (const material of Object.values(set)) material.dispose();
      for (const material of [garmentMats.ink, garmentMats.fit, skinMat, outlineMat]) material.dispose();
      garmentTextures.forEach((texture) => texture.dispose());blank.dispose();
      releaseSkeletons();rig?.skeleton.dispose();
      renderer.dispose();bodyStatus.remove();renderer.domElement.remove();
    },
  };
}

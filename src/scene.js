import { defaultCharacter, normalizeCharacter } from './character/settings.ts';
import { CharacterGeometryService } from './character/service.js';
import { applyPresentation, presentationPoint } from './character/presentation.js';
import { createTorsoSampler, conformToCharacter } from './character/sections.js';
import { addStudioStage } from './stage.js';
import { createRig } from './character/rig.js';
import { morphBody } from './character/morph.js';
import { vertexNormals } from './character/finish.js';
import { CANONICAL_MEASUREMENTS, canonicalCharacter } from './character/canonical.js';
import { assertPreviewRange } from './character/measurements.js';
import { detectQuality } from './quality.js';
import { bodyMaterial, bodyOutlineMaterial, updateBodyArt, fabricGloss, comicMaterial, outlineMaterial, paintComicGrain, addCoverageMask, comicDot } from './materials.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bodyModel, buildGarment, fitWord } from './model.js';
import { paintPattern, shade } from './patterns.js';
import { flawSpots, topLandmarks } from './flats.js';
import { GARMENT_TYPES } from './state.js';

const CM = 0.01;
const TEX_W = 220; // cm across the texture
const TEX_H = 200;
const MARGIN = 12;
const PPC = 6; // px per cm

export function createScene(container, { characterAsset = null, quality = detectQuality() } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: false, powerPreference: 'high-performance' });
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

  const scene = new THREE.Scene();
  addStudioStage(scene,renderer);
  // Every material is Lambert-based (no environment map or PBR shaders), which
  // keeps shader compilation and per-pixel cost low on every device.

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.8;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.55;

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
  const rim = new THREE.DirectionalLight('#ffe7c4', 0.9);
  rim.position.set(-2.5, 2, -2.5);
  scene.add(rim);

  const figure = new THREE.Group();
  figure.scale.setScalar(CM);
  scene.add(figure);

  const bodyGroup = new THREE.Group();
  const garmentGroup = new THREE.Group();
  figure.add(bodyGroup, garmentGroup);

  const skinMat = bodyMaterial();
  const outlineMat = bodyOutlineMaterial();
  const coverage = { value: new THREE.Vector3(0,-1,0) };
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
  let garmentTex = { key: null, texture: null };

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

  const characterService = new CharacterGeometryService({ resolution: quality.bodyResolution });
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
  let current = { garment: null, checks: [] };
  let lastGarmentKey = null;

  function disposeGroup(grp) {
    const geometries=new Set();
    grp.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
    geometries.forEach(g=>g.dispose());grp.clear();
  }

  // One canonical mesh per body shape is built once in the worker; every
  // measurement change morphs it on the main thread in a few milliseconds.
  const canonicals = new Map();
  function canonicalFor(preset) {
    let entry = canonicals.get(preset);
    if (!entry) {
      const shape = canonicalCharacter(preset), measured = bodyModel({ ...CANONICAL_MEASUREMENTS });
      entry = { value: null };
      entry.promise = characterService.request(CANONICAL_MEASUREMENTS, shape).then(base => {
        entry.value = { base, from: { model: measured, sampler: createTorsoSampler(measured, shape) } };
        return entry.value;
      });
      entry.promise.catch(() => canonicals.delete(preset));
      canonicals.set(preset, entry);
    }
    return entry;
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
      for (const name of ['uv','skinIndex','skinWeight','ao']) geometry.setAttribute(name, base.attributes[name]);
      for (const name of ['position','normal','basePosition']) geometry.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n*3),3));
      const mesh = new THREE.SkinnedMesh(geometry,skinMat), outline = new THREE.SkinnedMesh(geometry,outlineMat);
      mesh.castShadow = mesh.receiveShadow = true;
      outline.renderOrder = -1;mesh.add(outline);bodyGroup.add(mesh);
      body = { base, geometry, mesh, outline };
    }
    const { geometry } = body, { position, normal, basePosition } = geometry.attributes;
    morphBody(base.attributes.position.array, base.regions, from, { model: measuredModel, sampler }, basePosition.array);
    vertexNormals(basePosition.array, geometry.index.array, normal.array);
    position.array.set(basePosition.array);
    applyPresentation(geometry, measuredModel, settings.proportions);
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
    const keyStr = JSON.stringify([b,settings]);
    if (keyStr === lastBodyKey) return model;
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
      };
      const canon = canonicalFor(settings.bodyPreset);
      if (canon.value) return finish(canon.value);
      bodyStatus.textContent = 'Building body…';
      bodyStatus.hidden = false;
      renderer.domElement.dataset.characterState = 'loading';
      canon.promise.then(finish).catch(error => { if (revision === bodyRevision) fail(error.message); });
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
      ctx.fillStyle = '#c9a24a';
      const [bx, by] = toPx(0, 2);
      ctx.beginPath();
      ctx.arc(bx, by, 0.9 * PPC, 0, Math.PI * 2);
      ctx.fill();
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
    if(kind==='bottom') {
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
    rig.skinGarment(m.geometry,{lift:m.userData.lift,arms:m.userData.region==='sleeve',clearance:trim?.3:button?.8:.45,transfer});
    figure.updateMatrixWorld(true);
    rig.bind(m);
    for (const edge of m.children) if (edge.isSkinnedMesh) rig.bind(edge);
  }
  function skinGarments(transfer) {
    if (!rig) return;
    for (const m of garmentGroup.children) if (m.isSkinnedMesh) skinPiece(m, transfer);
  }

  // Painting the 1320 x 1200 garment canvas is skipped when only the body changed.
  function garmentTextureFor(g) {
    const key = JSON.stringify(g);
    if (garmentTex.key !== key) {
      garmentTex.texture?.dispose();
      garmentTex = { key, texture: garmentTexture(g) };
    }
    return garmentTex.texture;
  }

  function setGarment(g) {
    const key = JSON.stringify([g,lastBodyKey]);
    if(key===lastGarmentKey)return current;
    lastGarmentKey=key;
    current.garment = g;
    coverage.value.set(0,-1,0);
    disposeGroup(garmentGroup);
    current.checks = [];
    if (!g || !model) return current;
    const built = buildGarment(g, model);
    if(GARMENT_TYPES[g.type].kind==='bottom') {
      const hem=Math.max(model.lm.crotchY-g.inseam,1.5);
      const lower = Math.max(model.lm.crotchY-8,hem+.7), upper = built.topY-.6;
      coverage.value.set(presentationPoint(0,lower,0,model,character.proportions)[1],presentationPoint(0,upper,0,model,character.proportions)[1],(model.profileAt(model.lm.hipY).rx+1)*(1+Math.max(0,character.proportions.fullness)*.12));
    }
    const lift = ['top','dress'].includes(GARMENT_TYPES[g.type].kind);
    const { fabric, trim, hardware, ink, fit: fitMat } = garmentMats;
    fabric.map = garmentTextureFor(g);
    fabric.userData.uniforms.comicGloss.value = fabricGloss(g);
    trim.color.set(shade(g.color,-.12));
    hardware.color.set(g.type==='jeans'?'#e3a93c':'#f2ede0');
    for (const p of built.parts) {
      const geos = Array.isArray(p.geo) ? p.geo : [p.geo];
      for (const geo of geos) {
        conformToCharacter(geo,p.region,model,sampler);
        applyPresentation(geo,model,character.proportions);
        const surface = geo.userData.button ? hardware : geo.userData.trim ? trim : fabric;
        const m = new THREE.SkinnedMesh(geo, opts.fitMap && geo.getAttribute('color') ? fitMat : surface);
        m.userData.lift = lift && p.region !== 'sleeve';
        m.userData.region = p.region;
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
    skinGarments(false);
    transferSoon();
    current.checks = built.checks;
    invalidate();
    return current;
  }

  function setOptions(o) {
    opts = { ...opts, ...o };
    invalidate();
    bodyGroup.visible = opts.showBody;
    garmentGroup.visible = opts.showClothing;
    garmentGroup.traverse((m) => {
      if (m.isMesh && !m.userData.outline) m.material = opts.fitMap ? m.userData.fit : m.userData.fabric;
    });
  }

  function resetCamera() {
    const h = (model?.lm.H || 172) * CM;
    camera.position.set(0.85, h * 0.69, h * 1.95);
    controls.target.set(0, h * 0.50, 0);
    figure.rotation.y = 0;
    controls.update();
    invalidate();
  }

  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / Math.max(h, 1);
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
    const animating = opts.animate && animatable && !!rig;
    if (opts.spin) figure.rotation.y += dt * 0.6;
    if (animating) animationTime += dt;
    controls.update();
    sinceFrame += dt;
    if (compiling || !(dirty || opts.spin || animating || posed) || sinceFrame < .97 / quality.fps) return;
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
    setOptions,
    resetCamera,
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
      clearBody();disposeGroup(garmentGroup);
      for (const material of [...Object.values(garmentMats), skinMat, outlineMat]) material.dispose();
      garmentTex.texture?.dispose();blank.dispose();
      releaseSkeletons();rig?.skeleton.dispose();
      renderer.dispose();bodyStatus.remove();renderer.domElement.remove();
    },
  };
}

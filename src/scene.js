import { defaultCharacter, normalizeCharacter } from './character/settings.ts';
import { CharacterGeometryService } from './character/service.js';
import { applyPresentation, presentationPoint } from './character/presentation.js';
import { createTorsoSampler, conformToCharacter } from './character/sections.js';
import { addStudioStage } from './stage.js';
import { bodyMaterial, bodyOutlineMaterial, fabricMaterial, paintFabricGrain, addCoverageMask } from './materials.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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

export function createScene(container, { characterAsset = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  addStudioStage(scene,renderer);
  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, .04).texture;
  scene.environmentIntensity = .35;
  room.dispose();
  pmrem.dispose();

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
  key.shadow.mapSize.set(2048, 2048);
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

  const characterService = new CharacterGeometryService();
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
  let opts = { showBody: true, showClothing: true, fitMap: false, spin: false };
  let lastBodyKey = '';
  let current = { garment: null, checks: [] };
  let lastGarmentKey = null;

  function disposeGroup(grp) {
    const geometries=new Set(), materials=new Set(), textures=new Set();
    grp.traverse(o=>{
      if(o.geometry)geometries.add(o.geometry);
      for(const material of (Array.isArray(o.material)?o.material:o.material?[o.material]:[]))materials.add(material);
      // Fit-map mode can leave the fabric material detached from the mesh.
      if(o.userData.fabric)materials.add(o.userData.fabric);
      if(o.userData.fit)materials.add(o.userData.fit);
    });
    materials.forEach(material=>{for(const value of Object.values(material))if(value?.isTexture)textures.add(value);material.dispose();});
    textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());grp.clear();
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
    const revision = ++bodyRevision, measuredModel = model;
    bodyStatus.textContent = 'Updating procedural body…';
    bodyStatus.hidden = false;
    renderer.domElement.dataset.characterState = 'loading';
    const clearBody = () => {
      const oldGeometry = new Set();
      for (const child of [...bodyGroup.children]) {
        if (child !== importedAsset?.root) child.traverse(o => { if(o.geometry)oldGeometry.add(o.geometry); });
        bodyGroup.remove(child);
      }
      oldGeometry.forEach(g=>g.dispose());
    };
    const ready = source => {
      renderer.domElement.dataset.characterState = 'ready';
      renderer.domElement.dataset.bodyPreset = settings.bodyPreset;
      renderer.domElement.dataset.characterMeasurements = JSON.stringify(measuredModel.b);
      renderer.domElement.dataset.characterProportions = JSON.stringify(settings.proportions);
      renderer.domElement.dataset.characterSource = source;
    };
    const showProcedural = (reason = '') => {
      characterService.request(measuredModel.b,settings).then(base => {
        if (revision !== bodyRevision) return;
        const geometry = applyPresentation(base.clone(),measuredModel,settings.proportions);
        clearBody();
        const mesh = new THREE.Mesh(geometry,skinMat);
        mesh.castShadow = mesh.receiveShadow = true;
        const outline = new THREE.Mesh(geometry,outlineMat);
        outline.renderOrder = -1;mesh.add(outline);bodyGroup.add(mesh);
        bodyStatus.textContent = reason ? `${reason} Using procedural preview.` : '';
        bodyStatus.hidden = !reason;
        ready('procedural-fallback');
      }).catch(error => {
        if (revision !== bodyRevision) return;
        bodyStatus.textContent = error.message;
        renderer.domElement.dataset.characterState = 'error';
        clearBody();
      });
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
        bodyStatus.hidden=false;ready('glb');
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
    paintFabricGrain(ctx, canvas.width, canvas.height, g.material);
    const toPx = (x, y) => [(0.5 + x / TEX_W) * canvas.width, (y + MARGIN) * PPC];
    const kind = GARMENT_TYPES[g.type].kind;
    // construction details
    ctx.strokeStyle = 'rgba(0,0,0,.28)';
    ctx.lineWidth = 2;
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
        ctx.strokeStyle = 'rgba(0,0,0,.25)';
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
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=.8;ctx.setLineDash(dashed?[2.2,2.8]:[]);
      points.forEach(([x,y],i)=>{const p=toPx(x,y);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.stroke();
    };
    if(kind==='top'||kind==='dress') {
      if(kind==='top')for(const d of [1.1,1.55])stitch([[-TEX_W/2,g.length-d],[TEX_W/2,g.length-d]],'rgba(220,212,199,.4)');
      for(const side of [-1,1])stitch([[side*g.chest*.25,18],[side*g.waist*.25,g.length-2]],'rgba(0,0,0,.18)',false);
    }
    if(kind==='bottom') {
      const thread=g.material==='denim'?'#bba172':'rgba(225,217,203,.55)';
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
      };
      img.src = g.sketch;
    }
    return tex;
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
    const tex = garmentTexture(g);
    const fabric = fabricMaterial(g, tex, renderer.capabilities.getMaxAnisotropy());
    const trim = new THREE.MeshStandardMaterial({ color: shade(g.color,-.12), roughness: .92, side: THREE.DoubleSide });
    const hardware = new THREE.MeshStandardMaterial({color:g.type==='jeans'?'#bd945a':'#e5dfcf',metalness:g.type==='jeans'?.65:.08,roughness:.4});
    const fitMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    for (const p of built.parts) {
      const geos = Array.isArray(p.geo) ? p.geo : [p.geo];
      for (const geo of geos) {
        conformToCharacter(geo,p.region,model,sampler);
        applyPresentation(geo,model,character.proportions);
        const surface = geo.userData.button ? hardware : geo.userData.trim ? trim : fabric;
        const m = new THREE.Mesh(geo, opts.fitMap && geo.getAttribute('color') ? fitMat : surface);
        m.userData.fabric = surface;
        m.userData.fit = geo.getAttribute('color') ? fitMat : surface;
        m.castShadow = true;
        m.receiveShadow = true;
        garmentGroup.add(m);
      }
    }
    current.checks = built.checks;
    return current;
  }

  function setOptions(o) {
    opts = { ...opts, ...o };
    bodyGroup.visible = opts.showBody;
    garmentGroup.visible = opts.showClothing;
    garmentGroup.traverse((m) => {
      if (m.isMesh) m.material = opts.fitMap ? m.userData.fit : m.userData.fabric;
    });
  }

  function resetCamera() {
    const h = (model?.lm.H || 172) * CM;
    camera.position.set(0.85, h * 0.69, h * 1.95);
    controls.target.set(0, h * 0.50, 0);
    figure.rotation.y = 0;
    controls.update();
  }

  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    if (opts.spin) figure.rotation.y += dt * 0.6;
    controls.update();
    renderer.render(scene, camera);
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
      disposeGroup(bodyGroup);disposeGroup(garmentGroup);
      renderer.dispose();bodyStatus.remove();renderer.domElement.remove();
    },
  };
}

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bodyModel, buildBodyGeometries, buildGarment, fitWord } from './model.js';
import { paintPattern, shade } from './patterns.js';
import { flawSpots, topLandmarks } from './flats.js';
import { GARMENT_TYPES, MATERIALS } from './state.js';

const CM = 0.01;
const TEX_W = 220; // cm across the texture
const TEX_H = 200;
const MARGIN = 12;
const PPC = 6; // px per cm

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#efe9df');
  scene.fog = new THREE.Fog('#efe9df', 6, 14);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.8;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI * 0.55;

  scene.add(new THREE.HemisphereLight('#fffaf0', '#b9a98f', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(1.6, 3.2, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.5;
  key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 2.5;
  key.shadow.camera.bottom = -0.5;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffe7c4', 0.9);
  rim.position.set(-2.5, 2, -2.5);
  scene.add(rim);

  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 64), new THREE.MeshStandardMaterial({ color: '#e4dccd', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.57, 64), new THREE.MeshBasicMaterial({ color: '#cbbfa9' }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  scene.add(ring);

  const figure = new THREE.Group();
  figure.scale.setScalar(CM);
  scene.add(figure);

  const bodyGroup = new THREE.Group();
  const garmentGroup = new THREE.Group();
  figure.add(bodyGroup, garmentGroup);

  const skinMat = new THREE.MeshStandardMaterial({ color: '#d8c7b0', roughness: 0.62, metalness: 0.0 });

  let model = null;
  let opts = { showBody: true, fitMap: false, spin: false };
  let lastBodyKey = '';
  let current = { garment: null, checks: [] };

  function disposeGroup(grp) {
    grp.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose?.();
      }
    });
    grp.clear();
  }

  function setBody(b) {
    const keyStr = JSON.stringify(b);
    if (keyStr === lastBodyKey) return model;
    lastBodyKey = keyStr;
    model = bodyModel(b);
    bodyGroup.traverse((o) => o.geometry && o.geometry.dispose());
    bodyGroup.clear();
    for (const geo of buildBodyGeometries(model)) {
      const m = new THREE.Mesh(geo, skinMat);
      m.castShadow = true;
      m.receiveShadow = true;
      bodyGroup.add(m);
    }
    if (current.garment) setGarment(current.garment);
    return model;
  }

  function garmentTexture(g) {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W * PPC;
    canvas.height = TEX_H * PPC;
    const ctx = canvas.getContext('2d');
    paintPattern(ctx, canvas.width, canvas.height, g, PPC);
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
    current.garment = g;
    disposeGroup(garmentGroup);
    current.checks = [];
    if (!g || !model) return current;
    const built = buildGarment(g, model);
    const tex = garmentTexture(g);
    const mat = MATERIALS[g.material] || MATERIALS.cotton;
    const rough = g.material === 'poly' ? 0.55 : g.material === 'denim' ? 0.95 : 0.85;
    const fabric = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, side: THREE.DoubleSide });
    const fitMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    void mat;
    for (const p of built.parts) {
      const geos = Array.isArray(p.geo) ? p.geo : [p.geo];
      for (const geo of geos) {
        const m = new THREE.Mesh(geo, opts.fitMap && geo.getAttribute('color') ? fitMat : fabric);
        m.userData.fabric = fabric;
        m.userData.fit = geo.getAttribute('color') ? fitMat : fabric;
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
    garmentGroup.traverse((m) => {
      if (m.isMesh) m.material = opts.fitMap ? m.userData.fit : m.userData.fabric;
    });
  }

  function resetCamera() {
    const h = (model?.lm.H || 172) * CM;
    camera.position.set(0.9, h * 0.62, h * 1.75);
    controls.target.set(0, h * 0.55, 0);
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
  new ResizeObserver(resize).observe(container);
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
  };
}

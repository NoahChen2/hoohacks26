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
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = null;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 0.8;
  controls.maxDistance = 7;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;

  scene.add(new THREE.HemisphereLight('#fff7e8', '#7b6a88', 1.05));
  const key = new THREE.DirectionalLight('#fff4df', 1.85);
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
  const rim = new THREE.DirectionalLight('#cd89fa', 1.25);
  rim.position.set(-2.5, 2, -2.5);
  scene.add(rim);
  const revealLight = new THREE.PointLight('#adf8ff', 0, 5.5, 1.8);
  revealLight.position.set(0, 1.15, 1.15);
  scene.add(revealLight);
  let revealStarted = -Infinity;
  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  function createGalaxyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    let value = 20261017;
    const rnd = () => {
      value = (value * 48271) % 2147483647;
      return value / 2147483647;
    };
    const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, '#04050c');
    base.addColorStop(0.28, '#080b1a');
    base.addColorStop(0.52, '#111633');
    base.addColorStop(0.75, '#080b1a');
    base.addColorStop(1, '#04050c');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const palette = ['#d336d3', '#cd89fa', '#3464ea', '#adf8ff', '#6713cd', '#121bba'];
    for (let i = 0; i < 360; i += 1) {
      ctx.globalCompositeOperation = 'screen';
      const x = rnd() * canvas.width;
      const ribbon = 760 - x * 0.24 + Math.sin(x * 0.006) * 70;
      const y = ribbon + (rnd() - 0.5) * 310;
      const rx = 20 + rnd() * 88;
      const ry = 4 + rnd() * 17;
      const color = palette[Math.floor(rnd() * palette.length)];
      const alpha = 0.05 + rnd() * 0.15;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      gradient.addColorStop(0, `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
      gradient.addColorStop(0.62, `${color}18`);
      gradient.addColorStop(1, `${color}00`);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rnd() - 0.5) * 1.5);
      ctx.scale(1, ry / rx);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 2900; i += 1) {
      const x = rnd() * canvas.width;
      const ribbonY = 760 - x * 0.24 + Math.sin(x * 0.006) * 70;
      const inRibbon = rnd() < 0.58;
      const y = inRibbon ? ribbonY + (rnd() - 0.5) * 300 : rnd() * canvas.height;
      const size = 0.45 + Math.pow(rnd(), 3) * 1.65;
      ctx.fillStyle = rnd() < 0.25 ? '#cd89fa' : '#adf8ff';
      ctx.globalAlpha = 0.28 + rnd() * 0.68;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }
  const skyMaterial = new THREE.MeshBasicMaterial({ map: createGalaxyTexture(), side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const skySphere = new THREE.Mesh(new THREE.SphereGeometry(30, 64, 64), skyMaterial);
  skySphere.renderOrder = -1000;
  stageGroup.add(skySphere);

  // Celestial pedestal only — intentionally no solid floor/ground mesh.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.54, 0.575, 96),
    new THREE.MeshBasicMaterial({ color: '#adf8ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  const pedestal = new THREE.Group();
  pedestal.position.y = 0.004;
  const glowMat = (color, opacity) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  [
    [0.7, 0.72, '#adf8ff', 0.82],
    [0.86, 0.875, '#cd89fa', 0.58],
    [1.08, 1.095, '#adf8ff', 0.36],
    [1.24, 1.27, '#3464ea', 0.28],
  ].forEach(([inner, outer, color, opacity]) => {
    const orbit = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128), glowMat(color, opacity));
    orbit.rotation.x = -Math.PI / 2;
    pedestal.add(orbit);
  });
  const starPoints = [];
  for (let i = 0; i <= 16; i += 1) {
    const angle = (i * Math.PI * 2) / 16;
    const radius = i % 2 ? 0.48 : 0.92;
    starPoints.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  pedestal.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(starPoints), new THREE.LineBasicMaterial({ color: '#cd89fa', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })));
  const ticks = [];
  for (let i = 0; i < 48; i += 1) {
    const angle = (i * Math.PI * 2) / 48;
    const inner = i % 4 === 0 ? 1.1 : 1.15;
    ticks.push(new THREE.Vector3(Math.cos(angle) * inner, 0, Math.sin(angle) * inner));
    ticks.push(new THREE.Vector3(Math.cos(angle) * 1.22, 0, Math.sin(angle) * 1.22));
  }
  pedestal.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), new THREE.LineBasicMaterial({ color: '#adf8ff', transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending })));
  ['☉', '☽', '✧', '♢', '⊹', '✦', '☿', '♄', '◇', '⊙', '✧', '☾'].forEach((glyph, i) => {
    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = glyphCanvas.height = 64;
    const glyphCtx = glyphCanvas.getContext('2d');
    glyphCtx.font = '40px serif';
    glyphCtx.textAlign = 'center';
    glyphCtx.textBaseline = 'middle';
    glyphCtx.fillStyle = '#adf8ff';
    glyphCtx.shadowColor = '#adf8ff';
    glyphCtx.shadowBlur = 12;
    glyphCtx.fillText(glyph, 32, 34);
    const glyphTexture = new THREE.CanvasTexture(glyphCanvas);
    glyphTexture.colorSpace = THREE.SRGBColorSpace;
    const glyphMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), new THREE.MeshBasicMaterial({ map: glyphTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const angle = (i * Math.PI * 2) / 12;
    glyphMesh.position.set(Math.cos(angle) * 0.98, 0.008, Math.sin(angle) * 0.98);
    glyphMesh.rotation.x = -Math.PI / 2;
    glyphMesh.rotation.z = -angle;
    pedestal.add(glyphMesh);
  });
  const pedestalGlow = new THREE.Mesh(new THREE.RingGeometry(0.28, 1.44, 128), glowMat('#3464ea', 0.1));
  pedestalGlow.rotation.x = -Math.PI / 2;
  pedestalGlow.position.y = -0.006;
  pedestal.add(pedestalGlow);
  pedestal.add(ring);
  stageGroup.add(pedestal);

  function starTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.22, color);
    gradient.addColorStop(1, 'rgba(173,248,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.bezierCurveTo(35, 25, 39, 29, 64, 32);
    ctx.bezierCurveTo(39, 35, 35, 39, 32, 64);
    ctx.bezierCurveTo(29, 39, 25, 35, 0, 32);
    ctx.bezierCurveTo(25, 29, 29, 25, 32, 0);
    ctx.fill();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  function cloudTexture(seed) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    let value = seed * 9973 + 17;
    const rnd = () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 12; i += 1) {
      const x = 42 + rnd() * 172;
      const y = 68 + rnd() * 120;
      const rx = 32 + rnd() * 68;
      const ry = 20 + rnd() * 42;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rx);
      grad.addColorStop(0, `rgba(255,255,255,${0.46 + rnd() * 0.36})`);
      grad.addColorStop(0.48, 'rgba(255,255,255,0.24)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const cloudField = new THREE.Group();
  const cloudTextures = Array.from({ length: 6 }, (_, i) => cloudTexture(i + 1));
  const cloudColors = ['#d336d3', '#3464ea', '#cd89fa', '#6713cd', '#adf8ff'];
  for (let i = 0; i < 30; i += 1) {
    const material = new THREE.SpriteMaterial({ map: cloudTextures[i % cloudTextures.length], color: cloudColors[i % cloudColors.length], transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.NormalBlending, fog: false, toneMapped: false });
    const cloud = new THREE.Sprite(material);
    const angle = (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const radius = 6 + Math.random() * 10;
    const y = -3 + Math.random() * 9;
    cloud.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const width = 2.5 + Math.random() * 3.5;
    cloud.scale.set(width, width * (0.42 + Math.random() * 0.16), 1);
    cloud.userData.baseY = y;
    cloud.userData.phase = Math.random() * Math.PI * 2;
    cloud.userData.drift = 0.02 + Math.random() * 0.025;
    cloudField.add(cloud);
  }
  stageGroup.add(cloudField);
  const starField = new THREE.Group();
  const cyanStar = new THREE.SpriteMaterial({ map: starTexture('#adf8ff'), color: '#adf8ff', transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false });
  const lilacStar = new THREE.SpriteMaterial({ map: starTexture('#cd89fa'), color: '#cd89fa', transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 280; i += 1) {
    const star = new THREE.Sprite(i % 3 ? cyanStar : lilacStar);
    const radius = 2 + Math.random() * 43;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    star.position.set(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    const size = 0.06 + Math.random() * 0.2;
    star.scale.set(size, size, 1);
    star.userData.phase = Math.random() * Math.PI * 2;
    star.userData.size = size;
    starField.add(star);
  }
  stageGroup.add(starField);

  const figure = new THREE.Group();
  figure.scale.setScalar(CM);
  stageGroup.add(figure);

  const bodyGroup = new THREE.Group();
  const garmentGroup = new THREE.Group();
  const formDetailsGroup = new THREE.Group();
  figure.add(bodyGroup, garmentGroup, formDetailsGroup);

  const weaveCanvas = document.createElement('canvas');
  weaveCanvas.width = weaveCanvas.height = 64;
  const weaveCtx = weaveCanvas.getContext('2d');
  weaveCtx.fillStyle = '#888';
  weaveCtx.fillRect(0, 0, 64, 64);
  weaveCtx.strokeStyle = '#aaa';
  weaveCtx.globalAlpha = 0.35;
  for (let i = 0; i < 64; i += 4) {
    weaveCtx.beginPath(); weaveCtx.moveTo(i, 0); weaveCtx.lineTo(i, 64); weaveCtx.stroke();
    weaveCtx.beginPath(); weaveCtx.moveTo(0, i); weaveCtx.lineTo(64, i); weaveCtx.stroke();
  }
  const weaveTexture = new THREE.CanvasTexture(weaveCanvas);
  weaveTexture.wrapS = weaveTexture.wrapT = THREE.RepeatWrapping;
  weaveTexture.repeat.set(12, 18);
  const skinMat = new THREE.MeshStandardMaterial({ color: '#f4ebd9', roughness: 0.85, metalness: 0, bumpMap: weaveTexture, bumpScale: 0.18 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#9a6a43', roughness: 0.42, metalness: 0.04 });

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
      const m = new THREE.Mesh(geo, geo.userData.region === 'wood' ? woodMat : skinMat);
      m.castShadow = true;
      m.receiveShadow = true;
      bodyGroup.add(m);
    }
    rebuildFormDetails(model);
    if (current.garment) setGarment(current.garment);
    return model;
  }

  function rebuildFormDetails(M) {
    disposeGroup(formDetailsGroup);
    const red = new THREE.LineBasicMaterial({ color: '#e0483e', transparent: true, opacity: 0.95, depthWrite: false });
    const ringAt = (y, inset = 0.025) => {
      const p = M.profileAt(y);
      const pts = [];
      for (let i = 0; i <= 96; i += 1) {
        const a = (i / 96) * Math.PI * 2;
        const front = Math.max(0, Math.cos(a));
        pts.push(new THREE.Vector3((p.x || 0) + Math.sin(a) * (p.rx + inset), y, (p.z || 0) + Math.cos(a) * (p.rz + inset) + (p.frontBulge || 0) * Math.pow(front, 2.2)));
      }
      formDetailsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), red));
    };
    [M.lm.neckBaseY, M.lm.chestY, (M.lm.chestY + M.lm.waistY) / 2, M.lm.waistY, (M.lm.waistY + M.lm.hipY) / 2, M.lm.hipY].forEach((y) => ringAt(y));
    const vertical = (side, depth) => {
      const pts = M.torso.map((t) => {
        const a = side;
        const front = Math.max(0, depth);
        return new THREE.Vector3(t.x + a * (t.rx + 0.14), t.y, t.z + depth * (t.rz + 0.14) + t.frontBulge * front * front);
      });
      formDetailsGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), red));
    };
    vertical(0, 1); vertical(0, -1); vertical(1, 0); vertical(-1, 0);
    vertical(0.46, 0.78); vertical(-0.46, 0.78); vertical(0.46, -0.78); vertical(-0.46, -0.78);

    const brass = new THREE.MeshStandardMaterial({ color: '#b58b45', metalness: 0.72, roughness: 0.26 });
    const walnut = new THREE.MeshStandardMaterial({ color: '#51301f', metalness: 0.05, roughness: 0.38 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(M.neckR * 1.08, M.neckR * 1.08, 1.1, 48), brass);
    cap.position.set(0, M.lm.neckTopY + 0.55, M.torso.at(-1).z);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(M.neckR * 0.72, 36, 24), walnut);
    finial.scale.y = 1.25;
    finial.position.set(0, M.lm.neckTopY + 2.2, M.torso.at(-1).z);
    const finialTip = new THREE.Mesh(new THREE.SphereGeometry(M.neckR * 0.27, 28, 18), brass);
    finialTip.position.set(0, M.lm.neckTopY + 3.25, M.torso.at(-1).z);
    formDetailsGroup.add(cap, finial, finialTip);
    const stampCanvas = document.createElement('canvas'); stampCanvas.width = 256; stampCanvas.height = 96;
    const stampCtx = stampCanvas.getContext('2d'); stampCtx.fillStyle = '#111'; stampCtx.font = 'bold 42px Georgia'; stampCtx.textAlign = 'center'; stampCtx.fillText(sizeCode(M.b), 128, 58);
    const stampTexture = new THREE.CanvasTexture(stampCanvas); stampTexture.colorSpace = THREE.SRGBColorSpace;
    const stamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: stampTexture, transparent: true, depthWrite: false }));
    stamp.position.set(0, M.lm.neckTopY - 2.6, M.neckR + 0.35); stamp.scale.set(8, 3, 1); formDetailsGroup.add(stamp);

    for (const side of [-1, 1]) {
      const dir = M.armDir.clone(); dir.x *= side;
      const joint = side < 0 ? M.jointL : M.jointR;
      for (const t of [M.lm.armLen * 0.5, M.lm.armLen]) {
        const jointRing = new THREE.Mesh(new THREE.TorusGeometry(M.upperR * 0.82, 0.24, 10, 32), brass);
        jointRing.position.copy(joint.clone().addScaledVector(dir, t));
        jointRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        formDetailsGroup.add(jointRing);
      }
    }

  }

  function sizeCode(b) {
    if (b.height < 145 || b.belly > 0 || b.frame !== 'neutral') return 'CUSTOM';
    if (b.chest < 84) return 'XS';
    if (b.chest < 92) return 'S';
    if (b.chest < 101) return 'M';
    if (b.chest < 112) return 'L';
    return 'XL';
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
    const fabric = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
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
    stageGroup.rotation.y = 0;
    controls.update();
  }

  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / Math.max(h, 1);
    const sidebarOffset = w > 860 ? Math.min(230, w * 0.18) : 0;
    camera.setViewOffset(w, h, -sidebarOffset, 0, w, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const revealAge = performance.now() - revealStarted;
    revealLight.intensity = revealAge < 150 ? 7.5 * Math.sin((revealAge / 150) * Math.PI) : revealAge < 650 ? 1.8 * (1 - (revealAge - 150) / 500) : 0;
    const elapsed = clock.elapsedTime;
    starField.rotation.y += dt * 0.018;
    cloudField.rotation.y += dt * 0.006;
    cloudField.children.forEach((cloud) => {
      cloud.position.y = cloud.userData.baseY + Math.sin(elapsed * cloud.userData.drift * 12 + cloud.userData.phase) * 0.22;
    });
    starField.children.forEach((star) => {
      const pulse = 0.82 + Math.sin(elapsed * 2.2 + star.userData.phase) * 0.18;
      const size = star.userData.size * pulse;
      star.scale.set(size, size, 1);
    });
    if (opts.spin) stageGroup.rotation.y += dt * 0.6;
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    setBody,
    setGarment,
    setOptions,
    resetCamera,
    flashReveal() {
      revealStarted = performance.now();
    },
    get checks() {
      return current.checks;
    },
    fitWord,
  };
}

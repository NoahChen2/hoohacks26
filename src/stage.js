import * as THREE from 'three';

// Celestial studio: galaxy sky, glowing pedestal (intentionally no solid floor),
// drifting nebula clouds and twinkling stars. Built into `stageGroup`; call the
// returned update(dt, elapsed) each frame while the sky animates.
export function addCelestialStage(stageGroup) {
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

  // A small, feathered contact shadow anchors the feet without introducing a
  // solid floor or hiding the astrolabe artwork beneath them.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowCtx = shadowCanvas.getContext('2d');
  const shadowGradient = shadowCtx.createRadialGradient(64, 64, 5, 64, 64, 62);
  shadowGradient.addColorStop(0, 'rgba(8, 4, 28, 0.44)');
  shadowGradient.addColorStop(0.42, 'rgba(45, 17, 146, 0.20)');
  shadowGradient.addColorStop(1, 'rgba(45, 17, 146, 0)');
  shadowCtx.fillStyle = shadowGradient;
  shadowCtx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 0.62),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.012, 0);
  contactShadow.renderOrder = 1;
  pedestal.add(contactShadow);
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
    // Keep stage sparkles in a deep backdrop volume. A spherical distribution
    // put half of them between the camera and the figure; rotating that field
    // then swept bright sprites across the face. The central clearing also
    // preserves a clean silhouette around the head and torso.
    let x;
    let y;
    do {
      x = (Math.random() - 0.5) * 34;
      y = -1.5 + Math.random() * 15;
    } while (Math.abs(x) < 1.35 && y > -0.15 && y < 3.1);
    star.position.set(x, y, -3.5 - Math.random() * 22);
    const size = 0.06 + Math.random() * 0.2;
    star.scale.set(size, size, 1);
    star.userData.phase = Math.random() * Math.PI * 2;
    star.userData.size = size;
    starField.add(star);
  }
  stageGroup.add(starField);

  return {
    update(dt, elapsed) {
      cloudField.rotation.y += dt * 0.006;
      cloudField.children.forEach((cloud) => {
        cloud.position.y = cloud.userData.baseY + Math.sin(elapsed * cloud.userData.drift * 12 + cloud.userData.phase) * 0.22;
      });
      starField.children.forEach((star) => {
        const pulse = 0.82 + Math.sin(elapsed * 2.2 + star.userData.phase) * 0.18;
        const size = star.userData.size * pulse;
        star.scale.set(size, size, 1);
      });
    },
  };
}

// Fitting-room studios: graded backdrop, fogged floor and a podium. Night is the
// unified-studio palette; daylight is the original light studio.
const STUDIOS = {
  night: { sky: ['#0d1724', '#142233', '#18283c'], fog: '#18283c', floor: '#18283c', podium: '#354854', rim: '#7faaa8', ring: '#b6c5c1', shadow: '8,14,22' },
  daylight: { sky: ['#ccd6dd', '#e6e9e8', '#f0ece5'], fog: '#e2e7e6', floor: '#d6dcdb', podium: '#efede6', rim: '#8caaa9', ring: '#b6c5c1', shadow: '38,52,60' },
};

export const STAGE_THEMES = { celestial: 'Celestial', night: 'Night studio', daylight: 'Daylight studio' };

function addStudioStage(stageGroup, scene, c) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, c.sky[0]);
  gradient.addColorStop(0.65, c.sky[1]);
  gradient.addColorStop(1, c.sky[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 512);
  const backdrop = new THREE.CanvasTexture(canvas);
  backdrop.colorSpace = THREE.SRGBColorSpace;
  scene.background = backdrop;
  scene.fog = new THREE.Fog(c.fog, 5, 13);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: c.floor }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.064;
  floor.receiveShadow = true;
  const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.77, 0.8, 0.06, 96), new THREE.MeshLambertMaterial({ color: c.podium }));
  podium.position.y = -0.032;
  podium.receiveShadow = true;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.772, 0.006, 8, 96), new THREE.MeshLambertMaterial({ color: c.rim }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.008;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.653, 96), new THREE.MeshBasicMaterial({ color: c.ring, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.0005;
  // Baked soft contact shadow supplements directional shadows beneath the feet.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sc = shadowCanvas.getContext('2d');
  const radial = sc.createRadialGradient(64, 64, 8, 64, 64, 64);
  radial.addColorStop(0, `rgba(${c.shadow},.22)`);
  radial.addColorStop(1, `rgba(${c.shadow},0)`);
  sc.fillStyle = radial;
  sc.fillRect(0, 0, 128, 128);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.65), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }));
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.001, 0.04);
  stageGroup.add(floor, podium, rim, ring, contact);
  return { update() {}, animated: false };
}

// Builds the chosen stage in its own group under `parent`; dispose() removes it
// and restores the transparent, fog-free scene the celestial stage expects.
export function addStage(theme, scene, parent) {
  const group = new THREE.Group();
  parent.add(group);
  const stage = STUDIOS[theme] ? addStudioStage(group, scene, STUDIOS[theme]) : { ...addCelestialStage(group), animated: true };
  return {
    ...stage,
    dispose() {
      parent.remove(group);
      group.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          m?.map?.dispose();
          m?.dispose();
        }
      });
      scene.background?.dispose?.();
      scene.background = null;
      scene.fog = null;
    },
  };
}

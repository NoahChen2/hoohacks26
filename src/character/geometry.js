import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { createTorsoSampler } from './sections.js';
import { headFrame, hairline, hairShape, assertPreviewRange } from './measurements.js';
import { characterHair } from './canonical.js';
export { headFrame };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

// Marching cubes samples the surface on a finite grid. Anchor the three jaw
// landmarks after extraction/finishing so resolution cannot blunt the chin.
export function pinJawLandmarks(positions, height) {
  const head = headFrame(height), H = 2 * head.r, W = .78 * H, D = .82 * H;
  for (const target of [[0, -.50 * H, .12 * D], [-.35 * W, -.25 * H, -.05 * D], [.35 * W, -.25 * H, -.05 * D]]) {
    target[1] += head.y; target[2] += head.z;
    let best = Infinity, nearest = -1;
    for (let i = 0; i < positions.length; i += 3) {
      const d = (positions[i] - target[0]) ** 2 + (positions[i + 1] - target[1]) ** 2 + (positions[i + 2] - target[2]) ** 2;
      if (d < best) { best = d; nearest = i; }
    }
    if (nearest < 0) continue;
    const original = Array.from(positions.subarray(nearest, nearest + 3));
    // Move every copy of the vertex together before welding; never open seams.
    for (let i = 0; i < positions.length; i += 3) {
      if (positions[i] === original[0] && positions[i + 1] === original[1] && positions[i + 2] === original[2]) positions.set(target, i);
    }
  }
  return positions;
}

// Shared with the comic body shader so painted facial features sit on this head.
function smoothRadius(keys, value, key, field) {
  if (value <= keys[0][key]) return keys[0][field];
  for (let i = 1; i < keys.length; i++) if (value <= keys[i][key]) {
    const a = keys[i - 1], b = keys[i], t = clamp((value - a[key]) / (b[key] - a[key]), 0, 1);
    return a[field] + (b[field] - a[field]) * t * t * (3 - 2 * t);
  }
  return keys.at(-1)[field];
}

// A single implicit surface, not an assembly of intersecting rendered primitives.
// All unions happen in the signed distance field before the mesh is extracted.
export function buildProceduralBody(model, character, resolution = 128) {
  const M = model, H = M.lm.H;
  const frame = headFrame(H), headHeight = 2 * frame.r;
  assertPreviewRange(M);
  const halfWidth = Math.max(M.jointR.x + Math.sin(M.lm.armAngle) * (M.lm.armLen + H * .11) + H * .06, M.profileAt(M.lm.hipY).rx + 8);
  const halfDepth = Math.max(H * .15, M.profileAt(M.lm.hipY).rz + 8);
  // Headroom above the scalp keeps the hair volume inside the sampled grid.
  const headroom = { curls: 14, mohawk: 13, bun: 9 }[characterHair(character)] ?? 6;
  const min = [-halfWidth, -3, -halfDepth], max = [halfWidth, H + headroom, halfDepth];
  const span = max.map((v, i) => v - min[i]), spacing = span.map(v => v / resolution);
  const material = new THREE.MeshBasicMaterial();
  const marcher = new MarchingCubes(resolution, material, false, false, 150000);
  marcher.isolation = 0; marcher.field.fill(-1000);
  const field = marcher.field, N = resolution, N2 = N * N;
  const coords = span.map((_, axis) => Float32Array.from({ length: N }, (__, i) => min[axis] + i * spacing[axis]));
  // Hair parts hanging below the head, recorded while `drape` is set.
  let drape = null;
  const hairParts = [];
  function union(boundsMin, boundsMax, distance, blend = .85) {
    if (drape) drape.push({ lo: boundsMin, hi: boundsMax, distance });
    const start = boundsMin.map((v, i) => clamp(Math.floor((v - min[i] - blend) / spacing[i]), 1, N - 3));
    const end = boundsMax.map((v, i) => clamp(Math.ceil((v - min[i] + blend) / spacing[i]), 2, N - 2));
    for (let iz = start[2]; iz <= end[2]; iz++) for (let iy = start[1]; iy <= end[1]; iy++) for (let ix = start[0]; ix <= end[0]; ix++) {
      const index = iz * N2 + iy * N + ix;
      const d = -distance(coords[0][ix], coords[1][iy], coords[2][iz]);
      // Above the jaw, use a hard union: shoulder/neck smoothing must never
      // inflate the face. Skinning is independently isolated in rig.js.
      const radius = coords[1][iy] > frame.y - headHeight * .45 ? 0 : blend;
      const old = field[index], h = radius ? Math.max(radius - Math.abs(old - d), 0) / radius : 0;
      field[index] = Math.max(old, d) + h * h * radius * .25;
    }
  }
  function ellipsoid(center, scale, angle = 0, blend = .8, sole = false) {
    const radius = Math.max(...scale), c = Math.cos(angle), s = Math.sin(angle);
    union(center.map(v => v - radius), center.map(v => v + radius), (x, y, z) => {
      const dx = x - center[0], dy = y - center[1];
      const u = dx * c + dy * s, v = -dx * s + dy * c, w = z - center[2];
      // Ellipsoid distance approximation, with a flat contact plane for feet.
      const k0 = Math.hypot(u / scale[0], v / scale[1], w / scale[2]);
      const k1 = Math.hypot(u / scale[0] ** 2, v / scale[1] ** 2, w / scale[2] ** 2);
      let d = k0 * (k0 - 1) / Math.max(k1, .00001);
      if (k0 < .00001) d = -Math.min(...scale);
      // Smooth unions bulge by up to blend/4; keep the blended sole above the floor.
      if (sole) d = Math.max(d, .12 + blend * .25 - y);
      return d;
    }, blend);
  }
  // Tapered capsule (round cone) from radius r1 at a to r2 at b.
  function cone(a, b, r1, r2, blend = .5) {
    const ba = b.map((v, i) => v - a[i]), l2 = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
    const pad = Math.max(r1, r2);
    union(a.map((v, i) => Math.min(v, b[i]) - pad), a.map((v, i) => Math.max(v, b[i]) + pad), (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], t = px * ba[0] + py * ba[1] + pz * ba[2], w = t - l2;
      const qx = px * l2 - ba[0] * t, qy = py * l2 - ba[1] * t, qz = pz * l2 - ba[2] * t;
      const x2 = qx * qx + qy * qy + qz * qz, y2 = t * t * l2, z2 = w * w * l2, k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(w) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
      if (Math.sign(t) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
      return (Math.sqrt(x2 * a2 * il2) + t * rr) * il2 - r1;
    }, blend);
  }
  // Capsule with an elliptical cross-section (rx across, rz deep): a hair sheet.
  function sheet(a, b, rx, rz) {
    const ba = b.map((v, i) => v - a[i]), bb = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2;
    return (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], h = clamp((px * ba[0] + py * ba[1] + pz * ba[2]) / bb, 0, 1);
      return (Math.hypot((px - ba[0] * h) / rx, (py - ba[1] * h) / rz, (pz - ba[2] * h) / rz) - 1) * Math.min(rx, rz);
    };
  }
  function capsule(a, b, radius, blend = .3) {
    const ba = b.map((v, i) => v - a[i]), bb = ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2;
    union(a.map((v, i) => Math.min(v, b[i]) - radius), a.map((v, i) => Math.max(v, b[i]) + radius), (x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], h = clamp((px * ba[0] + py * ba[1] + pz * ba[2]) / bb, 0, 1);
      return Math.hypot(px - ba[0] * h, py - ba[1] * h, pz - ba[2] * h) - radius;
    }, blend);
  }
  const sampler = createTorsoSampler(M, character);
  union([-sampler.maxRadius - 2, sampler.low, -sampler.maxRadius - 2], [sampler.maxRadius + 2, sampler.high, sampler.maxRadius + 2], (x, y, z) => {
    const bottom = M.lm.crotchY - 3;
    const cap = y < M.lm.hipY ? Math.sqrt(Math.max(0, 1 - ((M.lm.hipY-y)/(M.lm.hipY-bottom)) ** 2)) : 1;
    const neckBlend = clamp((y - M.lm.neckBaseY) / (M.lm.neckTopY - M.lm.neckBaseY), 0, 1);
    const neckLimit = .28 * .78 * headHeight;
    const neckZ = neckBlend * (frame.z - .05 * .82 * headHeight - neckLimit);
    const measuredRadius = sampler.radius(y, Math.atan2(x, z - neckZ));
    const radius = measuredRadius + (Math.min(measuredRadius, neckLimit) - measuredRadius) * neckBlend;
    const radial = Math.hypot(x, z - neckZ) - radius * cap;
    return Math.max(radial, bottom-y, y-sampler.high);
  }, 1.0);

  const legs = [...M.legs].reverse();
  for (const side of [-1, 1]) {
    const axisX = side * M.lm.legX;
    const rmax = M.thighR * 1.25;
    union([axisX - rmax, H * .015, -rmax], [axisX + rmax, M.lm.hipY + 3, rmax], (x, y, z) => {
      const r = smoothRadius(legs, y, 'y', 'r') + M.thighR * .065 * bell(y / H, .192, .045);
      const rz = r * 1.085, rx = r * .915;
      const calfZ = -.5 * bell(y / H, .19, .05);
      const d = (Math.hypot((x - axisX) / rx, (z - calfZ) / rz) - 1) * Math.min(rx, rz);
      return Math.max(d, H * .018 - y, y - (M.lm.hipY + 2));
    }, 1.1);
    ellipsoid([axisX, H * .017, H * .022], [H * .022, H * .024, H * .048], 0, .8, true);
    ellipsoid([axisX + side * H * .005, H * .012, H * .084], [H * .028, H * .015, H * .044], -side * .1, .9, true);

    const joint = side < 0 ? M.jointL : M.jointR;
    const dx = side * Math.sin(M.lm.armAngle), dy = -Math.cos(M.lm.armAngle);
    const armLen = M.lm.wristT;
    const tip = [joint.x + dx * armLen, joint.y + dy * armLen, 0];
    const armRadius = M.upperR * 1.45;
    union([Math.min(joint.x, tip[0]) - armRadius, tip[1] - armRadius, -armRadius], [Math.max(joint.x, tip[0]) + armRadius, joint.y + armRadius, armRadius], (x, y, z) => {
      const px = x - joint.x, py = y - joint.y;
      const t = px * dx + py * dy, u = px * -dy + py * dx;
      const tc = clamp(t, 0, armLen);
      // Measured arm radii are mapped onto the joint-to-wrist span, plus deltoid
      // cap, biceps belly and forearm muscle mass.
      const r = smoothRadius(M.arm, tc * M.lm.armLen / armLen, 't', 'r') * (1 + .10 * bell(tc / armLen, .04, .13) + .05 * bell(tc / armLen, .25, .12) + .07 * bell(tc / armLen, .6, .1));
      return (Math.hypot(u / r, z / (r * .96), (t - tc) / r) - 1) * r;
    }, 1.15);
    // Relaxed hands face the thighs: palm, fingers spread front to back, thumb
    // forward, all blended into the same watertight mesh (~10.8% of stature).
    const at = (t, z = 0, inward = 0) => [joint.x + dx * t - side * inward, joint.y + dy * t, z];
    const angle = side * M.lm.armAngle;
    ellipsoid(at(armLen + H * .029), [H * .0095, H * .033, H * .024], angle, .6);
    // Fingers: two jointed segments each, curling gently toward the palm.
    for (let finger = 0; finger < 4; finger++) {
      const length = H * (.05 - Math.abs(finger - 1) * .005 - (finger === 3 ? .005 : 0));
      const z = (1.5 - finger) * H * .0105, base = armLen + H * .058, radius = H * (finger === 3 ? .0045 : .0051);
      capsule(at(base, z), at(base + length * .55, z, length * .08), radius, .25);
      capsule(at(base + length * .55, z, length * .08), at(base + length * .95, z, length * .26), radius * .9, .22);
    }
    capsule(at(armLen + H * .018, H * .013, H * .004), at(armLen + H * .042, H * .024, H * .011), H * .0066, .35);
    capsule(at(armLen + H * .042, H * .024, H * .011), at(armLen + H * .062, H * .027, H * .017), H * .0058, .25);
  }
  // Clean anime head: one continuous cranium tapering into a soft jaw. Facial
  // features are intentionally kept out of the implicit surface (apart from a
  // restrained nose bridge) so the shader does not fight lumpy brow/lip/chin
  // geometry. The head still uses the stature-based frame, so every existing
  // measurement and presentation morph remains anchored to the same skeleton.
  const { y: headY, r: headR, z: headZ } = headFrame(H);
  const femininity = ({ feminine: 1, neutral: .5, masculine: 0 })[character.bodyPreset] ?? .5;
  const R = headR, headH = 2 * R, headW = .78 * headH, headD = .82 * headH;
  // Anatomical cervical bridge: the neck continues upward and slightly back
  // into the occiput instead of ending in a horizontal cap beneath the head.
  // It remains narrow at the jaw and broadens gently into the trapezius.
  cone(
    [0, M.lm.neckBaseY - H * .004, -headD * .015],
    [0, headY - headH * .225, headZ - headD * .14],
    headW * .32,
    headW * .245,
    .42,
  );
  const sections = [
    { v: -.50, w: 0, d: 0, z: .12 * headD },
    { v: -.25, w: .70 * headW, d: .28 * headD, z: -.05 * headD },
    { v: -.05, w: .94 * headW, d: .43 * headD, z: 0 },
    { v: .15, w: headW, d: .50 * headD, z: 0 },
    { v: .32, w: .86 * headW, d: .43 * headD, z: -.02 * headD },
    { v: .43, w: .58 * headW, d: .30 * headD, z: -.03 * headD },
    { v: .52, w: .08 * headW, d: .08 * headD, z: -.04 * headD },
  ];
  const section = (v, field) => {
    // Linear mandibular planes converge to one tip; only the cranium is rounded.
    if (v < -.05) {
      const i = v < -.25 ? 0 : 1, a = sections[i], b = sections[i + 1];
      return THREE.MathUtils.lerp(a[field], b[field], clamp((v - a.v) / (b.v - a.v), 0, 1));
    }
    return smoothRadius(sections, v, 'v', field);
  };
  union([-headW * .56, headY - headH * .54, headZ - headD * .57], [headW * .56, headY + headH * .54, headZ + headD * .54], (x, y, z) => {
    const v = (y - headY) / headH;
    const rx = Math.max(section(v, 'w') * .5, .03);
    const rz = Math.max(section(v, 'd'), .03);
    const cz = headZ + section(v, 'z');
    const radial = (Math.hypot(x / rx, (z - cz) / rz) - 1) * Math.min(rx, rz);
    return Math.max(radial, headY - headH * .50 - y, y - (headY + headH * .52));
  }, .06);
  // Ears occupy the specified brow-to-nose band at ±.50W.
  for (const side of [-1, 1]) ellipsoid(
    [side * headW * .5, headY - headH * .135, headZ - headD * .04],
    [headW * .07, headH * .095, headD * .06], 0, .32
  );
  // The nose is projected in the face shader; no bulb or capsule on the face.
  // Hair volume above the painted hairline, per hairstyle. Parts that hang below
  // the head (tails, braids, long hair) are recorded as drape so the worker can
  // bake a hair mask for them; the head itself is painted from the hairline.
  const style = characterHair(character), shape = hairShape(style);
  const stripR = shape.texture === 3 ? shape.strip * R : Infinity;
  const clip = (x, y, z) => Math.max(headY + hairline(Math.atan2(x, z - headZ), shape) * R - y, Math.abs(x) - stripR);
  const headPt = p => [p[0] * R, headY + p[1] * R, headZ + p[2] * R];
  const hair = (center, radii, blend) => union(center.map((v, i) => v - radii[i]), center.map((v, i) => v + radii[i]), (x, y, z) => {
    const k = Math.hypot((x - center[0]) / radii[0], (y - center[1]) / radii[1], (z - center[2]) / radii[2]);
    return Math.max((k - 1) * Math.min(...radii), clip(x, y, z));
  }, blend);
  const lock = (base, tip, r1, r2, blend = .55) => cone(headPt(base), headPt(tip), r1 * R, r2 * R, blend);
  const blob = (c, r, blend = .6) => ellipsoid(headPt(c), r.map(v => v * R), 0, blend);
  const draped = build => { drape = []; build(); hairParts.push(...drape); drape = null; };
  const wedge = (base, tip, width, depth) => {
    const a = headPt(base), b = headPt(tip);
    const pad = Math.max(width, depth) * R;
    union(a.map((v, i) => Math.min(v, b[i]) - pad), a.map((v, i) => Math.max(v, b[i]) + pad), (x, y, z) => {
      const t = clamp((a[1] - y) / (a[1] - b[1]), 0, 1);
      const cx = THREE.MathUtils.lerp(a[0], b[0], t) - R * .10 * Math.sin(t * Math.PI);
      const cz = THREE.MathUtils.lerp(a[2], b[2], t) + R * .12 * Math.sin(t * Math.PI);
      const taper = Math.max(.015, Math.sqrt(1 - t) * (.65 + .35 * Math.sin(t * Math.PI)));
      return Math.max((Math.hypot((x - cx) / (width * R), (z - cz) / (depth * R)) - taper) * Math.min(width, depth) * R, y - a[1], b[1] - y);
    }, .08);
  };
  const shell = () => hair([0, headY + headH * .035, headZ - headD * .03], [headW * .54, headH * .525, headD * .53], .6);
  const quiff = () => hair([0, headY + headH * .455, headZ + headD * .08], [headW * .42, headH * .095, headD * .34], .55);
  // Pulled-back styles lie closer to the scalp.
  const slick = () => hair([0, headY + .2, headZ - .25], [R * .70 + .45, R + .9, R * .88 + .7], .6);
  const bobLobe = () => hair([0, headY - R * .55, headZ - R * .45], [R * .68, R * .8, R * .5], .9);
  const sweptFringe = () => lock([-.45, .72, .55], [.42, .48, .8], .2, .07);
  if (style === 'crop') {
    shell();
    // Feathered, overlapping locks: a tousled short cut for masculine bodies
    // and a slightly softer medium-short silhouette for the neutral preset.
    const softness = femininity * .14;
    for (let k = -4; k <= 4; k++) {
      const t = (k + 4) / 8, sweep = -1 + 2 * t;
      const tips = [.05, .12, -.02, .20, .07, -.06, .14, .02, -.12];
      draped(() => wedge([sweep * .49 - .07, .80 - .12 * Math.abs(sweep), .30], [sweep * .62 + .08, tips[k + 4], .66 - .16 * Math.abs(sweep)], .24 + softness * .15, .34));
    }
    for (const side of [-1, 1]) {
      // Round-cone temple locks stay buried in the scalp at their root, then
      // taper beside the cheek. This avoids tiny detached marching-cubes caps.
      draped(() => lock([side * .60, .44, -.02], [side * .66, -.50, -.02], .28, .07, .34));
    }
  } else if (style === 'bob') {
    shell(); bobLobe();
    // Face-framing tapered side layers stop above the shoulder line.
    for (const side of [-1, 1]) {
      lock([side * .55, .34, .08], [side * .75, -.90, .04], .22, .075);
      lock([side * .64, .12, -.18], [side * .76, -.88, -.18], .19, .065, .42);
    }
    for (let k = -4; k <= 4; k++) {
      const sweep = k / 4;
      draped(() => wedge([sweep * .49 - .10, .80 - .10 * Math.abs(sweep), .37], [sweep * .67 + .12, .04 + .14 * Math.sin(k * 1.7), .74 - .14 * Math.abs(sweep)], .23, .27));
    }
  } else if (style === 'long') {
    shell(); quiff(); bobLobe(); sweptFringe();
    draped(() => {
      // Curtains past the jaw, falling behind the shoulders, and a back sheet
      // over the nape to below the shoulder line.
      for (const side of [-1, 1]) {
        lock([side * .58, .3, .02], [side * .74, -.75, -.22], .27, .2, .6);
        lock([side * .74, -.75, -.22], [side * .66, -1.75, -.62], .2, .15, .6);
      }
      const top = headPt([0, -.35, -.52]), bottom = headPt([0, -2.55, -.88]);
      union([top[0] - R * .75, bottom[1] - R * .4, bottom[2] - R * .4], [top[0] + R * .75, top[1] + R * .4, top[2] + R * .4], sheet(top, bottom, R * .7, R * .36), .9);
    });
  } else if (style === 'ponytail') {
    slick();
    blob([0, .2, -.96], [.24, .22, .2]);
    draped(() => {
      lock([0, .16, -1.04], [0, -.45, -1.2], .17, .2, .5);
      lock([0, -.45, -1.2], [0, -1.15, -1.08], .2, .16, .5);
      lock([0, -1.15, -1.08], [0, -1.75, -.86], .16, .06, .5);
    });
  } else if (style === 'bun') {
    slick();
    blob([0, 1.08, -.32], [.4, .33, .4], .5);
    blob([0, .9, -.28], [.27, .2, .27], .4);
  } else if (style === 'curls') {
    // A big rounded volume with a lumpy silhouette of smaller curls.
    hair([0, headY + R * .32, headZ - R * .12], [R * 1.08, R * 1.02, R * 1.12], .8);
    for (let ring = 0; ring < 4; ring++) {
      const elevation = [-.15, .35, .8, 1.25][ring], count = [9, 9, 7, 3][ring];
      for (let k = 0; k < count; k++) {
        const azimuth = (k + ring * .5) / count * Math.PI * 2;
        const c = [Math.sin(azimuth) * Math.cos(elevation) * 1.02, .32 + Math.sin(elevation) * .98, -.12 + Math.cos(azimuth) * Math.cos(elevation) * 1.06];
        hair(headPt(c), [R * .34, R * .34, R * .34], .55);
      }
    }
  } else if (style === 'braids') {
    slick();
    // Two plaits from behind the ears, lying over the back of the shoulders.
    draped(() => {
      for (const side of [-1, 1]) {
        blob([side * .5, -.25, -.7], [.2, .2, .2]);
        const path = [[.5, -.32, -.76], [.54, -.95, -.98], [.6, -1.6, -.92], [.62, -2.25, -.84]];
        for (let k = 0; k <= 9; k++) {
          const t = k / 9 * 3, i = Math.min(2, Math.floor(t)), f = t - i, a = path[i], b = path[i + 1];
          const p = a.map((v, j) => v + (b[j] - v) * f), swing = (k % 2 ? 1 : -1) * .05;
          blob([side * (p[0] + swing), p[1], p[2]], [.17, .13, .15], .35);
        }
        lock([side * .62, -2.3, -.84], [side * .63, -2.6, -.8], .1, .05, .3);
      }
    });
  } else if (style === 'mohawk') {
    hair([0, headY + .25, headZ - .3], [R * .2, R + 1.6, R * .88 + 1.4], .6);
    // A crest of spikes from the forehead over the crown to the nape.
    for (let k = 0; k < 7; k++) {
      const phi = .55 + k * .37, s = [0, .25 + Math.sin(phi) * .95, -.03 + Math.cos(phi) * .88];
      const sweep = [0, s[1] * 1.3 + .04, s[2] * 1.3 - .2];
      lock(s.map(v => v * .9), sweep, .2, .04, .45);
    }
  }

  marcher.update();
  const count = marcher.count;
  if (!count || count > 450000) throw new Error('The procedural body could not be meshed within its geometry budget.');
  const positions = marcher.positionArray.slice(0, count * 3), normals = marcher.normalArray.slice(0, count * 3), uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) positions[i * 3 + axis] = min[axis] + (positions[i * 3 + axis] + 1) * .5 * span[axis];
    // Re-centre only the extracted cervical rings. Keeping this correction
    // local preserves the calibrated torso field/topology while removing the
    // backward nape shelf that was visible in profile.
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
    if (py >= M.lm.neckBaseY && py <= M.lm.neckTopY) {
      const t0 = clamp((py - M.lm.neckBaseY) / (M.lm.neckTopY - M.lm.neckBaseY), 0, 1);
      const t = t0 * t0 * (3 - 2 * t0);
      const neckLimit = .28 * .78 * headHeight, headDepth = .82 * headHeight;
      const oldZ = t0 * (frame.z - .05 * headDepth - neckLimit);
      const newZ = THREE.MathUtils.lerp(-.015 * headDepth, frame.z - .08 * headDepth, t);
      if (Math.hypot(px, pz - oldZ) < neckLimit * 1.45) positions[i * 3 + 2] += newZ - oldZ;
    }
    const nx = normals[i * 3] / span[0], ny = normals[i * 3 + 1] / span[1], nz = normals[i * 3 + 2] / span[2];
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.set([nx / length, ny / length, nz / length], i * 3);
    uv[i * 2] = .5 + Math.atan2(positions[i * 3], positions[i * 3 + 2]) / (Math.PI * 2);
    uv[i * 2 + 1] = positions[i * 3 + 1] / H;
  }
  const geometry = new THREE.BufferGeometry();
  pinJawLandmarks(positions, H);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.source = 'procedural-fallback';
  // The distance field, for ambient-occlusion baking (index = x + y N + z N^2).
  geometry.sdf = { field, min, spacing, N };
  geometry.hairParts = hairParts;
  marcher.geometry.dispose(); material.dispose();
  return geometry;
}

// Per-vertex hair coverage (1 on hanging hair, fading to 0 within a centimetre)
// from the drape parts' distance functions. The shader paints the head's hair
// from the hairline and the hanging hair from this mask.
export function bakeHairMask(positions, parts = []) {
  const n = positions.length / 3, mask = new Float32Array(n);
  if (!parts.length) return mask;
  const reach = 1;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    let best = reach;
    for (const { lo, hi, distance } of parts) {
      if (x < lo[0] - reach || x > hi[0] + reach || y < lo[1] - reach || y > hi[1] + reach || z < lo[2] - reach || z > hi[2] + reach) continue;
      best = Math.min(best, distance(x, y, z));
    }
    mask[i] = clamp(1 - best / reach, 0, 1);
  }
  return mask;
}

// Marching cubes emits every vertex once per triangle (~6x duplication). Welding
// it into an indexed mesh lets the GPU skin, outline and shadow each vertex once.
// Shared corners are bitwise identical, so vertices are matched on their bits.
export function weld(positions, normals, uv) {
  const count = positions.length / 3, bits = new Uint32Array(positions.buffer, positions.byteOffset, positions.length);
  let size = 1;
  while (size < count * 2) size <<= 1;
  const table = new Int32Array(size).fill(-1), index = new Uint32Array(count);
  const p = new Float32Array(positions.length), n = new Float32Array(normals.length), t = new Float32Array(uv.length);
  let unique = 0;
  for (let i = 0; i < count; i++) {
    const a = bits[i * 3], b = bits[i * 3 + 1], c = bits[i * 3 + 2];
    let slot = (Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) & (size - 1), j;
    for (;;) {
      j = table[slot];
      if (j < 0) {
        j = table[slot] = unique++;
        p[j * 3] = positions[i * 3]; p[j * 3 + 1] = positions[i * 3 + 1]; p[j * 3 + 2] = positions[i * 3 + 2];
        n[j * 3] = normals[i * 3]; n[j * 3 + 1] = normals[i * 3 + 1]; n[j * 3 + 2] = normals[i * 3 + 2];
        t[j * 2] = uv[i * 2]; t[j * 2 + 1] = uv[i * 2 + 1];
        break;
      }
      const pj = new Uint32Array(p.buffer, j * 12, 3);
      if (pj[0] === a && pj[1] === b && pj[2] === c) break;
      slot = (slot + 1) & (size - 1);
    }
    index[i] = j;
  }
  return { positions: p.slice(0, unique * 3), normals: n.slice(0, unique * 3), uv: t.slice(0, unique * 2), index };
}

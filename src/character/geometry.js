import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { createTorsoSampler } from './sections.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));

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
  if (M.lm.crotchY > H * .59 || M.lm.crotchY < H * .30) throw new Error('This inseam-to-height combination is outside the procedural preview range. Fit measurements are still saved.');
  const halfWidth = Math.max(M.jointR.x + Math.sin(M.lm.armAngle) * (M.lm.armLen + H * .11) + H * .06, M.profileAt(M.lm.hipY).rx + 8);
  const halfDepth = Math.max(H * .15, M.profileAt(M.lm.hipY).rz + 8);
  const min = [-halfWidth, -3, -halfDepth], max = [halfWidth, H + 3, halfDepth];
  const span = max.map((v, i) => v - min[i]), spacing = span.map(v => v / resolution);
  const material = new THREE.MeshBasicMaterial();
  const marcher = new MarchingCubes(resolution, material, false, false, 150000);
  marcher.isolation = 0; marcher.field.fill(-1000);
  const field = marcher.field, N = resolution, N2 = N * N;
  const coords = span.map((_, axis) => Float32Array.from({ length: N }, (__, i) => min[axis] + i * spacing[axis]));
  function union(boundsMin, boundsMax, distance, blend = .85) {
    const start = boundsMin.map((v, i) => clamp(Math.floor((v - min[i] - blend) / spacing[i]), 1, N - 3));
    const end = boundsMax.map((v, i) => clamp(Math.ceil((v - min[i] + blend) / spacing[i]), 2, N - 2));
    for (let iz = start[2]; iz <= end[2]; iz++) for (let iy = start[1]; iy <= end[1]; iy++) for (let ix = start[0]; ix <= end[0]; ix++) {
      const index = iz * N2 + iy * N + ix;
      const d = -distance(coords[0][ix], coords[1][iy], coords[2][iz]);
      const old = field[index], h = Math.max(blend - Math.abs(old - d), 0) / blend;
      field[index] = Math.max(old, d) + h * h * blend * .25;
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
      if (sole) d = Math.max(d, .12 - y);
      return d;
    }, blend);
  }
  const sampler = createTorsoSampler(M, character);
  union([-sampler.maxRadius - 2, sampler.low, -sampler.maxRadius - 2], [sampler.maxRadius + 2, sampler.high, sampler.maxRadius + 2], (x, y, z) => {
    const bottom = M.lm.crotchY - 3;
    const cap = y < M.lm.hipY ? Math.sqrt(Math.max(0, 1 - ((M.lm.hipY-y)/(M.lm.hipY-bottom)) ** 2)) : 1;
    const radial = Math.hypot(x, z) - sampler.radius(y, Math.atan2(x, z)) * cap;
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
    ellipsoid([axisX, H * .013, H * .027], [H * .021, H * .020, H * .071], 0, .8, true);

    const joint = side < 0 ? M.jointL : M.jointR;
    const dx = side * Math.sin(M.lm.armAngle), dy = -Math.cos(M.lm.armAngle);
    const tip = [joint.x + dx * M.lm.armLen, joint.y + dy * M.lm.armLen, 0];
    const armRadius = M.upperR * 1.45;
    union([Math.min(joint.x, tip[0]) - armRadius, tip[1] - armRadius, -armRadius], [Math.max(joint.x, tip[0]) + armRadius, joint.y + armRadius, armRadius], (x, y, z) => {
      const px = x - joint.x, py = y - joint.y;
      const t = px * dx + py * dy, u = px * -dy + py * dx;
      const tc = clamp(t, 0, M.lm.armLen);
      const r = smoothRadius(M.arm, tc, 't', 'r') * (1 + .10 * bell(tc / M.lm.armLen, .04, .13));
      return (Math.hypot(u / r, z / (r * .96), (t - tc) / r) - 1) * r;
    }, 1.15);
    // Palm, fingers, thumb and wrist are blended into the same watertight mesh.
    const at = (t, offset = 0) => [joint.x + dx * t + side * offset, joint.y + dy * t, 0];
    const angle = side * M.lm.armAngle;
    ellipsoid(at(M.lm.armLen + H * .026), [H * .020, H * .032, H * .0085], angle, .55);
    for (let finger = 0; finger < 4; finger++) {
      const offset = (finger - 1.5) * H * .008;
      const length = H * (.025 - Math.abs(finger - 1.3) * .0025);
      ellipsoid(at(M.lm.armLen + H * .067 - Math.abs(finger - 1.3) * .3, offset), [H * .0042, length, H * .0051], angle, .25);
    }
    const thumb = at(M.lm.armLen + H * .035, -H * .024);
    ellipsoid(thumb, [H * .006, H * .019, H * .006], -side * .45, .4);
  }
  // A neutral integrated head/jaw; face customization is explicitly deferred.
  const headY = H * .939, headR = H * .061;
  union([-headR, headY - headR * 1.15, -headR], [headR, H + .1, headR], (x, y, z) => {
    const v = (y - headY) / headR;
    const jaw = v < -.20 ? .88 + .12 * clamp((v + 1) / .8, 0, 1) : 1;
    const rx = headR * .76 * jaw, rz = headR * .84;
    const vertical = v < 0 ? -Math.pow(-v, 1.4) : v;
    return (Math.hypot(x / rx, vertical, (z - .35) / rz) - 1) * Math.min(rx, rz);
  }, 1.0);
  for (const side of [-1, 1]) ellipsoid([side * headR * .735, headY - headR * .02, .05], [headR * .14, headR * .26, headR * .16], 0, .45);

  marcher.update();
  const count = marcher.count;
  if (!count || count > 450000) throw new Error('The procedural body could not be meshed within its geometry budget.');
  const positions = marcher.positionArray.slice(0, count * 3), normals = marcher.normalArray.slice(0, count * 3), uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) positions[i * 3 + axis] = min[axis] + (positions[i * 3 + axis] + 1) * .5 * span[axis];
    const nx = normals[i * 3] / span[0], ny = normals[i * 3 + 1] / span[1], nz = normals[i * 3 + 2] / span[2];
    const length = Math.hypot(nx, ny, nz) || 1;
    normals.set([nx / length, ny / length, nz / length], i * 3);
    uv[i * 2] = .5 + Math.atan2(positions[i * 3], positions[i * 3 + 2]) / (Math.PI * 2);
    uv[i * 2 + 1] = positions[i * 3 + 1] / H;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.source = 'procedural-fallback';
  marcher.geometry.dispose(); material.dispose();
  return geometry;
}

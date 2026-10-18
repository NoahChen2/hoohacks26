import * as THREE from 'three';
import { presentationPoint } from './presentation.js';

// A light skeleton for the procedural body. Bones sit at presented (rendered)
// landmarks; legs stay planted on the root. Garments inherit the weights of the
// skin beneath them, so cloth and body share one deformation and cannot drift
// apart or intersect as the figure moves. Poses are presentation only: rest pose
// is exact and every fit calculation uses the unposed measurements.

export const BONES = ['root', 'spine', 'head', 'armL', 'foreL', 'armR', 'foreR', 'hem'];
const PARENT = { spine: 'root', head: 'spine', armL: 'spine', foreL: 'armL', armR: 'spine', foreR: 'armR', hem: 'root' };
const B = Object.fromEntries(BONES.map((name, i) => [name, i]));
const W = BONES.length;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const limbOf = (w, o = 0) => w[o + B.armL] + w[o + B.foreL] + w[o + B.armR] + w[o + B.foreR];

// Skin weights as a field over the measured body (centimetres, before
// presentation). Pure, so the body worker can bake it off the main thread.
export function bodyWeightField(model, sampler) {
  const lm = model.lm, r = model.upperR, neckR = model.neckR;
  const arms = [model.jointL, model.jointR].map((joint, k) => {
    const side = k ? 1 : -1;
    return { x: joint.x, y: joint.y, dx: side * Math.sin(lm.armAngle), dy: -Math.cos(lm.armAngle), elbowT: lm.wristT * .47, arm: k ? B.armR : B.armL, fore: k ? B.foreR : B.foreL };
  });
  return (x, y, z, out) => {
    out.fill(0);
    const a = arms[x < 0 ? 0 : 1], qx = x - a.x, qy = y - a.y;
    const t = qx * a.dx + qy * a.dy, d = Math.hypot(qx - a.dx * t, qy - a.dy * t, z);
    let arm = smooth(-.7 * r, .8 * r, t) * (1 - smooth(1.35 * r, 2.1 * r, d)) * smooth(0, 3, Math.abs(x));
    // Below the shoulder, skin on the torso surface itself (the flank under a
    // hanging arm) stays with the torso rather than lifting with the arm.
    if (arm > 0 && sampler && y < a.y - .5 * r && y > sampler.low && y < sampler.high) {
      const torso = sampler.radius(y, Math.atan2(x, z));
      arm *= smooth(torso * .98, torso * 1.06 + .8, Math.hypot(x, z));
    }
    const fore = smooth(a.elbowT - 3, a.elbowT + 3, t), rest = 1 - arm;
    // Around the neck only skin near its axis follows the head; above the neck
    // everything does, so wide hair volumes (curls) turn with the head.
    const radial = 1 - smooth(neckR * 1.3, neckR * 2.2, Math.hypot(x, z + 1));
    const head = smooth(lm.neckBaseY + 1, lm.neckTopY + 3, y) * (radial + (1 - radial) * smooth(lm.neckTopY + 3, lm.neckTopY + 8, y)) * rest;
    const spine = smooth(lm.hipY - 6, lm.waistY + 6, y) * (rest - head);
    out[B.root] = rest - head - spine; out[B.spine] = spine; out[B.head] = head;
    out[a.arm] = arm * (1 - fore); out[a.fore] = arm * fore;
    return out;
  };
}

export function bakeBodyWeights(positions, field) {
  const n = positions.length / 3, all = new Float32Array(n * W), w = new Float32Array(W);
  for (let i = 0; i < n; i++) all.set(field(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], w), i * W);
  return all;
}

// Four largest influences per vertex, normalized.
export function packSkin(all) {
  const n = all.length / W, index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  const top = [0, 0, 0, 0], value = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const o = i * W;
    let count = 0;
    for (let b = 0; b < W; b++) {
      const v = all[o + b];
      if (v <= 1e-4 || (count === 4 && v <= value[3])) continue;
      let k = Math.min(count, 3);
      while (k > 0 && value[k - 1] < v) { top[k] = top[k - 1]; value[k] = value[k - 1]; k--; }
      top[k] = b; value[k] = v; count = Math.min(count + 1, 4);
    }
    if (!count) { weight[i * 4] = 1; continue; }
    let total = 0;
    for (let k = 0; k < count; k++) total += value[k];
    for (let k = 0; k < count; k++) { index[i * 4 + k] = top[k]; weight[i * 4 + k] = value[k] / total; }
  }
  return { index, weight };
}

function writeSkin(geometry, all) {
  const { index, weight } = packSkin(all);
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
}

export function createRig(model, proportions, sampler) {
  const lm = model.lm;
  const P = (x, y, z = 0) => new THREE.Vector3(...presentationPoint(x, y, z, model, proportions));
  const world = { root: new THREE.Vector3(), spine: P(0, lm.hipY + 2), head: P(0, lm.neckBaseY + 1.5, -1), hem: new THREE.Vector3() };
  for (const [key, side, joint] of [['L', -1, model.jointL], ['R', 1, model.jointR]]) {
    const elbowT = lm.wristT * .47;
    world['arm' + key] = P(joint.x, joint.y);
    world['fore' + key] = P(joint.x + side * Math.sin(lm.armAngle) * elbowT, joint.y - Math.cos(lm.armAngle) * elbowT);
  }
  const levels = { chest: P(0, lm.chestY).y, waist: P(0, lm.waistY).y };
  const bones = Object.fromEntries(BONES.map(name => { const bone = new THREE.Bone(); bone.name = name; return [name, bone]; }));
  for (const name of BONES) {
    const parent = PARENT[name];
    bones[name].position.copy(world[name]);
    if (parent) { bones[name].position.sub(world[parent]); bones[parent].add(bones[name]); }
  }
  // Arms: abduct (z), then swing forward (x), then turn across the body (y).
  for (const name of ['armL', 'armR']) bones[name].rotation.order = 'YXZ';
  // Fallback for cloth with no skin nearby; presented and measured space differ
  // only by the cosmetic proportion sliders.
  const field = bodyWeightField(model, sampler);

  const root = bones.root;
  const rig = {
    bones, root, skeleton: null, skinGrid: () => null,
    // Call once the root is in the scene graph, before binding any mesh.
    attach(parent) {
      parent.add(root);
      parent.updateMatrixWorld(true);
      rig.skeleton = new THREE.Skeleton(BONES.map(name => bones[name]));
    },
    // `weights` may come pre-baked from the body worker (one row per vertex).
    skinBody(geometry, weights = null) {
      const p = geometry.attributes.position;
      if (!weights) weights = bakeBodyWeights(p.array, field);
      if (!geometry.attributes.skinIndex) writeSkin(geometry, weights);
      // The lookup grid is only needed for garment transfer; build it on demand.
      let grid = null;
      rig.skinGrid = () => grid ||= buildSkinGrid(p.array, geometry.attributes.normal.array, weights);
    },
    // Copies the weights of the nearest skin and lifts cloth that lies behind
    // that skin out to `clearance` along its normal. Sleeves bind to arm skin;
    // everything else ignores it, since a hanging arm is often the closest skin
    // to a loose side seam. `lift` lets a top's hem ride up. Without `transfer`
    // only the analytic field is used: instant, for previews while dragging.
    skinGarment(geometry, { lift = false, clearance = .45, arms = false, transfer = true } = {}) {
      const p = geometry.attributes.position, a = p.array, n = p.count, all = new Float32Array(n * W), w = new Float32Array(W);
      const skin = transfer ? rig.skinGrid() : null, filter = arms ? ARM : TORSO;
      let moved = false;
      for (let i = 0; i < n; i++) {
        let x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2], near = -1;
        // Creases such as the armpit can need more than one push.
        for (let pass = 0; pass < 4 && skin; pass++) {
          near = nearestSkin(skin, x, y, z, filter, w);
          if (near < 0) break;
          const o = near * 3, N = skin.normal, S = skin.position;
          const depth = (x - S[o]) * N[o] + (y - S[o + 1]) * N[o + 1] + (z - S[o + 2]) * N[o + 2];
          if (depth >= clearance - .01) break;
          x += N[o] * (clearance - depth); y += N[o + 1] * (clearance - depth); z += N[o + 2] * (clearance - depth);
          a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z; moved = true;
        }
        if (near < 0) {
          field(x, y, z, w);
          if (!arms) { w[B.root] += limbOf(w); w[B.armL] = w[B.foreL] = w[B.armR] = w[B.foreR] = 0; }
        }
        if (lift) {
          const hem = Math.min(w[B.root], smooth(levels.chest - 2, levels.waist - 14, y));
          w[B.root] -= hem; w[B.hem] += hem;
        }
        all.set(w, i * W);
      }
      writeSkin(geometry, all);
      if (moved) {
        p.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      }
    },
    bind(mesh) {
      mesh.frustumCulled = false;
      // The renderer otherwise skins every vertex on the CPU to depth-sort a new mesh.
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      mesh.boundingSphere = mesh.geometry.boundingSphere.clone();
      mesh.bind(rig.skeleton, mesh.matrixWorld);
    },
    pose(time) { applyPose(rig, time); },
    rest() { for (const name of BONES) bones[name].rotation.set(0, 0, 0); bones.hem.position.set(0, 0, 0); },
  };
  return rig;
}

// ------------------------------------------------------------- skin lookup grid

const CELL = 2, MAX_RING = 10, BLEND = 1.5, CANDIDATES = 512;
const ANY = 0, TORSO = 1, ARM = 2;
const candidate = new Uint32Array(CANDIDATES), candidateD = new Float32Array(CANDIDATES);

// Flat cell lists (counting sort) over the welded body surface.
function buildSkinGrid(position, normal, weights) {
  const n = position.length / 3, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 3; i++) { const k = i % 3; if (position[i] < min[k]) min[k] = position[i]; if (position[i] > max[k]) max[k] = position[i]; }
  const dim = min.map((v, k) => Math.floor((max[k] - v) / CELL) + 1);
  const cell = new Uint32Array(n), start = new Uint32Array(dim[0] * dim[1] * dim[2] + 1);
  for (let i = 0; i < n; i++) {
    const c = Math.floor((position[i * 3] - min[0]) / CELL) + dim[0] * (Math.floor((position[i * 3 + 1] - min[1]) / CELL) + dim[1] * Math.floor((position[i * 3 + 2] - min[2]) / CELL));
    cell[i] = c; start[c + 1]++;
  }
  for (let c = 0; c < start.length - 1; c++) start[c + 1] += start[c];
  const fill = start.slice(), order = new Uint32Array(n), xyz = new Float32Array(n * 3), limb = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const e = fill[cell[i]]++;
    order[e] = i; xyz[e * 3] = position[i * 3]; xyz[e * 3 + 1] = position[i * 3 + 1]; xyz[e * 3 + 2] = position[i * 3 + 2];
    limb[i] = limbOf(weights, i * W);
  }
  return { min, dim, start, order, xyz, limb, weights, position, normal };
}

const accepts = (filter, limb) => filter === ANY || (filter === TORSO ? limb <= .85 : limb >= .3);

// Returns the nearest skin vertex (any region) and writes an inverse-distance
// blend of the weights of the nearest acceptable skin into `out`. One pass over
// growing shells of cells; blend candidates are collected on the way.
function nearestSkin(g, x, y, z, filter, out) {
  const cx = Math.floor((x - g.min[0]) / CELL), cy = Math.floor((y - g.min[1]) / CELL), cz = Math.floor((z - g.min[2]) / CELL);
  const [nx, ny, nz] = g.dim, { start, order, xyz, limb, weights } = g;
  let near = -1, nearD = Infinity, best = -1, bestD = Infinity, keep = Infinity, count = 0;
  for (let ring = 0; ring <= MAX_RING; ring++) {
    for (let k = Math.max(cz - ring, 0); k <= Math.min(cz + ring, nz - 1); k++) {
      const faceK = Math.abs(k - cz) === ring;
      for (let j = Math.max(cy - ring, 0); j <= Math.min(cy + ring, ny - 1); j++) {
        const faceJ = faceK || Math.abs(j - cy) === ring, row = nx * (j + ny * k);
        for (let i = Math.max(cx - ring, 0); i <= Math.min(cx + ring, nx - 1); i++) {
          // Inside the shell only its two x faces are new.
          if (!faceJ && i !== cx - ring && i !== cx + ring) { i = cx + ring - 1; continue; }
          for (let e = start[i + row], end = start[i + row + 1]; e < end; e++) {
            const dx = xyz[e * 3] - x, dy = xyz[e * 3 + 1] - y, dz = xyz[e * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
            const v = order[e];
            if (d < nearD) { nearD = d; near = v; }
            if (d > keep || !accepts(filter, limb[v])) continue;
            if (d < bestD) { bestD = d; best = v; keep = (Math.sqrt(d) + BLEND) ** 2; }
            if (count < CANDIDATES) { candidate[count] = v; candidateD[count++] = d; }
          }
        }
      }
    }
    // Everything within ring * CELL of the query point has now been visited.
    if (near >= 0 && best >= 0 && Math.sqrt(bestD) + BLEND <= ring * CELL) break;
    // No acceptable skin close by: fall back to the nearest skin of any kind.
    if (near >= 0 && best < 0 && ring * CELL > Math.sqrt(nearD) + 12) break;
  }
  if (near < 0) return -1;
  out.fill(0);
  if (best < 0) { for (let b = 0; b < W; b++) out[b] = weights[near * W + b]; return near; }
  const base = Math.sqrt(bestD);
  let total = 0;
  for (let c = 0; c < count; c++) {
    if (candidateD[c] > keep) continue;
    const v = candidate[c], f = 1 / (Math.sqrt(candidateD[c]) - base + .4) ** 2;
    for (let b = 0; b < W; b++) out[b] += weights[v * W + b] * f;
    total += f;
  }
  for (let b = 0; b < W; b++) out[b] /= total;
  return near;
}

// -------------------------------------------------------------------- animation

const wave = (t, rate, amount, phase = 0) => amount * Math.sin(t * rate + phase);
// Euler rotations in radians per bone, in the rest frame. Positive z raises the
// right arm sideways (negative for the left); negative x swings limbs forward.
export const CLIPS = [
  { name: 'Idle', pose: t => ({
    spine: [0, wave(t, .9, .07), wave(t, 1.3, .025)], head: [wave(t, 1.1, .04), wave(t, .6, .14), 0],
    armL: [wave(t, 1.3, .06), 0, -.05 - wave(t, 1.3, .03)], armR: [wave(t, 1.3, -.06), 0, .05 + wave(t, 1.3, .03)],
    foreL: [-.15, 0, 0], foreR: [-.15, 0, 0] }) },
  { name: 'Wave', pose: t => ({
    armR: [-.2, 0, 1.25], foreR: [0, 0, 1.45 + wave(t, 7, .38)], armL: [0, 0, -.08], foreL: [-.2, 0, 0],
    head: [.05, .2, -.1], spine: [0, .08, -.05] }) },
  { name: 'Stretch', lift: 6, pose: t => ({
    armL: [-.1, 0, -2.65], armR: [-.1, 0, 2.65], foreL: [0, 0, -.55], foreR: [0, 0, .55],
    spine: [-.05, 0, wave(t, 1.4, .07)], head: [-.18, 0, wave(t, 1.4, -.05)] }) },
  { name: 'Twist', pose: t => ({
    spine: [0, wave(t, 1.6, .42), 0], head: [0, wave(t, 1.6, .3, -.5), 0],
    armL: [wave(t, 1.6, .3), 0, -.18], armR: [wave(t, 1.6, .3), 0, .18], foreL: [-.6, 0, 0], foreR: [-.6, 0, 0] }) },
  { name: 'Check sleeve', pose: t => ({
    armR: [-.95, -.35, .25], foreR: [-1.05, wave(t, 1.2, .2), 0], armL: [-.1, 0, -.1], foreL: [-.2, 0, 0],
    head: [.32, .38, 0], spine: [.04, .12, 0] }) },
  { name: 'Shrug', pose: t => {
    const k = .5 + wave(t, 2.2, .5);
    return { armL: [-.25, 0, -.45 - .1 * k], armR: [-.25, 0, .45 + .1 * k], foreL: [-1.35, .3, 0], foreR: [-1.35, -.3, 0],
      head: [.05, 0, .12 * k], spine: [0, 0, wave(t, 1.1, .03)] };
  } },
];
const HOLD = 4.5, CROSSFADE = 1.1;

function applyPose(rig, time) {
  const cycle = CLIPS.length * HOLD, local = time % cycle, index = Math.floor(local / HOLD), into = local - index * HOLD;
  const a = CLIPS[index], b = CLIPS[(index + 1) % CLIPS.length];
  const mix = smooth(HOLD - CROSSFADE, HOLD, into), pa = a.pose(time), pb = b.pose(time);
  for (const name of BONES) {
    const ra = pa[name] || [0, 0, 0], rb = pb[name] || [0, 0, 0];
    rig.bones[name].rotation.set(ra[0] + (rb[0] - ra[0]) * mix, ra[1] + (rb[1] - ra[1]) * mix, ra[2] + (rb[2] - ra[2]) * mix);
  }
  rig.bones.hem.position.set(0, (a.lift || 0) * (1 - mix) + (b.lift || 0) * mix, 0);
  rig.clip = mix < .5 ? a.name : b.name;
}

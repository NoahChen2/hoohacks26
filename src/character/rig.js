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
    pose(time, options) { applyPose(rig, time, options); },
    rest() { for (const name of BONES) bones[name].rotation.set(0, 0, 0); bones.hem.position.set(0, 0, 0); root.position.set(0, 0, 0); },
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

// ----------------------------------------------------------------------- dances

// One-shot emotes played over the idle cycle. Legs have no bones, so dances move
// the root instead: `hop` lifts the whole figure (cm) and root rotations rock or
// spin it about the feet. `lift` rides a top's hem up, as in Stretch. Root yaw
// must be back at a whole turn before the dance blends out, or it unwinds.
const TAU = Math.PI * 2;
// A sine squashed toward ±1: moves that snap to a side and hold there.
const pump = (t, rate, phase = 0) => Math.tanh(3 * Math.sin(t * rate + phase)) / Math.tanh(3);
const hops = (t, rate, height) => height * Math.abs(Math.sin(t * rate));
const turn = a => Math.atan2(Math.sin(a), Math.cos(a));
const SIDES = { armL: 'armR', armR: 'armL', foreL: 'foreR', foreR: 'foreL' };
// The same pose for the other side: swap limbs, reflect across the midline.
function mirror(pose) {
  const out = {};
  for (const [key, value] of Object.entries(pose)) out[SIDES[key] || key] = Array.isArray(value) ? [value[0], -value[1], -value[2]] : value;
  return out;
}
function blendPose(a, b, k) {
  const out = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const va = a[key] ?? (Array.isArray(b[key]) ? [0, 0, 0] : 0), vb = b[key] ?? (Array.isArray(a[key]) ? [0, 0, 0] : 0);
    out[key] = Array.isArray(va) ? va.map((v, i) => v + (vb[i] - v) * k) : va + (vb - va) * k;
  }
  return out;
}
// Hits a new frame on every beat, snapping in over the first `snap` of it.
function keyed(t, bpm, frames, snap = .3, loop = false) {
  const b = t * bpm / 60, i = Math.floor(b), n = frames.length;
  const at = k => frames[loop ? k % n : Math.min(k, n - 1)];
  return blendPose(at(Math.max(i - 1, 0)), at(i), smooth(0, snap, b - i));
}

const DISCO_UP = { armR: [-.3, 0, 2.45], head: [-.28, -.35, .12], spine: [-.04, -.1, -.1], root: [0, 0, .04], lift: 3 };
const DISCO_DOWN = { armR: [-.02, -2.1, .49], foreR: [-.34, 0, 0], head: [.28, .25, 0], spine: [.1, .15, .08], root: [0, 0, -.04] };
const DISCO_HIP = { armL: [.25, 0, -.6], foreL: [-.35, 0, 1.25] };

const ROBOT_READY = { armL: [0, 0, -.12], foreL: [-1.57, 0, 0], armR: [0, 0, .12], foreR: [-1.57, 0, 0] };
const ROBOT_ZIGZAG = { armR: [0, 0, 1.45], foreR: [0, 0, 1.57], armL: [0, 0, -1.45], foreL: [0, 0, 1.57], head: [0, .55, 0], lift: 2 };

// Right-arm moves; each beat of the Macarena does one, then the left mirrors it.
const MAC_OUT = { armR: [-1.5, 0, .08], foreR: [0, 0, 0] };
const MAC_SHOULDER = { armR: [-.07, -1.66, .86], foreR: [-1.98, 0, -.13] };
const MAC_HEAD = { armR: [-.36, -.55, 2.45], foreR: [-2.63, 0, .77] };
const MAC_HIP = mirror(DISCO_HIP);
const MAC = [
  { ...MAC_OUT, armL: [-.05, 0, -.08], foreL: [-.15, 0, 0] },
  mirror(MAC_OUT),
  MAC_SHOULDER,
  mirror(MAC_SHOULDER),
  { ...MAC_HEAD, lift: 2 },
  { ...mirror(MAC_HEAD), lift: 4 },
  { ...MAC_HIP, lift: 0 },
  mirror(MAC_HIP),
  { root: [0, 0, .08], spine: [0, 0, -.14], head: [0, 0, .1] },
  { root: [0, 0, -.08], spine: [0, 0, .14], head: [0, 0, -.1] },
  { root: [0, 0, .08], spine: [0, 0, -.14], head: [0, 0, .1] },
  { root: [0, 0, 0], spine: [0, 0, 0], head: [-.2, 0, 0], armR: [-.2, 0, 2.3], foreR: [0, 0, 0], armL: [-.2, 0, -2.3], foreL: [0, 0, 0], lift: 5 },
];
// Each Macarena beat changes one arm; the rest of the pose carries over.
for (let i = 1; i < MAC.length - 1; i++) MAC[i] = { ...MAC[i - 1], ...MAC[i] };

// The bent arm crosses in front of the face, forearm parallel to the straight one.
const DAB = { armR: [-.25, 0, 2.15], foreR: [0, 0, 0], armL: [-2.96, -.8, 1.21], foreL: [-.93, 0, 0], head: [.5, -.15, .35], spine: [.18, -.22, .1], lift: 3 };
const DAB_READY = { armR: [-.3, 0, .2], foreR: [-1.1, 0, 0], armL: [-.3, 0, -.2], foreL: [-1.1, 0, 0], spine: [0, 0, 0] };

// Arm poses solved against the body: hand and elbow land where named.
const both = pose => ({ ...pose, ...mirror(pose) }); // a right-arm pose on both sides
const CHEST = { armR: [.79, -1.8, -.07], foreR: [-2.74, 0, .21] };
const CLAP = { armR: [.69, -1.73, .59], foreR: [-1.73, 0, .97] };
const CLAP_OPEN = { armR: [-.26, -.85, .43], foreR: [-1.59, 0, 1.09] };
const HANDS_MEET = { armR: [-.08, -1.75, 2.85], foreR: [-.52, 0, -.14] };
const ON_HEAD = { armR: [-.2, -.33, 2.39], foreR: [-1.93, 0, .93] };
const OVER_TOP = { armR: [.09, -1.74, 2.74], foreR: [-1.02, 0, -.27] };
const FRET = mirror({ armR: [-.43, .36, .1], foreR: [-1.31, 0, -.14] });
const STRUM = { armR: [.44, -1.7, -.33], foreR: [-1.86, 0, .59] };
const CART = { armR: [-.19, -.83, .26], foreR: [-1.22, 0, .3] };
const FISTS = { armR: [.23, -1.04, .29], foreR: [-2.12, 0, .14] };
const FIST_LOW = { armR: [.46, -.28, 1.17], foreR: [-2.7, 0, .4] };
const CLAW = { armR: [-.64, 0, .95], foreR: [-2.1, 0, 0] };
const onBeat = (t, bpm, height) => hops(t, Math.PI * bpm / 60, height);

const GORILLA_OUT = mirror({ armR: [-.5, -.2, .55], foreR: [-1.4, 0, .5] });
const GORILLA = { ...CHEST, ...GORILLA_OUT, spine: [.25, -.1, 0], head: [-.25, 0, 0] };
const REACH_CORD = { armR: [-.9, -.25, .1], foreR: [0, 0, 0], armL: [-.3, 0, -.15], foreL: [-.5, 0, 0], spine: [.45, -.2, 0], head: [.2, 0, 0] };
const YANK = { ...REACH_CORD, armR: [.75, 0, .25], foreR: [-1.6, 0, 0], spine: [.05, .35, 0], head: [-.1, .2, 0] };
const MOW = { ...both(CART), spine: [.12, 0, 0], head: [0, 0, 0] };
const SHELF = { armR: [-.6, 0, 1.9], foreR: [0, 0, .2], head: [-.25, .3, 0], spine: [-.05, .15, 0] };
const PUSH = { ...both(CART), spine: [.1, 0, 0], head: [0, 0, 0] };
const EGYPT = { armR: [-.35, 0, 1.4], foreR: [0, 0, 1.57], armL: [-.15, 0, -1.4], foreL: [0, 0, 1.57], root: [0, .6, 0] };

export const DANCES = [
  { name: 'Floss', emoji: '🦷', seconds: 5, pose: t => {
    const s = pump(t, 7.2);
    return { armR: [.4 * s, 0, .22 + .56 * s], armL: [-.4 * s, 0, -.22 + .56 * s], foreR: [-.05, 0, 0], foreL: [-.05, 0, 0],
      spine: [.04, .12 * s, -.14 * s], root: [0, 0, .05 * s], head: [0, -.15 * s, .12 * s], hop: hops(t, 7.2, 1.6) };
  } },
  { name: 'Funky Chicken', emoji: '🐔', seconds: 5.5, pose: t => {
    const flap = .5 + .5 * pump(t, 11), peck = Math.max(0, Math.sin(t * 4.6)), tail = smooth(2.8, 3.2, t) * wave(t, 13, .09);
    return { armR: [.65, -.21, .3 + .55 * flap], armL: [.65, .21, -.3 - .55 * flap], foreR: [-2.8, 0, -.2], foreL: [-2.8, 0, .2],
      spine: [.22 + .08 * peck, wave(t, 2.3, .12), tail], head: [-.25 + .55 * peck, 0, wave(t, 2.3, .1)], root: [.04, 0, -tail * .6], hop: hops(t, 4.6, 2.2) };
  } },
  { name: 'Disco', emoji: '🪩', seconds: 5.4, pose: t => ({ ...DISCO_HIP, ...keyed(t, 112, [DISCO_UP, DISCO_DOWN], .25, true), hop: onBeat(t, 112, 1.5) }) },
  { name: 'Tube Man', emoji: '🎈', seconds: 6, pose: t => ({
    armR: [wave(t, 5.3, .6) + wave(t, 8.1, .3), wave(t, 3.7, .4), 1.5 + wave(t, 6.1, .9) + wave(t, 9.7, .3)],
    armL: [wave(t, 4.7, .6, 1) + wave(t, 7.7, .3), wave(t, 3.1, .4, 2), -1.5 - wave(t, 5.6, .9, 2) - wave(t, 10.3, .3)],
    foreR: [wave(t, 7.2, .8), 0, .4 + wave(t, 6.1, 1.1, 1)], foreL: [wave(t, 6.8, .8, 2), 0, -.4 - wave(t, 5.9, 1.1, 3)],
    spine: [.05 + wave(t, 3.1, .18), wave(t, 2.3, .3), wave(t, 4.3, .22)], head: [wave(t, 5.5, .3), wave(t, 3.3, .5), wave(t, 6.6, .35)],
    root: [wave(t, 2.7, .05), 0, wave(t, 3.4, .07)], hop: hops(t, 3.9, 2.5), lift: 5 }) },
  { name: 'Robot', emoji: '🤖', seconds: 6.4, pose: t => keyed(t, 120, [
    ROBOT_READY,
    ROBOT_ZIGZAG,
    mirror(ROBOT_ZIGZAG),
    { ...ROBOT_READY, spine: [0, .45, 0], head: [0, -.45, 0] },
    { ...ROBOT_READY, spine: [0, -.45, 0], head: [0, .45, 0] },
    { armR: [-1.5, 0, .1], armL: [-1.5, 0, -.1], head: [.2, 0, .25] },
    { armR: [-1.5, 0, .1], armL: [-1.5, 0, -.1], head: [.2, 0, -.25], root: [.04, 0, 0] },
  ], .12, true) },
  { name: 'Macarena', emoji: '💃', seconds: 7.4, pose: t => {
    // A jump on the last beat.
    const jump = smooth(0, 1, t * 105 / 60 - 11);
    return { ...keyed(t, 105, MAC, .35), hop: 9 * Math.sin(Math.PI * jump) };
  } },
  { name: 'Dab', emoji: '😎', seconds: 4.6, pose: t => ({ ...keyed(t, 96, [DAB_READY, DAB, DAB, DAB_READY, mirror(DAB), mirror(DAB), DAB_READY], .18), hop: onBeat(t, 96, 2) }) },
  { name: 'Spin Out', emoji: '🌀', seconds: 4.4, pose: t => {
    const spin = smooth(.55, 2.7, t), ta = smooth(2.75, 3.05, t), wobble = wave(t, 9, .15) * (1 - ta);
    const tPose = { armR: [-.1, 0, 1.45 + wobble], armL: [-.1, 0, -1.45 + wobble], head: [-.15, 0, wave(t, 5, .1)], spine: [-.04, 0, 0] };
    const tada = { armR: [-.15, 0, 2.3], armL: [-.15, 0, -2.3], head: [-.3, 0, 0], spine: [-.08, 0, 0], lift: 4 };
    return { ...blendPose(tPose, tada, ta), root: [0, turn(spin * 3 * TAU), 0], hop: 10 * Math.sin(Math.PI * spin) };
  } },
  { name: 'Raise the Roof', emoji: '🙌', seconds: 5, pose: t => {
    const p = .5 + .5 * pump(t, TAU * 100 / 60);
    return { ...both({ armR: [-.15, 0, 1.15 + .4 * p], foreR: [0, 0, 1.5 - .3 * p] }), spine: [-.05, 0, wave(t, 2.6, .06)], head: [-.15 * p, 0, 0], hop: onBeat(t, 100, 2), lift: 3 * p };
  } },
  { name: 'YMCA', emoji: '🔠', seconds: 6, pose: t => keyed(t, 126, [
    { ...both({ armR: [-.1, 0, 2.4], foreR: [0, 0, 0] }), lift: 4 },
    { ...both({ armR: [-.1, 0, 2.4], foreR: [0, 0, 0] }), lift: 4, head: [-.2, 0, 0] },
    { ...both(ON_HEAD), lift: 4 },
    { ...OVER_TOP, armL: [-.1, 0, -.9], foreL: [0, 0, -.6], spine: [0, 0, .12], lift: 4 },
    { ...both(HANDS_MEET), lift: 5 },
    { ...both(HANDS_MEET), lift: 5, head: [-.25, 0, 0] },
  ], .3, true) },
  { name: 'Sprinkler', emoji: '💦', seconds: 6, pose: t => ({
    ...mirror(MAC_HEAD), armR: [-1.45, 0, .2], foreR: [0, 0, 0], lift: 2,
    ...keyed(t, 240, [0, .15, .3, .45, .6, .3, 0, -.15, -.3, -.45, -.6, -.3].map(y => ({ root: [0, y, 0], spine: [0, y * .3, 0] })), .5, true),
    hop: onBeat(t, 240, .8) }) },
  { name: 'Shopping Cart', emoji: '🛒', seconds: 6.5, pose: t => keyed(t, 110, [PUSH, { ...PUSH, hop: 2 }, { ...PUSH, ...SHELF }, PUSH, { ...PUSH, hop: 2 }, { ...PUSH, ...mirror(SHELF) }], .3, true) },
  { name: 'Lawnmower', emoji: '🌱', seconds: 6, pose: t => {
    const running = smooth(3.4, 3.7, t);
    return { ...keyed(t, 100, [REACH_CORD, YANK, REACH_CORD, YANK, REACH_CORD, YANK, MOW], .25), hop: running * hops(t, 31, .7), lift: 2 * running };
  } },
  { name: 'Swim', emoji: '🏊', seconds: 6, pose: t => {
    // Four whole strokes, so both arms finish hanging; the left arm trails half a stroke.
    const stroke = 4 * TAU * Math.min(1, Math.max(0, (t - .3) / 5.1));
    const left = stroke + Math.PI * (smooth(.3, .9, t) + smooth(4.6, 5.3, t));
    return { armR: [turn(stroke), 0, .3], armL: [turn(left), 0, -.3], spine: [.15, wave(stroke, 1, .2), 0],
      head: [0, .5 * Math.max(0, Math.sin(stroke / 2)), 0], lift: 4 };
  } },
  { name: 'Hula', emoji: '🌺', seconds: 6, pose: t => ({
    root: [wave(t, 6, .05), 0, wave(t, 6, .06, Math.PI / 2)], spine: [wave(t, 6, -.08), 0, wave(t, 6, -.1, Math.PI / 2)],
    armR: [-.25, 0, 1.35 + wave(t, 3, .25)], foreR: [0, 0, wave(t, 3, .5, 1)], armL: [-.25, 0, -1.35 + wave(t, 3, .25, 1.4)], foreL: [0, 0, wave(t, 3, .5, 2.4)],
    head: [0, wave(t, 1.5, .2), wave(t, 3, .1)], lift: 3 }) },
  { name: 'Gorilla', emoji: '🦍', seconds: 4.8, pose: t => ({ ...keyed(t, 280, [GORILLA, mirror(GORILLA)], .3, true), root: [.03, 0, wave(t, 4.5, .05)], hop: hops(t, 4.5, 3) }) },
  { name: 'Jumping Jacks', emoji: '⭐', seconds: 5.5, pose: t => {
    const j = Math.abs(Math.sin(t * 4.2));
    return { ...both({ armR: [-.1, 0, .1 + 2.6 * j], foreR: [0, 0, .2 * j] }), head: [-.1 * j, 0, 0], hop: 9 * j, lift: 5 * j };
  } },
  { name: 'Headbang', emoji: '🎸', seconds: 5.5, pose: t => {
    const bang = .5 + .5 * pump(t, TAU * 150 / 60);
    return { ...FRET, ...STRUM, foreR: [STRUM.foreR[0] + wave(t, 18, .35), 0, STRUM.foreR[2]],
      head: [.1 + .45 * bang, 0, wave(t, 1.3, .1)], spine: [.15 + .15 * bang, -.2, 0], root: [.03, 0, 0], hop: onBeat(t, 150, 1.2) };
  } },
  { name: 'Pirouette', emoji: '🩰', seconds: 4.8, pose: t => {
    const rise = smooth(.3, .8, t), spin = smooth(.7, 2.8, t), bow = smooth(3, 3.5, t);
    const arms = blendPose(blendPose(both(CART), both(HANDS_MEET), rise), { armR: [-.3, 0, 1.2], foreR: [0, 0, 0], armL: [-.6, .4, -.3], foreL: [-1.2, 0, 0] }, bow);
    return { ...arms, root: [0, turn(spin * 2 * TAU), 0], hop: 4 * rise * (1 - bow), spine: [.55 * bow, 0, 0], head: [-.15 * rise * (1 - bow) + .3 * bow, 0, 0], lift: 4 * rise * (1 - bow) };
  } },
  { name: 'Egyptian', emoji: '🏺', seconds: 5.5, pose: t => ({ ...keyed(t, 110, [
    { ...EGYPT, head: [0, -.25, .15] },
    { ...EGYPT, armR: [-.15, 0, 1.4], armL: [-.35, 0, -1.4], head: [0, -.25, -.15] },
  ], .3, true), hop: onBeat(t, 110, 1) }) },
  { name: 'Clap Along', emoji: '👏', seconds: 5, pose: t => ({ ...keyed(t, 128, [both(CLAP_OPEN), both(CLAP)], .25, true), head: [wave(t, TAU * 64 / 60, .12), 0, 0], hop: onBeat(t, 64, 1.5) }) },
  { name: 'Cabbage Patch', emoji: '🥬', seconds: 5.5, pose: t => {
    const c = Math.cos(t * 7) * .25, s = Math.sin(t * 7) * .25;
    return { ...both({ armR: [FISTS.armR[0] + c, FISTS.armR[1] + s, FISTS.armR[2]], foreR: FISTS.foreR }), spine: [.05, .8 * s, 0], root: [0, 0, .16 * c], hop: hops(t, 7, 1.5) };
  } },
  { name: 'Fist Pump', emoji: '✊', seconds: 5, pose: t => ({ ...DISCO_HIP,
    ...keyed(t, 128, [{ ...FIST_LOW, head: [0, 0, 0] }, { armR: [-.2, 0, 2.6], foreR: [0, 0, 0], head: [-.2, 0, 0], lift: 3 }], .2, true), hop: onBeat(t, 64, 3) }) },
  { name: 'Zombie', emoji: '🧟', seconds: 6, pose: t => ({
    armR: [-1.45 + wave(t, 1.3, .12), 0, .15], foreR: [-.1 + wave(t, 1.7, .15), 0, 0], armL: [-1.45 + wave(t, 1.3, .12, 2), 0, -.15], foreL: [-.1 + wave(t, 1.6, .15, 1), 0, 0],
    head: [.25 + wave(t, 1.1, .12), wave(t, .7, .35), wave(t, .9, .3)], spine: [.12, wave(t, .8, .15), wave(t, 1.1, .08)],
    root: [0, 0, .07 * pump(t, 2.2)], hop: hops(t, 2.2, 1.2), lift: 3 }) },
  { name: 'Bunny Hop', emoji: '🐰', seconds: 5, pose: t => {
    const up = Math.abs(Math.sin(t * 3.5));
    return { ...both(ON_HEAD), spine: [.15, 0, 0], head: [.15 - .25 * up, 0, 0], root: [0, 0, wave(t, 1.75, .04)], hop: 7 * up, lift: 4 };
  } },
  { name: 'Shimmy', emoji: '✨', seconds: 5, pose: t => ({
    ...both({ armR: [-.35, 0, .7], foreR: [-.9, 0, .3] }), spine: [-.1 + wave(t, 1.2, .08), wave(t, 26, .12), 0], head: [-.1, wave(t, 26, -.08), wave(t, 1.2, .1)],
    root: [0, 0, wave(t, 1.2, .04)], hop: hops(t, 13, .6) }) },
  { name: 'Thriller', emoji: '🎃', seconds: 5.5, pose: t => ({ ...both(CLAW), ...keyed(t, 116, [
    { root: [0, 0, .07], spine: [.1, .2, -.1], head: [0, .3, .15] },
    { root: [0, 0, -.07], spine: [.1, -.2, .1], head: [0, -.3, -.15] },
  ], .2, true), hop: onBeat(t, 116, 1) }) },
];

let lastDance = null;
export function randomDance() {
  const pool = DANCES.filter(d => d !== lastDance);
  return (lastDance = pool[Math.floor(Math.random() * pool.length)]);
}

// `emote` is { dance, time }: seconds since it began. Without `idle` the dance
// plays over the rest pose.
function applyPose(rig, time, { idle = true, emote = null } = {}) {
  let pose = {}, clip = 'rest';
  if (idle) {
    const cycle = CLIPS.length * HOLD, local = time % cycle, index = Math.floor(local / HOLD), into = local - index * HOLD;
    const a = CLIPS[index], b = CLIPS[(index + 1) % CLIPS.length], mix = smooth(HOLD - CROSSFADE, HOLD, into);
    pose = blendPose({ ...a.pose(time), lift: a.lift || 0 }, { ...b.pose(time), lift: b.lift || 0 }, mix);
    clip = mix < .5 ? a.name : b.name;
  }
  if (emote) {
    const { dance, time: t } = emote, k = smooth(0, .3, t) * (1 - smooth(dance.seconds - .45, dance.seconds, t));
    pose = blendPose(pose, dance.pose(t), k);
    if (k > .5) clip = dance.name;
  }
  for (const name of BONES) {
    const r = pose[name] || [0, 0, 0];
    rig.bones[name].rotation.set(r[0], r[1], r[2]);
  }
  rig.bones.hem.position.set(0, pose.lift || 0, 0);
  rig.root.position.set(0, pose.hop || 0, 0);
  rig.clip = clip;
}

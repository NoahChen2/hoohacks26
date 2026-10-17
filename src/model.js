// Parametric body + garment geometry (all in cm; the scene scales to metres).
// Every surface is a stack of elliptical rings so a garment's circumference at any height
// can be compared directly against the body's circumference at that height.

import * as THREE from 'three';
import { GARMENT_TYPES } from './state.js';
import { topLandmarks, bottomLandmarks } from './flats.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Ramanujan's ellipse perimeter
export const perim = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
const radiiFor = (C, k) => {
  const a = C / perim(1, k);
  return [a, a * k];
};

function piecewise(keys, x) {
  // keys sorted by x: [[x, v], ...]
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) {
      const [x0, v0] = keys[i - 1],
        [x1, v1] = keys[i];
      return lerp(v0, v1, (x - x0) / (x1 - x0 || 1));
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- body model

export function bodyModel(b) {
  const H = b.height;
  const crotchY = b.inseam;
  const hipY = Math.min(crotchY + 0.05 * H, 0.6 * H - 8);
  const waistY = 0.615 * H;
  const chestY = 0.725 * H;
  const armpitY = 0.745 * H;
  const shoulderY = 0.818 * H;
  const neckBaseY = 0.838 * H;
  const neckTopY = 0.875 * H;
  const headR = 0.062 * H;
  const headY = neckTopY + headR * 0.95;

  const [hipA, hipB] = radiiFor(b.hips, 0.8);
  const [waA, waB] = radiiFor(b.waist, 0.78);
  const [chA, chB] = radiiFor(b.chest, 0.68);
  const neckR = b.neck / (2 * Math.PI);
  const shA = b.shoulder / 2;

  const torso = [
    { y: crotchY - 1, rx: hipA * 0.86, rz: hipB * 0.82 },
    { y: crotchY + 2, rx: hipA * 0.97, rz: hipB * 0.95 },
    { y: hipY, rx: hipA, rz: hipB },
    { y: lerp(hipY, waistY, 0.5), rx: lerp(hipA, waA, 0.55), rz: lerp(hipB, waB, 0.5) },
    { y: waistY, rx: waA, rz: waB },
    { y: lerp(waistY, chestY, 0.5), rx: lerp(waA, chA, 0.6), rz: lerp(waB, chB, 0.6) },
    { y: chestY, rx: chA, rz: chB },
    { y: armpitY, rx: chA * 0.98, rz: chB * 0.95 },
    { y: lerp(armpitY, shoulderY, 0.55), rx: Math.max(chA * 0.97, shA - 3), rz: chB * 0.85 },
    { y: shoulderY - 1.5, rx: shA - 2.5, rz: chB * 0.62 },
    { y: shoulderY + 0.8, rx: lerp(shA - 2.5, neckR, 0.55), rz: lerp(chB * 0.55, neckR, 0.5) },
    { y: neckBaseY, rx: neckR * 1.15, rz: neckR * 1.1 },
    { y: neckTopY, rx: neckR, rz: neckR },
  ];

  // legs
  const thighR = b.thigh / (2 * Math.PI);
  const legX = hipA * 0.47;
  const legs = [
    { y: hipY, r: thighR * 1.05 },
    { y: crotchY, r: thighR },
    { y: lerp(crotchY, 0.285 * H, 0.5), r: thighR * 0.86 },
    { y: 0.285 * H, r: thighR * 0.62 },
    { y: 0.22 * H, r: thighR * 0.64 },
    { y: 0.12 * H, r: thighR * 0.48 },
    { y: 0.045 * H, r: thighR * 0.36 },
    { y: 0.025 * H, r: thighR * 0.36 },
  ];

  // arms (A-pose)
  const L = b.arm;
  const upperR = (b.chest * 0.31) / (2 * Math.PI);
  const armAngle = (13 * Math.PI) / 180;
  const armDir = new THREE.Vector3(Math.sin(armAngle), -Math.cos(armAngle), 0);
  const jointL = new THREE.Vector3(-(shA - upperR * 0.55), shoulderY - upperR * 0.95, 0);
  const jointR = new THREE.Vector3(shA - upperR * 0.55, shoulderY - upperR * 0.95, 0);
  const arm = [
    { t: -upperR * 0.6, r: upperR * 0.75 },
    { t: 0, r: upperR },
    { t: L * 0.2, r: upperR * 0.97 },
    { t: L * 0.45, r: upperR * 0.78 },
    { t: L * 0.58, r: upperR * 0.84 },
    { t: L * 0.85, r: upperR * 0.62 },
    { t: L, r: upperR * 0.52 },
  ];

  const lm = { H, crotchY, hipY, waistY, chestY, armpitY, shoulderY, neckBaseY, neckTopY, headR, headY, legX, armAngle, armLen: L };

  function profileAt(y) {
    if (y >= torso[0].y) {
      for (let i = 1; i < torso.length; i++) {
        if (y <= torso[i].y) {
          const a = torso[i - 1],
            c = torso[i];
          const t = (y - a.y) / (c.y - a.y);
          return { rx: lerp(a.rx, c.rx, t), rz: lerp(a.rz, c.rz, t) };
        }
      }
      const t = torso[torso.length - 1];
      return { rx: t.rx, rz: t.rz };
    }
    // below crotch: hull around both legs
    const r = legRAt(y);
    const top = torso[0];
    const t = clamp((top.y - y) / 6, 0, 1);
    return { rx: lerp(top.rx, legX + r, t), rz: lerp(top.rz, r * 1.08, t) };
  }
  function legRAt(y) {
    return piecewise(
      legs.map((l) => [l.y, l.r]).reverse(),
      y
    );
  }
  function armRAt(t) {
    return piecewise(
      arm.map((a) => [a.t, a.r]),
      t
    );
  }
  const circAt = (y) => {
    const p = profileAt(y);
    return perim(p.rx, p.rz);
  };

  return { b, torso, legs, arm, armDir, jointL, jointR, lm, profileAt, legRAt, armRAt, circAt, upperR, thighR, neckR };
}

// ---------------------------------------------------------------- ring surface builder

/**
 * rings: [{c:Vector3, e1:Vector3, e2:Vector3, r1, r2, flatY, xOff, color?}]
 * φ = 0 points along e2 (front). u is arc-length based so patterns keep real-world scale.
 */
export function ringSurface(rings, opts = {}) {
  const N = opts.segments || 48;
  const W = opts.texW || 220;
  const Hc = opts.texH || 200;
  const margin = opts.texMargin ?? 12;
  const pos = [],
    uv = [],
    col = [],
    idx = [];
  for (let j = 0; j < rings.length; j++) {
    const R = rings[j];
    // cumulative arc length starting at back (φ=-π) so front is the middle
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const phi = -Math.PI + (i / N) * Math.PI * 2;
      const p = R.c
        .clone()
        .addScaledVector(R.e1, Math.sin(phi) * R.r1)
        .addScaledVector(R.e2, Math.cos(phi) * R.r2);
      pts.push(p);
    }
    let s = 0;
    const arcs = [0];
    for (let i = 1; i <= N; i++) {
      s += pts[i].distanceTo(pts[i - 1]);
      arcs.push(s);
    }
    const half = s / 2;
    for (let i = 0; i <= N; i++) {
      pos.push(pts[i].x, pts[i].y, pts[i].z);
      const sc = arcs[i] - half; // arc from front centre; +sc toward +e1
      uv.push(0.5 + (sc + (R.xOff || 0)) / W, 1 - ((R.flatY ?? 0) + margin) / Hc);
      const c = R.color || [1, 1, 1];
      col.push(c[0], c[1], c[2]);
    }
  }
  const row = N + 1;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * row + i,
        b = a + 1,
        c = a + row,
        d = c + 1;
      idx.push(a, b, c, b, d, c); // CCW from outside → outward normals
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if (opts.capStart || opts.capEnd) {
    // simple fan caps
    const caps = [];
    if (opts.capStart) caps.push([0, -1]);
    if (opts.capEnd) caps.push([rings.length - 1, 1]);
    const merged = [geo];
    for (const [j] of caps) {
      const R = rings[j];
      const g2 = new THREE.CircleGeometry(1, N);
      g2.scale(R.r1, R.r2, 1);
      const m = new THREE.Matrix4().makeBasis(R.e1, R.e2, new THREE.Vector3().crossVectors(R.e1, R.e2));
      g2.applyMatrix4(m);
      g2.translate(R.c.x, R.c.y, R.c.z);
      merged.push(g2);
    }
    return merged;
  }
  return geo;
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export function armBasis(dir) {
  const e1 = new THREE.Vector3(-dir.y, dir.x, 0).normalize(); // perpendicular in xy-plane
  if (e1.x < 0) e1.negate();
  return { e1, e2: Z.clone() };
}

// ---------------------------------------------------------------- body meshes

export function buildBodyGeometries(M) {
  const out = [];
  const torsoRings = M.torso.map((t) => ({ c: new THREE.Vector3(0, t.y, 0), e1: X, e2: Z, r1: t.rx, r2: t.rz }));
  out.push(ringSurface(torsoRings, { capStart: true }));
  // legs
  for (const side of [-1, 1]) {
    const rings = M.legs.map((l) => ({ c: new THREE.Vector3(side * M.lm.legX, l.y, 0), e1: X, e2: Z, r1: l.r, r2: l.r * 1.04 }));
    out.push(ringSurface(rings, { segments: 32 }));
    // foot
    const foot = new THREE.SphereGeometry(1, 20, 12);
    const fr = M.thighR * 0.4;
    foot.scale(fr * 1.05, fr * 0.75, fr * 2.6);
    foot.translate(side * M.lm.legX, M.lm.H * 0.02, fr * 1.3);
    out.push(foot);
  }
  // arms
  for (const side of [-1, 1]) {
    const dir = M.armDir.clone();
    dir.x *= side;
    const joint = side < 0 ? M.jointL : M.jointR;
    const { e1, e2 } = armBasis(dir);
    const rings = M.arm.map((a) => ({ c: joint.clone().addScaledVector(dir, a.t), e1, e2, r1: a.r, r2: a.r * 0.95 }));
    out.push(ringSurface(rings, { segments: 28 }));
    const shoulder = new THREE.SphereGeometry(M.upperR * 1.02, 20, 14);
    shoulder.translate(joint.x, joint.y, joint.z);
    out.push(shoulder);
    // hand
    const hand = new THREE.SphereGeometry(1, 16, 12);
    const hr = M.upperR * 0.55;
    hand.scale(hr * 0.75, hr * 1.9, hr * 0.42);
    const hp = joint.clone().addScaledVector(dir, M.lm.armLen + hr * 1.6);
    hand.rotateZ(side * M.lm.armAngle);
    hand.translate(hp.x, hp.y, hp.z);
    out.push(hand);
  }
  // head
  const head = new THREE.SphereGeometry(1, 32, 24);
  head.scale(M.lm.headR * 0.82, M.lm.headR * 1.08, M.lm.headR * 0.95);
  head.translate(0, M.lm.headY, 0.4);
  out.push(head);
  return out.flat();
}

// ---------------------------------------------------------------- garments

// ease (cm of extra circumference) → colour
export function easeColor(ease) {
  if (ease < -1) return [0.9, 0.28, 0.3];
  if (ease < 4) return [0.96, 0.85, 0.04];
  if (ease < 24) return [0.27, 0.65, 0.35];
  return [0.24, 0.39, 0.87];
}

function fitRing(M, y, Cg, flatY, extra = 0.6) {
  const p = M.profileAt(y);
  const Cb = perim(p.rx, p.rz);
  let r1, r2;
  if (Cg > Cb + extra * 6.3) {
    const s = Cg / Cb;
    r1 = p.rx * s;
    r2 = p.rz * s;
  } else {
    r1 = p.rx + extra;
    r2 = p.rz + extra;
  }
  return { c: new THREE.Vector3(0, y, 0), e1: X, e2: Z, r1, r2, flatY, color: easeColor(Cg - Cb), ease: Cg - Cb };
}

function sampleYs(top, bottom, step, extras = []) {
  const ys = new Set();
  for (let y = bottom; y < top; y += step) ys.add(+y.toFixed(2));
  ys.add(+top.toFixed(2));
  extras.forEach((e) => {
    if (e > bottom && e < top) ys.add(+e.toFixed(2));
  });
  return [...ys].sort((a, b) => a - b);
}

/**
 * Returns { parts: [{geo, region}], summary, topY } for a garment on a body model.
 * parts' uv map into a shared texture where the flat sketch (cm) lives at
 * u = 0.5 + x/texW, v = 1 - (flatY + margin)/texH.
 */
export function buildGarment(g, M) {
  const kind = GARMENT_TYPES[g.type].kind;
  const lm = M.lm;
  const parts = [];
  const checks = []; // {label, ease}
  let topY;

  if (kind === 'top' || kind === 'dress') {
    const T = topLandmarks(g);
    topY = lm.neckBaseY + 0.5;
    const isDress = kind === 'dress';
    const hemY = Math.max(topY - g.length, 2);
    const waistYg = isDress ? lm.waistY : lm.waistY;
    // garment circumference keypoints by world y
    let keys;
    if (isDress) {
      const skirtHip = g.waist + (g.hem - g.waist) * 0.35;
      keys = [
        [hemY, g.hem],
        [lm.hipY, Math.max(skirtHip, g.waist)],
        [waistYg, g.waist],
        [lm.chestY, g.chest],
        [lm.armpitY, g.chest],
      ];
    } else {
      keys = [
        [hemY, g.hem],
        [waistYg, g.waist],
        [lm.chestY, g.chest],
        [lm.armpitY, g.chest],
      ];
    }
    keys = keys.filter((k, i) => i === 0 || k[0] > hemY).sort((a, b) => a[0] - b[0]);
    const Cg = (y) => piecewise(keys, y);
    const ys = sampleYs(lm.armpitY, hemY, 3, [lm.waistY, lm.hipY, lm.chestY, lm.crotchY]);
    const rings = ys.map((y) => fitRing(M, y, Cg(y), topY - y));
    // shoulders → neckline
    const shoulderHalf = Math.max(g.shoulder / 2, M.profileAt(lm.shoulderY - 1.5).rx + 0.8);
    const up = [
      { y: lerp(lm.armpitY, lm.shoulderY, 0.55), w: 1 },
      { y: lm.shoulderY - 1.5, w: 1 },
      { y: lm.shoulderY + 0.8, w: 0.6 },
      { y: lm.neckBaseY + 0.3, w: 0 },
    ];
    const chestRing = rings[rings.length - 1];
    for (const u of up) {
      if (u.y <= chestRing.c.y) continue;
      const p = M.profileAt(u.y);
      const atShoulder = u.y >= lm.shoulderY - 2;
      let r1 = atShoulder ? p.rx + 1 : Math.max(p.rx + 0.8, Math.min(shoulderHalf, chestRing.r1));
      let r2 = Math.max(p.rz + 0.8, u.w ? lerp(p.rz + 0.8, chestRing.r2, 0.4) : p.rz + 0.8);
      if (u.w === 0) {
        r1 = Math.max(M.neckR + 1.2, g.type === 'tank' ? T.nw : T.nw * 0.85);
        r2 = M.neckR + (g.type === 'buttonup' ? 1.2 : 2.4);
      }
      rings.push({ c: new THREE.Vector3(0, u.y, u.w === 0 ? 0.6 : 0), e1: X, e2: Z, r1, r2, flatY: topY - u.y, color: [0.27, 0.65, 0.35] });
    }
    parts.push({ geo: ringSurface(rings, { segments: 56 }), region: 'torso' });
    const ringAt = (y) => rings.reduce((best, r) => (Math.abs(r.c.y - y) < Math.abs(best.c.y - y) ? r : best), rings[0]);
    checks.push({ label: 'Chest', ease: g.chest - M.b.chest });
    if (hemY < lm.waistY) checks.push({ label: 'Waist', ease: g.waist - M.b.waist });
    if (hemY < lm.hipY) checks.push({ label: 'Hips', ease: ringAt(lm.hipY).ease });
    checks.push({ label: 'Length', ease: null, text: lengthText(hemY, lm) });

    // sleeves
    if (T.hasSleeves) {
      const armholeC = Math.max(g.chest * 0.42, M.upperR * 2 * Math.PI + 4);
      const L = Math.min(g.sleeve, lm.armLen + 4);
      for (const side of [-1, 1]) {
        const dir = M.armDir.clone();
        dir.x *= side;
        const joint = side < 0 ? M.jointL : M.jointR;
        const { e1, e2 } = armBasis(dir);
        const ts = sampleYs(L, -M.upperR * 0.9, 3, [0]);
        const srings = ts.map((t) => {
          const br = M.armRAt(Math.min(t, lm.armLen));
          const Cb = 2 * Math.PI * br;
          const Cs = t <= 0 ? armholeC : lerp(armholeC, g.sleeveOpen, clamp(t / L, 0, 1));
          let r = Math.max(br + 0.5, Cs / (2 * Math.PI));
          // round the sleeve cap over the shoulder instead of a flat disc
          if (t < 0) r = lerp(br + 0.6, r, clamp(1 + t / (M.upperR * 0.9), 0, 1));
          // flat mapping for the sleeve: along the flat sleeve direction
          const fx = side * (T.S[0] + Math.cos(T.theta) * Math.max(t, 0));
          const fy = T.S[1] + Math.sin(T.theta) * Math.max(t, 0);
          return { c: joint.clone().addScaledVector(dir, t), e1, e2, r1: r, r2: r * 0.96, flatY: fy, xOff: fx, color: easeColor(Cs - Cb), ease: Cs - Cb };
        });
        parts.push({ geo: ringSurface(srings, { segments: 32 }), region: 'sleeve' });
      }
      checks.push({ label: 'Sleeve', ease: g.sleeveOpen - 2 * Math.PI * M.armRAt(Math.min(L, lm.armLen)), text: sleeveText(g.sleeve, lm.armLen) });
    }

    if (g.type === 'hoodie') {
      const hood = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
      hood.scale(lm.headR * 1.05, lm.headR * 0.9, lm.headR * 0.9);
      hood.rotateX(-Math.PI * 0.62);
      hood.translate(0, lm.neckBaseY + 2, -M.neckR * 1.6);
      parts.push({ geo: hood, region: 'hood' });
    }
  }

  if (kind === 'bottom') {
    const B = bottomLandmarks(g);
    const crotch = lm.crotchY;
    topY = Math.min(crotch + g.rise, lm.waistY + 4);
    const keys = [
      [crotch - 1, Math.min(g.hips * 0.97, M.circAt(crotch - 1) * (g.hips / M.b.hips) + 2)],
      [Math.min(lm.hipY, topY - 2), g.hips],
      [topY, g.waist],
    ].sort((a, b) => a[0] - b[0]);
    const ys = sampleYs(topY, crotch - 1, 3, [lm.hipY]);
    const rings = ys.map((y) => fitRing(M, y, piecewise(keys, y), topY - y, 0.5));
    parts.push({ geo: ringSurface(rings, { segments: 56 }), region: 'seat' });
    const seatBottom = rings[0];
    checks.push({ label: 'Waist', ease: g.waist - M.circAt(topY) });
    checks.push({ label: 'Hips', ease: g.hips - M.b.hips });
    const hemY = Math.max(crotch - g.inseam, 1.5);
    const thighC = g.hips * 0.62;
    for (const side of [-1, 1]) {
      const ly = sampleYs(crotch + 1, hemY, 3, [lm.H * 0.285]);
      const lr = ly.map((y) => {
        const br = M.legRAt(y);
        const Cb = 2 * Math.PI * br;
        const Cl = lerp(g.legOpen, thighC, clamp((y - hemY) / (crotch - hemY || 1), 0, 1));
        let r = Math.max(br + 0.5, Cl / (2 * Math.PI));
        // flare the top of each leg out to meet the seat so there's no step at the crotch
        const blend = clamp((y - (crotch - 8)) / 9, 0, 1);
        r = Math.max(r, lerp(r, seatBottom.r1 - lm.legX + 0.3, blend));
        const fy = topY - y;
        return { c: new THREE.Vector3(side * lm.legX, y, 0), e1: X, e2: Z, r1: r, r2: r * 1.02, flatY: fy, xOff: side * B.xc, color: easeColor(Cl - Cb), ease: Cl - Cb };
      });
      parts.push({ geo: ringSurface(lr, { segments: 36 }), region: 'leg' });
    }
    checks.push({ label: 'Thigh', ease: thighC - M.b.thigh });
    checks.push({ label: 'Length', ease: null, text: inseamText(g.inseam, M.b.inseam) });
  }

  if (kind === 'skirt') {
    topY = lm.waistY;
    const hemY = Math.max(topY - g.length, 2);
    const hipY = topY - Math.min(18, g.length * 0.4);
    const keys = [
      [hemY, g.hem],
      [hipY, g.hips],
      [topY, g.waist],
    ].sort((a, b) => a[0] - b[0]);
    const ys = sampleYs(topY, hemY, 3, [lm.hipY, lm.crotchY]);
    const rings = ys.map((y) => {
      const r = fitRing(M, y, piecewise(keys, y), topY - y, 0.6);
      return r;
    });
    parts.push({ geo: ringSurface(rings, { segments: 64 }), region: 'skirt' });
    checks.push({ label: 'Waist', ease: g.waist - M.b.waist });
    checks.push({ label: 'Hips', ease: g.hips - M.b.hips });
    checks.push({ label: 'Length', ease: null, text: hemY > lm.H * 0.285 ? 'above knee' : hemY > lm.H * 0.12 ? 'midi' : 'maxi' });
  }

  return { parts, checks, topY };
}

function lengthText(hemY, lm) {
  if (hemY > lm.waistY + 4) return 'cropped (above waist)';
  if (hemY > lm.hipY) return 'hits at waist';
  if (hemY > lm.crotchY - 4) return 'hip length';
  if (hemY > lm.H * 0.3) return 'tunic / mini length';
  return 'long';
}
function sleeveText(s, arm) {
  if (s < arm * 0.35) return 'short sleeve';
  if (s < arm * 0.8) return '3/4 sleeve';
  if (s > arm + 3) return `${Math.round(s - arm)} cm too long`;
  return 'full length';
}
function inseamText(i, bi) {
  const d = i - bi;
  if (d > 3) return `${Math.round(d)} cm too long`;
  if (d < -12) return 'shorts / cropped';
  if (d < -3) return `${Math.round(-d)} cm short (ankle)`;
  return 'right length';
}

export function fitWord(ease, kind = 'top') {
  if (ease == null) return '';
  if (ease < -1) return 'too tight';
  if (ease < 4) return 'snug';
  if (ease < (kind === 'bottom' ? 10 : 24)) return 'good fit';
  return 'oversized';
}

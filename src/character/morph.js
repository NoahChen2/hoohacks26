import { headFrame } from './measurements.js';
import { bodyWeightField } from './rig.js';

// Measurement changes morph one canonical body mesh instead of re-meshing it.
// Each vertex is expressed against the canonical body's calibrated anatomy (torso
// cross sections, leg and arm radius profiles, joints and landmarks) and
// re-evaluated against the target's. Torso vertices land on the target's
// calibrated polar sections; limbs follow their measured profiles; head, hands
// and feet scale with stature. Region weights blend the maps at the joints.

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Per-vertex [arm, leg, head] membership on the canonical mesh; torso is the rest.
export function morphRegions(model, sampler, positions) {
  const field = bodyWeightField(model, sampler), w = new Float32Array(8), lm = model.lm, head = headFrame(lm.H);
  const n = positions.length / 3, out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    field(x, y, z, w);
    const arm = w[3] + w[4] + w[5] + w[6];
    const leg = smooth(lm.crotchY + 2.5, lm.crotchY - 2.5, y) * (1 - arm);
    const headCutY = head.y - (head.r * 2) * .45;
    const onFace = z > head.z && y >= head.y - (head.r * 2) * .505;
    const skull = y > headCutY || onFace
      ? 1
      : smooth(headCutY - head.r * .12, headCutY, y) * (1 - arm - leg);
    out.set([arm, leg, skull], i * 3);
  }
  return out;
}

function piecewise(keys) {
  return y => {
    if (y <= keys[0][0]) return keys[0][1] + (y - keys[0][0]);
    for (let i = 1; i < keys.length; i++) if (y <= keys[i][0]) {
      const [a, fa] = keys[i - 1], [b, fb] = keys[i];
      return fa + (fb - fa) * (y - a) / (b - a || 1);
    }
    const [a, fa] = keys[keys.length - 1];
    return fa + (y - a);
  };
}

// from / to: { model, sampler }. Writes the morphed positions into `out`.
export function morphBody(positions, regions, from, to, out = new Float32Array(positions.length)) {
  const A = from.model, T = to.model, a = A.lm, t = T.lm, s = t.H / a.H;
  const marks = m => [0, m.crotchY, m.hipY, m.waistY, m.chestY, m.armpitY, m.shoulderY, m.neckBaseY, m.neckTopY, m.H];
  const torsoY = piecewise(marks(a).map((y, i) => [y, marks(t)[i]]));
  const legMarks = m => [0, .025 * m.H, .045 * m.H, .12 * m.H, .22 * m.H, .285 * m.H, (m.crotchY + .285 * m.H) / 2, m.crotchY, m.hipY];
  const legY = piecewise(legMarks(a).map((y, i) => [y, legMarks(t)[i]]));
  const ha = headFrame(a.H), ht = headFrame(t.H);
  const cosA = Math.cos(a.armAngle), sinA = Math.sin(a.armAngle);
  // The target may hang its arms at a wider angle (larger bodies): rotate into it.
  const cosT = Math.cos(t.armAngle), sinT = Math.sin(t.armAngle);
  const armK = T.upperR / A.upperR, wristA = a.wristT, wristT = t.wristT;
  const arms = [[-1, A.jointL, T.jointL], [1, A.jointR, T.jointR]];
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const o = i * 3, x = positions[o], y = positions[o + 1], z = positions[o + 2];
    const wArm = regions[o], wLeg = regions[o + 1], wHead = regions[o + 2], wTorso = Math.max(0, 1 - wArm - wLeg - wHead);
    let px = 0, py = 0, pz = 0;
    if (wTorso > 0) {
      const phi = Math.atan2(x, z), y2 = torsoY(y);
      const k = to.sampler.radius(y2, phi) / Math.max(from.sampler.radius(y, phi), 1e-3);
      px += wTorso * x * k; py += wTorso * y2; pz += wTorso * z * k;
    }
    if (wLeg > 0) {
      const side = x < 0 ? -1 : 1, y2 = legY(y);
      // Below the ankle the foot scales with stature; above, with the leg profile.
      const k = s + (T.legRAt(y2) / Math.max(A.legRAt(y), 1e-3) - s) * smooth(.04 * a.H, .06 * a.H, y);
      px += wLeg * (side * t.legX + (x - side * a.legX) * k); py += wLeg * y2; pz += wLeg * z * k;
    }
    if (wArm > 0) {
      const [side, ja, jt] = arms[x < 0 ? 0 : 1], dx = side * sinA, dy = -cosA;
      const qx = x - ja.x, qy = y - ja.y, along = qx * dx + qy * dy, across = qx * -dy + qy * dx;
      // The hand (past the wrist) scales with stature, the arm with its radius.
      const along2 = along <= 0 ? along * armK : along <= wristA ? along * wristT / wristA : wristT + (along - wristA) * s;
      const k = armK + (s - armK) * smooth(wristA - 1, wristA + 3, along);
      const tx = side * sinT, ty = -cosT;
      px += wArm * (jt.x + tx * along2 - ty * across * k);
      py += wArm * (jt.y + ty * along2 + tx * across * k);
      pz += wArm * z * k;
    }
    if (wHead > 0) {
      px += wHead * x * s; py += wHead * (ht.y + (y - ha.y) * s); pz += wHead * (ht.z + (z - ha.z) * s);
    }
    out[o] = px; out[o + 1] = py; out[o + 2] = pz;
  }
  return out;
}

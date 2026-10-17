import * as THREE from 'three';

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


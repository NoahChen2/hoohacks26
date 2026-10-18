import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Head height (vertex to chin) is ~13% of stature, breadth ~9% and length ~11.5%.
// Shared by the body mesh and the comic face shader.
export const headFrame = H => ({ y: H * .935, r: H * .065, z: 1.1 });

export function assertPreviewRange(model) {
  const { crotchY, H } = model.lm;
  if (crotchY > H * .59 || crotchY < H * .30) throw new Error('This inseam-to-height combination is outside the procedural preview range. Fit measurements are still saved.');
}

// Painted hairline per hairstyle, in head radii from the head centre: `top` at
// the forehead, `side` at the temples, `drop` for side curtains (when `curtain`),
// `back` at the nape. `ears` hides the ears under hair, `neck` extends the head
// zone over the nape, `texture` picks the painted pattern (0 straight, 1 curly,
// 2 buzz stubble, 3 mohawk strip of half-width `strip` radii, 4 none). Shared by
// the hair volume (geometry.js) and the body shader (materials.js).
const SHAPE = (top, side, back, extra = {}) => ({ top, side, drop: side, curtain: 0, back, ears: 0, neck: 0, texture: 0, strip: 0, ...extra });
export const HAIR_SHAPES = {
  crop: SHAPE(.47, .17, -.78),
  bob: SHAPE(.47, .17, -1.25, { drop: -.8, curtain: 1, ears: 1, neck: 1 }),
  long: SHAPE(.47, .17, -1.25, { drop: -.8, curtain: 1, ears: 1, neck: 1 }),
  ponytail: SHAPE(.5, .1, -.85),
  bun: SHAPE(.5, .1, -.85),
  curls: SHAPE(.4, .12, -.98, { drop: -.42, curtain: 1, ears: 1, texture: 1 }),
  braids: SHAPE(.5, .1, -.85),
  mohawk: SHAPE(.5, .15, -.8, { texture: 3, strip: .2 }),
  buzz: SHAPE(.47, .15, -.8, { texture: 2 }),
  bald: SHAPE(9, 9, 9, { texture: 4 }),
};
export const hairShape = style => HAIR_SHAPES[style] ?? HAIR_SHAPES.crop;

// Hairline height by angle around the head (0 = face). Mirrored by the body
// shader, which paints the hair above it.
export function hairline(angle, shape) {
  const step = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const a = Math.abs(angle), front = 1 - step(.25, 1.35, a), back = step(1.75, 2.75, a);
  let sides = shape.side + (shape.top - shape.side) * front;
  if (shape.curtain) sides += (shape.drop - sides) * step(.95, 1.45, a);
  return sides + (shape.back - sides) * back;
}

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
  const jointX = shA - upperR * 0.55, jointY = shoulderY - upperR * 0.95;
  // A-pose: 13 degrees, opened up (to 30) so the forearms and hands hang clear
  // of a wider waist and hips instead of sinking into them.
  const torsoKeys = torso.map((t) => [t.y, t.rx]), torsoRx = (y) => piecewise(torsoKeys, y);
  let armTan = Math.tan((13 * Math.PI) / 180);
  for (const y of [waistY, lerp(waistY, hipY, 0.5), hipY]) {
    const depth = jointY - y;
    if (depth > 1) armTan = Math.max(armTan, (torsoRx(y) + upperR * 0.7 - jointX) / depth);
  }
  const armAngle = Math.min(Math.atan(armTan), (30 * Math.PI) / 180);
  const armDir = new THREE.Vector3(Math.sin(armAngle), -Math.cos(armAngle), 0);
  const jointL = new THREE.Vector3(-jointX, jointY, 0);
  const jointR = new THREE.Vector3(jointX, jointY, 0);
  const arm = [
    { t: -upperR * 0.6, r: upperR * 0.75 },
    { t: 0, r: upperR },
    { t: L * 0.2, r: upperR * 0.97 },
    { t: L * 0.45, r: upperR * 0.78 },
    { t: L * 0.58, r: upperR * 0.84 },
    { t: L * 0.85, r: upperR * 0.62 },
    { t: L, r: upperR * 0.52 },
  ];

  // Arm length is taped from the shoulder point (acromion), which sits above and
  // outside the rotation joint; wristT is the joint-to-wrist distance along the arm.
  const wristT = L + (0.55 * upperR) * Math.sin(armAngle) - 0.95 * upperR * Math.cos(armAngle);
  const lm = { H, crotchY, hipY, waistY, chestY, armpitY, shoulderY, neckBaseY, neckTopY, headR, headY, legX, armAngle, armLen: L, wristT };

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
  // Keys are built once; these run per vertex when morphing the body.
  const legKeys = legs.map((l) => [l.y, l.r]).reverse(), armKeys = arm.map((a) => [a.t, a.r]);
  const legRAt = (y) => piecewise(legKeys, y);
  const armRAt = (t) => piecewise(armKeys, t);
  const circAt = (y) => {
    const p = profileAt(y);
    return perim(p.rx, p.rz);
  };

  return { b, torso, legs, arm, armDir, jointL, jointR, lm, profileAt, legRAt, armRAt, circAt, upperR, thighR, neckR };
}


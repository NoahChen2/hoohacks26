import { perim } from './measurements.js';

const TAU = Math.PI * 2;
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const smooth = t => t * t * (3 - 2 * t);

// Angular terms do not depend on height: tabulate them once per resolution.
const angularTables = new Map();
function angular(segments) {
  let table = angularTables.get(segments);
  if (!table) {
    const sin = new Float64Array(segments + 1), cos = new Float64Array(segments + 1), pair = new Float64Array(segments), rear = new Float64Array(segments), collar = new Float64Array(segments);
    for (let i = 0; i <= segments; i++) {
      const phi = -Math.PI + i / segments * TAU;
      sin[i] = Math.sin(phi); cos[i] = Math.cos(phi);
      if (i === segments) break;
      pair[i] = bell(phi, .52, .31) + bell(phi, -.52, .31);
      rear[i] = bell(Math.abs(phi), Math.PI-.40, .46);
      collar[i] = bell(Math.abs(phi), .9, .4);
    }
    angularTables.set(segments, table = { sin, cos, pair, rear, collar });
  }
  return table;
}

// Polar cross sections are calibrated by numerical perimeter after shaping.
// Bust/chest distribution is an editable shape prior, not inferred anatomy.
export function createTorsoSampler(model, character, rows = 160, segments = 128) {
  const H = model.lm.H, low = model.lm.crotchY - 4;
  const high = model.lm.neckTopY + model.lm.headR * .35;
  const table = new Float32Array((rows + 1) * segments);
  const feminine = character.bodyPreset === 'feminine';
  const definition = character.proportions.muscleDefinition;
  const keys = model.torso;
  const { sin, cos, pair, rear: rearAngle, collar: collarAngle } = angular(segments), section = new Float64Array(segments);
  let maxRadius = 0;
  for (let j = 0; j <= rows; j++) {
    const y = low + (high - low) * j / rows;
    let a = keys[0], b = keys[0];
    for (let k = 1; k < keys.length; k++) {
      a = keys[k - 1]; b = keys[k];
      if (y <= b.y) break;
    }
    const t = smooth(Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y || 1))));
    let rx = a.rx + (b.rx - a.rx) * t, rz = a.rz + (b.rz - a.rz) * t;
    if (y >= keys.at(-1).y) { rx = model.neckR; rz = model.neckR; }
    const target = perim(rx, rz);
    const chest = bell(y / H, .725, .033), hips = bell(y / H, model.lm.hipY / H, .042);
    const aspect = rz / rx + (feminine ? .10 : -.045) * chest + (feminine ? .025 : 0) * hips;
    rx = target / perim(1, aspect); rz = rx * aspect;
    const bust = (feminine ? .29 : .045) * chest, rear = (feminine ? .10 : .06) * hips, collar = .025 * bell(y / H, .796, .008);
    let abs = 0;
    for (let k = 0; k < 3; k++) abs += definition * .025 * bell(y / H, .688 - k * .025, .012);
    for (let i = 0; i < segments; i++) {
      const r = 1 / Math.hypot(sin[i] / rx, cos[i] / rz);
      section[i] = r * (1 + (bust + abs) * pair[i] + rear * rearAngle[i] + collar * collarAngle[i]);
    }
    let circumference = 0;
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments;
      circumference += Math.hypot(section[n] * sin[i + 1] - section[i] * sin[i], section[n] * cos[i + 1] - section[i] * cos[i]);
    }
    const scale = target / circumference;
    // Trapezius: the shoulder line slopes up from the acromion into the side of
    // the neck (~0.85 H) instead of meeting it as a flat shelf. Added after
    // calibration; it lies above every measured girth.
    const trapLow = model.lm.shoulderY - 1, trapHigh = model.lm.neckBaseY + 2.5;
    const s = Math.max(0, Math.min(1, (y - trapLow) / (trapHigh - trapLow)));
    const trapX = model.neckR * 1.1 + (model.b.shoulder / 2 - 2.5 - model.neckR * 1.1) * (1 - s ** 1.6);
    const trapZ = keys[keys.length - 4].rz * .62 * (1 - s) + model.neckR * 1.05 * s;
    for (let i = 0; i < segments; i++) {
      const trap = y > trapLow && y < trapHigh ? 1 / Math.hypot(sin[i] / trapX, cos[i] / trapZ) : 0;
      const r = Math.max(section[i] * scale, trap);
      table[j * segments + i] = r; maxRadius = Math.max(maxRadius, r);
    }
  }
  function radius(y, phi) {
    const fy = Math.max(0, Math.min(rows - 1e-6, (y - low) / (high - low) * rows));
    const j = Math.floor(fy), t = fy - j;
    const fp = ((phi + Math.PI) / TAU * segments % segments + segments) % segments;
    const i = Math.floor(fp), n = (i + 1) % segments, u = fp - i;
    const a = table[j * segments + i] * (1 - u) + table[j * segments + n] * u;
    const b = table[(j + 1) * segments + i] * (1 - u) + table[(j + 1) * segments + n] * u;
    return a * (1 - t) + b * t;
  }
  return { radius, low, high, maxRadius };
}

export function conformToCharacter(geometry, region, model, sampler) {
  if (!['torso', 'pocket', 'skirt', 'leg', 'waistband', 'seat', 'button', 'collar'].includes(region)) return;
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < model.lm.crotchY - 1 || y > model.lm.neckBaseY + 2.5) continue;
    const r = Math.hypot(x, z), body = sampler.radius(y, Math.atan2(x, z));
    const clearance = geometry.userData.trim ? .38 : geometry.userData.button ? 1.0 : .8;
    if (r > .001 && r < body + clearance) {
      const scale = (body + clearance) / r;
      p.setXYZ(i, x * scale, y, z * scale);
    }
  }
  // Cloth topology is indexed, so this preserves smooth normals across the drape.
  geometry.computeVertexNormals();
}

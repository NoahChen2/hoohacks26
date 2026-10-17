import { perim } from './measurements.js';

const TAU = Math.PI * 2;
const bell = (x, c, w) => Math.exp(-(((x - c) / w) ** 2));
const smooth = t => t * t * (3 - 2 * t);

// Polar cross sections are calibrated by numerical perimeter after shaping.
// Bust/chest distribution is an editable shape prior, not inferred anatomy.
export function createTorsoSampler(model, character, rows = 160, segments = 128) {
  const H = model.lm.H, low = model.lm.crotchY - 4;
  const high = model.lm.neckTopY + model.lm.headR * .35;
  const table = new Float32Array((rows + 1) * segments);
  const feminine = character.bodyPreset === 'feminine';
  const definition = character.proportions.muscleDefinition;
  const keys = model.torso;
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
    const section = [];
    for (let i = 0; i < segments; i++) {
      const phi = -Math.PI + i / segments * TAU;
      let r = 1 / Math.hypot(Math.sin(phi) / rx, Math.cos(phi) / rz);
      const pair = bell(phi, .52, .31) + bell(phi, -.52, .31);
      const bust = (feminine ? .29 : .045) * chest * pair;
      const rear = (feminine ? .10 : .06) * hips * bell(Math.abs(phi), Math.PI-.40, .46);
      const collar = .025 * bell(y / H, .796, .008) * bell(Math.abs(phi), .9, .4);
      let abs = 0;
      for (let k = 0; k < 3; k++) abs += definition * .025 * bell(y / H, .688 - k * .025, .012) * pair;
      r *= 1 + bust + rear + collar + abs;
      section.push(r);
    }
    let circumference = 0;
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments, p = -Math.PI + i / segments * TAU, q = -Math.PI + (i + 1) / segments * TAU;
      circumference += Math.hypot(section[n] * Math.sin(q) - section[i] * Math.sin(p), section[n] * Math.cos(q) - section[i] * Math.cos(p));
    }
    const scale = target / circumference;
    for (let i = 0; i < segments; i++) {
      const r = section[i] * scale;
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
    if (y < model.lm.crotchY - 1 || y > model.lm.neckBaseY) continue;
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

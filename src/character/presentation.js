// Presentation-only deformation. Canonical centimetre measurements and fit math
// never pass through this module. Apply the same map to body AND clothes.
export function presentationPoint(x, y, z, model, proportions) {
  const p = proportions, H = model.lm.H, t = y / H;
  const bump = (center, width) => Math.exp(-(((t - center) / width) ** 2));
  const legShift = H * .035 * (p.legRatio - p.torsoLength * .55);
  const crotch = model.lm.crotchY;
  const influence = y <= crotch ? y / crotch : Math.max(0, (model.lm.neckBaseY - y) / (model.lm.neckBaseY - crotch));
  const newY = y + legShift * influence;
  const shoulder = 1 + p.shoulderBreadth * .10 * bump(.79, .065);
  const full = 1 + p.fullness * .10 * bump(.61, .20);
  let newX = x * shoulder * full, newZ = z * full;
  // Volumes are applied around the limb axes, never around the world origin.
  const armT = Math.max(0, Math.min(model.lm.armLen, (model.lm.shoulderY - y) / Math.cos(model.lm.armAngle)));
  const armX = Math.abs(model.jointR.x) + Math.sin(model.lm.armAngle) * armT;
  const armWeight = Math.max(0, Math.min(1, (Math.abs(x) - model.b.shoulder * .32) / (model.upperR * 1.4)));
  const armScale = 1 + p.upperArmVolume * .22 * Math.exp(-(((armT / model.lm.armLen - .25) / .23) ** 2)) * armWeight;
  const side = x < 0 ? -1 : 1;
  newX = side * armX + (newX - side * armX) * armScale;
  newZ *= armScale;
  if (y < model.lm.hipY) {
    const midlineWeight = Math.min(1, Math.abs(x) / (model.lm.legX * .75));
    const scale = 1 + (p.thighVolume * .16 * bump(.40, .09) + p.calfVolume * .23 * bump(.20, .06)) * midlineWeight;
    const axis = side * model.lm.legX;
    newX = axis + (newX - axis) * scale;
    newZ *= scale;
  }
  return [newX, newY, newZ];
}

// All cosmetic sliders at zero map every point to itself.
export const isNeutralPresentation = p => !(p.shoulderBreadth || p.torsoLength || p.legRatio || p.upperArmVolume || p.thighVolume || p.calfVolume || p.fullness);

export function applyPresentation(geometry, model, proportions) {
  if (isNeutralPresentation(proportions)) return geometry;
  const positions = geometry.attributes.position;
  // Finite-difference Jacobian transforms smooth implicit normals, retaining the
  // continuity across marching-cubes triangles instead of creating faceted normals.
  const normals = geometry.attributes.normal;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const point = presentationPoint(x, y, z, model, proportions);
    if (normals) {
      const nx = normals.getX(i), ny = normals.getY(i), nz = normals.getZ(i);
      // Transform normal via two tangent vectors under the local deformation.
      const seed = Math.abs(ny) < .9 ? [0, 1, 0] : [1, 0, 0];
      let tx = ny * seed[2] - nz * seed[1], ty = nz * seed[0] - nx * seed[2], tz = nx * seed[1] - ny * seed[0];
      const len = Math.hypot(tx, ty, tz) || 1; tx /= len; ty /= len; tz /= len;
      const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
      const a = presentationPoint(x + tx * .05, y + ty * .05, z + tz * .05, model, proportions);
      const b = presentationPoint(x + bx * .05, y + by * .05, z + bz * .05, model, proportions);
      const ax = a[0] - point[0], ay = a[1] - point[1], az = a[2] - point[2];
      const dx = b[0] - point[0], dy = b[1] - point[1], dz = b[2] - point[2];
      const rx = ay * dz - az * dy, ry = az * dx - ax * dz, rz = ax * dy - ay * dx;
      const nlen = Math.hypot(rx, ry, rz) || 1; normals.setXYZ(i, rx / nlen, ry / nlen, rz / nlen);
    }
    positions.setXYZ(i, ...point);
  }
  positions.needsUpdate = true;
  if (normals) normals.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

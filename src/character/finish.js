// Mesh finishing for the welded body surface: volume-preserving smoothing,
// normals and ambient occlusion baked from the distance field. Runs once per
// canonical body in the worker; pure typed-array code, no three.js.

function neighbours(index, count) {
  const degree = new Uint32Array(count + 1);
  for (let i = 0; i < index.length; i++) degree[index[i] + 1] += 2;
  for (let i = 0; i < count; i++) degree[i + 1] += degree[i];
  const fill = degree.slice(0, count), list = new Uint32Array(degree[count]);
  for (let t = 0; t < index.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = index[t + k], b = index[t + (k + 1) % 3];
    list[fill[a]++] = b; list[fill[b]++] = a;
  }
  return { start: degree, list };
}

// Taubin smoothing removes marching-cubes terracing without shrinking the body.
export function smoothSurface(positions, index, iterations = 4) {
  const count = positions.length / 3, { start, list } = neighbours(index, count), next = new Float32Array(positions.length);
  for (let pass = 0; pass < iterations * 2; pass++) {
    const factor = pass % 2 ? -.53 : .5;
    for (let i = 0; i < count; i++) {
      const s = start[i], e = start[i + 1];
      if (e === s) { next.set(positions.subarray(i * 3, i * 3 + 3), i * 3); continue; }
      let x = 0, y = 0, z = 0;
      for (let k = s; k < e; k++) { const j = list[k] * 3; x += positions[j]; y += positions[j + 1]; z += positions[j + 2]; }
      const n = e - s, o = i * 3;
      next[o] = positions[o] + factor * (x / n - positions[o]);
      next[o + 1] = positions[o + 1] + factor * (y / n - positions[o + 1]);
      next[o + 2] = positions[o + 2] + factor * (z / n - positions[o + 2]);
    }
    positions.set(next);
  }
  return positions;
}

export function vertexNormals(positions, index, out = new Float32Array(positions.length)) {
  out.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3, b = index[t + 1] * 3, c = index[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { out[o] += nx; out[o + 1] += ny; out[o + 2] += nz; }
  }
  for (let o = 0; o < out.length; o += 3) {
    const l = Math.hypot(out[o], out[o + 1], out[o + 2]) || 1;
    out[o] /= l; out[o + 1] /= l; out[o + 2] /= l;
  }
  return out;
}

// Ambient occlusion from the signed distance field: march a few steps along the
// normal; nearby surfaces (armpits, between the legs, under the chin, around
// fingers and the hairline) make the field closer than the step distance.
export function bakeOcclusion(positions, normals, sdf) {
  const { field, min, spacing, N } = sdf, N2 = N * N, count = positions.length / 3, ao = new Float32Array(count);
  const sample = (x, y, z) => {
    const fx = Math.min(Math.max((x - min[0]) / spacing[0], 0), N - 1.001), fy = Math.min(Math.max((y - min[1]) / spacing[1], 0), N - 1.001), fz = Math.min(Math.max((z - min[2]) / spacing[2], 0), N - 1.001);
    const ix = fx | 0, iy = fy | 0, iz = fz | 0, tx = fx - ix, ty = fy - iy, tz = fz - iz, i = ix + iy * N + iz * N2;
    const lerp = (a, b, t) => a + (b - a) * t;
    const c00 = lerp(field[i], field[i + 1], tx), c10 = lerp(field[i + N], field[i + N + 1], tx);
    const c01 = lerp(field[i + N2], field[i + N2 + 1], tx), c11 = lerp(field[i + N2 + N], field[i + N2 + N + 1], tx);
    return -lerp(lerp(c00, c10, ty), lerp(c01, c11, ty), tz);
  };
  const steps = [1.2, 2.6, 4.5, 7.5];
  for (let v = 0; v < count; v++) {
    const o = v * 3;
    let occlusion = 0, weight = 1;
    for (const d of steps) {
      const distance = Math.min(sample(positions[o] + normals[o] * d, positions[o + 1] + normals[o + 1] * d, positions[o + 2] + normals[o + 2] * d), d);
      occlusion += weight * Math.max(0, d - distance) / d;
      weight *= .6;
    }
    ao[v] = Math.max(.3, 1 - occlusion * .55);
  }
  return ao;
}

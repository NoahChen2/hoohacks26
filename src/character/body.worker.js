import { bodyModel } from './measurements.js';
import { buildProceduralBody, weld } from './geometry.js';
import { createTorsoSampler } from './sections.js';
import { bodyWeightField, bakeBodyWeights, packSkin } from './rig.js';
import { smoothSurface, vertexNormals, bakeOcclusion } from './finish.js';
import { morphRegions } from './morph.js';

// Builds a canonical body once: implicit surface, welded, smoothed, with baked
// occlusion, skin weights and morph regions. Everything here is reused for every
// later measurement change, so it is done off the main thread exactly once.
self.onmessage = ({ data }) => {
  const { id, measurements, character, resolution } = data;
  try {
    const model = bodyModel(measurements), sampler = createTorsoSampler(model, character);
    const raw = buildProceduralBody(model, character, resolution);
    const mesh = weld(raw.attributes.position.array, raw.attributes.normal.array, raw.attributes.uv.array);
    smoothSurface(mesh.positions, mesh.index);
    vertexNormals(mesh.positions, mesh.index, mesh.normals);
    const ao = bakeOcclusion(mesh.positions, mesh.normals, raw.sdf);
    raw.dispose();
    const weights = bakeBodyWeights(mesh.positions, bodyWeightField(model, sampler));
    const regions = morphRegions(model, sampler, mesh.positions);
    const skin = packSkin(weights);
    const result = { id, ...mesh, ao, weights, regions, skinIndex: skin.index, skinWeight: skin.weight };
    self.postMessage(result, [mesh.positions, mesh.normals, mesh.uv, mesh.index, ao, weights, regions, skin.index, skin.weight].map(a => a.buffer));
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Procedural preview unavailable.' });
  }
};

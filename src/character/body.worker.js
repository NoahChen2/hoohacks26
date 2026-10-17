import { bodyModel } from './measurements.js';
import { buildProceduralBody } from './geometry.js';

self.onmessage = ({ data }) => {
  const { id, measurements, character } = data;
  try {
    const geometry = buildProceduralBody(bodyModel(measurements), character);
    const positions = geometry.attributes.position.array;
    const normals = geometry.attributes.normal.array;
    const uv = geometry.attributes.uv.array;
    self.postMessage({ id, positions, normals, uv }, [positions.buffer, normals.buffer, uv.buffer]);
    geometry.dispose();
  } catch (error) {
    self.postMessage({ id, error: error.message || 'Procedural preview unavailable.' });
  }
};

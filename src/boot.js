// Loaded before the main bundle: starts building the canonical body in its worker
// while the app code is still downloading and parsing. The geometry service
// adopts this worker and its pending job.
import { detectQuality } from './quality.js';
import { CANONICAL_MEASUREMENTS, canonicalCharacter, characterGeometryKey } from './character/canonical.js';

let preset, hair = null;
try {
  const saved = JSON.parse(localStorage.getItem('restitch.v1'))?.character;
  preset = saved?.bodyPreset; hair = saved?.appearance?.hair ?? null;
} catch { /* no saved body */ }
// Unknown or missing hairstyles resolve by body type, as in the app.
const character = canonicalCharacter(preset, hair);
const worker = new Worker(new URL('./character/body.worker.js', import.meta.url), { type: 'module' });
// The quick draft mesh comes first; the app refines it in the background.
const resolution = detectQuality().draftResolution;
const early = { worker, job: { id: 0, resolution, key: characterGeometryKey(CANONICAL_MEASUREMENTS, character) }, result: null };
worker.onmessage = ({ data }) => { early.result = data; };
worker.postMessage({ id: 0, measurements: CANONICAL_MEASUREMENTS, character, resolution });
globalThis.__restitchBodyWorker = early;

// Loaded before the main bundle: starts building the canonical body in its worker
// while the app code is still downloading and parsing. The geometry service
// adopts this worker and its pending job.
import { detectQuality } from './quality.js';
import { CANONICAL_MEASUREMENTS, canonicalCharacter, characterGeometryKey } from './character/canonical.js';

let preset;
try { preset = JSON.parse(localStorage.getItem('restitch.v1'))?.character?.bodyPreset; } catch { /* no saved body */ }
const character = canonicalCharacter(preset);
const worker = new Worker(new URL('./character/body.worker.js', import.meta.url), { type: 'module' });
const early = { worker, job: { id: 0, key: characterGeometryKey(CANONICAL_MEASUREMENTS, character) }, result: null };
worker.onmessage = ({ data }) => { early.result = data; };
worker.postMessage({ id: 0, measurements: CANONICAL_MEASUREMENTS, character, resolution: detectQuality().bodyResolution });
globalThis.__restitchBodyWorker = early;

// Photo → garments. The server's vision model identifies the clothes when it is
// configured; otherwise (or when the server is unreachable) the photo is
// scanned on this device. Either way the result is sized to the wearer's body.
import { garmentFromSpec } from '../garments.js';
import { validateUpload } from '../studio/schema.js';
import { IdentifyResultSchema, ScannedGarmentSchema } from './schema.js';
import { localScan } from './localScan.js';

const MAX_EDGE = 1024;
const SCAN_EDGE = 96;

async function decode(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawn(image, edge) {
  const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/**
 * Scan a garment photo. Resolves to { mode: 'live'|'device', notice, specs, garments }.
 * `body` (cm measurements) sizes the garments; `signal` aborts the server request.
 */
export async function scanPhoto(file, { body = null, signal } = {}) {
  const problem = validateUpload(file);
  if (problem) throw new Error(problem);
  let image;
  try {
    image = await decode(file);
  } catch {
    throw new Error('This photo could not be opened. Choose another image.');
  }
  let result = null, failure = '';
  try {
    // A downscaled JPEG keeps the request small; vision models need no more.
    const imageDataUrl = drawn(image, MAX_EDGE).canvas.toDataURL('image/jpeg', 0.88);
    const response = await fetch('/api/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageDataUrl }), signal });
    const payload = await response.json().catch(() => null);
    if (response.ok) result = IdentifyResultSchema.safeParse(payload).data || null;
    else failure = payload?.error || '';
  } catch (error) {
    if (error.name === 'AbortError') throw error;
  }
  let mode = 'live', notice = result?.notice || '', specs = result?.garments || [];
  // No vision model, an unreachable server or a failed scan: scan on this device.
  if (!result || result.mode === 'demo') {
    const { ctx, canvas } = drawn(image, SCAN_EDGE);
    specs = localScan(ctx.getImageData(0, 0, canvas.width, canvas.height)).filter((s) => ScannedGarmentSchema.safeParse(s).success);
    mode = 'device';
    const reason = result?.notice || `${failure || 'The scanning service was unavailable.'} This photo was scanned on your device from its shapes and colours instead.`;
    notice = `${reason} Check each piece’s type and measurements.`;
  }
  return { mode, notice, specs, garments: specs.map((spec) => garmentFromSpec(spec, body)) };
}

// Hands garments from other pages (AI Studio scans, Explore try-ons) to the
// fitting room. The fitting room adds them to whichever closet is active, so
// they also reach a signed-in account's closet once it loads.
import { GARMENT_TYPES } from '../garments.js';

const INCOMING = 'restitch.incoming';
const SCANS = 'restitch.scans';
const MAX_INCOMING = 12;
const MAX_SCANS = 20;

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
const valid = (g) => g && typeof g.id === 'string' && GARMENT_TYPES[g.type];

/** Queue garments for the fitting room; false when browser storage is unavailable. */
export function queueGarments(list) {
  const queued = read(INCOMING, []).filter(valid).filter((g) => !list.some((n) => n.id === g.id));
  return write(INCOMING, [...queued, ...list.filter(valid)].slice(-MAX_INCOMING));
}

/** Withdraw queued garments the fitting room has not picked up yet. */
export function unqueueGarments(ids) {
  return write(INCOMING, read(INCOMING, []).filter((g) => valid(g) && !ids.includes(g.id)));
}

/** Read and clear the queue. */
export function takeIncoming() {
  const list = read(INCOMING, []);
  if (!Array.isArray(list) || !list.length) return [];
  try {
    localStorage.removeItem(INCOMING);
  } catch { /* storage unavailable */ }
  return list.filter(valid);
}

// Garments scanned from a studio photo, kept with the AI ideas made from it so
// a saved project can be tried on later.
export function rememberScan(photoId, garments) {
  const scans = read(SCANS, {});
  scans[photoId] = { at: Date.now(), garments };
  const recent = Object.entries(scans).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_SCANS);
  write(SCANS, Object.fromEntries(recent));
}
export function scannedGarments(photoId) {
  const entry = read(SCANS, {})[photoId];
  return Array.isArray(entry?.garments) ? entry.garments.filter(valid) : [];
}

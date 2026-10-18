import * as THREE from 'three';
import { characterGeometryKey } from './canonical.js';
export { characterGeometryKey };

// At most one calculation in flight and one pending: dragging never builds a
// backlog of obsolete meshes. CPU-only originals are retained in a small LRU.
// Background requests (refining a draft, warming other shapes) wait in their own
// queue and never cancel or delay foreground work.
const keyFor = (resolution, measurements, character) => `${resolution}|${characterGeometryKey(measurements, character)}`;

export class CharacterGeometryService {
  // `resolution` is the default marching-cubes grid; lower it on low-end devices.
  // `store` (optional) persists built meshes across visits: { get(key), put(key, data) }.
  constructor({ resolution = 128, store = null } = {}) {
    this.cache = new Map(); this.active = null; this.pending = null; this.background = []; this.sequence = 0; this.resolution = resolution; this.store = store;
    // Adopt the worker the boot script started before the app bundle loaded.
    const early = globalThis.__restitchBodyWorker;
    delete globalThis.__restitchBodyWorker;
    this.worker = early?.worker || new Worker(new URL('./body.worker.js', import.meta.url), { type: 'module' });
    if (early) {
      this.active = { ...early.job, key: `${early.job.resolution ?? resolution}|${early.job.key}` };
      this.active.promise = new Promise((resolve, reject) => { this.active.resolve = resolve; this.active.reject = reject; });
      this.active.promise.catch(() => {});
    }
    this.worker.onmessage = ({ data }) => {
      const job = this.active;
      if (!job || data.id !== job.id) return;
      this.active = null;
      if (data.error) job.reject(new Error(data.error));
      else {
        const geometry = toGeometry(data);
        this.store?.put(job.key, data);
        this.remember(job.key, geometry);
        job.resolve(geometry);
      }
      this.next();
    };
    this.worker.onerror = () => {
      this.failed = true;
      const error = new Error('The character worker could not run. Reload to retry the procedural preview.');
      for (const job of [this.active, this.pending, ...this.background]) job?.reject(error);
      this.active = this.pending = null; this.background = [];
    };
    if (early?.result) this.worker.onmessage({ data: early.result });
    // A body stored on an earlier visit answers the boot job straight away.
    else if (early && store) {
      const earlyId = this.active.id, earlyKey = this.active.key;
      store.get(earlyKey).then((data) => {
        const job = this.active;
        if (!data || !job || job.id !== earlyId) return;
        this.active = null;
        const geometry = toGeometry(data);
        this.remember(job.key, geometry);
        job.resolve(geometry);
        this.next();
      });
    }
  }
  remember(key, geometry) {
    this.cache.set(key, geometry);
    if (this.cache.size > 8) {
      const oldest = this.cache.keys().next().value;
      this.cache.get(oldest).dispose(); this.cache.delete(oldest);
    }
  }
  next() {
    const job = this.pending || this.background.shift();
    if (job === this.pending) this.pending = null;
    if (job) this.start(job);
  }
  start(job) {
    this.active = job;
    this.worker.postMessage({ id: job.id, measurements: job.measurements, character: job.character, resolution: job.resolution });
  }
  // Options: `resolution` (defaults to the service's), `background` (queue
  // behind foreground work instead of superseding it).
  request(measurements, character, { resolution = this.resolution, background = false } = {}) {
    const key = keyFor(resolution, measurements, character);
    const known = this.cache.has(key) || this.active?.key === key || this.pending?.key === key || this.background.some(job => job.key === key);
    if (!this.store || known) return this.requestNow(measurements, character, resolution, background);
    // Check the persistent store first; fall back to building in the worker.
    return this.store.get(key).then((data) => {
      if (data && !this.cache.has(key)) this.remember(key, toGeometry(data));
      return this.requestNow(measurements, character, resolution, background);
    });
  }
  requestNow(measurements, character, resolution = this.resolution, background = false) {
    if (this.failed) return Promise.reject(new Error('Character worker unavailable. Reload to retry.'));
    const key = keyFor(resolution, measurements, character);
    if (this.cache.has(key)) {
      if (!background) { this.pending?.reject(new Error('Superseded body request.')); this.pending = null; }
      const geometry = this.cache.get(key); this.cache.delete(key); this.cache.set(key, geometry);
      return Promise.resolve(geometry);
    }
    if (this.active?.key === key) {
      if (!background) { this.pending?.reject(new Error('Superseded body request.')); this.pending = null; }
      return this.active.promise;
    }
    if (this.pending?.key === key) return this.pending.promise;
    const queued = this.background.findIndex(job => job.key === key);
    if (queued >= 0) {
      if (background) return this.background[queued].promise;
      // Asked for in the foreground now: promote it.
      const [job] = this.background.splice(queued, 1);
      this.pending?.reject(new Error('Superseded body request.'));
      this.pending = job;
      if (!this.active) this.next();
      return job.promise;
    }
    const job = { id: ++this.sequence, key, resolution, measurements: structuredClone(measurements), character: structuredClone(character) };
    job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
    if (!this.active) this.start(job);
    else if (background) this.background.push(job);
    else { this.pending?.reject(new Error('Superseded body request.')); this.pending = job; }
    return job.promise;
  }
  dispose() {
    this.worker.terminate();
    for (const job of [this.active, this.pending, ...this.background]) job?.reject(new Error('Viewer closed.'));
    this.background = [];
    this.cache.forEach(geometry => geometry.dispose()); this.cache.clear();
  }
}

function toGeometry(data) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
  if (data.index) geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  if (data.skinIndex) {
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(data.skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(data.skinWeight, 4));
  }
  // Full per-bone weights for garment weight transfer (kept off userData,
  // which clone() would serialize).
  geometry.skinWeights = data.weights || null;
  geometry.regions = data.regions || null;
  if (data.ao) geometry.setAttribute('ao', new THREE.BufferAttribute(data.ao, 1));
  if (data.hairMask) geometry.setAttribute('hairMask', new THREE.BufferAttribute(data.hairMask, 1));
  geometry.userData.source = 'procedural-fallback';
  return geometry;
}

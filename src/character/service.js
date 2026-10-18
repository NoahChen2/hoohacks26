import * as THREE from 'three';
import { characterGeometryKey } from './canonical.js';
export { characterGeometryKey };

// At most one calculation in flight and one pending: dragging never builds a
// backlog of obsolete meshes. CPU-only originals are retained in a small LRU.
export class CharacterGeometryService {
  // `resolution` is the marching-cubes grid; lower it on low-end devices.
  constructor({ resolution = 128 } = {}) {
    this.cache = new Map(); this.active = null; this.pending = null; this.sequence = 0; this.resolution = resolution;
    // Adopt the worker the boot script started before the app bundle loaded.
    const early = globalThis.__restitchBodyWorker;
    delete globalThis.__restitchBodyWorker;
    this.worker = early?.worker || new Worker(new URL('./body.worker.js', import.meta.url), { type: 'module' });
    if (early) {
      this.active = { ...early.job };
      this.active.promise = new Promise((resolve, reject) => { this.active.resolve = resolve; this.active.reject = reject; });
      this.active.promise.catch(() => {});
    }
    this.worker.onmessage = ({ data }) => {
      const job = this.active;
      if (!job || data.id !== job.id) return;
      this.active = null;
      if (data.error) job.reject(new Error(data.error));
      else {
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
        geometry.userData.source = 'procedural-fallback';
        this.cache.set(job.key, geometry);
        if (this.cache.size > 4) {
          const key = this.cache.keys().next().value;
          this.cache.get(key).dispose(); this.cache.delete(key);
        }
        job.resolve(geometry);
      }
      if (this.pending) { const next = this.pending; this.pending = null; this.start(next); }
    };
    this.worker.onerror = () => {
      this.failed = true;
      const error = new Error('The character worker could not run. Reload to retry the procedural preview.');
      this.active?.reject(error); this.pending?.reject(error);
      this.active = this.pending = null;
    };
    if (early?.result) this.worker.onmessage({ data: early.result });
  }
  start(job) {
    this.active = job;
    this.worker.postMessage({ id: job.id, measurements: job.measurements, character: job.character, resolution: this.resolution });
  }
  request(measurements, character) {
    if (this.failed) return Promise.reject(new Error('Character worker unavailable. Reload to retry.'));
    const key = characterGeometryKey(measurements, character);
    if (this.cache.has(key)) {
      this.pending?.reject(new Error('Superseded body request.')); this.pending = null;
      const geometry = this.cache.get(key); this.cache.delete(key); this.cache.set(key, geometry);
      return Promise.resolve(geometry);
    }
    if (this.active?.key === key) {
      this.pending?.reject(new Error('Superseded body request.')); this.pending = null;
      return this.active.promise;
    }
    if (this.pending?.key === key) return this.pending.promise;
    const job = { id: ++this.sequence, key, measurements: structuredClone(measurements), character: structuredClone(character) };
    job.promise = new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
    if (!this.active) this.start(job);
    else { this.pending?.reject(new Error('Superseded body request.')); this.pending = job; }
    return job.promise;
  }
  dispose() {
    this.worker.terminate();
    this.active?.reject(new Error('Viewer closed.')); this.pending?.reject(new Error('Viewer closed.'));
    this.cache.forEach(geometry => geometry.dispose()); this.cache.clear();
  }
}

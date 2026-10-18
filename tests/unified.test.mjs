import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyModel } from '../src/character/measurements.js';
import { CharacterGeometryService } from '../src/character/service.js';
import { canTryOn, garmentSpecFromProject, garmentSpecFromAnalysis, sizeGarmentToBody } from '../src/shell/tryOn.js';

const M = { height: 172, chest: 96, underbust: 84, waist: 80, hips: 99, shoulder: 44, arm: 61, inseam: 79, neck: 38, thigh: 57 };
const XL6 = { height: 172, chest: 172, underbust: 158, waist: 170, hips: 174, shoulder: 57, arm: 65, inseam: 76, neck: 56, thigh: 97 };

test('arms keep the 13 degree A-pose for straight sizes and open up for larger bodies', () => {
  const deg = (b) => (bodyModel(b).lm.armAngle * 180) / Math.PI;
  assert.ok(Math.abs(deg(M) - 13) < 1e-9);
  assert.ok(deg(XL6) > 18 && deg(XL6) <= 30);
});

test('wearable Explore projects become garments sized to the saved body', () => {
  const dress = { kind: 'dress', title: 'Prairie dress', color: 'Rose', materials: ['Old dress'] };
  const bag = { kind: 'bag', title: 'Tote', color: 'Terracotta', materials: ['Jeans'] };
  assert.equal(canTryOn(dress), true);
  assert.equal(canTryOn(bag), false);
  assert.equal(garmentSpecFromProject(bag), null);
  assert.deepEqual(garmentSpecFromProject(dress), { type: 'dress', name: 'Prairie dress', color: '#d98a9a', pattern: 'solid', material: undefined });
  const tee = { chest: 108, waist: 106, hem: 106, length: 72, shoulder: 47 };
  const sized = sizeGarmentToBody(tee, XL6);
  assert.equal(sized.chest, 172 + 12);
  assert.equal(sized.waist, 170 + 26);
  assert.equal(sized.shoulder, 57 + 3);
  assert.deepEqual(sizeGarmentToBody(tee, M), tee);
});

test('AI Studio garment text maps onto a 3D garment type', () => {
  const spec = (garmentType, estimatedFabric = '') => garmentSpecFromAnalysis({ garmentType, estimatedFabric, visibleColors: ['navy'] });
  assert.equal(spec('Denim jacket').type, 'jacket');
  assert.equal(spec('Wool cardigan').type, 'cardigan');
  assert.equal(spec('Denim jacket').pattern, 'denim');
  assert.equal(spec('Graphic T-shirt').type, 'tshirt');
  assert.equal(spec('Pleated midi skirt').type, 'skirt');
  assert.equal(spec('Hooded sweatshirt').type, 'hoodie');
  assert.equal(spec('Graphic T-shirt').color, '#26324f');
});

test('geometry service answers from its persistent store without building', async () => {
  const original = globalThis.Worker;
  const posted = [];
  globalThis.Worker = class { postMessage(message) { posted.push(message); } terminate() {} };
  const stored = { positions: new Float32Array(9), normals: new Float32Array(9), uv: new Float32Array(6) };
  const puts = [];
  const store = { get: async (key) => (key.startsWith('64|') ? stored : null), put: (key) => puts.push(key) };
  try {
    const service = new CharacterGeometryService({ resolution: 64, store });
    const geometry = await service.request({ height: 172 }, { bodyPreset: 'feminine', proportions: { muscleDefinition: 0.15 } });
    assert.equal(geometry.attributes.position.count, 3);
    assert.equal(posted.length, 0);
    assert.equal(puts.length, 0);
    service.dispose();
  } finally {
    globalThis.Worker = original;
  }
});

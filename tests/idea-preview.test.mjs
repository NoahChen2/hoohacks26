import test from 'node:test';
import assert from 'node:assert/strict';
import { garmentFromSpec } from '../src/garments.js';
import { previewIdea } from '../src/studio/ideaPreview.js';

const body = { height: 172, chest: 96, underbust: 84, waist: 80, hips: 99, shoulder: 44, arm: 61, inseam: 79, neck: 38, thigh: 57 };
const base = (spec) => ({ spec, garment: { ...garmentFromSpec(spec, body), id: 'scan-1' } });
const idea = (title, description = '', instructions = ['Plan it.', 'Make it.', 'Wear it.']) => ({ title, description, instructions });
const tee = base({ type: 'tshirt', color: '#f2f0ea', pattern: 'solid', material: 'cotton', fit: 'regular', length: 'regular', sleeves: 'short' });
const jeans = base({ type: 'jeans', color: '#3b5a85', pattern: 'denim', material: 'denim', fit: 'regular', length: 'regular', sleeves: 'none' });
const sweater = base({ type: 'sweater', color: '#8b8d90', pattern: 'solid', material: 'wool', fit: 'regular', length: 'regular', sleeves: 'long' });

test('a cropped, embroidered tee is shorter and floral, with the photo colour kept', () => {
  const { garment, changes, worn } = previewIdea(idea('Daisy crop top', 'Crop the tee and embroider daisies with yellow floss.'), tee, body);
  assert.equal(worn, true);
  assert.equal(garment.type, 'tshirt');
  assert.ok(garment.length < tee.garment.length);
  assert.equal(garment.pattern, 'floral');
  assert.equal(garment.color, '#f2f0ea');
  assert.equal(garment.color2, '#e6c14a');
  assert.deepEqual(changes, ['Cropped', 'Embroidered flowers']);
  assert.notEqual(garment.id, tee.garment.id);
});

test('jeans become shorts or a mini skirt', () => {
  assert.equal(previewIdea(idea('Frayed cut-off shorts', 'Cut the legs and fray the hems.'), jeans, body).garment.type, 'shorts');
  assert.equal(previewIdea(idea('Frayed cut-off shorts', 'Cut the legs and fray the hems.'), jeans, body).garment.holes, true);
  const skirt = previewIdea(idea('Denim mini skirt', 'Open the inseams and turn the jeans into a mini skirt.'), jeans, body);
  assert.equal(skirt.garment.type, 'skirt');
  assert.ok(skirt.changes.includes('Remade as a skirt'));
});

test('sleeves, cardigans and dye', () => {
  assert.equal(previewIdea(idea('Sleeveless muscle tee', 'Cut off the sleeves along the seam.'), tee, body).garment.type, 'tank');
  assert.equal(previewIdea(idea('Cosy cardigan', 'Cut straight down the centre front and add buttons.'), sweater, body).garment.type, 'cardigan');
  const dyed = previewIdea(idea('Midnight refresh', 'Overdye the sweater navy in a dye bath.'), sweater, body);
  assert.equal(dyed.garment.color, '#26324f');
  assert.deepEqual(dyed.changes, ['Dyed a new colour']);
});

test('things made from the garment show the source, and verbs are not patterns', () => {
  const tote = previewIdea(idea('Tee tote bag', 'Turn the tee into a tote bag.'), tee, body);
  assert.equal(tote.worn, false);
  const knot = previewIdea(idea('A loose knotted accent', 'Restyle an edge.', ['Check that an intact edge is long enough.', 'Make a gentle knot with no tension.', 'Try on and move freely.']), tee, body);
  assert.deepEqual(knot.changes, ['Knotted at the waist']);
  assert.equal(knot.garment.pattern, 'solid');
});

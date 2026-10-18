// Garment catalog shared by the app, the 3D builder and the server (no browser APIs here).
//
// kind   — which geometry builder draws it (top, dress, bottom, skirt).
// slot   — what it replaces when put on: one piece per slot is worn at a time.
//          A dress fills both the base and lower slots.
// layer  — dressing order on the 3D body; higher layers are built outside lower ones.
// open   — front opening (outerwear worn over something shows what's beneath).

export const GARMENT_TYPES = {
  tshirt: { label: 'T-shirt', kind: 'top', sleeves: true, slot: 'base', layer: 1 },
  longsleeve: { label: 'Long-sleeve tee', kind: 'top', sleeves: true, slot: 'base', layer: 1 },
  crop: { label: 'Crop top', kind: 'top', sleeves: true, slot: 'base', layer: 1 },
  tank: { label: 'Tank top', kind: 'top', sleeves: false, slot: 'base', layer: 1 },
  cami: { label: 'Camisole', kind: 'top', sleeves: false, slot: 'base', layer: 1 },
  polo: { label: 'Polo shirt', kind: 'top', sleeves: true, slot: 'base', layer: 1 },
  buttonup: { label: 'Button-up shirt', kind: 'top', sleeves: true, slot: 'base', layer: 1 },
  blouse: { label: 'Blouse', kind: 'top', sleeves: true, slot: 'base', layer: 1 },
  hoodie: { label: 'Hoodie / sweatshirt', kind: 'top', sleeves: true, slot: 'mid', layer: 2 },
  sweater: { label: 'Sweater', kind: 'top', sleeves: true, slot: 'mid', layer: 2 },
  cardigan: { label: 'Cardigan', kind: 'top', sleeves: true, slot: 'outer', layer: 3, open: true },
  vest: { label: 'Vest / gilet', kind: 'top', sleeves: false, slot: 'outer', layer: 3, open: true },
  jacket: { label: 'Jacket', kind: 'top', sleeves: true, slot: 'outer', layer: 3, open: true },
  coat: { label: 'Long coat', kind: 'top', sleeves: true, slot: 'outer', layer: 3, open: true },
  jeans: { label: 'Jeans / trousers', kind: 'bottom', slot: 'lower', layer: 0 },
  joggers: { label: 'Joggers / sweatpants', kind: 'bottom', slot: 'lower', layer: 0 },
  leggings: { label: 'Leggings', kind: 'bottom', slot: 'lower', layer: 0 },
  shorts: { label: 'Shorts', kind: 'bottom', slot: 'lower', layer: 0 },
  skirt: { label: 'Skirt', kind: 'skirt', slot: 'lower', layer: 0.5 },
  dress: { label: 'Dress', kind: 'dress', sleeves: true, slot: 'dress', layer: 1 },
  slipdress: { label: 'Slip / sun dress', kind: 'dress', sleeves: false, slot: 'dress', layer: 1 },
};

export const PATTERNS = ['solid', 'stripes', 'vstripes', 'plaid', 'polka', 'floral', 'denim', 'gingham'];
export const MATERIALS = {
  cotton: { label: 'Cotton jersey (knit)', knit: true, frays: false },
  woven: { label: 'Cotton woven / poplin', knit: false, frays: true },
  denim: { label: 'Denim', knit: false, frays: true },
  fleece: { label: 'Fleece / sweatshirt', knit: true, frays: false },
  wool: { label: 'Wool knit', knit: true, frays: false },
  poly: { label: 'Polyester / synthetic', knit: false, frays: true },
  linen: { label: 'Linen', knit: false, frays: true },
};

const typeOf = (type) => GARMENT_TYPES[type] || GARMENT_TYPES.tshirt;
export const garmentKind = (g) => typeOf(g.type).kind;
export const garmentLayer = (g) => typeOf(g.type).layer ?? 1;

// Slots a garment occupies; a dress covers both the base top and the lower half.
export function garmentSlots(g) {
  const slot = typeOf(g.type).slot;
  return slot === 'dress' ? ['base', 'lower'] : [slot];
}

// The outfit after putting `g` on: anything sharing one of its slots comes off.
export function dressOutfit(outfit, g) {
  const slots = new Set(garmentSlots(g));
  return [...outfit.filter((o) => o.id !== g.id && !garmentSlots(o).some((s) => slots.has(s))), g];
}

// Inside-out dressing order for the 3D body.
export const layerOrder = (list) => [...list].sort((a, b) => garmentLayer(a) - garmentLayer(b));

// Garment measurement fields (flat-lay measurements, doubled to circumference where noted).
export function garmentFields(type) {
  const k = typeOf(type).kind;
  const f = [];
  if (k === 'top' || k === 'dress') {
    f.push(['chest', 'Chest (circumference)', 60, 160]);
    f.push(['waist', 'Waist (circumference)', 50, 160]);
    f.push(['hem', 'Hem (circumference)', 50, 200]);
    f.push(['length', 'Length (shoulder → hem)', 30, 150]);
    f.push(['shoulder', 'Shoulder width', 28, 64]);
    if (typeOf(type).sleeves) {
      f.push(['sleeve', 'Sleeve length', 5, 80]);
      f.push(['sleeveOpen', 'Sleeve opening (circ.)', 14, 60]);
    }
  }
  if (k === 'bottom') {
    f.push(['waist', 'Waist (circumference)', 50, 140]);
    f.push(['hips', 'Hips (circumference)', 70, 150]);
    f.push(['rise', 'Front rise', 15, 40]);
    f.push(['inseam', 'Inseam', 5, 95]);
    f.push(['legOpen', 'Leg opening (circ.)', 18, 80]);
  }
  if (k === 'skirt') {
    f.push(['waist', 'Waist (circumference)', 50, 140]);
    f.push(['hips', 'Hips (circumference)', 70, 160]);
    f.push(['hem', 'Hem (circumference)', 70, 300]);
    f.push(['length', 'Length', 25, 110]);
  }
  return f;
}

const MEASUREMENTS = {
  tshirt: { chest: 108, waist: 106, hem: 106, length: 72, shoulder: 47, sleeve: 21, sleeveOpen: 38 },
  longsleeve: { chest: 104, waist: 100, hem: 100, length: 70, shoulder: 45, sleeve: 63, sleeveOpen: 22 },
  crop: { chest: 94, waist: 90, hem: 90, length: 46, shoulder: 41, sleeve: 15, sleeveOpen: 32 },
  tank: { chest: 98, waist: 96, hem: 98, length: 70, shoulder: 34 },
  cami: { chest: 92, waist: 90, hem: 96, length: 58, shoulder: 30 },
  polo: { chest: 108, waist: 106, hem: 106, length: 72, shoulder: 46, sleeve: 22, sleeveOpen: 36 },
  buttonup: { chest: 112, waist: 106, hem: 108, length: 78, shoulder: 47, sleeve: 63, sleeveOpen: 24 },
  blouse: { chest: 102, waist: 94, hem: 100, length: 64, shoulder: 40, sleeve: 58, sleeveOpen: 24 },
  hoodie: { chest: 120, waist: 112, hem: 100, length: 70, shoulder: 52, sleeve: 62, sleeveOpen: 20 },
  sweater: { chest: 112, waist: 104, hem: 96, length: 66, shoulder: 48, sleeve: 62, sleeveOpen: 20 },
  cardigan: { chest: 114, waist: 110, hem: 108, length: 68, shoulder: 47, sleeve: 61, sleeveOpen: 22 },
  vest: { chest: 108, waist: 104, hem: 104, length: 62, shoulder: 38 },
  jacket: { chest: 118, waist: 114, hem: 112, length: 64, shoulder: 49, sleeve: 63, sleeveOpen: 28 },
  coat: { chest: 122, waist: 116, hem: 132, length: 100, shoulder: 49, sleeve: 64, sleeveOpen: 30 },
  jeans: { waist: 84, hips: 102, rise: 26, inseam: 80, legOpen: 38 },
  joggers: { waist: 80, hips: 106, rise: 28, inseam: 74, legOpen: 24 },
  leggings: { waist: 68, hips: 88, rise: 24, inseam: 74, legOpen: 20 },
  shorts: { waist: 84, hips: 104, rise: 26, inseam: 15, legOpen: 58 },
  skirt: { waist: 74, hips: 100, hem: 130, length: 60 },
  dress: { chest: 94, waist: 78, hem: 150, length: 105, shoulder: 38, sleeve: 12, sleeveOpen: 32 },
  slipdress: { chest: 92, waist: 80, hem: 150, length: 108, shoulder: 30 },
};

const MATERIAL_DEFAULTS = {
  jeans: 'denim', shorts: 'denim', jacket: 'denim', hoodie: 'fleece', joggers: 'fleece', sweater: 'wool', cardigan: 'wool', coat: 'wool',
  buttonup: 'woven', blouse: 'poly', dress: 'woven', slipdress: 'poly', vest: 'linen',
};

const newId = () => Math.random().toString(36).slice(2, 9);

export function defaultGarment(type = 'tshirt') {
  if (!GARMENT_TYPES[type]) type = 'tshirt';
  const base = {
    id: newId(),
    name: GARMENT_TYPES[type].label,
    type,
    color: '#3d7ea6',
    color2: '#f4efe6',
    pattern: 'solid',
    material: MATERIAL_DEFAULTS[type] || 'cotton',
    stains: false,
    holes: false,
    sketch: null, // dataURL of the 2D drawing layer
  };
  if (type === 'jeans' || type === 'shorts' || type === 'jacket') {
    base.color = '#3b5a85';
    base.pattern = 'denim';
  }
  return { ...base, ...MEASUREMENTS[type] };
}

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FIT_EASE = { fitted: 0.35, regular: 1, relaxed: 1.6, oversized: 2.4 };
const LENGTH_SCALE = { cropped: 0.72, short: 0.88, regular: 1, long: 1.2 };

/**
 * A garment from a description (a photo scan or a catalog preset), sized to the
 * wearer: ease follows the fit word, lengths follow the length/sleeve words.
 * Unknown values fall back to the type defaults, so any partial spec is safe.
 */
export function garmentFromSpec(spec = {}, body = null) {
  const g = defaultGarment(spec.type);
  const type = g.type;
  if (typeof spec.name === 'string' && spec.name.trim()) g.name = spec.name.trim().slice(0, 60);
  if (HEX.test(spec.color || '')) g.color = spec.color.toLowerCase();
  if (HEX.test(spec.color2 || '')) g.color2 = spec.color2.toLowerCase();
  if (MATERIALS[spec.material]) g.material = spec.material;
  if (PATTERNS.includes(spec.pattern)) g.pattern = spec.pattern;
  // Denim twill is only a default for denim; black trousers stay plain.
  else if (g.pattern === 'denim' && g.material !== 'denim') g.pattern = 'solid';
  g.stains = !!spec.stains;
  g.holes = !!spec.holes;
  const kind = GARMENT_TYPES[type].kind;
  const ease = FIT_EASE[spec.fit] ?? 1;
  const scale = LENGTH_SCALE[spec.length] ?? 1;
  if (body) {
    // Re-centre the default ease on the wearer's own measurements.
    const base = defaultGarment(type);
    if (kind === 'top' || kind === 'dress') {
      g.chest = body.chest + (base.chest - 96) * ease;
      g.waist = body.waist + (base.waist - 80) * ease;
      if (kind === 'top') g.hem = body.hips + (base.hem - 99) * ease;
      g.shoulder = body.shoulder + (base.shoulder - 44) * Math.min(ease, 1.6);
    } else {
      // Waistbands sit close whatever the cut; stretch leggings sit under the waist.
      g.waist = body.waist + (type === 'leggings' ? -4 : 1 + 3 * Math.min(ease, 2));
      g.hips = body.hips + (base.hips - 99) * ease;
      if (kind === 'bottom') g.inseam = base.inseam * (body.inseam / 79);
    }
  } else if (kind === 'top' || kind === 'dress') {
    g.chest += (ease - 1) * 10;
    g.waist += (ease - 1) * 10;
  }
  if (kind === 'top' || kind === 'dress' || kind === 'skirt') g.length *= scale;
  if (kind === 'bottom' && type !== 'shorts') g.inseam *= scale === 1 ? 1 : clamp(scale, 0.45, 1.05);
  if (GARMENT_TYPES[type].sleeves && spec.sleeves) {
    const arm = body?.arm || 61;
    const sleeve = { short: 0.33, 'three-quarter': 0.7, long: 1.03 }[spec.sleeves];
    if (sleeve) g.sleeve = arm * sleeve;
  }
  for (const [key, , min, max] of garmentFields(type)) g[key] = Math.round(clamp(g[key], min, max) * 2) / 2;
  return g;
}

// Ready-made pieces for the closet's starter rail and for trying on catalog projects.
export const STARTER_PIECES = [
  { type: 'tshirt', name: 'White tee', color: '#f3f1ec', material: 'cotton' },
  { type: 'tshirt', name: 'Breton stripe tee', color: '#f4efe6', color2: '#1f3a68', pattern: 'stripes' },
  { type: 'longsleeve', name: 'Heather long-sleeve', color: '#9aa3ad' },
  { type: 'crop', name: 'Lilac crop top', color: '#c3a6e0' },
  { type: 'tank', name: 'Black tank', color: '#1d1c22' },
  { type: 'cami', name: 'Satin cami', color: '#e9c6a6', material: 'poly' },
  { type: 'polo', name: 'Green polo', color: '#2f6b4f' },
  { type: 'buttonup', name: 'Oxford shirt', color: '#bcd4ea', material: 'woven' },
  { type: 'blouse', name: 'Floral blouse', color: '#f6e7ee', color2: '#c2456b', pattern: 'floral' },
  { type: 'hoodie', name: 'Grey hoodie', color: '#8d8f94' },
  { type: 'sweater', name: 'Cream knit sweater', color: '#eadfc8' },
  { type: 'cardigan', name: 'Mustard cardigan', color: '#d39b2a' },
  { type: 'vest', name: 'Quilted gilet', color: '#5b6e45', material: 'poly' },
  { type: 'jacket', name: 'Denim jacket', color: '#4b6fa0', pattern: 'denim', material: 'denim' },
  { type: 'jacket', name: 'Leather-look jacket', color: '#26222a', material: 'poly' },
  { type: 'coat', name: 'Camel coat', color: '#b88a5a' },
  { type: 'jeans', name: 'Straight jeans', color: '#3b5a85', pattern: 'denim' },
  { type: 'jeans', name: 'Black trousers', color: '#24242a', material: 'woven' },
  { type: 'joggers', name: 'Grey joggers', color: '#7d8087' },
  { type: 'leggings', name: 'Black leggings', color: '#18171c' },
  { type: 'shorts', name: 'Denim shorts', color: '#6f8fbf', pattern: 'denim' },
  { type: 'skirt', name: 'Plaid mini skirt', color: '#8c2f39', color2: '#1e2533', pattern: 'plaid', material: 'wool', length: 'cropped' },
  { type: 'skirt', name: 'Pleated midi skirt', color: '#6c8a74', length: 'long' },
  { type: 'dress', name: 'Gingham dress', color: '#f7f3ec', color2: '#d1495b', pattern: 'gingham' },
  { type: 'slipdress', name: 'Floral sundress', color: '#f3dfb5', color2: '#b44a6a', pattern: 'floral' },
];

// Turns an idea (an Explore project or an AI Studio analysis) into a garment
// sized for the saved body, so it can be previewed on the 3D figure in place.
import { scannedGarments } from '../tryon/outfitStore.js';

// Each project kind as its cover illustration draws it
// (scripts/generate-explore-assets.mjs), in garmentFromSpec's words. Bags and
// aprons are not worn on the body.
const KIND_SHAPES = {
  denim: { type: 'cami', neckline: 'strapless', fit: 'fitted', length: 'cropped' }, // laced corset top
  cami: { type: 'cami' },
  halter: { type: 'cami', neckline: 'halter', fit: 'relaxed', length: 'short' }, // flared halter
  vest: { type: 'vest' },
  longsleeve: { type: 'longsleeve', sleeves: 'long' },
  blouse: { type: 'blouse' },
  crop: { type: 'crop', sleeves: 'long' },
  cardigan: { type: 'cardigan', sleeves: 'long' },
  hoodie: { type: 'hoodie' },
  jacket: { type: 'jacket' },
  wrap: { type: 'buttonup', sleeves: 'long' },
  shirt: { type: 'buttonup', sleeves: 'long' },
  tee: { type: 'tshirt', sleeves: 'short' },
  skirt: { type: 'skirt', length: 'long' }, // A-line to the knee
  jeans: { type: 'jeans' },
  trousers: { type: 'jeans', material: 'woven', pattern: 'solid' },
  dress: { type: 'dress', sleeves: 'short', fit: 'fitted', length: 'short' }, // fitted bodice, A-line skirt
};
const DENIM_KINDS = new Set(['denim', 'jeans']);

// Fabric the project calls for, where the drawing does not show it.
const PROJECT_MATERIALS = {
  'cream-hoodie-hem': 'fleece', 'cardigan-wrap-top': 'wool', 'college-hoodie-patches': 'fleece', 'dip-dyed-waffle-hoodie': 'cotton',
  'crew-to-henley': 'wool', 'windbreaker-hood': 'poly', 'leather-racer-collar': 'poly', 'pleated-wide-trousers': 'wool', 'caped-wool-coat': 'wool',
  'tulle-tier-skirt': 'poly', 'chino-cutoffs': 'woven', 'fleece-lined-puffer': 'poly', 'leggings-bralette': 'cotton', 'cropped-zip-hoodie': 'fleece', 'off-shoulder-stripe': 'woven',
  'lace-bell-sleeves': 'cotton', 'empire-pintuck-blouse': 'woven', 'lace-plunge-top': 'cotton', 'thumbhole-thermal': 'cotton', 'lace-inset-blouse': 'woven',
  'fair-isle-crop': 'cotton', 'pintuck-floral-shirt': 'woven', 'shirt-dress-tie': 'poly', 'twist-front-top': 'cotton',
  'mock-neck-mini': 'cotton', 'floral-puff-mini': 'poly',
};

const COLOURS = {
  'ink blue': '#24365c', 'petal pink': '#e9a9b8', olive: '#6b7040', 'butter yellow': '#f0d77a', terracotta: '#c0623e',
  'cloud white': '#eeeae2', mulberry: '#7a2f55', indigo: '#2f3f78', oat: '#d9ccb0', sage: '#9cae8c', espresso: '#4a3226',
  'washed blue': '#7d9cc4', cocoa: '#7a5440', cream: '#efe5cf', coral: '#ec7b62', 'sky blue': '#8fc0e6', rust: '#a8502e',
  'pale blue': '#bcd3ea', rose: '#d98a9a', 'brick red': '#a63d2f', ochre: '#c9902f', charcoal: '#3a3b40', lavender: '#b9a7d9',
  stone: '#bdb5a6', black: '#25252a', white: '#f2f0ea', grey: '#8b8d90', gray: '#8b8d90', navy: '#26324f', blue: '#3d6fb0',
  red: '#b23a3a', green: '#4f7a4a', yellow: '#e6c14a', pink: '#e6a0b4', purple: '#7a5aa8', brown: '#7a5235', beige: '#d8c7a8',
  orange: '#e0813a', khaki: '#b5a77c', denim: '#3b5a85',
};

// AI Studio ideas wear the garments scanned from their photo.
export const canTryOn = (project) => Boolean(KIND_SHAPES[project.kind]) || (!!project.garmentId && scannedGarments(project.garmentId).length > 0);

// The colour a piece of text names ("dye it navy", "with cream thread"), or null.
export function namedColour(text = '') {
  const lower = text.toLowerCase();
  const hit = Object.keys(COLOURS).filter((word) => new RegExp(`\\b${word}\\b`).test(lower)).sort((a, b) => b.length - a.length)[0];
  return hit ? COLOURS[hit] : null;
}

const colourFor = (name = '') => {
  const lower = name.toLowerCase();
  return COLOURS[lower] || Object.entries(COLOURS).find(([word]) => lower.includes(word))?.[1] || '#5d6d8a';
};

// The garment in the project's cover picture: same cloth colour, the trim
// colour for its flowers (Cottagecore covers), denim for denim pieces.
export function garmentSpecFromProject(project) {
  const shape = KIND_SHAPES[project.kind];
  if (!shape) {
    const scanned = project.garmentId ? scannedGarments(project.garmentId) : [];
    return scanned.length ? scanned : null;
  }
  const denim = DENIM_KINDS.has(project.kind);
  const floral = project.aesthetic === 'Cottagecore';
  return {
    name: project.title,
    color: project.art?.cloth || colourFor(project.color),
    ...(project.art?.trim && { color2: project.art.trim }),
    pattern: floral ? 'floral' : denim ? 'denim' : 'solid',
    material: denim ? 'denim' : PROJECT_MATERIALS[project.id],
    ...shape,
  };
}

// AI Studio garment types are free text ("Denim jacket", "T-shirt"...).
export function garmentSpecFromAnalysis(analysis) {
  const text = `${analysis.garmentType}`.toLowerCase();
  const rules = [
    [/hood|sweatshirt/, 'hoodie'], [/cardigan/, 'cardigan'], [/sweater|jumper|knit/, 'sweater'], [/gilet|waistcoat|\bvest\b/, 'vest'],
    [/cami|spaghetti/, 'cami'], [/tank|halter/, 'tank'], [/crop/, 'crop'], [/polo/, 'polo'], [/blouse/, 'blouse'],
    [/long.?sleeve/, 'longsleeve'], [/\bt.?shirt|\btee\b/, 'tshirt'], [/button|shirt|flannel/, 'buttonup'], [/coat|trench|parka/, 'coat'], [/jacket|blazer|bomber/, 'jacket'],
    [/slip dress|sundress|sun dress/, 'slipdress'], [/dress/, 'dress'], [/skirt/, 'skirt'], [/short/, 'shorts'], [/legging/, 'leggings'], [/jogger|sweatpant/, 'joggers'], [/jean|pant|trouser|chino/, 'jeans'],
  ];
  const type = rules.find(([pattern]) => pattern.test(text))?.[1] || 'tshirt';
  const denim = /denim|jean/.test(text) || /denim/i.test(analysis.estimatedFabric || '');
  return { type, name: analysis.garmentType, color: colourFor(analysis.visibleColors?.[0]), pattern: denim ? 'denim' : 'solid', material: denim ? 'denim' : undefined };
}

// Default garments are cut for the M body; keep their ease but follow this body.
const M = { chest: 96, waist: 80, hips: 99, shoulder: 44, height: 172 };
export function sizeGarmentToBody(garment, body) {
  const g = { ...garment };
  const ease = (key, bodyKey = key) => {
    if (g[key] != null && body[bodyKey] != null) g[key] = Math.round((body[bodyKey] + (garment[key] - M[bodyKey])) * 2) / 2;
  };
  ease('chest');
  ease('waist');
  ease('hips');
  ease('shoulder');
  if (g.hem != null) g.hem = Math.round(garment.hem * Math.max(body.hips, body.waist, body.chest) / M.hips * 2) / 2;
  if (g.length != null) g.length = Math.round(garment.length * body.height / M.height * 2) / 2;
  if (g.inseam != null && garment.inseam > 40) g.inseam = Math.min(body.inseam, garment.inseam);
  return g;
}

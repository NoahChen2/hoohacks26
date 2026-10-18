// Turns an idea (an Explore project or an AI Studio analysis) into a garment
// sized for the saved body, so it can be previewed on the 3D figure in place.
import { scannedGarments } from '../tryon/outfitStore.js';

// Project kinds that map onto a wearable 3D garment; bags and aprons do not.
const KIND_TO_TYPE = {
  denim: 'cami', cami: 'cami', halter: 'crop', vest: 'vest',
  cardigan: 'cardigan', hoodie: 'hoodie', jacket: 'jacket',
  wrap: 'buttonup', shirt: 'buttonup', tee: 'tshirt',
  skirt: 'skirt', jeans: 'jeans', trousers: 'jeans', dress: 'dress',
};

// Cut and print details each project calls for, in garmentFromSpec's words.
const PROJECT_DETAILS = {
  'denim-corset': { length: 'cropped', fit: 'fitted' },
  'cargo-mini': { length: 'cropped' },
  'lace-cami': { length: 'short' },
  'shirt-wrap': { fit: 'oversized' },
  'scarf-halter': { sleeves: 'none', length: 'cropped', pattern: 'floral' },
  'bandana-top': { sleeves: 'none', length: 'cropped', pattern: 'polka' },
  'ruffle-skirt': { length: 'long', pattern: 'floral' },
  'cropped-knit': { length: 'cropped', fit: 'fitted' },
  'colorblock-hoodie': { fit: 'oversized' },
  'prairie-dress': { pattern: 'floral', sleeves: 'short' },
  'quilted-gilet': { material: 'poly' },
  'linen-vest': { material: 'linen' },
  'pillowcase-blouse': { length: 'short' },
  'clean-hem-trousers': { material: 'woven' },
  'racing-jacket': { pattern: 'vstripes' },
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
export const canTryOn = (project) => Boolean(KIND_TO_TYPE[project.kind]) || (!!project.garmentId && scannedGarments(project.garmentId).length > 0);

const colourFor = (name = '') => {
  const lower = name.toLowerCase();
  return COLOURS[lower] || Object.entries(COLOURS).find(([word]) => lower.includes(word))?.[1] || '#5d6d8a';
};

export function garmentSpecFromProject(project) {
  const type = KIND_TO_TYPE[project.kind];
  if (!type) {
    const scanned = project.garmentId ? scannedGarments(project.garmentId) : [];
    return scanned.length ? scanned : null;
  }
  const denim = project.kind === 'denim' || project.kind === 'jeans' || /denim|jean/i.test(project.materials?.join(' ') || '');
  const details = PROJECT_DETAILS[project.id] || {};
  return { type, name: project.title, color: colourFor(project.color), pattern: denim ? 'denim' : 'solid', material: denim ? 'denim' : undefined, ...(details.pattern && { color2: '#f4efe6' }), ...details };
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

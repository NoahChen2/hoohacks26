import { defaultCharacter, normalizeCharacter } from './character/settings.ts';
// Central app state with localStorage persistence and a tiny pub/sub.

const KEY = 'restitch.v1';

export { GARMENT_TYPES, PATTERNS, MATERIALS, garmentFields, defaultGarment, garmentFromSpec, STARTER_PIECES } from './garments.js';
import { defaultGarment, garmentFromSpec, dressOutfit, layerOrder, GARMENT_TYPES } from './garments.js';

export const TOOLS = {
  scissors: { label: 'Scissors / shears', icon: '✂' },
  needle: { label: 'Needle & thread', icon: '🪡' },
  machine: { label: 'Sewing machine', icon: '🧵' },
  pins: { label: 'Pins / clips', icon: '📌' },
  iron: { label: 'Iron', icon: '♨' },
  glue: { label: 'Fabric glue / hem tape', icon: '🧴' },
  paint: { label: 'Fabric paint / markers', icon: '🎨' },
  elastic: { label: 'Elastic', icon: '〰' },
  ripper: { label: 'Seam ripper', icon: '🪝' },
};

// Body presets (cm). Rough ready-to-wear averages.
export const BODY_PRESETS = {
  'Petite (XS)': { height: 155, chest: 80, underbust: 70, waist: 63, hips: 87, shoulder: 36, arm: 54, inseam: 70, neck: 32, thigh: 50 },
  'Small (S)': { height: 163, chest: 86, underbust: 76, waist: 69, hips: 93, shoulder: 39, arm: 57, inseam: 75, neck: 34, thigh: 54 },
  'Medium (M)': { height: 172, chest: 96, underbust: 84, waist: 80, hips: 99, shoulder: 44, arm: 61, inseam: 79, neck: 38, thigh: 57 },
  'Large (L)': { height: 178, chest: 106, underbust: 94, waist: 92, hips: 106, shoulder: 47, arm: 63, inseam: 81, neck: 41, thigh: 62 },
  'X-Large (XL)': { height: 181, chest: 116, underbust: 104, waist: 104, hips: 114, shoulder: 49, arm: 64, inseam: 81, neck: 44, thigh: 67 },
  // Extended sizes: plus-size ready-to-wear averages, not capped at the straight-size range.
  '2X-Large (2XL)': { height: 172, chest: 126, underbust: 114, waist: 116, hips: 126, shoulder: 50, arm: 63, inseam: 78, neck: 46, thigh: 73 },
  '3X-Large (3XL)': { height: 172, chest: 137, underbust: 124, waist: 129, hips: 137, shoulder: 51.5, arm: 63, inseam: 77, neck: 48, thigh: 79 },
  '4X-Large (4XL)': { height: 172, chest: 148, underbust: 135, waist: 142, hips: 149, shoulder: 53, arm: 64, inseam: 77, neck: 50, thigh: 85 },
  '5X-Large (5XL)': { height: 172, chest: 160, underbust: 146, waist: 156, hips: 161, shoulder: 55, arm: 64, inseam: 76, neck: 53, thigh: 91 },
  '6X-Large (6XL)': { height: 172, chest: 172, underbust: 158, waist: 170, hips: 174, shoulder: 57, arm: 65, inseam: 76, neck: 56, thigh: 97 },
};

export const BODY_FIELDS = [
  ['height', 'Height', 110, 215],
  ['chest', 'Chest / bust', 70, 185],
  ['underbust', 'Underbust / ribcage', 58, 175],
  ['waist', 'Waist', 55, 185],
  ['hips', 'Hips', 75, 190],
  ['shoulder', 'Shoulder width', 32, 62],
  ['arm', 'Arm length', 48, 74],
  ['inseam', 'Inseam', 60, 95],
  ['neck', 'Neck', 28, 62],
  ['thigh', 'Thigh', 40, 105],
  ['belly', 'Belly projection / fundal height', 0, 40],
];

export const BODY_PROFILE_DEFAULTS = {
  frame: 'neutral',
  underbust: 84,
  chestProjection: 0.5,
  maternity: 'none',
  belly: 0,
  stature: 'standard',
  limbRatio: 1,
  leftArm: 'full',
  rightArm: 'full',
  leftLeg: 'full',
  rightLeg: 'full',
  chestOption: 'symmetric',
  posture: 'upright',
};

// The body frame (adaptive profile) and the 3D character's shape stay in step.
export const FRAME_TO_SHAPE = { female: 'feminine', neutral: 'neutral', male: 'masculine' };
export const SHAPE_TO_FRAME = { feminine: 'female', neutral: 'neutral', masculine: 'male' };

function initialState() {
  const body = { ...BODY_PROFILE_DEFAULTS, ...BODY_PRESETS['Medium (M)'] };
  const shirt = defaultGarment('tshirt');
  shirt.name = 'Old band tee';
  shirt.color = '#2d2d34';
  const jeans = defaultGarment('jeans');
  jeans.name = 'Baggy jeans';
  jeans.waist = 92;
  const flannel = defaultGarment('buttonup');
  flannel.name = 'Flannel shirt';
  flannel.pattern = 'plaid';
  flannel.color = '#b23a3a';
  flannel.color2 = '#1f2a2e';
  flannel.chest = 124;
  flannel.waist = 120;
  flannel.hem = 120;
  const extras = [
    { type: 'jacket', name: 'Denim jacket', color: '#4b6fa0', pattern: 'denim', material: 'denim', fit: 'relaxed' },
    { type: 'cardigan', name: 'Grandpa cardigan', color: '#c98d3a', fit: 'relaxed' },
    { type: 'hoodie', name: 'College hoodie', color: '#6a2c3e', fit: 'oversized' },
    { type: 'skirt', name: 'Plaid mini skirt', color: '#8c2f39', color2: '#1e2533', pattern: 'plaid', material: 'wool', length: 'cropped' },
    { type: 'slipdress', name: 'Floral sundress', color: '#f3dfb5', color2: '#b44a6a', pattern: 'floral' },
    { type: 'joggers', name: 'Grey joggers', color: '#7d8087' },
  ].map((spec) => garmentFromSpec(spec, body));
  return {
    body,
    character: { ...defaultCharacter(), bodyPreset: FRAME_TO_SHAPE[BODY_PROFILE_DEFAULTS.frame] },
    garments: [shirt, jeans, flannel, ...extras],
    selected: shirt.id,
    // The outfit on the 3D body: one piece per slot, layered inside-out.
    worn: [jeans.id, shirt.id, extras[0].id],
    tools: { scissors: true, needle: true, pins: true },
    tab: 'body',
  };
}

// Guests save under KEY; signed-in users get their own local cache so accounts never mix.
let storageKey = KEY;

function load(key = storageKey) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// Additive migration: stored measurements, garments, IDs and unknown fields are
// kept as saved (the body panel fills any missing profile options when shown).
// A snapshot without character settings keeps the current ones.
function hydrate(data, currentCharacter) {
  if (!data) return initialState();
  const defaults = initialState();
  const body = data.body ? { ...data.body } : defaults.body;
  const character = normalizeCharacter(data.character ?? currentCharacter ?? (body.frame ? { bodyPreset: FRAME_TO_SHAPE[body.frame] } : undefined));
  return {
    ...defaults,
    ...data,
    body,
    character,
    tools: { ...defaults.tools, ...(data.tools || {}) },
    garments: Array.isArray(data.garments) ? data.garments : defaults.garments,
    // Saves from before outfits wore just the selected garment.
    worn: Array.isArray(data.worn) ? data.worn : data.garments ? [data.selected].filter(Boolean) : defaults.worn,
  };
}

export const state = hydrate(load());
const subs = new Set();

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function persistLocal() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {}
}

let saveTimer;
export function emit(reason = 'change') {
  subs.forEach((fn) => fn(reason));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistLocal, 250);
}

// The parts of state worth saving to an account (UI-only fields like `tab` stay local).
export function snapshot() {
  const { body, garments, selected, tools, character, worn } = state;
  return JSON.parse(JSON.stringify({ body, garments, selected, tools, character, worn }));
}

export function replaceState(data) {
  const tab = state.tab;
  const next = { ...hydrate(data, state.character), tab };
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, next);
  persistLocal();
  emit('reset');
}

// Switch which local cache we read/write. Returns that cache's saved data (or null).
export function useStorage(userId) {
  clearTimeout(saveTimer);
  storageKey = userId ? `${KEY}.user.${userId}` : KEY;
  return load();
}

export function guestData() {
  return load(KEY);
}

export function selectedGarment() {
  return state.garments.find((g) => g.id === state.selected) || state.garments[0] || null;
}

// Worn garments that still exist, in dressing order (innermost first).
export function wornGarments() {
  const ids = new Set(state.worn || []);
  return layerOrder(state.garments.filter((g) => ids.has(g.id) && GARMENT_TYPES[g.type]));
}

export const isWorn = (g) => !!g && (state.worn || []).includes(g.id);

// Put a garment on (taking off whatever shares its slot) or take it off.
export function setWorn(g, on = true) {
  const outfit = wornGarments();
  state.worn = (on ? dressOutfit(outfit, g) : outfit.filter((o) => o.id !== g.id)).map((o) => o.id);
}

// Take every garment off the body; they stay in the closet.
export function undressAll() {
  state.worn = [];
}

// Add new garments to the closet and dress the body in them (photo scans, try-ons).
export function addGarments(list, { wear = true } = {}) {
  for (const g of list) {
    if (state.garments.some((o) => o.id === g.id)) continue;
    state.garments.push(g);
    if (wear) setWorn(g, true);
  }
  if (list[0]) state.selected = list[0].id;
}

export function resetAll() {
  replaceState(initialState());
}

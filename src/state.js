// Central app state with localStorage persistence and a tiny pub/sub.

const KEY = 'restitch.v1';

export const GARMENT_TYPES = {
  tshirt: { label: 'T-shirt', kind: 'top', sleeves: true },
  longsleeve: { label: 'Long-sleeve tee', kind: 'top', sleeves: true },
  buttonup: { label: 'Button-up shirt', kind: 'top', sleeves: true },
  hoodie: { label: 'Hoodie / sweatshirt', kind: 'top', sleeves: true },
  sweater: { label: 'Sweater', kind: 'top', sleeves: true },
  tank: { label: 'Tank top', kind: 'top', sleeves: false },
  jeans: { label: 'Jeans / trousers', kind: 'bottom' },
  shorts: { label: 'Shorts', kind: 'bottom' },
  skirt: { label: 'Skirt', kind: 'skirt' },
  dress: { label: 'Dress', kind: 'dress', sleeves: true },
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
};

export const BODY_FIELDS = [
  ['height', 'Height', 110, 215],
  ['chest', 'Chest / bust', 70, 140],
  ['underbust', 'Underbust / ribcage', 58, 135],
  ['waist', 'Waist', 55, 135],
  ['hips', 'Hips', 75, 145],
  ['shoulder', 'Shoulder width', 32, 56],
  ['arm', 'Arm length', 48, 72],
  ['inseam', 'Inseam', 60, 95],
  ['neck', 'Neck', 28, 50],
  ['thigh', 'Thigh', 40, 80],
  ['belly', 'Belly projection / fundal height', 0, 24],
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

// Garment measurement fields (flat-lay measurements, doubled to circumference where noted).
export function garmentFields(type) {
  const k = GARMENT_TYPES[type].kind;
  const f = [];
  if (k === 'top' || k === 'dress') {
    f.push(['chest', 'Chest (circumference)', 60, 160]);
    f.push(['waist', 'Waist (circumference)', 50, 160]);
    f.push(['hem', 'Hem (circumference)', 50, 200]);
    f.push(['length', 'Length (shoulder → hem)', 30, 150]);
    f.push(['shoulder', 'Shoulder width', 28, 64]);
    if (GARMENT_TYPES[type].sleeves) {
      f.push(['sleeve', 'Sleeve length', 5, 80]);
      f.push(['sleeveOpen', 'Sleeve opening (circ.)', 14, 60]);
    }
  }
  if (k === 'bottom') {
    f.push(['waist', 'Waist (circumference)', 50, 140]);
    f.push(['hips', 'Hips (circumference)', 70, 150]);
    f.push(['rise', 'Front rise', 15, 40]);
    f.push(['inseam', 'Inseam', 5, 95]);
    f.push(['legOpen', 'Leg opening (circ.)', 25, 80]);
  }
  if (k === 'skirt') {
    f.push(['waist', 'Waist (circumference)', 50, 140]);
    f.push(['hips', 'Hips (circumference)', 70, 160]);
    f.push(['hem', 'Hem (circumference)', 70, 300]);
    f.push(['length', 'Length', 25, 110]);
  }
  return f;
}

export function defaultGarment(type = 'tshirt') {
  const base = {
    id: Math.random().toString(36).slice(2, 9),
    name: GARMENT_TYPES[type].label,
    type,
    color: '#3d7ea6',
    color2: '#f4efe6',
    pattern: 'solid',
    material: 'cotton',
    stains: false,
    holes: false,
    sketch: null, // dataURL of the 2D drawing layer
  };
  const m = {
    tshirt: { chest: 108, waist: 106, hem: 106, length: 72, shoulder: 47, sleeve: 21, sleeveOpen: 38 },
    longsleeve: { chest: 104, waist: 100, hem: 100, length: 70, shoulder: 45, sleeve: 63, sleeveOpen: 22 },
    buttonup: { chest: 112, waist: 106, hem: 108, length: 78, shoulder: 47, sleeve: 63, sleeveOpen: 24 },
    hoodie: { chest: 120, waist: 112, hem: 100, length: 70, shoulder: 52, sleeve: 62, sleeveOpen: 20 },
    sweater: { chest: 112, waist: 104, hem: 96, length: 66, shoulder: 48, sleeve: 62, sleeveOpen: 20 },
    tank: { chest: 98, waist: 96, hem: 98, length: 70, shoulder: 34 },
    jeans: { waist: 84, hips: 102, rise: 26, inseam: 80, legOpen: 38 },
    shorts: { waist: 84, hips: 104, rise: 26, inseam: 15, legOpen: 58 },
    skirt: { waist: 74, hips: 100, hem: 130, length: 60 },
    dress: { chest: 94, waist: 78, hem: 150, length: 105, shoulder: 38, sleeve: 12, sleeveOpen: 32 },
  }[type];
  if (type === 'jeans' || type === 'shorts') {
    base.color = '#3b5a85';
    base.pattern = 'denim';
    base.material = 'denim';
  }
  if (type === 'hoodie') base.material = 'fleece';
  if (type === 'sweater') base.material = 'wool';
  if (type === 'buttonup' || type === 'dress') base.material = 'woven';
  return { ...base, ...m };
}

function initialState() {
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
  return {
    body: { ...BODY_PROFILE_DEFAULTS, ...BODY_PRESETS['Medium (M)'] },
    garments: [shirt, jeans, flannel],
    selected: shirt.id,
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

function hydrate(data) {
  if (!data) return initialState();
  const defaults = initialState();
  return {
    ...defaults,
    ...data,
    body: { ...defaults.body, ...(data.body || {}) },
    tools: { ...defaults.tools, ...(data.tools || {}) },
    garments: Array.isArray(data.garments) ? data.garments : defaults.garments,
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
  const { body, garments, selected, tools } = state;
  return JSON.parse(JSON.stringify({ body, garments, selected, tools }));
}

export function replaceState(data) {
  const tab = state.tab;
  const next = { ...hydrate(data), tab };
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

export function resetAll() {
  replaceState(initialState());
}

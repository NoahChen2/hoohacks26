import type { BodyBuild, CharacterAppearance, CharacterCustomization, Measurements, VisualProportions } from './types.ts';

export const BUILD_LABELS: Record<BodyBuild, string> = {
  slim: 'Slim', average: 'Average', athletic: 'Athletic', muscular: 'Muscular', curvy: 'Curvy', plus: 'Plus-size',
};
export const PROPORTION_FIELDS = [
  ['shoulderBreadth', 'Shoulder breadth', -1, 1],
  ['torsoLength', 'Torso length', -1, 1],
  ['legRatio', 'Leg-to-torso ratio', -1, 1],
  ['upperArmVolume', 'Upper-arm volume', -1, 1],
  ['thighVolume', 'Thigh volume', -1, 1],
  ['calfVolume', 'Calf volume', -1, 1],
  ['muscleDefinition', 'Muscle definition', 0, 1],
  ['fullness', 'Overall fullness', -1, 1],
] as const;

// Skin tones from very light to very deep, as flat comic base colours.
export const SKIN_TONES: { id: string; label: string; color: string }[] = [
  { id: 'porcelain', label: 'Porcelain', color: '#fbe0cf' },
  { id: 'ivory', label: 'Ivory', color: '#f6d0b1' },
  { id: 'sand', label: 'Sand', color: '#f2bf98' },
  { id: 'honey', label: 'Honey', color: '#e3a676' },
  { id: 'olive', label: 'Olive', color: '#c99a66' },
  { id: 'amber', label: 'Amber', color: '#ba7d4c' },
  { id: 'bronze', label: 'Bronze', color: '#9d6439' },
  { id: 'umber', label: 'Umber', color: '#7d4c2e' },
  { id: 'espresso', label: 'Espresso', color: '#613a25' },
  { id: 'ebony', label: 'Ebony', color: '#48291b' },
];
// Every style has its own canonical mesh; ids match HAIR_STYLE_IDS in canonical.js.
export const HAIR_STYLES: { id: string; label: string }[] = [
  { id: 'crop', label: 'Short crop' },
  { id: 'bob', label: 'Bob' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bun', label: 'Top bun' },
  { id: 'curls', label: 'Big curls' },
  { id: 'braids', label: 'Braids' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'buzz', label: 'Buzz cut' },
  { id: 'bald', label: 'Bald' },
];
export const HAIR_COLORS: { id: string; label: string; color: string }[] = [
  { id: 'black', label: 'Black', color: '#2a2631' },
  { id: 'dark-brown', label: 'Dark brown', color: '#3a2418' },
  { id: 'brown', label: 'Brown', color: '#6b4226' },
  { id: 'auburn', label: 'Auburn', color: '#8c3a26' },
  { id: 'ginger', label: 'Ginger', color: '#cf6a2e' },
  { id: 'blonde', label: 'Blonde', color: '#e6bf62' },
  { id: 'platinum', label: 'Platinum', color: '#efe6cc' },
  { id: 'grey', label: 'Grey', color: '#a19fa8' },
  { id: 'pink', label: 'Pink', color: '#f07fb2' },
  { id: 'teal', label: 'Teal', color: '#2aa8a0' },
];
const DEFAULT_APPEARANCE: CharacterAppearance = { skin: 'sand', hair: null, hairColor: 'dark-brown' };

// The concrete hairstyle: `appearance.hair`, or by body type when it is null
// (auto): the bob for the feminine shape, the short crop otherwise. Mirrors
// canonicalHair in canonical.js, which the engine uses.
export function resolveHair(character: Pick<CharacterCustomization, 'bodyPreset'> & { appearance?: Partial<CharacterAppearance> | null }): string {
  const hair = character.appearance?.hair;
  if (hair && HAIR_STYLES.some(style => style.id === hair)) return hair;
  return character.bodyPreset === 'feminine' ? 'bob' : 'crop';
}

export function defaultCharacter(): CharacterCustomization {
  return { version: 1, bodyPreset: 'feminine', build: 'average', sizePreset: null, proportions: {
    shoulderBreadth: 0, torsoLength: 0, legRatio: 0, upperArmVolume: 0,
    thighVolume: 0, calfVolume: 0, muscleDefinition: .15, fullness: 0,
  }, appearance: { ...DEFAULT_APPEARANCE } };
}

function normalizeAppearance(value: unknown): CharacterAppearance {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const pick = (id: unknown, list: { id: string }[], fallback: string) => typeof id === 'string' && list.some(item => item.id === id) ? id : fallback;
  return {
    skin: pick(raw.skin, SKIN_TONES, DEFAULT_APPEARANCE.skin),
    hair: raw.hair === null || raw.hair === undefined ? null : pick(raw.hair, HAIR_STYLES, '') || null,
    hairColor: pick(raw.hairColor, HAIR_COLORS, DEFAULT_APPEARANCE.hairColor),
  };
}

export function normalizeCharacter(value: unknown): CharacterCustomization {
  const defaults = defaultCharacter();
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Record<string, unknown>;
  const source = raw.proportions && typeof raw.proportions === 'object' ? raw.proportions as Record<string, unknown> : {};
  const proportions = { ...source, ...defaults.proportions };
  for (const [key, , min, max] of PROPORTION_FIELDS) {
    const n = source[key];
    if (typeof n === 'number' && Number.isFinite(n)) proportions[key] = Math.max(min, Math.min(max, n));
  }
  return {
    ...raw, ...defaults,
    bodyPreset: raw.bodyPreset === 'masculine' || raw.bodyPreset === 'neutral' ? raw.bodyPreset : 'feminine',
    build: typeof raw.build === 'string' && raw.build in BUILD_LABELS ? raw.build as BodyBuild : 'average',
    sizePreset: typeof raw.sizePreset === 'string' ? raw.sizePreset : null,
    proportions: proportions as VisualProportions,
    appearance: normalizeAppearance(raw.appearance),
  };
}

// Underbust (ribcage) scales with the build too, so the chest-minus-underbust
// difference that drives bust volume stays plausible on every build.
const FACTORS: Record<BodyBuild, Partial<Measurements>> = {
  slim: { chest: .91, underbust: .92, waist: .88, hips: .95, shoulder: .96, thigh: .90, neck: .95 },
  average: {},
  athletic: { chest: 1.04, underbust: 1.04, waist: .94, hips: 1.01, shoulder: 1.04, thigh: 1.06 },
  muscular: { chest: 1.15, underbust: 1.14, waist: 1.04, hips: 1.07, shoulder: 1.10, thigh: 1.17, neck: 1.10 },
  curvy: { chest: 1.08, underbust: 1.02, waist: .96, hips: 1.14, shoulder: .98, thigh: 1.15 },
  plus: { chest: 1.22, underbust: 1.22, waist: 1.30, hips: 1.22, shoulder: 1.05, thigh: 1.25 },
};
export function buildStartingPoint(source: Measurements, build: BodyBuild): Measurements {
  const result = { ...source };
  for (const [key, multiplier] of Object.entries(FACTORS[build])) {
    const k = key as keyof Measurements;
    const value = source[k];
    if (typeof value !== 'number' || !Number.isFinite(value) || multiplier == null) continue;
    result[k] = Math.round(value * multiplier * 2) / 2;
  }
  // The ribcage never measures more than the fullest chest.
  if (result.underbust != null) result.underbust = Math.min(result.underbust, result.chest);
  return result;
}

import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS } from './appearance.js';
import type { BodyBuild, CharacterAppearance, CharacterCustomization, Measurements, VisualProportions } from './types.ts';

export { SKIN_TONES, HAIR_STYLES, HAIR_COLORS };

export const BUILD_LABELS: Record<BodyBuild, string> = {
  slim: 'Slim', average: 'Average', athletic: 'Athletic', muscular: 'Muscular', curvy: 'Curvy', plus: 'Plus-size',
};
// Muscle definition each build starts from.
export const BUILD_MUSCLE: Record<BodyBuild, number> = { slim: 0.08, average: 0.15, athletic: 0.55, muscular: 0.9, curvy: 0.12, plus: 0.05 };
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

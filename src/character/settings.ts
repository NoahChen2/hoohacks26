import type { BodyBuild, CharacterCustomization, Measurements, VisualProportions } from './types.ts';

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

export function defaultCharacter(): CharacterCustomization {
  return { version: 1, bodyPreset: 'feminine', build: 'average', sizePreset: null, proportions: {
    shoulderBreadth: 0, torsoLength: 0, legRatio: 0, upperArmVolume: 0,
    thighVolume: 0, calfVolume: 0, muscleDefinition: .15, fullness: 0,
  } };
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
  };
}

const FACTORS: Record<BodyBuild, Partial<Measurements>> = {
  slim: { chest: .91, waist: .88, hips: .95, shoulder: .96, thigh: .90, neck: .95 },
  average: {},
  athletic: { chest: 1.04, waist: .94, hips: 1.01, shoulder: 1.04, thigh: 1.06 },
  muscular: { chest: 1.15, waist: 1.04, hips: 1.07, shoulder: 1.10, thigh: 1.17, neck: 1.10 },
  curvy: { chest: 1.08, waist: .96, hips: 1.14, shoulder: .98, thigh: 1.15 },
  plus: { chest: 1.22, waist: 1.30, hips: 1.22, shoulder: 1.05, thigh: 1.25 },
};
export function buildStartingPoint(source: Measurements, build: BodyBuild): Measurements {
  const result = { ...source };
  for (const [key, multiplier] of Object.entries(FACTORS[build])) {
    const k = key as keyof Measurements;
    result[k] = Math.round(source[k] * multiplier * 2) / 2;
  }
  return result;
}

// The single body mesh every measurement set is morphed from (one per shape and
// hairstyle, for its hair volume and bust). Dependency-free so the boot script
// can request it before the main bundle has loaded.
export const CANONICAL_MEASUREMENTS = { height: 172, chest: 96, waist: 80, hips: 99, shoulder: 44, arm: 61, inseam: 79, neck: 38, thigh: 57 };

// Hairstyle ids with modelled geometry (labels live in settings.ts HAIR_STYLES).
export const HAIR_STYLE_IDS = ['crop', 'bob', 'long', 'ponytail', 'bun', 'curls', 'braids', 'mohawk', 'buzz', 'bald'];

// `hair` null (or unknown) means "auto by body type": the bob for the feminine
// shape, the short crop otherwise.
export function canonicalHair(bodyPreset, hair) {
  return HAIR_STYLE_IDS.includes(hair) ? hair : bodyPreset === 'feminine' ? 'bob' : 'crop';
}

export function canonicalCharacter(bodyPreset, hair = null) {
  const preset = ['masculine', 'neutral'].includes(bodyPreset) ? bodyPreset : 'feminine';
  return { bodyPreset: preset, hair: canonicalHair(preset, hair), proportions: { muscleDefinition: .15 } };
}

// The hairstyle a character's mesh is built with: `hair` on a canonical
// character, else its appearance setting resolved by body type.
export const characterHair = character => canonicalHair(character.bodyPreset, character.hair ?? character.appearance?.hair);

export function characterGeometryKey(measurements, character) {
  return JSON.stringify([measurements, character.bodyPreset, character.proportions.muscleDefinition, characterHair(character)]);
}

// The single body mesh every measurement set is morphed from (one per shape,
// for its hair style and bust). Dependency-free so the boot script can request
// it before the main bundle has loaded.
export const CANONICAL_MEASUREMENTS = { height: 172, chest: 96, waist: 80, hips: 99, shoulder: 44, arm: 61, inseam: 79, neck: 38, thigh: 57 };

export function canonicalCharacter(bodyPreset) {
  return { bodyPreset: bodyPreset === 'masculine' ? 'masculine' : 'feminine', proportions: { muscleDefinition: .15 } };
}

export function characterGeometryKey(measurements, character) {
  return JSON.stringify([measurements, character.bodyPreset, character.proportions.muscleDefinition]);
}

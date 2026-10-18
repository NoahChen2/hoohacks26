// The wearer's body from a photo scan (frame, build, size, height; see
// schema.js) turned into the measurements and character settings the 3D body
// uses: the size's ready-to-wear preset, shaped by the build, scaled to the
// height, with the photo's skin tone and hair. Profile options the scan can't
// see (posture, limbs, maternity) are kept.
import { BODY_PRESETS, BODY_FIELDS, FRAME_TO_SHAPE } from '../state.js';
import { BUILD_LABELS, BUILD_MUSCLE, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, buildStartingPoint } from '../character/settings.ts';
import { formatLength, feetInches, unit } from '../ui/units.js';

const presetFor = (size) => Object.keys(BODY_PRESETS).find((name) => name.match(/\(([^)]+)\)/)?.[1] === size) || 'Medium (M)';
const FRAME_LABELS = { female: 'Female', neutral: 'Neutral', male: 'Male' };

/** New { body, character } for `estimate`, leaving `body` and `character` untouched. */
export function bodyFromEstimate(estimate, body, character) {
  const name = presetFor(estimate.size);
  const preset = BODY_PRESETS[name];
  // The extended sizes are already plus-size averages: don't scale them up again.
  const extended = /^\dXL$/.test(estimate.size);
  const values = estimate.build === 'plus' && extended ? { ...preset } : buildStartingPoint(preset, estimate.build);
  // Taller or shorter than the size's average: limbs scale with height.
  const ratio = estimate.height / preset.height;
  Object.assign(values, { height: estimate.height, arm: preset.arm * ratio, inseam: preset.inseam * ratio });
  const next = { ...body, frame: estimate.frame };
  for (const [key, , min, max] of BODY_FIELDS) if (key !== 'belly' && values[key] != null) next[key] = Math.round(Math.max(min, Math.min(max, values[key])) * 2) / 2;
  next.underbust = Math.min(next.underbust, next.chest);
  return {
    body: next,
    character: {
      ...character,
      bodyPreset: FRAME_TO_SHAPE[estimate.frame],
      build: estimate.build,
      // The size button stays lit only while the measurements are its own.
      sizePreset: estimate.build === 'average' && Math.abs(ratio - 1) < 0.01 ? name : null,
      proportions: { ...character.proportions, muscleDefinition: BUILD_MUSCLE[estimate.build] },
      appearance: { ...character.appearance, skin: estimate.skin, hair: estimate.hair, hairColor: estimate.hairColor },
    },
  };
}

const label = (list, id) => list.find((item) => item.id === id)?.label || '';

/** "Female · Athletic · M · 5′6″ · Honey skin · Brown bob" */
export function describeEstimate(estimate) {
  const height = unit() === 'in' ? feetInches(estimate.height) : formatLength(estimate.height);
  const hair = estimate.hair === 'bald' ? 'Bald' : `${label(HAIR_COLORS, estimate.hairColor)} ${label(HAIR_STYLES, estimate.hair).toLowerCase()}`;
  return [FRAME_LABELS[estimate.frame], BUILD_LABELS[estimate.build], estimate.size, height, `${label(SKIN_TONES, estimate.skin)} skin`, hair].join(' · ');
}

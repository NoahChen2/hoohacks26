// Display units for tape measurements. Everything is stored and calculated in
// centimetres; the unit is a display and input layer only. Inches are the
// default, centimetres are opt-in.
import { state, emit } from '../state.js';
import { inch } from '../upcycle.js';

const CM_PER_IN = 2.54;

export const unit = () => (state.units === 'cm' ? 'cm' : 'in');

export function setUnit(next) {
  const value = next === 'cm' ? 'cm' : 'in';
  if (value === unit()) return;
  state.units = value;
  emit('units');
}

// Value shown in the number box and on the slider, in the current unit.
export const toUnit = (cm, u = unit()) => (u === 'in' ? Math.round((cm / CM_PER_IN) * 4) / 4 : Math.round(cm * 10) / 10);
// Typed or dragged value back to stored centimetres.
export const fromUnit = (value, u = unit()) => (u === 'in' ? Math.round(value * CM_PER_IN * 10) / 10 : value);
export const unitStep = (u = unit()) => (u === 'in' ? 0.25 : 0.5);
// A field's range in the current unit, kept inside the centimetre range.
export const unitRange = (min, max, u = unit()) =>
  u === 'in' ? [Math.ceil((min / CM_PER_IN) * 4) / 4, Math.floor((max / CM_PER_IN) * 4) / 4] : [min, max];

export function feetInches(cm) {
  const total = cm / CM_PER_IN;
  let feet = Math.floor(total / 12);
  let inches = Math.round(total - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}′ ${inches}″`;
}

// The same length in the other unit, as a quiet secondary reading.
export function otherUnit(cm, { height = false } = {}, u = unit()) {
  if (u === 'in') return height ? feetInches(cm) : `${Math.round(cm * 2) / 2} cm`;
  return height ? feetInches(cm) : inch(cm);
}

// A length in the current unit, for labels and summaries.
export const formatLength = (cm, u = unit()) => (u === 'in' ? inch(cm) : `${Math.round(cm * 2) / 2} cm`);

export function unitToggle(id = 'unit-toggle') {
  const u = unit();
  return `<div class="unit-toggle" id="${id}" role="group" aria-label="Measurement units">
    <button type="button" data-unit="in" aria-pressed="${u === 'in'}">in</button>
    <button type="button" data-unit="cm" aria-pressed="${u === 'cm'}">cm</button>
  </div>`;
}

export function bindUnitToggle(root) {
  root.querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => setUnit(button.dataset.unit)));
}

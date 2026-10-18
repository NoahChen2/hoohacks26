import './bodyPanel.css';
import * as settings from '../character/settings.ts';
import { state, emit, BODY_FIELDS, BODY_PRESETS, BODY_PROFILE_DEFAULTS, FRAME_TO_SHAPE, SHAPE_TO_FRAME } from '../state.js';
import { bodyModel } from '../model.js';
import { unit, toUnit, fromUnit, unitStep, unitRange, otherUnit, formatLength, unitToggle, bindUnitToggle } from './units.js';

const HINTS = {
  height: 'Barefoot, standing straight against a wall.',
  chest: 'Around the fullest part of the chest / bust, tape level.',
  underbust: 'Around the ribcage directly beneath the chest or bust.',
  waist: 'Around your natural waist, the narrowest point, above the navel.',
  hips: 'Around the widest part of the hips and seat.',
  shoulder: 'Across the back, from shoulder bone to shoulder bone.',
  arm: 'From the shoulder bone, over a slightly bent elbow, to the wrist.',
  inseam: 'From the crotch straight down the inside leg to the floor.',
  neck: 'Around the base of the neck.',
  thigh: 'Around the fullest part of one thigh.',
  belly: 'Forward abdominal projection used for maternity and custom shaping.',
};
const FIELD = Object.fromEntries(BODY_FIELDS.map((field) => [field[0], field]));
const GROUPS = [
  ['Length', ['height', 'inseam', 'arm']],
  ['Upper body', ['chest', 'underbust', 'shoulder', 'neck']],
  ['Lower body', ['waist', 'hips', 'thigh']],
];
const FRAMES = [['female', 'Female'], ['neutral', 'Neutral'], ['male', 'Male']];
const PANES = [['measure', 'Measure'], ['shape', 'Shape'], ['access', 'Access'], ['look', 'Look']];
const MATERNITY = [['none', 'None'], ['first', '1st tri'], ['second', '2nd tri'], ['third', '3rd tri']];

const { BUILD_LABELS, BUILD_MUSCLE: MUSCLE, PROPORTION_FIELDS, buildStartingPoint } = settings;
// Appearance lists are read off the module namespace so the panel still loads
// if the appearance options are not exported yet.
const appearanceLists = () => ({
  skins: settings.SKIN_TONES ?? [],
  styles: settings.HAIR_STYLES ?? [],
  hairColors: settings.HAIR_COLORS ?? [],
});
function ensureAppearance(character) {
  const { skins, hairColors } = appearanceLists();
  const defaults = settings.defaultCharacter().appearance ?? {};
  character.appearance = {
    skin: defaults.skin ?? skins[0]?.id ?? null,
    hair: defaults.hair ?? null,
    hairColor: defaults.hairColor ?? hairColors[0]?.id ?? null,
    ...(character.appearance && typeof character.appearance === 'object' ? character.appearance : {}),
  };
  return character.appearance;
}

// The sub tab survives re-renders (unit switches, presets, builds).
let bodyPane = 'measure';

const NOT_IN_3D = 'Saved with your profile. Not shown on the 3D character yet.';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const fill = (v, min, max) => `${(((clamp(v, min, max) - min) / (max - min || 1)) * 100).toFixed(1)}%`;
const sizeCode = (name) => name.match(/\(([^)]+)\)/)?.[1] ?? name;
const pct = (v) => `${Math.round(v * 100)}%`;

export function renderBodyPanel(el) {
  const b = state.body;
  const character = state.character;
  Object.entries(BODY_PROFILE_DEFAULTS).forEach(([key, value]) => {
    if (b[key] == null) b[key] = value;
  });
  // The 3D shape is the source of truth; the saved frame mirrors it.
  b.frame = SHAPE_TO_FRAME[character.bodyPreset] || 'neutral';
  if (!PANES.some(([id]) => id === bodyPane)) bodyPane = 'measure';
  const u = unit();
  const look = ensureAppearance(character);
  const { skins, styles, hairColors } = appearanceLists();

  el.innerHTML = `
  <div class="bp">
    <header class="bp-head">
      <h2 class="bp-title">Your body</h2>
      ${unitToggle('bp-units')}
    </header>
    <p class="bp-lede">Real tape-measure numbers drive the 3D figure and every cut line.</p>

    <div class="bp-block">
      <span class="bp-label" id="bp-frame-label">Body type</span>
      <div class="bp-seg bp-cols-3 bp-planets" role="group" aria-labelledby="bp-frame-label">
        ${FRAMES.map(([value, label], i) => `<button type="button" class="bp-opt planet" data-planet="${i + 1}" data-frame="${value}" aria-pressed="${b.frame === value}"><span>${label}</span></button>`).join('')}
      </div>
    </div>

    <div class="bp-block">
      <span class="bp-label" id="bp-size-label">Size</span>
      <div class="bp-seg bp-cols-5" role="group" aria-labelledby="bp-size-label">
        ${Object.keys(BODY_PRESETS).map((name) => `<button type="button" class="bp-opt bp-mono" data-preset="${name}" title="${name}" aria-label="${name}" aria-pressed="${character.sizePreset === name}">${sizeCode(name)}</button>`).join('')}
      </div>
    </div>

    <div class="bp-block">
      <span class="bp-label" id="bp-build-label">Build</span>
      <div class="bp-seg bp-cols-3" role="group" aria-labelledby="bp-build-label">
        ${Object.entries(BUILD_LABELS).map(([value, label]) => `<button type="button" class="bp-opt" data-build="${value}" aria-pressed="${character.build === value}">${label}</button>`).join('')}
      </div>
    </div>

    <div class="bp-tabs" role="tablist" aria-label="Body settings">
      ${PANES.map(([id, label]) => `<button type="button" role="tab" id="bp-tab-${id}" class="bp-tab" data-bp-tab="${id}" aria-controls="bp-pane-${id}" aria-selected="${bodyPane === id}" tabindex="${bodyPane === id ? 0 : -1}">${label}</button>`).join('')}
    </div>

    <div class="bp-pane" role="tabpanel" id="bp-pane-measure" aria-labelledby="bp-tab-measure" ${bodyPane === 'measure' ? '' : 'hidden'}>
      <figure class="bp-sil" id="bp-sil" aria-label="Front silhouette with your measurements"></figure>
      ${GROUPS.map(([title, keys]) => `
        <section class="bp-group" aria-label="${title}">
          <h3 class="bp-group-title">${title}</h3>
          ${keys.map((key) => measureRow(key, b[key], u)).join('')}
        </section>`).join('')}
      <p class="bp-note">Builds and sizes fill in starting values. Your own edits always win.</p>
    </div>

    <div class="bp-pane" role="tabpanel" id="bp-pane-shape" aria-labelledby="bp-tab-shape" ${bodyPane === 'shape' ? '' : 'hidden'}>
      <section class="bp-group">
        ${selectField('chestOption', 'Chest profile', [['symmetric', 'Symmetric'], ['leftFlat', 'Unilateral flat, left'], ['rightFlat', 'Unilateral flat, right'], ['bilateralFlat', 'Bilateral flat']], b.chestOption)}
        ${ratioRow('chestProjection', 'Chest projection', 0, 1, b.chestProjection)}
      </section>
      <section class="bp-group">
        <span class="bp-label" id="bp-maternity-label">Maternity</span>
        <div class="bp-seg bp-cols-4" role="group" aria-labelledby="bp-maternity-label">
          ${MATERNITY.map(([value, label]) => `<button type="button" class="bp-opt" data-choice="maternity" data-value="${value}" aria-pressed="${b.maternity === value}">${label}</button>`).join('')}
        </div>
        ${measureRow('belly', b.belly, u)}
      </section>
      <section class="bp-group">
        ${selectField('posture', 'Posture / spine', [['upright', 'Standard upright'], ['kyphosis', 'Kyphosis / rounded back'], ['scoliosis', 'Scoliosis asymmetry'], ['seated', 'Seated / wheelchair']], b.posture)}
        <p class="bp-note">Posture is saved with your profile. Not shown on the 3D character yet.</p>
      </section>
    </div>

    <div class="bp-pane" role="tabpanel" id="bp-pane-access" aria-labelledby="bp-tab-access" ${bodyPane === 'access' ? '' : 'hidden'}>
      <section class="bp-group">
        ${selectField('stature', 'Stature profile', [['standard', 'Standard proportionate'], ['achondroplasia', 'Achondroplasia preset'], ['proportionateShort', 'Proportionate short stature']], b.stature)}
        ${ratioRow('limbRatio', 'Limb-to-torso ratio', 0.55, 1.15, b.limbRatio)}
      </section>
      <section class="bp-group bp-grid2">
        ${selectField('leftArm', 'Left arm', armOptions(), b.leftArm)}
        ${selectField('rightArm', 'Right arm', armOptions(), b.rightArm)}
        ${selectField('leftLeg', 'Left leg', legOptions(), b.leftLeg)}
        ${selectField('rightLeg', 'Right leg', legOptions(), b.rightLeg)}
      </section>
      <p class="bp-note">${NOT_IN_3D}</p>
    </div>

    <div class="bp-pane" role="tabpanel" id="bp-pane-look" aria-labelledby="bp-tab-look" ${bodyPane === 'look' ? '' : 'hidden'}>
      ${skins.length ? `
      <section class="bp-group">
        <span class="bp-label" id="bp-skin-label">Skin</span>
        <div class="bp-swatches" role="group" aria-labelledby="bp-skin-label">
          ${skins.map((tone) => swatch('skin', tone, look.skin === tone.id)).join('')}
        </div>
      </section>` : ''}
      ${styles.length ? `
      <section class="bp-group">
        <span class="bp-label" id="bp-hair-label">Hair</span>
        <div class="bp-seg bp-cols-4" role="group" aria-labelledby="bp-hair-label">
          ${[{ id: '', label: 'Auto' }, ...styles].map((style) => `<button type="button" class="bp-opt" data-hair="${style.id}" title="${style.id ? style.label : 'Auto: follows the body type'}" aria-pressed="${(look.hair ?? '') === style.id}">${style.label}</button>`).join('')}
        </div>
      </section>` : ''}
      ${hairColors.length ? `
      <section class="bp-group">
        <span class="bp-label" id="bp-haircolor-label">Hair colour</span>
        <div class="bp-swatches" role="group" aria-labelledby="bp-haircolor-label">
          ${hairColors.map((tone) => swatch('hair-color', tone, look.hairColor === tone.id)).join('')}
        </div>
      </section>` : ''}
      <section class="bp-group">
        <span class="bp-label">Proportions</span>
        <p class="bp-note bp-note-top">Preview only: these reshape the character and clothing together, never your tape measurements, fit warnings or cut lines.</p>
        ${PROPORTION_FIELDS.map(([key, label, min, max]) => `
          <div class="bp-row">
            <div class="bp-row-top">
              <label class="bp-row-label" for="bp-prop-${key}">${label}</label>
              <output class="bp-out" data-proportion-value="${key}">${pct(character.proportions[key])}</output>
            </div>
            <input class="bp-range" type="range" id="bp-prop-${key}" data-proportion="${key}" min="${min}" max="${max}" step=".05" value="${character.proportions[key]}" style="--fill:${fill(character.proportions[key], min, max)}" />
          </div>`).join('')}
      </section>
      <button type="button" class="bp-btn" id="reset-proportions">Reset proportions</button>
    </div>
  </div>`;

  const root = el.querySelector('.bp');
  bindUnitToggle(root);

  const sil = root.querySelector('#bp-sil');
  const draw = () => (sil.innerHTML = silhouetteSVG(state.body));
  draw();

  const press = (buttons, active) => buttons.forEach((button) => button.setAttribute('aria-pressed', String(button === active)));

  // Sub tabs (with arrow-key movement between them).
  const tabs = [...root.querySelectorAll('[data-bp-tab]')];
  const showPane = (tab) => {
    bodyPane = tab.dataset.bpTab;
    tabs.forEach((item) => {
      const on = item === tab;
      item.setAttribute('aria-selected', String(on));
      item.tabIndex = on ? 0 : -1;
    });
    root.querySelectorAll('.bp-pane').forEach((pane) => (pane.hidden = pane.id !== `bp-pane-${bodyPane}`));
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showPane(tab));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      showPane(next);
      next.focus();
    });
  });

  // Body type: the 3D shape and the saved frame always change together.
  const frameButtons = [...root.querySelectorAll('[data-frame]')];
  frameButtons.forEach((button) =>
    button.addEventListener('click', () => {
      b.frame = button.dataset.frame;
      character.bodyPreset = FRAME_TO_SHAPE[b.frame];
      press(frameButtons, button);
      draw();
      emit('body');
    })
  );

  const sizeButtons = [...root.querySelectorAll('[data-preset]')];
  sizeButtons.forEach((button) =>
    button.addEventListener('click', () => {
      Object.assign(b, BODY_PRESETS[button.dataset.preset]);
      character.sizePreset = button.dataset.preset;
      character.build = 'average';
      renderBodyPanel(el);
      emit('body');
    })
  );

  root.querySelectorAll('[data-build]').forEach((button) =>
    button.addEventListener('click', () => {
      const build = button.dataset.build;
      const names = Object.keys(BODY_PRESETS);
      const closest = names.reduce((best, key) => (Math.abs(BODY_PRESETS[key].height - b.height) < Math.abs(BODY_PRESETS[best].height - b.height) ? key : best), names[0]);
      const source = BODY_PRESETS[character.sizePreset] || { ...BODY_PRESETS[closest], height: b.height, arm: b.arm, inseam: b.inseam };
      const values = buildStartingPoint(source, build);
      for (const [key, , min, max] of BODY_FIELDS) if (values[key] != null) b[key] = clamp(values[key], min, max);
      if (b.underbust > b.chest) b.underbust = Math.max(FIELD.underbust[2], b.chest);
      character.build = build;
      character.proportions.muscleDefinition = MUSCLE[build];
      renderBodyPanel(el);
      emit('body');
    })
  );

  root.querySelectorAll('[data-choice]').forEach((button) =>
    button.addEventListener('click', () => {
      b[button.dataset.choice] = button.dataset.value;
      press(button.parentElement.querySelectorAll('[data-choice]'), button);
      draw();
      emit('body');
    })
  );
  root.querySelectorAll('[data-body-option]').forEach((control) =>
    control.addEventListener('change', () => {
      b[control.dataset.bodyOption] = control.value;
      draw();
      emit('body');
    })
  );
  root.querySelectorAll('[data-option-range]').forEach((control) =>
    control.addEventListener('input', () => {
      const v = parseFloat(control.value);
      b[control.dataset.optionRange] = v;
      control.style.setProperty('--fill', fill(v, +control.min, +control.max));
      root.querySelector(`[data-option-value="${control.dataset.optionRange}"]`).textContent = pct(v);
      draw();
      emit('body');
    })
  );

  // Measurements: controls show the display unit, state keeps centimetres.
  const sync = (key) => {
    const cm = b[key];
    const shown = toUnit(cm);
    const range = root.querySelector(`[data-key="${key}"]`);
    if (range) {
      range.value = shown;
      range.style.setProperty('--fill', fill(shown, +range.min, +range.max));
    }
    const num = root.querySelector(`[data-num="${key}"]`);
    if (num && document.activeElement !== num) num.value = shown;
    const alt = root.querySelector(`[data-alt="${key}"]`);
    if (alt) alt.textContent = otherUnit(cm, { height: key === 'height' });
  };
  const commit = (key, cm) => {
    const [, , min, max] = FIELD[key];
    let v = clamp(cm, min, max);
    // The ribcage can't measure more than the fullest chest.
    if (key === 'underbust') v = Math.min(v, b.chest);
    b[key] = v;
    sync(key);
    if (key === 'chest' && b.underbust > b.chest) {
      b.underbust = Math.max(FIELD.underbust[2], b.chest);
      sync('underbust');
    }
    if (key !== 'belly' && character.sizePreset) {
      character.sizePreset = null;
      press(sizeButtons, null);
    }
    draw();
    emit('body');
  };
  root.querySelectorAll('input[type=range][data-key]').forEach((range) =>
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      if (Number.isFinite(v)) commit(range.dataset.key, fromUnit(v));
    })
  );
  root.querySelectorAll('input[data-num]').forEach((num) => {
    num.addEventListener('input', () => num.setCustomValidity(''));
    num.addEventListener('change', () => {
      const key = num.dataset.num;
      const [, , min, max] = FIELD[key];
      const [lo, hi] = unitRange(min, max);
      const v = parseFloat(num.value);
      if (!Number.isFinite(v) || v < lo || v > hi) {
        num.setCustomValidity(`Enter ${lo}–${hi} ${unit()}.`);
        num.reportValidity();
        return;
      }
      num.setCustomValidity('');
      commit(key, fromUnit(v));
      num.value = toUnit(b[key]);
    });
  });

  // Appearance: skin, hair style (empty id = Auto by body type) and hair colour.
  const pick = (selector, apply) => {
    const buttons = [...root.querySelectorAll(selector)];
    buttons.forEach((button) =>
      button.addEventListener('click', () => {
        apply(button);
        press(buttons, button);
        emit('character');
      })
    );
  };
  pick('[data-skin]', (button) => (ensureAppearance(character).skin = button.dataset.skin));
  pick('[data-hair]', (button) => (ensureAppearance(character).hair = button.dataset.hair || null));
  pick('[data-hair-color]', (button) => (ensureAppearance(character).hairColor = button.dataset.hairColor));

  root.querySelectorAll('[data-proportion]').forEach((input) =>
    input.addEventListener('input', () => {
      const v = Number(input.value);
      character.proportions[input.dataset.proportion] = v;
      input.style.setProperty('--fill', fill(v, +input.min, +input.max));
      root.querySelector(`[data-proportion-value="${input.dataset.proportion}"]`).textContent = pct(v);
      emit('character');
    })
  );
  root.querySelector('#reset-proportions').addEventListener('click', () => {
    for (const [key] of PROPORTION_FIELDS) character.proportions[key] = key === 'muscleDefinition' ? 0.15 : 0;
    renderBodyPanel(el);
    emit('character');
  });
}

// A tape measurement: label, number box in the display unit, the other unit as
// a quiet secondary reading, and a full-width slider.
function measureRow(key, cm, u) {
  const [, label, min, max] = FIELD[key];
  const [lo, hi] = unitRange(min, max, u);
  const shown = toUnit(cm, u);
  const hint = HINTS[key];
  return `
    <div class="bp-row" title="${hint}">
      <div class="bp-row-top">
        <label class="bp-row-label" for="bp-num-${key}">${label}</label>
        <span class="bp-alt" data-alt="${key}">${otherUnit(cm, { height: key === 'height' }, u)}</span>
        <span class="bp-val"><input class="bp-num" type="number" inputmode="decimal" id="bp-num-${key}" data-num="${key}" value="${shown}" min="${lo}" max="${hi}" step="any" aria-describedby="bp-hint-${key}" /><span class="bp-suffix">${u}</span></span>
      </div>
      <input class="bp-range" type="range" data-key="${key}" min="${lo}" max="${hi}" step="${unitStep(u)}" value="${clamp(shown, lo, hi)}" style="--fill:${fill(shown, lo, hi)}" aria-label="${label} (${u})" />
      <p class="bp-hint" id="bp-hint-${key}">${hint}</p>
    </div>`;
}

// A 0–1 style body option shown as a percentage.
function ratioRow(key, label, min, max, value) {
  return `
    <div class="bp-row">
      <div class="bp-row-top">
        <label class="bp-row-label" for="bp-opt-${key}">${label}</label>
        <output class="bp-out" data-option-value="${key}">${pct(value)}</output>
      </div>
      <input class="bp-range" type="range" id="bp-opt-${key}" data-option-range="${key}" min="${min}" max="${max}" step="0.05" value="${value}" style="--fill:${fill(value, min, max)}" />
    </div>`;
}

function swatch(kind, { id, label, color }, active) {
  return `<button type="button" class="bp-swatch" data-${kind}="${id}" style="--swatch:${color}" title="${label}" aria-label="${label}" aria-pressed="${active}"></button>`;
}

function selectField(key, label, options, value) {
  return `<label class="bp-field"><span class="bp-field-label">${label}</span><span class="bp-select-wrap"><select class="bp-select" data-body-option="${key}">${options.map(([v, text]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${text}</option>`).join('')}</select></span></label>`;
}
const armOptions = () => [['full', 'Full limb'], ['aboveElbow', 'Above-elbow / transhumeral'], ['belowElbow', 'Below-elbow / transradial'], ['shoulder', 'Shoulder disarticulation']];
const legOptions = () => [['full', 'Full limb'], ['aboveKnee', 'Above-knee / transfemoral'], ['belowKnee', 'Below-knee / transtibial']];

// Front-view silhouette with measurement callouts, drawn from the same body model as the 3D figure.
// Callout values are shown in the current display unit.
export function silhouetteSVG(b) {
  const M = bodyModel(b);
  const lm = M.lm;
  const H = lm.H;
  const Y = (y) => (H - y).toFixed(2);
  const torsoR = M.torso.map((t) => `${t.rx.toFixed(2)},${Y(t.y)}`);
  const torsoL = M.torso
    .slice()
    .reverse()
    .map((t) => `${(-t.rx).toFixed(2)},${Y(t.y)}`);
  const leg = (s) => {
    const outer = M.legs.map((l) => `${(s * (lm.legX + l.r)).toFixed(2)},${Y(l.y)}`);
    const inner = M.legs
      .slice()
      .reverse()
      .map((l) => `${(s * (lm.legX - l.r)).toFixed(2)},${Y(l.y)}`);
    return `<polygon points="${outer.join(' ')} ${inner.join(' ')}" />`;
  };
  const arm = (s) => {
    const dir = M.armDir.clone();
    dir.x *= s;
    const j = s < 0 ? M.jointL : M.jointR;
    const e = { x: -dir.y, y: dir.x };
    const side1 = M.arm.map((a) => `${(j.x + dir.x * a.t + e.x * a.r).toFixed(2)},${Y(j.y + dir.y * a.t + e.y * a.r)}`);
    const side2 = M.arm
      .slice()
      .reverse()
      .map((a) => `${(j.x + dir.x * a.t - e.x * a.r).toFixed(2)},${Y(j.y + dir.y * a.t - e.y * a.r)}`);
    const hand = { x: j.x + dir.x * (lm.armLen + 4), y: j.y + dir.y * (lm.armLen + 4) };
    return `<polygon points="${side1.join(' ')} ${side2.join(' ')}" /><ellipse cx="${hand.x.toFixed(2)}" cy="${Y(hand.y)}" rx="${(M.upperR * 0.45).toFixed(2)}" ry="${(M.upperR * 1).toFixed(2)}" />`;
  };
  const p = (y) => M.profileAt(y);
  const dimH = (y, label, val) => {
    const r = p(y).rx;
    return `<line x1="${-r}" y1="${Y(y)}" x2="${r}" y2="${Y(y)}" class="dl"/><text x="${-r - 3}" y="${+Y(y) + 2.5}" text-anchor="end" class="dt">${label} ${formatLength(val)}</text>`;
  };
  // Height runs up the far left with its label turned along the line.
  const x0 = -96;
  return `<svg viewBox="-110 -6 220 ${H + 12}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Body silhouette">
    <g class="bodyfill">
      ${leg(-1)}${leg(1)}${arm(-1)}${arm(1)}
      <polygon points="${torsoR.join(' ')} ${torsoL.join(' ')}" />
      <ellipse cx="0" cy="${Y(lm.headY)}" rx="${lm.headR * 0.82}" ry="${lm.headR * 1.08}" />
    </g>
    ${dimH(lm.chestY, 'chest', b.chest)}
    ${dimH(lm.waistY, 'waist', b.waist)}
    ${dimH(lm.hipY, 'hips', b.hips)}
    <line x1="${-b.shoulder / 2}" y1="${Y(lm.shoulderY + 4)}" x2="${b.shoulder / 2}" y2="${Y(lm.shoulderY + 4)}" class="dl"/>
    <text x="${b.shoulder / 2 + 2}" y="${+Y(lm.shoulderY + 4) - 1.5}" class="dt">shoulder ${formatLength(b.shoulder)}</text>
    <line x1="${x0}" y1="${Y(0)}" x2="${x0}" y2="${Y(H)}" class="dl"/>
    <text transform="translate(${x0 - 2.5} ${Y(H / 2)}) rotate(-90)" text-anchor="middle" class="dt">height ${formatLength(b.height)}</text>
    <line x1="${lm.legX + 12}" y1="${Y(0)}" x2="${lm.legX + 12}" y2="${Y(lm.crotchY)}" class="dl dl2"/>
    <text x="${lm.legX + 14}" y="${Y(lm.crotchY / 2)}" class="dt">inseam ${formatLength(b.inseam)}</text>
    <line x1="-110" y1="${Y(0)}" x2="110" y2="${Y(0)}" class="dl-ground" stroke="#cbbfa9" stroke-width=".5"/>
  </svg>`;
}

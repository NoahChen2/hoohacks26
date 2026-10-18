import { BUILD_LABELS, PROPORTION_FIELDS, buildStartingPoint } from '../character/settings.ts';
import { state, emit, BODY_FIELDS, BODY_PRESETS, BODY_PROFILE_DEFAULTS, FRAME_TO_SHAPE, SHAPE_TO_FRAME } from '../state.js';
import { bodyModel } from '../model.js';
import { inch } from '../upcycle.js';

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
let bodyPane = 'measurements';

// Options saved with the profile that the 3D character does not model yet.
const NOT_IN_3D = '<p class="option-note">Saved with your profile. Not shown on the 3D character yet.</p>';

export function renderBodyPanel(el) {
  const b = state.body;
  const character = state.character;
  Object.entries(BODY_PROFILE_DEFAULTS).forEach(([key, value]) => {
    if (b[key] == null) b[key] = key === 'frame' ? SHAPE_TO_FRAME[character.bodyPreset] : value;
  });
  el.innerHTML = `
    <div class="panel-head">
      <h2>Your body</h2>
      <p>Enter real tape-measure numbers. Everything in the 3D view and the cut lines is worked out from these.</p>
    </div>
    <div class="presets">${Object.keys(BODY_PRESETS)
      .map((k) => `<button class="pill" data-preset="${k}" aria-pressed="${character.sizePreset === k}">${k}</button>`)
      .join('')}</div>
    <div class="body-subtabs">
      <button data-body-pane="measurements" class="${bodyPane === 'measurements' ? 'active' : ''}">📏 <span>Measurements</span></button>
      <button data-body-pane="frame" class="${bodyPane === 'frame' ? 'active' : ''}">👤 <span>Frame & maternity</span></button>
      <button data-body-pane="accessibility" class="${bodyPane === 'accessibility' ? 'active' : ''}">♿ <span>Accessibility</span></button>
      <button data-body-pane="appearance" class="${bodyPane === 'appearance' ? 'active' : ''}">✨ <span>Appearance</span></button>
    </div>
    <div class="body-pane" data-pane="frame" ${bodyPane === 'frame' ? '' : 'hidden'}>
    <section class="sec anatomy-controls">
      <h3>Body frame & anatomy base</h3>
      <label class="choice-label">Body frame</label>
      <div class="visual-choices three">${choiceCards('frame', [['female','◡','Female'],['neutral','◇','Neutral'],['male','▽','Male']], b.frame)}</div>
      ${selectField('chestOption', 'Chest profile', [['symmetric','Symmetric'],['leftFlat','Unilateral flat — left'],['rightFlat','Unilateral flat — right'],['bilateralFlat','Bilateral flat']], b.chestOption)}
      <label class="field"><span class="field-top"><span>Chest tissue projection</span><span class="val">${Math.round(b.chestProjection * 100)}%</span></span><input type="range" data-option-range="chestProjection" min="0" max="1" step="0.05" value="${b.chestProjection}"/></label>
      <label class="choice-label">Maternity / abdomen</label>
      <div class="visual-choices four">${choiceCards('maternity', [['none','○','None'],['first','◔','1st tri'],['second','◑','2nd tri'],['third','●','3rd tri']], b.maternity)}</div>
      ${selectField('posture', 'Posture / spine', [['upright','Standard upright'],['kyphosis','Kyphosis / rounded back'],['scoliosis','Scoliosis asymmetry'],['seated','Seated / wheelchair']], b.posture)}
      ${NOT_IN_3D.replace('Saved', 'Posture is saved')}
    </section>
    </div>
    <div class="body-pane" data-pane="accessibility" ${bodyPane === 'accessibility' ? '' : 'hidden'}>
    <section class="sec anatomy-controls">
      <h3>Accessibility & body representation</h3>
      ${selectField('stature', 'Stature profile', [['standard','Standard proportionate'],['achondroplasia','Achondroplasia preset'],['proportionateShort','Proportionate short stature']], b.stature)}
      <label class="field"><span class="field-top"><span>Limb-to-torso ratio</span><span class="val">${Math.round(b.limbRatio * 100)}%</span></span><input type="range" data-option-range="limbRatio" min="0.55" max="1.15" step="0.05" value="${b.limbRatio}"/></label>
      <div class="row2">
        ${selectField('leftArm', 'Left arm', armOptions(), b.leftArm)}
        ${selectField('rightArm', 'Right arm', armOptions(), b.rightArm)}
        ${selectField('leftLeg', 'Left leg', legOptions(), b.leftLeg)}
        ${selectField('rightLeg', 'Right leg', legOptions(), b.rightLeg)}
      </div>
      ${NOT_IN_3D}
    </section>
    </div>
    <div class="body-pane" data-pane="appearance" ${bodyPane === 'appearance' ? '' : 'hidden'}>
    <section class="body-proportions">
      <h3>Appearance proportions <span>Preview only</span></h3>
      <p>These change the character and clothing preview together. They do not change tape measurements, fit warnings or cut lines.</p>
      ${PROPORTION_FIELDS.map(([key, label, min, max]) => `<label class="field"><span class="field-top"><span>${label}</span><output data-proportion-value="${key}">${Math.round(character.proportions[key] * 100)}%</output></span><input type="range" data-proportion="${key}" min="${min}" max="${max}" step=".05" value="${character.proportions[key]}" /></label>`).join('')}
      <button class="btn small ghost" id="reset-proportions">Reset appearance proportions</button>
    </section>
    </div>
    <div class="body-pane" data-pane="measurements" ${bodyPane === 'measurements' ? '' : 'hidden'}>
    <section class="body-starting-points" aria-label="Build starting points">
      <span class="body-section-label">BUILD STARTING POINTS</span>
      <div class="body-build-options" role="group" aria-label="Body build">
        ${Object.entries(BUILD_LABELS).map(([value, label]) => `<button class="pill ${character.build === value ? 'active' : ''}" data-build="${value}" aria-pressed="${character.build === value}">${label}</button>`).join('')}
      </div>
      <p>Builds set editable measurement values. Manual edits always take precedence.</p>
    </section>
    <div class="body-grid">
      <div class="silhouette" id="silhouette"></div>
      <div class="fields">
        ${BODY_FIELDS.map(
          ([key, label, min, max]) => `
          <label class="field" title="${HINTS[key]}">
            <span class="field-top"><span>${label}</span><span class="val"><input type="number" data-num="${key}" value="${b[key]}" min="${min}" max="${max}" step="0.5"/> cm <em data-in="${key}">${inch(b[key])}</em></span></span>
            <input type="range" data-key="${key}" min="${min}" max="${max}" step="0.5" value="${b[key]}" />
            <small>${HINTS[key]}</small>
          </label>`
        ).join('')}
      </div>
    </div>
    </div>
  `;
  const sil = el.querySelector('#silhouette');
  const draw = () => (sil.innerHTML = silhouetteSVG(state.body));
  draw();

  el.querySelectorAll('[data-body-pane]').forEach((button) =>
    button.addEventListener('click', () => {
      bodyPane = button.dataset.bodyPane;
      el.querySelectorAll('[data-body-pane]').forEach((item) => item.classList.toggle('active', item === button));
      el.querySelectorAll('[data-pane]').forEach((pane) => (pane.hidden = pane.dataset.pane !== bodyPane));
    })
  );
  el.querySelectorAll('[data-choice]').forEach((button) =>
    button.addEventListener('click', () => {
      b[button.dataset.choice] = button.dataset.value;
      // The body frame sets the 3D character's shape.
      if (button.dataset.choice === 'frame') character.bodyPreset = FRAME_TO_SHAPE[button.dataset.value];
      button.parentElement.querySelectorAll('[data-choice]').forEach((item) => item.classList.toggle('active', item === button));
      draw();
      emit('body');
    })
  );

  el.querySelectorAll('[data-body-option]').forEach((control) =>
    control.addEventListener('change', () => {
      b[control.dataset.bodyOption] = control.value;
      draw();
      emit('body');
    })
  );
  el.querySelectorAll('[data-option-range]').forEach((control) =>
    control.addEventListener('input', () => {
      b[control.dataset.optionRange] = parseFloat(control.value);
      control.closest('.field').querySelector('.val').textContent = `${Math.round(parseFloat(control.value) * 100)}%`;
      draw();
      emit('body');
    })
  );

  const set = (key, v) => {
    if (!Number.isFinite(v)) return;
    const [, , min, max] = BODY_FIELDS.find((field) => field[0] === key);
    const numeric = el.querySelector(`[data-num="${key}"]`);
    numeric.setCustomValidity(v < min || v > max ? `Enter ${min}–${max} cm.` : '');
    if (!numeric.reportValidity()) return;
    state.body[key] = v;
    character.sizePreset = null;
    el.querySelector(`[data-key="${key}"]`).value = v;
    const num = el.querySelector(`[data-num="${key}"]`);
    if (document.activeElement !== num) num.value = v;
    el.querySelector(`[data-in="${key}"]`).textContent = inch(v);
    draw();
    emit('body');
  };
  el.querySelectorAll('input[type=range][data-key]').forEach((r) => r.addEventListener('input', () => set(r.dataset.key, parseFloat(r.value))));
  el.querySelectorAll('input[data-num]').forEach((n) => n.addEventListener('change', () => set(n.dataset.num, parseFloat(n.value))));
  el.querySelectorAll('[data-preset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      Object.assign(b, BODY_PRESETS[btn.dataset.preset]);
      character.sizePreset = btn.dataset.preset;
      character.build = 'average';
      renderBodyPanel(el);
      emit('body');
    })
  );
  el.querySelectorAll('[data-build]').forEach((button) =>
    button.addEventListener('click', () => {
      const build = button.dataset.build;
      const closest = Object.keys(BODY_PRESETS).reduce((best, key) => (Math.abs(BODY_PRESETS[key].height - b.height) < Math.abs(BODY_PRESETS[best].height - b.height) ? key : best), Object.keys(BODY_PRESETS)[0]);
      const source = BODY_PRESETS[character.sizePreset] || { ...BODY_PRESETS[closest], height: b.height, arm: b.arm, inseam: b.inseam };
      const values = buildStartingPoint(source, build);
      for (const [key, , min, max] of BODY_FIELDS) if (values[key] != null) b[key] = Math.max(min, Math.min(max, values[key]));
      character.build = build;
      character.proportions.muscleDefinition = { slim: .08, average: .15, athletic: .55, muscular: .9, curvy: .12, plus: .05 }[build];
      renderBodyPanel(el);
      emit('body');
    })
  );
  el.querySelectorAll('[data-proportion]').forEach((input) =>
    input.addEventListener('input', () => {
      character.proportions[input.dataset.proportion] = Number(input.value);
      el.querySelector(`[data-proportion-value="${input.dataset.proportion}"]`).textContent = `${Math.round(Number(input.value) * 100)}%`;
      emit('character');
    })
  );
  el.querySelector('#reset-proportions').addEventListener('click', () => {
    for (const [key] of PROPORTION_FIELDS) character.proportions[key] = key === 'muscleDefinition' ? .15 : 0;
    renderBodyPanel(el);
    emit('character');
  });
}

function selectField(key, label, options, value) {
  return `<label class="lbl">${label}<select data-body-option="${key}">${options.map(([v, text]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}
function choiceCards(key, options, value) {
  return options.map(([v, icon, label]) => `<button type="button" class="visual-choice ${v === value ? 'active' : ''}" data-choice="${key}" data-value="${v}"><b>${icon}</b><span>${label}</span></button>`).join('');
}
const armOptions = () => [['full','Full limb'],['aboveElbow','Above-elbow / transhumeral'],['belowElbow','Below-elbow / transradial'],['shoulder','Shoulder disarticulation']];
const legOptions = () => [['full','Full limb'],['aboveKnee','Above-knee / transfemoral'],['belowKnee','Below-knee / transtibial']];

// Front-view silhouette with measurement callouts, drawn from the same body model as the 3D figure.
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
    return `<line x1="${-r}" y1="${Y(y)}" x2="${r}" y2="${Y(y)}" class="dl"/><text x="${-r - 3}" y="${+Y(y) + 1.2}" text-anchor="end" class="dt">${label} ${val}</text>`;
  };
  const x0 = 52;
  return `<svg viewBox="-80 -6 160 ${H + 12}" xmlns="http://www.w3.org/2000/svg">
    <g class="bodyfill">
      ${leg(-1)}${leg(1)}${arm(-1)}${arm(1)}
      <polygon points="${torsoR.join(' ')} ${torsoL.join(' ')}" />
      <ellipse cx="0" cy="${Y(lm.headY)}" rx="${lm.headR * 0.82}" ry="${lm.headR * 1.08}" />
    </g>
    ${dimH(lm.chestY, 'chest', b.chest)}
    ${dimH(lm.waistY, 'waist', b.waist)}
    ${dimH(lm.hipY, 'hips', b.hips)}
    <line x1="${-b.shoulder / 2}" y1="${Y(lm.shoulderY + 4)}" x2="${b.shoulder / 2}" y2="${Y(lm.shoulderY + 4)}" class="dl"/>
    <text x="${b.shoulder / 2 + 2}" y="${+Y(lm.shoulderY + 4) - 1}" class="dt">shoulder ${b.shoulder}</text>
    <line x1="${x0}" y1="${Y(0)}" x2="${x0}" y2="${Y(H)}" class="dl"/>
    <text x="${x0 + 2}" y="${Y(H / 2)}" class="dt">height ${b.height}</text>
    <line x1="${lm.legX + 12}" y1="${Y(0)}" x2="${lm.legX + 12}" y2="${Y(lm.crotchY)}" class="dl dl2"/>
    <text x="${lm.legX + 14}" y="${Y(lm.crotchY / 2)}" class="dt">inseam ${b.inseam}</text>
    <line x1="-80" y1="${Y(0)}" x2="80" y2="${Y(0)}" stroke="#cbbfa9" stroke-width=".5"/>
  </svg>`;
}

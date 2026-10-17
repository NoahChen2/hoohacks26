import { state, emit, BODY_FIELDS, BODY_PRESETS } from '../state.js';
import { bodyModel } from '../model.js';
import { inch } from '../upcycle.js';

const HINTS = {
  height: 'Barefoot, standing straight against a wall.',
  chest: 'Around the fullest part of the chest / bust, tape level.',
  waist: 'Around your natural waist, the narrowest point, above the navel.',
  hips: 'Around the widest part of the hips and seat.',
  shoulder: 'Across the back, from shoulder bone to shoulder bone.',
  arm: 'From the shoulder bone, over a slightly bent elbow, to the wrist.',
  inseam: 'From the crotch straight down the inside leg to the floor.',
  neck: 'Around the base of the neck.',
  thigh: 'Around the fullest part of one thigh.',
};

export function renderBodyPanel(el) {
  const b = state.body;
  el.innerHTML = `
    <div class="panel-head">
      <h2>Your body</h2>
      <p>Enter real tape-measure numbers. Everything in the 3D view and the cut lines is worked out from these.</p>
    </div>
    <div class="presets">${Object.keys(BODY_PRESETS)
      .map((k) => `<button class="pill" data-preset="${k}">${k}</button>`)
      .join('')}</div>
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
  `;
  const sil = el.querySelector('#silhouette');
  const draw = () => (sil.innerHTML = silhouetteSVG(state.body));
  draw();

  const set = (key, v) => {
    if (Number.isNaN(v)) return;
    state.body[key] = v;
    el.querySelector(`[data-key="${key}"]`).value = v;
    const num = el.querySelector(`[data-num="${key}"]`);
    if (document.activeElement !== num) num.value = v;
    el.querySelector(`[data-in="${key}"]`).textContent = inch(v);
    draw();
    emit('body');
  };
  el.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => set(r.dataset.key, parseFloat(r.value))));
  el.querySelectorAll('input[data-num]').forEach((n) => n.addEventListener('change', () => set(n.dataset.num, parseFloat(n.value))));
  el.querySelectorAll('[data-preset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      Object.entries(BODY_PRESETS[btn.dataset.preset]).forEach(([k, v]) => set(k, v));
    })
  );
}

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

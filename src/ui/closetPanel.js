import { state, emit, GARMENT_TYPES, MATERIALS, PATTERNS, garmentFields, defaultGarment, selectedGarment, garmentFromSpec, STARTER_PIECES, isWorn, setWorn, addGarments } from '../state.js';
import { scanPhoto } from '../scan/scan.js';
import { describeEstimate } from '../scan/bodyEstimate.js';
import { flatSVG, flatViewBox } from '../flats.js';
import { PATTERN_LABELS, svgPattern } from '../patterns.js';
import { escapeHtml } from './escape.js';
import { unit, toUnit, fromUnit, unitStep, unitRange, otherUnit, unitToggle, bindUnitToggle } from './units.js';
import './bodyPanel.css';

const PPC = 8; // sketch canvas px per cm
const STAMPS = ['★', '♥', '✿', '☀', '☾', '⚡'];

export function renderClosetPanel(el) {
  el.innerHTML = `
    <div class="panel-head">
      <h2>Your closet</h2>
      <p>Add the clothes you don't wear. Tap a piece to put it on: the 3D body wears a whole outfit, one piece per layer. Measure them laid flat and enter the real sizes, then sketch any designs you want to see.</p>
    </div>
    <section class="closet-scan">
      <label class="btn scan-photo">Scan clothes from a photo<input type="file" id="scan-photo" accept="image/jpeg,image/png,image/webp" hidden/></label>
      <p class="scan-msg" id="scan-msg" role="status" aria-live="polite">Every garment found in the photo is added to your closet and dressed on the 3D body. When someone is wearing them, the AI scan also matches the 3D body to them. With a server Gemini key the photo is sent to Google Gemini (on its free tier, Google may use it to improve its products); otherwise it is scanned on this device.</p>
    </section>
    <div class="closet-list" id="closet-list"></div>
    <details class="starter-rail">
      <summary>Add starter pieces <small>${STARTER_PIECES.length} basics, sized to your body</small></summary>
      <div class="starter-grid" id="starter-grid"></div>
    </details>
    <div class="editor" id="editor"></div>
  `;
  renderList(el.querySelector('#closet-list'));
  renderEditor(el.querySelector('#editor'));
  renderStarters(el);
  bindScan(el);
}

// Selecting a piece also puts it on, replacing whatever shares its slot.
function wear(g) {
  state.selected = g.id;
  setWorn(g, true);
}

function rerender() {
  const list = document.getElementById('closet-list');
  if (!list) return;
  renderList(list);
  renderEditor(document.getElementById('editor'));
}

function renderStarters(el) {
  const grid = el.querySelector('#starter-grid');
  const pieces = STARTER_PIECES.map((spec) => garmentFromSpec(spec, state.body));
  grid.innerHTML = pieces
    .map((g, i) => `<button type="button" class="starter" data-starter="${i}" title="Add ${escapeHtml(g.name)}"><span class="g-thumb">${thumb(g)}</span><span>${escapeHtml(g.name)}</span></button>`)
    .join('');
  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-starter]');
    if (!button) return;
    // A fresh copy each time, so the same basic can be added twice.
    addGarments([garmentFromSpec(STARTER_PIECES[Number(button.dataset.starter)], state.body)]);
    emit('select');
    rerender();
  });
}

function bindScan(el) {
  const input = el.querySelector('#scan-photo');
  const msg = el.querySelector('#scan-msg');
  const label = el.querySelector('.scan-photo');
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    label.classList.add('busy');
    msg.textContent = 'Scanning your photo for clothes…';
    try {
      const { garments, notice, mode, wearer } = await scanPhoto(file, { body: state.body, character: state.character });
      if (!garments.length) {
        msg.textContent = notice || 'No clothes were found in that photo. Try one with the garment clearly in view.';
        return;
      }
      // The body changes before the garments go on, so they fit the new shape.
      const before = wearer && { body: { ...state.body }, character: JSON.parse(JSON.stringify(state.character)) };
      if (wearer) setBody(wearer);
      addGarments(garments);
      emit('select');
      rerender();
      msg.textContent = `${mode === 'live' ? 'AI scan' : 'On-device scan'}: added and wearing ${garments.map((g) => g.name).join(', ')}. ${notice}`;
      if (wearer) {
        const undo = document.createElement('button');
        undo.type = 'button';
        undo.className = 'scan-undo';
        undo.textContent = 'Keep my previous body';
        undo.addEventListener('click', () => {
          setBody(before);
          undo.remove();
          msg.append(' Your previous body is back; the scanned clothes stay sized to the photo.');
        });
        msg.append(` Body: ${describeEstimate(wearer.estimate)}. `, undo);
      }
    } catch (error) {
      msg.textContent = error.message || 'The photo could not be scanned.';
    } finally {
      label.classList.remove('busy');
    }
  });
}

// Measurements and character settings change in place: other modules hold these objects.
function setBody({ body, character }) {
  Object.assign(state.body, body);
  Object.assign(state.character, character);
  emit('body');
}

function thumb(g) {
  return flatSVG(g, { width: 60, pad: 5, flaws: false });
}

function renderList(list) {
  list.innerHTML =
    state.garments
      .map(
        (g) => `
      <button class="g-card ${g.id === state.selected ? 'active' : ''} ${isWorn(g) ? 'worn' : ''}" data-id="${g.id}" title="${isWorn(g) ? 'Wearing' : 'Put on'} ${escapeHtml(g.name)}">
        <span class="g-thumb">${thumb(g)}</span>
        <span class="g-name">${escapeHtml(g.name)}</span>
        ${isWorn(g) ? '<span class="g-worn keep-bg">On</span>' : ''}
      </button>`
      )
      .join('') +
    `<div class="g-add">
      <select id="add-type">${Object.entries(GARMENT_TYPES)
        .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
        .join('')}</select>
      <button class="btn small" id="add-btn">+ Add</button>
    </div>`;
  list.querySelectorAll('.g-card').forEach((c) =>
    c.addEventListener('click', () => {
      wear(state.garments.find((g) => g.id === c.dataset.id));
      emit('select');
      renderList(list);
      renderEditor(document.getElementById('editor'));
    })
  );
  list.querySelector('#add-btn').addEventListener('click', () => {
    const g = defaultGarment(list.querySelector('#add-type').value);
    state.garments.push(g);
    wear(g);
    emit('select');
    renderList(list);
    renderEditor(document.getElementById('editor'));
  });
}

function refreshThumb(g) {
  const card = document.querySelector(`.g-card[data-id="${g.id}"]`);
  if (card) {
    card.querySelector('.g-thumb').innerHTML = thumb(g);
    card.querySelector('.g-name').textContent = g.name;
  }
}

function renderEditor(ed) {
  const g = selectedGarment();
  if (!g) {
    ed.innerHTML = '<p class="muted">Add a garment to get started.</p>';
    return;
  }
  const fields = garmentFields(g.type);
  const u = unit();
  ed.innerHTML = `
    <div class="wear-row">
      <span>${isWorn(g) ? 'On the 3D body' : 'In the closet'}</span>
      <button class="btn small ${isWorn(g) ? 'ghost' : ''}" id="g-wear">${isWorn(g) ? 'Take off' : 'Put on'}</button>
    </div>
    <section class="sec">
      <h3>Details</h3>
      <div class="row2">
        <label class="lbl">Name<input type="text" id="g-name" value="${escapeHtml(g.name)}"/></label>
        <label class="lbl">Type<select id="g-type">${Object.entries(GARMENT_TYPES)
          .map(([k, v]) => `<option value="${k}" ${k === g.type ? 'selected' : ''}>${v.label}</option>`)
          .join('')}</select></label>
      </div>
      <label class="lbl">Fabric<select id="g-mat">${Object.entries(MATERIALS)
        .map(([k, v]) => `<option value="${k}" ${k === g.material ? 'selected' : ''}>${v.label}</option>`)
        .join('')}</select></label>
    </section>

    <section class="sec">
      <h3>Colour & pattern</h3>
      <div class="swatches">${PATTERNS.map(
        (p) => `<button class="swatch ${p === g.pattern ? 'active' : ''}" data-pattern="${p}" title="${PATTERN_LABELS[p]}">
          <svg viewBox="0 0 16 16"><defs>${svgPattern('sw' + p, { ...g, pattern: p }, 0.9)}</defs><rect width="16" height="16" rx="3" fill="url(#sw${p})"/></svg>
          <span>${PATTERN_LABELS[p]}</span></button>`
      ).join('')}</div>
      <div class="row2">
        <label class="lbl color">Main colour<input type="color" id="g-c1" value="${g.color}"/></label>
        <label class="lbl color">Pattern colour<input type="color" id="g-c2" value="${g.color2}"/></label>
      </div>
      <div class="row2 checks">
        <label class="check"><input type="checkbox" id="g-stains" ${g.stains ? 'checked' : ''}/> Has a stain</label>
        <label class="check"><input type="checkbox" id="g-holes" ${g.holes ? 'checked' : ''}/> Has a hole / tear</label>
      </div>
    </section>

    <section class="sec bp-units-scope">
      <div class="bp-measure-head">
        <h3>Measurements (laid flat)</h3>
        ${unitToggle('closet-units')}
      </div>
      <div class="fields compact">
      ${fields
        .map(([key, label, min, max]) => {
          const [lo, hi] = unitRange(min, max, u);
          const shown = toUnit(g[key], u);
          return `
        <label class="field">
          <span class="field-top"><span>${label}</span><span class="val"><input type="number" data-num="${key}" value="${shown}" min="${lo}" max="${hi}" step="any" inputmode="decimal"/> ${u} <em data-in="${key}">${otherUnit(g[key], {}, u)}</em></span></span>
          <input type="range" data-key="${key}" min="${lo}" max="${hi}" step="${unitStep(u)}" value="${Math.max(lo, Math.min(hi, shown))}" aria-label="${label} (${u})"/>
        </label>`;
        })
        .join('')}
      </div>
      <p class="hint">Circumference = flat width × 2 (e.g. measure armpit to armpit and double it for chest).</p>
    </section>

    <section class="sec">
      <h3>Sketch your design</h3>
      <p class="hint">Draw right on the garment. It's shown at real scale, so the 3D view and the paint guide will place it exactly.</p>
      <div class="sketch-tools">
        <input type="color" id="sk-color" value="#f4d35e" title="Brush colour"/>
        <div class="seg" id="sk-size">
          <button data-size="0.4">S</button><button data-size="1" class="active">M</button><button data-size="2.2">L</button>
        </div>
        <div class="seg" id="sk-mode">
          <button data-mode="pen" class="active" title="Pen">✎</button>
          <button data-mode="erase" title="Eraser">⌫</button>
          ${STAMPS.map((s) => `<button data-mode="stamp" data-stamp="${s}" title="Stamp">${s}</button>`).join('')}
        </div>
        <button class="btn small ghost" id="sk-undo">Undo</button>
        <button class="btn small ghost" id="sk-clear">Clear</button>
      </div>
      <div class="sketch-wrap" id="sketch-wrap">
        <div class="sketch-bg" id="sketch-bg"></div>
        <canvas id="sketch"></canvas>
      </div>
    </section>

    <div class="editor-foot">
      <button class="btn ghost danger" id="g-del">Delete</button>
      <button class="btn ghost" id="g-dup">Duplicate</button>
      <button class="btn" id="g-go">Find upcycles →</button>
    </div>
  `;

  const changed = (reason = 'garment') => {
    emit(reason);
    refreshThumb(g);
  };

  ed.querySelector('#g-name').addEventListener('input', (e) => {
    g.name = e.target.value || 'Untitled';
    changed();
  });
  ed.querySelector('#g-type').addEventListener('change', (e) => {
    const fresh = defaultGarment(e.target.value);
    const oldLabel = GARMENT_TYPES[g.type].label;
    const keep = { id: g.id, name: g.name, material: g.material, color: g.color, color2: g.color2, pattern: g.pattern, stains: g.stains, holes: g.holes, sketch: g.sketch, sketchBox: g.sketchBox, sketchBounds: g.sketchBounds };
    Object.keys(g).forEach((k) => delete g[k]);
    Object.assign(g, fresh, keep);
    if (g.name === oldLabel) g.name = fresh.name;
    // A new type can move it to another slot (a shirt becoming a dress).
    if (isWorn(g)) setWorn(g, true);
    changed('outfit');
    renderList(document.getElementById('closet-list'));
    renderEditor(ed);
  });
  ed.querySelector('#g-wear').addEventListener('click', () => {
    setWorn(g, !isWorn(g));
    emit('outfit');
    renderList(document.getElementById('closet-list'));
    renderEditor(ed);
  });
  ed.querySelector('#g-mat').addEventListener('change', (e) => {
    g.material = e.target.value;
    changed();
  });
  ed.querySelectorAll('[data-pattern]').forEach((b) =>
    b.addEventListener('click', () => {
      g.pattern = b.dataset.pattern;
      ed.querySelectorAll('[data-pattern]').forEach((x) => x.classList.toggle('active', x === b));
      changed();
      sketch.refreshBg();
    })
  );
  const colorInput = (id, key) =>
    ed.querySelector(id).addEventListener('input', (e) => {
      g[key] = e.target.value;
      changed();
      sketch.refreshBg();
      // recolour pattern swatches
      ed.querySelectorAll('.swatch svg').forEach((svg, i) => {
        const p = PATTERNS[i];
        svg.querySelector('defs').innerHTML = svgPattern('sw' + p, { ...g, pattern: p }, 0.9);
      });
    });
  colorInput('#g-c1', 'color');
  colorInput('#g-c2', 'color2');
  ed.querySelector('#g-stains').addEventListener('change', (e) => {
    g.stains = e.target.checked;
    changed();
    sketch.refreshBg();
  });
  ed.querySelector('#g-holes').addEventListener('change', (e) => {
    g.holes = e.target.checked;
    changed();
    sketch.refreshBg();
  });

  let relayout;
  // Controls work in the display unit; the garment keeps centimetres.
  const setField = (key, cm) => {
    const [, , min, max] = fields.find((field) => field[0] === key);
    g[key] = Math.max(min, Math.min(max, cm));
    const shown = toUnit(g[key]);
    ed.querySelector(`[data-key="${key}"]`).value = shown;
    const num = ed.querySelector(`[data-num="${key}"]`);
    if (document.activeElement !== num) num.value = shown;
    ed.querySelector(`[data-in="${key}"]`).textContent = otherUnit(g[key]);
    changed();
    clearTimeout(relayout);
    relayout = setTimeout(() => sketch.layout(), 120);
  };
  ed.querySelectorAll('input[type=range][data-key]').forEach((r) =>
    r.addEventListener('input', () => {
      const v = parseFloat(r.value);
      if (Number.isFinite(v)) setField(r.dataset.key, fromUnit(v));
    })
  );
  ed.querySelectorAll('input[data-num]').forEach((n) => {
    n.addEventListener('input', () => n.setCustomValidity(''));
    n.addEventListener('change', () => {
      const key = n.dataset.num;
      const [, , min, max] = fields.find((field) => field[0] === key);
      const [lo, hi] = unitRange(min, max);
      const v = parseFloat(n.value);
      if (!Number.isFinite(v) || v < lo || v > hi) {
        n.setCustomValidity(`Enter ${lo}–${hi} ${unit()}.`);
        n.reportValidity();
        return;
      }
      n.setCustomValidity('');
      setField(key, fromUnit(v));
      n.value = toUnit(g[key]);
    });
  });
  bindUnitToggle(ed.querySelector('.bp-units-scope'));

  ed.querySelector('#g-del').addEventListener('click', () => {
    if (!confirm(`Delete “${g.name}”?`)) return;
    setWorn(g, false);
    state.garments = state.garments.filter((x) => x.id !== g.id);
    state.selected = state.garments[0]?.id || null;
    emit('select');
    renderClosetPanel(ed.parentElement);
  });
  ed.querySelector('#g-dup').addEventListener('click', () => {
    const copy = JSON.parse(JSON.stringify(g));
    copy.id = Math.random().toString(36).slice(2, 9);
    copy.name = g.name + ' (copy)';
    state.garments.push(copy);
    wear(copy);
    emit('select');
    renderClosetPanel(ed.parentElement);
  });
  ed.querySelector('#g-go').addEventListener('click', () => emit('goto:upcycle'));

  const sketch = sketchPad(ed, g);
}

// ---------------------------------------------------------------- sketch pad

function sketchPad(ed, g) {
  const wrap = ed.querySelector('#sketch-wrap');
  const bg = ed.querySelector('#sketch-bg');
  const canvas = ed.querySelector('#sketch');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let box;
  let mode = 'pen',
    stamp = '★',
    size = 1,
    color = '#f4d35e';
  const undo = [];

  function refreshBg() {
    bg.innerHTML = flatSVG(g, { pad: 6, sketch: false, width: '100%' });
  }

  function layout() {
    box = flatViewBox(g, 6);
    wrap.style.aspectRatio = `${box.w} / ${box.h}`;
    canvas.width = Math.round(box.w * PPC);
    canvas.height = Math.round(box.h * PPC);
    refreshBg();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (g.sketch && g.sketchBox) {
      const img = new Image();
      img.onload = () => {
        const sb = g.sketchBox;
        ctx.drawImage(img, (sb.x - box.x) * PPC, (sb.y - box.y) * PPC, sb.w * PPC, sb.h * PPC);
        save(false);
      };
      img.src = g.sketch;
    }
  }

  function save(notify = true) {
    // find content bounds (cm) so the paint guide knows the design's real size
    const { width: w, height: h } = canvas;
    const data = ctx.getImageData(0, 0, w, h).data;
    let x0 = w,
      y0 = h,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < h; y += 3)
      for (let x = 0; x < w; x += 3) {
        if (data[(y * w + x) * 4 + 3] > 10) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    if (x1 < 0) {
      g.sketch = null;
      g.sketchBox = null;
      g.sketchBounds = null;
    } else {
      g.sketch = canvas.toDataURL('image/png');
      g.sketchBox = { ...box };
      g.sketchBounds = { x: box.x + x0 / PPC, y: box.y + y0 / PPC, w: Math.max(1, (x1 - x0) / PPC), h: Math.max(1, (y1 - y0) / PPC) };
    }
    if (notify) {
      emit('garment');
      refreshThumb(g);
    }
  }

  const pt = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
  };
  let drawing = false,
    last = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undo.length > 25) undo.shift();
    const p = pt(e);
    if (mode === 'stamp') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      ctx.font = `${size * 7 * PPC}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stamp, p[0], p[1]);
      save();
      return;
    }
    drawing = true;
    last = p;
    stroke(p);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    stroke(pt(e));
  });
  const end = () => {
    if (!drawing) return;
    drawing = false;
    save();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  function stroke(p) {
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = size * PPC * (mode === 'erase' ? 2.5 : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last[0], last[1]);
    ctx.lineTo(p[0] + 0.01, p[1]);
    ctx.stroke();
    last = p;
  }

  ed.querySelector('#sk-color').addEventListener('input', (e) => (color = e.target.value));
  ed.querySelectorAll('#sk-size button').forEach((b) =>
    b.addEventListener('click', () => {
      size = parseFloat(b.dataset.size);
      ed.querySelectorAll('#sk-size button').forEach((x) => x.classList.toggle('active', x === b));
    })
  );
  ed.querySelectorAll('#sk-mode button').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      if (b.dataset.stamp) stamp = b.dataset.stamp;
      ed.querySelectorAll('#sk-mode button').forEach((x) => x.classList.toggle('active', x === b));
    })
  );
  ed.querySelector('#sk-undo').addEventListener('click', () => {
    const prev = undo.pop();
    if (prev) {
      ctx.putImageData(prev, 0, 0);
      save();
    }
  });
  ed.querySelector('#sk-clear').addEventListener('click', () => {
    undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    save();
  });

  layout();
  return { layout, refreshBg };
}

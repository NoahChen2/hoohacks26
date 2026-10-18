import { state, emit, GARMENT_TYPES, MATERIALS, PATTERNS, garmentFields, defaultGarment, selectedGarment } from '../state.js';
import { flatSVG, flatViewBox } from '../flats.js';
import { PATTERN_LABELS, svgPattern } from '../patterns.js';
import { inch } from '../upcycle.js';
import { escapeHtml } from './escape.js';

const PPC = 8; // sketch canvas px per cm
const STAMPS = ['★', '♥', '✿', '☀', '☾', '⚡'];

export function renderClosetPanel(el) {
  el.innerHTML = `
    <div class="panel-head">
      <h2>Your closet</h2>
      <p>Add the clothes you don't wear. Measure them laid flat and enter the real sizes, then sketch any designs you want to see.</p>
    </div>
    <div class="closet-list" id="closet-list"></div>
    <div class="editor" id="editor"></div>
  `;
  renderList(el.querySelector('#closet-list'));
  renderEditor(el.querySelector('#editor'));
}

function thumb(g) {
  return flatSVG(g, { width: 60, pad: 5, flaws: false });
}

function renderList(list) {
  list.innerHTML =
    state.garments
      .map(
        (g) => `
      <button class="g-card ${g.id === state.selected ? 'active' : ''}" data-id="${g.id}">
        <span class="g-thumb">${thumb(g)}</span>
        <span class="g-name">${escapeHtml(g.name)}</span>
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
      state.selected = c.dataset.id;
      emit('select');
      renderList(list);
      renderEditor(document.getElementById('editor'));
    })
  );
  list.querySelector('#add-btn').addEventListener('click', () => {
    const g = defaultGarment(list.querySelector('#add-type').value);
    state.garments.push(g);
    state.selected = g.id;
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
  ed.innerHTML = `
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

    <section class="sec">
      <h3>Measurements <small>(laid flat, in cm)</small></h3>
      <div class="fields compact">
      ${fields
        .map(
          ([key, label, min, max]) => `
        <label class="field">
          <span class="field-top"><span>${label}</span><span class="val"><input type="number" data-num="${key}" value="${g[key]}" min="${min}" max="${max}" step="0.5"/> cm <em data-in="${key}">${inch(g[key])}</em></span></span>
          <input type="range" data-key="${key}" min="${min}" max="${max}" step="0.5" value="${g[key]}"/>
        </label>`
        )
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
    changed();
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
  const setField = (key, v) => {
    if (!Number.isFinite(v)) return;
    const [, , min, max] = fields.find((field) => field[0] === key);
    const input = ed.querySelector(`[data-num="${key}"]`);
    input.setCustomValidity(v < min || v > max ? `Enter ${min}–${max} cm.` : '');
    if (!input.reportValidity()) return;
    g[key] = v;
    ed.querySelector(`[data-key="${key}"]`).value = v;
    const num = ed.querySelector(`[data-num="${key}"]`);
    if (document.activeElement !== num) num.value = v;
    ed.querySelector(`[data-in="${key}"]`).textContent = inch(v);
    changed();
    clearTimeout(relayout);
    relayout = setTimeout(() => sketch.layout(), 120);
  };
  ed.querySelectorAll('input[type=range][data-key]').forEach((r) => r.addEventListener('input', () => setField(r.dataset.key, parseFloat(r.value))));
  ed.querySelectorAll('input[data-num]').forEach((n) => n.addEventListener('change', () => setField(n.dataset.num, parseFloat(n.value))));

  ed.querySelector('#g-del').addEventListener('click', () => {
    if (!confirm(`Delete “${g.name}”?`)) return;
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
    state.selected = copy.id;
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

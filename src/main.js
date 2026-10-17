import { state, emit, subscribe, selectedGarment } from './state.js';
import { createScene } from './scene.js';
import { fitWord } from './model.js';
import { renderBodyPanel } from './ui/bodyPanel.js';
import { renderClosetPanel } from './ui/closetPanel.js';
import { renderUpcyclePanel, previewEvents, setPreview } from './ui/upcyclePanel.js';
import { GARMENT_TYPES } from './state.js';
import { initAccount } from './ui/account.js';

const panel = document.getElementById('panel');
const caption = document.getElementById('stage-caption');
const scene = createScene(document.getElementById('viewport'));

let preview = null; // { g, label }

const PANELS = { body: renderBodyPanel, closet: renderClosetPanel, upcycle: renderUpcyclePanel };

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  panel.scrollTop = 0;
  PANELS[tab](panel);
  emit('tab');
}

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// --- 3D sync (coalesced to one rebuild per frame)
let pending = false;
function syncScene() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    scene.setBody(state.body, state.character);
    scene.setGarment(preview?.g || selectedGarment());
    renderCaption();
  });
}

function renderCaption() {
  const g = preview?.g || selectedGarment();
  if (!g) {
    caption.innerHTML = '';
    return;
  }
  const kind = GARMENT_TYPES[g.type].kind;
  const chips = scene.checks
    .map((c) => {
      const w = c.ease == null ? c.text : c.text || fitWord(c.ease, kind);
      const cls = c.ease == null ? 'n' : c.ease < -1 ? 'bad' : c.ease < 4 ? 'warn' : c.ease < (kind === 'bottom' ? 10 : 24) ? 'ok' : 'loose';
      return `<span class="cap-chip ${cls}"><b>${c.label}</b> ${w}</span>`;
    })
    .join('');
  caption.innerHTML = `
    <div class="cap-title">${preview ? `<span class="badge">Preview</span> ${preview.label}` : g.name}</div>
    <div class="cap-chips">${chips}</div>
    ${preview ? '<button class="btn small" id="cap-back">Back to original</button>' : ''}`;
  caption.querySelector('#cap-back')?.addEventListener('click', () => setPreview(null));
}

previewEvents.addEventListener('preview', (e) => {
  preview = e.detail.g ? e.detail : null;
  syncScene();
});

subscribe((reason) => {
  if (reason === 'goto:upcycle') return switchTab('upcycle');
  if (reason === 'tab' || reason === 'tools') return;
  if (reason === 'select' || reason === 'garment') preview = null;
  if (reason === 'reset') switchTab(state.tab);
  syncScene();
});

// --- stage toggles
const tgBody = document.getElementById('tg-body');
const tgFit = document.getElementById('tg-fit');
const tgClothing = document.getElementById('tg-clothing');
const tgSpin = document.getElementById('tg-spin');
const legend = document.getElementById('fit-legend');
const applyOpts = () => {
  scene.setOptions({ showBody: tgBody.checked, showClothing: tgClothing.checked, fitMap: tgFit.checked, spin: tgSpin.checked });
  legend.hidden = !tgFit.checked;
};
[tgBody, tgClothing, tgFit, tgSpin].forEach((t) => t.addEventListener('change', applyOpts));
document.getElementById('btn-reset-cam').addEventListener('click', () => scene.resetCamera());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('overlay').hidden = true;
});

// --- boot
scene.setBody(state.body, state.character);
scene.setGarment(selectedGarment());
scene.resetCamera();
applyOpts();
renderCaption();
switchTab(state.tab && PANELS[state.tab] ? state.tab : 'body');
initAccount(document.getElementById('account'));

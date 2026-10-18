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
const stage = document.querySelector('.stage');
const sparkleLayer = document.createElement('div');
sparkleLayer.className = 'sparkle-burst';
sparkleLayer.setAttribute('aria-hidden', 'true');
stage.appendChild(sparkleLayer);
const scene = createScene(document.getElementById('viewport'));

let preview = null; // { g, label }
let sparkleTimer;

function burstSparkles() {
  clearTimeout(sparkleTimer);
  sparkleLayer.replaceChildren();
  sparkleLayer.insertAdjacentHTML('beforeend', '<em class="shockwave-ring ring-one"></em><em class="shockwave-ring ring-two"></em>');
  for (let i = 0; i < 30; i += 1) {
    const sparkle = document.createElement('i');
    sparkle.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 0 C12 9 15 12 24 12 C15 12 12 15 12 24 C12 15 9 12 0 12 C9 12 12 9 12 0 Z" fill="#adf8ff"/></svg>';
    sparkle.className = i < 16 ? 'large-reveal-star' : 'small-reveal-star';
    const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.25;
    const distance = 100 + Math.random() * 220;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const curve = -55 + Math.random() * 110;
    sparkle.style.setProperty('--x', `${x}px`);
    sparkle.style.setProperty('--y', `${y}px`);
    sparkle.style.setProperty('--mx', `${x * 0.52 + curve}px`);
    sparkle.style.setProperty('--my', `${y * 0.52}px`);
    sparkle.style.setProperty('--delay', `${Math.random() * 90}ms`);
    sparkle.style.setProperty('--size', `${i < 16 ? 22 + Math.random() * 18 : 9 + Math.random() * 8}px`);
    sparkleLayer.appendChild(sparkle);
  }
  for (let i = 0; i < 15; i += 1) {
    const orb = document.createElement('b');
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 200;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const curve = -45 + Math.random() * 90;
    orb.style.setProperty('--x', `${x}px`);
    orb.style.setProperty('--y', `${y}px`);
    orb.style.setProperty('--mx', `${x * 0.52 + curve}px`);
    orb.style.setProperty('--my', `${y * 0.52}px`);
    orb.style.setProperty('--delay', `${Math.random() * 80}ms`);
    sparkleLayer.appendChild(orb);
  }
  sparkleLayer.classList.remove('active');
  stage.classList.remove('wish-reveal');
  void sparkleLayer.offsetWidth;
  sparkleLayer.classList.add('active');
  stage.classList.add('wish-reveal');
  scene.flashReveal();
  sparkleTimer = setTimeout(() => {
    sparkleLayer.classList.remove('active');
    stage.classList.remove('wish-reveal');
    sparkleLayer.replaceChildren();
  }, 1100);
}

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
    scene.setBody(state.body);
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
  burstSparkles();
  syncScene();
});

subscribe((reason) => {
  if (reason === 'goto:upcycle') return switchTab('upcycle');
  if (reason === 'tab' || reason === 'tools') return;
  if (reason === 'select' || reason === 'garment') preview = null;
  if (reason === 'select' || reason === 'garment') burstSparkles();
  if (reason === 'reset') switchTab(state.tab);
  syncScene();
});

// --- stage toggles
const tgBody = document.getElementById('tg-body');
const tgFit = document.getElementById('tg-fit');
const tgSpin = document.getElementById('tg-spin');
const legend = document.getElementById('fit-legend');
const applyOpts = () => {
  scene.setOptions({ showBody: tgBody.checked, fitMap: tgFit.checked, spin: tgSpin.checked });
  legend.hidden = !tgFit.checked;
};
[tgBody, tgFit, tgSpin].forEach((t) => t.addEventListener('change', applyOpts));
document.getElementById('btn-reset-cam').addEventListener('click', () => scene.resetCamera());
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('overlay').hidden = true;
});

// --- boot
scene.setBody(state.body);
scene.setGarment(selectedGarment());
scene.resetCamera();
applyOpts();
renderCaption();
switchTab(state.tab && PANELS[state.tab] ? state.tab : 'body');
initAccount(document.getElementById('account'));

import { state, emit, subscribe, selectedGarment, wornGarments, addGarments } from './state.js';
import { dressOutfit } from './garments.js';
import { takeIncoming, takeIncomingBody } from './tryon/outfitStore.js';
import { bodyFromEstimate } from './scan/bodyEstimate.js';
import { createScene } from './scene.js';
import { currentSpace, installShell, siteHeader } from './shell/shell.js';
import { fitWord } from './model.js';
import { renderBodyPanel } from './ui/bodyPanel.js';
import { renderClosetPanel } from './ui/closetPanel.js';
import { renderUpcyclePanel, previewEvents, setPreview } from './ui/upcyclePanel.js';
import { GARMENT_TYPES } from './state.js';
import { escapeHtml } from './ui/escape.js';
import { wireEmoteButton } from './ui/emoteButton.js';

document.body.classList.add('fitting-page');
document.getElementById('site-header').outerHTML = siteHeader('fitting');
installShell();

const panel = document.getElementById('panel');
const caption = document.getElementById('stage-caption');
const stage = document.querySelector('.stage');
const sparkleLayer = document.createElement('div');
sparkleLayer.className = 'sparkle-burst';
sparkleLayer.setAttribute('aria-hidden', 'true');
stage.appendChild(sparkleLayer);
// The stage backdrop is the site-wide space style chosen in the header.
let stageTheme = currentSpace();
let scene;
try {
  scene = createScene(document.getElementById('viewport'), { stageTheme });
} catch (error) {
  console.error('Could not start garment preview', error);
  document.getElementById('viewport').innerHTML = '<p class="preview-unavailable" role="status">The 3D preview could not start on this device. Your closet and project guides are still available.</p>';
  scene = { setBody() {}, setGarment() {}, setGarments() {}, setOptions() {}, resetCamera() {}, flashReveal() {}, setStage() {}, emote() { return null; }, get checks() { return []; } };
  document.querySelectorAll('.stage-toolbar input, .stage-toolbar button').forEach((control) => (control.disabled = true));
}

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

function switchTab(tab, { fromRoute = false } = {}) {
  if (!PANELS[tab]) tab = 'body';
  if (tab !== state.tab) {
    preview = null;
    document.getElementById('overlay').hidden = true;
  }
  state.tab = tab;
  const path = '#/' + tab;
  // Leave non-route hashes (Supabase auth redirects carry #access_token=…) for the auth client to read.
  const routeHash = !location.hash || location.hash.startsWith('#/');
  if (location.hash !== path && (routeHash || !fromRoute)) history[fromRoute ? 'replaceState' : 'pushState'](null, '', path);
  document.body.dataset.route = location.hash;
  document.querySelectorAll('#tabs button').forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  panel.scrollTop = 0;
  PANELS[tab](panel);
  syncScene();
  emit('tab');
}

// Back/forward and #/tab links move between studio steps.
function route() {
  if (location.hash === document.body.dataset.route) return;
  const page = location.hash.slice(2).split('/')[0];
  if (PANELS[page]) switchTab(page, { fromRoute: true });
}
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

// --- 3D sync (coalesced to one rebuild per frame)
// The body wears the whole outfit; an upcycle preview stands in for its garment.
function outfit() {
  const worn = wornGarments();
  if (!preview?.g) return worn;
  const original = selectedGarment();
  return dressOutfit(worn.filter((g) => g.id !== original?.id), preview.g);
}
function focusGarment() {
  if (preview?.g) return preview.g;
  const worn = wornGarments(), selected = selectedGarment();
  return worn.find((g) => g.id === selected?.id) || worn.at(-1) || null;
}

let pending = false;
function syncScene() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    scene.setBody(state.body, state.character);
    scene.setGarments(outfit(), { focus: focusGarment()?.id });
    renderCaption();
  });
}

function renderCaption() {
  const g = focusGarment();
  if (!g) {
    caption.innerHTML = state.garments.length ? '<div class="cap-title">Nothing on yet. Pick a piece in your closet to wear it.</div>' : '';
    return;
  }
  const others = outfit().filter((o) => o.id !== g.id);
  const kind = GARMENT_TYPES[g.type].kind;
  const chips = scene.checks
    .map((c) => {
      const w = c.ease == null ? c.text : c.text || fitWord(c.ease, kind);
      const cls = c.ease == null ? 'n' : c.ease < -1 ? 'bad' : c.ease < 4 ? 'warn' : c.ease < (kind === 'bottom' ? 10 : 24) ? 'ok' : 'loose';
      return `<span class="cap-chip ${cls}"><b>${c.label}</b> ${w}</span>`;
    })
    .join('');
  caption.innerHTML = `
    <div class="cap-title">${preview ? `<span class="badge">Preview</span> ${escapeHtml(preview.label)}` : escapeHtml(g.name)}</div>
    ${others.length ? `<div class="cap-outfit">Wearing with ${others.map((o) => escapeHtml(o.name)).join(' · ')}</div>` : ''}
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
  // Units only change how panels display lengths.
  if (reason === 'units') {
    const scroll = panel.scrollTop;
    PANELS[state.tab](panel);
    panel.scrollTop = scroll;
    return;
  }
  if (reason === 'select' || reason === 'garment' || reason === 'outfit') preview = null;
  if (reason === 'select' || reason === 'outfit') burstSparkles();
  if (reason === 'reset') {
    // Pieces brought in from other pages also join an account's closet once it loads.
    const missing = imported.filter((g) => !state.garments.some((o) => o.id === g.id));
    if (missing.length) addGarments(missing);
    if (importedBody) wearBody(importedBody);
    switchTab(state.tab);
  }
  syncScene();
});

// --- stage toggles
const tgBody = document.getElementById('tg-body');
const tgClothing = document.getElementById('tg-clothing');
const tgFit = document.getElementById('tg-fit');
const tgSpin = document.getElementById('tg-spin');
const tgAnimate = document.getElementById('tg-animate');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
if (motionPreference.matches) tgAnimate.checked = tgSpin.checked = false;
const legend = document.getElementById('fit-legend');
const applyOpts = () => {
  scene.setOptions({ showBody: tgBody.checked, showClothing: tgClothing.checked, fitMap: tgFit.checked, spin: tgSpin.checked, animate: tgAnimate.checked });
  legend.hidden = !tgFit.checked;
};
[tgBody, tgClothing, tgFit, tgSpin, tgAnimate].forEach((t) => t.addEventListener('change', applyOpts));
motionPreference.addEventListener('change', (event) => {
  if (!event.matches) return;
  tgAnimate.checked = tgSpin.checked = false;
  applyOpts();
});
document.getElementById('btn-reset-cam').addEventListener('click', () => scene.resetCamera());
wireEmoteButton(document.getElementById('btn-emote'), scene);
document.body.dataset.stage = stageTheme;
window.addEventListener('spacechange', (event) => {
  stageTheme = event.detail.space;
  document.body.dataset.stage = stageTheme;
  scene.setStage(stageTheme);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('overlay').hidden = true;
});

// --- boot
// Garments scanned or tried on elsewhere (AI Studio, Explore) arrive dressed.
// A body matched to a scanned photo reshapes the saved body (measurements and
// character change in place: panels and the scene hold these objects).
function wearBody(estimate) {
  const { body, character } = bodyFromEstimate(estimate, state.body, state.character);
  Object.assign(state.body, body);
  Object.assign(state.character, character);
}
const imported = takeIncoming();
const importedBody = takeIncomingBody();
if (importedBody) {
  wearBody(importedBody);
  emit('body');
}
if (imported.length) {
  addGarments(imported);
  if (!location.hash.slice(2)) history.replaceState(null, '', '#/closet');
  emit('outfit');
}
scene.setBody(state.body, state.character);
scene.setGarments(outfit(), { focus: focusGarment()?.id });
scene.resetCamera();
applyOpts();
renderCaption();
const initialTab = location.hash.slice(2).split('/')[0];
switchTab(PANELS[initialTab] ? initialTab : PANELS[state.tab] ? state.tab : 'body', { fromRoute: true });

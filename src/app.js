import { renderCommunityPanel, initCommunityNavigation } from './ui/communityPanel.js';
import { state, emit, subscribe, selectedGarment } from './state.js';
import { createScene } from './scene.js';
import { fitWord } from './model.js';
import { renderBodyPanel } from './ui/bodyPanel.js';
import { renderClosetPanel } from './ui/closetPanel.js';
import { renderUpcyclePanel, previewEvents, setPreview } from './ui/upcyclePanel.js';
import { GARMENT_TYPES } from './state.js';
import { initAccount } from './ui/account.js';
import { disposeCharacterScenes } from './avatar/lifecycle.js';
import { installInteractionEffects } from './avatar/interactionEffects.js';
import './visual-system.css';
import { WORLDS, tierFor } from './progression.js';
import { escapeHtml } from './ui/rankCrest.js';

function syncRealm() {
 const index={cultivation:0,garden:1,fantasy:2,runway:3,cyber:4}[state.progression.theme]||0;
 document.body.dataset.realm=state.progression.theme;
 document.body.style.setProperty('--realm-x',`${index%3*50}%`);document.body.style.setProperty('--realm-y',`${Math.floor(index/3)*100}%`);
}
syncRealm();installInteractionEffects(()=>state.progression);

const panel = document.getElementById('panel');
const caption = document.getElementById('stage-caption');
let scene;
try {
  scene = createScene(document.getElementById('viewport'));
} catch (error) {
  console.error('Could not start garment preview', error);
  document.getElementById('viewport').innerHTML = '<p class="preview-unavailable" role="status">The 3D preview could not start on this device. Your closet, project guides, and maker journey are still available.</p>';
  scene = { setBody(){}, setGarment(){}, setOptions(){}, resetCamera(){}, get checks(){return [];} };
  document.querySelectorAll('.stage-toolbar input, .stage-toolbar button').forEach(control => control.disabled = true);
}

let preview = null; // { g, label }

function renderLazyCharacterPanel(el) {
  el.innerHTML='<p role="status">Opening your character pavilion…</p>';
  import('./avatar/pavilion.js').then(({renderCharacterPanel})=>{if(state.tab==='character')renderCharacterPanel(el);});
}
const PANELS = { body: renderBodyPanel, closet: renderClosetPanel, upcycle: renderUpcyclePanel, community: renderCommunityPanel, character:renderLazyCharacterPanel };

function switchTab(tab, { fromRoute = false } = {}) {
  if (!PANELS[tab]) tab = 'body';
  disposeCharacterScenes(panel);
  if (tab !== state.tab) { preview = null; document.getElementById('overlay').hidden = true; }
  state.tab = tab;
  document.body.dataset.page = tab;
  const path = '#/' + tab;
  if (location.hash !== path && !(fromRoute && tab === 'community' && location.hash.startsWith('#/community/'))) history.pushState(null, '', path);
  document.body.dataset.route = location.hash;
  document.querySelectorAll('#tabs button').forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  scene.setOptions({ active: !['community','character'].includes(tab) });
  panel.scrollTop = 0;
  PANELS[tab](panel);
  syncScene();
  renderJourney();
  emit('tab');
}

function renderJourney() {
  const copy = {
    body: ['Make it fit. Make it yours.', 'Start with your measurements. Your clothes and project plans use the same fit.'],
    closet: ['Your next creation is already in your closet.', 'Add a piece, explore its fabric, and sketch a second life for it.'],
    upcycle: ['From unworn to one of a kind.', 'Choose a real project. Follow your custom guide. Earn progress when you finish.'],
    community: ['Small stitches. A shared story.', 'Your completed upcycles grow your rank and contribute to your school.'],
    character: ['Wear the story you are making.', 'Finish upcycling projects to earn XP, unlock outfits, and bring your character to life.'],
  }[state.tab];
  document.getElementById('journey-title').textContent = copy[0];
  document.getElementById('journey-description').textContent = copy[1];
  const p = state.progression;
  document.getElementById('journey-progress').innerHTML = `<span class="journey-spark" aria-hidden="true">✦</span><span><strong>${escapeHtml(WORLDS[p.theme].ranks[tierFor(p.xp)])}</strong><small>${p.xp.toLocaleString()} XP · ${p.completed.length} projects completed</small></span><span aria-hidden="true">↗</span>`;
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
    <div class="cap-title">${preview ? `<span class="badge">Preview</span> ${escapeHtml(preview.label)}` : escapeHtml(g.name)}</div>
    <div class="cap-chips">${chips}</div>
    ${preview ? '<button class="btn small" id="cap-back">Back to original</button>' : ''}`;
  caption.querySelector('#cap-back')?.addEventListener('click', () => setPreview(null));
}

previewEvents.addEventListener('preview', (e) => {
  preview = e.detail.g ? e.detail : null;
  syncScene();
});

subscribe((reason) => {
  syncRealm();
  renderJourney();
  if (reason === 'goto:upcycle') return switchTab('upcycle');
  if (['tab','tools','avatar','avatar-preference','progression','reward'].includes(reason)) return;
  if (reason === 'select' || reason === 'garment') preview = null;
  if (reason === 'reset') switchTab(state.tab);
  syncScene();
});

// --- stage toggles
const tgBody = document.getElementById('tg-body');
const tgFit = document.getElementById('tg-fit');
const tgClothing = document.getElementById('tg-clothing');
const tgSpin = document.getElementById('tg-spin');
const tgAnimate = document.getElementById('tg-animate');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
tgAnimate.checked = !motionPreference.matches;
const legend = document.getElementById('fit-legend');
const applyOpts = () => {
  scene.setOptions({ showBody: tgBody.checked, showClothing: tgClothing.checked, fitMap: tgFit.checked, spin: tgSpin.checked, animate: tgAnimate.checked });
  legend.hidden = !tgFit.checked;
};
[tgBody, tgClothing, tgFit, tgSpin, tgAnimate].forEach((t) => t.addEventListener('change', applyOpts));
motionPreference.addEventListener('change', event => { if(event.matches){tgAnimate.checked=false;tgSpin.checked=false;applyOpts();} });
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
const initialTab = location.hash.slice(2).split('/')[0];
switchTab(PANELS[initialTab] ? initialTab : state.tab && PANELS[state.tab] ? state.tab : 'body', { fromRoute: true });
initAccount(document.getElementById('account'));

initCommunityNavigation(switchTab);

document.querySelectorAll('#tabs button').forEach(button => { button.disabled = false; });

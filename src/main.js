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

function syncRealm() {
 const index={cultivation:0,garden:1,fantasy:2,runway:3,cyber:4}[state.progression.theme]||0;
 document.body.dataset.realm=state.progression.theme;
 document.body.style.setProperty('--realm-x',`${index%3*50}%`);document.body.style.setProperty('--realm-y',`${Math.floor(index/3)*100}%`);
}
syncRealm();installInteractionEffects(()=>state.progression);

const panel = document.getElementById('panel');
const caption = document.getElementById('stage-caption');
const scene = createScene(document.getElementById('viewport'));

let preview = null; // { g, label }

function renderLazyCharacterPanel(el) {
  el.innerHTML='<p role="status">Opening your character pavilion…</p>';
  import('./avatar/pavilion.js').then(({renderCharacterPanel})=>{if(state.tab==='character')renderCharacterPanel(el);});
}
const PANELS = { body: renderBodyPanel, closet: renderClosetPanel, upcycle: renderUpcyclePanel, community: renderCommunityPanel, character:renderLazyCharacterPanel };

function switchTab(tab) {
  disposeCharacterScenes(panel);
  state.tab = tab;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab || tab==='character'&&b.dataset.tab==='community'));
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
  syncScene();
});

subscribe((reason) => {
  syncRealm();
  if (reason === 'goto:upcycle') return switchTab('upcycle');
  if (['tab','tools','avatar','avatar-preference','progression','reward'].includes(reason)) return;
  if (reason === 'select' || reason === 'garment') preview = null;
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

initCommunityNavigation(switchTab);

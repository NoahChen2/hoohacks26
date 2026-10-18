// The saved 3D body, shown as a small card on every page so the same figure
// follows the person from inspiration to fitting. The viewer loads lazily, when
// the card scrolls into view, and keeps the site-wide space style. Ideas can be
// tried on in place (tryOnBody) without leaving the page.
import { currentSpace } from './shell.js';

export function bodyCard({ title = 'Your fit model', note = 'Sized from your saved measurements', cta = 'Open Fitting Room', href = '/fitting#/body', className = '' } = {}) {
  return `<section class="body-card ${className}" data-body-card aria-label="${title}">
    <header class="body-card-head"><strong>${title}</strong><small data-body-note>${note}</small></header>
    <div class="body-card-view"><div class="body-card-canvas"></div><div class="body-card-poster">Loading your 3D body…</div></div>
    <footer class="body-card-foot"><span data-body-summary>&nbsp;</span><button type="button" class="body-card-wear" data-body-wear hidden>Wear it in the Fitting Room</button><a href="${href}">${cta}</a></footer>
  </section>`;
}

// Live viewers. When a page re-renders its markup, the existing viewer moves
// into the new card instead of starting a second WebGL context.
const live = [];
const starting = new Map(); // card -> Promise<entry>

export function mountBodyCards(root = document) {
  let cards = [...root.querySelectorAll('[data-body-card]')].filter((card) => !starting.has(card));
  cards = cards.filter((card) => {
    const orphan = live.find((entry) => !entry.card.isConnected);
    if (!orphan) return true;
    card.querySelector('.body-card-view').replaceWith(orphan.view);
    orphan.card = card;
    orphan.showSummary();
    starting.set(card, Promise.resolve(orphan));
    return false;
  });
  for (let i = live.length - 1; i >= 0; i--) if (!live[i].card.isConnected) live.splice(i, 1)[0].dispose();
  if (!cards.length) return;
  if (!('IntersectionObserver' in window)) return cards.forEach(startCard);
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      startCard(entry.target);
    }
  }, { rootMargin: '200px' });
  cards.forEach((card) => observer.observe(card));
}

function startCard(card) {
  if (!starting.has(card)) {
    const ready = mount(card);
    ready.catch((error) => {
      console.error('Could not start the 3D body card', error);
      const poster = card.querySelector('.body-card-poster');
      if (poster) poster.textContent = 'The 3D preview could not start on this device.';
    });
    starting.set(card, ready);
  }
  return starting.get(card);
}

async function mount(card) {
  const [{ createScene }, { state, wornGarments }, { garmentFromSpec, dressOutfit }, { BUILD_LABELS }, { formatLength, feetInches, unit }, { cardQuality }] = await Promise.all([
    import('../scene.js'),
    import('../state.js'),
    import('../garments.js'),
    import('../character/settings.ts'),
    import('../ui/units.js'),
    import('../quality.js'),
  ]);
  const canvasHost = card.querySelector('.body-card-canvas');
  const scene = createScene(canvasHost, { stageTheme: currentSpace(), prewarmShapes: false, framing: 'card', quality: cardQuality() });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.setBody(state.body, state.character);
  // The card wears the same outfit as the fitting room.
  scene.setGarments(wornGarments());
  scene.setOptions({ showBody: true, showClothing: true, fitMap: false, spin: false, animate: !reduced });
  scene.resetCamera();
  card.querySelector('.body-card-poster')?.remove();
  const shape = { feminine: 'Female', neutral: 'Neutral', masculine: 'Male' }[state.character.bodyPreset] || '';
  const height = unit() === 'in' ? feetInches(state.body.height) : formatLength(state.body.height);
  const summary = `${shape} · ${BUILD_LABELS[state.character.build] || 'Custom'} · ${height}`;
  const onSpace = (event) => scene.setStage(event.detail.space);
  window.addEventListener('spacechange', onSpace);
  const entry = {
    card,
    view: card.querySelector('.body-card-view'),
    trying: null,
    tried: [],
    showSummary() {
      const text = entry.trying ? `Trying on: ${entry.trying}` : summary;
      const el = entry.card.querySelector('[data-body-summary]');
      if (el) el.textContent = text;
      const wear = entry.card.querySelector('[data-body-wear]');
      if (wear) wear.hidden = !entry.tried.length;
    },
    // Specs (tryOn.js, photo scans) or finished garments, layered into the
    // current outfit: each replaces whatever is worn in its slot.
    preview(items) {
      const garments = [items].flat().filter(Boolean).map((item) => (item.id && item.type ? item : garmentFromSpec(item, state.body)));
      if (!garments.length) return;
      scene.setGarments(garments.reduce(dressOutfit, wornGarments()), { focus: garments.at(-1).id });
      scene.flashReveal();
      entry.tried = garments;
      entry.trying = garments.map((g) => g.name).join(' + ');
      entry.showSummary();
    },
    reset() {
      scene.setGarments(wornGarments());
      entry.trying = null;
      entry.tried = [];
      entry.showSummary();
    },
    dispose() {
      window.removeEventListener('spacechange', onSpace);
      scene.dispose();
    },
  };
  entry.showSummary();
  live.push(entry);
  window.addEventListener('pagehide', () => entry.dispose(), { once: true });
  return entry;
}

const inView = (el) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 80 && r.top < innerHeight - 80 && r.width > 0;
};

let dock = null;
function openDock() {
  if (!dock) {
    dock = document.createElement('div');
    dock.className = 'body-dock';
    dock.innerHTML = `<button type="button" class="body-dock-close" aria-label="Close try-on preview">×</button>${bodyCard({ title: 'Try-on', note: 'On your saved body' })}`;
    document.body.append(dock);
    dock.querySelector('.body-dock-close').addEventListener('click', () => {
      dock.hidden = true;
    });
  }
  dock.hidden = false;
  return dock.querySelector('[data-body-card]');
}

// Tried-on pieces go to the fitting room closet, dressed, on request.
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-body-wear]');
  if (!button) return;
  const entry = live.find((item) => item.card === button.closest('[data-body-card]'));
  if (!entry?.tried.length) return;
  const { queueGarments } = await import('../tryon/outfitStore.js');
  if (queueGarments(entry.tried)) location.assign('/fitting#/closet');
  else button.textContent = 'Browser storage is unavailable';
});

// Show a garment spec (see tryOn.js), a garment, or a list of them as one
// outfit on a visible body card, or on a docked viewer when no card is on
// screen. Pass `card` to target a specific card.
export async function tryOnBody(spec, { card } = {}) {
  if (!spec || (Array.isArray(spec) && !spec.length)) return;
  const target = card || [...document.querySelectorAll('[data-body-card]')].find((el) => !el.closest('.body-dock') && inView(el)) || openDock();
  const entry = await startCard(target);
  entry.preview(spec);
}

// One header, one name and one world theme for every page.
// The world chosen in Settings (preferences.world) sets the page theme and,
// through WORLD_STAGE, the 3D stage backdrop.
import './theme.css';
import './worlds.css';
import { WORLDS, PREFERENCES_KEY, loadPreferences, savePreferences } from '../explore/preferences.js';

export const BRAND = 'ReThread';
// Which 3D stage (src/stage.js) and base token set each world builds on.
export const WORLD_STAGE = { cultivation: 'daylight', fairy: 'night', fantasy: 'night', runway: 'daylight', cyberpunk: 'night', space: 'celestial', furry: 'daylight' };
const SHORT = { cultivation: 'Cultivation', fairy: 'Fairy', fantasy: 'Fantasy', runway: 'Runway', cyberpunk: 'Cyber', space: 'Space', furry: 'Furry' };

const NAV = [
  ['explore', 'Explore', '/explore'],
  ['studio', 'AI Studio', '/studio'],
  ['fitting', 'Fitting Room', '/fitting'],
  ['learn', 'Academy', '/learn'],
];

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// A world shown on the Settings page before it is saved.
let previewing = null;

export function currentWorld() {
  if (previewing) return previewing;
  const store = storage();
  return store ? loadPreferences(store).world : 'cultivation';
}

export const currentSpace = () => WORLD_STAGE[currentWorld()];

export function applyWorld(world = currentWorld()) {
  const root = document.documentElement;
  const before = root.dataset.space;
  root.dataset.world = world;
  root.dataset.space = WORLD_STAGE[world];
  document.querySelectorAll('[data-world-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.worldChoice === world)));
  window.dispatchEvent(new CustomEvent('worldchange', { detail: { world } }));
  if (before && before !== root.dataset.space) window.dispatchEvent(new CustomEvent('spacechange', { detail: { space: root.dataset.space } }));
}

// Try a world on without saving it (null returns to the saved one).
export function previewWorld(world) {
  previewing = WORLD_STAGE[world] ? world : null;
  applyWorld();
}

export function setWorld(world) {
  if (!WORLD_STAGE[world]) return;
  const store = storage();
  if (store) savePreferences(store, { ...loadPreferences(store), world });
  previewing = null;
  applyWorld(world);
}

// Keep tabs in step when the world changes in another tab.
window.addEventListener('storage', (event) => {
  if (event.key === PREFERENCES_KEY && !previewing) applyWorld();
});

const mark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 20 4" stroke="currentColor" stroke-width="2" fill="none"/><rect x="16" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 13c3-1 5 1 8-1s5 1 8-1" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2" fill="none"/></svg>';

export function siteHeader(active, { savedCount = null, account = false } = {}) {
  const world = currentWorld();
  const links = NAV.map(
    ([id, label, href], index) => `<a class="site-nav-link planet" data-planet="${index + 1}" href="${href}" ${id === active ? 'aria-current="page"' : ''}><span>${label}</span></a>`
  ).join('');
  const worlds = WORLDS.map(
    ({ id, name, colors }) =>
      `<button type="button" class="space-choice" data-world-choice="${id}" aria-pressed="${id === world}" title="${name}" aria-label="${name}"><i aria-hidden="true" style="--swatch-a:${colors[0]};--swatch-b:${colors[1]}"></i><span>${SHORT[id]}</span></button>`
  ).join('');
  return `<header class="site-header">
    <a class="site-brand" href="/explore" aria-label="${BRAND} home">${mark}<span>${BRAND}</span></a>
    <nav class="site-nav" aria-label="Main navigation">${links}</nav>
    <div class="site-tools">
      <div class="space-pick" role="group" aria-label="World theme">${worlds}</div>
      <a class="site-link" href="/profile" ${active === 'profile' ? 'aria-current="page"' : ''}>Saved${savedCount == null ? '' : ` <b data-saved-count>${savedCount}</b>`}</a>
      <a class="site-link" href="/settings" ${active === 'settings' ? 'aria-current="page"' : ''}>Settings</a>
      ${account ? '<div class="account" id="account"></div>' : ''}
    </div>
  </header>`;
}

export function installShell(root = document) {
  root.querySelectorAll('[data-world-choice]').forEach((button) => button.addEventListener('click', () => setWorld(button.dataset.worldChoice)));
  applyWorld();
}

// Page title in one format everywhere.
export const pageTitle = (title) => (title ? `${title} — ${BRAND}` : BRAND);

applyWorld();

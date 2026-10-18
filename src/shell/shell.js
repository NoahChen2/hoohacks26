// One header, one name and one space style for every page.
// The space style is the same choice as the 3D stage backdrop (restitch.stage).
import './theme.css';

export const BRAND = 'ReThread';
export const SPACES = { celestial: 'Celestial', night: 'Night studio', daylight: 'Daylight studio' };
const SPACE_KEY = 'restitch.stage';

const NAV = [
  ['explore', 'Explore', '/explore'],
  ['studio', 'AI Studio', '/studio'],
  ['fitting', 'Fitting Room', '/fitting'],
  ['learn', 'Academy', '/learn'],
];

export function currentSpace() {
  try {
    const saved = localStorage.getItem(SPACE_KEY);
    if (SPACES[saved]) return saved;
  } catch { /* storage unavailable */ }
  return 'celestial';
}

export function applySpace(space = currentSpace()) {
  document.documentElement.dataset.space = space;
  document.querySelectorAll('[data-space-choice]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.spaceChoice === space)));
}

export function setSpace(space) {
  if (!SPACES[space]) return;
  try {
    localStorage.setItem(SPACE_KEY, space);
  } catch { /* storage unavailable */ }
  applySpace(space);
  window.dispatchEvent(new CustomEvent('spacechange', { detail: { space } }));
}

// Keep tabs in step when the style changes in another tab.
window.addEventListener('storage', (event) => {
  if (event.key === SPACE_KEY && SPACES[event.newValue]) {
    applySpace(event.newValue);
    window.dispatchEvent(new CustomEvent('spacechange', { detail: { space: event.newValue } }));
  }
});

const mark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 20 4" stroke="currentColor" stroke-width="2" fill="none"/><rect x="16" y="3" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 13c3-1 5 1 8-1s5 1 8-1" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2" fill="none"/></svg>';

export function siteHeader(active, { savedCount = null, account = false } = {}) {
  const space = currentSpace();
  const links = NAV.map(
    ([id, label, href], index) => `<a class="site-nav-link planet" data-planet="${index + 1}" href="${href}" ${id === active ? 'aria-current="page"' : ''}><span>${label}</span></a>`
  ).join('');
  const spaces = Object.entries(SPACES)
    .map(([id, label]) => `<button type="button" class="space-choice" data-space-choice="${id}" aria-pressed="${id === space}" title="${label}"><i aria-hidden="true"></i><span>${label.split(' ')[0]}</span></button>`)
    .join('');
  return `<header class="site-header">
    <a class="site-brand" href="/explore" aria-label="${BRAND} home">${mark}<span>${BRAND}</span></a>
    <nav class="site-nav" aria-label="Main navigation">${links}</nav>
    <div class="site-tools">
      <div class="space-pick" role="group" aria-label="Space style">${spaces}</div>
      <a class="site-link" href="/profile" ${active === 'profile' ? 'aria-current="page"' : ''}>Saved${savedCount == null ? '' : ` <b data-saved-count>${savedCount}</b>`}</a>
      <a class="site-link" href="/settings" ${active === 'settings' ? 'aria-current="page"' : ''}>Settings</a>
      ${account ? '<div class="account" id="account"></div>' : ''}
    </div>
  </header>`;
}

export function installShell(root = document) {
  root.querySelectorAll('[data-space-choice]').forEach((button) => button.addEventListener('click', () => setSpace(button.dataset.spaceChoice)));
  applySpace();
}

// Page title in one format everywhere.
export const pageTitle = (title) => (title ? `${title} — ${BRAND}` : BRAND);

applySpace();

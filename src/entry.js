// Keep discovery routes independent of the existing 3D studio boot sequence.
const discovery = /^\/(explore|profile)\/?$/.test(location.pathname) || /^\/project(?:\/|$)/.test(location.pathname);

(discovery ? import('./explore/page.js') : import('./main.js')).catch((error) => {
  // A failed module load (for example a dependency missing from node_modules)
  // would otherwise leave a blank page.
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.style.cssText = 'margin:48px auto;max-width:560px;padding:16px 20px;font:15px/1.6 system-ui,sans-serif;border:1px solid #d9c6b8;border-radius:12px;background:#fff8f2;color:#4a2b1d';
  notice.textContent = `This page could not load (${error.message}). If you just pulled changes, run "npm install" and restart the dev server.`;
  document.body.append(notice);
});

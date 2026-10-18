// Keep discovery routes independent of the existing 3D studio boot sequence.
if (/^\/(explore|profile)\/?$/.test(location.pathname) || /^\/project(?:\/|$)/.test(location.pathname)) {
  import('./explore/page.js');
} else {
  import('./main.js');
}

import {loadPreferences} from './explore/preferences.js';
// Keep discovery routes independent of the existing 3D studio boot sequence.
if (/^\/studio\/?$/.test(location.pathname)) {
  import('./studio/page.js');
} else if (/^\/(onboarding|settings)\/?$/.test(location.pathname)) {
  import('./explore/onboarding.js');
} else if (/^\/(explore|profile)\/?$/.test(location.pathname) || /^\/project(?:\/|$)/.test(location.pathname)) {
  let firstVisit=false;
  try{firstVisit=location.pathname.replace(/\/$/,'')==='/explore'&&loadPreferences(window.localStorage).status==='draft'&&!new URLSearchParams(location.search).has('guest');}catch{/* Explore remains available without browser storage. */}
  if(firstVisit)location.replace('/onboarding');else import('./explore/page.js');
} else {
  import('./main.js');
}

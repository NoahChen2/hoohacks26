import {loadPreferences} from './explore/preferences.js';
async function bootPage(){
if(location.pathname==='/'){
  location.replace(`/explore${location.search}${location.hash}`);
  return;
}
if (/^\/studio\/?$/.test(location.pathname)) {
  return import('./studio/page.js');
} else if (/^\/(onboarding|settings)\/?$/.test(location.pathname)) {
  return import('./explore/onboarding.js');
} else if (/^\/(explore|profile)\/?$/.test(location.pathname) || /^\/project(?:\/|$)/.test(location.pathname)) {
  let firstVisit=false;
  try{firstVisit=location.pathname.replace(/\/$/,'')==='/explore'&&loadPreferences(window.localStorage).status==='draft'&&!new URLSearchParams(location.search).has('guest');}catch{/* Explore remains available without browser storage. */}
  if(firstVisit)location.replace('/onboarding');else return import('./explore/page.js');
} else {
  return import('./main.js');
}
}

bootPage().catch((error) => {
  // A failed module load (for example a dependency missing from node_modules)
  // would otherwise leave a blank page.
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  notice.style.cssText = 'margin:48px auto;max-width:560px;padding:16px 20px;font:15px/1.6 system-ui,sans-serif;border:1px solid #d9c6b8;border-radius:12px;background:#fff8f2;color:#4a2b1d';
  notice.textContent = `This page could not load (${error.message}). If you just pulled changes, run "npm install" and restart the dev server.`;
  document.body.append(notice);
});

import './style.css';
import {siteHeader,installShell,previewWorld} from '../shell/shell.js';
import './onboarding.css';
import {escape} from './ui.js';
import {AESTHETICS,SKILLS,TOOLS,WORLDS,loadPreferences,savePreferences,toggleTool,validateStep} from './preferences.js';
let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}
const settings=location.pathname.startsWith('/settings');
let preferences=loadPreferences(storage),step=0;
if(!settings&&preferences.status!=='draft')location.replace('/explore');
document.title=`${settings?'Preferences':'Welcome'} — ReThread`;
document.body.classList.add('discovery-page');
document.body.innerHTML=`${siteHeader('settings')}<main class="onboarding"><p class="eyebrow">${settings?'MAKE ROOM FOR YOUR NEXT CHAPTER':'A LITTLE ABOUT YOU'}</p><h1>${settings?'Your taste. Your pace.':'Make yourself at home.'}</h1><p class="onboard-intro">A few choices to make your inspiration feel more like you. Change them anytime in Settings.</p><ol class="onboard-progress" aria-label="Setup progress"></ol><form class="onboard-form" novalidate><div id="onboard-step"></div><p class="onboard-error" role="alert"></p><div class="onboard-actions"><button type="button" data-back>← Back</button><button type="button" data-skip>${settings?'Cancel':'Skip for now'}</button><button type="submit" class="onboard-next"></button></div></form></main>`;
installShell();
const form=document.querySelector('form'),panel=document.querySelector('#onboard-step'),error=document.querySelector('.onboard-error');
const titles=['Find your fashion people','Where are you starting?','What’s in your toolkit?','Choose your world'];
const notes=['Pick every aesthetic that speaks to you.','There’s a place for every skill level.','Select all you have. Starting with nothing is welcome.','Your world themes the whole site — colours, type and buttons. Tap one to try it on. Rank names are previews only.'];
function choice(label,value,selected,multiple){return `<button type="button" class="preference-choice ${selected?'selected':''}" data-choice="${escape(value)}" ${multiple?`aria-pressed="${selected}"`:`role="radio" aria-checked="${selected}"`}>${escape(label)}<span aria-hidden="true">${selected?'✓':multiple?'+':'○'}</span></button>`;}
function render(focus=false){
  document.querySelector('.onboard-progress').innerHTML=['Aesthetic','Experience','Tools','World'].map((name,i)=>`<li ${step===i?'aria-current="step"':''} class="${i<=step?'reached':''}"><span>${i<step?'✓':i+1}</span><small>${name}</small></li>`).join('');
  const selected=step===0?preferences.aesthetics:step===2?preferences.tools:[];
  const items=step===0?AESTHETICS:step===1?SKILLS:TOOLS;
  const choices=step===3?WORLDS.map(w=>`<button type="button" role="radio" aria-checked="${preferences.world===w.id}" class="world-choice ${preferences.world===w.id?'selected':''}" data-choice="${w.id}"><span class="world-preview" style="--world-dark:${w.colors[0]};--world-light:${w.colors[1]};--world-card:url(/worlds/${w.id}-card.jpg)" aria-hidden="true"><span>${w.symbol}</span><i></i><b>RETHREAD / ${w.id.toUpperCase()}</b></span><span class="world-copy"><strong>${w.name}${w.id==='cultivation'?' <small>Default</small>':''}</strong><span>${w.description}</span><em>Sample rank · ${w.rank}</em><span class="world-sample-row" data-world-scope="${w.id}" aria-hidden="true"><span class="world-sample">Begin ${w.symbol}</span><span class="world-sample-alt">Explore</span></span></span></button>`).join(''):items.map(item=>choice(item,item,step===1?preferences.skill===item:selected.includes(item),step!==1)).join('');
  panel.innerHTML=`<section class="onboard-step"><p class="step-number">STEP ${step+1} OF 4</p><h2 tabindex="-1" id="step-title">${titles[step]}</h2><p>${notes[step]}</p><div class="${step===3?'world-grid':'preference-grid'}" ${step===1||step===3?'role="radiogroup"':'role="group"'} aria-labelledby="step-title">${choices}</div>${step===0?'<p class="preference-note">Our current demo catalog covers Streetwear, Y2K, Vintage, Minimalist, and Cottagecore. Other tastes are saved for future projects.</p>':''}</section>`;
  document.querySelector('[data-back]').disabled=step===0;
  document.querySelector('.onboard-next').textContent=step===3?(settings?'Save preferences':'Find my inspiration ↗'):'Next →';error.textContent='';
  if(focus)panel.querySelector('h2').focus({preventScroll:true});
}
panel.addEventListener('click',event=>{
  const button=event.target.closest('[data-choice]');if(!button)return;
  const value=button.dataset.choice;
  if(step===0)preferences.aesthetics=preferences.aesthetics.includes(value)?preferences.aesthetics.filter(x=>x!==value):[...preferences.aesthetics,value];
  if(step===1)preferences.skill=value;
  if(step===2)preferences.tools=toggleTool(preferences.tools,value);
  if(step===3){preferences.world=value;previewWorld(value);}
  render();panel.querySelector(`[data-choice="${value}"]`)?.focus({preventScroll:true});
});
// Standard arrow-key navigation for the two single-select radio groups.
panel.addEventListener('keydown',event=>{
  if(![1,3].includes(step)||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
  const buttons=[...panel.querySelectorAll('[role="radio"]')],index=buttons.indexOf(document.activeElement);if(index<0)return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+buttons.length)%buttons.length;buttons[next].click();
});
function finish(status){
  const next={...preferences,status};
  if(!savePreferences(storage,next)){error.innerHTML='Browser storage is unavailable. Your preferences could not be saved. <a href="/explore?guest=1">Continue to Explore for this visit →</a>';return;}
  location.assign('/explore');
}
form.addEventListener('submit',event=>{event.preventDefault();const message=validateStep(preferences,step);if(message){error.textContent=message;return;}if(step<3){step++;render(true);}else finish('completed');});
document.querySelector('[data-back]').addEventListener('click',()=>{if(step>0){step--;render(true);}});
document.querySelector('[data-skip]').addEventListener('click',()=>settings?location.assign('/explore'):finish('skipped'));
document.querySelector('.onboard-exit')?.addEventListener('click',event=>{if(!settings){event.preventDefault();finish('skipped');}});
render();

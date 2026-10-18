import {loadGeneratedProjects} from '../tutorial/store.js';
import {bodyCard,mountBodyCards,tryOnBody} from '../shell/bodyCard.js';
import {canTryOn,garmentSpecFromProject} from '../shell/tryOn.js';
import {siteHeader,installShell} from '../shell/shell.js';
import {seededTutorial,generatedTutorial} from '../tutorial/catalog.js';
import {tutorialMarkup,installTutorial,tutorialShelf} from '../tutorial/view.js';
import {loadPreferences,rankProjects,PREFERENCES_KEY} from './preferences.js';
import './onboarding.css';
import './style.css';
import {projects as seededProjects,CATEGORIES,filterProjects} from './projects.js';
import {toggleEngagement,ENGAGEMENT_KEY} from './storage.js';
import {loadLibrary,createBoard,setBoardMembership,saveLibrary} from './library.js';
import {icon,escape} from './ui.js';
import {imageActionOverlay,shareProject} from './image-actions.js';
import {createBoardDialog} from './board-dialog.js';
import {renderProfile} from './boards.js';
import './interactions.css';
import {createImageFocus} from './image-focus.js';
import {installImageLongPress} from './long-press.js';
import {createVisualSearch} from './visual-search.js';
import './community.css';
import {communityEnabled,loadPosts,loadPost,watchPosts,friendlyError} from './community.js';
import {createPostDialog} from './post-dialog.js';


let storage;
try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}};}
let engagement=loadLibrary(storage);
const projects=[...seededProjects.map(seededTutorial),...loadGeneratedProjects(storage).map(generatedTutorial)];
let disposeTutorial=()=>{};
let toastTimer;
const params=new URLSearchParams(location.search);
let query=params.get('q')||'', category=CATEGORIES.includes(params.get('category'))?params.get('category'):'For You', savedOnly=params.get('saved')==='1';
const isProfile=/^\/profile\/?$/.test(location.pathname);
const isExplore=/^\/explore\/?$/.test(location.pathname);
const projectId=/^\/project\/([^/]+)\/?$/.exec(location.pathname)?.[1];
let project=projects.find(p=>p.id===projectId);
// Posts people shared, newest first. They lead the feed and also join `projects`
// so every lookup (boards, image actions, try-on) finds them.
const posts=[],freshPosts=new Set();
const waitingForPost=!project&&communityEnabled&&/^post-/.test(projectId||'');

document.body.classList.add('discovery-page');
document.body.innerHTML=`${siteHeader(isProfile?'profile':'explore',{savedCount:engagement.saved.length})}<main id="discovery-main"></main><div class="discovery-toast" role="status" aria-live="polite"></div>`;
installShell();
const main=document.getElementById('discovery-main');
const compact=n=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(n);
function actions(p,large=false){return `<div class="project-actions ${large?'large-actions':''}"><button type="button" class="engagement-button ${engagement.liked.includes(p.id)?'is-active':''}" data-kind="liked" data-id="${p.id}" aria-label="${engagement.liked.includes(p.id)?'Unlike':'Like'} ${escape(p.title)}" aria-pressed="${engagement.liked.includes(p.id)}">${icon('heart')}<span>${compact(p.likes+Number(engagement.liked.includes(p.id)))}</span></button><button type="button" class="engagement-button ${engagement.saved.includes(p.id)?'is-active':''}" data-board-project="${p.id}" data-id="${p.id}" aria-label="Save ${escape(p.title)} to board">${icon('save')}${large?`<span>${engagement.saved.includes(p.id)?'Saved':'Save project'}</span>`:''}</button>${canTryOn(p)?`<button type="button" class="try-on-button" data-try-on="${p.id}" aria-label="Try ${escape(p.title)} on your 3D body">Try on</button>`:''}</div>`;}
function feedSearch(){const next=new URLSearchParams();if(query)next.set('q',query);if(category!=='For You')next.set('category',category);if(savedOnly)next.set('saved','1');return next.size?`?${next}`:'';}
function card(p,index){return `<article class="discovery-card${freshPosts.has(p.id)?' is-new':''}"><div class="image-action-frame"><a class="cover-link" href="/project/${p.id}${feedSearch()}" tabindex="-1" aria-hidden="true"><img src="${p.cover}" alt="" width="400" height="${p.height}" loading="${index<4?'eager':'lazy'}" decoding="async"/><span class="project-labels"><span class="difficulty ${p.difficulty.toLowerCase()}">${p.difficulty}</span></span></a>${imageActionOverlay(p,engagement)}</div><div class="card-content"><div class="card-tags">${p.tags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div><h2><a href="/project/${p.id}${feedSearch()}">${escape(p.title)}</a></h2><div class="card-bottom"><div class="creator"><img src="${p.avatar}" alt="" width="24" height="24"/><span>@${escape(p.username)}</span></div>${actions(p)}</div></div></article>`;}
function renderFeed(){
  document.title='Explore upcycling ideas — ReThread';
  main.innerHTML=`<section class="explore-intro page-with-body"><div><p class="eyebrow">A SECOND LIFE LOOKS GOOD ON YOU</p><h1>Good things.<br/><em>Made again.</em> <span>↗</span></h1><p>Fresh ideas for the clothes you already have.<br class="desktop-break"/> Find your next “I made this” moment.</p>${communityEnabled?`<button type="button" class="share-post-button" data-share-post>${icon('plus')} Share your project</button>`:''}</div>${bodyCard({note:'Every idea, sized to you'})}</section><section class="discovery-controls" aria-label="Discover projects"><form class="discovery-search" role="search"><label class="sr-only" for="project-search">Search projects, aesthetics, or creators</label>${icon('search')}<input id="project-search" type="search" placeholder="Try ‘denim’, ‘beginner’, or a creator…" value="${escape(query)}" autocomplete="off"/><kbd aria-hidden="true">⌕</kbd></form><div class="category-row"><div class="category-chips" role="group" aria-label="Project categories">${CATEGORIES.map(c=>`<button type="button" data-category="${c}" aria-pressed="${category===c}" class="${category===c?'active':''}">${c==='For You'?icon('spark'):''}${c}</button>`).join('')}</div><button type="button" class="saved-filter ${savedOnly?'active':''}" aria-pressed="${savedOnly}">${icon('save')} Saved</button></div></section><section aria-label="Upcycling project feed"><div class="feed-meta"><p id="feed-count" role="status"></p>${communityEnabled?'<span class="feed-live">New community posts appear live</span>':''}</div><div class="masonry-feed" id="project-feed"></div></section><footer class="discovery-footer">Wear your creativity. Keep things in the loop.</footer>`;
  mountBodyCards(main);
  main.querySelector('form').addEventListener('submit',event=>event.preventDefault());
  main.querySelector('#project-search').addEventListener('input',event=>{query=event.target.value;updateFeed();});
  main.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{category=button.dataset.category;main.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b.dataset.category===category);b.setAttribute('aria-pressed',String(b.dataset.category===category));});updateFeed();}));
  main.querySelector('.saved-filter').addEventListener('click',()=>{savedOnly=!savedOnly;updateFeed();});
  updateFeed();
}
function updateFeed(){
  const preferences=loadPreferences(storage);
  const filtered=[...filterProjects(query,category,savedOnly,engagement.saved,posts),...rankProjects(filterProjects(query,category,savedOnly,engagement.saved),preferences)];
  main.querySelector('#project-feed').innerHTML=filtered.length?filtered.map(card).join(''):`<div class="feed-empty">${icon(savedOnly?'save':'search')}<h2>${savedOnly?'Your next favorite is out there.':'Nothing here just yet.'}</h2><p>${savedOnly?'Save a project using its bookmark button, or try another filter.':'Try another search or explore all the categories.'}</p><button type="button" id="clear-filters">Show all projects</button></div>`;
  main.querySelector('#feed-count').textContent=`${filtered.length} ${savedOnly?'saved ':''}${filtered.length===1?'idea':'ideas'} to make your own`;
  const toggle=main.querySelector('.saved-filter');toggle.classList.toggle('active',savedOnly);toggle.setAttribute('aria-pressed',String(savedOnly));
  main.querySelector('#clear-filters')?.addEventListener('click',()=>{query='';category='For You';savedOnly=false;renderFeed();main.querySelector('#project-search').focus();});
  history.replaceState(null,'',`/explore${feedSearch()}`);
}
function renderDetail(){
  if(!project){document.title='Project not found — ReThread';main.innerHTML=`<div class="project-not-found"><p class="eyebrow">A LOOSE THREAD</p><h1>This project couldn’t be found.</h1><p>Find something new to make in the community feed.</p><a class="primary-link" href="/explore">Back to Explore ↗</a></div>`;return;}
  disposeTutorial();
  const p=project;document.title=`${p.title} — ReThread`;
  main.innerHTML=`<a class="back-link" href="/explore${escape(location.search)}">${icon('arrow')} Back to Explore</a><article class="project-detail"><div class="detail-visual"><div class="image-action-frame detail-image-frame"><img src="${p.cover}" alt="${escape(p.title)} — project cover" width="400" height="${p.height}"/>${imageActionOverlay(p,engagement)}</div><span>${p.source==='community'?`Photo by @${escape(p.username)}`:p.photo?'':p.source==='seeded'?'Original project illustration':'Illustration only, not a preview of the result'}</span>${bodyCard({title:'Try it on you',note:'Your saved body and garment',cta:'Fit it in 3D'})}</div><div class="detail-content"><div class="card-tags">${p.tags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div><h1>${escape(p.title)}</h1><div class="detail-creator creator"><img src="${p.avatar}" alt="" width="38" height="38"/><div><strong>@${escape(p.username)}</strong><small>${p.source==='community'?`Shared ${escape(new Date(p.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}`:p.source==='seeded'?'ReThread creator':p.source==='ai-demo'?'DEMO idea · photo was not analyzed':'AI-generated tutorial · review before starting'}</small></div></div><p class="detail-description">${escape(p.description)}</p><div id="detail-actions">${actions(p,true)}</div><div class="project-facts"><div><small>SKILL LEVEL</small><strong>${p.difficulty}</strong></div><div><small>ESTIMATED TIME</small><strong>${escape(p.estimatedTime)}</strong></div></div>${tutorialMarkup(p,storage)}</div></article><section class="related-projects"><div class="section-title"><h2>Keep the inspiration going</h2><a href="/explore?category=${encodeURIComponent(p.aesthetic)}">More ${p.aesthetic} ↗</a></div><div class="related-grid">${projects.filter(item=>item.aesthetic===p.aesthetic&&item.id!==p.id).slice(0,4).map(card).join('')}</div></section>`;
  mountBodyCards(main);
  disposeTutorial=installTutorial(main,p,storage);
  if(canTryOn(p))tryOnBody(garmentSpecFromProject(p),{card:main.querySelector('.detail-visual [data-body-card]')});
}

function toast(message){
  document.querySelector('.discovery-toast').textContent=message;
  const feedback=document.querySelector('.board-dialog[open] .board-feedback, .image-focus-dialog[open] .focus-feedback');if(feedback)feedback.textContent=message;
  window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>{document.querySelector('.discovery-toast').textContent='';if(feedback?.isConnected)feedback.textContent='';},4000);
}
function renderCurrent(){
  if(isExplore)updateFeed();
  else if(isProfile){renderProfile(main,{library:engagement,projects,renderCard:card,boardId:params.get('board')});main.insertAdjacentHTML('beforeend',tutorialShelf(projects,storage));}
  else renderDetail();
  document.querySelector('[data-saved-count]').textContent=engagement.saved.length;
  imageFocus.refresh();
}
function persistLibrary(next,message){
  engagement=next;const persisted=saveLibrary(engagement,storage);
  renderCurrent();toast(persisted?message:'Changes work for this visit. Browser storage is unavailable.');
  return persisted;
}
function addBoard(name,projectId){
  const token=window.crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const id=`board-${token}`;
  let next=createBoard(engagement,name,id);
  if(projectId)next=setBoardMembership(next,id,projectId,true);
  persistLibrary(next,projectId?'Board created and project saved':'Board created');
  return next.boards.find(board=>board.id===id);
}
const boardDialog=createBoardDialog({getLibrary:()=>engagement,projects,onCreate:addBoard,onMembership:(boardId,projectId,included)=>{
  persistLibrary(setBoardMembership(engagement,boardId,projectId,included),included?'Saved to board':'Removed from board');
}});
const imageFocus=createImageFocus({getState:()=>engagement,onAction:handleAction});
// The mouse reveals the circle itself. No extra hover buttons or click gate.
let pendingHover=null,hoverTimer=0,lastScroll=-Infinity;
function cancelHover(){window.clearTimeout(hoverTimer);pendingHover=null;}
function openHoveredImage(){
  if(!pendingHover)return;
  const remaining=180-(window.performance.now()-lastScroll);
  if(remaining>0){hoverTimer=window.setTimeout(openHoveredImage,remaining+1);return;}
  const frame=pendingHover;pendingHover=null;
  if(!frame.isConnected||!frame.matches(':hover')||imageFocus.activeProjectId||document.querySelector('dialog[open]'))return;
  const target=frame.querySelector('[data-image-menu]');imageFocus.open(projects.find(p=>p.id===target.dataset.imageMenu),target,{hover:true});
}
window.addEventListener('scroll',()=>{
  lastScroll=window.performance.now();
  if(pendingHover){window.clearTimeout(hoverTimer);hoverTimer=window.setTimeout(openHoveredImage,180);}
},{passive:true});
main.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||event.buttons||!window.matchMedia('(hover: hover)').matches||imageFocus.activeProjectId||document.querySelector('dialog[open]'))return;
  const frame=event.target.closest('.image-action-frame');if(!frame||pendingHover===frame)return;
  cancelHover();pendingHover=frame;hoverTimer=window.setTimeout(openHoveredImage,100);
});
window.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'&&!event.target.closest('.image-action-frame'))cancelHover();},{passive:true});
main.addEventListener('pointerout',event=>{const frame=event.target.closest('.image-action-frame');if(!imageFocus.activeProjectId&&frame&&!frame.contains(event.relatedTarget))cancelHover();});
const visualSearch=createVisualSearch({projects:seededProjects,onAction:handleAction,getState:()=>engagement});
installImageLongPress(main,{
  onOpen(frame,pointerId){const trigger=frame.querySelector('[data-image-menu]');imageFocus.open(projects.find(p=>p.id===trigger.dataset.imageMenu),trigger,{pointerId});},
  onMove:(x,y)=>imageFocus.targetAt(x,y),onRelease:(x,y)=>imageFocus.releaseAt(x,y),onCancel:()=>imageFocus.close({immediate:true}),
});
main.addEventListener('submit',event=>{
  const form=event.target.closest('[data-create-profile-board]');if(!form)return;
  event.preventDefault();
  try{addBoard(new FormData(form).get('board-name'));main.querySelector('#profile-board-name')?.focus();}
  catch(error){form.querySelector('.board-form-error').textContent=error.message;}
});
async function handleAction(event){
  if(event.target.closest('[data-tutorial-root]'))return;
  const button=event.target.closest('button');
  if(!button){
    const frame=event.target.closest('.image-action-frame');
    if(frame){
      event.preventDefault();event.stopPropagation();cancelHover();
      const trigger=frame.querySelector('[data-image-menu]');
      imageFocus.close({immediate:true});
      location.assign(`/project/${trigger.dataset.imageMenu}${feedSearch()}`);return;
    }
    const card=event.target.closest('.discovery-card');
    if(card&&!event.target.closest('a'))location.assign(card.querySelector('h2 a').href);
    return;
  }
  event.stopPropagation();
  if(button.hasAttribute('data-share-post')){postDialog.open(button);return;}
  if(button.hasAttribute('data-image-menu')){
    imageFocus.open(projects.find(p=>p.id===button.dataset.imageMenu),button);return;
  }
  if(button.dataset.boardProject){
    const trigger=imageFocus.activeProjectId?imageFocus.close({immediate:true}):button;
    const returning=visualSearch.isOpen?visualSearch.close():trigger;
    boardDialog.open(projects.find(p=>p.id===button.dataset.boardProject),returning);return;
  }
  if(button.dataset.visualSearch){const trigger=imageFocus.activeProjectId?imageFocus.close({immediate:true}):button;visualSearch.open(projects.find(p=>p.id===button.dataset.visualSearch),trigger);return;}
  if(button.dataset.shareProject){
    const p=projects.find(p=>p.id===button.dataset.shareProject);button.disabled=true;
    try{const result=await shareProject(p,{origin:location.origin,share:window.navigator.share?.bind(window.navigator),writeText:window.navigator.clipboard?.writeText.bind(window.navigator.clipboard)});if(result!=='cancelled')toast(result==='shared'?'Project shared':'Project link copied');}
    catch(error){toast(error.message);}finally{button.disabled=false;}return;
  }
  if(button.dataset.removeBoard){
    const position=window.scrollY;persistLibrary(setBoardMembership(engagement,button.dataset.removeBoard,button.dataset.project,false),'Removed from board');
    main.querySelector('.board-project-remove')?.focus({preventScroll:true});window.scrollTo(0,position);return;
  }
  if(button.dataset.kind!=='liked')return;
  const focused=!!imageFocus.activeProjectId;
  const position=window.scrollY;
  const result=toggleEngagement(engagement,'liked',button.dataset.id,storage);engagement=result.state;
  renderCurrent();
  if(!focused){
    const replacement=main.querySelector(`.project-actions [data-id="${button.dataset.id}"][data-kind="liked"]`);
    if(replacement)replacement.focus({preventScroll:true});
    else if(isProfile){const heading=main.querySelector('.profile-favorites h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  }
  window.scrollTo(0,position);
  if(!result.persisted)toast('Changes work for this visit. Browser storage is unavailable.');
}
main.addEventListener('click',handleAction);
// Try an idea on the saved 3D body without leaving the page.
document.addEventListener('click',event=>{const button=event.target.closest('[data-try-on]');if(!button)return;event.preventDefault();event.stopPropagation();const p=projects.find(item=>item.id===button.dataset.tryOn);if(p)tryOnBody(garmentSpecFromProject(p));},true);
window.addEventListener('storage',event=>{if(event.key===ENGAGEMENT_KEY||event.key===PREFERENCES_KEY||event.key===null){engagement=loadLibrary(storage);renderCurrent();boardDialog.refresh();}});
// Community posts: load what's there, then add new ones as anyone publishes them.
function addPost(p){
  if(projects.some(item=>item.id===p.id))return false;
  posts.unshift(p);posts.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));projects.push(p);
  return true;
}
function showNewPost(p){freshPosts.add(p.id);window.setTimeout(()=>freshPosts.delete(p.id),1500);if(!projectId)renderCurrent();}
const postDialog=createPostDialog({storage,onPublished(p){addPost(p);if(isExplore){showNewPost(p);window.scrollTo({top:main.querySelector('#project-feed').offsetTop-90,behavior:'smooth'});toast('Posted. It’s live on Explore for everyone.');}else location.assign(`/project/${p.id}`);}});
async function loadCommunity(){
  try{
    (await loadPosts()).forEach(addPost);
    if(waitingForPost){project=projects.find(p=>p.id===projectId)||await loadPost(projectId);if(project)addPost(project);}
  }catch(error){console.error('[ReThread posts]',error);if(!waitingForPost)toast(friendlyError(error));}
  if(!projectId||waitingForPost)renderCurrent();
}
if(isExplore)renderFeed();else if(waitingForPost)main.innerHTML='<p class="post-help post-loading">Loading project…</p>';else renderCurrent();
if(communityEnabled){
  loadCommunity();
  watchPosts(p=>{if(!addPost(p))return;showNewPost(p);if(isExplore)toast(`New project from @${p.username}`);});
}

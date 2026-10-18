import { state, emit, subscribe } from '../state.js';
import { WORLDS,SCHOOLS,THRESHOLDS,tierFor,rankings,weekStart } from '../progression.js';
import { RankCrest,communityEmblem,escapeHtml as esc } from './rankCrest.js';
import { flatSVG } from '../flats.js';
import { WORLD_ART, worldScenery, worldAtmosphere } from './worldPresentation.js';
import { CharacterPortrait } from '../avatar/portrait.js';
import { disposeCharacterScenes } from '../avatar/lifecycle.js';
let tab='global',period='week',filter='',query='';
const typeName=t=>t==='high'?'High School':'University / College';
const schoolFor=id=>SCHOOLS.find(s=>s.id===id);
const communityName=(s,w)=>`${s.name} ${w.community}`;
export function rankProgress(p=state.progression) {
 const t=tierFor(p.xp),w=WORLDS[p.theme],next=THRESHOLDS[t+1],art=WORLD_ART[p.theme];
 return `<div class="crest-stage" data-power="${t}"><span class="crest-orbit" aria-hidden="true"></span><span class="crest-orbit second" aria-hidden="true"></span><span class="crest-sparks" aria-hidden="true">✦</span>${RankCrest({tier:t,theme:p.theme,size:180})}</div><div class="rank-story"><span class="rank-chapter">${art.chapter} ${String(t+1).padStart(2,'0')} / 08</span><h3>${w.ranks[t]}</h3><p class="rank-flavor">${art.flavor[t]}</p><p>${p.xp.toLocaleString()} lifetime XP · ${p.currency} ${w.currency}</p><span class="rank-progress-track"><progress aria-label="Progress toward next rank" max="${next?next-THRESHOLDS[t]:1}" value="${next?p.xp-THRESHOLDS[t]:1}"></progress></span><p>${next?`${next-p.xp} XP remaining · next: ${w.ranks[t+1]}`:'Highest rank achieved'}</p></div>`;
}
export function renderCommunityPanel(el) {
 disposeCharacterScenes(el);
 const p=state.progression,w=WORLDS[p.theme],data=rankings(p,period),weekly=rankings(p,'week');
 const match=location.hash.match(/^#\/community\/schools\/([^/]+)$/),detail=match&&schoolFor(match[1]);
 const mine=schoolFor(p.communityId), contribution=weekly.events.filter(e=>e.userId===p.userId&&e.communityId===p.communityId).reduce((n,e)=>n+e.xp,0);
 el.style.setProperty('--world-color',w.color);
 const art=WORLD_ART[p.theme],tier=tierFor(p.xp);
 el.dataset.world=p.theme; el.dataset.rank=tier;
 el.style.setProperty('--world-glow',art.accent); el.style.setProperty('--world-dark',art.dark); el.style.setProperty('--world-paper',art.light);
 el.style.setProperty('--rank-intensity',String(.12+tier*.055));
 el.innerHTML=`<div class="panel-head world-hero">${worldScenery(p.theme)}${worldAtmosphere(p.theme,tier)}<div class="hero-content"><div class="eyebrow">ReThread · ${art.kicker}</div><div class="hero-rule" aria-hidden="true"><span></span>✦<span></span></div><h2>${art.title}</h2><p>${art.subtitle}</p><span class="world-signature">${art.ornament}</span><label>World <select id="world">${Object.entries(WORLDS).map(([id,x])=>`<option value="${id}" ${id===p.theme?'selected':''}>${x.name}</option>`).join('')}</select></label></div><div class="hero-seal" aria-hidden="true">${w.motif}<small>${art.chapter.toUpperCase()}<br>${String(tier+1).padStart(2,'0')} / VIII</small></div></div>
 <section class="sec profile-rank" aria-label="Profile and progression overview"><div class="profile-character" aria-label="Your equipped character"></div>${rankProgress(p)}<div class="membership"><a class="profile-pavilion-link" href="#/character">✧ Open character pavilion</a><div>${mine?`${communityEmblem(mine,32)} <a href="#/community/schools/${mine.id}">${esc(communityName(mine,w))}</a><p>${contribution} XP contributed this week · self-selected, unverified</p>`:'No school selected. Personal progression and global rankings are always available.'}</div></div></section>
 <section class="rank-collection sec" aria-label="Your rank journey"><div class="collection-heading"><div><span class="eyebrow">Eight chapters. One maker.</span><h3>Your ${art.chapter.toLowerCase()} journey</h3></div><span>${tier+1} / 8 ranks reached</span></div><div class="rank-path">${THRESHOLDS.map((xp,i)=>`<article class="rank-stop ${i===tier?'is-current':i<tier?'is-earned':'is-future'}" ${i===tier?'aria-current="step"':''}>${RankCrest({tier:i,theme:p.theme,size:74})}<strong>${w.ranks[i]}</strong><small>${xp.toLocaleString()} XP</small><span class="rank-status">${i===tier?'◆ Current rank':i<tier?'✓ Reached':'◇ Ahead'}</span></article>`).join('')}</div></section>
 <p class="demo-note">Local demo · Other makers, school members, and activity are simulated. Membership is self-selected and unverified; no live multiplayer synchronization. Contribution tracking starts with this update. Legacy XP stays in personal All Time totals.</p>
 ${detail?renderDetail(detail,p,w,weekly):`<nav class="community-tabs" aria-label="Leaderboard"><button data-view="global" aria-pressed="${tab==='global'}">Global Makers</button><button data-view="mine" aria-pressed="${tab==='mine'}">My ${w.community}</button><button data-view="schools" aria-pressed="${tab==='schools'}">School Communities</button></nav>
 <div class="ranking-controls"><button data-period="week" aria-pressed="${period==='week'}">This Week</button><button data-period="all" aria-pressed="${period==='all'}">All Time</button>${tab==='schools'?`<label>School type <select id="rank-type"><option value="">All schools</option><option value="high" ${filter==='high'?'selected':''}>High School</option><option value="university" ${filter==='university'?'selected':''}>University / College</option></select></label>`:''}</div>
 <p class="muted">${period==='week'?`${weekStart().toLocaleDateString()} – ${new Date().toLocaleDateString()} · local time, Monday 00:00 through now`:'All tracked activity through '+new Date().toLocaleDateString()} · simulated demo rankings</p>
 ${tab==='mine'&&!mine?'<p>Join a school to see your community leaderboard.</p><a href="#school-directory">Choose a school</a>':renderBoard(tab==='schools'?data.schools.filter(s=>!filter||s.type===filter):data.individuals.filter(m=>tab!=='mine'||m.communityId===p.communityId),tab==='schools',p,w)}
 ${directory(p,w,weekly)}`}`;
 const characterHolder=el.querySelector('.profile-character');
 import('../avatar/CharacterScene.js').then(({CharacterScene,observeCharacterScenes})=>{if(characterHolder.isConnected){characterHolder.innerHTML=CharacterScene(p,{compact:true});observeCharacterScenes(characterHolder);}});
 el.querySelector('#world').onchange=e=>{p.theme=e.target.value;emit('progression');renderCommunityPanel(el);};
 el.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{tab=b.dataset.view;renderCommunityPanel(el);});
 el.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;renderCommunityPanel(el);});
 el.querySelector('#rank-type')?.addEventListener('change',e=>{filter=e.target.value;renderCommunityPanel(el);});
 el.querySelector('#school-search')?.addEventListener('input',e=>{query=e.target.value;updateDirectory(el,p,w,weekly);});
 el.querySelector('#school-type')?.addEventListener('change',()=>updateDirectory(el,p,w,weekly));
 el.querySelector('[data-join]')?.addEventListener('click',e=>{p.communityId=p.communityId===e.currentTarget.dataset.join?null:e.currentTarget.dataset.join;emit('progression');renderCommunityPanel(el);});
}
function renderBoard(rows,schools,p,w) {
 const icon=r=>schools?communityEmblem(r):`<span class="leaderboard-insignia">${CharacterPortrait(p,{size:40,name:r.name,current:r.id===p.userId,demoIndex:Number(r.id.split('-').at(-1))||0})}${RankCrest({tier:tierFor(r.xp),theme:p.theme,size:40})}</span>`;
 const name=r=>schools?r.name:r.name;
 return `<div class="podium" aria-label="Top three">${rows.slice(0,3).map((r,i)=>`<article class="podium-card"> <span>#${i+1}</span>${icon(r)}<strong>${esc(name(r))}</strong><span>${r.score.toLocaleString()} XP</span></article>`).join('')}</div><ol class="rank-list">${rows.map((r,i)=>`<li class="rank-row ${schools?r.id===p.communityId?'current':'':r.id===p.userId?'current':''}"><strong>#${i+1}</strong>${icon(r)}<div class="rank-person">${schools?`<a href="#/community/schools/${r.id}">${esc(communityName(r,w))}</a><small>${typeName(r.type)} · ${r.contributors} active contributors · ${r.members} members</small>`:`<strong>${esc(r.name)}${r.id===p.userId?' · you':''}</strong><small>${w.ranks[tierFor(r.xp)]} · ${r.xp} lifetime XP</small><small>${r.communityId?esc(communityName(schoolFor(r.communityId),w)):'Independent maker'}</small>`}</div><div class="rank-score"><strong>${r.score.toLocaleString()} XP</strong><small>${r.projects} projects</small></div></li>`).join('')}</ol>${!rows.length?'<p>No activity in this selection yet.</p>':''}`;
}
function directory(p,w,data) {
 return `<section class="sec" id="school-directory"><h3>Find your ${w.community}</h3><p>Optional · Choose a type, search, then preview before joining. Real school names are used only for this demo.</p><label>School type <select id="school-type"><option value="high">High School</option><option value="university">University / College</option></select></label><label>Search schools <input id="school-search" type="search" value="${esc(query)}" placeholder="Search school directory" /></label><div id="directory-results">${directoryRows('high',p,w,data)}</div></section>`;
}
function directoryRows(type,p,w,data) { return data.schools.filter(s=>s.type===type&&s.name.toLowerCase().includes(query.toLowerCase())).map(s=>`<a class="school-preview" href="#/community/schools/${s.id}">${communityEmblem(s,36)}<span><strong>${esc(communityName(s,w))}</strong><small>${typeName(s.type)} · ${s.members} members · ${s.score} weekly XP · ${s.projects} projects · #${data.schools.indexOf(s)+1}</small><small>Preview community →</small></span></a>`).join('')||'<p>No matching schools.</p>'; }
function updateDirectory(el,p,w,data) {el.querySelector('#directory-results').innerHTML=directoryRows(el.querySelector('#school-type').value,p,w,data);}
function renderDetail(s,p,w,data) {
 const row=data.schools.find(x=>x.id===s.id),events=data.events.filter(e=>e.communityId===s.id),own=events.filter(e=>e.userId===p.userId);
 return `<a href="#/community">← All communities</a><section class="community-banner">${communityEmblem(s,80)}<h2>${esc(communityName(s,w))}</h2><p>${typeName(s.type)} · ${row.members} members · self-selected, unverified</p><button class="btn" data-join="${s.id}">${p.communityId===s.id?'Leave community':p.communityId?'Switch to this community':'Join community'}</button><p>Weekly #${data.schools.indexOf(row)+1} · ${row.score} XP · ${row.contributors} active contributors</p></section><section class="sec"><h3>Complete 10 upcycling projects together this week.</h3><progress max="10" value="${Math.min(10,row.projects)}" aria-label="Shared weekly project goal"></progress><p>${row.projects} / 10 projects · includes simulated activity · visual goal, no extra reward</p><p>Your contribution: ${own.reduce((n,e)=>n+e.xp,0)} XP · ${own.length} projects this week</p></section><h3>Members · this week</h3>${renderBoard(data.individuals.filter(m=>m.communityId===s.id),false,p,w)}<section class="sec"><h3>Recent project showcase</h3><p>Seeded demo activity and your actual completed projects.</p><div class="showcase">${events.slice().sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,6).map((e,i)=>`<article>${state.garments.length?flatSVG(state.garments[i%state.garments.length],{width:150,pad:12,flaws:false}):''}<strong>${esc(e.title||'Upcycling project')}</strong><small>${e.demo?'Simulated project · illustrative garment':'Your completed project'} · ${new Date(e.timestamp).toLocaleDateString()}</small></article>`).join('')||'<p>Complete your first project to start the showcase.</p>'}</div></section>`;
}
export function initCommunityNavigation(switchTab) {
 const route=()=>{if(location.hash.startsWith('#/community'))switchTab('community');else if(location.hash==='#/character')switchTab('character');};
 window.addEventListener('hashchange',route); route();
 subscribe(reason=>{if(reason==='reset'&&state.tab==='community')renderCommunityPanel(document.getElementById('panel'));});
}

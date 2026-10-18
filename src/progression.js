/** @typedef {{id:string,userId:string,sourceType:string,sourceId:string,xp:number,timestamp:string,communityId:string|null,title?:string}} RewardEvent */
/** @typedef {{version:number,userId:string,theme:string,xp:number,currency:number,communityId:string|null,events:RewardEvent[],completed:string[]}} Progression */
/** Shared progression model. Demo membership and rewards remain device-local. */
import { THRESHOLDS,tierFor } from './ranks.js';
import { migrateAvatar,grantMilestones } from './avatar/inventory.js';
export { THRESHOLDS,tierFor } from './ranks.js';
export const WORLDS = {
 cultivation: {name:'Chinese Cultivation',community:'Sect',currency:'Chi',color:'#27786e',motif:'☁',ranks:['Loose Thread','Needle Initiate','Silken Adept','Golden Weaver','Jade Artisan','Radiant Sage','Starbound Weaver','Eternal Thread']},
 garden: {name:'Fairy Garden',community:'Grove',currency:'Dewdrops',color:'#727d3c',motif:'✿',ranks:['Seed Stitch','Copper Bud','Silver Sprout','Golden Bloom','Fern Keeper','Sunlit Petal','Moonflower','Evergreen Crown']},
 fantasy: {name:'Fantasy RPG',community:'Guild',currency:'Gold',color:'#8055a2',motif:'◆',ranks:['Apprentice','Bronze Crafter','Silver Ranger','Gold Artisan','Emerald Warden','Radiant Enchanter','Astral Smith','Everlasting Artisan']},
 runway: {name:'Fashion Runway',community:'Fashion House',currency:'Pearls',color:'#ab536c',motif:'✧',ranks:['First Stitch','Bronze Seam','Silver Cut','Golden Silhouette','Jade Atelier','Radiant Couture','Celestial Collection','Timeless Icon']},
 cyber: {name:'Cyberpunk',community:'Collective',currency:'Credits',color:'#277caa',motif:'⌘',ranks:['Loose Wire','Copper Circuit','Silver Signal','Gold Protocol','Jade Matrix','Radiant Core','Orbital Network','Infinite Thread']}
};
export const SCHOOLS = [
 {id:'virginia-tech',name:'Virginia Tech',type:'university'},
 {id:'uva',name:'University of Virginia',type:'university'},
 {id:'demo-river-college',name:'River College (demo)',type:'university'},
 {id:'demo-maple-high',name:'Maple High School (demo)',type:'high'},
 {id:'demo-oak-high',name:'Oak High School (demo)',type:'high'},
 {id:'demo-river-high',name:'River High School (demo)',type:'high'}
];
export function migrateProgress(data={}) {
 const xp=Math.max(0,Number(data.xp)||0);
 return {...data,version:3,userId:data.userId || 'local-maker',theme:WORLDS[data.theme]?data.theme:'cultivation',xp,currency:Math.max(0,Number(data.currency)||0),communityId:SCHOOLS.some(s=>s.id===data.communityId)?data.communityId:null,events:Array.isArray(data.events)?data.events:[],completed:Array.isArray(data.completed)?data.completed:[],avatar:migrateAvatar(data.avatar,tierFor(xp),data.inventory||data.ownedItemIds)};
}
export function weekStart(now=new Date()) { const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-(d.getDay()+6)%7); return d; }
export function inPeriod(event,period,now=new Date()) { const t=new Date(event.timestamp); return t<=now && (period==='all'||t>=weekStart(now)); }
export function completeProject(progress,sourceId,now=new Date(),title='Upcycling project') {
 return recordEarnedReward(progress,{sourceId,sourceType:'project',xp:100,currency:40,title},now);
}
// Shared reward boundary supports a future larger earned reward with one highest-tier reveal.
// No new reward claim or source is exposed by this update.
export function recordEarnedReward(progress,{sourceId,sourceType,xp,currency=0,title},now=new Date()) {
 if(!sourceId||!sourceType||!Number.isFinite(xp)||xp<=0||!Number.isFinite(currency)||currency<0)return null;
 if(sourceType==='project'&&progress.completed.includes(sourceId)||progress.events.some(e=>e.sourceType===sourceType&&e.sourceId===sourceId)) return null;
 const before=tierFor(progress.xp);
 const event={id:`${progress.userId}:${sourceType}:${sourceId}`,userId:progress.userId,sourceType,sourceId,xp,timestamp:now.toISOString(),communityId:progress.communityId,title};
 progress.events.push(event); if(sourceType==='project')progress.completed.push(sourceId); progress.xp+=xp; progress.currency+=currency;
 const after=tierFor(progress.xp),unlockedItemIds=grantMilestones(progress.avatar,after);
 return {event,currency,rankUp:after>before,previousTier:before,tier:after,unlockedItemIds};
}
// Explicit synthetic activity; never used to backfill the current user's legacy XP.
export function demoMakers(now=new Date()) {
 const names=['Mira','Jules','Avery','Sam','Noor','Rowan','Kai','Alex','Robin','Eden','Remy','Sage'];
 return names.map((name,i)=>{const events=Array.from({length:3+i%5},(_,j)=>({id:`demo-${i}-${j}`,userId:`demo-${i}`,sourceType:'project',sourceId:`demo-project-${i}-${j}`,xp:100,timestamp:new Date(+weekStart(now)+Math.min(+now-+weekStart(now),(j+1)*3600000)).toISOString(),communityId:SCHOOLS[i%SCHOOLS.length].id,title:['Patchwork tote','Reworked denim','Visible mending'][j%3],demo:true}));return {id:`demo-${i}`,name,communityId:SCHOOLS[i%SCHOOLS.length].id,xp:700+i*370,events};});
}
export function rankings(progress,period='week',now=new Date()) {
 const makers=[...demoMakers(now),{id:progress.userId,name:'You',communityId:progress.communityId,xp:progress.xp,events:progress.events}];
 const individuals=makers.map(m=>{const es=m.events.filter(e=>inPeriod(e,period,now));return {...m,score:period==='all'?m.xp:es.reduce((s,e)=>s+e.xp,0),projects:es.filter(e=>e.sourceType==='project').length};}).sort((a,b)=>b.score-a.score||b.projects-a.projects||a.id.localeCompare(b.id));
 const events=makers.flatMap(m=>m.events).filter(e=>inPeriod(e,period,now));
 const schools=SCHOOLS.map(s=>{const es=events.filter(e=>e.communityId===s.id);return {...s,score:es.reduce((n,e)=>n+e.xp,0),projects:es.filter(e=>e.sourceType==='project').length,contributors:new Set(es.map(e=>e.userId)).size,members:makers.filter(m=>m.communityId===s.id).length};}).sort((a,b)=>b.score-a.score||b.projects-a.projects||a.id.localeCompare(b.id));
 return {individuals,schools,events};
}

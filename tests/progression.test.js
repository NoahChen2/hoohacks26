import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateProgress,completeProject,rankings,weekStart,inPeriod,WORLDS,THRESHOLDS,tierFor} from '../src/progression.js';
import {RankCrest} from '../src/ui/rankCrest.js';
test('migration preserves legacy XP, currency and inventory without inventing history',()=>{
 const p=migrateProgress({xp:1400,currency:55,inventory:['needle']});
 assert.equal(p.xp,1400);assert.equal(p.currency,55);assert.deepEqual(p.inventory,['needle']);assert.deepEqual(p.events,[]);assert.equal(p.version,3);
 assert.equal(rankings(p,'all').individuals.find(x=>x.id===p.userId).score,1400);
});
test('joining and switching retain historical attribution and prevent repeat rewards',()=>{
 const p=migrateProgress({xp:700});const now=new Date();
 p.communityId='virginia-tech';assert.equal(p.xp,700);
 assert.equal(rankings(p).events.filter(e=>e.userId===p.userId).length,0);
 completeProject(p,'shirt:mend',now);p.communityId='uva';completeProject(p,'jeans:hem',now);
 assert.equal(completeProject(p,'shirt:mend',now),null);assert.equal(p.xp,900);assert.equal(p.currency,80);
 assert.deepEqual(p.events.map(e=>e.communityId),['virginia-tech','uva']);
 const r=rankings(p);assert.equal(r.events.filter(e=>e.userId===p.userId).length,2);
 p.communityId=null;completeProject(p,'shirt:paint',now);assert.equal(p.events[2].communityId,null);
});
test('all worlds preserve shared progression and rankings',()=>{
 const p=migrateProgress({communityId:'virginia-tech'});completeProject(p,'one');const before=rankings(p);
 for(const theme of Object.keys(WORLDS)){p.theme=theme;assert.deepEqual(rankings(p),before);assert.equal(p.communityId,'virginia-tech');assert.equal(p.currency,40);}
});
test('Monday local midnight includes boundary and excludes earlier and future events',()=>{
 const now=new Date(2026,9,18,16,0),start=weekStart(now);
 assert.equal(start.getDay(),1);assert.equal(start.getHours(),0);assert.equal(start.getDate(),12);
 assert.equal(inPeriod({timestamp:start.toISOString()},'week',now),true);
 assert.equal(inPeriod({timestamp:new Date(+start-1).toISOString()},'week',now),false);
 assert.equal(inPeriod({timestamp:new Date(+now+1).toISOString()},'week',now),false);
 assert.equal(weekStart(new Date(2026,9,12,0,0)).getDate(),12);
});
test('40 accessible original crest variants and exact tier thresholds',()=>{
 for(const theme of Object.keys(WORLDS)){
 const svg=THRESHOLDS.map((xp,tier)=>{assert.equal(tierFor(xp),tier);if(tier)assert.equal(tierFor(xp-1),tier-1);return RankCrest({tier,theme,label:'Rank emblem'});});
 assert.equal(new Set(svg).size,8);svg.forEach(s=>{assert.match(s,/role="img"/);assert.match(s,/aria-label="Rank emblem"/);});
 }
});
test('local persistence and legacy closet migration survive module reload',async()=>{
 const cache=new Map();globalThis.localStorage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
 cache.set('restitch.v1',JSON.stringify({body:{height:172},garments:[{id:'existing'}],tools:{needle:true},xp:300}));
 const first=await import('../src/state.js?first');assert.equal(first.state.garments[0].id,'existing');assert.equal(first.state.progression.xp,300);
 first.state.progression.communityId='uva';completeProject(first.state.progression,'existing:mend');first.emit('reward');
 const second=await import('../src/state.js?second');assert.equal(second.state.progression.communityId,'uva');assert.equal(second.state.progression.xp,400);assert.equal(completeProject(second.state.progression,'existing:mend'),null);
 assert.equal(second.state.garments[0].id,'existing');
});

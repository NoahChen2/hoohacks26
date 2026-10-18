import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPreferences,normalizePreferences,loadPreferences,savePreferences,toggleTool,validateStep,rankProjects,PREFERENCES_KEY} from '../src/explore/preferences.js';
import {projects} from '../src/explore/projects.js';
test('preferences round-trip independently of existing boards and survive malformed storage',()=>{
  const data=new Map([['rethread.explore.v1','existing boards']]);const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const p={...defaultPreferences(),aesthetics:['Vintage','Coquette'],skill:'Intermediate',tools:['Iron'],status:'completed'};
  assert.equal(savePreferences(storage,p),true);assert.deepEqual(loadPreferences(storage),p);assert.equal(data.get('rethread.explore.v1'),'existing boards');
  data.set(PREFERENCES_KEY,'{');assert.deepEqual(loadPreferences(storage),defaultPreferences());
  assert.equal(savePreferences({setItem(){throw Error();}},p),false);
});
test('None yet is exclusive in both directions and imported preferences are sanitized',()=>{
  assert.deepEqual(toggleTool(['Iron','Fabric scissors'],'None yet'),['None yet']);assert.deepEqual(toggleTool(['None yet'],'Iron'),['Iron']);assert.deepEqual(toggleTool(['None yet'],'None yet'),[]);
  assert.deepEqual(normalizePreferences({aesthetics:['Y2K','Y2K','bad'],tools:['None yet','Iron'],world:'bad'}),{...defaultPreferences(),aesthetics:['Y2K'],tools:['None yet']});
});
test('each required step validates and cultivation is a valid default world',()=>{
 const p=defaultPreferences();for(const step of [0,1,2])assert.ok(validateStep(p,step));assert.equal(validateStep(p,3),'');
 p.aesthetics=['Bohemian'];p.skill='Beginner';p.tools=['None yet'];for(let i=0;i<4;i++)assert.equal(validateStep(p,i),'');
});
test('ranking prioritizes explicit aesthetics then skill with deterministic ties and no mutation',()=>{
 const original=projects.map(p=>p.id),p={aesthetics:['Vintage'],skill:'Beginner'};
 const ranked=rankProjects(projects,p);assert.equal(ranked[0].aesthetic,'Vintage');assert.equal(ranked[0].difficulty,'Beginner');assert.deepEqual(rankProjects(projects,p),ranked);assert.deepEqual(projects.map(p=>p.id),original);
 assert.deepEqual(rankProjects(projects,defaultPreferences()),projects);
 const unknown=rankProjects(projects,{aesthetics:['Coquette'],skill:'Beginner'});assert.equal(unknown[0].difficulty,'Beginner');assert.equal(unknown.length,24);
});

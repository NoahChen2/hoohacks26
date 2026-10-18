import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog as projects} from './fixtures/catalog.mjs';
import {generatedTutorial} from '../src/tutorial/catalog.js';
import {saveGeneratedProject,loadGeneratedProjects,loadProgress,saveProgress,awardProjectCompletion,getRewardSummary,PROGRESS_PREFIX,COMPLETION_PREFIX} from '../src/tutorial/store.js';
import {demoAnalysis,parseAnalysisRequest} from '../server/analyze.js';
const memory=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function finish(storage,p){saveProgress(storage,p,{materials:[],tools:[],steps:p.steps.map((_,i)=>i)});}
test('all seed tutorials expose cover, tools, materials, instructions and safety notes',()=>{for(const p of projects){const t=p;assert.ok(t.cover);assert.ok(t.tools.length);assert.ok(t.materials.length);assert.ok(t.steps.length>=3);assert.ok(t.safetyNotes.length);assert.ok(t.estimatedTime);}});
test('checklists and steps restore, invalid indices are ignored and legacy storage stays untouched',()=>{
 const storage=memory(),p=projects[0];storage.setItem('rethread.explore.v1','boards');
 saveProgress(storage,p,{materials:[0,0,999,-1],tools:[1],steps:[0,1]});assert.deepEqual(loadProgress(storage,p),{version:1,materials:[0],tools:[1],steps:[0,1]});assert.equal(storage.getItem('rethread.explore.v1'),'boards');
 storage.setItem(PROGRESS_PREFIX+p.id,'{');assert.deepEqual(loadProgress(storage,p).steps,[]);
});
test('completion requires persisted steps and awards 100 XP, 40 currency and one reuse once',()=>{
 const storage=memory(),p=projects[0];assert.throws(()=>awardProjectCompletion(storage,p),/Finish every/);finish(storage,p);
 const first=awardProjectCompletion(storage,p,{now:'2026-10-18T12:00:00Z'});assert.equal(first.awarded,true);assert.equal(first.totals.xp,100);assert.equal(first.totals.currency,40);assert.equal(first.totals.completedProjects,1);assert.equal(first.totals.garmentsReused,1);
 for(let i=0;i<5;i++)assert.equal(awardProjectCompletion(storage,p).awarded,false);
 assert.equal(getRewardSummary(storage).xp,100);assert.equal(getRewardSummary(storage).completions[0].completedAt,'2026-10-18T12:00:00Z');
 const second={...projects[1],garmentId:p.id};finish(storage,second);awardProjectCompletion(storage,second);assert.equal(getRewardSummary(storage).xp,200);assert.equal(getRewardSummary(storage).garmentsReused,1);
});
test('storage failures never announce completion or lose previous records',()=>{
 const storage=memory(),p=projects[0];finish(storage,p);const blocked={...storage,getItem:storage.getItem,setItem(){throw Error();}};assert.throws(()=>awardProjectCompletion(blocked,p),/not saved/);assert.equal(getRewardSummary(storage).completedProjects,0);
 storage.setItem(COMPLETION_PREFIX+p.id,'{');assert.throws(()=>awardProjectCompletion(storage,p),/could not be read/);assert.equal(storage.getItem(COMPLETION_PREFIX+p.id),'{');
});
test('AI ideas persist with stable IDs, source disclosures, metadata and complete tutorials',async()=>{
 const storage=memory(),result=demoAnalysis(parseAnalysisRequest({imageDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=',condition:'Good condition',material:'Unknown'}));
 const options={mode:'demo',warnings:result.analysis.warnings,garmentId:'garment-test'};
 const id=await saveGeneratedProject(storage,result.analysis.projects[0],options);assert.match(id,/^ai-[a-f0-9]{64}$/);assert.equal(await saveGeneratedProject(storage,result.analysis.projects[0],options),id);assert.equal(loadGeneratedProjects(storage).length,1);
 const t=generatedTutorial(loadGeneratedProjects(storage)[0]);assert.equal(t.source,'ai-demo');assert.equal(t.garmentId,'garment-test');assert.deepEqual(t.steps,result.analysis.projects[0].instructions);assert.match(t.safetyNotes.join(),/not based on your photo/);finish(storage,t);awardProjectCompletion(storage,t);assert.equal(getRewardSummary(storage).xp,100);
 await assert.rejects(()=>saveGeneratedProject(storage,{title:'Incomplete'}));
});

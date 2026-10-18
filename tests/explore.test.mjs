import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {CATEGORIES,filterProjects} from '../src/explore/projects.js';
import {catalog as projects} from './fixtures/catalog.mjs';
import {loadEngagement,toggleEngagement,ENGAGEMENT_KEY} from '../src/explore/storage.js';

test('the launch catalog has unique routes, bundled photos and complete project details',()=>{
  assert.ok(projects.length>=20);assert.ok(projects.every(Boolean));assert.equal(new Set(projects.map(p=>p.id)).size,projects.length);
  for(const p of projects){
    assert.match(p.id,/^[a-z0-9-]+$/);assert.ok(p.title&&p.username&&p.description);assert.ok(CATEGORIES.includes(p.aesthetic));assert.ok(p.likes>=0);assert.equal(p.steps.length,3);assert.ok(p.materials.length>=3);
    for(const asset of [p.cover,p.avatar]){assert.ok(existsSync(`public${asset}`));if(p.photo&&asset===p.cover){assert.match(asset,/^\/explore\/photos\/[a-z0-9-]+\.jpg$/);assert.deepEqual([...readFileSync(`public${asset}`).subarray(0,3)],[0xff,0xd8,0xff]);}else assert.match(readFileSync(`public${asset}`,'utf8'),/^<svg/);}
  }
});
test('search combines terms, category and saved filters without mutating seeds',()=>{
  assert.equal(filterProjects('','For You',false,[],projects).length,projects.length);
  for(const category of CATEGORIES){const result=filterProjects('',category,false,[],projects);assert.ok(result.length>0);assert.ok(result.every(p=>category==='For You'||p.aesthetic===category||p.difficulty===category));}
  assert.ok(filterProjects('DENIM','For You',false,[],projects).length>0);assert.equal(filterProjects('no-matching-demo-project','For You',false,[],projects).length,0);
  const p=projects[0];assert.deepEqual(filterProjects(p.username,p.aesthetic,true,[p.id],projects),[p]);assert.deepEqual(filterProjects('',p.aesthetic,true,[],projects),[]);
});
test('likes and saves toggle independently and survive storage reload',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  let state=loadEngagement(storage);state=toggleEngagement(state,'liked','denim-corset',storage).state;state=toggleEngagement(state,'saved','denim-corset',storage).state;
  assert.deepEqual(loadEngagement(storage),{liked:['denim-corset'],saved:['denim-corset']});
  state=toggleEngagement(state,'liked','denim-corset',storage).state;assert.deepEqual(state,{liked:[],saved:['denim-corset']});assert.deepEqual(loadEngagement(storage),state);assert.equal(values.size,1);assert.ok(values.has(ENGAGEMENT_KEY));
});
test('corrupt or inaccessible storage fails gracefully without discarding in-memory changes',()=>{
  const broken={getItem:()=>'{invalid',setItem:()=>{throw Error('quota');}};
  assert.deepEqual(loadEngagement(broken),{liked:[],saved:[]});
  assert.deepEqual(toggleEngagement(loadEngagement(broken),'saved','shirt-wrap',broken),{state:{liked:[],saved:['shirt-wrap']},persisted:false});
  assert.deepEqual(loadEngagement({getItem:()=>JSON.stringify({liked:['a','a',null,3],saved:'bad'})}),{liked:['a'],saved:[]});
});

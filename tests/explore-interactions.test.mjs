import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLibrary,createBoard,setBoardMembership,saveLibrary} from '../src/explore/library.js';
import {ENGAGEMENT_KEY,toggleEngagement,loadEngagement} from '../src/explore/storage.js';
import {canonicalProjectUrl,shareProject,imageActionOverlay} from '../src/explore/image-actions.js';
import {projects} from '../src/explore/projects.js';
function memory(seed={}){const values=new Map(Object.entries(seed));return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};}

test('read-only legacy migration preserves likes, saves, unknown settings, and unrelated storage',()=>{
  const raw=JSON.stringify({liked:['denim-corset'],saved:['shirt-wrap','denim-corset'],future:{palette:'pink'}});
  const storage=memory({[ENGAGEMENT_KEY]:raw,'restitch.v1':'untouched'}),state=loadLibrary(storage);
  assert.deepEqual(state.liked,['denim-corset']);assert.deepEqual(state.saved,['shirt-wrap','denim-corset']);assert.deepEqual(state.future,{palette:'pink'});
  assert.equal(state.boards.length,3);assert.deepEqual(state.boards[0].items.map(i=>i.projectId),state.saved);assert.ok(state.boards[0].items.every(i=>i.savedAt===null));
  assert.equal(storage.getItem(ENGAGEMENT_KEY),raw);assert.equal(storage.getItem('restitch.v1'),'untouched');
  const result=toggleEngagement(state,'liked','denim-corset',storage);assert.deepEqual(loadLibrary(storage).boards,state.boards);assert.deepEqual(result.state.liked,[]);
});

test('custom boards, multiple memberships, idempotent saves, removal and refresh stay consistent',()=>{
  const storage=memory();let state=loadLibrary(storage);
  state=createBoard(state,'  Summer remakes  ','board-summer');assert.equal(state.boards.at(-1).name,'Summer remakes');
  state=setBoardMembership(state,'board-summer','denim-corset',true,'2026-10-17');
  state=setBoardMembership(state,'board-summer','denim-corset',true,'changed');
  state=setBoardMembership(state,'denim-upcycling','denim-corset',true);
  assert.equal(state.boards.at(-1).items.length,1);assert.equal(state.boards.at(-1).items[0].savedAt,'2026-10-17');assert.deepEqual(state.saved,['denim-corset']);
  state=setBoardMembership(state,'board-summer','denim-corset',false);assert.deepEqual(state.saved,['denim-corset']);
  assert.ok(saveLibrary(state,storage));assert.deepEqual(loadLibrary(storage),state);assert.deepEqual(loadEngagement(storage).saved,['denim-corset']);
  state=setBoardMembership(state,'denim-upcycling','denim-corset',false);saveLibrary(state,storage);assert.deepEqual(loadLibrary(storage).saved,[]);
});

test('invalid board input, corrupt snapshots and blocked persistence are handled without data loss',()=>{
  const state=loadLibrary(memory());
  assert.throws(()=>createBoard(state,' MY INSPIRATION ','new'),/already exists/);assert.throws(()=>createBoard(state,' ','new'));assert.throws(()=>createBoard(state,'x'.repeat(61),'new'));assert.throws(()=>createBoard(state,'Fine','../bad'));
  assert.throws(()=>setBoardMembership(state,'missing','a',true));
  const source={boards:[null,{id:'custom',name:'Real',items:[null,{projectId:'a'},{projectId:'a'}]},{id:'custom',name:'Duplicate',items:[]}],saved:['legacy'],liked:['x','x']};
  const normalized=loadLibrary(memory({[ENGAGEMENT_KEY]:JSON.stringify(source)}));assert.equal(normalized.boards.filter(b=>b.id==='custom').length,1);assert.equal(normalized.boards[0].items.length,1);assert.deepEqual(normalized.liked,['x']);assert.ok(normalized.saved.includes('legacy'));
  assert.equal(loadLibrary(memory({[ENGAGEMENT_KEY]:'broken'})).boards.length,3);assert.equal(saveLibrary(state,{setItem:()=>{throw Error('quota');}}),false);
});

test('sharing uses a canonical catalog URL, native share, clipboard fallback and honest errors',async()=>{
  const project=projects[0],origin='https://rethread.example';let shared,copied;
  assert.equal(canonicalProjectUrl(project,origin),`${origin}/project/${project.id}`);
  assert.equal(await shareProject(project,{origin,share:async data=>{shared=data;}}),'shared');assert.equal(shared.url,`${origin}/project/${project.id}`);
  assert.equal(await shareProject(project,{origin,writeText:async url=>{copied=url;}}),'copied');assert.equal(copied,shared.url);
  assert.equal(await shareProject(project,{origin,share:async()=>{throw Error('unsupported');},writeText:async()=>{}}),'copied');
  assert.equal(await shareProject(project,{origin,share:async()=>{const e=new Error();e.name='AbortError';throw e;},writeText:()=>{throw Error('must not copy cancelled shares');}}),'cancelled');
  await assert.rejects(shareProject(project,{origin}),/unavailable/);await assert.rejects(shareProject(project,{origin,writeText:async()=>{throw Error('denied');}}),/Could not copy/);
});

test('only a keyboard-accessible image action entry remains; no dots or Save pill',()=>{
  const html=imageActionOverlay(projects[0]);
  assert.match(html,/aria-expanded="false"/);assert.match(html,/aria-haspopup="dialog"/);
  assert.match(html,/image-focus-access/);assert.doesNotMatch(html,/image-context-save|image-menu-toggle|data-board-project|data-kind|data-share-project/);
});

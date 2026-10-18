import {ENGAGEMENT_KEY,loadEngagement} from './storage.js';
export const DEFAULT_BOARDS=[['my-inspiration','My Inspiration'],['denim-upcycling','Denim Upcycling'],['projects-to-try','Projects to Try']];
const itemIds=board=>board.items.map(item=>item.projectId);
const unionSaved=boards=>[...new Set(boards.flatMap(itemIds))];

// Read-only additive migration: keep favorites, legacy saves and unknown fields.
// The first explicit change persists the upgraded snapshot under the SAME key.
export function loadLibrary(storage){
  let raw={};try{const parsed=JSON.parse(storage.getItem(ENGAGEMENT_KEY)||'{}');if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))raw=parsed;}catch{/* Guest memory fallback. */}
  const engagement=loadEngagement(storage),boards=[],seen=new Set();
  for(const entry of Array.isArray(raw.boards)?raw.boards:[]){
    if(!entry||typeof entry.id!=='string'||!/^[a-z0-9-]{1,100}$/.test(entry.id)||seen.has(entry.id)||typeof entry.name!=='string'||!entry.name.trim())continue;
    seen.add(entry.id);const ids=new Set(),items=[];
    for(const item of Array.isArray(entry.items)?entry.items:[]){
      if(!item||typeof item.projectId!=='string'||ids.has(item.projectId))continue;
      ids.add(item.projectId);items.push({...item,savedAt:typeof item.savedAt==='string'?item.savedAt:null});
    }
    boards.push({...entry,name:entry.name.trim().slice(0,60),items});
  }
  for(const [id,name] of DEFAULT_BOARDS)if(!seen.has(id))boards.push({id,name,items:[]});
  const assigned=new Set(unionSaved(boards));
  const legacy=engagement.saved.filter(id=>!assigned.has(id)).map(projectId=>({projectId,savedAt:null}));
  boards.find(b=>b.id==='my-inspiration').items.push(...legacy);
  return {...raw,...engagement,version:2,boards,saved:unionSaved(boards)};
}
export function createBoard(state,name,id){
  const trimmed=name.trim();
  if(!trimmed||trimmed.length>60)throw new Error('Choose a board name between 1 and 60 characters.');
  if(state.boards.some(b=>b.name.toLocaleLowerCase()===trimmed.toLocaleLowerCase()))throw new Error('A board with that name already exists.');
  if(!/^[a-z0-9-]{1,100}$/.test(id)||state.boards.some(b=>b.id===id))throw new Error('Could not create a unique board. Please try again.');
  return {...state,boards:[...state.boards,{id,name:trimmed,items:[]}]};
}
export function setBoardMembership(state,boardId,projectId,included,now=new Date().toISOString()){
  if(!state.boards.some(b=>b.id===boardId))throw new Error('This board no longer exists.');
  const boards=state.boards.map(b=>{
    if(b.id!==boardId)return b;
    const items=b.items.filter(item=>item.projectId!==projectId);
    if(included)items.push(b.items.find(item=>item.projectId===projectId)||{projectId,savedAt:now});
    return {...b,items};
  });
  return {...state,boards,saved:unionSaved(boards)};
}
export function saveLibrary(state,storage){try{storage.setItem(ENGAGEMENT_KEY,JSON.stringify(state));return true;}catch{return false;}}

export const ENGAGEMENT_KEY='rethread.explore.v1';
export function loadEngagement(storage){
  try{
    const value=JSON.parse(storage.getItem(ENGAGEMENT_KEY)||'{}');
    const ids=field=>Array.isArray(value?.[field])?[...new Set(value[field].filter(id=>typeof id==='string'))]:[];
    return {liked:ids('liked'),saved:ids('saved')};
  }catch{return {liked:[],saved:[]};}
}
export function toggleEngagement(state,kind,id,storage){
  if(!['liked','saved'].includes(kind))throw new Error('Unknown engagement kind');
  const next={...state,[kind]:state[kind].includes(id)?state[kind].filter(value=>value!==id):[...state[kind],id]};
  let persisted=true;
  try{storage.setItem(ENGAGEMENT_KEY,JSON.stringify(next));}catch{persisted=false;}
  return {state:next,persisted};
}

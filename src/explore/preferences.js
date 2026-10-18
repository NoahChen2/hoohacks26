export const PREFERENCES_KEY='rethread.preferences.v1';
export const AESTHETICS=['Streetwear','Y2K','Vintage','Minimalist','Cottagecore','Coquette','Alternative','Bohemian'];
export const SKILLS=['Beginner','Intermediate','Advanced'];
export const TOOLS=['Needle and thread','Sewing machine','Fabric scissors','Iron','Measuring tape','None yet'];
export const WORLDS=[
  {id:'cultivation',name:'Chinese Cultivation',description:'Mountain sanctuaries, floating clouds, and a path of patient craft.',rank:'Outer Disciple',symbol:'山',colors:['#283e42','#bad1bc']},
  {id:'fairy',name:'Fairy Garden',description:'A woodland workshop filled with flowers and little possibilities.',rank:'Seedling Stitcher',symbol:'✿',colors:['#496343','#e4c9d9']},
  {id:'fantasy',name:'Fantasy RPG',description:'Set out from a candlelit guild with your next creation in hand.',rank:'Crafting Apprentice',symbol:'⚔',colors:['#49365c','#e6c47e']},
  {id:'runway',name:'Fashion Runway',description:'A spotlight, a fresh silhouette, and your own point of view.',rank:'Emerging Designer',symbol:'✧',colors:['#593d47','#f2d8c9']},
  {id:'cyberpunk',name:'Cyberpunk',description:'Neon city nights meet inventive, future-facing reworks.',rank:'Thread Runner',symbol:'⌘',colors:['#252d51','#71e7d1']},
];
export const defaultPreferences=()=>({version:1,aesthetics:[],skill:'',tools:[],world:'cultivation',status:'draft'});
export function normalizePreferences(value){
  const v=value&&typeof value==='object'?value:{};
  const select=(items,allowed)=>Array.isArray(items)?[...new Set(items.filter(x=>allowed.includes(x)))]:[];
  const tools=select(v.tools,TOOLS);
  return {...defaultPreferences(),aesthetics:select(v.aesthetics,AESTHETICS),skill:SKILLS.includes(v.skill)?v.skill:'',tools:tools.includes('None yet')?['None yet']:tools,world:WORLDS.some(w=>w.id===v.world)?v.world:'cultivation',status:['completed','skipped'].includes(v.status)?v.status:'draft'};
}
export function loadPreferences(storage){try{return normalizePreferences(JSON.parse(storage.getItem(PREFERENCES_KEY)));}catch{return defaultPreferences();}}
export function savePreferences(storage,value){try{storage.setItem(PREFERENCES_KEY,JSON.stringify(normalizePreferences(value)));return true;}catch{return false;}}
export function toggleTool(selected,tool){if(tool==='None yet')return selected.includes(tool)?[]:[tool];const rest=selected.filter(x=>x!=='None yet');return rest.includes(tool)?rest.filter(x=>x!==tool):[...rest,tool];}
export function validateStep(p,step){return [p.aesthetics.length?'':'Choose at least one aesthetic.',SKILLS.includes(p.skill)?'':'Choose your sewing experience.',p.tools.length?'':'Choose your tools, or select “None yet”.',WORLDS.some(w=>w.id===p.world)?'':'Choose a world.'][step];}
// Explicit aesthetic matches dominate; exact skill then easier projects follow.
// Original catalog position is the stable tie-breaker. No random or inferred tags.
export function rankProjects(projects,preferences){
  const p=normalizePreferences(preferences),level=SKILLS.indexOf(p.skill);
  const score=project=>(p.aesthetics.includes(project.aesthetic)?100:0)+(level<0?0:SKILLS.indexOf(project.difficulty)===level?30:SKILLS.indexOf(project.difficulty)<level?15:0);
  return projects.map((project,index)=>({project,index,score:score(project)})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.project);
}

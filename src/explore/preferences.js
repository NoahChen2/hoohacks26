export const PREFERENCES_KEY='rethread.preferences.v1';
export const AESTHETICS=['Streetwear','Y2K','Vintage','Minimalist','Cottagecore','Coquette','Alternative','Bohemian'];
export const SKILLS=['Beginner','Intermediate','Advanced'];
export const TOOLS=['Needle and thread','Sewing machine','Fabric scissors','Iron','Measuring tape','None yet'];
export const WORLDS=[
  {id:'cultivation',name:'Chinese Cultivation',description:'Jade pavilions above a sea of clouds, gold-leaf light, and a path of patient craft.',rank:'Outer Disciple',symbol:'梅',colors:['#1d6157','#f3eee3']},
  {id:'fairy',name:'Fairy Garden',description:'A twilight garden party beneath the old trees — firefly gold, moss and lavender.',rank:'Seedling Stitcher',symbol:'❦',colors:['#0a110d','#e9c97a']},
  {id:'fantasy',name:'Fantasy RPG',description:'Take your place in a candlelit great hall — velvet, gold, and your next creation laid out on the banquet table.',rank:'Crafting Apprentice',symbol:'⚜',colors:['#1c1121','#d4b26a']},
  {id:'runway',name:'Fashion Runway',description:'A couture show in a gilded hall of mirrors: ivory, black and champagne gold.',rank:'Emerging Designer',symbol:'✧',colors:['#15120e','#e9dcc0']},
  {id:'cyberpunk',name:'Cyberpunk',description:'Black glass, chrome and neon — tech-couture reworks for the megacity after dark.',rank:'Thread Runner',symbol:'⌘',colors:['#050608','#3ef2e0']},
  {id:'space',name:'Outer Space',description:'A private observatory lounge beneath Andromeda — midnight glass, platinum and champagne.',rank:'Star Cadet',symbol:'✧',colors:['#07080c','#e2cd9c']},
  {id:'furry',name:'Furry Academy',description:'Ink-and-watercolour beasts, pressed blazers, and bold editorial type.',rank:'Fresh Cub',symbol:'❦',colors:['#b5122b','#f1eadc']},
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

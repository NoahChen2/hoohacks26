import {ProjectSchema} from '../studio/schema.js';
export const GENERATED_PREFIX='rethread.tutorial.generated.v1.';
export const PROGRESS_PREFIX='rethread.tutorial.progress.v1.';
export const COMPLETION_PREFIX='rethread.tutorial.completion.v1.';
export const COMPLETION_REWARD=Object.freeze({xp:100,currency:40});
const validId=id=>typeof id==='string'&&/^[a-z0-9-]{1,100}$/.test(id);
function parse(storage,key){const value=storage.getItem(key);return value===null?null:JSON.parse(value);}
function write(storage,key,value){try{storage.setItem(key,JSON.stringify(value));}catch{throw Error('Browser storage is unavailable or full. Your change was not saved.');}}
function entries(storage,prefix){const values=[];try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix))try{const value=parse(storage,key);if(value)values.push({key,value});}catch{/* Ignore a damaged entry, preserving it on disk. */}}}catch{/* Read-only empty fallback. */}return values;}
const keyFor=(prefix,id)=>{if(!validId(id))throw Error('Invalid project identifier.');return prefix+id;};
export async function saveGeneratedProject(storage,project,{mode='live',warnings=[],garmentId=null}={}){
 const payload=ProjectSchema.parse(project),source=mode==='demo'?'demo':'live';
 // Content-addressed IDs prevent saving the same idea repeatedly to farm rewards.
 const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
 const id='ai-'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const key=keyFor(GENERATED_PREFIX,id);let existing;
 try{existing=parse(storage,key);}catch{throw Error('This saved project could not be read. Existing data was left untouched.');}
 if(existing)return id;
 write(storage,key,{version:1,id,project:payload,mode:source,warnings:warnings.filter(x=>typeof x==='string').slice(0,15),garmentId:validId(garmentId)?garmentId:id,savedAt:new Date().toISOString()});return id;
}
export function loadGeneratedProjects(storage){
 return entries(storage,GENERATED_PREFIX).flatMap(({key,value:v})=>{const result=ProjectSchema.safeParse(v.project);return v.version===1&&validId(v.id)&&key===GENERATED_PREFIX+v.id&&['demo','live'].includes(v.mode)&&result.success?[{...v,project:result.data,warnings:Array.isArray(v.warnings)?v.warnings.filter(x=>typeof x==='string').slice(0,15):[]}]:[];});
}
export function loadProgress(storage,project){
 let raw={};try{raw=parse(storage,keyFor(PROGRESS_PREFIX,project.id))||{};}catch{/* Preserve unreadable snapshot until explicit edit. */}
 const indices=(value,length)=>Array.isArray(value)?[...new Set(value.filter(i=>Number.isInteger(i)&&i>=0&&i<length))]:[];
 return {version:1,materials:indices(raw.materials,project.materials.length),tools:indices(raw.tools,project.tools.length),steps:indices(raw.steps,project.steps.length)};
}
export function saveProgress(storage,project,progress){write(storage,keyFor(PROGRESS_PREFIX,project.id),{...progress,version:1,updatedAt:new Date().toISOString()});}
export function loadCompletion(storage,id){try{const value=parse(storage,keyFor(COMPLETION_PREFIX,id));return value?.projectId===id&&value?.version===1?value:null;}catch{return null;}}
// Reusable reward boundary: one immutable completion key per project, not an
// incremented wallet. Repeated or concurrent writes cannot multiply totals.
export function awardProjectCompletion(storage,project,{now=new Date().toISOString()}={}){
 const key=keyFor(COMPLETION_PREFIX,project.id);let existing;
 try{existing=parse(storage,key);}catch{throw Error('The completion record could not be read. No reward was changed.');}
 if(existing){if(existing.version!==1||existing.projectId!==project.id||existing.xp!==100||existing.currency!==40)throw Error('The existing completion record is invalid. It was left untouched.');return {awarded:false,record:existing,totals:getRewardSummary(storage)};}
 const progress=loadProgress(storage,project);
 if(!project.steps.length||progress.steps.length!==project.steps.length)throw Error('Finish every tutorial step before completing the project.');
 const record={version:1,projectId:project.id,title:project.title,completedAt:now,xp:COMPLETION_REWARD.xp,currency:COMPLETION_REWARD.currency,reuse:{garmentId:validId(project.garmentId)?project.garmentId:project.id,count:1,basis:'User-confirmed garment reuse'},source:project.source||'seeded'};
 write(storage,key,record);return {awarded:true,record,totals:getRewardSummary(storage)};
}
export function getRewardSummary(storage){
 const completions=entries(storage,COMPLETION_PREFIX).filter(({key,value:v})=>v.version===1&&validId(v.projectId)&&key===COMPLETION_PREFIX+v.projectId&&v.xp===100&&v.currency===40&&v.reuse?.count===1).map(x=>x.value);
 return {xp:completions.length*100,currency:completions.length*40,completedProjects:completions.length,garmentsReused:new Set(completions.map(c=>c.reuse.garmentId)).size,completions};
}

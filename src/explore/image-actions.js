import {escape} from './ui.js';
export function imageActionOverlay(project){
  return `<button type="button" class="image-focus-access" data-image-menu="${project.id}" aria-haspopup="dialog" aria-expanded="false" aria-label="Image actions for ${escape(project.title)}">Image actions</button>`;
}
// Only same-origin, canonical, real catalog paths are shared; feed filters never leak.
export function canonicalProjectUrl(project,origin){return new URL(`/project/${encodeURIComponent(project.id)}`,origin).href;}
export async function shareProject(project,environment){
  const url=canonicalProjectUrl(project,environment.origin);
  if(environment.share){
    try{await environment.share({title:project.title,text:project.description,url});return 'shared';}
    catch(error){if(error?.name==='AbortError')return 'cancelled';/* Fall back to copying when native sharing fails. */}
  }
  if(!environment.writeText)throw new Error('Sharing is unavailable. Copy the project address from your browser.');
  try{await environment.writeText(url);return 'copied';}catch{throw new Error('Could not copy the link. Copy the project address from your browser.');}
}

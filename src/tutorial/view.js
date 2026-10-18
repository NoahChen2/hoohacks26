import './style.css';
import {escape,icon} from '../explore/ui.js';
import {loadProgress,saveProgress,loadCompletion,awardProjectCompletion,getRewardSummary} from './store.js';
import {validateUpload} from '../studio/schema.js';
import {photoOperation} from './photos.js';
const lists=(progress,kind,items,completed)=>`<ul class="tutorial-checklist">${items.map((item,i)=>`<li><label><input type="checkbox" data-tutorial-check="${kind}" data-index="${i}" ${progress[kind].includes(i)?'checked':''} ${completed?'disabled':''} /><span>${escape(item)}</span></label></li>`).join('')}</ul>`;
export function tutorialMarkup(project,storage){
 const progress=loadProgress(storage,project),completion=loadCompletion(storage,project.id);
 return `<section class="guided-tutorial" data-tutorial-root aria-label="Guided tutorial"><div class="tutorial-progress"><div><strong>Your making progress</strong><span data-progress-text></span></div><progress max="${project.steps.length}" value="${progress.steps.length}" aria-label="Tutorial steps completed"></progress><p data-tutorial-save role="status">Progress saves in this browser.</p></div><section class="detail-section"><h2>Materials checklist</h2>${lists(progress,'materials',project.materials,completion)}</section><section class="detail-section"><h2>Required tools</h2>${lists(progress,'tools',project.tools,completion)}</section><section class="detail-section"><h2>Make it, one step at a time</h2><p class="tutorial-help">Check off each step when you’ve done it. Supplies can be checked as you gather them.</p><ol class="tutorial-steps">${project.steps.map((step,i)=>`<li><label><input type="checkbox" data-tutorial-check="steps" data-index="${i}" ${progress.steps.includes(i)?'checked':''} ${completion?'disabled':''}/><span><small>STEP ${i+1}</small>${escape(step)}</span></label></li>`).join('')}</ol></section><aside class="tutorial-safety"><h2>Before you begin</h2><ul>${project.safetyNotes.map(note=>`<li>${escape(note)}</li>`).join('')}</ul></aside><section class="tutorial-photos"><h2>Your before & after <small>Optional</small></h2><p>Photos stay in this browser. JPEG, PNG or WebP, up to 5 MB each. Photos are never required for rewards.</p><div>${['before','after'].map(kind=>`<div class="tutorial-photo"><label>${kind==='before'?'Before':'After'} photo<input type="file" data-tutorial-photo="${kind}" accept="image/jpeg,image/png,image/webp"/></label><img data-photo-preview="${kind}" alt="Your ${kind} photo" hidden/><button type="button" data-remove-photo="${kind}" hidden>Remove photo</button></div>`).join('')}</div><p data-photo-status role="status"></p></section><section class="tutorial-finish"><p>Finish this project to receive <strong>100 XP + 40 currency</strong>, once per project.</p><label class="tutorial-confirm"><input type="checkbox" data-confirm-reuse ${completion?'checked disabled':''}/>I finished this project and gave an existing garment a new use.</label><button type="button" data-complete-project ${completion?'disabled':''}>${completion?'Project completed ✓':'Complete Project'}</button><p data-complete-message role="status"></p><div data-reward-summary></div></section></section>`;
}
export function installTutorial(target,project,storage){
 const root=target.querySelector('[data-tutorial-root]');if(!root)return ()=>{};
 const objectUrls=new Map();let alive=true,progress=loadProgress(storage,project);
 const message=root.querySelector('[data-tutorial-save]');
 function update(){
  const done=loadCompletion(storage,project.id),count=progress.steps.length,summary=getRewardSummary(storage);
  root.querySelector('[data-progress-text]').textContent=`${count} of ${project.steps.length} steps · ${Math.round(count/project.steps.length*100)}%`;
  root.querySelector('progress').value=count;
  const button=root.querySelector('[data-complete-project]');button.disabled=!!done||count!==project.steps.length||!root.querySelector('[data-confirm-reuse]').checked;button.textContent=done?'Project completed ✓':'Complete Project';
  root.querySelector('[data-reward-summary]').textContent=`${summary.xp} XP · ${summary.currency} currency · ${summary.completedProjects} completed projects · ${summary.garmentsReused} garments reused`;
  if(done){root.querySelectorAll('[data-tutorial-check],[data-confirm-reuse]').forEach(el=>el.disabled=true);root.querySelector('[data-complete-message]').textContent='Completed and recorded. Your rewards have already been awarded.';}
 }
 root.addEventListener('change',event=>{
  const input=event.target;if(input.matches('[data-confirm-reuse]')){update();return;}if(!input.matches('[data-tutorial-check]'))return;
  const kind=input.dataset.tutorialCheck,index=Number(input.dataset.index);const next={...progress,[kind]:input.checked?[...new Set([...progress[kind],index])]:progress[kind].filter(i=>i!==index)};
  try{saveProgress(storage,project,next);progress=next;message.textContent='Progress saved.';}catch(error){input.checked=!input.checked;message.textContent=error.message;}update();
 });
 function setPhoto(kind,blob){if(!alive)return;const old=objectUrls.get(kind);if(old)URL.revokeObjectURL(old);objectUrls.delete(kind);const img=root.querySelector(`[data-photo-preview="${kind}"]`),remove=root.querySelector(`[data-remove-photo="${kind}"]`);img.hidden=!blob;remove.hidden=!blob;if(blob){const url=URL.createObjectURL(blob);objectUrls.set(kind,url);img.src=url;}else img.removeAttribute('src');}
 const photoStatus=root.querySelector('[data-photo-status]');
 for(const kind of ['before','after'])photoOperation(project.id,kind,'get').then(blob=>setPhoto(kind,blob)).catch(error=>{if(alive)photoStatus.textContent=error.message;});
 root.addEventListener('change',async event=>{
  const input=event.target;if(!input.matches('[data-tutorial-photo]'))return;const file=input.files?.[0];if(!file)return;const problem=validateUpload(file);if(problem){photoStatus.textContent=problem;input.value='';return;}
  const kind=input.dataset.tutorialPhoto;input.disabled=true;const url=URL.createObjectURL(file);
  try{const probe=new Image();probe.src=url;await probe.decode();await photoOperation(project.id,kind,'put',file);setPhoto(kind,file);if(alive)photoStatus.textContent='Photo saved locally.';}
  catch(error){if(alive)photoStatus.textContent=error.message;}finally{URL.revokeObjectURL(url);input.disabled=false;input.value='';}
 });
 root.addEventListener('click',async event=>{
  const remove=event.target.closest('[data-remove-photo]');if(remove){remove.disabled=true;try{await photoOperation(project.id,remove.dataset.removePhoto,'delete');setPhoto(remove.dataset.removePhoto,null);photoStatus.textContent='Photo removed.';}catch(error){photoStatus.textContent=error.message;}finally{remove.disabled=false;}return;}
  const button=event.target.closest('[data-complete-project]');if(!button||button.disabled)return;
  try{const result=awardProjectCompletion(storage,project);update();if(result.awarded)celebrate(project,result.totals,button);}catch(error){root.querySelector('[data-complete-message]').textContent=error.message;}
 });
 function sync(event){if(event.key===null||event.key?.startsWith('rethread.tutorial.')){progress=loadProgress(storage,project);for(const input of root.querySelectorAll('[data-tutorial-check]'))input.checked=progress[input.dataset.tutorialCheck].includes(Number(input.dataset.index));update();}}
 window.addEventListener('storage',sync);update();
 return ()=>{alive=false;window.removeEventListener('storage',sync);for(const url of objectUrls.values())URL.revokeObjectURL(url);};
}
function celebrate(project,summary,returning){
 const dialog=document.createElement('dialog');dialog.className='tutorial-celebration';dialog.setAttribute('aria-labelledby','celebration-title');dialog.innerHTML=`<div class="celebration-spark" aria-hidden="true">${icon('spark')}</div><p class="eyebrow">A SECOND LIFE, MADE BY YOU</p><h2 id="celebration-title">You made it!</h2><p>${escape(project.title)}</p><strong>+100 XP &nbsp; +40 currency</strong><p>One project complete. One garment given a new use.</p><small>${summary.completedProjects} completed projects · ${summary.garmentsReused} unique garments reused</small><button type="button">Keep creating →</button>`;document.body.append(dialog);dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{dialog.remove();returning.focus({preventScroll:true});});dialog.showModal();
}
export function tutorialShelf(projects,storage){
 const summary=getRewardSummary(storage),generated=projects.filter(p=>p.source==='ai'||p.source==='ai-demo');
 return `<section class="tutorial-shelf"><h2>Your making journey</h2><div class="tutorial-totals"><span><strong>${summary.xp}</strong> XP</span><span><strong>${summary.currency}</strong> currency</span><span><strong>${summary.completedProjects}</strong> projects completed</span><span><strong>${summary.completedLessons}</strong> lessons completed</span><span><strong>${summary.garmentsReused}</strong> garments reused</span></div><p class="tutorial-help">Reuse is based on your completion confirmations. No water, carbon, or waste savings are estimated.</p>${summary.completions.length?`<h3>Completed projects</h3><ul>${summary.completions.map(c=>`<li><a href="/project/${c.projectId}">${escape(c.title)}</a> ✓</li>`).join('')}</ul>`:''}<h3>Saved AI tutorials</h3>${generated.length?`<ul>${generated.map(p=>`<li><a href="/project/${p.id}">${escape(p.title)}</a> <small>${p.source==='ai-demo'?'Demo example':'AI-generated'}</small></li>`).join('')}</ul>`:'<p>Save an idea from <a href="/studio">AI Studio</a> to start a tutorial.</p>'}</section>`;
}

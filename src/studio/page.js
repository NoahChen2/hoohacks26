import {saveGeneratedProject} from '../tutorial/store.js';
import {bodyCard,mountBodyCards,tryOnBody} from '../shell/bodyCard.js';
import {garmentSpecFromAnalysis} from '../shell/tryOn.js';
import {siteHeader,installShell} from '../shell/shell.js';
import '../explore/style.css';
import './style.css';
import {escape,icon} from '../explore/ui.js';
import {loadPreferences} from '../explore/preferences.js';
import {CONDITIONS,MATERIALS,ResultSchema,validateUpload} from './schema.js';
import {scanPhoto} from '../scan/scan.js';
import {flatSVG} from '../flats.js';
import {GARMENT_TYPES} from '../garments.js';
import {state as closet} from '../state.js';
import {queueGarments,unqueueGarments,rememberScan} from '../tryon/outfitStore.js';
let storage;try{storage=window.localStorage;}catch{storage={getItem:()=>null};}
const preferences=loadPreferences(storage);
let image=null,previewUrl=null,result=null,controller=null,revision=0;
document.title='AI Clothing Studio — ReThread';document.body.classList.add('discovery-page','ai-studio-page');
document.body.innerHTML=`${siteHeader('studio')}<main class="ai-studio"><section class="studio-intro page-with-body"><p class="eyebrow">A SECOND LIFE STARTS HERE</p><h1>Old clothes.<br/><em>New possibilities.</em></h1><p>Bring one garment. Find three ways to make it yours.</p>${bodyCard({note:'Ideas are checked against your fit',cta:'Edit my body'})}</section><div class="studio-workspace"><form id="analyze-form" class="studio-upload" novalidate><h2>Meet your next project</h2><label class="upload-area" for="garment-photo">${icon('plus')}<strong>Choose a garment photo</strong><span>JPEG, PNG or WebP · up to 5 MB</span><input id="garment-photo" type="file" accept="image/jpeg,image/png,image/webp"/></label><figure class="garment-preview" hidden><img alt="Your uploaded garment preview"/><figcaption></figcaption></figure><div class="photo-actions" hidden><button type="button" data-replace>Replace photo</button><button type="button" data-remove>Remove</button></div><section class="scan-results" aria-label="Clothes found in your photo" aria-live="polite" hidden></section><label class="studio-field">Garment condition<select name="condition" required><option value="">Select condition…</option>${CONDITIONS.map(c=>`<option>${c}</option>`).join('')}</select></label><label class="studio-field">Material, if you know it<select name="material">${MATERIALS.map(m=>`<option>${m}</option>`).join('')}</select><small>Choose a material only if you know it, ideally from the care label. A photo cannot confirm fiber composition.</small></label><aside class="studio-preferences"><strong>Made for your starting point</strong><p>${escape(preferences.skill||'Beginner (default)')} · ${escape(preferences.aesthetics.join(', ')||'Open to every aesthetic')}</p><p>Tools: ${escape(preferences.tools.join(', ')||'None specified — no-tool ideas')}</p><a href="/settings">Edit preferences ↗</a></aside><p class="studio-privacy">Choosing a photo scans it for clothes: when the server has a Gemini key, the photo is sent to Google Gemini, and on Gemini’s free tier Google may use it to improve its products. Otherwise it is scanned on your device. In live mode, clicking Analyze sends your photo and these preferences to OpenAI. ReThread does not save the photo. Without a server API key, you’ll get clearly labeled demo examples.</p><button class="studio-primary" type="submit">Analyze My Clothing ↗</button><p class="studio-status" role="status" aria-live="polite"></p><div class="studio-error" role="alert" hidden><p></p><button type="button" data-retry>Try again</button></div></form><section class="studio-results" aria-label="Analysis results" aria-busy="false"><div class="studio-placeholder">${icon('spark')}<p class="eyebrow">IMAGINE THE POSSIBILITIES</p><h2>A little inspiration.<br/>A lot of potential.</h2><p>Your garment summary and three personalized ideas will appear here.</p><img src="/explore/ribbon-cardigan.svg" alt="Illustrated cardigan with a decorative upcycling detail" width="240" height="280"/></div></section></div></main><dialog class="studio-project-dialog" aria-labelledby="studio-project-title"></dialog>`;
installShell();
mountBodyCards();
const form=document.querySelector('#analyze-form'),input=document.querySelector('#garment-photo'),preview=document.querySelector('.garment-preview'),photoActions=document.querySelector('.photo-actions'),results=document.querySelector('.studio-results'),status=document.querySelector('.studio-status'),errorBox=document.querySelector('.studio-error'),submit=form.querySelector('[type=submit]'),dialog=document.querySelector('dialog');
function setError(message){errorBox.hidden=!message;errorBox.querySelector('p').textContent=message;}
function busy(value){results.setAttribute('aria-busy',String(value));submit.disabled=value;submit.textContent=value?'Finding possibilities…':'Analyze My Clothing ↗';status.textContent=value?'Preparing your garment summary and three ideas. This may take up to a minute.':'';}
function resetAnalysis(){revision++;controller?.abort();controller=null;result=null;busy(false);setError('');results.innerHTML='<div class="studio-placeholder"><h2>Ready for a fresh look.</h2><p>Analyze your clothing to see three ideas.</p></div>';}
// Photo scan: every garment in the photo becomes a closet piece, dressed on the 3D body.
const scanBox=document.querySelector('.scan-results');let scan=null,scanController=null;
async function runScan(file){
 scanController?.abort();const controller=new AbortController();scanController=controller;scan=null;
 scanBox.hidden=false;scanBox.innerHTML='<p class="scan-status">Scanning your photo for clothes…</p>';
 try{
  const found=await scanPhoto(file,{body:closet.body,signal:controller.signal});if(scanController!==controller)return;
  scan={...found,kept:new Set(found.garments.map(g=>g.id))};renderScan();
  if(found.garments.length){queueGarments(found.garments);rememberScan(garmentId,found.garments);tryOnBody(found.garments);}
 }catch(error){if(scanController===controller&&error.name!=='AbortError')scanBox.innerHTML=`<p class="scan-status">${escape(error.message)}</p>`;}
}
function renderScan(){
 const n=scan.garments.length;
 if(!n){scanBox.innerHTML=`<h3>No clothes spotted</h3><p class="scan-notice">${escape(scan.notice)}</p>`;return;}
 scanBox.innerHTML=`<p class="eyebrow">${scan.mode==='live'?'AI SCAN':'ON-DEVICE SCAN'}</p><h3>${n} ${n===1?'piece':'pieces'} spotted · added to your closet</h3><p class="scan-notice">${escape(scan.notice)}</p><ul class="scan-pieces">${scan.garments.map(g=>`<li><span class="scan-flat">${flatSVG(g,{width:88,pad:6})}</span><span class="scan-copy"><strong>${escape(g.name)}</strong><small>${escape(GARMENT_TYPES[g.type].label)}</small><label><input type="checkbox" data-scan-keep="${g.id}" ${scan.kept.has(g.id)?'checked':''}/> Keep in my closet</label></span></li>`).join('')}</ul><div class="scan-actions"><button type="button" data-scan-wear>Show on my 3D body</button><a href="/fitting#/closet">Open in Fitting Room ↗</a></div>`;
}
function clearScan({withdraw=false}={}){scanController?.abort();scanController=null;if(withdraw&&scan)unqueueGarments([...scan.kept]);scan=null;scanBox.hidden=true;scanBox.innerHTML='';}
scanBox.addEventListener('change',event=>{
 const box=event.target.closest('[data-scan-keep]');if(!box||!scan)return;const g=scan.garments.find(item=>item.id===box.dataset.scanKeep);if(!g)return;
 if(box.checked){scan.kept.add(g.id);queueGarments([g]);}else{scan.kept.delete(g.id);unqueueGarments([g.id]);}
});
scanBox.addEventListener('click',event=>{if(event.target.closest('[data-scan-wear]')&&scan)tryOnBody(scan.garments);});
function removeImage(){clearScan({withdraw:true});resetAnalysis();image=null;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;preview.hidden=true;preview.querySelector('img').removeAttribute('src');photoActions.hidden=true;input.value='';}
input.addEventListener('change',async()=>{
 const file=input.files?.[0];if(!file)return;const issue=validateUpload(file);if(issue){input.value='';setError(issue);return;}
 resetAnalysis();const current=revision,url=URL.createObjectURL(file),probe=new Image();
 try{probe.src=url;await probe.decode();if(current!==revision){URL.revokeObjectURL(url);return;}if(previewUrl)URL.revokeObjectURL(previewUrl);image=file;garmentId='garment-'+window.crypto.randomUUID();previewUrl=url;preview.querySelector('img').src=url;preview.querySelector('figcaption').textContent=`${file.name} · ${(file.size/1024/1024).toFixed(2)} MB`;preview.hidden=false;photoActions.hidden=false;clearScan({withdraw:true});runScan(file);}
 catch{URL.revokeObjectURL(url);input.value='';setError('This photo could not be opened. Choose another image.');}
});
document.querySelector('[data-replace]').addEventListener('click',()=>input.click());document.querySelector('[data-remove]').addEventListener('click',removeImage);
form.querySelectorAll('select').forEach(select=>select.addEventListener('change',resetAnalysis));
const readImage=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The photo could not be read. Try replacing it.'));reader.readAsDataURL(file);});
const list=items=>`<ul>${items.map(item=>`<li>${escape(item)}</li>`).join('')}</ul>`;
function renderResults(){
 const a=result.analysis;
 results.innerHTML=`<div class="analysis-notice ${result.mode}" role="status"><strong>${result.mode==='demo'?'DEMO MODE · EXAMPLE RESULTS':'AI-ASSISTED ANALYSIS'}</strong><p>${escape(result.notice)}</p></div><h2>Your garment, a starting point</h2><button type="button" class="try-on-button" data-try-on-analysis>Try it on my 3D body</button><dl class="garment-summary"><div><dt>Garment type</dt><dd>${escape(a.garmentType)}</dd></div><div><dt>Visible colors</dt><dd>${escape(a.visibleColors.join(', ')||'Not assessed in demo mode')}</dd></div><div><dt>Estimated fabric</dt><dd>${escape(a.estimatedFabric)}<small>Confidence: ${escape(a.fabricConfidence)} · Estimate, not identification</small></dd></div><div><dt>Visible condition</dt><dd>${escape(a.visibleCondition)}</dd></div></dl><aside class="analysis-warnings"><strong>Before you start</strong>${list(a.warnings)}</aside><h2>Three possibilities, just for you</h2><div class="studio-ideas">${a.projects.map((p,i)=>`<article><div class="idea-number">0${i+1}</div><div class="idea-copy"><span class="idea-meta">${escape(p.difficulty)} · ${escape(p.estimatedTime)}</span><h3>${escape(p.title)}</h3><p>${escape(p.description)}</p><div class="idea-tags">${p.aestheticTags.map(t=>`<span>${escape(t)}</span>`).join('')}</div><button type="button" data-project="${i}">View project →</button></div></article>`).join('')}</div>`;
}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(controller)return;
 const issue=validateUpload(image);if(issue){setError(issue);return;}if(!form.reportValidity())return;
 const current=revision;controller=new AbortController();const signal=controller.signal;setError('');busy(true);results.innerHTML='<div class="studio-loading"><span aria-hidden="true"></span><h2>A new chapter is taking shape.</h2><p>Gathering a garment summary and three ideas for your preferences…</p></div>';
 const timer=window.setTimeout(()=>controller?.abort(),75000);
 try{
  const imageDataUrl=await readImage(image);if(current!==revision)return;
  const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageDataUrl,condition:form.elements.condition.value,material:form.elements.material.value,preferences:{aesthetics:preferences.aesthetics,skill:preferences.skill,tools:preferences.tools}}),signal});
  const body=await response.json().catch(()=>{throw Error('The analysis endpoint is unavailable. Start the ReThread server and retry.');});
  if(!response.ok)throw Error(body.error||'Analysis failed. Please retry.');
  if(current!==revision)return;result=ResultSchema.parse(body);renderResults();status.textContent=result.mode==='demo'?'Demo examples ready. Your photo was not analyzed.':'Your analysis and three ideas are ready.';
 }catch(error){if(current!==revision)return;setError(error.name==='AbortError'?'Analysis timed out. Please try again.':error.message?.startsWith('[')?'The server returned incomplete results. Please retry.':error.message);results.innerHTML='<div class="studio-placeholder"><h2>Let’s give that another try.</h2><p>Your photo is still here. Use Try again to retry.</p></div>';}
 finally{window.clearTimeout(timer);if(current===revision){controller=null;submit.disabled=false;submit.textContent='Analyze My Clothing ↗';results.setAttribute('aria-busy','false');if(!result)status.textContent='';}}
});
document.querySelector('[data-retry]').addEventListener('click',()=>form.requestSubmit());
let returning=null,selectedProject=null,garmentId='garment-'+window.crypto.randomUUID();
results.addEventListener('click',event=>{
 if(event.target.closest('[data-try-on-analysis]')&&result){tryOnBody(scan?.garments.length?scan.garments:garmentSpecFromAnalysis(result.analysis));return;}
 const button=event.target.closest('[data-project]');if(!button||!result)return;const p=result.analysis.projects[Number(button.dataset.project)];returning=button;selectedProject=p;
 dialog.innerHTML=`<button class="studio-dialog-close" type="button" aria-label="Close project details">${icon('close')}</button><p class="eyebrow">${result.mode==='demo'?'DEMO EXAMPLE · NOT PHOTO-ANALYZED':'YOUR UPCYCLING IDEA'}</p><h2 id="studio-project-title">${escape(p.title)}</h2><p>${escape(p.description)}</p><p class="idea-meta">${escape(p.difficulty)} · ${escape(p.estimatedTime)}</p><h3>Tools</h3>${list(p.tools)}<h3>Materials</h3>${list(p.materials)}<h3>Make it yours</h3><ol>${p.instructions.map(step=>`<li>${escape(step)}</li>`).join('')}</ol><aside class="analysis-warnings"><h3>Safety notes</h3>${list(p.safetyNotes)}</aside><p class="studio-tutorial-note">Save this idea locally to track your steps and finish it later from Saved. The uploaded photo is not stored.</p><button class="studio-primary" type="button" data-save-tutorial>Save & open tutorial →</button><p data-tutorial-error role="alert"></p><button type="button" data-close-project>Back to ideas</button>`;
 dialog.showModal();dialog.querySelector('button').focus();
});
dialog.addEventListener('click',async event=>{
 const save=event.target.closest('[data-save-tutorial]');
 if(save&&selectedProject&&result){save.disabled=true;try{const id=await saveGeneratedProject(storage,selectedProject,{mode:result.mode,warnings:result.analysis.warnings,garmentId});location.assign(`/project/${id}`);}catch(error){dialog.querySelector('[data-tutorial-error]').textContent=error.message;save.disabled=false;}return;}
if(event.target.closest('.studio-dialog-close,[data-close-project]')||event.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>returning?.focus({preventScroll:true}));
window.addEventListener('pagehide',()=>{controller?.abort();if(previewUrl)URL.revokeObjectURL(previewUrl);});

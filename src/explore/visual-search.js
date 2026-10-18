import {escape,icon} from './ui.js';
import {selectionFromPoints,moveSelection,resizeSelection,pixelCrop} from './crop-geometry.js';
import {catalogImageIndex,describeCrop,rankImages} from './image-similarity.js';

export function createVisualSearch({projects,onAction,getState}){
  const dialog=document.createElement('dialog');dialog.className='visual-search-dialog';dialog.setAttribute('aria-labelledby','visual-search-title');document.body.appendChild(dialog);
  let project=null,trigger=null,selection=null,drag=null,crop=null,descriptor=null,revision=0,scrollPosition=0;
  const filters={style:false,kind:false,beginner:false,savedOnly:false};
  function draw(){
    const box=dialog.querySelector('.crop-selection');if(!box)return;
    Object.assign(box.style,{left:`${selection.x*100}%`,top:`${selection.y*100}%`,width:`${selection.width*100}%`,height:`${selection.height*100}%`});
    dialog.querySelector('[data-search-crop]').disabled=selection.width<.03||selection.height<.03;
  }
  function point(event){const r=dialog.querySelector('.visual-crop-stage').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))};}
  function close(){revision++;dialog.close();document.body.classList.remove('visual-search-open');return trigger;}
  function controls(){return `<div class="search-filters" role="group" aria-label="Image match filters">${[['style','Similar style'],['kind','Same clothing type'],['beginner','Beginner-friendly'],['savedOnly','Saved projects']].map(([key,label])=>`<button type="button" data-search-filter="${key}" aria-pressed="${filters[key]}" class="${filters[key]?'active':''}">${label}</button>`).join('')}</div>`;}
  async function results(){
    const token=++revision,slot=dialog.querySelector('.visual-search-results');
    slot.innerHTML='<p role="status" class="image-match-status">Matching images in the project catalog…</p>';
    try{
      const index=await catalogImageIndex(projects);if(token!==revision||!dialog.open)return;
      const matches=rankImages(descriptor,index,{sourceId:project.id,style:filters.style?project.aesthetic:null,kind:filters.kind?project.kind:null,beginner:filters.beginner,savedOnly:filters.savedOnly,saved:getState().saved});
      slot.innerHTML=matches.length?`<div class="image-match-grid">${matches.map(({project:p})=>`<article class="image-match-card"><a href="/project/${p.id}"><img src="${p.cover}" alt="" width="400" height="${p.height}"/><h3>${escape(p.title)}</h3></a><p><img src="${p.avatar}" alt=""/>@${p.username}</p><div><span>${p.difficulty}</span><button type="button" data-board-project="${p.id}" aria-label="Save ${escape(p.title)} to board">${icon('save')} Save</button></div></article>`).join('')}</div>`:'<div class="feed-empty"><h3>No matches with these filters.</h3><p>Try a wider selection or clear a filter.</p><a class="primary-link" href="/explore">Explore all projects ↗</a></div>';
    }catch{if(token===revision)slot.innerHTML='<p role="alert">Image matching could not load. Check the local project images, or try again.</p>';}
  }
  async function search(){
    const token=revision,id=project.id,image=dialog.querySelector('.visual-crop-stage img');await image.decode();
    if(token!==revision||!dialog.open||project.id!==id)return;
    const source=pixelCrop(selection,image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');
    const scale=Math.min(1,640/Math.max(source.width,source.height));canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
    canvas.getContext('2d').drawImage(image,source.x,source.y,source.width,source.height,0,0,canvas.width,canvas.height);
    descriptor=describeCrop(canvas);crop=canvas.toDataURL('image/png');
    dialog.querySelector('.visual-crop-editor').hidden=true;
    dialog.querySelector('.visual-results-panel').innerHTML=`<div class="crop-result-intro"><img src="${crop}" alt="Your selected image crop"/><p>Local image matching uses color and edges.<br/>It is approximate and does not recognize garment shapes with AI.</p><button type="button" data-edit-selection>Edit selection</button></div>${controls()}<div class="visual-search-results"></div>`;
    dialog.querySelector('.visual-results-panel').hidden=false;await results();
  }
  dialog.addEventListener('pointerdown',event=>{
    const stage=event.target.closest('.visual-crop-stage');if(!stage||!event.isPrimary||event.button!==0)return;
    event.preventDefault();const p=point(event),corner=event.target.closest('[data-crop-corner]')?.dataset.cropCorner;
    drag={id:event.pointerId,start:p,selection:{...selection},mode:corner?'resize':event.target.closest('.crop-selection')?'move':'draw',corner};stage.setPointerCapture(event.pointerId);
    if(drag.mode==='draw'){selection=selectionFromPoints(p,p);draw();}
  });
  dialog.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const p=point(event);selection=drag.mode==='move'?moveSelection(drag.selection,p.x-drag.start.x,p.y-drag.start.y):drag.mode==='resize'?resizeSelection(drag.selection,drag.corner,p):selectionFromPoints(drag.start,p);draw();});
  dialog.addEventListener('pointerup',()=>{drag=null;});dialog.addEventListener('pointercancel',()=>{drag=null;});
  dialog.addEventListener('click',event=>{
    event.stopPropagation();const button=event.target.closest('button');
    if(event.target===dialog||button?.hasAttribute('data-close-search')){close();return;}
    if(!button)return;
    if(button.hasAttribute('data-reset-crop')){selection={x:.15,y:.15,width:.7,height:.7};draw();return;}
    if(button.hasAttribute('data-search-crop')){search().catch(()=>{dialog.querySelector('.crop-search-error').textContent='Could not read the image crop. Please try again.';});return;}
    if(button.hasAttribute('data-edit-selection')){revision++;dialog.querySelector('.visual-results-panel').hidden=true;dialog.querySelector('.visual-crop-editor').hidden=false;return;}
    if(button.dataset.searchFilter){filters[button.dataset.searchFilter]=!filters[button.dataset.searchFilter];button.classList.toggle('active');button.setAttribute('aria-pressed',String(filters[button.dataset.searchFilter]));results();return;}
    onAction(event);
  });
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.target.closest('.crop-selection')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();const dx=event.key==='ArrowLeft'?-.01:event.key==='ArrowRight'?.01:0,dy=event.key==='ArrowUp'?-.01:event.key==='ArrowDown'?.01:0;
      const corner=event.target.dataset.cropCorner||(event.shiftKey?'se':null);
      selection=corner?resizeSelection(selection,corner,{x:selection.x+(corner.includes('w')?0:selection.width)+dx,y:selection.y+(corner.includes('n')?0:selection.height)+dy}):moveSelection(selection,dx,dy);draw();
    }
    if(event.key==='Tab'){const items=[...dialog.querySelectorAll('button:not([disabled]),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  });
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{if(!document.querySelector('.board-dialog[open]')){(trigger?.isConnected?trigger:document.querySelector(`[data-image-menu="${project?.id}"]`))?.focus({preventScroll:true});window.scrollTo(0,scrollPosition);}});
  return {get isOpen(){return dialog.open;},close,open(p,from){
    project=p;trigger=from;scrollPosition=window.scrollY;revision++;selection={x:.15,y:.15,width:.7,height:.7};Object.keys(filters).forEach(key=>{filters[key]=false;});
    dialog.innerHTML=`<header><div><p class="eyebrow">YOUR CATALOG, RECONNECTED</p><h2 id="visual-search-title">Find Similar Upcycles</h2></div><button type="button" data-close-search aria-label="Close visual search">${icon('close')}</button></header><section class="visual-crop-editor"><p>Drag to select what inspires you. Move the box or resize its corners.</p><div class="visual-crop-stage"><img src="${p.cover}" alt="${escape(p.title)}" draggable="false"/><div class="crop-selection" tabindex="0" role="group" aria-label="Selected region. Arrow keys move; Shift and arrow keys resize.">${['nw','ne','sw','se'].map(corner=>`<button type="button" class="crop-handle ${corner}" data-crop-corner="${corner}" aria-label="Resize ${{nw:'top-left',ne:'top-right',sw:'bottom-left',se:'bottom-right'}[corner]} corner with arrow keys"></button>`).join('')}</div></div><div class="crop-editor-actions"><button type="button" data-reset-crop>Reset</button><button type="button" data-close-search>Cancel</button><button type="button" data-search-crop>Search selected image</button></div><p class="crop-search-error" role="alert"></p></section><section class="visual-results-panel" hidden></section>`;
    draw();document.body.classList.add('visual-search-open');dialog.showModal();
  }};
}

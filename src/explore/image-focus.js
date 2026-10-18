import {escape} from './ui.js';
import {radialActionMenu,lucideIcon} from './radial-menu.js';
import {layoutImageFocus} from './focus-layout.js';

// Hover actions use a transparent portal; click/long-press uses the native modal.
// Both modes share their layout and the page's action dispatcher.
export function createImageFocus({getState,onAction}){
  let hoverMode=false;
  const hoverLayer=document.createElement('div');hoverLayer.className='image-hover-layer';hoverLayer.hidden=true;document.body.appendChild(hoverLayer);
  const activeLayer=()=>hoverMode?hoverLayer:dialog;
  const dialog=document.createElement('dialog');dialog.className='image-focus-dialog';dialog.setAttribute('aria-labelledby','image-focus-title');document.body.appendChild(dialog);
  let activeProjectId=null,project=null,sourceImage=null,trigger=null,sourceRect=null,raf=0,closeTimer=0;
  const viewport=()=>{const v=window.visualViewport,s=window.getComputedStyle(dialog);return {left:v?.offsetLeft||0,top:v?.offsetTop||0,width:v?.width||window.innerWidth,height:v?.height||window.innerHeight,insets:Object.fromEntries(['top','bottom','left','right'].map(side=>[side,parseFloat(s.getPropertyValue(`--safe-${side}`))||0]))};};
  function sourceBounds(image){
    const rect=image.getBoundingClientRect(),aspect=image.naturalWidth/image.naturalHeight;
    if(window.getComputedStyle(image).objectFit==='contain'&&Number.isFinite(aspect)){
      const width=Math.min(rect.width,rect.height*aspect),height=width/aspect;
      return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};
    }
    return {left:rect.left,top:rect.top,width:rect.width,height:rect.height};
  }
  function position(){
    raf=0;if(!activeProjectId)return;
    if(sourceImage?.isConnected)sourceRect=sourceBounds(sourceImage);
    const layer=activeLayer(),layout=layoutImageFocus(sourceRect,viewport()),panel=layer.querySelector('.focused-image');
    if(panel)Object.assign(panel.style,{left:`${layout.image.left}px`,top:`${layout.image.top}px`,width:`${layout.image.width}px`,height:`${layout.image.height}px`});
    layer.dataset.layout=layout.mode;
    layer.querySelectorAll('[data-radial-slot]').forEach((slot,i)=>{slot.style.left=`${layout.points[i].x}px`;slot.style.top=`${layout.points[i].y}px`;slot.style.setProperty('--action-size',`${layout.button}px`);});
    if(!hoverMode)Object.assign(dialog.querySelector('.focus-close').style,{left:`${layout.close.left}px`,top:`${layout.close.top}px`});
  }
  function schedule(){if(activeProjectId&&!raf)raf=window.requestAnimationFrame(position);}
  function finish(){
    window.clearTimeout(closeTimer);window.cancelAnimationFrame(raf);raf=0;
    hoverLayer.hidden=true;hoverLayer.innerHTML='';
    if(dialog.open)dialog.close();
    document.body.classList.remove('image-focus-open');
    document.querySelectorAll('[data-image-menu][aria-expanded="true"]').forEach(el=>el.setAttribute('aria-expanded','false'));
    activeProjectId=null;
  }
  function close({immediate=false}={}){
    const previous=trigger;
    if(!activeProjectId)return previous;
    if(hoverMode||immediate||window.matchMedia('(prefers-reduced-motion: reduce)').matches)finish();
    else{dialog.classList.add('is-closing');closeTimer=window.setTimeout(finish,180);}
    return previous;
  }
  dialog.addEventListener('click',event=>{
    event.stopPropagation();
    const button=event.target.closest('button');
    if(button?.hasAttribute('data-close-focus')){close();return;}
    if(button){onAction(event);return;}
    if(!event.target.closest('.focused-image'))close();
  });
  hoverLayer.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('button'))onAction(event);});
  window.addEventListener('pointermove',event=>{
    if(!hoverMode||!activeProjectId||event.pointerType!=='mouse')return;
    const rects=[sourceImage,...hoverLayer.querySelectorAll('.radial-slot')].filter(Boolean).map(el=>el.getBoundingClientRect());
    const left=Math.min(...rects.map(r=>r.left))-24,right=Math.max(...rects.map(r=>r.right))+24,top=Math.min(...rects.map(r=>r.top))-24,bottom=Math.max(...rects.map(r=>r.bottom))+24;
    const frame=event.target.closest('.image-action-frame');
    if((frame&&frame.querySelector('[data-image-menu]')?.dataset.imageMenu!==activeProjectId)||event.clientX<left||event.clientX>right||event.clientY<top||event.clientY>bottom)close();
  },{passive:true});
  window.addEventListener('keydown',event=>{if(hoverMode&&event.key==='Escape')close();});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{
    if(dialog.open||document.querySelector('.board-dialog[open],.visual-search-dialog[open]'))return;
    const fallback=document.querySelector(`[data-image-menu="${project?.id}"]`);
    (trigger?.isConnected?trigger:fallback)?.focus({preventScroll:true});
  });
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key!=='Tab')return;
    const buttons=[...dialog.querySelectorAll('button:not([disabled])')],first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule);window.visualViewport?.addEventListener('scroll',schedule);
  return {
    get activeProjectId(){return activeProjectId;},
    open(p,button,{pointerId,hover=false}={}){
      finish();hoverMode=hover;project=p;activeProjectId=p.id;trigger=button;
      sourceImage=button.closest('.image-action-frame').querySelector('img');sourceRect=sourceBounds(sourceImage);
      if(hover){
        hoverLayer.innerHTML=`<div class="radial-action-menu" role="group" aria-label="Project image actions">${radialActionMenu(p,getState())}</div>`;
        hoverLayer.hidden=false;position();button.setAttribute('aria-expanded','true');return;
      }
      dialog.classList.remove('is-closing');dialog.classList.toggle('is-gesture',pointerId!==undefined);dialog.dataset.projectId=p.id;
      dialog.innerHTML=`<h2 class="sr-only" id="image-focus-title">Image actions: ${escape(p.title)}</h2><a class="focused-image" href="/project/${p.id}" aria-label="Open ${escape(p.title)}"><img src="${p.cover}" alt="${escape(p.title)}"/></a><div class="radial-action-menu" role="group" aria-label="Project image actions">${radialActionMenu(p,getState())}</div><button type="button" class="focus-close" data-close-focus aria-label="Close image actions">${lucideIcon('close')}</button><p class="focus-feedback" role="status" aria-live="polite"></p>`;
      document.body.classList.add('image-focus-open');dialog.showModal();position();button.setAttribute('aria-expanded','true');
      if(pointerId!==undefined||hover){dialog.tabIndex=-1;dialog.focus({preventScroll:true});if(pointerId!==undefined)try{dialog.setPointerCapture(pointerId);}catch{/* Pointer may have ended as the timer fired. */}}
      else dialog.querySelector('.radial-action').focus({preventScroll:true});
    },
    close,
    targetAt(x,y){
      if(!dialog.open)return null;
      const buttons=[...dialog.querySelectorAll('.radial-action')];
      const selected=buttons.find(button=>{const r=button.getBoundingClientRect();return Math.hypot(x-r.x-r.width/2,y-r.y-r.height/2)<=r.width/2;})||null;
      buttons.forEach(button=>button.classList.toggle('is-targeted',button===selected));
      const feedback=dialog.querySelector('.focus-feedback');
      const message=selected?`Release to ${selected.getAttribute('aria-label')}`:'Drag to an action. Release outside to cancel.';
      if(feedback.textContent!==message)feedback.textContent=message;
      return selected;
    },
    releaseAt(x,y){
      const selected=this.targetAt(x,y);
      dialog.querySelectorAll('.is-targeted').forEach(button=>button.classList.remove('is-targeted'));
      dialog.querySelector('.focus-feedback').textContent='';
      if(selected)onAction({target:selected,stopPropagation(){}});else close();
    },
    refresh(){
      if(!activeProjectId)return;
      const layer=activeLayer(),favorite=layer.querySelector('[data-kind="liked"]'),liked=getState().liked.includes(activeProjectId),saved=getState().saved.includes(activeProjectId);
      favorite.classList.toggle('is-active',liked);favorite.setAttribute('aria-pressed',String(liked));favorite.setAttribute('aria-label',liked?'Unfavorite':'Favorite');favorite.title=liked?'Unfavorite':'Favorite';favorite.querySelector('.radial-tooltip').textContent=liked?'Unfavorite':'Favorite';
      layer.querySelector('[data-board-project]').classList.toggle('is-active',saved);
      // The underlying feed can be re-rendered by favorites/storage updates.
      sourceImage=document.querySelector(`[data-image-menu="${activeProjectId}"]`)?.closest('.image-action-frame').querySelector('img')||sourceImage;
      document.querySelector(`[data-image-menu="${activeProjectId}"]`)?.setAttribute('aria-expanded','true');
    },
  };
}

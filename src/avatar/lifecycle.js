// Animation state is transient and never stored with gameplay or particle positions.
import { preparePaintedScenes } from './paintedArt.js';
const active=new Map();
let observer;
function sync() {
 const modal=document.querySelector('dialog.avatar-modal[open]');
 for(const [el,visible] of active) {
  if(!el.isConnected){observer?.unobserve(el);active.delete(el);continue;}
  el.dataset.running=String(visible&&!document.hidden&&(!modal||modal.contains(el)));
 }
}
if(typeof document!=='undefined') document.addEventListener('visibilitychange',sync);
export function observeCharacterScenes(root) {
 preparePaintedScenes(root);
 if(!observer&&typeof IntersectionObserver!=='undefined')observer=new IntersectionObserver(entries=>{for(const e of entries)active.set(e.target,e.isIntersecting);sync();},{threshold:.05});
 sync();root.querySelectorAll('.character-scene:not([data-static="true"])').forEach(el=>{active.set(el,false);el.dataset.running='false';if(observer)observer.observe(el);else{active.set(el,true);sync();}});
}
export function disposeCharacterScenes(root) {
 for(const [el]of active)if(root===el||root.contains(el)||!el.isConnected){observer?.unobserve(el);active.delete(el);}
 sync();
}

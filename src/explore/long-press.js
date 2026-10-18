// All gesture tracking uses Pointer Events. A non-passive touchmove guard only
// blocks native panning AFTER activation; it does not track a second gesture.
export function installImageLongPress(root,{onOpen,onMove,onRelease,onCancel,delay=350,threshold=10}){
  let pending=null,timer=0,active=false,suppressClickUntil=0;
  function clear(){window.clearTimeout(timer);timer=0;}
  function cancel(){clear();if(active)onCancel();pending=null;active=false;}
  window.addEventListener('pointerdown',()=>{suppressClickUntil=0;},{capture:true});
  root.addEventListener('pointerdown',event=>{
    if(!event.isPrimary){cancel();return;}
    if(event.pointerType==='mouse'||event.button!==0||event.target.closest('button'))return;
    const frame=event.target.closest('.image-action-frame');if(!frame)return;
    cancel();pending={id:event.pointerId,x:event.clientX,y:event.clientY,frame};
    timer=window.setTimeout(()=>{if(!pending)return;active=true;onOpen(frame,event.pointerId);},delay);
  });
  window.addEventListener('pointermove',event=>{
    if(!pending||event.pointerId!==pending.id)return;
    if(!active){if(Math.hypot(event.clientX-pending.x,event.clientY-pending.y)>threshold)cancel();return;}
    if(event.cancelable)event.preventDefault();onMove(event.clientX,event.clientY);
  },{passive:false,capture:true});
  window.addEventListener('pointerup',event=>{
    if(!pending||event.pointerId!==pending.id)return;
    clear();const wasActive=active;pending=null;active=false;
    if(wasActive){suppressClickUntil=window.performance.now()+500;if(event.cancelable)event.preventDefault();onRelease(event.clientX,event.clientY);}
  },{capture:true});
  window.addEventListener('pointercancel',cancel,{capture:true});window.addEventListener('blur',cancel);
  window.addEventListener('touchmove',event=>{if(active&&event.cancelable)event.preventDefault();},{passive:false,capture:true});
  root.addEventListener('contextmenu',event=>{if(pending||active)event.preventDefault();});
  document.addEventListener('contextmenu',event=>{if(active)event.preventDefault();},{capture:true});
  document.addEventListener('click',event=>{
    if(event.isTrusted&&window.performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();suppressClickUntil=0;}
  },{capture:true});
  return {cancel};
}

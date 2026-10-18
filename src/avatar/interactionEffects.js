import { setSpritePose } from './paintedArt.js';
import { PALETTES } from './effects.js';
const timers=new WeakMap();
const reactions={greet:'Good to see you.',focus:'One steady breath. One perfect stitch.',celebrate:'Look how far we’ve come.'};
export function playCharacterEmote(scene,emote='greet') {
 if(!scene||scene.dataset.static==='true')return;
 clearTimeout(timers.get(scene));scene.dataset.emote=emote;setSpritePose(scene,emote);
 const bubble=scene.querySelector('.character-reaction');if(bubble){bubble.textContent=reactions[emote]||reactions.greet;bubble.hidden=false;}
 timers.set(scene,setTimeout(()=>{if(!scene.isConnected)return;scene.dataset.emote='neutral';setSpritePose(scene);if(bubble)bubble.hidden=true;},3200));
 scene.dispatchEvent(new CustomEvent('rethread:character-emote',{bubbles:true,detail:{emote}}));
}

/** Pointer effects are transient, bounded, and independent of earned progress. */
export function installInteractionEffects(getProgress) {
 let canvas,ctx,frame=0,mist=[],bolts=[],rings=[];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const allowed=()=>{const a=getProgress().avatar;return !reduced.matches&&!document.hidden&&a.intensity!=='off'&&!a.paused;};
 const particleBudget=()=>Math.max(0,(innerWidth<700?24:60)-document.querySelectorAll('.character-scene[data-running="true"] .chi-particle').length-document.querySelectorAll('.ceremony-thread-gather span').length);
 function ensureCanvas(){
  const parent=document.querySelector('dialog.avatar-modal[open]')||document.body;
  if(!canvas){canvas=document.createElement('canvas');canvas.className='interaction-canvas';canvas.setAttribute('aria-hidden','true');ctx=canvas.getContext('2d');}
  if(canvas.parentNode!==parent)parent.append(canvas);
  const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(innerWidth*dpr)||canvas.height!==Math.round(innerHeight*dpr)){canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
 }
 function clear(){mist=[];bolts=[];rings=[];cancelAnimationFrame(frame);frame=0;if(ctx)ctx.clearRect(0,0,innerWidth,innerHeight);if(canvas){canvas.dataset.activeParticles='0';canvas.dataset.activeBolts='0';}}
 function burst(x,y){
  if(!allowed())return;ensureCanvas();const p=getProgress(),palette=PALETTES[p.theme],now=performance.now(),low=p.avatar.intensity==='low';
  const position=canvas.getBoundingClientRect();x-=position.left;y-=position.top;
  canvas.dataset.kind=p.theme==='cyber'?'lightning':'mist';
  if(p.theme==='cyber'){
   const points=Array.from({length:11},(_,i)=>({x:x+(i-5)*13+(i%2?18:-12),y:y+(i-5)*17}));
   bolts.push({points,born:now,color:palette.primary});bolts=bolts.slice(-(low?1:3));
  } else {
   for(let i=0;i<(low?4:14);i++){const angle=i*2.399;mist.push({x,y,vx:Math.cos(angle)*(12+i*1.8),vy:20+i*2,radius:14+i%4*7,born:now,color:p.theme==='runway'?'240,204,185':p.theme==='fantasy'?'193,174,235':p.theme==='garden'?'198,221,178':'183,220,209'});}
   const limit=Math.min(low?8:36,particleBudget());mist=limit?mist.slice(-limit):[];
  }
  rings.push({x,y,born:now,color:palette.primary});rings=rings.slice(-3);
  if(!frame)frame=requestAnimationFrame(draw);
 }
 function draw(now){
  if(!allowed()||!canvas?.isConnected){clear();return;}
  // A queued RAF timestamp can precede a pointer event processed in that frame.
  now=Math.max(now,performance.now());
  ctx.clearRect(0,0,innerWidth,innerHeight);ctx.globalCompositeOperation='screen';
  const limit=particleBudget();mist=limit?mist.filter(p=>now-p.born<1500).slice(-limit):[];
  for(const p of mist){const t=(now-p.born)/1500,age=(now-p.born)/1000,r=p.radius*(1+age*.85),x=p.x+p.vx*age,y=p.y-p.vy*age;const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,`rgba(${p.color},${.18*Math.sin(t*Math.PI)})`);gradient.addColorStop(.45,`rgba(${p.color},${.09*(1-t)})`);gradient.addColorStop(1,`rgba(${p.color},0)`);ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);}
  bolts=bolts.filter(b=>now-b.born<850);
  for(const b of bolts){const alpha=Math.pow(1-(now-b.born)/850,1.6);ctx.globalAlpha=alpha;ctx.shadowColor=b.color;ctx.shadowBlur=20;ctx.lineJoin='round';ctx.strokeStyle=b.color;ctx.lineWidth=4;ctx.beginPath();b.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#e5fdff';ctx.lineWidth=1.1;ctx.stroke();ctx.strokeStyle=b.color;ctx.lineWidth=1;for(const index of [3,6]){const p=b.points[index];ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+25,p.y-8);ctx.lineTo(p.x+36,p.y-32);ctx.stroke();}ctx.globalAlpha=1;}
  rings=rings.filter(r=>now-r.born<700);for(const r of rings){const t=(now-r.born)/700;ctx.globalAlpha=.26*(1-t);ctx.strokeStyle=r.color;ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(r.x,r.y,12+t*54,5+t*23,-.2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  canvas.dataset.activeParticles=String(mist.length);canvas.dataset.activeBolts=String(bolts.length);
  frame=mist.length||bolts.length||rings.length?requestAnimationFrame(draw):0;
 }
 document.addEventListener('pointerdown',e=>{if(e.button===0)burst(e.clientX,e.clientY);},{passive:true});
 document.addEventListener('rethread:character-emote',e=>{const r=e.target.getBoundingClientRect();burst(r.x+r.width*.5,r.y+r.height*.65);});
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-emote]')?.tagName==='BUTTON')return;
  const scene=e.target.closest('.character-scene:not([data-static="true"])');if(scene)playCharacterEmote(scene);
  if(e.detail===0){const r=e.target.getBoundingClientRect();burst(r.x+r.width/2,r.y+r.height/2);}
 });
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.character-scene')){e.preventDefault();playCharacterEmote(e.target);const r=e.target.getBoundingClientRect();burst(r.x+r.width/2,r.y+r.height/2);}});
 document.addEventListener('pointermove',e=>{if(!allowed()||e.pointerType==='touch')return;const scene=e.target.closest('.character-scene');if(!scene)return;const r=scene.getBoundingClientRect();scene.style.setProperty('--look-x',`${Math.max(-4,Math.min(4,(e.clientX-r.x)/r.width*8-4))}px`);},{passive:true});
 document.addEventListener('pointerout',e=>{const scene=e.target.closest('.character-scene');if(scene&&!scene.contains(e.relatedTarget))scene.style.setProperty('--look-x','0px');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});reduced.addEventListener('change',clear);
 return {burst,clear};
}

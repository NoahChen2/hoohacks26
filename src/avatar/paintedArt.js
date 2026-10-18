import { CHARACTER_ART,ENVIRONMENT_ART,ARTIFACT_ART } from './artManifest.js';

export const ENVIRONMENT_INDEX={cultivation:0,garden:1,fantasy:2,runway:3,cyber:4};
export const ARTIFACT_INDEX={needle:0,shuttle:1,'needle-array':2,shears:3,spindle:4,formation:5,'void-needle':6,crown:7,thorn:8,staff:9,'holo-staff':11,'holo-needle':11,sash:12,hairpin:13,frame:14,title:14,aura:15};
let clipSequence=0;
export function atlasFragment(atlas,index,width=120,height=120,extra='') {
 const cw=atlas.width/atlas.columns,ch=atlas.height/atlas.rows,col=index%atlas.columns,row=Math.floor(index/atlas.columns),id=`painted-clip-${++clipSequence}`;
 return `<svg ${extra} width="${width}" height="${height}" viewBox="${col*cw} ${row*ch} ${cw} ${ch}" preserveAspectRatio="xMidYMid meet" style="overflow:hidden"><defs><clipPath id="${id}"><rect x="${col*cw}" y="${row*ch}" width="${cw}" height="${ch}"/></clipPath></defs><image clip-path="url(#${id})" href="${atlas.src}" width="${atlas.width}" height="${atlas.height}"/></svg>`;
}
export function environmentFragment(theme,width=400,height=520,extra='') {
 const index=ENVIRONMENT_INDEX[theme]??0,cw=ENVIRONMENT_ART.width/3,ch=ENVIRONMENT_ART.height/2;
 return `<svg ${extra} width="${width}" height="${height}" viewBox="${index%3*cw} ${Math.floor(index/3)*ch} ${cw} ${ch}" preserveAspectRatio="xMidYMid slice" overflow="hidden"><image href="${ENVIRONMENT_ART.src}" width="${ENVIRONMENT_ART.width}" height="${ENVIRONMENT_ART.height}"/></svg>`;
}
export function PaintedCharacter(progress,items) {
 const art=CHARACTER_ART[progress.theme],row=items.robe?.requiredTier>=5?1:0,cw=art.width/3,ch=art.height/2,id=`painted-clip-${++clipSequence}`;
 const color=/^#[0-9a-f]{6}$/i.test(progress.avatar.outfitColors[progress.theme])?progress.avatar.outfitColors[progress.theme]:'';
 return `<g data-layer="painted-character" class="painted-character"><svg class="character-sprite-viewport" data-sprite-surface data-source="${art.src}" data-source-width="${art.width}" data-source-height="${art.height}" data-row="${row}" data-pose="neutral" data-tint="${color}" x="30" y="28" width="340" height="430" viewBox="0 ${row*ch} ${cw} ${ch}" preserveAspectRatio="xMidYMid meet" style="overflow:hidden"><defs><clipPath id="${id}"><rect data-sprite-clip x="0" y="${row*ch}" width="${cw}" height="${ch}"/></clipPath></defs><image class="character-sprite-image" clip-path="url(#${id})" href="${art.src}" width="${art.width}" height="${art.height}"/></svg></g>`;
}
export function paintedItemFragment(item,size=120) {
 if(['robe','mantle'].includes(item.previewAsset))return atlasFragment(CHARACTER_ART[item.themeId],item.requiredTier>=5?3:0,size,size);
 if(item.slot==='background')return environmentFragment(item.themeId,size,size);
 let index=ARTIFACT_INDEX[item.previewAsset]??0;
 if(item.previewAsset==='shears'&&item.themeId==='runway')index=10;
 if(item.previewAsset==='staff'&&item.themeId==='garden')index=8;
 return atlasFragment(ARTIFACT_ART,index,size,size);
}

const imageCache=new Map(),tintCache=new Map();
function loadImage(src) {
 if(!imageCache.has(src))imageCache.set(src,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Unable to load character art'));image.src=src;}));
 return imageCache.get(src);
}
function rgbToHsl(r,g,b) {
 r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
 if(!d)return [0,0,l];let h=hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4;return [h/6,d/(1-Math.abs(2*l-1)),l];
}
function hslToRgb(h,s,l) {
 const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h*6)%2-1)),m=l-c/2;
 const v=h<1/6?[c,x,0]:h<2/6?[x,c,0]:h<3/6?[0,c,x]:h<4/6?[0,x,c]:h<5/6?[x,0,c]:[c,0,x];return v.map(n=>Math.round((n+m)*255));
}
async function tintFrame(src,col,row,color) {
 const key=`${src}:${col}:${row}:${color}`;
 if(tintCache.has(key))return tintCache.get(key);
 const task=(async()=>{const image=await loadImage(src),cw=image.width/3,ch=image.height/2,canvas=document.createElement('canvas');canvas.width=cw;canvas.height=ch;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,col*cw,row*ch,cw,ch,0,0,cw,ch);
  const pixels=ctx.getImageData(0,0,cw,ch),target=rgbToHsl(parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16));
  for(let i=0;i<pixels.data.length;i+=4){if(pixels.data[i+3]<20)continue;const y=Math.floor(i/4/canvas.width)/ch;if(y<.2||y>.89)continue;const hsl=rgbToHsl(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);const cool=hsl[0]>.18&&hsl[0]<.88&&hsl[1]>.1;const darkCloth=hsl[1]<.12&&hsl[2]<.32&&y>.32;if(!cool&&!darkCloth)continue;const rgb=hslToRgb(target[0],Math.min(.75,target[1]*(cool ? .75 : .45)),hsl[2]);pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];}
  ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/png');})();
 tintCache.set(key,task);if(tintCache.size>24)tintCache.delete(tintCache.keys().next().value);return task;
}
export async function setSpritePose(scene,pose='neutral') {
 const col={neutral:0,focus:0,greet:1,celebrate:2}[pose]??0;
 for(const surface of scene.querySelectorAll('[data-sprite-surface]')) {
  const {source,sourceWidth,sourceHeight,row,tint}=surface.dataset,cw=Number(sourceWidth)/3,ch=Number(sourceHeight)/2,image=surface.querySelector('image'),clip=surface.querySelector('[data-sprite-clip]');
  clip.setAttribute('x',col*cw);clip.setAttribute('y',Number(row)*ch);
  surface.dataset.pose=pose;surface.setAttribute('viewBox',`${col*cw} ${Number(row)*ch} ${cw} ${ch}`);image.setAttribute('href',source);image.setAttribute('width',sourceWidth);image.setAttribute('height',sourceHeight);
  try {await loadImage(source);if(!scene.isConnected)return;scene.dataset.artReady='true';if(tint){const url=await tintFrame(source,col,Number(row),tint);if(!surface.isConnected||surface.dataset.pose!==pose)return;image.setAttribute('href',url);image.setAttribute('width',cw);image.setAttribute('height',ch);clip.setAttribute('x','0');clip.setAttribute('y','0');surface.setAttribute('viewBox',`0 0 ${cw} ${ch}`);}}
  catch {scene.dataset.artReady='error';const label=scene.querySelector('.art-load-label');if(label)label.textContent='Artwork could not load. Refresh to retry.';}
 }
}
export function preparePaintedScenes(root) {root.querySelectorAll('.character-scene').forEach(scene=>setSpritePose(scene));}

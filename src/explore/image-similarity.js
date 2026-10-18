// Real, lightweight on-device image descriptors, not an AI embedding model.
// Color histograms and edge orientations respond to the actual selected pixels.
export function cosine(a,b){let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
export function imageDescriptor({data,width,height}){
  const color=new Float32Array(64),edges=new Float32Array(8),gray=new Float32Array(width*height);
  for(let i=0;i<width*height;i++){const j=i*4;if(data[j+3]<128)continue;const r=data[j],g=data[j+1],b=data[j+2];color[(r>>6)*16+(g>>6)*4+(b>>6)]++;gray[i]=r*.299+g*.587+b*.114;}
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x,dx=gray[i+1]-gray[i-1],dy=gray[i+width]-gray[i-width],magnitude=Math.hypot(dx,dy);if(magnitude<12)continue;const angle=(Math.atan2(dy,dx)+Math.PI)%(Math.PI);edges[Math.min(7,Math.floor(angle/Math.PI*8))]+=magnitude;}
  return {color,edges};
}
export function descriptorSimilarity(a,b){return cosine(a.color,b.color)*.85+cosine(a.edges,b.edges)*.15;}
export function rankImages(query,index,{sourceId,style,kind,beginner=false,savedOnly=false,saved=[]}={}){
  return index.filter(({project:p})=>p.id!==sourceId&&(!style||p.aesthetic===style)&&(!kind||p.kind===kind)&&(!beginner||p.difficulty==='Beginner')&&(!savedOnly||saved.includes(p.id))).map(entry=>({project:entry.project,score:Math.max(...entry.descriptors.map(d=>descriptorSimilarity(query,d)))})).sort((a,b)=>b.score-a.score||a.project.id.localeCompare(b.project.id)).slice(0,12);
}
let indexPromise,indexedCount=0;
function describeCanvas(canvas){const small=document.createElement('canvas');small.width=small.height=64;const ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,64,64);return imageDescriptor(ctx.getImageData(0,0,64,64));}
export function describeImage(image,region={x:0,y:0,width:1,height:1}){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,region.x*image.naturalWidth,region.y*image.naturalHeight,region.width*image.naturalWidth,region.height*image.naturalHeight,0,0,64,64);
  return imageDescriptor(ctx.getImageData(0,0,64,64));
}
export const describeCrop=describeCanvas;
// Rebuilt when more projects have loaded. Photos from the post-images bucket are
// cross-origin, so they are requested with CORS to keep their pixels readable;
// one that fails to load is left out rather than failing the whole search.
export function catalogImageIndex(projects){
  if(indexedCount!==projects.length){indexPromise=null;indexedCount=projects.length;}
  indexPromise||=Promise.allSettled(projects.map(async project=>{
    const image=new window.Image();image.crossOrigin='anonymous';image.src=project.cover;await image.decode();
    return {project,descriptors:[{x:0,y:0,width:1,height:1},{x:.2,y:.18,width:.6,height:.63},{x:.3,y:.24,width:.4,height:.48}].map(region=>describeImage(image,region))};
  })).then(results=>results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]));
  return indexPromise;
}

// Pinterest-like side sweep: four equally spaced points on one circle.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const ACTION_ANGLES=Array.from({length:4},(_,i)=>(205-i*38)*Math.PI/180);
const unit=ACTION_ANGLES.map(angle=>({x:Math.cos(angle),y:-Math.sin(angle)}));
const spanX=Math.max(...unit.map(p=>p.x))-Math.min(...unit.map(p=>p.x));
const spanY=Math.max(...unit.map(p=>p.y))-Math.min(...unit.map(p=>p.y));
const minAxisSpacing=Math.min(...unit.slice(1).map((p,i)=>Math.max(Math.abs(p.x-unit[i].x),Math.abs(p.y-unit[i].y))));
export function layoutImageFocus(source,viewport){
  const left=viewport.left||0,top=viewport.top||0,insets=viewport.insets||{};
  const safe={left:left+Math.max(16,insets.left||0),right:left+viewport.width-Math.max(16,insets.right||0),top:top+Math.max(64,(insets.top||0)+52),bottom:top+viewport.height-Math.max(16,insets.bottom||0)};
  const factor=Math.min(1.045,(safe.right-safe.left)/source.width,(safe.bottom-safe.top)/source.height);
  const width=source.width*factor,height=source.height*factor;
  const image={left:clamp(source.left+(source.width-width)/2,safe.left,safe.right-width),top:clamp(source.top+(source.height-height)/2,safe.top,safe.bottom-height),width,height};
  const button=viewport.width>=800?52:48,gap=12,minRadius=(button+gap)/minAxisSpacing;
  const radius=Math.min(160,Math.max(minRadius,Math.min(width,height)*.42),(safe.right-safe.left-button)/spanX,(safe.bottom-safe.top-button)/spanY);
  const cx=image.left+width*.86,cy=image.top+height*.72;
  let mode,points;
  if(radius>=minRadius-.001){mode='arc';points=unit.map(p=>({x:cx+p.x*radius,y:cy+p.y*radius}));}
  else if(safe.right-safe.left>=button*4+gap*3){mode='row';points=Array.from({length:4},(_,i)=>({x:image.left+width/2+(i-1.5)*(button+gap),y:image.top+height/2}));}
  else{mode='grid';points=Array.from({length:4},(_,i)=>({x:image.left+width/2+(i%2-.5)*(button+gap),y:image.top+height/2+(Math.floor(i/2)-.5)*(button+gap)}));}
  const half=button/2,minX=Math.min(...points.map(p=>p.x))-half,maxX=Math.max(...points.map(p=>p.x))+half;
  const minY=Math.min(...points.map(p=>p.y))-half,maxY=Math.max(...points.map(p=>p.y))+half;
  const dx=minX<safe.left?safe.left-minX:maxX>safe.right?safe.right-maxX:0;
  const dy=minY<safe.top?safe.top-minY:maxY>safe.bottom?safe.bottom-maxY:0;
  image.left=clamp(image.left+dx,safe.left,safe.right-width);image.top=clamp(image.top+dy,safe.top,safe.bottom-height);
  points=points.map(p=>({x:p.x+dx,y:p.y+dy}));
  const close={left:clamp(image.left+width-44,safe.left,safe.right-44),top:Math.max(top+8+(insets.top||0),image.top-52)};
  if(points.some(p=>close.left<p.x+half&&close.left+44>p.x-half&&close.top<p.y+half&&close.top+44>p.y-half))close.top=top+8+(insets.top||0);
  return {image,mode,button,radius,points,close};
}

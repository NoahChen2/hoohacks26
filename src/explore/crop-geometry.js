const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function selectionFromPoints(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};}
export function moveSelection(s,dx,dy){return {...s,x:clamp(s.x+dx,0,1-s.width),y:clamp(s.y+dy,0,1-s.height)};}
export function resizeSelection(s,corner,p){
  const anchor={x:corner.includes('w')?s.x+s.width:s.x,y:corner.includes('n')?s.y+s.height:s.y};
  return selectionFromPoints(anchor,{x:clamp(p.x,0,1),y:clamp(p.y,0,1)});
}
export function pixelCrop(selection,width,height){
  const x=clamp(Math.floor(selection.x*width),0,width-1),y=clamp(Math.floor(selection.y*height),0,height-1);
  return {x,y,width:clamp(Math.round(selection.width*width),1,width-x),height:clamp(Math.round(selection.height*height),1,height-y)};
}

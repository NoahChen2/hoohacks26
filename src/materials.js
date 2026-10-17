import * as THREE from 'three';

const textile = {
  cotton: { roughness: .9, sheen: .45, normal: .20 },
  woven: { roughness: .78, sheen: .35, normal: .23 },
  denim: { roughness: .95, sheen: .25, normal: .42 },
  fleece: { roughness: 1, sheen: .95, normal: .35 },
  wool: { roughness: 1, sheen: 1, normal: .48 },
  poly: { roughness: .56, sheen: .8, normal: .15 },
  linen: { roughness: .96, sheen: .3, normal: .38 },
};
const noise = (x,y) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };

// An 8 cm textile swatch, repeated in the garment's existing centimetre UVs.
export function fabricMaps(material, anisotropy=4) {
  const size=256, heights=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const warp=Math.cos(x*Math.PI/2), weft=Math.cos(y*Math.PI/2), grain=noise(x,y);
    let h=.5+.14*warp+.14*weft;
    if(material==='denim')h=.5+.24*Math.sin((x+y)*Math.PI/3)+.10*weft;
    if(material==='cotton'||material==='fleece')h=.5+.16*Math.sin(x*Math.PI/3+Math.sin(y*Math.PI/4))+.12*Math.cos(y*Math.PI/4);
    if(material==='wool')h=.5+.24*Math.sin(x*Math.PI/6+Math.sin(y*Math.PI/8))+.16*Math.cos(y*Math.PI/8)+grain*.18;
    if(material==='linen')h+=.16*Math.sin(x*.21)+.12*Math.sin(y*.17);
    heights[y*size+x]=h+grain*.10;
  }
  const normal=new Uint8Array(size*size*4), rough=new Uint8Array(size*size*4);
  const at=(x,y)=>heights[((y+size)%size)*size+(x+size)%size];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const dx=(at(x-1,y)-at(x+1,y))*.9,dy=(at(x,y-1)-at(x,y+1))*.9,length=Math.hypot(dx,dy,1),i=(y*size+x)*4;
    normal.set([(dx/length*.5+.5)*255,(dy/length*.5+.5)*255,(1/length*.5+.5)*255,255],i);
    const r=Math.round(215+at(x,y)*35);rough.set([r,r,r,255],i);
  }
  const make=(data)=>{const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(220/8,200/8);t.anisotropy=anisotropy;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;};
  return {normalMap:make(normal),roughnessMap:make(rough)};
}

export function fabricMaterial(g, map, anisotropy) {
  const settings=textile[g.material]||textile.cotton;
  return new THREE.MeshPhysicalMaterial({map,...fabricMaps(g.material,anisotropy),color:'#ffffff',roughness:settings.roughness,metalness:0,
    normalScale:new THREE.Vector2(settings.normal,settings.normal),sheen:settings.sheen,sheenColor:new THREE.Color(g.color).lerp(new THREE.Color('#ffffff'),.45),sheenRoughness:.8,
    specularIntensity:.24,side:THREE.DoubleSide});
}

export function paintFabricGrain(ctx,w,h,material) {
  const tile=document.createElement('canvas');tile.width=tile.height=64;
  const c=tile.getContext('2d');c.clearRect(0,0,64,64);
  for(let y=0;y<64;y+=2)for(let x=0;x<64;x+=2) {
    const value=noise(x,y);
    c.fillStyle=value>.5?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)';c.fillRect(x,y,1,2);
  }
  c.strokeStyle='rgba(255,255,255,.06)';c.lineWidth=.7;
  for(let i=0;i<64;i+=material==='wool'?5:3){c.beginPath();c.moveTo(i,0);c.lineTo(material==='denim'?i+64:i,64);c.stroke();}
  ctx.fillStyle=ctx.createPattern(tile,'repeat');ctx.fillRect(0,0,w,h);
}

export function bodyMaterial() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,256,256);
  gradient.addColorStop(0,'#98b9c5');gradient.addColorStop(.5,'#84a7b8');gradient.addColorStop(1,'#7392aa');c.fillStyle=gradient;c.fillRect(0,0,256,256);
  for(let i=0;i<2300;i++){c.fillStyle=i%2?'#ffffff08':'#263b5207';c.fillRect(noise(i,3)*256,noise(i,7)*256,1,1);}
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const ramp=new THREE.DataTexture(new Uint8Array([70,135,205,255]),4,1,THREE.RedFormat);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.needsUpdate=true;
  return new THREE.MeshToonMaterial({map,gradientMap:ramp,color:'#ffffff'});
}

export function bodyOutlineMaterial() {
  const material=new THREE.MeshBasicMaterial({color:'#344956',side:THREE.BackSide});
  material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += normal * 0.11;');};
  material.customProgramCacheKey=()=> 'body-outline-v1';
  return material;
}

// Covered skin stays hidden at the trouser crotch during size changes. The radial
// mask rotates with the figure and leaves the arms and exposed lower legs intact.
export function addCoverageMask(material, coverage) {
  const previous=material.onBeforeCompile.bind(material);
  const cacheKey=material.customProgramCacheKey.bind(material);
  const key=cacheKey();
  material.onBeforeCompile=shader=>{
    previous(shader);
    shader.uniforms.bodyCoverage=coverage;
    shader.vertexShader='varying vec3 vBodySurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBodySurface = position;');
    shader.fragmentShader='uniform vec3 bodyCoverage;\nvarying vec3 vBodySurface;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(vBodySurface.y>bodyCoverage.x && vBodySurface.y<bodyCoverage.y && length(vBodySurface.xz)<bodyCoverage.z) discard;
    `);
  };
  material.customProgramCacheKey=()=>key+'-coverage-v1';
}

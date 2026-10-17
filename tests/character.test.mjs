import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bodyModel, perim } from '../src/character/measurements.js';
import { buildProceduralBody } from '../src/character/geometry.js';
import { createTorsoSampler } from '../src/character/sections.js';
import { presentationPoint, applyPresentation } from '../src/character/presentation.js';
import { defaultCharacter, normalizeCharacter, buildStartingPoint, BUILD_LABELS } from '../src/character/settings.ts';
import { inspectCharacterAsset, applyCharacterMorphs, disposeCharacterAsset } from '../src/character/assets.ts';
import { BODY_PRESETS, GARMENT_TYPES, defaultGarment } from '../src/state.js';
import { buildGarment } from '../src/model.js';

const sizes = ['Petite (XS)', 'Medium (M)', 'X-Large (XL)'];
const shapes = ['feminine', 'masculine'];
function validateGeometry(geometry) {
  const count = geometry.attributes.position.count;
  assert.ok(count > 0);
  for (const key of ['position','normal','uv']) {
    const attribute = geometry.attributes[key];
    if (attribute) for (const value of attribute.array) assert.ok(Number.isFinite(value), `finite ${key}`);
  }
  if (geometry.index) for (const index of geometry.index.array) assert.ok(index < count);
}
function topology(geometry) {
  const points = geometry.attributes.position, vertices = new Map(), parent = [], edges = new Map();
  const find = n => { while (parent[n] !== n) { parent[n] = parent[parent[n]]; n = parent[n]; } return n; };
  const join = (a,b) => { parent[find(a)] = find(b); };
  const id = i => {
    const key = [points.getX(i),points.getY(i),points.getZ(i)].map(v=>Math.round(v*10000)).join(',');
    if (!vertices.has(key)) { vertices.set(key,parent.length); parent.push(parent.length); }
    return vertices.get(key);
  };
  for (let i=0;i<points.count;i+=3) {
    const triangle = [id(i),id(i+1),id(i+2)];
    if (new Set(triangle).size<3) continue;
    join(triangle[0],triangle[1]);join(triangle[1],triangle[2]);
    for (let j=0;j<3;j++) {
      const a=triangle[j],b=triangle[(j+1)%3],key=a<b?`${a},${b}`:`${b},${a}`;
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  return {components:new Set(parent.map((_,i)=>find(i))).size,boundaries:[...edges.values()].filter(count=>count===1).length};
}

test('normalization is additive and leaves legacy data untouched',()=>{
  const legacy={bodyPreset:'masculine',face:{legacy:true},proportions:{fullness:.6,futureMorph:.2}};
  const original=structuredClone(legacy), result=normalizeCharacter(legacy);
  assert.deepEqual(legacy,original);assert.equal(result.bodyPreset,'masculine');
  assert.equal(result.proportions.fullness,.6);assert.equal(result.proportions.futureMorph,.2);
  assert.deepEqual(result.face,{legacy:true});assert.equal(result.proportions.calfVolume,0);
  assert.equal(normalizeCharacter({proportions:{fullness:Infinity}}).proportions.fullness,0);
});

test('both shape options accept all six editable build starting points',()=>{
  const base=BODY_PRESETS['Medium (M)'];
  for(const shape of shapes)for(const build of Object.keys(BUILD_LABELS)){
    const c=normalizeCharacter({bodyPreset:shape,build}),b=buildStartingPoint(base,c.build);
    assert.equal(b.height,base.height);assert.equal(b.inseam,base.inseam);assert.equal(b.arm,base.arm);
    for(const value of Object.values(b))assert.ok(Number.isFinite(value)&&value>0);
  }
  assert.ok(buildStartingPoint(base,'muscular').shoulder>base.shoulder);
  assert.ok(buildStartingPoint(base,'plus').waist>base.waist);
  assert.ok(buildStartingPoint(base,'curvy').hips>base.hips);
});

for(const shape of shapes)for(const size of sizes)test(`${shape} ${size}: continuous body, height, measured sections, cloth`,()=>{
  const b=structuredClone(BODY_PRESETS[size]),original=structuredClone(b),m=bodyModel(b),c=defaultCharacter();c.bodyPreset=shape;
  const sampler=createTorsoSampler(m,c);
  for(const [key,y] of [['chest',m.lm.chestY],['waist',m.lm.waistY],['hips',m.lm.hipY]]){
    assert.ok(Math.abs(perim(m.profileAt(y).rx,m.profileAt(y).rz)-b[key])<.01);
    let circumference=0,last;
    for(let i=0;i<=512;i++){
      const phi=-Math.PI+i/512*Math.PI*2,r=sampler.radius(y,phi),point=[Math.sin(phi)*r,Math.cos(phi)*r];
      if(last)circumference+=Math.hypot(point[0]-last[0],point[1]-last[1]);last=point;
    }
    assert.ok(Math.abs(circumference-b[key])/b[key]<.015,`${key} section tracks cm`);
  }
  const geometry=buildProceduralBody(m,c);validateGeometry(geometry);
  assert.ok(Math.abs(geometry.boundingBox.max.y-b.height)<.3,'height preserved');
  assert.ok(geometry.boundingBox.min.y>=-.05,'flat contact at floor');
  assert.ok(geometry.attributes.position.count/3<120000,'triangle budget');
  const topologyReport=topology(geometry);
  assert.equal(topologyReport.components,1,'single connected surface');
  assert.equal(topologyReport.boundaries,0,'closed surface');
  const presented=applyPresentation(geometry.clone(),m,{...c.proportions,legRatio:1,shoulderBreadth:1,fullness:.5});validateGeometry(presented);
  assert.ok(Math.abs(presented.boundingBox.max.y-b.height)<.3,'proportion preview preserves height');
  geometry.dispose();presented.dispose();
  for(const type of Object.keys(GARMENT_TYPES)){
    const g=defaultGarment(type),saved=structuredClone(g),built=buildGarment(g,m);
    for(const part of built.parts)for(const geo of Array.isArray(part.geo)?part.geo:[part.geo]){validateGeometry(geo);geo.dispose();}
    if(g.chest)assert.equal(built.checks.find(check=>check.label==='Chest').ease,g.chest-b.chest);
    assert.deepEqual(g,saved,'rendering does not change garment measurements');
  }
  assert.deepEqual(b,original,'measurements never mutated');
});

test('appearance controls move the intended anatomy without changing fitting inputs',()=>{
  const m=bodyModel(BODY_PRESETS['Medium (M)']),neutral=defaultCharacter().proportions;
  const t=m.lm.armLen*.25;
  const points={shoulderBreadth:[20,m.lm.shoulderY,3],torsoLength:[8,m.lm.crotchY,5],legRatio:[8,m.lm.crotchY,5],upperArmVolume:[m.jointR.x+Math.sin(m.lm.armAngle)*t+3,m.jointR.y-Math.cos(m.lm.armAngle)*t,2],thighVolume:[m.lm.legX+4,m.lm.H*.40,3],calfVolume:[m.lm.legX+3,m.lm.H*.20,2],fullness:[8,m.lm.waistY,8]};
  const measured=JSON.stringify(m.b);
  for(const [key,point]of Object.entries(points)){
    const before=presentationPoint(...point,m,neutral),after=presentationPoint(...point,m,{...neutral,[key]:1});
    assert.ok(Math.hypot(...after.map((v,i)=>v-before[i]))>.1,`${key} visibly moves`);
  }
  assert.equal(JSON.stringify(m.b),measured);
});

test('fitted geometry remains finite for snug and oversized garments',()=>{
  const m=bodyModel(BODY_PRESETS['Medium (M)']);
  for(const type of Object.keys(GARMENT_TYPES))for(const adjustment of [-18,35]){
    const g=defaultGarment(type);for(const key of ['chest','waist','hips','hem'])if(g[key])g[key]+=adjustment;
    for(const part of buildGarment(g,m).parts)for(const geo of Array.isArray(part.geo)?part.geo:[part.geo]){validateGeometry(geo);geo.dispose();}
  }
  const g=defaultGarment('tshirt');g.chest=m.b.chest-5;
  assert.equal(buildGarment(g,m).checks.find(c=>c.label==='Chest').ease,-5);
});

test('GLB adapter inventories real skeletons and reports unsupported morphs honestly',()=>{
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(12),4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  geo.morphAttributes.position=[new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,1,0],3)];geo.morphAttributes.position[0].name='Chest';
  const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshStandardMaterial()),bone=new THREE.Bone();bone.name='Hips';mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));mesh.updateMorphTargets();
  const manifest={url:'/licensed.glb',license:'CC0',attribution:'Test fixture',units:'metres',morphs:{chest:{name:'Chest',min:70,max:140}}};
  const inventory=inspectCharacterAsset(mesh);assert.equal(inventory.skinnedMeshes,1);assert.ok(inventory.bones.includes('Hips'));
  const result=applyCharacterMorphs(mesh,manifest,{chest:105,calfVolume:.4});assert.equal(mesh.morphTargetInfluences[0],.5);assert.deepEqual(result.unsupported,['calfVolume']);
  assert.deepEqual(applyCharacterMorphs(mesh,manifest,{chest:180}).outOfRange,['chest']);assert.equal(mesh.morphTargetInfluences[0],.5,'unsupported range is not silently clamped');
  disposeCharacterAsset(mesh);
});

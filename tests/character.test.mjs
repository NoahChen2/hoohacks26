import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { bodyModel, perim, headFrame } from '../src/character/measurements.js';
import { buildProceduralBody, weld } from '../src/character/geometry.js';
import { smoothSurface, vertexNormals, bakeOcclusion } from '../src/character/finish.js';
import { morphRegions, morphBody } from '../src/character/morph.js';
import { CANONICAL_MEASUREMENTS, canonicalCharacter } from '../src/character/canonical.js';
import { createTorsoSampler, conformToCharacter } from '../src/character/sections.js';
import { createRig, CLIPS, bodyWeightField } from '../src/character/rig.js';
import { presentationPoint, applyPresentation } from '../src/character/presentation.js';
import { defaultCharacter, normalizeCharacter, buildStartingPoint, BUILD_LABELS } from '../src/character/settings.ts';
import { inspectCharacterAsset, applyCharacterMorphs, disposeCharacterAsset } from '../src/character/assets.ts';
import { BODY_PRESETS, GARMENT_TYPES, defaultGarment } from '../src/state.js';
import { buildGarment } from '../src/model.js';

const sizes = ['Petite (XS)', 'Medium (M)', 'X-Large (XL)'];
const shapes = ['feminine', 'masculine'];
test('jaw and chin remain rigid across size/build changes and extreme shoulder angles', () => {
  for (const size of sizes) for (const build of Object.keys(BUILD_LABELS)) {
    const m = bodyModel(buildStartingPoint(BODY_PRESETS[size], build));
    const h = headFrame(m.lm.H), H = h.r * 2, W = .78 * H, D = .82 * H;
    for (const angle of [0, Math.PI / 3, Math.PI / 2]) {
      m.lm.armAngle = angle;
      const field = bodyWeightField(m), weights = new Float32Array(8);
      for (const [x, y, z] of [[0, -.50 * H, .12 * D], [-.35 * W, -.25 * H, -.05 * D], [.35 * W, -.25 * H, -.05 * D]]) {
        field(x, h.y + y, h.z + z, weights);
        assert.deepEqual(Array.from(weights), [0, 0, 1, 0, 0, 0, 0, 0]);
      }
    }
  }
});
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
  // Stature is to the scalp; the hair volume may add up to 2.5 cm above it.
  assert.ok(geometry.boundingBox.max.y>b.height-.3&&geometry.boundingBox.max.y<b.height+2.5,'height preserved');
  assert.ok(geometry.boundingBox.min.y>=-.05,'flat contact at floor');
  assert.ok(geometry.attributes.position.count/3<120000,'triangle budget');
  const topologyReport=topology(geometry);
  assert.equal(topologyReport.components,1,'single connected surface');
  assert.equal(topologyReport.boundaries,0,'closed surface');
  const presented=applyPresentation(geometry.clone(),m,{...c.proportions,legRatio:1,shoulderBreadth:1,fullness:.5});validateGeometry(presented);
  assert.ok(Math.abs(presented.boundingBox.max.y-geometry.boundingBox.max.y)<.3,'proportion preview preserves height');
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

test('rigged clothing inherits skin weights, clears the skin and never binds a torso panel to an arm',()=>{
  const m=bodyModel(BODY_PRESETS['Medium (M)']),c=normalizeCharacter({bodyPreset:'masculine'}),sampler=createTorsoSampler(m,c);
  const body=buildProceduralBody(m,c),rig=createRig(m,c.proportions,sampler);
  rig.attach(new THREE.Group());rig.skinBody(body);
  const weights=geo=>{const w=geo.attributes.skinWeight;for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-4,'normalized');};
  weights(body);
  const S=body.attributes.position,N=body.attributes.normal;
  for(const type of ['tshirt','buttonup','jeans']){
    for(const part of buildGarment(defaultGarment(type),m).parts)for(const geo of Array.isArray(part.geo)?part.geo:[part.geo]){
      conformToCharacter(geo,part.region,m,sampler);
      rig.skinGarment(geo,{arms:part.region==='sleeve'});weights(geo);
      const p=geo.attributes.position,index=geo.attributes.skinIndex,w=geo.attributes.skinWeight;
      for(let i=0;i<p.count;i+=7){
        if(part.region!=='sleeve'){
          let limb=0;for(let k=0;k<4;k++)if([3,4,5,6].includes(index.getComponent(i,k)))limb+=w.getComponent(i,k);
          assert.ok(limb<=.86,`${type} ${part.region} stays off the arms`);
        }
        // Nearest skin vertex: cloth must sit on its outer side.
        let best=Infinity,skin=0;
        for(let j=0;j<S.count;j+=3){const d=(S.getX(j)-p.getX(i))**2+(S.getY(j)-p.getY(i))**2+(S.getZ(j)-p.getZ(i))**2;if(d<best){best=d;skin=j;}}
        const depth=(p.getX(i)-S.getX(skin))*N.getX(skin)+(p.getY(i)-S.getY(skin))*N.getY(skin)+(p.getZ(i)-S.getZ(skin))*N.getZ(skin);
        assert.ok(depth>-.05,`${type} ${part.region} clears the skin`);
      }
    }
  }
  for(const clip of CLIPS){rig.pose(CLIPS.indexOf(clip)*4.5+2);for(const bone of Object.values(rig.bones))assert.ok(Number.isFinite(bone.rotation.x+bone.rotation.y+bone.rotation.z));}
  rig.rest();for(const bone of Object.values(rig.bones))assert.equal(bone.rotation.x+bone.rotation.y+bone.rotation.z,0);
});

test('morphing the canonical body tracks target stature, calibrated torso sections and joints',()=>{
  const shape=canonicalCharacter('masculine'),cm=bodyModel({...CANONICAL_MEASUREMENTS}),cs=createTorsoSampler(cm,shape);
  const raw=buildProceduralBody(cm,shape,96),mesh=weld(raw.attributes.position.array,raw.attributes.normal.array,raw.attributes.uv.array);
  assert.ok(mesh.positions.length<raw.attributes.position.array.length/4,'welding removes duplicated vertices');
  smoothSurface(mesh.positions,mesh.index);vertexNormals(mesh.positions,mesh.index,mesh.normals);
  const ao=bakeOcclusion(mesh.positions,mesh.normals,raw.sdf);
  assert.ok(ao.every(v=>v>=.3&&v<=1)&&ao.some(v=>v<.8),'creases are occluded');
  const regions=morphRegions(cm,cs,mesh.positions),from={model:cm,sampler:cs};
  const same=morphBody(mesh.positions,regions,from,from);
  assert.ok(same.every((v,i)=>Math.abs(v-mesh.positions[i])<1e-3),'canonical maps to itself');
  for(const shapeName of shapes)for(const size of sizes){
    const m=bodyModel(BODY_PRESETS[size]),c=normalizeCharacter({bodyPreset:shapeName}),s=createTorsoSampler(m,c);
    const out=morphBody(mesh.positions,regions,from,{model:m,sampler:s});
    let top=-Infinity,total=0,count=0;
    for(let i=0;i<out.length/3;i++){
      assert.ok(Number.isFinite(out[i*3]+out[i*3+1]+out[i*3+2]));
      top=Math.max(top,out[i*3+1]);
      if(regions[i*3]+regions[i*3+1]+regions[i*3+2]>.001)continue;
      for(const key of ['chestY','waistY','hipY'])if(Math.abs(out[i*3+1]-m.lm[key])<1){
        const r=Math.hypot(out[i*3],out[i*3+2]),target=s.radius(out[i*3+1],Math.atan2(out[i*3],out[i*3+2]));
        total+=Math.abs(r-target)/target;count++;
      }
    }
    assert.ok(count>50&&total/count<.01,`${shapeName} ${size}: torso sits on the target sections`);
    assert.ok(top>m.lm.H-.5&&top<m.lm.H+2.5,`${shapeName} ${size}: stature`);
  }
});

test('adaptive profile shapes the calibrated torso: neutral blend, one-sided flat chest, maternity',()=>{
  const base={...BODY_PRESETS['Medium (M)'],chestProjection:.5};
  const at=(extra,bodyPreset)=>{const m=bodyModel({...base,...extra});return {m,s:createTorsoSampler(m,normalizeCharacter({bodyPreset}))};};
  const chest=({m,s},phi)=>s.radius(m.lm.chestY,phi);
  const fem=at({},'feminine'),neutral=at({},'neutral'),male=at({},'masculine');
  assert.ok(chest(fem,.52)>chest(neutral,.52)&&chest(neutral,.52)>chest(male,.52),'neutral sits between the shapes');
  const flat=at({chestOption:'leftFlat'},'feminine');
  assert.ok(chest(flat,-.52)-chest(flat,.52)>2,'only the left side of the person (+x) is flat');
  const belly=({m,s})=>s.radius(m.lm.hipY+(m.lm.waistY-m.lm.hipY)*.58,0);
  assert.ok(belly(at({maternity:'third'},'feminine'))-belly(fem)>12,'third trimester projects the belly');
  for(const key of ['chestY','waistY','hipY']){
    const {m,s}=at({chestOption:'bilateralFlat'},'neutral');let c=0,last;
    for(let i=0;i<=512;i++){const phi=-Math.PI+i/512*Math.PI*2,r=s.radius(m.lm[key],phi),pt=[Math.sin(phi)*r,Math.cos(phi)*r];if(last)c+=Math.hypot(pt[0]-last[0],pt[1]-last[1]);last=pt;}
    assert.ok(Math.abs(c-base[{chestY:'chest',waistY:'waist',hipY:'hips'}[key]])/c<.015,`${key} stays calibrated`);
  }
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

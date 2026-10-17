// Canonical measurement exports and garment geometry, in centimetres.
// The continuous rendered body lives in character/geometry.js. Garment fit and
// cutting calculations continue to use the unchanged measurement model.

import * as THREE from 'three';
import { GARMENT_TYPES } from './state.js';
import { topLandmarks, bottomLandmarks } from './flats.js';

import { bodyModel, perim } from './character/measurements.js';
export { bodyModel, perim };
import { buildProceduralBody } from './character/geometry.js';
import { defaultCharacter } from './character/settings.ts';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const radiiFor = (C, k) => {
  const a = C / perim(1, k);
  return [a, a * k];
};

function piecewise(keys, x) {
  // keys sorted by x: [[x, v], ...]
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) {
      const [x0, v0] = keys[i - 1],
        [x1, v1] = keys[i];
      return lerp(v0, v1, (x - x0) / (x1 - x0 || 1));
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- ring surface builder

/**
 * rings: [{c:Vector3, e1:Vector3, e2:Vector3, r1, r2, flatY, xOff, color?}]
 * φ = 0 points along e2 (front). u is arc-length based so patterns keep real-world scale.
 */
export function ringSurface(rings, opts = {}) {
  if (opts.cloth) {
    const dense = [];
    for (let j=0;j<rings.length-1;j++) {
      const a=rings[j], b=rings[j+1], steps=Math.max(1,Math.ceil(a.c.distanceTo(b.c)/1.2));
      for(let k=0;k<steps;k++) {
        const t=k/steps, r={...a,c:a.c.clone().lerp(b.c,t)};
        for(const field of ['r1','r2','flatY','xOff','ease','minR1','minR2','pelvisBlend','pelvisR1','pelvisR2']) if(a[field]!=null && b[field]!=null)r[field]=lerp(a[field],b[field],t);
        if(a.color && b.color)r.color=a.color.map((v,i)=>lerp(v,b.color[i],t));
        dense.push(r);
      }
    }
    dense.push(rings.at(-1));rings=dense;
  }
  const N = opts.segments || 48;
  const W = opts.texW || 220;
  const Hc = opts.texH || 200;
  const margin = opts.texMargin ?? 12;
  const pos = [],
    uv = [],
    col = [],
    idx = [];
  for (let j = 0; j < rings.length; j++) {
    const R = rings[j];
    // cumulative arc length starting at back (φ=-π) so front is the middle
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const phi = -Math.PI + (i / N) * Math.PI * 2;
      let r1=R.r1,r2=R.r2;
      if(opts.cloth) {
        const loose=clamp((R.ease ?? 12)/25,0,1), y=R.flatY??R.c.y;
        const stiffness=opts.material==='denim'?.65:opts.material==='wool'?.8:1;
        const folds=(Math.sin(phi*9+Math.sin(y*.055))*.65+Math.sin(phi*15-y*.10)*.22)*(.12+loose*1.0);
        const creases=Math.sin(y*.90+Math.cos(phi*2)*2.5)*.12*Math.pow(Math.abs(Math.sin(phi)),3);
        const delta=(folds+creases)*stiffness;
        r1=Math.max(R.minR1??0,r1+delta);r2=Math.max(R.minR2??0,r2+delta);
      }
      const p = R.c.clone().addScaledVector(R.e1,Math.sin(phi)*r1).addScaledVector(R.e2,Math.cos(phi)*r2);
      if(R.pelvisBlend) {
        const wave=opts.cloth?(Math.sin(phi*9+R.c.y*.045)*.15):0;
        const targetX=R.side*Math.max(0,R.side*Math.sin(phi))*(R.pelvisR1+wave);
        const targetZ=Math.cos(phi)*(R.pelvisR2+wave);
        p.x=lerp(p.x,targetX,R.pelvisBlend);p.z=lerp(p.z,targetZ,R.pelvisBlend);
      }
      if(opts.bodyCollision) {
        const M=opts.bodyCollision,y=p.y;
        let envelope=0;
        if(y>=M.lm.crotchY-1) {
          const b=M.profileAt(y),u=p.x/b.rx;
          if(Math.abs(u)<1)envelope=Math.max(envelope,b.rz*Math.sqrt(1-u*u)+.75);
        }
        if(y<=M.lm.hipY)for(const side of [-1,1]) {
          const r=M.legRAt(y),u=(p.x-side*M.lm.legX)/r;
          if(Math.abs(u)<1)envelope=Math.max(envelope,r*1.04*Math.sqrt(1-u*u)+.75);
        }
        p.z=(p.z<0?-1:1)*Math.max(Math.abs(p.z),envelope);
      }
      if(opts.neckDrop) p.y-=Math.max(0,Math.cos(phi))**2*opts.neckDrop*clamp((R.c.y-(rings.at(-1).c.y-6))/6,0,1);
      pts.push(p);
    }
    let s = 0;
    const arcs = [0];
    for (let i = 1; i <= N; i++) {
      s += pts[i].distanceTo(pts[i - 1]);
      arcs.push(s);
    }
    const half = arcs[N / 2];
    for (let i = 0; i <= N; i++) {
      pos.push(pts[i].x, pts[i].y, pts[i].z);
      const sc = arcs[i] - half; // arc from front centre; +sc toward +e1
      uv.push(0.5 + (sc + (R.xOff || 0)) / W, 1 - ((R.flatY ?? 0) + margin) / Hc);
      const c = R.color || [1, 1, 1];
      col.push(c[0], c[1], c[2]);
    }
  }
  const row = N + 1;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * row + i,
        b = a + 1,
        c = a + row,
        d = c + 1;
      idx.push(a, b, c, b, d, c); // CCW from outside → outward normals
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // Ring order differs for descending arms and ascending torsos/legs.
  const axis=rings.at(-1).c.clone().sub(rings[0].c);
  const reverse=axis.dot(new THREE.Vector3().crossVectors(rings[0].e1,rings[0].e2))>0;
  if(reverse)for(let i=0;i<idx.length;i+=3)[idx[i],idx[i+1]]=[idx[i+1],idx[i]];
  geo.setIndex(idx);
  geo.computeVertexNormals();
  if(opts.cloth) {
    const result=[geo];
    for(const j of [opts.trimStart?0:null,opts.trimEnd?rings.length-1:null].filter(v=>v!==null)) {
      const points=[];for(let i=0;i<N;i++){const k=(j*(N+1)+i)*3;points.push(new THREE.Vector3(pos[k],pos[k+1],pos[k+2]));}
      const curve=new THREE.CatmullRomCurve3(points,true);
      const trim=new THREE.TubeGeometry(curve,N*2,(j===rings.length-1 && opts.neckDrop) ? .27 : .14,6,true);
      trim.userData.trim=true;result.push(trim);
    }
    return result;
  }
  if (opts.capStart || opts.capEnd) {
    // simple fan caps
    const caps = [];
    if (opts.capStart) caps.push([0, -1]);
    if (opts.capEnd) caps.push([rings.length - 1, 1]);
    const merged = [geo];
    for (const [j, end] of caps) {
      const R = rings[j];
      const g2 = new THREE.CircleGeometry(1, N);
      g2.scale(R.r1, R.r2, 1);
      const m = new THREE.Matrix4().makeBasis(R.e1, R.e2, new THREE.Vector3().crossVectors(R.e1, R.e2));
      g2.applyMatrix4(m);
      g2.translate(R.c.x, R.c.y, R.c.z);
      if(axis.clone().multiplyScalar(end).dot(new THREE.Vector3().crossVectors(R.e1,R.e2))<0){const ids=g2.index.array;for(let i=0;i<ids.length;i+=3)[ids[i],ids[i+1]]=[ids[i+1],ids[i]];g2.computeVertexNormals();}
      merged.push(g2);
    }
    return merged;
  }
  return geo;
}

const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);

export function armBasis(dir) {
  const e1 = new THREE.Vector3(-dir.y, dir.x, 0).normalize(); // perpendicular in xy-plane
  if (e1.x < 0) e1.negate();
  return { e1, e2: Z.clone() };
}

// ---------------------------------------------------------------- body meshes

export function buildBodyGeometries(M, character = defaultCharacter()) {
  return [buildProceduralBody(M, character)];
}

// ---------------------------------------------------------------- garments

// ease (cm of extra circumference) → colour
export function easeColor(ease) {
  if (ease < -1) return [0.9, 0.28, 0.3];
  if (ease < 4) return [0.96, 0.85, 0.04];
  if (ease < 24) return [0.27, 0.65, 0.35];
  return [0.24, 0.39, 0.87];
}

function fitRing(M, y, Cg, flatY, extra = 0.6) {
  const p = M.profileAt(y);
  const Cb = perim(p.rx, p.rz);
  let r1, r2;
  if (Cg > Cb + extra * 6.3) {
    const aspect=lerp(p.rz/p.rx,.74,clamp((Cg-Cb)/24,0,1));
    [r1,r2]=radiiFor(Cg,aspect);
    r1=Math.max(r1,p.rx+extra);r2=Math.max(r2,p.rz+extra);
  } else {
    r1 = p.rx + extra;
    r2 = p.rz + extra;
  }
  return { c: new THREE.Vector3(0, y, 0), e1: X, e2: Z, r1, r2, flatY, minR1: p.rx+extra, minR2: p.rz+extra, color: easeColor(Cg - Cb), ease: Cg - Cb };
}

function sampleYs(top, bottom, step, extras = []) {
  const ys = new Set();
  for (let y = bottom; y < top; y += step) ys.add(+y.toFixed(2));
  ys.add(+top.toFixed(2));
  extras.forEach((e) => {
    if (e > bottom && e < top) ys.add(+e.toFixed(2));
  });
  return [...ys].sort((a, b) => a - b);
}

// A shallow, draped pocket panel with its own stitched boundary.
function frontPocket(rings, cx, top, width, height, texTop) {
  top=Math.min(top,rings.at(-1).c.y-1);
  const bottom=Math.max(rings[0].c.y+1,top-height);
  if(top-bottom<3)return [];
  const vertices=[],uv=[],colors=[],indices=[],rows=12,cols=16;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++) {
    const v=j/rows,u=i/cols,y=lerp(bottom,top,v),x=cx+(u-.5)*width*lerp(.85,1,v);
    let upper=rings.findIndex(r=>r.c.y>=y);if(upper<1)upper=1;
    const a=rings[upper-1],b=rings[upper],t=clamp((y-a.c.y)/(b.c.y-a.c.y||1),0,1);
    const rx=lerp(a.r1,b.r1,t),rz=lerp(a.r2,b.r2,t),phi=Math.asin(clamp(x/rx,-.95,.95));
    let arc=0;for(let k=0;k<20;k++){const angle=phi*(k+.5)/20;arc+=Math.hypot(rx*Math.cos(angle),rz*Math.sin(angle))*phi/20;}
    const z=rz*Math.cos(phi)+.36+.65*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);
    vertices.push(x,y,z);uv.push(.5+arc/220,1-(texTop-y+12)/200);colors.push(...(a.color||[1,1,1]));
    if(j<rows&&i<cols){const k=j*(cols+1)+i;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  const boundary=[];
  for(let j=rows;j>=0;j--)boundary.push(j*(cols+1));
  for(let i=1;i<=cols;i++)boundary.push(i);
  for(let j=1;j<=rows;j++)boundary.push(j*(cols+1)+cols);
  const points=boundary.map(k=>new THREE.Vector3(vertices[k*3],vertices[k*3+1],vertices[k*3+2]+.06));
  const seam=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),100,.065,5,false);seam.userData.trim=true;
  return [geo,seam];
}

/**
 * Returns { parts: [{geo, region}], summary, topY } for a garment on a body model.
 * parts' uv map into a shared texture where the flat sketch (cm) lives at
 * u = 0.5 + x/texW, v = 1 - (flatY + margin)/texH.
 */
export function buildGarment(g, M) {
  const kind = GARMENT_TYPES[g.type].kind;
  const lm = M.lm;
  const parts = [];
  const checks = []; // {label, ease}
  let topY;

  if (kind === 'top' || kind === 'dress') {
    const T = topLandmarks(g);
    topY = lm.neckBaseY + 0.5;
    const isDress = kind === 'dress';
    const hemY = Math.max(topY - g.length, 2);
    const waistYg = isDress ? lm.waistY : lm.waistY;
    // garment circumference keypoints by world y
    let keys;
    if (isDress) {
      const skirtHip = g.waist + (g.hem - g.waist) * 0.35;
      keys = [
        [hemY, g.hem],
        [lm.hipY, Math.max(skirtHip, g.waist)],
        [waistYg, g.waist],
        [lm.chestY, g.chest],
        [lm.armpitY, g.chest],
      ];
    } else {
      keys = [
        [hemY, g.hem],
        [waistYg, g.waist],
        [lm.chestY, g.chest],
        [lm.armpitY, g.chest],
      ];
    }
    keys = keys.filter((k, i) => i === 0 || k[0] > hemY).sort((a, b) => a[0] - b[0]);
    const Cg = (y) => piecewise(keys, y);
    const ys = sampleYs(lm.armpitY, hemY, 3, [lm.waistY, lm.hipY, lm.chestY, lm.crotchY]);
    const rings = ys.map((y) => fitRing(M, y, Cg(y), topY - y));
    // shoulders → neckline
    const shoulderHalf = Math.max(g.shoulder / 2, M.profileAt(lm.shoulderY - 1.5).rx + 0.8);
    const up = [
      { y: lerp(lm.armpitY, lm.shoulderY, 0.55), w: 1 },
      { y: lm.shoulderY - 1.5, w: 1 },
      { y: lm.shoulderY + 0.8, w: 0.6 },
      { y: lm.neckBaseY + 0.3, w: 0 },
    ];
    const chestRing = rings[rings.length - 1];
    for (const u of up) {
      if (u.y <= chestRing.c.y) continue;
      const p = M.profileAt(u.y);
      const atShoulder = u.y >= lm.shoulderY - 2;
      let r1 = atShoulder ? p.rx + 1 : Math.max(p.rx + 0.8, Math.min(shoulderHalf, chestRing.r1));
      let r2 = Math.max(p.rz + 0.8, u.w ? lerp(p.rz + 0.8, chestRing.r2, 0.4) : p.rz + 0.8);
      if (u.w === 0) {
        r1 = Math.max(M.neckR + 1.2, g.type === 'tank' ? T.nw : T.nw * 0.85);
        r2 = M.neckR + (g.type === 'buttonup' ? 1.2 : 2.4);
      }
      rings.push({ c: new THREE.Vector3(0, u.y, u.w === 0 ? 0.6 : 0), e1: X, e2: Z, r1, r2, flatY: topY - u.y, color: [0.27, 0.65, 0.35] });
    }
    parts.push({ geo: ringSurface(rings, { segments: 64, cloth: true, material: g.material, trimStart: true, trimEnd: true, neckDrop: g.type==='tank'?5:g.type==='buttonup'?2:2.8 }), region: 'torso' });
    const ringAt = (y) => rings.reduce((best, r) => (Math.abs(r.c.y - y) < Math.abs(best.c.y - y) ? r : best), rings[0]);
    if(g.type==='hoodie') parts.push({geo:frontPocket(rings,0,topY-g.length+27,27,16,topY),region:'pocket'});
    if(g.type==='buttonup') parts.push({geo:frontPocket(rings,-g.chest*.105,lm.chestY+2,11,12,topY),region:'pocket'});
    if (g.type === 'buttonup') {
      for(let fy=7;fy<g.length-3;fy+=9) {
        const y=topY-fy,r=ringAt(y),button=new THREE.SphereGeometry(.52,16,10);
        button.scale(1,1,.35);button.translate(0,y,r.r2+.8);button.userData.button=true;
        parts.push({geo:button,region:'button'});
      }
      for(const side of [-1,1]) {
        const y=lm.neckBaseY,positions=[side*3,y+1,M.neckR+2.5,side*9,y-2,M.neckR+3,side*6,y-7,M.profileAt(y-7).rz+2];
        const collar=new THREE.BufferGeometry();collar.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));collar.computeVertexNormals();collar.userData.trim=true;
        parts.push({geo:collar,region:'collar'});
      }
    }
    checks.push({ label: 'Chest', ease: g.chest - M.b.chest });
    if (hemY < lm.waistY) checks.push({ label: 'Waist', ease: g.waist - M.b.waist });
    if (hemY < lm.hipY) checks.push({ label: 'Hips', ease: ringAt(lm.hipY).ease });
    checks.push({ label: 'Length', ease: null, text: lengthText(hemY, lm) });

    // sleeves
    if (T.hasSleeves) {
      const armholeC = Math.max(g.chest * 0.42, M.upperR * 2 * Math.PI + 4);
      const L = Math.min(g.sleeve, lm.armLen + 4);
      for (const side of [-1, 1]) {
        const dir = M.armDir.clone();
        dir.x *= side;
        const joint = side < 0 ? M.jointL : M.jointR;
        const { e1, e2 } = armBasis(dir);
        const ts = sampleYs(L, -M.upperR * 0.9, 3, [0]);
        const srings = ts.map((t) => {
          const br = M.armRAt(Math.min(t, lm.armLen));
          const Cb = 2 * Math.PI * br;
          const Cs = t <= 0 ? armholeC : lerp(armholeC, g.sleeveOpen, clamp(t / L, 0, 1));
          let r = Math.max(br + 0.5, Cs / (2 * Math.PI));
          // round the sleeve cap over the shoulder instead of a flat disc
          if (t < 0) r = lerp(M.upperR * 1.03 + 0.8, r, clamp(1 + t / (M.upperR * 0.9), 0, 1));
          // flat mapping for the sleeve: along the flat sleeve direction
          const fx = side * (T.S[0] + Math.cos(T.theta) * Math.max(t, 0));
          const fy = T.S[1] + Math.sin(T.theta) * Math.max(t, 0);
          return { c: joint.clone().addScaledVector(dir, t), e1, e2, r1: r, r2: r * 0.96, minR1: br+0.8, minR2: br+0.8, flatY: fy, xOff: fx, color: easeColor(Cs - Cb), ease: Cs - Cb };
        });
        parts.push({ geo: ringSurface(srings, { segments: 48, cloth: true, material: g.material, trimEnd: true }), region: 'sleeve' });
      }
      checks.push({ label: 'Sleeve', ease: g.sleeveOpen - 2 * Math.PI * M.armRAt(Math.min(L, lm.armLen)), text: sleeveText(g.sleeve, lm.armLen) });
    }

    if (g.type === 'hoodie') {
      const hood = new THREE.SphereGeometry(1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
      hood.scale(lm.headR * 1.05, lm.headR * 0.9, lm.headR * 0.9);
      hood.rotateX(-Math.PI * 0.62);
      hood.translate(0, lm.neckBaseY + 2, -M.neckR * 1.6);
      parts.push({ geo: hood, region: 'hood' });
    }
  }

  if (kind === 'bottom') {
    const B = bottomLandmarks(g);
    const crotch = lm.crotchY;
    topY = Math.min(crotch + g.rise, lm.waistY + 4);
    const keys = [
      [crotch - 1, Math.min(g.hips * 0.97, M.circAt(crotch - 1) * (g.hips / M.b.hips) + 2)],
      [Math.min(lm.hipY, topY - 2), g.hips],
      [topY, g.waist],
    ].sort((a, b) => a[0] - b[0]);
    const ys = sampleYs(topY, crotch - 1, 3, [lm.hipY]);
    const rings = ys.map((y) => fitRing(M, y, piecewise(keys, y), topY - y, 0.5));
    const waistband = ringSurface(rings, { segments: 64, cloth: true, material: g.material, trimEnd: true });
    waistband.shift().dispose();
    parts.push({geo:waistband,region:'waistband'});
    const seatBottom = rings[0];
    checks.push({ label: 'Waist', ease: g.waist - M.circAt(topY) });
    checks.push({ label: 'Hips', ease: g.hips - M.b.hips });
    const hemY = Math.max(crotch - g.inseam, 1.5);
    const thighC = g.hips * 0.62;
    for (const side of [-1, 1]) {
      const ly = sampleYs(topY, hemY, 2, [lm.H * 0.285,crotch-8,crotch+4,lm.hipY]);
      const lr = ly.map((y) => {
        const br = M.legRAt(y);
        const Cb = 2 * Math.PI * br;
        const Cl = lerp(g.legOpen, thighC, clamp((y - hemY) / (crotch - hemY || 1), 0, 1));
        let r = Math.max(br + 0.5, Cl / (2 * Math.PI));
        // flare the top of each leg out to meet the seat so there's no step at the crotch
        const blend = clamp((y - (crotch - 8)) / 9, 0, 1);
        r = Math.max(r, lerp(r, seatBottom.r1 - lm.legX + 0.3, blend));
        const fy = topY - y;
        const blendT=clamp((y-(crotch-8))/12,0,1),pelvisBlend=blendT*blendT*(3-2*blendT);
        const seat=fitRing(M,Math.max(y,crotch-1),piecewise(keys,Math.max(y,crotch-1)),fy,.7);
        return { c: new THREE.Vector3(side * lm.legX, y, 0), e1: X, e2: Z, r1: r, r2: r*1.02,
          minR1: br+.7,minR2: br*1.04+.7,flatY:fy,xOff:side*B.xc*(1-pelvisBlend),
          pelvisBlend,pelvisR1:seat.r1,pelvisR2:seat.r2,side,
          color:easeColor(lerp(Cl-Cb,seat.ease,pelvisBlend)),ease:lerp(Cl-Cb,seat.ease,pelvisBlend) };
      });
      parts.push({ geo: ringSurface(lr, { segments: 64, cloth: true, material: g.material, trimStart: true, bodyCollision: M }), region: 'leg' });
    }
    checks.push({ label: 'Thigh', ease: thighC - M.b.thigh });
    checks.push({ label: 'Length', ease: null, text: inseamText(g.inseam, M.b.inseam) });
  }

  if (kind === 'skirt') {
    topY = lm.waistY;
    const hemY = Math.max(topY - g.length, 2);
    const hipY = topY - Math.min(18, g.length * 0.4);
    const keys = [
      [hemY, g.hem],
      [hipY, g.hips],
      [topY, g.waist],
    ].sort((a, b) => a[0] - b[0]);
    const ys = sampleYs(topY, hemY, 3, [lm.hipY, lm.crotchY]);
    const rings = ys.map((y) => {
      const r = fitRing(M, y, piecewise(keys, y), topY - y, 0.6);
      return r;
    });
    parts.push({ geo: ringSurface(rings, { segments: 64, cloth: true, material: g.material, trimStart: true, trimEnd: true }), region: 'skirt' });
    checks.push({ label: 'Waist', ease: g.waist - M.b.waist });
    checks.push({ label: 'Hips', ease: g.hips - M.b.hips });
    checks.push({ label: 'Length', ease: null, text: hemY > lm.H * 0.285 ? 'above knee' : hemY > lm.H * 0.12 ? 'midi' : 'maxi' });
  }

  return { parts, checks, topY };
}

function lengthText(hemY, lm) {
  if (hemY > lm.waistY + 4) return 'cropped (above waist)';
  if (hemY > lm.hipY) return 'hits at waist';
  if (hemY > lm.crotchY - 4) return 'hip length';
  if (hemY > lm.H * 0.3) return 'tunic / mini length';
  return 'long';
}
function sleeveText(s, arm) {
  if (s < arm * 0.35) return 'short sleeve';
  if (s < arm * 0.8) return '3/4 sleeve';
  if (s > arm + 3) return `${Math.round(s - arm)} cm too long`;
  return 'full length';
}
function inseamText(i, bi) {
  const d = i - bi;
  if (d > 3) return `${Math.round(d)} cm too long`;
  if (d < -12) return 'shorts / cropped';
  if (d < -3) return `${Math.round(-d)} cm short (ankle)`;
  return 'right length';
}

export function fitWord(ease, kind = 'top') {
  if (ease == null) return '';
  if (ease < -1) return 'too tight';
  if (ease < 4) return 'snug';
  if (ease < (kind === 'bottom' ? 10 : 24)) return 'good fit';
  return 'oversized';
}

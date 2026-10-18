// Canonical measurement exports and garment geometry, in centimetres.
// The continuous rendered body lives in character/geometry.js. Garment fit and
// cutting calculations continue to use the unchanged measurement model.

import * as THREE from 'three';
import { GARMENT_TYPES } from './garments.js';
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
  // An open front (jackets, cardigans) leaves out the faces either side of φ = 0.
  const open = opts.open || 0;
  const gap = (i) => open > 0 && Math.abs(-Math.PI + ((i + 0.5) / N) * Math.PI * 2) < open;
  // Armholes (sleeveless tops): above armhole.y only the cloth within armhole.x
  // of the centre line stays, which leaves the shoulder straps.
  // A neckline (armhole.neck) is cut to the flat's curve: a scoop, or a V,
  // `front` cm deep at the centre front and `back` cm at the centre back.
  const armhole = opts.armhole;
  const cut = (...k) => {
    if (!armhole) return false;
    let x = 0, y = 0, z = 0;
    for (const v of k) { x += pos[v * 3]; y += pos[v * 3 + 1]; z += pos[v * 3 + 2]; }
    x = Math.abs(x / k.length); y /= k.length; z /= k.length;
    if (y > armhole.y && x > armhole.x) return true;
    const neck = armhole.neck;
    if (!neck || x >= neck.x) return false;
    const t = x / neck.x, depth = (z > 0 ? neck.front : neck.back) * (neck.v ? 1 - t : 1 - t * t);
    return y > neck.top - depth;
  };
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < N; i++) {
      if (gap(i)) continue;
      const a = j * row + i,
        b = a + 1,
        c = a + row,
        d = c + 1;
      if (cut(a, b, c, d)) continue;
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
    const vertex=(j,i)=>{const k=(j*(N+1)+i)*3;return new THREE.Vector3(pos[k],pos[k+1],pos[k+2]);};
    // Open garments: hem and neck trims run around the back between the two front edges.
    let right=N/2,left=N/2;
    if(open>0){while(gap(right))right++;while(gap(left-1))left--;}
    const columns=open>0?[...Array.from({length:N-right+1},(_,k)=>right+k),...Array.from({length:left},(_,k)=>k+1)]:Array.from({length:N},(_,i)=>i);
    for(const j of [opts.trimStart?0:null,opts.trimEnd?rings.length-1:null].filter(v=>v!==null)) {
      const curve=new THREE.CatmullRomCurve3(columns.map(i=>vertex(j,i)),!(open>0));
      const trim=new THREE.TubeGeometry(curve,N*2,(j===rings.length-1 && opts.neckDrop) ? .27 : .14,6,!(open>0));
      trim.userData.trim=true;result.push(trim);
    }
    // Front bands down both opening edges.
    if(open>0)for(const i of [right,left]) {
      const curve=new THREE.CatmullRomCurve3(rings.map((_,j)=>vertex(j,i)));
      const band=new THREE.TubeGeometry(curve,Math.max(8,rings.length*2),.32,6,false);
      band.userData.trim=true;result.push(band);
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

// Layering: an outer garment keeps clear of the garments already on the body.
// `under` is the merged envelope of those garments (see outfitEnvelope).
const LAYER_GAP = 0.7;
function clearUnder(ring, under) {
  const e = under?.torso(ring.c.y);
  if (!e) return ring;
  ring.r1 = Math.max(ring.r1, e.rx + LAYER_GAP);
  ring.r2 = Math.max(ring.r2, e.rz + LAYER_GAP);
  ring.minR1 = Math.max(ring.minR1 ?? 0, e.rx + LAYER_GAP);
  ring.minR2 = Math.max(ring.minR2 ?? 0, e.rz + LAYER_GAP);
  return ring;
}

// Cloth folds reach about a centimetre past each ring's nominal radius.
const FOLD = 1.2;
function torsoSamples(rings) {
  return rings.map((r) => [r.c.y, Math.abs(r.c.x) + r.r1 + FOLD, r.r2 + FOLD]);
}

/** Merge built garments' envelopes into lookups by height (torso) and sleeve distance. */
export function outfitEnvelope(envelopes) {
  const bins = new Map(), sleeves = [];
  const put = (y, rx, rz) => {
    const k = Math.round(y), cur = bins.get(k);
    if (!cur) bins.set(k, { rx, rz });
    else { cur.rx = Math.max(cur.rx, rx); cur.rz = Math.max(cur.rz, rz); }
  };
  for (const env of envelopes) {
    for (const piece of env.torso) {
      const list = [...piece].sort((a, b) => a[0] - b[0]);
      for (let i = 0; i < list.length; i++) {
        put(...list[i]);
        const next = list[i + 1];
        if (!next) continue;
        for (let y = Math.ceil(list[i][0]); y < next[0]; y++) {
          const t = (y - list[i][0]) / (next[0] - list[i][0] || 1);
          put(y, lerp(list[i][1], next[1], t), lerp(list[i][2], next[2], t));
        }
      }
    }
    sleeves.push(...env.sleeve);
  }
  return {
    torso(y) {
      let best = null;
      for (const k of [Math.floor(y), Math.ceil(y)]) {
        const b = bins.get(k);
        if (b) best = best ? { rx: Math.max(best.rx, b.rx), rz: Math.max(best.rz, b.rz) } : { ...b };
      }
      return best;
    },
    sleeve(t) {
      let r = 0;
      for (const [st, sr] of sleeves) if (Math.abs(st - t) < 2.6) r = Math.max(r, sr);
      return r;
    },
  };
}

function fitRing(M, y, Cg, flatY, extra = 0.6, under = null) {
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
  return clearUnder({ c: new THREE.Vector3(0, y, 0), e1: X, e2: Z, r1, r2, flatY, minR1: p.rx+extra, minR2: p.rz+extra, color: easeColor(Cg - Cb), ease: Cg - Cb }, under);
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
 * Returns { parts: [{geo, region}], checks, topY, envelope } for a garment on a body model.
 * opts.under: envelope of garments already worn beneath (outfitEnvelope), so this
 * one is built outside them; opts.open: leave the front open over those layers.
 * parts' uv map into a shared texture where the flat sketch (cm) lives at
 * u = 0.5 + x/texW, v = 1 - (flatY + margin)/texH.
 */
export function buildGarment(g, M, { under = null, open = false } = {}) {
  const kind = GARMENT_TYPES[g.type].kind;
  const lm = M.lm;
  const parts = [];
  const checks = []; // {label, ease}
  const envelope = { torso: [], sleeve: [] };
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
    const rings = ys.map((y) => fitRing(M, y, Cg(y), topY - y, 0.6, under));
    const strappy = ['tank', 'cami', 'vest', 'slipdress'].includes(g.type);
    const collared = ['buttonup', 'polo', 'jacket', 'coat'].includes(g.type);
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
        r1 = Math.max(M.neckR + 1.2, strappy ? T.nw : T.nw * 0.85);
        r2 = M.neckR + (collared ? 1.2 : 2.4);
      }
      rings.push(clearUnder({ c: new THREE.Vector3(0, u.y, u.w === 0 ? 0.6 : 0), e1: X, e2: Z, r1, r2, flatY: topY - u.y, color: [0.27, 0.65, 0.35] }, under));
    }
    const neckDrop = { tank: 5, cami: 6, slipdress: 5, vest: 8, cardigan: 7, buttonup: 2, polo: 2.2, blouse: 3.4 }[g.type] ?? 2.8;
    const opening = open ? (g.type === 'cardigan' || g.type === 'vest' ? 0.27 : 0.22) : 0;
    // Sleeveless cuts keep straps as wide as the flat's shoulder line (2D and 3D agree).
    // Their necklines follow the flat too: a scoop (a V on vests) as deep as the
    // flat's neck curve (0.8 × collar), shallower at the back.
    const armhole = strappy ? {
      y: lm.armpitY + 1, x: Math.max(g.shoulder / 2, T.nw + 1.5),
      neck: { top: topY + 1, x: T.nw, front: T.collar * 0.8, back: T.collar * 0.3, v: g.type === 'vest' },
    } : null;
    parts.push({ geo: ringSurface(rings, { segments: 64, cloth: true, material: g.material, trimStart: true, trimEnd: !strappy, neckDrop: strappy ? 0 : neckDrop, open: opening, armhole }), region: 'torso' });
    envelope.torso.push(torsoSamples(rings));
    const ringAt = (y) => rings.reduce((best, r) => (Math.abs(r.c.y - y) < Math.abs(best.c.y - y) ? r : best), rings[0]);
    if(g.type==='hoodie') parts.push({geo:frontPocket(rings,0,topY-g.length+27,27,16,topY),region:'pocket'});
    if(g.type==='buttonup') parts.push({geo:frontPocket(rings,-g.chest*.105,lm.chestY+2,11,12,topY),region:'pocket'});
    if(g.type==='jacket') for(const side of [-1,1]) parts.push({geo:frontPocket(rings,side*g.chest*.1,lm.chestY+3,10,11,topY),region:'pocket'});
    if(g.type==='coat') for(const side of [-1,1]) parts.push({geo:frontPocket(rings,side*g.chest*.12,lm.waistY-8,14,13,topY),region:'pocket'});
    const button=(x,y)=>{
      const r=ringAt(y),z=r.r2*Math.sqrt(Math.max(0,1-(x/r.r1)**2)),geo=new THREE.SphereGeometry(.52,16,10);
      geo.scale(1,1,.35);geo.translate(x,y,z+.8);geo.userData.button=true;
      parts.push({geo,region:'button'});
    };
    // Button stands: full fronts on shirts and closed outerwear, a short placket on polos.
    if (['buttonup', 'cardigan', 'jacket', 'coat', 'vest'].includes(g.type) && !open) {
      const start = g.type === 'cardigan' || g.type === 'vest' ? 16 : 7, step = g.type === 'coat' ? 11 : 9;
      for (let fy = start; fy < Math.min(g.length - 3, g.type === 'coat' ? 62 : g.length); fy += step) {
        if (g.type === 'coat') for (const x of [-4, 4]) button(x, topY - fy);
        else button(0, topY - fy);
      }
    }
    if (g.type === 'polo') for (const fy of [5, 9, 13]) button(0, topY - fy);
    if (collared) {
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
      // Sleeves are measured from the shoulder point; the ring frame starts at the joint.
      const reach = L - (lm.armLen - lm.wristT), toArm = lm.armLen / lm.wristT;
      for (const side of [-1, 1]) {
        const dir = M.armDir.clone();
        dir.x *= side;
        const joint = side < 0 ? M.jointL : M.jointR;
        const { e1, e2 } = armBasis(dir);
        const ts = sampleYs(reach, -M.upperR * 0.9, 3, [0]);
        const srings = ts.map((t) => {
          const br = M.armRAt(Math.min(t * toArm, lm.armLen));
          const Cb = 2 * Math.PI * br;
          const Cs = t <= 0 ? armholeC : lerp(armholeC, g.sleeveOpen, clamp(t / reach, 0, 1));
          // The rendered arm carries up to ~12% muscle volume over the measured radius.
          const skin = br * 1.12;
          let r = Math.max(skin + 0.5, Cs / (2 * Math.PI));
          // A domed sleeve cap closes over the deltoid instead of ending in a wide
          // ring above the shoulder line.
          if (t < 0) r = lerp(M.upperR * 0.35, r, Math.sqrt(clamp(1 + t / (M.upperR * 0.9), 0, 1)));
          const below = under?.sleeve(t) || 0;
          if (below) r = Math.max(r, below + LAYER_GAP);
          if (side > 0) envelope.sleeve.push([t, r + FOLD]);
          // flat mapping for the sleeve: along the flat sleeve direction
          const fx = side * (T.S[0] + Math.cos(T.theta) * Math.max(t, 0));
          const fy = T.S[1] + Math.sin(T.theta) * Math.max(t, 0);
          const floor = Math.max(skin + 0.8, below ? below + LAYER_GAP : 0);
          return { c: joint.clone().addScaledVector(dir, t), e1, e2, r1: r, r2: Math.max(r * 0.96, floor), minR1: floor, minR2: floor, flatY: fy, xOff: fx, color: easeColor(Cs - Cb), ease: Cs - Cb };
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
    const rings = ys.map((y) => fitRing(M, y, piecewise(keys, y), topY - y, 0.5, under));
    envelope.torso.push(torsoSamples(rings));
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
      envelope.torso.push(torsoSamples(lr.filter((r) => r.c.y < crotch)));
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
    const rings = ys.map((y) => fitRing(M, y, piecewise(keys, y), topY - y, 0.6, under));
    envelope.torso.push(torsoSamples(rings));
    parts.push({ geo: ringSurface(rings, { segments: 64, cloth: true, material: g.material, trimStart: true, trimEnd: true }), region: 'skirt' });
    checks.push({ label: 'Waist', ease: g.waist - M.b.waist });
    checks.push({ label: 'Hips', ease: g.hips - M.b.hips });
    checks.push({ label: 'Length', ease: null, text: hemY > lm.H * 0.285 ? 'above knee' : hemY > lm.H * 0.12 ? 'midi' : 'maxi' });
  }

  return { parts, checks, topY, envelope };
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

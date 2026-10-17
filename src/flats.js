// 2D "flat sketch" geometry for each garment, in centimetres (x right, y down, origin = top centre).
// Used by the closet editor and by every instruction diagram so the drawings match the real piece.

import { GARMENT_TYPES } from './state.js';
import { svgPattern } from './patterns.js';

// Generic shapes for non-garment pieces (strips, patches, panels), centred on x = 0.
export function rectShape(w, h, x = -w / 2, y = 0) {
  return { d: `M ${x} ${y} h ${w} v ${h} h ${-w} Z`, bbox: { x, y, w, h } };
}
export function polyShape(pts) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  const x = Math.min(...xs),
    y = Math.min(...ys);
  return { d: 'M ' + pts.map((p) => p.join(' ')).join(' L ') + ' Z', bbox: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
}
export function circleShape(r, cx = 0, cy = 0) {
  return { d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`, bbox: { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r } };
}

export function topLandmarks(g) {
  const kind = GARMENT_TYPES[g.type].kind;
  const cw = g.chest / 4;
  const sw = g.shoulder / 2;
  const collar = g.type === 'buttonup' ? 2.5 : g.type === 'hoodie' ? 4 : g.type === 'tank' ? 12 : 8;
  const nw = Math.min(sw - 3, g.type === 'tank' ? 11 : 8.5);
  const ad = Math.max(18, g.chest / 4.6) + (g.type === 'tank' ? 4 : 0);
  const length = g.length;
  const waistY = Math.min(length * 0.62, kind === 'dress' ? 40 : 46);
  const hasSleeves = GARMENT_TYPES[g.type].sleeves && g.sleeve > 0;
  const long = (g.sleeve || 0) > 35;
  const theta = ((long ? 62 : 32) * Math.PI) / 180;
  const S = [sw, 4];
  const A = [cw, ad];
  let E1 = null,
    E2 = null;
  if (hasSleeves) {
    const d = [Math.cos(theta), Math.sin(theta)];
    const n = [-Math.sin(theta), Math.cos(theta)];
    const L = g.sleeve;
    E1 = [S[0] + d[0] * L, S[1] + d[1] * L];
    const o = Math.max(g.sleeveOpen / 2, 7);
    E2 = [E1[0] + n[0] * o, E1[1] + n[1] * o];
    // keep the cuff from crossing the armpit for very short sleeves
    if (E2[0] < A[0] + 1) E2 = [A[0] + 1, E2[1]];
  }
  const W = [g.waist / 4, waistY];
  const H = [g.hem / 4, length];
  return { cw, sw, nw, collar, ad, length, waistY, S, A, E1, E2, W, H, hasSleeves, theta };
}

function topPath(g) {
  const L = topLandmarks(g);
  const right = [];
  right.push([L.nw, 0], L.S);
  if (L.hasSleeves) right.push(L.E1, L.E2);
  right.push(L.A);
  if (GARMENT_TYPES[g.type].kind === 'dress') {
    right.push(L.W, [L.W[0] + 2, L.W[1] + 12]);
  } else {
    right.push(L.W);
  }
  right.push(L.H);
  // build path: neck curve from left neck point through centre-front neck to right neck point
  const left = right.map(([x, y]) => [-x, y]).reverse();
  let d = `M ${-L.nw} 0 Q 0 ${L.collar * 1.6} ${L.nw} 0 `;
  for (let i = 1; i < right.length; i++) d += `L ${right[i][0]} ${right[i][1]} `;
  d += `L ${-L.H[0]} ${L.H[1]} `;
  for (let i = 1; i < left.length; i++) d += `L ${left[i][0]} ${left[i][1]} `;
  d += 'Z';
  const xs = [...right.map((p) => p[0])];
  const maxX = Math.max(...xs);
  return { d, bbox: { x: -maxX, y: 0, w: maxX * 2, h: Math.max(L.length, L.E2 ? L.E2[1] : 0) }, L };
}

export function bottomLandmarks(g) {
  const hw = g.waist / 4;
  const hh = g.hips / 4;
  const rise = g.rise;
  const lo = g.legOpen / 2;
  const xc = Math.max(hh / 2 + 1, lo / 2 + 1);
  const hemY = rise + g.inseam;
  return { hw, hh, rise, lo, xc, hemY, hipY: rise * 0.65 };
}

function bottomPath(g) {
  const B = bottomLandmarks(g);
  // right side goes down, then crotch, then left side back up
  const ordered = [
    [-B.hw, 0],
    [B.hw, 0],
    [B.hh, B.hipY],
    [B.hh + 0.5, B.rise],
    [B.xc + B.lo / 2, B.hemY],
    [B.xc - B.lo / 2, B.hemY],
    [0, B.rise + 1.5],
    [-(B.xc - B.lo / 2), B.hemY],
    [-(B.xc + B.lo / 2), B.hemY],
    [-(B.hh + 0.5), B.rise],
    [-B.hh, B.hipY],
  ];
  const d = 'M ' + ordered.map((p) => p.join(' ')).join(' L ') + ' Z';
  const maxX = Math.max(B.xc + B.lo / 2, B.hh + 0.5);
  return { d, bbox: { x: -maxX, y: 0, w: maxX * 2, h: B.hemY }, L: B };
}

export function skirtLandmarks(g) {
  return { hw: g.waist / 4, hh: g.hips / 4, hipY: Math.min(18, g.length * 0.4), hemW: g.hem / 4, length: g.length };
}

function skirtPath(g) {
  const K = skirtLandmarks(g);
  const hemHalf = Math.max(K.hemW, K.hh);
  const d = `M ${-K.hw} 0 L ${K.hw} 0 Q ${K.hh + 0.5} ${K.hipY * 0.6} ${K.hh} ${K.hipY} L ${hemHalf} ${K.length} L ${-hemHalf} ${K.length} L ${-K.hh} ${K.hipY} Q ${-K.hh - 0.5} ${K.hipY * 0.6} ${-K.hw} 0 Z`;
  return { d, bbox: { x: -hemHalf, y: 0, w: hemHalf * 2, h: K.length }, L: K };
}

export function flatShape(g) {
  const k = GARMENT_TYPES[g.type].kind;
  if (k === 'bottom') return bottomPath(g);
  if (k === 'skirt') return skirtPath(g);
  return topPath(g);
}

// Decorative details (seams, buttons, pockets, hood, waistband) as SVG markup in cm space.
function details(g, shape) {
  const k = GARMENT_TYPES[g.type].kind;
  const L = shape.L;
  const st = 'fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".35" stroke-dasharray="1 .8"';
  let s = '';
  if (k === 'top' || k === 'dress') {
    if (L.hasSleeves) {
      s += `<path d="M ${L.S[0]} ${L.S[1]} L ${L.A[0]} ${L.A[1]}" ${st}/><path d="M ${-L.S[0]} ${L.S[1]} L ${-L.A[0]} ${L.A[1]}" ${st}/>`;
    }
    if (g.type === 'buttonup') {
      s += `<line x1="0" y1="${L.collar * 1.6}" x2="0" y2="${L.length}" stroke="rgba(0,0,0,.4)" stroke-width=".35"/>`;
      for (let y = 6; y < L.length - 3; y += 9) s += `<circle cx="1.2" cy="${y}" r=".7" fill="#eee" stroke="rgba(0,0,0,.4)" stroke-width=".2"/>`;
      s += `<path d="M ${-L.nw} 0 L -2 6 L 0 ${L.collar * 1.6} L 2 6 L ${L.nw} 0" fill="none" stroke="rgba(0,0,0,.45)" stroke-width=".4"/>`;
    }
    if (g.type === 'hoodie') {
      s += `<path d="M ${-L.nw - 1} 0 Q 0 -14 ${L.nw + 1} 0" fill="none" stroke="rgba(0,0,0,.4)" stroke-width=".5"/>`;
      s += `<rect x="-12" y="${L.length - 26}" width="24" height="16" rx="3" ${st}/>`;
      s += `<line x1="${-L.H[0]}" y1="${L.length - 6}" x2="${L.H[0]}" y2="${L.length - 6}" ${st}/>`;
    }
    if (g.type === 'sweater') s += `<line x1="${-L.H[0]}" y1="${L.length - 5}" x2="${L.H[0]}" y2="${L.length - 5}" ${st}/>`;
    if (k !== 'dress' && g.type !== 'hoodie' && g.type !== 'sweater') s += `<line x1="${-L.H[0]}" y1="${L.length - 2}" x2="${L.H[0]}" y2="${L.length - 2}" ${st}/>`;
  }
  if (k === 'bottom') {
    s += `<line x1="${-L.hw}" y1="4" x2="${L.hw}" y2="4" ${st}/>`;
    s += `<path d="M ${-L.hw + 2} 4 Q ${-L.hw + 8} 12 ${-L.hh + 1} 13" ${st}/><path d="M ${L.hw - 2} 4 Q ${L.hw - 8} 12 ${L.hh - 1} 13" ${st}/>`;
    s += `<path d="M 0 4 L 0 ${L.rise - 4} Q 1 ${L.rise} 0 ${L.rise + 1.5}" ${st}/>`;
    s += `<circle cx="0" cy="2" r=".8" fill="#c9a24a"/>`;
  }
  if (k === 'skirt') s += `<line x1="${-L.hw}" y1="3.5" x2="${L.hw}" y2="3.5" ${st}/>`;
  return s;
}

let uid = 0;

/**
 * Render a garment flat as an SVG string.
 * opts.overlays: [{type:'cut'|'stitch'|'fold'|'remove'|'add'|'label'|'dim'|'arrow'|'mark', ...}]
 * opts.ghost: render garment faded (for "after" style steps)
 * opts.transform: optional garment override (e.g. shortened) for the drawn shape
 */
export function flatSVG(g, opts = {}) {
  const id = 'f' + uid++;
  const custom = !!opts.shape;
  const shape = opts.shape || flatShape(opts.shapeOverride || g);
  const pad = opts.pad ?? 14;
  const extra = opts.extraBox;
  const hood = !custom && g.type === 'hoodie' ? 10 : 0;
  let bx = shape.bbox.x - pad,
    by = shape.bbox.y - pad - hood,
    bw = shape.bbox.w + pad * 2,
    bh = shape.bbox.h + pad * 2 + hood;
  if (extra) {
    const x2 = Math.max(bx + bw, extra.x + extra.w + 4),
      y2 = Math.max(by + bh, extra.y + extra.h + 4);
    bx = Math.min(bx, extra.x - 4);
    by = Math.min(by, extra.y - 4);
    bw = x2 - bx;
    bh = y2 - by;
  }
  const k = Math.max(0.12, Math.min(1.5, bw / 100));
  const defs = [
    svgPattern(id + 'p', g, 1),
    `<clipPath id="${id}c"><path d="${shape.d}"/></clipPath>`,
    `<pattern id="${id}h" patternUnits="userSpaceOnUse" width="${2 * k}" height="${2 * k}" patternTransform="rotate(45)"><rect width="${2 * k}" height="${2 * k}" fill="rgba(229,72,77,.18)"/><line x1="0" y1="0" x2="0" y2="${2 * k}" stroke="#e5484d" stroke-width="${0.5 * k}"/></pattern>`,
    `<marker id="${id}a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#1d1d1f"/></marker>`,
  ];
  if (opts.donor) defs.push(svgPattern(id + 'd', opts.donor, 1));
  let body = '';
  const op = opts.ghost ? 0.35 : 1;
  body += `<g opacity="${op}"><path d="${shape.d}" fill="url(#${id}p)" stroke="#1d1d1f" stroke-width="${0.6 * k}" stroke-linejoin="round"/>`;
  if (!custom) {
    if (g.sketch && g.sketchBox && opts.sketch !== false) {
      const b = g.sketchBox;
      body += `<image href="${g.sketch}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" clip-path="url(#${id}c)" preserveAspectRatio="none"/>`;
    }
    if (g.stains && opts.flaws !== false) body += stainMarks(g, shape);
    if (g.holes && opts.flaws !== false) body += holeMarks(g, shape);
    body += details(g, shape);
  }
  body += '</g>';
  body += renderOverlays(opts.overlays || [], id, k);
  const w = opts.width || 320;
  return `<svg class="flat" viewBox="${bx} ${by} ${bw} ${bh}" width="${w}" style="max-width:100%;height:auto" xmlns="http://www.w3.org/2000/svg"><defs>${defs.join('')}</defs>${body}</svg>`;
}

export function flawSpots(g) {
  const shape = flatShape(g);
  const k = GARMENT_TYPES[g.type].kind;
  const L = shape.L;
  if (k === 'bottom') return { stain: [-L.hh * 0.5, L.rise + 12], hole: [L.xc, L.rise + g.inseam * 0.45] };
  if (k === 'skirt') return { stain: [L.hh * 0.4, L.length * 0.5], hole: [-L.hh * 0.3, L.length * 0.75] };
  return { stain: [L.cw * 0.45, L.length * 0.42], hole: [-L.cw * 0.35, L.length * 0.7] };
}

function stainMarks(g, shape) {
  const [x, y] = flawSpots(g).stain;
  return `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="2.4" fill="#8a6d3b" opacity=".45"/><ellipse cx="${x + 1.5}" cy="${y + 1}" rx="1.4" ry="1" fill="#6b4f22" opacity=".4"/>`;
}
function holeMarks(g, shape) {
  const [x, y] = flawSpots(g).hole;
  return `<path d="M ${x - 1.5} ${y} q 1 -1.6 2.2 -.4 q 1.2 1 .2 1.8 q -1.4 .9 -2.4 -1.4z" fill="#fff" stroke="#333" stroke-width=".25"/>`;
}

function renderOverlays(list, id, k = 1) {
  let s = '';
  const n = (v) => +(v * k).toFixed(3);
  const textAttrs = (size, weight, color, anchor = 'middle') =>
    `font-size="${size}" text-anchor="${anchor}" font-family="Inter, sans-serif" font-weight="${weight}" fill="${color}" paint-order="stroke" stroke="#fff" stroke-width="${n(0.9)}"`;
  for (const o of list) {
    const pts = (o.pts || []).map((p) => p.join(',')).join(' ');
    switch (o.type) {
      case 'remove':
        s += `<polygon points="${pts}" fill="url(#${id}h)" stroke="none"/>`;
        break;
      case 'add':
        s += `<polygon points="${pts}" fill="${o.fill === 'donor' ? `url(#${id}d)` : o.fill || 'rgba(70,167,88,.35)'}" stroke="#2f7d3c" stroke-width="${n(0.6)}" stroke-dasharray="${n(1.5)} ${n(1)}"/>`;
        break;
      case 'cut':
        s += `<polyline points="${pts}" fill="none" stroke="#e5484d" stroke-width="${n(0.9)}" stroke-dasharray="${n(2.4)} ${n(1.2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        if (o.scissors !== false && o.pts?.length) {
          const [x, y] = o.pts[0];
          s += `<text x="${x - n(1)}" y="${y + n(1.6)}" font-size="${n(5)}" text-anchor="end" fill="#e5484d">✂</text>`;
        }
        break;
      case 'stitch':
        s += `<polyline points="${pts}" fill="none" stroke="#0b6bcb" stroke-width="${n(0.7)}" stroke-dasharray="${n(0.9)} ${n(0.9)}" stroke-linejoin="round"/>`;
        break;
      case 'fold':
        s += `<polyline points="${pts}" fill="none" stroke="#8e4ec6" stroke-width="${n(0.6)}" stroke-dasharray="${n(3)} ${n(1)} ${n(0.6)} ${n(1)}"/>`;
        break;
      case 'arrow':
        s += `<line x1="${o.a[0]}" y1="${o.a[1]}" x2="${o.b[0]}" y2="${o.b[1]}" stroke="#1d1d1f" stroke-width="${n(0.5)}" marker-end="url(#${id}a)"/>`;
        break;
      case 'dim': {
        const [ax, ay] = o.a,
          [bx, by] = o.b;
        const mx = (ax + bx) / 2,
          my = (ay + by) / 2;
        s += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#1d1d1f" stroke-width="${n(0.35)}" marker-start="url(#${id}a)" marker-end="url(#${id}a)"/>`;
        s += `<text x="${mx + n(o.dx || 0)}" y="${my + n(o.dy ?? -1.2)}" ${textAttrs(o.size || n(3.4), 600, '#1d1d1f')}>${o.text}</text>`;
        break;
      }
      case 'label':
        s += `<text x="${o.x}" y="${o.y}" ${textAttrs(o.size || n(3.2), o.weight || 500, o.color || '#1d1d1f', o.anchor || 'middle')}>${o.text}</text>`;
        break;
      case 'mark':
        s += `<circle cx="${o.x}" cy="${o.y}" r="${o.r || n(1)}" fill="${o.color || '#e5484d'}"/>`;
        break;
      case 'shape':
        s += o.svg;
        break;
    }
  }
  return s;
}

// The viewBox flatSVG uses for a garment (no overlays / extraBox), so canvases can line up with it.
export function flatViewBox(g, pad = 14) {
  const shape = flatShape(g);
  const hood = g.type === 'hoodie' ? 10 : 0;
  return { x: shape.bbox.x - pad, y: shape.bbox.y - pad - hood, w: shape.bbox.w + pad * 2, h: shape.bbox.h + pad * 2 + hood };
}

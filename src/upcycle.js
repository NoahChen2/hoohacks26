// Upcycle suggestion engine.
// Every project inspects the actual garment (measurements, fabric, pattern, flaws), the wearer's body
// and the tools on hand, then emits customised steps with real-measurement 2D diagrams.

import { GARMENT_TYPES, MATERIALS, TOOLS } from './state.js';
import { bodyModel, perim } from './model.js';
import { flatSVG, topLandmarks, bottomLandmarks, skirtLandmarks, flawSpots, rectShape, polyShape, circleShape } from './flats.js';
import { PATTERN_LABELS } from './patterns.js';
import { escapeHtml } from './ui/escape.js';

// ---------------------------------------------------------------- helpers

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const r1 = (v) => Math.round(v * 2) / 2; // nearest 0.5 cm
const lbl = (cm) => `${r1(cm)} cm`;

export function inch(cm) {
  const v = cm / 2.54;
  let whole = Math.floor(v);
  let q = Math.round((v - whole) * 4);
  if (q === 4) {
    whole++;
    q = 0;
  }
  const frac = ['', '¼', '½', '¾'][q];
  return `${whole || (frac ? '' : '0')}${frac}″`;
}
export const fmt = (cm) => `<b>${r1(cm)} cm</b> <span class="in">(${inch(cm)})</span>`;

function bez(p0, p1, p2, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      a = (1 - t) * (1 - t),
      b = 2 * (1 - t) * t,
      c = t * t;
    out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return out;
}
const mx = (pts) => pts.map(([x, y]) => [-x, y]);
const both = (o) => [o, { ...o, pts: mx(o.pts), scissors: false }];

function piecewise(keys, x) {
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

// Half-width of the garment flat at flat-y (tops, dresses, skirts).
function sideX(g, y) {
  const kind = GARMENT_TYPES[g.type].kind;
  if (kind === 'skirt') {
    const K = skirtLandmarks(g);
    return piecewise(
      [
        [0, K.hw],
        [K.hipY, K.hh],
        [K.length, Math.max(K.hemW, K.hh)],
      ],
      y
    );
  }
  const T = topLandmarks(g);
  const keys = [[T.A[1], T.A[0]], [T.W[1], T.W[0]]];
  if (kind === 'dress') keys.push([T.W[1] + 12, T.W[0] + 2]);
  keys.push([T.H[1], T.H[0]]);
  return piecewise(keys, y);
}

// Leg edges of a bottoms flat at flat-y: {outer, inner} on the right leg.
function legAt(g, y) {
  const B = bottomLandmarks(g);
  const t = clamp((y - B.rise) / (B.hemY - B.rise || 1), 0, 1);
  return { outer: lerp(B.hh + 0.5, B.xc + B.lo / 2, t), inner: lerp(0, B.xc - B.lo / 2, t) };
}

function patternTip(g, verb = 'cut') {
  switch (g.pattern) {
    case 'stripes':
      return `Horizontal stripes: shift your ${verb} line to the nearest stripe edge so it reads perfectly straight.`;
    case 'vstripes':
      return 'Pinstripes: keep the stripes vertical when you pin, otherwise the piece will look twisted.';
    case 'plaid':
    case 'gingham':
      return `${PATTERN_LABELS[g.pattern]}: ${verb} along one of the woven lines and match the checks across any seam (pin at each line).`;
    case 'floral':
    case 'polka':
      return `${PATTERN_LABELS[g.pattern]} prints hide small wobbles, so this is very forgiving. Use a thread matching the base colour.`;
    case 'denim':
      return 'Denim frays beautifully. Decide now if you want a raw, fringed edge or a clean hem.';
    default:
      return 'Solid fabric shows every line. Chalk it with a ruler and take your time.';
  }
}

function finishTip(g, c) {
  const m = MATERIALS[g.material];
  if (m.knit) return `${m.label} doesn't fray. Leave the edge raw, or give it a gentle stretch so it curls into a soft roll.`;
  if (c.canSew) return `${m.label} frays: fold the edge under 1 cm, then 1.5 cm again, press, and ${c.sewVerb}.`;
  if (c.has('glue')) return `${m.label} frays: fold under 1.5 cm and fuse with hem tape (iron on cotton setting, 10 s per section).`;
  return `${m.label} frays: either embrace a raw fringe (wash once to fluff it) or zig-zag cut the edge to slow fraying.`;
}

// ---------------------------------------------------------------- context

export function makeContext(g, body, closet, tools) {
  const M = bodyModel(body);
  const lm = M.lm;
  const kind = GARMENT_TYPES[g.type].kind;
  const has = (t) => !!tools[t];
  const canSew = has('needle') || has('machine');
  const sewVerb = has('machine') ? 'machine-stitch (straight stitch, length 2.5)' : 'hand backstitch with stitches about 3 mm apart';
  const fit = {};
  let topY;
  if (kind === 'top' || kind === 'dress') {
    topY = lm.neckBaseY + 0.5;
    fit.chest = g.chest - body.chest;
    fit.waist = g.waist - body.waist;
    fit.hemY = topY - g.length;
    if (g.sleeve) fit.sleeveOver = g.sleeve - body.arm;
    if (g.sleeveOpen) fit.sleeveEase = g.sleeveOpen - 2 * Math.PI * M.armRAt(Math.min(g.sleeve, lm.armLen));
  } else if (kind === 'bottom') {
    topY = Math.min(lm.crotchY + g.rise, lm.waistY + 4);
    fit.waist = g.waist - M.circAt(topY);
    fit.hips = g.hips - body.hips;
    fit.inseamOver = g.inseam - body.inseam;
  } else {
    topY = lm.waistY;
    fit.waist = g.waist - body.waist;
    fit.hips = g.hips - body.hips;
    fit.hemY = topY - g.length;
  }
  // a donor fabric from elsewhere in the closet for patches / panels
  const others = closet.filter((o) => o.id !== g.id);
  const sameFamily = others.filter((o) => MATERIALS[o.material].knit === MATERIALS[g.material].knit);
  const donor = (sameFamily.find((o) => o.pattern !== g.pattern) || sameFamily[0] || others[0]) ?? null;
  return { g, body, M, lm, kind, has, canSew, sewVerb, fit, topY, donor, mat: MATERIALS[g.material] };
}

// ---------------------------------------------------------------- projects

const P = [];

// 1. Crop top ------------------------------------------------------------
P.push({
  id: 'crop',
  title: 'Cropped top',
  icon: '✂️',
  difficulty: 1,
  time: '20 min',
  needs: [['scissors']],
  check(c) {
    if (c.kind !== 'top') return null;
    const finished = c.topY - (c.lm.waistY - 1);
    if (c.g.length - finished < 6) return null;
    const why = [`It's ${lbl(c.g.length)} long. Cropping to ${lbl(finished)} puts the hem right at your natural waist, the classic cropped length.`];
    let score = 55;
    if (c.fit.chest > 20) {
      score += 20;
      why.push(`With ${lbl(c.fit.chest)} of extra room at the chest it'll crop into a relaxed, boxy fit.`);
    } else if (c.fit.chest < 0) {
      score -= 15;
      why.push('It is tight at the chest, so cropping alone won’t fix the fit.');
    }
    const spots = flawSpots(c.g);
    if ((c.g.stains && spots.stain[1] > finished) || (c.g.holes && spots.hole[1] > finished)) {
      score += 15;
      why.push('Bonus: the cut removes the damaged area.');
    }
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const finished = c.topY - (c.lm.waistY - 1);
    const allow = c.mat.knit ? 0 : c.canSew ? 2.5 : c.has('glue') ? 1.5 : 0;
    const cut = finished + allow;
    const sx = sideX(g, cut);
    const dimX = Math.max(T.H[0], T.A[0], T.E2 ? T.E2[0] : 0) + 5;
    const offH = g.length - cut;
    const loops = Math.floor(offH / 10);
    const after = this.after(c);
    return [
      {
        title: 'Measure & mark',
        text: `Lay the ${escapeHtml(g.name.toLowerCase())} flat, front up, smoothing out wrinkles. From the top of the shoulder seam (where it meets the collar) measure ${fmt(cut)} straight down. Mark this at both sides and the centre, then join the marks with chalk or pins.${allow ? ` That includes ${fmt(allow)} for the hem.` : ''}<br><em>${patternTip(g)}</em>`,
        svg: flatSVG(g, {
          overlays: [
            { type: 'dim', a: [dimX, 0], b: [dimX, cut], text: lbl(cut), dx: 5, dy: 0 },
            { type: 'cut', pts: [[-sx, cut], [sx, cut]] },
            { type: 'mark', x: -sx + 2, y: cut },
            { type: 'mark', x: 0, y: cut },
            { type: 'mark', x: sx - 2, y: cut },
          ],
        }),
      },
      {
        title: 'Cut through both layers',
        text: `Cut along the line through front and back together. Keep the offcut: it's a ${fmt(g.hem)} loop that's ${fmt(offH)} tall${loops ? `, enough for ${loops} scrunch${loops > 1 ? 'ies' : 'ie'} or a headband` : ''}.`,
        svg: flatSVG(g, {
          overlays: [
            { type: 'remove', pts: [[-sx, cut], [sx, cut], [T.H[0], g.length], [-T.H[0], g.length]] },
            { type: 'cut', pts: [[-sx, cut], [sx, cut]] },
            { type: 'label', x: 0, y: (cut + g.length) / 2 + 1, text: 'offcut', weight: 600, color: '#c1272d' },
          ],
        }),
      },
      {
        title: 'Finish the edge',
        text: finishTip(g, c) + (c.mat.knit ? '' : allow ? ` The ${fmt(allow)} you added is the hem allowance.` : ''),
        svg: flatSVG(after, {
          overlays: allow && c.canSew ? [{ type: 'stitch', pts: [[-sideX(after, finished - 1.2), finished - 1.2], [sideX(after, finished - 1.2), finished - 1.2]] }] : [],
        }),
      },
    ];
  },
  after(c) {
    const finished = c.topY - (c.lm.waistY - 1);
    const hemHalf = sideX(c.g, finished);
    return { ...c.g, length: finished, hem: hemHalf * 4, waist: Math.min(c.g.waist, Math.max(hemHalf * 4, c.g.chest * 0.9)) };
  },
});

// 2. Muscle tank -----------------------------------------------------------
P.push({
  id: 'tank',
  title: 'Muscle tank (sleeveless)',
  icon: '💪',
  difficulty: 1,
  time: '15 min',
  needs: [['scissors']],
  check(c) {
    if (c.kind !== 'top' || !topLandmarks(c.g).hasSleeves || c.g.type === 'buttonup') return null;
    let score = 45;
    const why = [];
    if (c.fit.sleeveEase != null && c.fit.sleeveEase < 0) {
      score += 25;
      why.push(`The sleeves are ${lbl(-c.fit.sleeveEase)} too tight around your arms, so removing them fixes that.`);
    }
    if (c.fit.chest > 16) {
      score += 10;
      why.push('The loose body drapes well with deep, open armholes.');
    }
    if (!c.mat.knit) {
      score -= 10;
      why.push(`${c.mat.label} frays, so you'll want to finish the armholes.`);
    }
    if (!why.length) why.push('A quick, no-sew way to get a summer piece from a tee.');
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const d = c.fit.chest > 16 ? 6 : 4;
    const Sp = [T.S[0] - 2, T.S[1] + 0.6];
    const Ay = T.A[1] + d;
    const Ap = [sideX(g, Ay), Ay];
    const curve = bez(Sp, [Sp[0] - 2.5, Ay - 1], Ap, 10);
    const removeR = [T.S, T.E1, T.E2, T.A, Ap, ...curve.slice().reverse()];
    return [
      {
        title: 'Fold in half',
        text: 'Fold the shirt in half lengthwise, matching the side seams and sleeves, so both armholes are cut in one go and come out identical.',
        svg: flatSVG(g, { overlays: [{ type: 'fold', pts: [[0, -4], [0, g.length + 4]] }, { type: 'arrow', a: [-T.A[0], g.length * 0.5], b: [-4, g.length * 0.5] }, { type: 'label', x: 0, y: -6, text: 'fold line' }] }),
      },
      {
        title: 'Cut the new armhole',
        text: `Start ${fmt(2)} in from the shoulder seam and curve down to ${fmt(d)} below the original underarm, finishing on the side seam. Cut through all layers. The deeper drop suits ${c.fit.chest > 16 ? 'this roomy fit' : 'a closer fit'} without showing too much.`,
        svg: flatSVG(g, {
          overlays: [
            { type: 'remove', pts: removeR },
            { type: 'remove', pts: mx(removeR) },
            ...both({ type: 'cut', pts: curve }),
            { type: 'dim', a: [Ap[0] + 4, T.A[1]], b: [Ap[0] + 4, Ay], text: lbl(d), dx: 5, dy: 1, size: 3 },
          ],
        }),
      },
      {
        title: 'Finish',
        text: finishTip(g, c) + ' Keep the sleeves: two tubes make cuffs, a headband, or patch fabric.',
        svg: flatSVG(this.after(c)),
      },
    ];
  },
  after(c) {
    const T = topLandmarks(c.g);
    return { ...c.g, sleeve: 0, sleeveOpen: 0, shoulder: Math.max(28, 2 * (T.S[0] - 2)) };
  },
});

// 3. No-sew tote -----------------------------------------------------------
P.push({
  id: 'tote',
  title: 'T-shirt tote bag',
  icon: '👜',
  difficulty: 1,
  time: '25 min',
  needs: [['scissors']],
  check(c) {
    if (c.kind !== 'top' || c.g.type === 'buttonup' || c.g.type === 'hoodie') return null;
    if (!c.mat.knit && !c.canSew) return null;
    let score = 40;
    const why = [];
    if (c.fit.chest < 0) {
      score += 35;
      why.push(`It's ${lbl(-c.fit.chest)} too small at the chest to wear comfortably, but it's still useful as a bag.`);
    }
    if (c.g.stains || c.g.holes) {
      score += 10;
      why.push('Flaws matter much less on a bag.');
    }
    const T = topLandmarks(c.g);
    why.push(`It makes a bag about ${lbl(T.H[0] * 2)} wide × ${lbl(c.g.length - T.A[1] - 9)} deep.`);
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const handle = 7;
    const scoopHalf = Math.max(T.nw + 2, T.S[0] - handle);
    const scoopDepth = T.A[1] + 6;
    const fringe = 9;
    const sewBottom = !c.mat.knit || c.canSew;
    const scoop = bez([-scoopHalf, 0], [-scoopHalf * 0.9, scoopDepth * 1.25], [0, scoopDepth], 8).concat(bez([0, scoopDepth], [scoopHalf * 0.9, scoopDepth * 1.25], [scoopHalf, 0], 8).slice(1));
    const steps = [];
    const sleeveRm = T.hasSleeves ? [T.S, T.E1, T.E2, T.A] : null;
    if (sleeveRm) {
      steps.push({
        title: 'Cut off the sleeves',
        text: 'Cut just inside the sleeve seams, through both layers. Cutting inside the stitching keeps the bag body intact.',
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: sleeveRm }, { type: 'remove', pts: mx(sleeveRm) }, ...both({ type: 'cut', pts: [T.S, T.A] })] }),
      });
    }
    steps.push({
      title: 'Scoop the opening',
      text: `Cut a U from the neckline, ${fmt(scoopHalf * 2)} wide and ${fmt(scoopDepth)} deep. That leaves ${fmt(handle)} straps over the shoulders as handles. Cut front and back together.`,
      svg: flatSVG(g, {
        overlays: [
          ...(sleeveRm ? [{ type: 'remove', pts: sleeveRm }, { type: 'remove', pts: mx(sleeveRm) }] : []),
          { type: 'remove', pts: [...scoop] },
          { type: 'cut', pts: scoop },
          { type: 'dim', a: [-scoopHalf, -4], b: [scoopHalf, -4], text: lbl(scoopHalf * 2) },
          { type: 'dim', a: [scoopHalf + 4, 0], b: [scoopHalf + 4, scoopDepth], text: lbl(scoopDepth), dx: 5, dy: 0 },
        ],
      }),
    });
    const hx = T.H[0];
    if (sewBottom) {
      steps.push({
        title: 'Close the bottom',
        text: `Turn inside out and ${c.sewVerb} straight across the hem, ${fmt(1.5)} from the edge. Then box the corners: pinch each bottom corner into a triangle and stitch across it ${fmt(5)} from the tip, which gives the bag a flat base.`,
        svg: flatSVG(g, { overlays: [{ type: 'stitch', pts: [[-hx, g.length - 1.5], [hx, g.length - 1.5]] }, { type: 'stitch', pts: [[hx - 5, g.length - 1.5], [hx, g.length - 6.5]] }, { type: 'stitch', pts: [[-hx + 5, g.length - 1.5], [-hx, g.length - 6.5]] }] }),
      });
    } else {
      const n = Math.floor((hx * 2) / 2.5);
      const lines = [];
      for (let i = 1; i < n; i++) {
        const x = -hx + i * 2.5;
        lines.push({ type: 'cut', pts: [[x, g.length], [x, g.length - fringe]], scissors: i === 1 });
      }
      steps.push({
        title: 'Cut the fringe',
        text: `Cut ${n - 1} slits up from the hem, ${fmt(fringe)} deep and ${fmt(2.5)} apart, through both layers. That gives ${n} pairs of strips. Cut away the small hem corners first so the fringe lies flat.`,
        svg: flatSVG(g, { overlays: [...lines, { type: 'dim', a: [hx + 4, g.length - fringe], b: [hx + 4, g.length], text: lbl(fringe), dx: 5, dy: 0 }] }),
      });
      steps.push({
        title: 'Tie it closed',
        text: 'Double-knot each front strip to the back strip directly behind it. Then tie each knotted pair to its neighbour, which closes the gaps so small things don’t fall out.',
        svg: flatSVG(g, { overlays: Array.from({ length: n }, (_, i) => ({ type: 'mark', x: -hx + 1.25 + i * 2.5, y: g.length - fringe + 1.5, r: 0.9, color: '#1d1d1f' })) }),
      });
    }
    const bagW = hx * 2,
      bagD = g.length - T.A[1] - (sewBottom ? 2 : fringe);
    steps.push({ title: 'Done', text: `The bag's main section is about ${fmt(bagW)} × ${fmt(bagD)}, roughly ${Math.round((bagW * bagD * bagW * 0.25) / 1000)} L, which fits groceries or a laptop sleeve.`, svg: '' });
    return steps;
  },
});

// 4. T-shirt yarn ----------------------------------------------------------
P.push({
  id: 'yarn',
  title: 'T-shirt yarn',
  icon: '🧶',
  difficulty: 1,
  time: '30 min',
  needs: [['scissors']],
  check(c) {
    if (c.kind !== 'top' || !c.mat.knit || c.g.type === 'hoodie') return null;
    const T = topLandmarks(c.g);
    const tubeH = c.g.length - T.A[1] - 2;
    const metres = ((Math.floor((tubeH - 5) / 2.5) * c.g.hem) / 100) * 1.15;
    let score = 30;
    const why = [`It yields about ${Math.round(metres)} m of chunky yarn, enough for a ${metres > 25 ? 'small rug or basket' : 'coaster set or plant hanger'}.`];
    if (c.g.stains || c.g.holes) {
      score += 30;
      why.push('Stains and holes disappear once the fabric is cut into yarn.');
    }
    if (c.fit.chest < 0) score += 10;
    return { score, why, metres };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const cutY = T.A[1] + 2;
    const tubeH = g.length - cutY;
    const w = T.H[0] * 2;
    const n = Math.floor((tubeH - 5) / 2.5);
    const metres = ((n * g.hem) / 100) * 1.15;
    const tube = rectShape(w, tubeH);
    const strips = [];
    for (let i = 1; i <= n; i++) strips.push({ type: 'cut', pts: [[-w / 2 + 5, tubeH - i * 2.5], [w / 2, tubeH - i * 2.5]], scissors: false });
    return [
      {
        title: 'Cut off the top',
        text: `Cut straight across just under the arms, ${fmt(cutY)} below the shoulder. Cut off the hem band too. You're left with a tube ${fmt(tubeH)} tall.`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: [[-T.A[0] - 30, -10], [T.A[0] + 30, -10], [T.A[0] + 30, cutY], [-T.A[0] - 30, cutY]] }, { type: 'cut', pts: [[-sideX(g, cutY), cutY], [sideX(g, cutY), cutY]] }] }),
      },
      {
        title: 'Cut strips, leaving a band',
        text: `Lay the tube flat. Cut ${n} strips ${fmt(2.5)} wide through both layers, starting at the right edge and stopping ${fmt(5)} before the left edge. That uncut band holds everything together.`,
        svg: flatSVG(g, { shape: tube, pad: 6, overlays: [...strips, { type: 'fold', pts: [[-w / 2 + 5, 0], [-w / 2 + 5, tubeH]] }, { type: 'label', x: -w / 2 + 2.5, y: tubeH / 2, text: 'band', size: 2.6 }] }),
      },
      {
        title: 'Cut diagonally across the band',
        text: 'Open the band and slip it over your arm. Cut diagonally from the edge to the first slit, then from each slit to the next one along. The strips join into one continuous spiral.',
        svg: flatSVG(g, {
          shape: rectShape(10, tubeH),
          pad: 4,
          overlays: Array.from({ length: Math.min(n, 12) }, (_, i) => ({ type: 'cut', pts: [[-5, tubeH - i * 2.5], [5, tubeH - (i + 1) * 2.5]], scissors: i === 0 })),
        }),
      },
      { title: 'Stretch & roll', text: `Pull the strand firmly, arm's length at a time. The edges curl into round yarn. Wind it into a ball; expect about ${Math.round(metres)} m.`, svg: '' },
    ];
  },
});

// 5. Paint your sketch -----------------------------------------------------
P.push({
  id: 'paint',
  title: 'Paint your design on',
  icon: '🎨',
  difficulty: 2,
  time: '1 h + drying',
  needs: [['paint']],
  check(c) {
    let score = c.g.sketch ? 60 : 25;
    const why = [];
    if (c.g.sketch) why.push('Turn your sketch into a real hand-painted design, placed exactly where you drew it.');
    else why.push('Draw a design in the Closet tab and this guide will scale it to real measurements.');
    if (c.g.stains) {
      score += 20;
      why.push('Placing the design over the stain hides it completely.');
    }
    if (c.g.pattern === 'solid') {
      score += 10;
      why.push('Solid fabric is the ideal canvas.');
    }
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const kind = c.kind;
    let box = g.sketchBounds;
    if (!box) {
      const s = flawSpots(g).stain;
      box = g.stains ? { x: s[0] - 7, y: s[1] - 7, w: 14, h: 14 } : kind === 'bottom' ? { x: 4, y: 20, w: 12, h: 12 } : { x: -8, y: 12, w: 16, h: 16 };
    }
    const grid = [];
    for (let x = box.x; x <= box.x + box.w + 0.01; x += 5) grid.push({ type: 'fold', pts: [[x, box.y], [x, box.y + box.h]] });
    for (let y = box.y; y <= box.y + box.h + 0.01; y += 5) grid.push({ type: 'fold', pts: [[box.x, y], [box.x + box.w, y]] });
    const cx = box.x + box.w / 2;
    const fromCentre = Math.abs(cx) < 1.5 ? 'centred' : `${lbl(Math.abs(cx))} ${cx > 0 ? 'to the right of' : 'to the left of'} centre (as you look at it)`;
    return [
      {
        title: 'Prep',
        text: 'Wash and dry without fabric softener (it stops paint from bonding). Slide cardboard inside so paint can’t bleed through to the back.',
        svg: '',
      },
      {
        title: 'Transfer at real size',
        text: `Your design is ${fmt(box.w)} wide × ${fmt(box.h)} tall. Its top edge sits ${fmt(box.y)} below the ${kind === 'bottom' || kind === 'skirt' ? 'waistband' : 'collar'}, ${fromCentre}. Chalk a 5 cm grid over that area and copy the sketch one square at a time.`,
        svg: flatSVG(g, { overlays: [...grid, { type: 'dim', a: [box.x, box.y - 3], b: [box.x + box.w, box.y - 3], text: lbl(box.w), size: 2.8 }] }),
      },
      {
        title: 'Paint & heat-set',
        text: `Outline first with a fabric marker, then fill with thin coats. Let each one dry. After 24 h, ${c.has('iron') ? 'iron the back for 3–5 min (no steam) to set it' : 'tumble-dry on high for 30 min to set it'}. ${patternTip(g, 'paint')}`,
        svg: '',
      },
    ];
  },
});

// 6. Visible mending patch ---------------------------------------------------
P.push({
  id: 'mend',
  title: 'Visible-mend patch',
  icon: '🩹',
  difficulty: 2,
  time: '45 min',
  needs: [['scissors'], ['needle', 'machine']],
  check(c) {
    if (!c.g.stains && !c.g.holes) return null;
    let score = 50 + (c.g.holes ? 25 : 10);
    const why = [c.g.holes ? 'This patches the hole so it won’t grow, and makes the repair a design feature.' : 'This covers the stain with a decorative patch.'];
    if (c.donor) why.push(`Patch fabric: your “${escapeHtml(c.donor.name)}” (${PATTERN_LABELS[c.donor.pattern].toLowerCase()}) contrasts nicely.`);
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const spot = c.g.holes ? flawSpots(g).hole : flawSpots(g).stain;
    const r = c.g.holes ? 4.5 : 5.5;
    const donor = c.donor || { ...g, color: '#e8dcc6', pattern: 'solid' };
    const circlePts = Array.from({ length: 24 }, (_, i) => [spot[0] + Math.cos((i / 24) * Math.PI * 2) * r, spot[1] + Math.sin((i / 24) * Math.PI * 2) * r]);
    const stitches = [];
    for (let y = -r + 0.8; y < r; y += 0.9) {
      const hw = Math.sqrt(r * r - y * y) - 0.6;
      stitches.push({ type: 'stitch', pts: [[-hw, y], [hw, y]] });
    }
    return [
      {
        title: 'Cut the patch',
        text: `From ${c.donor ? `your “${escapeHtml(c.donor.name)}”` : 'a scrap of sturdy fabric'}, cut a circle ${fmt(r * 2)} across, which overlaps the damage by at least 2 cm all round.${c.g.holes ? ` Also cut a slightly larger backing piece (${fmt(r * 2 + 2)}) to go inside.` : ''}`,
        svg: flatSVG(donor, { shape: circleShape(r), pad: 3, overlays: [{ type: 'dim', a: [-r, r + 1.5], b: [r, r + 1.5], text: lbl(r * 2), size: 1.4, dy: 1.6 }] }),
      },
      {
        title: 'Position & pin',
        text: `Centre the patch over the ${c.g.holes ? 'hole' : 'stain'}${c.g.holes ? ', with the backing piece inside' : ''}. Pin around the edge. ${c.mat.knit ? 'Knit fabric: don’t stretch it while pinning.' : ''}`,
        svg: flatSVG(g, { donor, overlays: [{ type: 'add', pts: circlePts, fill: 'donor' }] }),
      },
      {
        title: 'Sashiko running stitch',
        text: `With embroidery thread, sew parallel rows of running stitch ${fmt(0.9)} apart across the whole patch, going through every layer. Contrast thread looks intentional. Finish with a blanket stitch around the edge.`,
        svg: flatSVG(donor, { shape: circleShape(r), pad: 2, overlays: stitches }),
      },
    ];
  },
});

// 7. Cardigan ----------------------------------------------------------------
P.push({
  id: 'cardigan',
  title: 'Open-front cardigan',
  icon: '🧥',
  difficulty: 2,
  time: '40 min',
  needs: [['scissors']],
  check(c) {
    if (!['sweater', 'hoodie', 'longsleeve'].includes(c.g.type)) return null;
    let score = 40;
    const why = [];
    if (c.fit.chest > 14) {
      score += 20;
      why.push(`The ${lbl(c.fit.chest)} of extra chest room drapes nicely as an open layer.`);
    }
    if (c.fit.chest < 4) {
      score += 15;
      why.push('Opening the front removes the tight pull across your chest.');
    }
    if (c.g.material === 'wool' && !c.canSew) {
      score -= 25;
      why.push('Wool knit unravels when cut, so you need to stitch first.');
    } else if (c.g.material === 'fleece') why.push('Fleece doesn’t unravel, so the cut edge can stay raw.');
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const top = T.collar * 1.6;
    const stitchFirst = c.g.material === 'wool' || !c.mat.knit;
    const buttons = Math.floor((g.length - top) / 9);
    const st = [];
    st.push({
      title: 'Find the centre front',
      text: 'Fold it in half sleeve to sleeve and crease, or chalk a straight line from the middle of the neckline to the middle of the hem. Slip cardboard inside so you only cut the front.',
      svg: flatSVG(g, { overlays: [{ type: 'fold', pts: [[0, top], [0, g.length]] }] }),
    });
    if (stitchFirst) {
      st.push({
        title: 'Stabilise before cutting',
        text: `${c.has('machine') ? 'Machine-sew two rows of small zig-zag' : 'Hand-sew two rows of tight backstitch'}, ${fmt(0.6)} either side of the line. This keeps the knit from running.`,
        svg: flatSVG(g, { overlays: [{ type: 'stitch', pts: [[-0.6, top], [-0.6, g.length]] }, { type: 'stitch', pts: [[0.6, top], [0.6, g.length]] }] }),
      });
    }
    st.push({
      title: 'Cut up the middle',
      text: `Cut the front layer only, from hem to neckline, along the centre line${stitchFirst ? ', between the two stitch rows' : ''}.`,
      svg: flatSVG(g, { overlays: [{ type: 'cut', pts: [[0, g.length], [0, top]] }] }),
    });
    st.push({
      title: 'Finish the edges',
      text: c.canSew
        ? `Fold each edge under ${fmt(1.5)} and ${c.sewVerb}, or cover it with ribbon / bias tape (you'll need ${fmt(2 * (g.length - top) + 4)}). Optional: add ${buttons} buttons spaced ${fmt(9)} apart.`
        : 'Leave the edges raw. Fleece and jersey just roll softly.',
      svg: flatSVG(g, { overlays: c.canSew ? Array.from({ length: buttons }, (_, i) => ({ type: 'mark', x: 1.6, y: top + 5 + i * 9, r: 0.8, color: '#3a2c1a' })).concat([{ type: 'stitch', pts: [[-1.5, top], [-1.5, g.length]] }, { type: 'stitch', pts: [[1.5, top], [1.5, g.length]] }]) : [{ type: 'cut', pts: [[0, g.length], [0, top]], scissors: false }] }),
    });
    return st;
  },
});

// 8. Re-length sleeves -------------------------------------------------------
P.push({
  id: 'sleeves',
  title: 'Re-length the sleeves',
  icon: '📏',
  difficulty: 1,
  time: '20 min',
  needs: [['scissors']],
  target(c) {
    if (c.fit.sleeveOver > 2) return { t: c.body.arm - 1, mode: 'fit' };
    if (c.g.sleeve >= c.body.arm * 0.8) return { t: Math.round(c.body.arm * 0.62), mode: '3/4' };
    return null;
  },
  check(c) {
    const T = topLandmarks(c.g);
    if (c.kind === 'skirt' || c.kind === 'bottom' || !T.hasSleeves || c.g.sleeve < 25) return null;
    const tg = this.target(c);
    if (!tg) return null;
    if (tg.mode === 'fit') return { score: 65, why: [`The sleeves run ${lbl(c.fit.sleeveOver)} past your wrist. This cuts them to end right at your wrist bone.`] };
    return { score: 30, why: [`3/4 sleeves (${lbl(tg.t)}) suit warmer days and show off bracelets.`] };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const tg = this.target(c);
    const allow = c.mat.knit ? 0 : c.canSew ? 2.5 : 0;
    const cutLen = tg.t + allow;
    const dvec = [Math.cos(T.theta), Math.sin(T.theta)];
    const P1 = [T.S[0] + dvec[0] * cutLen, T.S[1] + dvec[1] * cutLen];
    const P2 = [lerp(T.A[0], T.E2[0], cutLen / g.sleeve), lerp(T.A[1], T.E2[1], cutLen / g.sleeve)];
    const rm = [P1, T.E1, T.E2, P2];
    const cuffy = g.type === 'sweater' || g.type === 'hoodie';
    return [
      {
        title: 'Measure along the sleeve',
        text: `Measure from the shoulder seam along the top fold of the sleeve: mark ${fmt(cutLen)}${allow ? ` (${fmt(tg.t)} finished + ${fmt(allow)} hem)` : ''}. Square the line across the sleeve.`,
        svg: flatSVG(g, { overlays: [...both({ type: 'cut', pts: [P1, P2] }), { type: 'label', x: P1[0] + 2, y: P1[1] - 2, text: lbl(cutLen), anchor: 'start', weight: 600 }] }),
      },
      {
        title: 'Cut both sleeves',
        text: `Cut the first sleeve, then lay it over the second as a template so they match.${cuffy ? ' Optional: unpick the ribbed cuff before cutting and sew it back onto the new edge (stretch it to fit).' : ''}`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: rm }, { type: 'remove', pts: mx(rm) }, ...both({ type: 'cut', pts: [P1, P2] })] }),
      },
      { title: 'Finish', text: finishTip(g, c), svg: flatSVG(this.after(c)) },
    ];
  },
  after(c) {
    const T = topLandmarks(c.g);
    const tg = this.target(c);
    const dvec = [Math.cos(T.theta), Math.sin(T.theta)];
    const P1 = [T.S[0] + dvec[0] * tg.t, T.S[1] + dvec[1] * tg.t];
    const P2 = [lerp(T.A[0], T.E2[0], tg.t / c.g.sleeve), lerp(T.A[1], T.E2[1], tg.t / c.g.sleeve)];
    return { ...c.g, sleeve: tg.t, sleeveOpen: Math.max(c.g.sleeveOpen, 2 * Math.hypot(P1[0] - P2[0], P1[1] - P2[1])) };
  },
});

// 9. Take in the sides -------------------------------------------------------
P.push({
  id: 'takein',
  title: 'Take in the side seams',
  icon: '📐',
  difficulty: 2,
  time: '1 h',
  needs: [['needle', 'machine'], ['scissors']],
  targets(c) {
    const e = c.mat.knit ? 6 : 10;
    const newC = Math.min(c.g.chest, c.body.chest + e);
    const newW = Math.min(c.g.waist, Math.max(c.body.waist + e + 4, newC - 14));
    const reachesHips = c.fit.hemY < c.lm.hipY;
    const newH = Math.min(c.g.hem, Math.max(newW, reachesHips ? c.body.hips + e : newW));
    return { e, newC, newW, newH };
  },
  check(c) {
    if (c.kind !== 'top' && c.kind !== 'dress') return null;
    if (c.fit.chest < 18 && c.fit.waist < 22) return null;
    const t = this.targets(c);
    const per = (c.g.chest - t.newC) / 4;
    return {
      score: 40 + Math.min(40, (c.fit.chest - 18) * 1.5),
      why: [`It's ${lbl(c.fit.chest)} bigger than your chest. Taking in ${lbl(per)} at each side seam gives a tailored ${lbl(t.e)} of ease.`],
    };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const t = this.targets(c);
    const isDress = c.kind === 'dress';
    const A2 = [t.newC / 4, T.A[1]];
    const W2 = [t.newW / 4, T.W[1]];
    const H2 = isDress ? [T.W[0] + 2, T.W[1] + 12] : [t.newH / 4, g.length];
    const line = [A2, W2, H2];
    if (T.hasSleeves) line.unshift([lerp(T.A[0], T.E2[0], 0.45), lerp(T.A[1], T.E2[1], 0.45)]);
    const oldSide = isDress ? [T.A, T.W, [T.W[0] + 2, T.W[1] + 12]] : [T.A, T.W, T.H];
    const trim = [...oldSide, ...line.slice(T.hasSleeves ? 1 : 0).map(([x, y]) => [x + 1.5, y]).reverse()];
    const perC = (g.chest - t.newC) / 4,
      perW = (g.waist - t.newW) / 4;
    return [
      {
        title: 'Pin the new seam (inside out)',
        text: `Turn it inside out. On each side seam, pin a new line ${fmt(perC)} in at the underarm and ${fmt(perW)} in at the waist${isDress ? ', tapering back to the original seam at the hip' : `, ending ${fmt((g.hem - t.newH) / 4)} in at the hem`}. Try it on (carefully!) before sewing.`,
        svg: flatSVG(g, {
          overlays: [
            ...both({ type: 'stitch', pts: line }),
            { type: 'dim', a: [A2[0], A2[1] + 2], b: [T.A[0], T.A[1] + 2], text: lbl(perC), size: 2.6, dy: 3.6 },
            { type: 'dim', a: [W2[0], W2[1]], b: [T.W[0], T.W[1]], text: lbl(perW), size: 2.6, dy: 3.6 },
          ],
        }),
      },
      {
        title: 'Sew',
        text: `${c.sewVerb[0].toUpperCase() + c.sewVerb.slice(1)} along the pinned line, from ${T.hasSleeves ? 'partway down the sleeve' : 'the armhole'} to the ${isDress ? 'hip' : 'hem'}, blending smoothly into the old seam at each end. ${c.mat.knit ? 'Knit: stretch the fabric very slightly as you sew so the seam doesn’t pop.' : ''}`,
        svg: flatSVG(g, { overlays: both({ type: 'stitch', pts: line }) }),
      },
      {
        title: 'Trim & finish',
        text: `Try it on again. Happy? Trim the excess, leaving ${fmt(1.5)} seam allowance, then ${c.mat.frays ? 'zig-zag or overcast the raw edges' : 'leave the knit edges raw'} and press the seams flat.`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: trim }, { type: 'remove', pts: mx(trim) }, ...both({ type: 'stitch', pts: line })] }),
      },
      { title: 'Result', text: `New measurements: chest ${fmt(t.newC)}, waist ${fmt(t.newW)}.`, svg: flatSVG(this.after(c)) },
    ];
  },
  after(c) {
    const t = this.targets(c);
    return { ...c.g, chest: t.newC, waist: t.newW, hem: c.kind === 'dress' ? c.g.hem : t.newH };
  },
});

// 10. Side panels (too tight) ------------------------------------------------
P.push({
  id: 'panels',
  title: 'Add side panels',
  icon: '➕',
  difficulty: 3,
  time: '1.5 h',
  needs: [['scissors'], ['needle', 'machine']],
  widths(c) {
    const wA = Math.max(2, (c.body.chest + 8 - c.g.chest) / 2);
    const reachesHips = c.fit.hemY < c.lm.hipY;
    const wH = Math.max(wA, reachesHips ? (c.body.hips + 8 - c.g.hem) / 2 : wA);
    return { wA, wH };
  },
  check(c) {
    if (c.kind !== 'top' && c.kind !== 'dress') return null;
    if (c.fit.chest >= 3 && c.fit.waist >= 0) return null;
    const { wA } = this.widths(c);
    const why = [`It's ${c.fit.chest < 0 ? lbl(-c.fit.chest) + ' too small' : 'very snug'} at the chest. Adding ${lbl(wA)}-wide panels to each side gives you room to move.`];
    if (c.donor) why.push(`Panel fabric: your “${escapeHtml(c.donor.name)}” for a two-tone look.`);
    return { score: 50 + Math.min(40, -c.fit.chest * 4 + 10), why };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const { wA, wH } = this.widths(c);
    const donor = c.donor || { ...g, color: '#e8dcc6', pattern: 'stripes', color2: '#b9a98f' };
    const hy = g.length;
    const panelH = hy - T.A[1] + 1.5;
    const panelR = [
      [T.A[0], T.A[1]],
      [T.A[0] + wA, T.A[1] + 2],
      [T.H[0] + wH, hy],
      [T.H[0], hy],
    ];
    const side = [T.A, T.W, T.H];
    const trap = polyShape([
      [-(wA + 3) / 2, 0],
      [(wA + 3) / 2, 0],
      [(wH + 3) / 2, panelH],
      [-(wH + 3) / 2, panelH],
    ]);
    return [
      {
        title: 'Open the side seams',
        text: `Unpick${c.has('ripper') ? ' (seam ripper)' : ' or cut right along'} both side seams, from the hem up to the underarm.`,
        svg: flatSVG(g, { overlays: both({ type: 'cut', pts: [T.H, T.W, T.A] }) }),
      },
      {
        title: 'Cut two panels',
        text: `From ${c.donor ? `your “${escapeHtml(c.donor.name)}”` : 'contrast fabric'}, cut 2 tapered panels: ${fmt(wA + 3)} wide at the top, ${fmt(wH + 3)} at the bottom and ${fmt(panelH)} tall. That includes ${fmt(1.5)} seam allowance on each long side. ${patternTip(donor)}`,
        svg: flatSVG(donor, {
          shape: trap,
          pad: 5,
          overlays: [
            { type: 'dim', a: [-(wA + 3) / 2, -2], b: [(wA + 3) / 2, -2], text: lbl(wA + 3), size: 2.2 },
            { type: 'dim', a: [(wH + 3) / 2 + 2, 0], b: [(wH + 3) / 2 + 2, panelH], text: lbl(panelH), size: 2.2, dx: 4, dy: 0 },
          ],
        }),
      },
      {
        title: 'Sew in the panels',
        text: `Pin each panel right sides together to the front edge, then the back edge, and ${c.sewVerb} with ${fmt(1.5)} seam allowance. Press the seams towards the panel.`,
        svg: flatSVG(g, {
          donor,
          extraBox: { x: -T.H[0] - wH - 2, y: 0, w: (T.H[0] + wH + 2) * 2, h: hy },
          overlays: [
            { type: 'add', pts: panelR, fill: 'donor' },
            { type: 'add', pts: mx(panelR), fill: 'donor' },
            ...both({ type: 'stitch', pts: side }),
          ],
        }),
      },
      { title: 'Result', text: `New chest ≈ ${fmt(c.g.chest + 2 * wA)}, so you now have ${fmt(c.g.chest + 2 * wA - c.body.chest)} of ease.`, svg: '' },
    ];
  },
  after(c) {
    const { wA, wH } = this.widths(c);
    return { ...c.g, chest: c.g.chest + 2 * wA, waist: c.g.waist + wA + wH, hem: c.g.hem + 2 * wH };
  },
});

// 11. Button-up → pillow -----------------------------------------------------
P.push({
  id: 'pillow',
  title: 'Button-front pillow cover',
  icon: '🛋️',
  difficulty: 2,
  time: '45 min',
  needs: [['scissors'], ['needle', 'machine']],
  size(c) {
    const T = topLandmarks(c.g);
    return Math.max(30, Math.floor(Math.min(c.g.chest / 2 - 6, c.g.length - T.A[1] - 6) / 5) * 5);
  },
  check(c) {
    if (c.g.type !== 'buttonup') return null;
    const s = this.size(c);
    const why = [`The buttons become the pillow's closure. It fits a ${s} × ${s} cm insert.`];
    let score = 40;
    if (c.fit.chest < 0 || c.fit.chest > 30) {
      score += 20;
      why.push('It doesn’t fit you well, so this gives it a second life.');
    }
    if (['plaid', 'gingham', 'floral'].includes(c.g.pattern)) {
      score += 15;
      why.push(`${PATTERN_LABELS[c.g.pattern]} looks great as home decor.`);
    }
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const s = this.size(c);
    const y0 = T.A[1] + 2;
    const sq = [[-s / 2, y0], [s / 2, y0], [s / 2, y0 + s], [-s / 2, y0 + s], [-s / 2, y0]];
    const out = [[-s / 2 - 1.5, y0 - 1.5], [s / 2 + 1.5, y0 - 1.5], [s / 2 + 1.5, y0 + s + 1.5], [-s / 2 - 1.5, y0 + s + 1.5], [-s / 2 - 1.5, y0 - 1.5]];
    return [
      {
        title: 'Button up & turn inside out',
        text: 'Button it all the way, turn it inside out and lay it flat with the button placket centred.',
        svg: flatSVG(g),
      },
      {
        title: 'Mark the square',
        text: `Chalk a ${fmt(s)} square centred on the placket, starting ${fmt(y0)} below the shoulder (just under the armholes) so it clears the sleeves. ${patternTip(g, 'mark')}`,
        svg: flatSVG(g, { overlays: [{ type: 'stitch', pts: sq }, { type: 'dim', a: [-s / 2, y0 - 3], b: [s / 2, y0 - 3], text: lbl(s) }] }),
      },
      {
        title: 'Stitch & trim',
        text: `${c.sewVerb[0].toUpperCase() + c.sewVerb.slice(1)} around all 4 sides through both layers. Trim ${fmt(1.5)} outside the stitching and snip the corners diagonally.`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: [[-200, -20], [200, -20], [200, 200], [-200, 200], [-200, -20], ...out.slice().reverse()] }, { type: 'cut', pts: out }, { type: 'stitch', pts: sq }] }),
      },
      { title: 'Turn & stuff', text: `Unbutton, turn right side out, push out the corners and insert a ${s} × ${s} cm pillow form.`, svg: '' },
    ];
  },
});

// 12. Scrunchies -------------------------------------------------------------
P.push({
  id: 'scrunchie',
  title: 'Scrunchies',
  icon: '🎀',
  difficulty: 1,
  time: '20 min each',
  needs: [['scissors'], ['needle', 'machine']],
  count(c) {
    const k = c.kind;
    const area = k === 'bottom' ? c.g.hips * (c.g.inseam + c.g.rise) * 0.55 : k === 'skirt' ? c.g.hem * c.g.length * 0.6 : c.g.chest * c.g.length * 0.6;
    return clamp(Math.floor(area / 500), 1, 20);
  },
  check(c) {
    const n = this.count(c);
    let score = 25;
    const why = [`You can get about ${n} scrunchies (strips of 50 × 10 cm).`];
    if (c.g.stains || c.g.holes) {
      score += 15;
      why.push('Small strips let you cut around the damage.');
    }
    if (['polka', 'floral', 'gingham'].includes(c.g.pattern)) {
      score += 15;
      why.push(`${PATTERN_LABELS[c.g.pattern]} makes really cute scrunchies.`);
    }
    if (!c.has('elastic')) why.push('No elastic? A plain hair tie works.');
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const strip = rectShape(50, 10);
    return [
      {
        title: 'Cut strips',
        text: `Cut a strip ${fmt(50)} × ${fmt(10)} per scrunchie (you have enough for about ${this.count(c)}). Cut around any stains or holes. ${c.mat.knit ? 'Cut with the stretch running along the length.' : ''}`,
        svg: flatSVG(g, { shape: strip, pad: 4, overlays: [{ type: 'dim', a: [-25, -2], b: [25, -2], text: '50 cm', size: 2.6 }, { type: 'dim', a: [27, 0], b: [27, 10], text: '10 cm', size: 2.2, dx: 4, dy: 0 }] }),
      },
      {
        title: 'Sew into a tube',
        text: `Fold lengthwise right sides together (now ${fmt(5)} wide) and ${c.sewVerb} along the long edge, ${fmt(1)} from the edge.`,
        svg: flatSVG(g, { shape: rectShape(50, 5), pad: 4, overlays: [{ type: 'stitch', pts: [[-25, 4], [25, 4]] }, { type: 'fold', pts: [[-25, 0], [25, 0]] }, { type: 'label', x: 0, y: -1.5, text: 'fold', size: 2 }] }),
      },
      {
        title: 'Elastic & close',
        text: `Turn right side out. Thread ${c.has('elastic') ? `${fmt(20)} of elastic` : 'a hair tie'} through with a safety pin and knot it. Tuck one raw end into the other and slip-stitch it closed.`,
        svg: flatSVG(g, { shape: rectShape(50, 4), pad: 4, overlays: [{ type: 'arrow', a: [-22, 2], b: [22, 2] }, { type: 'label', x: 0, y: 7.5, text: 'elastic through the tube', size: 2 }] }),
      },
    ];
  },
});

// 13. Jeans → shorts ---------------------------------------------------------
P.push({
  id: 'shorts',
  title: 'Cut-off shorts',
  icon: '🩳',
  difficulty: 1,
  time: '20 min',
  needs: [['scissors']],
  finished(c) {
    const thighLen = c.body.inseam - c.lm.H * 0.285;
    return Math.round(clamp(thighLen * 0.3, 8, 18));
  },
  check(c) {
    if (c.kind !== 'bottom') return null;
    const f = this.finished(c);
    if (c.g.inseam < f + 10) return null;
    if (c.fit.waist < -2 || c.fit.hips < -2) return null;
    let score = 50;
    const why = [`A ${lbl(f)} inseam lands at mid-thigh on your legs.`];
    if (c.fit.inseamOver > 3) {
      score += 20;
      why.push(`They're ${lbl(c.fit.inseamOver)} too long for you anyway.`);
    }
    if (c.g.holes && flawSpots(c.g).hole[1] > c.g.rise + f + 3) {
      score += 15;
      why.push('The hole is in the part you cut off.');
    }
    if (c.g.material === 'denim') why.push('Denim gives a classic frayed hem with zero sewing.');
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const B = bottomLandmarks(g);
    const f = this.finished(c);
    const raw = c.g.material === 'denim' || !c.canSew;
    const allow = raw ? 2 : 6;
    const cy = B.rise + f + allow;
    const L = legAt(g, cy);
    const rmR = [[L.inner, cy], [L.outer, cy], [B.xc + B.lo / 2, B.hemY], [B.xc - B.lo / 2, B.hemY]];
    const after = this.after(c);
    return [
      {
        title: 'Measure from the crotch seam',
        text: `Measure ${fmt(f + allow)} down the inside leg seam from the crotch${raw ? ` (${fmt(f)} finished + ${fmt(2)} that frays up)` : ` (${fmt(f)} finished + ${fmt(6)} for a double ${fmt(3)} cuff)`}. Mark straight across the leg, angling ${fmt(1)} lower at the outside seam so the shorts don't ride up.`,
        svg: flatSVG(g, { overlays: [...both({ type: 'cut', pts: [[L.inner, cy], [L.outer, cy + 1]] }), { type: 'dim', a: [L.outer + 5, B.rise], b: [L.outer + 5, cy], text: lbl(f + allow), dx: 5, dy: 0 }] }),
      },
      {
        title: 'Cut, then mirror',
        text: 'Cut the first leg. Fold the jeans in half along the centre, matching the legs, and use the cut leg as a template for the second.',
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: rmR }, { type: 'remove', pts: mx(rmR) }, ...both({ type: 'cut', pts: [[L.inner, cy], [L.outer, cy + 1]] })] }),
      },
      {
        title: raw ? 'Fray the hem' : 'Cuff the hem',
        text: raw ? 'Wash and tumble-dry to fray the edge, or pull out a few cross-threads with tweezers for a deliberate fringe.' : `Fold up ${fmt(3)} twice and tack it in place at the inner and outer seams with a few hand stitches.`,
        svg: flatSVG(after),
      },
    ];
  },
  after(c) {
    const f = this.finished(c);
    const B = bottomLandmarks(c.g);
    const L = legAt(c.g, B.rise + f);
    return { ...c.g, type: 'shorts', inseam: f, legOpen: 2 * (L.outer - L.inner) };
  },
});

// 14. Hem trousers -----------------------------------------------------------
P.push({
  id: 'hem',
  title: 'Hem to your length',
  icon: '🧵',
  difficulty: 1,
  time: '30 min',
  needs: [['scissors']],
  check(c) {
    if (c.kind !== 'bottom' || c.g.type === 'shorts') return null;
    if (c.fit.inseamOver < 3) return null;
    return { score: 70, why: [`They're ${lbl(c.fit.inseamOver)} longer than your ${lbl(c.body.inseam)} inseam.`] };
  },
  steps(c) {
    const g = c.g;
    const B = bottomLandmarks(g);
    const over = c.fit.inseamOver;
    const newHemY = B.hemY - over;
    const Ln = legAt(g, newHemY);
    if (c.canSew) {
      const fy = newHemY;
      return [
        {
          title: 'Fold up (original-hem method)',
          text: `Fold each leg up by exactly ${fmt(over)}, measured from the bottom edge, and pin all round. This keeps the factory hem and its worn look.`,
          svg: flatSVG(g, { overlays: [...both({ type: 'fold', pts: [[Ln.inner, fy], [Ln.outer, fy]] }), { type: 'dim', a: [Ln.outer + 5, fy], b: [Ln.outer + 5, B.hemY], text: lbl(over), dx: 5, dy: 0 }] }),
        },
        {
          title: 'Stitch just below the old hem',
          text: `${c.sewVerb[0].toUpperCase() + c.sewVerb.slice(1)} around the leg right along the edge of the original hem band.`,
          svg: flatSVG(g, { overlays: both({ type: 'stitch', pts: [[Ln.inner, fy - 0.3], [Ln.outer, fy - 0.3]] }) }),
        },
        {
          title: 'Trim & fold down',
          text: `Trim the excess inside to ${fmt(1.5)}, zig-zag the raw edge, then fold the original hem back down and press.`,
          svg: flatSVG(this.after(c)),
        },
      ];
    }
    const allow = c.has('glue') ? 3 : 1.5;
    const cy = newHemY + allow;
    const L = legAt(g, cy);
    const rm = [[L.inner, cy], [L.outer, cy], [B.xc + B.lo / 2, B.hemY], [B.xc - B.lo / 2, B.hemY]];
    return [
      {
        title: 'Cut to length',
        text: `Cut ${fmt(over - allow)} off each leg${c.has('glue') ? `, leaving ${fmt(allow)} to fold up` : ''}.`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: rm }, { type: 'remove', pts: mx(rm) }, ...both({ type: 'cut', pts: [[L.inner, cy], [L.outer, cy]] })] }),
      },
      { title: c.has('glue') ? 'Fuse the hem' : 'Raw hem', text: finishTip(g, c), svg: flatSVG(this.after(c)) },
    ];
  },
  after(c) {
    return { ...c.g, inseam: c.body.inseam };
  },
});

// 15. Taper legs -------------------------------------------------------------
P.push({
  id: 'taper',
  title: 'Taper the legs',
  icon: '🔻',
  difficulty: 2,
  time: '1 h',
  needs: [['needle', 'machine'], ['scissors']],
  check(c) {
    if (c.kind !== 'bottom' || c.g.inseam < 40 || c.g.legOpen < 42) return null;
    return { score: 35 + (c.g.legOpen - 42), why: [`The ${lbl(c.g.legOpen)} leg opening is wide. Tapering to 36 cm from the knee down gives a slimmer line.`] };
  },
  steps(c) {
    const g = c.g;
    const B = bottomLandmarks(g);
    const target = 36;
    const red = (g.legOpen - target) / 2;
    const kneeY = B.rise + clamp(c.body.inseam - c.lm.H * 0.285, 20, g.inseam - 5);
    const K = legAt(g, kneeY);
    const newInner = [B.xc - B.lo / 2 + red, B.hemY];
    const line = [[K.inner, kneeY], newInner];
    const rm = [[K.inner, kneeY], newInner, [B.xc - B.lo / 2, B.hemY]];
    return [
      {
        title: 'Pin the new inseam',
        text: `Inside out. On each inner leg seam, pin a line that starts at the knee (${fmt(kneeY - B.rise)} below the crotch) and ends ${fmt(red)} in at the hem. The new opening will be ${fmt(target)} around.`,
        svg: flatSVG(g, { overlays: [...both({ type: 'stitch', pts: line }), { type: 'dim', a: [B.xc - B.lo / 2, B.hemY + 3], b: newInner.map((v, i) => (i ? v + 3 : v)), text: lbl(red), size: 2.6, dy: 3.6 }] }),
      },
      {
        title: 'Sew & trim',
        text: `${c.sewVerb[0].toUpperCase() + c.sewVerb.slice(1)}, blending into the old seam at the knee. Try on, then trim to ${fmt(1.5)} and finish the edges${g.material === 'denim' ? ' (heavy denim: use a size 16 needle)' : ''}.`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: rm }, { type: 'remove', pts: mx(rm) }, ...both({ type: 'stitch', pts: line })] }),
      },
      { title: 'Re-hem', text: 'Fold the hem back up and restitch where you crossed it.', svg: flatSVG(this.after(c)) },
    ];
  },
  after(c) {
    return { ...c.g, legOpen: 36 };
  },
});

// 16. Waist adjust -----------------------------------------------------------
P.push({
  id: 'waist',
  title: 'Fix the waist',
  icon: '🪢',
  difficulty: 2,
  time: '45 min',
  needs: [['needle', 'machine']],
  check(c) {
    if (c.kind !== 'bottom' && c.kind !== 'skirt') return null;
    if (c.fit.waist > 4) return { score: 55 + Math.min(30, c.fit.waist * 2), why: [`The waist gaps by ${lbl(c.fit.waist)} on you. Two back darts take it in invisibly.`] };
    if (c.fit.waist < 0) return { score: 60, why: [`The waist is ${lbl(-c.fit.waist)} too tight. ${c.fit.waist >= -3 ? 'Moving the button out fixes it.' : 'Adding stretch panels at the sides gives you room.'}`] };
    return null;
  },
  steps(c) {
    const g = c.g;
    const B = c.kind === 'bottom' ? bottomLandmarks(g) : skirtLandmarks(g);
    if (c.fit.waist > 4) {
      const excess = c.fit.waist - 2;
      const per = excess / 2;
      const x = B.hw * 0.5;
      const dart = (s) => [[s * x - per / 2, 0], [s * x, 11], [s * x + per / 2, 0]];
      const ov = [...[-1, 1].map((s) => ({ type: 'stitch', pts: dart(s) })), { type: 'label', x: 0, y: -5, text: 'back view' }, { type: 'dim', a: [x - per / 2, -1], b: [x + per / 2, -1], text: lbl(per), dy: -1.6 }];
      return [
        {
          title: 'Mark two back darts',
          text: `On the back, mark 2 darts ${fmt(x)} either side of centre. Each is ${fmt(per)} wide at the waistband, tapering to a point ${fmt(11)} down.${excess > 8 ? ' Taking in more than 8 cm? Take in the centre-back seam too so the darts don’t get too deep.' : ''}`,
          svg: flatSVG(g, { overlays: ov }),
        },
        {
          title: 'Sew the darts',
          text: `Fold each dart in half right sides together and ${c.sewVerb} from the waistband to the point. Knot the thread at the tip (don't backstitch) and press towards the centre.`,
          svg: flatSVG(g, { overlays: ov }),
        },
      ];
    }
    if (c.fit.waist >= -3) {
      return [
        {
          title: 'Move the button',
          text: `Unpick the waistband button and sew it back on ${fmt(-c.fit.waist + 1)} further out. Use a button shank or wrap the thread under it 6 times so it stays sturdy.`,
          svg: flatSVG(g, { overlays: [{ type: 'arrow', a: [0, 2], b: [-(-c.fit.waist + 1) - 2, 2] }, { type: 'mark', x: -(-c.fit.waist + 1) - 2, y: 2, r: 1, color: '#c9a24a' }] }),
        },
      ];
    }
    const add = (-c.fit.waist + 2) / 2;
    const gus = (s) => [[s * B.hw, 0], [s * (B.hw + add), 0], [s * B.hw, 10]];
    return [
      {
        title: 'Open the sides',
        text: `Unpick the waistband and side seams ${fmt(10)} down on each side.`,
        svg: flatSVG(g, { overlays: both({ type: 'cut', pts: [[B.hw, 0], [B.hw + 0.3, 10]] }) }),
      },
      {
        title: 'Insert stretch gussets',
        text: `Cut 2 triangles of ${c.has('elastic') ? 'wide elastic or ' : ''}stretch fabric, ${fmt(add + 3)} wide at the top and ${fmt(11.5)} tall, then sew them into the openings. You gain ${fmt(add * 2)} at the waist.`,
        svg: flatSVG(g, { extraBox: { x: -B.hw - add - 2, y: 0, w: (B.hw + add + 2) * 2, h: 12 }, overlays: [{ type: 'add', pts: gus(1) }, { type: 'add', pts: gus(-1) }] }),
      },
    ];
  },
  after(c) {
    if (c.fit.waist > 4) return { ...c.g, waist: c.g.waist - (c.fit.waist - 2) };
    return { ...c.g, waist: c.g.waist - c.fit.waist + 2 };
  },
});

// 17. Jeans → skirt ----------------------------------------------------------
P.push({
  id: 'jeanskirt',
  title: 'Jeans → mini skirt',
  icon: '👗',
  difficulty: 3,
  time: '2 h',
  needs: [['scissors'], ['needle', 'machine']],
  len(c) {
    const thighLen = c.body.inseam - c.lm.H * 0.285;
    return Math.round(c.g.rise + clamp(thighLen * 0.38, 12, 24));
  },
  check(c) {
    if (c.kind !== 'bottom' || c.g.inseam < 30) return null;
    if (c.fit.waist < -2) return null;
    let score = 40;
    const why = [`Gives a ${lbl(this.len(c))} skirt that ends at mid-thigh, with leftover leg fabric to fill the front and back.`];
    if (c.fit.hips > 8) {
      score += 15;
      why.push('Loose hips are fine here because skirts need more room there.');
    }
    if (c.fit.inseamOver > 3 || c.g.holes) score += 10;
    return { score, why };
  },
  steps(c) {
    const g = c.g;
    const B = bottomLandmarks(g);
    const len = this.len(c);
    const cy = len + 3;
    const L = legAt(g, cy);
    const rm = [[-L.outer - 0.5, cy], [L.outer + 0.5, cy], [B.xc + B.lo / 2 + 1, B.hemY + 1], [-(B.xc + B.lo / 2) - 1, B.hemY + 1]];
    const skirt = { ...g, type: 'skirt', hips: g.hips, hem: g.hips + 12, length: len };
    const tri = [[0, B.rise - 6], [6, len], [-6, len]];
    return [
      {
        title: 'Cut off the legs',
        text: `Cut straight across both legs ${fmt(cy)} below the waistband (${fmt(3)} extra for the hem). Keep the legs: you'll use them for the triangle inserts.`,
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: rm }, { type: 'cut', pts: [[-L.outer, cy], [L.outer, cy]] }] }),
      },
      {
        title: 'Unpick the crotch',
        text: `Unpick the inner leg seams and the crotch curve, front and back, up to ${fmt(6)} below the fly / back yoke.`,
        svg: flatSVG(g, { overlays: [{ type: 'cut', pts: [[0, B.rise - 6], [0, B.rise + 1.5], [L.inner, cy]] }, { type: 'cut', pts: [[0, B.rise + 1.5], [-L.inner, cy]], scissors: false }] }),
      },
      {
        title: 'Lay flat & fill the gap',
        text: `Overlap the front centre edges so they lie flat and topstitch. A triangle-shaped gap opens below. Cut a triangle from a leg ${fmt(14)} wide × ${fmt(len - B.rise + 8)} tall, pin it behind the gap, and topstitch it in. Repeat on the back.`,
        svg: flatSVG(skirt, { donor: g, overlays: [{ type: 'add', pts: tri, fill: 'donor' }, { type: 'stitch', pts: tri.concat([tri[0]]) }] }),
      },
      { title: 'Hem', text: finishTip(g, c), svg: flatSVG(skirt) },
    ];
  },
  after(c) {
    return { ...c.g, type: 'skirt', hem: c.g.hips + 12, length: this.len(c) };
  },
});

// 18. Shorten skirt / dress --------------------------------------------------
P.push({
  id: 'shorten',
  title: 'Shorten to above the knee',
  icon: '✂️',
  difficulty: 1,
  time: '30 min',
  needs: [['scissors']],
  newLen(c) {
    return Math.round(c.topY - (c.lm.H * 0.285 + 8));
  },
  check(c) {
    if (c.kind !== 'skirt' && c.kind !== 'dress') return null;
    const nl = this.newLen(c);
    if (c.g.length - nl < 6) return null;
    return { score: 45, why: [`At ${lbl(nl)} it hits 8 cm above your knee, which reads fresher and uses the cut-off ${lbl(c.g.length - nl)} band for a matching belt or scrunchie.`] };
  },
  steps(c) {
    const g = c.g;
    const nl = this.newLen(c);
    const allow = c.mat.knit ? 0 : c.canSew ? 3 : c.has('glue') ? 2 : 0;
    const cy = nl + allow;
    const sx = sideX(g, cy),
      hx = sideX(g, g.length);
    return [
      {
        title: 'Mark the new hem',
        text: `Measure ${fmt(cy)} down from the ${c.kind === 'dress' ? 'shoulder seam' : 'waistband'} at several points and join them.${allow ? ` That includes ${fmt(allow)} for the hem.` : ''} ${patternTip(g)}`,
        svg: flatSVG(g, { overlays: [{ type: 'cut', pts: [[-sx, cy], [sx, cy]] }, { type: 'dim', a: [Math.max(sx, hx) + 5, 0], b: [Math.max(sx, hx) + 5, cy], text: lbl(cy), dx: 5, dy: 0 }] }),
      },
      {
        title: 'Cut',
        text: 'Cut through all layers. Try it on before hemming.',
        svg: flatSVG(g, { overlays: [{ type: 'remove', pts: [[-sx, cy], [sx, cy], [hx, g.length], [-hx, g.length]] }, { type: 'cut', pts: [[-sx, cy], [sx, cy]] }] }),
      },
      { title: 'Hem', text: finishTip(g, c), svg: flatSVG(this.after(c)) },
    ];
  },
  after(c) {
    const nl = this.newLen(c);
    return { ...c.g, length: nl, hem: sideX(c.g, nl) * 4 };
  },
});

// 19. Dress → top + skirt ----------------------------------------------------
P.push({
  id: 'split',
  title: 'Dress → top + skirt',
  icon: '🔀',
  difficulty: 3,
  time: '1.5 h',
  needs: [['scissors'], ['needle', 'machine']],
  check(c) {
    if (c.kind !== 'dress') return null;
    return { score: 50, why: ['Two separates you can mix with the rest of your closet.', `The skirt gets an elastic waist: ${lbl(c.body.waist - 5)} of elastic for your ${lbl(c.body.waist)} waist.`] };
  },
  steps(c) {
    const g = c.g;
    const T = topLandmarks(g);
    const cy = T.W[1] + 2;
    const sx = sideX(g, cy);
    const top = { ...g, type: 'tshirt', length: T.W[1] - 0.5, hem: g.waist + 4 };
    const skirt = { ...g, type: 'skirt', waist: Math.max(g.waist, c.body.hips + 4), hips: Math.max(g.waist + 4, c.body.hips + 6), length: g.length - cy - 3.5, hem: g.hem };
    return [
      {
        title: 'Cut at the waist',
        text: `Cut straight across ${fmt(cy)} below the shoulder. This leaves ${fmt(2.5)} for the top's hem and ${fmt(3.5)} for the skirt's elastic casing.`,
        svg: flatSVG(g, { overlays: [{ type: 'cut', pts: [[-sx, cy], [sx, cy]] }] }),
      },
      { title: 'Hem the top', text: finishTip(g, c), svg: flatSVG(top) },
      {
        title: 'Elastic casing for the skirt',
        text: `Fold the skirt's top edge under ${fmt(1)}, then ${fmt(2.5)}. ${c.sewVerb[0].toUpperCase() + c.sewVerb.slice(1)} close to the lower fold, leaving a ${fmt(5)} gap. Thread ${c.has('elastic') ? fmt(c.body.waist - 5) + ' of 2 cm elastic' : 'a drawstring or ribbon'} through and close the gap.`,
        svg: flatSVG(skirt, { overlays: [{ type: 'stitch', pts: [[-skirt.waist / 4, 2.5], [-3, 2.5]] }, { type: 'stitch', pts: [[3, 2.5], [skirt.waist / 4, 2.5]] }] }),
      },
    ];
  },
  after(c) {
    const T = topLandmarks(c.g);
    return { ...c.g, type: 'tshirt', length: T.W[1] - 0.5, hem: c.g.waist + 4, sleeve: c.g.sleeve || 0 };
  },
});

// ---------------------------------------------------------------- public API

export function suggest(g, body, closet, tools) {
  const c = makeContext(g, body, closet, tools);
  const out = [];
  for (const p of P) {
    let res;
    try {
      res = p.check(c);
    } catch (e) {
      console.warn('check failed', p.id, e);
      res = null;
    }
    if (!res) continue;
    const missing = p.needs.filter((grp) => !grp.some((t) => tools[t])).map((grp) => grp.map((t) => TOOLS[t].label).join(' or '));
    const score = Math.round(clamp(res.score, 0, 100) * (missing.length ? 0.55 : 1));
    out.push({ project: p, score, rawScore: res.score, why: res.why, missing, ctx: c });
  }
  out.sort((a, b) => b.score - a.score);
  return { ctx: c, list: out };
}

export function buildSteps(entry) {
  return entry.project.steps.call(entry.project, entry.ctx);
}

export function afterGarment(entry) {
  if (!entry.project.after) return null;
  try {
    return entry.project.after.call(entry.project, entry.ctx);
  } catch {
    return null;
  }
}

export function fitSummary(c) {
  const f = c.fit;
  const rows = [];
  const word = (e, loose = 22) => (e < -1 ? ['too tight', 'bad'] : e < 4 ? ['snug', 'warn'] : e < loose ? ['good fit', 'ok'] : ['oversized', 'loose']);
  if (f.chest != null) rows.push(['Chest', f.chest, ...word(f.chest)]);
  if (f.waist != null) rows.push(['Waist', f.waist, ...word(f.waist, c.kind === 'top' ? 26 : 10)]);
  if (f.hips != null) rows.push(['Hips', f.hips, ...word(f.hips, 14)]);
  if (f.inseamOver != null) rows.push(['Inseam', f.inseamOver, ...(f.inseamOver > 3 ? ['too long', 'warn'] : f.inseamOver < -12 ? ['short', 'ok'] : f.inseamOver < -3 ? ['cropped', 'ok'] : ['right length', 'ok'])]);
  if (f.sleeveOver != null && c.g.sleeve > 25) rows.push(['Sleeve', f.sleeveOver, ...(f.sleeveOver > 3 ? ['too long', 'warn'] : f.sleeveOver < -8 ? ['short', 'ok'] : ['right length', 'ok'])]);
  return rows;
}

export { perim };

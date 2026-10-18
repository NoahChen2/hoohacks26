// On-device garment guess from a photo's shapes and colours, used when the
// server has no vision model. It reads a small RGBA buffer, separates the
// garment from the background, and guesses type, colours and pattern.
import { GARMENT_TYPES } from '../garments.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mean = (list) => {
  const sum = [0, 0, 0];
  for (const c of list) for (let k = 0; k < 3; k++) sum[k] += c[k];
  return list.length ? sum.map((v) => v / list.length) : [128, 128, 128];
};

const NAMED = [
  ['Black', [24, 24, 28]], ['Charcoal', [60, 62, 68]], ['Grey', [128, 130, 134]], ['White', [240, 238, 232]], ['Cream', [236, 224, 196]],
  ['Navy', [30, 42, 80]], ['Denim blue', [70, 100, 145]], ['Sky blue', [140, 185, 225]], ['Teal', [30, 120, 125]], ['Green', [50, 120, 70]],
  ['Olive', [110, 115, 60]], ['Sage', [150, 170, 140]], ['Yellow', [230, 200, 60]], ['Mustard', [200, 150, 40]], ['Orange', [225, 120, 45]],
  ['Rust', [160, 75, 40]], ['Red', [190, 40, 45]], ['Burgundy', [110, 30, 45]], ['Pink', [235, 160, 180]], ['Lilac', [190, 165, 220]],
  ['Purple', [100, 60, 140]], ['Brown', [110, 75, 50]], ['Tan', [195, 160, 115]],
];
export const colorName = (c) => NAMED.reduce((best, n) => (dist(n[1], c) < dist(best[1], c) ? n : best), NAMED[0])[0];

function hsv([r, g, b]) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0;
  if (d) h = max === r / 255 ? ((g - b) / 255 / d) % 6 : max === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}
const denimLike = (c) => {
  const [h, s, v] = hsv(c);
  return h > 195 && h < 235 && s > 0.18 && s < 0.7 && v > 0.18 && v < 0.78;
};

// Two-colour k-means over the garment pixels: main colour, accent and its share.
function twoColours(pixels) {
  if (!pixels.length) return { main: [128, 128, 128], accent: [240, 238, 232], share: 0, labels: [] };
  const sorted = [...pixels].sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  let centres = [sorted[Math.floor(sorted.length * 0.2)], sorted[Math.floor(sorted.length * 0.8)]];
  let labels = [];
  for (let iter = 0; iter < 8; iter++) {
    labels = pixels.map((p) => (dist(p, centres[0]) <= dist(p, centres[1]) ? 0 : 1));
    centres = [0, 1].map((k) => {
      const group = pixels.filter((_, i) => labels[i] === k);
      return group.length ? mean(group) : centres[k];
    });
  }
  // Report each cluster's median colour: shadows, highlights and stray pixels
  // pull a mean away from the fabric's true colour, a median much less.
  centres = [0, 1].map((k) => {
    const group = pixels.filter((_, i) => labels[i] === k);
    return group.length ? [0, 1, 2].map((ch) => group.map((p) => p[ch]).sort((a, b) => a - b)[group.length >> 1]) : centres[k];
  });
  const ones = labels.filter(Boolean).length / labels.length;
  const major = ones > 0.5 ? 1 : 0;
  return { main: centres[major], accent: centres[1 - major], share: Math.min(ones, 1 - ones), labels: labels.map((l) => (l === major ? 0 : 1)) };
}

/**
 * Guess the garments in an image. `image` is { data: RGBA bytes, width, height }.
 * Returns scan specs (see src/scan/schema.js), outermost last.
 */
export function localScan({ data, width, height }) {
  const at = (x, y) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  // Background: the median colour around the border.
  const border = [];
  for (let x = 0; x < width; x++) border.push(at(x, 0), at(x, height - 1));
  for (let y = 0; y < height; y++) border.push(at(0, y), at(width - 1, y));
  const opaque = border.filter((p) => p[3] > 16);
  const bg = [0, 1, 2].map((k) => {
    const v = opaque.map((p) => p[k]).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 255;
  });
  const mask = new Uint8Array(width * height);
  let count = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = at(x, y);
      if (p[3] > 16 && dist(p, bg) > 52) {
        mask[y * width + x] = 1;
        count++;
      }
    }
  // A busy or edge-to-edge photo: assume the garment fills the centre.
  if (count < width * height * 0.04 || count > width * height * 0.92) {
    mask.fill(0);
    for (let y = Math.floor(height * 0.15); y < height * 0.9; y++) for (let x = Math.floor(width * 0.2); x < width * 0.8; x++) mask[y * width + x] = 1;
  }
  const fg = (x, y) => mask[y * width + x] === 1;
  const rowSpan = (y) => {
    let a = -1, b = -1, n = 0;
    for (let x = 0; x < width; x++) if (fg(x, y)) { if (a < 0) a = x; b = x; n++; }
    return { a, b, n };
  };
  const rows = Array.from({ length: height }, (_, y) => rowSpan(y));
  const occupied = rows.map((r, y) => (r.n > width * 0.05 ? y : -1)).filter((y) => y >= 0);
  if (!occupied.length) return [];
  const y0 = occupied[0], y1 = occupied.at(-1);
  const x0 = Math.min(...occupied.map((y) => rows[y].a)), x1 = Math.max(...occupied.map((y) => rows[y].b));
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const rowPixels = (y) => {
    const out = [];
    for (let x = x0; x <= x1; x++) if (fg(x, y)) out.push(at(x, y));
    return out;
  };
  const rowMeans = Array.from({ length: height }, (_, y) => (y >= y0 && y <= y1 ? { c: mean(rowPixels(y)), n: rows[y].n } : null));
  const span = (a, b) => {
    const list = rowMeans.slice(a, b + 1).filter((r) => r?.n);
    const total = list.reduce((s, r) => s + r.n, 0) || 1;
    return [0, 1, 2].map((k) => list.reduce((s, r) => s + r.c[k] * r.n, 0) / total);
  };

  // A full outfit photo: clearly different colours above and below a split.
  let split = -1, score = 0;
  for (let s = Math.round(y0 + bh * 0.3); s <= y0 + bh * 0.75; s++) {
    const d = dist(span(y0, s), span(s + 1, y1));
    if (d > score) { score = d; split = s; }
  }
  const outfit = score > 70 && bh / bw > 1.15;
  const regions = outfit ? [{ a: split + 1, b: y1, role: 'bottom' }, { a: y0, b: split, role: 'top' }] : [{ a: y0, b: y1, role: 'any' }];

  return regions.map(({ a, b, role }) => {
    // Colours come from inside the garment, away from edges blended with the background.
    const inside = (x, y) => fg(x, y) && x > 0 && y > 0 && x < width - 1 && y < height - 1 && fg(x - 1, y) && fg(x + 1, y) && fg(x, y - 1) && fg(x, y + 1);
    const pixels = [], coords = [];
    for (let y = a; y <= b; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) { pixels.push(at(x, y)); coords.push([x, y]); }
    const { main, accent, share, labels } = twoColours(pixels);
    const h = b - a + 1;
    const widths = rows.slice(a, b + 1).map((r) => (r.n ? r.b - r.a + 1 : 0));
    const avg = (list) => list.reduce((s, v) => s + v, 0) / Math.max(1, list.length);
    const topW = avg(widths.slice(0, Math.max(1, Math.round(h * 0.25))));
    const botW = avg(widths.slice(-Math.max(1, Math.round(h * 0.25))));
    const midW = avg(widths) || 1;
    // Two legs: background down the middle of the lower part with garment either side.
    let legRows = 0, lowRows = 0;
    for (let y = Math.round(a + h * 0.65); y <= b; y++) {
      const r = rows[y];
      if (!r.n) continue;
      lowRows++;
      const cx = Math.round((r.a + r.b) / 2);
      if (!fg(cx, y) && fg(Math.round((r.a + cx) / 2), y) && fg(Math.round((cx + r.b) / 2), y)) legRows++;
    }
    const legs = lowRows > 2 && legRows / lowRows > 0.45;
    const aspect = h / midW;
    let type;
    if (role === 'bottom') type = legs ? (aspect < 0.9 ? 'shorts' : 'jeans') : 'skirt';
    else if (role === 'top') type = topW > midW * 1.15 ? 'tshirt' : 'longsleeve';
    else if (legs) type = aspect < 0.9 ? 'shorts' : 'jeans';
    else if (botW > topW * 1.25) type = aspect > 1.35 ? 'dress' : 'skirt';
    else type = topW > botW * 1.6 && aspect < 1.1 ? 'tshirt' : aspect > 1.25 ? 'longsleeve' : 'tshirt';

    // Pattern from how often neighbouring pixels change colour cluster.
    let pattern = 'solid', across = 0, down = 0;
    if (share > 0.16 && dist(main, accent) > 70) {
      const label = new Map(coords.map(([x, y], i) => [y * width + x, labels[i]]));
      for (const [x, y] of coords) {
        const l = label.get(y * width + x);
        if (label.has(y * width + x + 1) && label.get(y * width + x + 1) !== l) across++;
        if (label.has((y + 1) * width + x) && label.get((y + 1) * width + x) !== l) down++;
      }
      const rate = (across + down) / coords.length;
      if (across > down * 2.2) pattern = 'vstripes';
      else if (down > across * 2.2) pattern = 'stripes';
      else if (rate > 0.12) pattern = Math.max(...accent) > 215 || Math.max(...main) > 215 ? 'gingham' : 'plaid';
      else pattern = share < 0.3 ? 'polka' : 'floral';
    }
    const kind = GARMENT_TYPES[type].kind;
    const denim = denimLike(main) && (kind === 'bottom' || kind === 'skirt');
    if (denim) pattern = 'denim';
    const label = GARMENT_TYPES[type].label.split(' /')[0].toLowerCase();
    return {
      type,
      name: `${colorName(main)} ${label}`.slice(0, 60),
      color: hex(main),
      color2: hex(pattern === 'solid' || pattern === 'denim' ? [240, 238, 232] : accent),
      pattern,
      material: denim ? 'denim' : kind === 'bottom' ? 'woven' : 'cotton',
      fit: 'regular',
      length: 'regular',
      sleeves: type === 'tshirt' ? 'short' : type === 'longsleeve' ? 'long' : 'none',
      stains: false,
      holes: false,
    };
  });
}

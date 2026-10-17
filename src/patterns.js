// Fabric patterns rendered two ways: onto a <canvas> (3D textures) and as SVG <pattern> defs (2D diagrams).

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}

// Draws a repeating pattern tile onto ctx covering w x h. `scale` = px per cm.
export function paintPattern(ctx, w, h, g, scale = 4) {
  const c1 = g.color;
  const c2 = g.color2 || '#ffffff';
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, w, h);
  const s = scale;
  switch (g.pattern) {
    case 'stripes': {
      ctx.fillStyle = c2;
      for (let y = 0; y < h; y += 4 * s) ctx.fillRect(0, y, w, 1.6 * s);
      break;
    }
    case 'vstripes': {
      ctx.fillStyle = c2;
      for (let x = 0; x < w; x += 3 * s) ctx.fillRect(x, 0, 0.8 * s, h);
      break;
    }
    case 'plaid': {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = c2;
      for (let y = 0; y < h; y += 8 * s) ctx.fillRect(0, y, w, 3 * s);
      for (let x = 0; x < w; x += 8 * s) ctx.fillRect(x, 0, 3 * s, h);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = shade(c1, 0.55);
      for (let y = 5.5 * s; y < h; y += 8 * s) ctx.fillRect(0, y, w, 0.4 * s);
      for (let x = 5.5 * s; x < w; x += 8 * s) ctx.fillRect(x, 0, 0.4 * s, h);
      ctx.globalAlpha = 1;
      break;
    }
    case 'gingham': {
      ctx.fillStyle = c2;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = c1;
      for (let y = 0; y < h; y += 2 * s) ctx.fillRect(0, y, w, s);
      for (let x = 0; x < w; x += 2 * s) ctx.fillRect(x, 0, s, h);
      ctx.globalAlpha = 1;
      break;
    }
    case 'polka': {
      ctx.fillStyle = c2;
      let row = 0;
      for (let y = 0; y < h + 6 * s; y += 3 * s, row++) {
        for (let x = (row % 2) * 3 * s; x < w + 6 * s; x += 6 * s) {
          ctx.beginPath();
          ctx.arc(x, y, 0.8 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'floral': {
      let row = 0;
      for (let y = 0; y < h + 10 * s; y += 7 * s, row++) {
        for (let x = (row % 2) * 5 * s; x < w + 10 * s; x += 10 * s) {
          drawFlower(ctx, x, y, 2.2 * s, c2, shade(c2, -0.35));
        }
      }
      break;
    }
    case 'denim': {
      // diagonal twill + speckle
      ctx.strokeStyle = shade(c1, 0.18);
      ctx.lineWidth = Math.max(1, 0.18 * s);
      for (let x = -h; x < w; x += 0.6 * s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
        ctx.stroke();
      }
      ctx.fillStyle = shade(c1, 0.35);
      for (let i = 0; i < (w * h) / 300; i++) {
        ctx.globalAlpha = Math.random() * 0.25;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
      break;
    }
  }
}

function drawFlower(ctx, x, y, r, petal, center) {
  ctx.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, r * 0.32, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

// Returns an SVG <pattern> element string with id `id`. `s` = svg units per cm.
export function svgPattern(id, g, s = 1) {
  const c1 = g.color;
  const c2 = g.color2 || '#ffffff';
  const P = (w, h, inner) =>
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${c1}"/>${inner}</pattern>`;
  switch (g.pattern) {
    case 'stripes':
      return P(4 * s, 4 * s, `<rect width="${4 * s}" height="${1.6 * s}" fill="${c2}"/>`);
    case 'vstripes':
      return P(3 * s, 3 * s, `<rect width="${0.8 * s}" height="${3 * s}" fill="${c2}"/>`);
    case 'plaid':
      return P(
        8 * s,
        8 * s,
        `<rect width="${8 * s}" height="${3 * s}" fill="${c2}" opacity=".45"/><rect width="${3 * s}" height="${8 * s}" fill="${c2}" opacity=".45"/>` +
          `<rect y="${5.5 * s}" width="${8 * s}" height="${0.4 * s}" fill="${shade(c1, 0.55)}" opacity=".6"/><rect x="${5.5 * s}" width="${0.4 * s}" height="${8 * s}" fill="${shade(c1, 0.55)}" opacity=".6"/>`
      );
    case 'gingham':
      return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${2 * s}" height="${2 * s}"><rect width="${2 * s}" height="${2 * s}" fill="${c2}"/><rect width="${2 * s}" height="${s}" fill="${c1}" opacity=".5"/><rect width="${s}" height="${2 * s}" fill="${c1}" opacity=".5"/></pattern>`;
    case 'polka':
      return P(6 * s, 6 * s, `<circle cx="${1.5 * s}" cy="${1.5 * s}" r="${0.8 * s}" fill="${c2}"/><circle cx="${4.5 * s}" cy="${4.5 * s}" r="${0.8 * s}" fill="${c2}"/>`);
    case 'floral': {
      const petals = [0, 1, 2, 3, 4]
        .map((i) => {
          const a = (i / 5) * Math.PI * 2;
          const cx = 3 * s + Math.cos(a) * 1.3 * s,
            cy = 3 * s + Math.sin(a) * 1.3 * s;
          return `<ellipse cx="${cx}" cy="${cy}" rx="${1.1 * s}" ry="${0.7 * s}" transform="rotate(${(a * 180) / Math.PI} ${cx} ${cy})" fill="${c2}"/>`;
        })
        .join('');
      return P(10 * s, 7 * s, petals + `<circle cx="${3 * s}" cy="${3 * s}" r="${0.6 * s}" fill="${shade(c2, -0.35)}"/>`);
    }
    case 'denim':
      return P(1.2 * s, 1.2 * s, `<path d="M0 0 L${1.2 * s} ${1.2 * s}" stroke="${shade(c1, 0.18)}" stroke-width="${0.25 * s}"/>`);
    default:
      return P(10, 10, '');
  }
}

export const PATTERN_LABELS = {
  solid: 'Solid',
  stripes: 'Horizontal stripes',
  vstripes: 'Pinstripes',
  plaid: 'Plaid / flannel',
  polka: 'Polka dot',
  floral: 'Floral',
  denim: 'Denim twill',
  gingham: 'Gingham',
};

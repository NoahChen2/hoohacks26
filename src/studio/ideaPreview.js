// What an AI Studio idea does to the scanned garment, so it can be previewed
// before anyone picks up scissors: the idea's title, description and steps are
// read for the changes they describe (crop it, take the sleeves off, cut it into
// shorts, dye it, embroider it…) and applied to the garment's spec. Works the
// same for live and demo results; the preview is an approximation, labelled so.
import { GARMENT_TYPES, garmentFromSpec } from '../garments.js';
import { namedColour } from '../shell/tryOn.js';

const kindOf = (type) => GARMENT_TYPES[type]?.kind;
const has = (text, pattern) => pattern.test(text);
const LIGHT_THREAD = '#f4efe6', DARK_THREAD = '#3a3b40';

function lightness(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  if (!Number.isFinite(n)) return 0.5;
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
function mix(hex, toward, amount) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(toward.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - amount) + ((b >> s) & 255) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
// The colour named in the sentence that mentions `pattern` (e.g. the dye bath or the thread).
function colourNear(text, pattern) {
  for (const sentence of text.split(/[.;\n]/)) if (pattern.test(sentence)) {
    const colour = namedColour(sentence.replace(/\bdenim\b/g, ''));
    if (colour) return colour;
  }
  return null;
}

// Things made from the garment rather than worn: shown as the source garment.
const NOT_WORN = /\b(tote|bag|pouch|scrunchie|headband|hair tie|pillow|cushion|quilt|coaster|bookmark|bunting|keychain|apron|rug|wrap for|bag handle|accessory)\b/;

/**
 * The garment after an idea. `base` is { spec, garment }: the scanned spec (or
 * the analysis spec) and the sized garment it made. Returns
 * { garment, changes: [labels], worn }, where `worn` is false for ideas that
 * turn the garment into something not worn on the body.
 */
export function previewIdea(project, base, body = null, index = 0) {
  const title = `${project.title}`.toLowerCase();
  const text = [project.title, project.description, ...(project.instructions || [])].join('. ').toLowerCase();
  const before = base.garment;
  const spec = { ...base.spec, type: before.type, color: before.color, color2: before.color2, pattern: before.pattern, material: before.material, stains: before.stains, holes: before.holes };
  if (before.neckline) spec.neckline = before.neckline;
  const changes = [];
  const kind = kindOf(spec.type);
  const worn = !has(title, NOT_WORN);

  if (worn) {
    // New garment types, judged on the title first, then the whole idea.
    const retype = (type, label) => {
      if (spec.type === type) return;
      spec.type = type;
      changes.push(label);
    };
    const said = (pattern) => has(title, pattern) || has(text, pattern);
    if (said(/\b(shorts|cut-?offs?)\b/) && kind !== 'top') retype('shorts', 'Cut into shorts');
    else if (said(/\b(into|as|to) (a |an )?(mini |midi |maxi |wrap |a-line )?skirt\b/) || (has(title, /\bskirt\b/) && spec.type !== 'skirt')) retype('skirt', 'Remade as a skirt');
    else if (kind === 'top' && has(title, /\bdress\b/)) retype('dress', 'Lengthened into a dress');
    else if (kind === 'top' && said(/\b(corset|bustier|strapless|tube top|bandeau)\b/)) { retype('cami', 'Strapless'); spec.neckline = 'strapless'; }
    else if (kind === 'top' && said(/\bhalter\b/)) { retype('cami', 'Halter neck'); spec.neckline = 'halter'; }
    else if (kind === 'top' && said(/\b(cami|camisole|spaghetti straps?)\b/)) retype('cami', 'Re-cut as a cami');
    else if (kind === 'top' && GARMENT_TYPES[spec.type].sleeves && said(/\b(vest|gilet|waistcoat)\b/)) retype('vest', 'Sleeves off: a vest');
    else if (kind === 'top' && GARMENT_TYPES[spec.type].sleeves && said(/\b(tank|muscle tee|sleeveless|remove (the )?sleeves|cut (off )?the sleeves|sleeves off)\b/)) retype(['buttonup', 'blouse', 'polo'].includes(spec.type) ? 'vest' : 'tank', 'Sleeveless');
    else if (['sweater', 'hoodie', 'tshirt', 'longsleeve'].includes(spec.type) && said(/\b(cardigan|open front|cut (it )?(open )?(straight )?down the (centre|center) front)\b/)) retype('cardigan', 'Opened into a cardigan');

    const nowKind = kindOf(spec.type);
    // Length.
    if (has(text, /\b(crop|cropped|crop top|shorten the hem|cut .* shorter|mini)\b/) && nowKind !== 'bottom') { spec.length = 'cropped'; changes.push(nowKind === 'top' ? 'Cropped' : 'Mini length'); }
    else if (has(text, /\b(lengthen|ruffle|ruffled|tiered|add (a )?(contrast |deep )?(hem )?band|extend the hem|midi|maxi)\b/)) { spec.length = 'long'; changes.push('Lengthened'); }
    else if (has(text, /\b(tie-?front|tie-?waist|knot(ted)? at the waist|front knot|loose(,)? reversible knot|gentle knot)\b/) && nowKind === 'top') { spec.length = 'short'; spec.fit = 'fitted'; changes.push('Knotted at the waist'); }
    // Sleeves.
    if (GARMENT_TYPES[spec.type].sleeves) {
      if (has(text, /\b(short sleeves|shorten (the )?sleeves|cap sleeves|sleeves? (to|into) (a )?short)\b/)) { spec.sleeves = 'short'; changes.push('Short sleeves'); }
      else if (has(text, /\b(three-quarter|3\/4|roll(ed)? (the )?sleeves|cuffed sleeves)\b/)) { spec.sleeves = 'three-quarter'; changes.push('Three-quarter sleeves'); }
    }
    // Fit.
    if (has(text, /\b(take(n)? in|darts?|tailor(ed)?|fitted|slim(mer)?|cinch(ed)?)\b/)) { spec.fit = 'fitted'; if (!changes.includes('Knotted at the waist')) changes.push('Taken in'); }
    else if (has(text, /\b(oversized|boxy|let out|add (side )?panels)\b/)) { spec.fit = 'oversized'; changes.push('Relaxed fit'); }
    // Colour.
    if (has(text, /\bbleach(ed|ing)?\b/)) { spec.color = mix(spec.color, '#f4efe6', 0.45); changes.push('Bleached lighter'); }
    else if (has(text, /\b(dye|dyed|dyeing|overdye|overdyed|tie-dye)\b/)) {
      const dye = colourNear(text, /\b(dye|dyed|dyeing|overdye|overdyed|tie-dye)\b/);
      spec.color = dye || mix(spec.color, '#1d1c22', 0.35);
      changes.push(dye ? 'Dyed a new colour' : 'Dyed darker');
    }
    // Surface pattern.
    const thread = () => colourNear(text, /\b(thread|floss|yarn|embroider|stitch|paint)\w*/) || (lightness(spec.color) > 0.55 ? DARK_THREAD : LIGHT_THREAD);
    if (has(text, /\b(embroider\w*|floral|flowers?|botanical|daisies|daisy|rosebuds?)\b/)) { spec.pattern = 'floral'; spec.color2 = thread(); changes.push('Embroidered flowers'); }
    else if (has(text, /\bstripes?d?\b/)) { spec.pattern = 'stripes'; spec.color2 = thread(); changes.push('Striped'); }
    else if (has(text, /\b(polka|dots|dotted)\b/)) { spec.pattern = 'polka'; spec.color2 = thread(); changes.push('Polka dots'); }
    else if (has(text, /\bgingham\b/)) { spec.pattern = 'gingham'; spec.color2 = thread(); changes.push('Gingham'); }
    else if (has(text, /\b(plaid|tartan|checkered|checkerboard)\b/)) { spec.pattern = 'plaid'; spec.color2 = thread(); changes.push('Checked'); }
    // Mending and wear.
    if (has(text, /\b(patch(es|ed|work)?|visible mend\w*|darn\w*|sashiko|repair)\b/)) { spec.holes = false; spec.stains = false; changes.push('Mended and patched'); }
    else if (has(text, /\b(cover|hide|conceal)\w* (the |a |any )?(stain|mark)/)) { spec.stains = false; changes.push('Stain covered'); }
    if (has(text, /\b(fray(ed)?|distress(ed)?|rip(ped)?|destroyed)\b/)) { spec.holes = true; changes.push('Distressed'); }
    if (!changes.length && has(text, /\b(motif|stitched detail|accent|embellish\w*|drape|fold)\b/)) changes.push('Small styling detail');
  }

  const garment = garmentFromSpec(spec, body);
  garment.id = `${before.id}-idea-${index}`;
  garment.name = `${project.title}`.slice(0, 60);
  // Keep the photo's own measurements where the shape did not change.
  if (garment.type === before.type) {
    const refit = spec.fit !== base.spec.fit, relength = spec.length !== base.spec.length, resleeve = spec.sleeves !== base.spec.sleeves;
    const keep = ['shoulder', 'hips', 'rise', 'inseam', 'legOpen', 'sleeveOpen'];
    if (!refit) keep.push('chest', 'waist');
    if (!relength) keep.push('length', 'hem');
    if (!resleeve) keep.push('sleeve');
    for (const key of keep) if (Number.isFinite(before[key]) && key in garment) garment[key] = before[key];
  }
  return { garment, changes, worn };
}

/** The spec + garment an idea starts from: the scanned piece that matches the analysis, or the analysis itself. */
export function ideaBase(scan, analysisSpec, body = null) {
  if (scan?.garments?.length) {
    const i = Math.max(0, scan.garments.findIndex((g) => g.type === analysisSpec?.type));
    return { spec: { ...(scan.specs?.[i] || {}), type: scan.garments[i].type }, garment: scan.garments[i] };
  }
  const spec = analysisSpec || { type: 'tshirt' };
  const garment = garmentFromSpec(spec, body);
  garment.id = 'analysis-garment';
  return { spec, garment };
}

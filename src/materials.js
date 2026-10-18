import * as THREE from 'three';
import { headFrame, hairShape } from './character/measurements.js';
import { characterHair } from './character/canonical.js';

// Clean cel rendering: broad two-tone planes, restrained feature ink and a soft
// celestial rim. Materials bypass tone mapping so the palette renders as authored.

const INK = '#15121a';
const noise = (x,y) => { const n=Math.sin(x*127.1+y*311.7)*43758.5453; return n-Math.floor(n); };
const linear = (r,g,b) => new THREE.Vector3(r,g,b);
// Halftone cell size in device pixels; the scene scales it by its pixel ratio.
export const comicDot = { value: 4.5 };

const COMIC_SHADING = /* glsl */`
uniform vec3 comicShade;
uniform vec3 comicDeep;
uniform vec3 comicInk;
uniform float comicLit;
uniform float comicDot;
uniform float comicGloss;
uniform float comicSat;
uniform float comicRim;
uniform float comicWarm;
uniform float comicRimLight;
uniform float comicDots;
uniform float comicFlat;
float comicHalftone(float amount) {
  vec2 cell = fract(mat2(.7071, -.7071, .7071, .7071) * gl_FragCoord.xy / comicDot) - .5;
  float r = amount * .58;
  return (1. - smoothstep(r - .08, r + .08, length(cell))) * step(.04, amount);
}
vec3 comicColor(vec3 base, vec3 light, vec3 n, vec3 toCamera, float occlusion) {
  float lit = dot(light, vec3(.299, .587, .114)) * mix(.55, 1., occlusion);
  float shadow = 1. - smoothstep(comicLit - .02, comicLit + .02, lit);
  // A soft gradient inside the lit band models the forms; the band edge stays hard.
  vec3 color = base * mix(mix(.9, 1.05, smoothstep(comicLit, comicLit * 1.9, lit)), 1., comicFlat);
  color = mix(color, base * comicShade, shadow * (1. - comicFlat));
  // Warm subsurface glow where skin turns from light to shadow.
  color *= mix(vec3(1.), vec3(1.1, .82, .76), comicWarm * (1. - smoothstep(0., .09, abs(lit - comicLit))));
  float deep = smoothstep(comicLit * .92, comicLit * .30, lit);
  color = mix(color, base * comicDeep, comicHalftone(deep) * shadow * comicDots);
  // Baked occlusion darkens creases even where the key light reaches.
  color *= mix(.72, 1., occlusion);
  float glossy = smoothstep(comicLit * 1.95 - .02, comicLit * 1.95 + .02, lit) * comicGloss;
  color = mix(color, mix(base, vec3(1.), .55), glossy);
  float facing = abs(dot(n, toCamera));
  // Thin lavender/cyan back-light rim just inside the contour.
  float rimBand = smoothstep(.17, .23, facing) * (1. - smoothstep(.23, .34, facing)) * mix(.15, 1., shadow);
  vec3 rimTint = mix(vec3(.678, .939, 1.), vec3(.824, .537, .980), smoothstep(-.55, .55, n.x));
  color = mix(color, rimTint, rimBand * comicRimLight);
  return mix(color, comicInk, (1. - smoothstep(.07, .17, facing)) * comicRim);
}
`;

function comicPatch(material, { key, shade, deep, gloss = 0, saturation = 1, rim = 1, lit = .5, warm = 0, rimLight = .45, occlusion = '1.', dots = 1, flat = 0,
  vertexHeader = '', vertexBody = '', fragmentHeader = '', artBody = '', uniforms = {} }) {
  const shared = {
    comicShade: { value: shade }, comicDeep: { value: deep }, comicInk: { value: new THREE.Color(INK) },
    comicLit: { value: lit }, comicDot, comicFlat: { value: flat },
    comicGloss: { value: gloss }, comicSat: { value: saturation }, comicRim: { value: rim },
    comicWarm: { value: warm }, comicRimLight: { value: rimLight }, comicDots: { value: dots }, ...uniforms,
  };
  material.toneMapped = false;
  material.userData.uniforms = shared;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, shared);
    shader.vertexShader = vertexHeader + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertexBody}`);
    shader.fragmentShader = COMIC_SHADING + fragmentHeader + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(.299, .587, .114))), diffuseColor.rgb, comicSat), 0.);
        ${artBody}
        vec3 comicBase = diffuseColor.rgb;
        diffuseColor.rgb = vec3(1.);`)
      .replace('#include <opaque_fragment>', `outgoingLight = comicColor(comicBase, outgoingLight, normal, normalize(vViewPosition), ${occlusion});
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

// --------------------------------------------------------------------- clothing

const FABRIC_GLOSS = { poly: .55, woven: .25, cotton: .18, denim: .15, linen: .12, fleece: 0, wool: 0 };

// Garments show their true colours: no saturation boost in the lit band, and a
// near-neutral shadow band so each fabric keeps its hue in shade.
export function comicMaterial({ color = '#ffffff', map = null, gloss = 0, saturation = 1, side = THREE.DoubleSide } = {}) {
  return comicPatch(new THREE.MeshLambertMaterial({ color, map, side }), {
    key: 'comic-fabric-v1', gloss, saturation, shade: linear(.50, .49, .56), deep: linear(.24, .23, .30),
  });
}

export const fabricGloss = g => FABRIC_GLOSS[g.material] ?? .15;

// Sparse inked hatching in place of a photographic weave; it reads as comic texture.
export function paintComicGrain(ctx,w,h,material) {
  const size=96,tile=document.createElement('canvas');tile.width=tile.height=size;
  const c=tile.getContext('2d');c.strokeStyle=c.fillStyle='rgba(21,18,26,.16)';c.lineCap='round';c.lineWidth=1.1;
  const stroke=(x0,y0,x1,y1)=>{c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();};
  for(let i=0;i<22;i++) {
    const x=noise(i,1)*size,y=noise(i,2)*size,r=noise(i,3);
    if(material==='denim'){for(let k=0;k<3;k++)stroke(x+k*3,y,x+k*3+5,y+5);}
    else if(material==='wool'){stroke(x,y,x+3,y+4);stroke(x+3,y+4,x+6,y);}
    else if(material==='fleece'){c.beginPath();c.arc(x,y,.9+r,0,Math.PI*2);c.fill();}
    else if(material==='linen'){stroke(x,y,x+9,y);if(r>.5)stroke(x+2,y+3,x+8,y+3);}
    else if(r>.35){stroke(x,y,x+4,y-4);stroke(x+3,y+1,x+7,y-3);}
  }
  ctx.fillStyle=ctx.createPattern(tile,'repeat');ctx.fillRect(0,0,w,h);
}

// Inverted hull with a width proportional to view distance, so the ink line
// keeps a constant on-screen thickness at any zoom level.
export function outlineMaterial(width = .0028, color = INK) {
  const material=new THREE.MeshBasicMaterial({color,side:THREE.BackSide,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.outlineWidth={value:width};
    shader.vertexShader='uniform float outlineWidth;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float outlineDistance = -(modelViewMatrix * vec4(position, 1.)).z;
      transformed += normalize(normal) * outlineWidth * outlineDistance / length(modelMatrix[0].xyz);`);
  };
  material.customProgramCacheKey=()=> `comic-outline-v2-${width}-${color}`;
  return material;
}

// ------------------------------------------------------------------------- body

// Line art is drawn in the body's measured (pre-presentation) centimetre space,
// carried by the `basePosition` attribute, so it follows every proportion slider.
// Strokes are data: their control points are computed from the body landmarks in
// JS (bodyStrokes) and read from a small float texture in one loop. That keeps
// the shader short, which matters most on Windows, where Direct3D shader
// compilers unroll and inline everything (a hard-coded stroke list took seconds
// to compile there).
const FRAMES = { faceMirror: 0, face: 1, ear: 2, frontMirror: 3, front: 4, backMirror: 5, back: 6, armFront: 7, armBack: 8, legFront: 9, legBack: 10 };
const MAX_STROKES = 96;

const BODY_ART = /* glsl */`
uniform vec4 uHead;    // headY, headR, headZ, hair covers the nape
uniform vec4 uHairline; // hairline levels (head radii): forehead, temples, side curtains, nape
uniform vec4 uHairInfo; // curtains, ears covered, texture (0 straight, 1 curly, 2 buzz, 3 mohawk, 4 none), strip half-width
uniform vec4 uSkinInfo; // deepness of the skin tone (0 light .. 1 deep)
uniform vec4 uTrunkY;  // neckTopY, neckBaseY, shoulderY, chestY
uniform vec4 uTrunkY2; // armpitY, waistY, hipY, crotchY
uniform vec4 uTrunkX;  // shoulderHalf, chestHalf, waistHalf, hipHalf
uniform vec4 uArm;     // jointX, jointY, armAngle, armLength
uniform vec4 uLeg;     // legX, thighR, upperArmR, neckR
uniform vec3 uStyle;   // shape (feminine 1, neutral .5, masculine 0), definition, height
uniform vec3 uHair, uHairHighlight, uIris, uLip, uJawShadow, uForeheadShadow, uNose, uMouth, uLash, uBrief, uBriefTrim, uShoe, uShoeAccent, uSole;
uniform highp sampler2D uStrokes;
uniform int uStrokeCount;
varying vec3 vBase;
varying float vHairMask;
float artPx;
float inkW(float d, float w) { return 1. - smoothstep(w - artPx, w + artPx, d); }
float fillIn(float d) { return 1. - smoothstep(-artPx, artPx, d); }
// Tapered quadratic stroke; the curve lies inside the hull of its control points.
float stroke(vec2 p, vec2 a, vec2 b, vec2 c, float w) {
  if (any(lessThan(p, min(min(a, b), c) - w - artPx)) || any(greaterThan(p, max(max(a, b), c) + w + artPx))) return 0.;
  float best = 1e9, bt = 0.;
  vec2 prev = a;
  for (int i = 1; i <= 8; i++) {
    float t = float(i) / 8.;
    vec2 q = mix(mix(a, b, t), mix(b, c, t), t), pa = p - prev, ba = q - prev;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0., 1.), d = length(pa - ba * h);
    if (d < best) { best = d; bt = (float(i - 1) + h) / 8.; }
    prev = q;
  }
  return inkW(best, w * (.22 + .78 * sin(3.14159 * bt)));
}
vec3 bodyArt(vec3 skin, vec3 ink) {
  vec3 p = vBase;
  artPx = max(length(fwidth(vBase)) * .6, .015);
  float fem = uStyle.x, H = uStyle.z;
  float neckTop = uTrunkY.x, neckBase = uTrunkY.y, shoulderY = uTrunkY.z, chestY = uTrunkY.w;
  float hipY = uTrunkY2.z, crotchY = uTrunkY2.w;
  float Sx = uTrunkX.x, Cx = uTrunkX.y;
  float ax = abs(p.x), side = p.x < 0. ? -1. : 1.;
  bool front = p.z >= 0.;
  vec3 col = skin;
  float lines = 0.;

  // Arm frame: t runs down the arm from the shoulder joint, u is outward.
  float a = uArm.z, L = uArm.w, Ra = uLeg.z;
  vec2 joint = vec2(side * uArm.x, uArm.y), dir = vec2(side * sin(a), -cos(a)), outward = vec2(side * cos(a), sin(a));
  float t = dot(p.xy - joint, dir), u = dot(p.xy - joint, outward);
  float armR = Ra * (1. - .45 * clamp(t / L, 0., 1.));
  bool onArm = t > Ra * .35 && length(vec2(u, p.z)) < armR * 1.3 && p.y < shoulderY;
  bool onLeg = p.y < crotchY + 1.5;
  float headY = uHead.x, R = uHead.y;
  bool onHead = p.y > headY - R * (1.08 + .25 * uHead.w);
  vec2 hp = vec2(p.x, p.y - headY), fp = vec2(ax, p.y - headY);
  float hz = p.z - uHead.z;
  bool onFace = onHead && hz > R * .25;
  vec2 ep = vec2(p.z - uHead.z, p.y - (headY - R * .27));
  // Curtains and big volumes cover the ears.
  bool onEar = onHead && uHairInfo.y < .5 && ax > R * .58 && abs(ep.y) < R * .3 && abs(ep.x) < R * .22;
  bool onTorso = !onHead && !onArm && !onLeg;
  float lx = ax - uLeg.x, tR = uLeg.y;

  // Stroke frames; see FRAMES in materials.js.
  vec2 frame[11];
  bool live[11];
  frame[0] = fp; live[0] = onFace;
  frame[1] = hp; live[1] = onFace;
  frame[2] = ep; live[2] = onEar;
  frame[3] = vec2(ax, p.y); live[3] = onTorso && front;
  frame[4] = p.xy; live[4] = onTorso && front;
  frame[5] = vec2(ax, p.y); live[5] = onTorso && !front;
  frame[6] = p.xy; live[6] = onTorso && !front;
  frame[7] = vec2(u, t); live[7] = onArm && front;
  frame[8] = vec2(u, t); live[8] = onArm && !front;
  frame[9] = vec2(lx, p.y); live[9] = onLeg && front;
  frame[10] = vec2(lx, p.y); live[10] = onLeg && !front;
  // Anatomy strokes; hidden later wherever underwear or shoes cover the skin.
  // Heavier on deep skin tones so the ink still reads against them.
  float art = 0., covered = 0., lineBoost = 1. + .45 * uSkinInfo.x;
  for (int i = 0; i < uStrokeCount; i++) {
    vec4 ab = texelFetch(uStrokes, ivec2(2 * i, 0), 0), cw = texelFetch(uStrokes, ivec2(2 * i + 1, 0), 0);
    int f = int(cw.w);
    if (!live[f]) continue;
    art = max(art, (cw.w - float(f)) * 2. * stroke(frame[f], ab.xy, ab.zw, cw.xy, cw.z * lineBoost));
  }

  if (onFace) {
    // H = 2R, W = .78H: all placements below are direct normalized values.
    vec2 eye = (2. * R) * vec2(.17, -.08), er = R * vec2(.205, mix(.108, .135, fem));
    vec2 eyeQ = fp - eye;
    eyeQ.y -= eyeQ.x * .12;
    float eyeDistance = (length(eyeQ / er) - 1.) * er.y;
    float inEye = fillIn(eyeDistance);
    col = mix(col, vec3(.985, .975, .955), inEye);
    float ir = length((fp - eye) / vec2(.8, 1.));
    col = mix(col, uIris, fillIn(ir - R * .105) * inEye);
    col = mix(col, vec3(.071, .027, .016), fillIn(ir - R * .045) * inEye);
    vec2 eyeWorld = vec2(side * eye.x, eye.y);
    col = mix(col, vec3(1.), fillIn(length(hp - eyeWorld - (2. * R) * vec2(-.02, .02)) - R * .022) * inEye);
    col = mix(col, vec3(1.), fillIn(length(hp - eyeWorld - R * vec2(side * .025, -.035)) - R * .01) * inEye);
    float eyeShell = abs(eyeDistance);
    float upperLash = inkW(eyeShell, R * .02) * smoothstep(eye.y - R * .005, eye.y + R * .02, fp.y);
    float outerLash = inkW(length(fp - (eye + R * vec2(.14, .018))), R * .013) * fem;
    float browHalf = R * .1404, browSpan = 1. - smoothstep(browHalf * .82, browHalf, abs(fp.x - eye.x));
    float browLine = R * .085 + .04 * R * (1. - pow(clamp((fp.x - eye.x) / browHalf, -1., 1.), 2.));
    float browThickness = R * mix(.032, .025, fem);
    float brow = inkW(abs(fp.y - browLine), browThickness) * browSpan;
    // Triangular warm nose-side plane and 0.03W nostril tick at Y=-.20H.
    vec2 nq = hp / (2. * R) - vec2(0., -.22);
    float noseSide = fillIn(max(max(-nq.x - .018, nq.x - .022 + nq.y * .45), abs(nq.y) - .035) * (2. * R));
    col = mix(col, uNose, noseSide);
    float nostrilSpan = 1. - smoothstep(R * .018, R * .0468, abs(hp.x - R * .025));
    float nostril = inkW(abs(hp.y + R * .46), R * .007) * nostrilSpan;
    // Mouth at -.33H with the requested lower-lip dash at -.36H.
    float mouthHalf = R * .17, mouthSpan = 1. - smoothstep(mouthHalf * .82, mouthHalf, abs(hp.x));
    float smileY = R * (-.70 + .035 * pow(abs(hp.x) / mouthHalf, 1.6));
    float smile = inkW(abs(hp.y - smileY), R * .009) * mouthSpan;
    float lipDash = inkW(abs(hp.y + R * .72), R * .006) * (1. - smoothstep(R * .045, R * .0546, abs(hp.x)));
    col = mix(col, uMouth, smile);
    col = mix(col, uLip, lipDash * .8);
    col = mix(col, uLash, max(max(upperLash, outerLash), max(brow, nostril * .65)));
    // Thin mandibular edge from each ear to the gender-specific chin width.
    float faceV = hp.y / (2. * R);
    float jawX = .35 * .78 * 2. * R * clamp((faceV + .50) / .25, 0., 1.);
    float jawInk = inkW(abs(fp.x - jawX), R * .009) * step(faceV, -.22) * step(-.505, faceV);
    col = mix(col, ink, jawInk * .18);
    // Hair volume casts a warm shadow across +.12H .. +.25H forehead.
    float foreheadBand = smoothstep(.15, .26, hp.y / R) * (1. - smoothstep(.30, .42, hp.y / R));
    col = mix(col, uForeheadShadow, foreheadBand * .22);
  }
  // Direct sub-chin crescent across the upper front neck (-.50H .. -.62H).
  float headLocalY = (p.y - headY) / (2. * R);
  float neckShadowEdge = -.64 + .17 * clamp(ax / (.42 * R), 0., 1.);
  float subChin = smoothstep(neckShadowEdge - .015, neckShadowEdge + .015, headLocalY) * step(headLocalY, -.49) * (1. - smoothstep(.35 * R, .46 * R, ax));
  col = mix(col, uJawShadow, subChin);
  float headHair = 0.;
  if (onHead) {
    // Painted hair above the hairstyle's hairline: fringe, shine and strands (or
    // curls, or buzz-cut stubble).
    float ang = atan(p.x, hz), aa = abs(ang), tex = uHairInfo.z;
    float frontness = 1. - smoothstep(.25, 1.35, aa), backness = smoothstep(1.75, 2.75, aa);
    float sides = mix(uHairline.y, uHairline.x, frontness);
    sides = mix(sides, uHairline.z, uHairInfo.x * smoothstep(.95, 1.45, aa));
    float hairline = mix(sides, uHairline.w, backness);
    float jag = tex < .5 ? .5 + .5 * sin(ang * 5. + .7) : tex < 1.5 ? .5 + .5 * sin(ang * 16.) : 0.;
    hairline -= frontness * .12 * jag;
    float ears = onEar ? 0. : 1.;
    float hairD = hairline * R - hp.y;
    bool mohawk = tex > 2.5 && tex < 3.5, buzz = tex > 1.5 && tex < 2.5;
    float stripD = mohawk ? max(hairD, ax - uHairInfo.w * R) : hairD;
    float region = fillIn(hairD) * ears * step(tex, 3.5);
    float hair = buzz ? 0. : fillIn(stripD) * region;
    float stubble = buzz ? region : mohawk ? region - hair : 0.;
    col = mix(col, uHair, stubble * .85);
    lines = max(lines, inkW(abs(hairD), R * .008) * stubble);
    vec3 hairColor;
    if (tex > .5 && tex < 1.5) {
      // Curls: rows of inked crescents with a glint in each.
      vec2 q = vec2(ang * 1.15, hp.y / R) / .26;
      q.x += .5 * mod(floor(q.y), 2.);
      vec2 f = fract(q) - .5;
      float curl = inkW(abs(length(f) - .3) * R * .26, R * .014) * step(f.y - f.x * .6, .08);
      float glint = inkW(abs(length(f - vec2(-.04, .05)) - .2) * R * .26, R * .012) * step(.05, -f.x - f.y);
      hairColor = mix(mix(uHair, mix(uHair, vec3(.75, .85, 1.), .5), glint * .7), ink, curl * .75);
    } else {
      float zig = abs(fract(ang * 3.5) - .5) * 2.;
      float shine = inkW(abs(hp.y - R * (.50 + .06 * zig)), R * .035) * (1. - backness);
      float layerBand = (1. - smoothstep(R * .025, R * .075, abs(fract(ang * 1.15 + hp.y / R * .24) - .5) * R)) * .18;
      hairColor = mix(uHair, uHairHighlight, clamp(shine * .72 + layerBand, 0., .78));
    }
    col = mix(col, hairColor, hair);
    lines = max(lines, inkW(abs(stripD), R * .006) * ears * step(tex, 3.5) * (buzz ? 0. : .25));
    headHair = max(hair, stubble);
    covered = max(covered, headHair);
  }
  if (onTorso) {
    vec2 m = vec2(ax, p.y);
    if (front && fem < .5) col = mix(col, uLip * .85, fillIn(length(m - vec2(Cx * .52, chestY - 1.8)) - .55));
    if (!front) col = mix(col, skin * vec3(.75, .6, .6), fillIn(length(m - vec2(3.2, hipY + 5.)) - .4));
    // Sports top (feminine and neutral shapes) with straps; over the torso and back.
    if (fem > .25) {
      float top = front ? chestY + 3. + ax * .2 : chestY + 3.;
      float bottom = chestY - (front ? 8.5 : 6.);
      float strapX = mix(Cx * .40, Sx * .52, clamp((p.y - top) / (shoulderY + 3. - top), 0., 1.));
      float dBra = min(max(bottom - p.y, p.y - top), max(abs(ax - strapX) - 1.1, max(bottom - p.y, p.y - shoulderY - 4.)));
      col = mix(col, mix(uBrief, uBriefTrim, step(p.y, bottom + 1.6)), fillIn(dBra));
      covered = max(covered, fillIn(dBra));
      lines = max(lines, inkW(abs(dBra), .14));
      lines = max(lines, inkW(abs(p.y - bottom - 1.6), .07) * fillIn(dBra));
    }
  }
  // Underwear at a realistic mid rise (a hand below the navel): trunks to mid
  // thigh for the masculine body, full briefs with a moderate leg cut otherwise.
  // A high, low-rise cut reads as extra leg length.
  float waistband = uTrunkY2.y - 7.5, outer = clamp(lx / tR * .5 + .5, 0., 1.);
  float opening = fem > .5 ? crotchY - (front ? 1.5 : 3.5) + 4.5 * outer : crotchY - 7. + 1.2 * outer;
  // Limited to the hips' width so hanging hands beside the thighs stay bare.
  if (!onArm && ax < uTrunkX.w + 3. && p.y < waistband + 1. && p.y > crotchY - 10.) {
    float dBrief = max(p.y - waistband, onLeg ? opening - p.y : -1e3);
    col = mix(col, mix(uBrief, uBriefTrim, step(waistband - 1.7, p.y)), fillIn(dBrief));
    covered = max(covered, fillIn(dBrief));
    lines = max(lines, inkW(abs(dBrief), .15));
    lines = max(lines, inkW(abs(p.y - (waistband - 1.7)), .08) * fillIn(dBrief));
  }
  // Hanging hair (tails, braids, long hair) from the baked mask, over any
  // straps and strokes beneath it, inked where it meets the skin.
  float drape = smoothstep(.3, .7, vHairMask);
  if (vHairMask > .01) {
    float strand = inkW(abs(fract((p.x + .3 * p.z) / 1.6) - .5) * 1.6, .05) * step(.95, drape);
    float zig = abs(fract(p.x / R * 3.5) - .5) * 2.;
    float highlight = inkW(abs(hp.y - R * (.50 + .06 * zig)), R * .035);
    col = mix(col, mix(mix(uHair, uHairHighlight, highlight), ink, strand * .18), drape);
    lines *= 1. - drape;
    covered = max(covered, drape);
    float mw = max(fwidth(vHairMask), 1e-4);
    lines = max(lines, (1. - smoothstep(mw * .9, mw * 1.8, abs(vHairMask - .5))) * (1. - headHair));
  }
  // Sneakers: upper, side stripe, sole and laces.
  float collar = .052 * H + (front ? 1.5 : -.5);
  if (onLeg && p.y < collar + .4) {
    float shoe = step(p.y, collar);
    vec3 shoeColor = mix(uShoe, uShoeAccent, step(abs(p.y - .026 * H), .9) * step(.5 * tR, abs(lx) + .2 * tR));
    col = mix(col, mix(shoeColor, uSole, step(p.y, 1.1)), shoe);
    covered = max(covered, shoe);
    lines = max(lines, inkW(abs(p.y - collar), .16));
    lines = max(lines, inkW(abs(p.y - 1.1), .12) * shoe);
    lines = max(lines, inkW(abs(fract(p.z / 1.7) - .5) * 1.7, .12) * step(abs(lx), 1.6) * step(2.5, p.y) * step(p.z, .095 * H) * step(.04 * H, p.z) * shoe);
  }
  lines = max(lines, art * (1. - covered));
  return mix(col, ink, clamp(lines, 0., 1.));
}
`;

// Strokes for one body: [ax, ay, bx, by, cx, cy, width, frame + weight / 2] each,
// in the frame's 2D coordinates (centimetres). Straight segments are quadratic
// strokes with a midpoint control.
function bodyStrokes(model, character) {
  const lm = model.lm, H = lm.H, R = headFrame(H).r, fem = shapeValue(character.bodyPreset);
  const def = character.proportions.muscleDefinition, muscle = Math.max(0, Math.min(1, .35 + def * 1.2 - fem * .25));
  const Sx = model.b.shoulder / 2, Cx = model.profileAt(lm.chestY).rx, Wx = model.profileAt(lm.waistY).rx, Hx = model.profileAt(lm.hipY).rx;
  const { chestY, waistY, hipY, crotchY, shoulderY, armpitY, neckBaseY: neckBase, neckTopY: neckTop } = lm;
  const Ra = model.upperR, L = lm.wristT, tR = model.thighR, K = .275 * H, ankle = .052 * H;
  const F = FRAMES, out = [];
  const bez = (frame, a, b, c, w, weight = 1) => { if (weight > .01) out.push(a[0], a[1], b[0], b[1], c[0], c[1], w * .56, frame + Math.min(weight, 1) / 2); };
  const seg = (frame, a, b, w, weight) => bez(frame, a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, w, weight);
  const r = (x, y) => [x * R, y * R];
  // Facial features are analytic in the shader. No wrinkle, cheek, chin, ear,
  // nasolabial or under-eye stroke data is generated.
  if (fem === 0) {
    bez(F.frontMirror, [.6, chestY + 2.5], [Cx * .42, chestY - 6.5], [Cx * .88, chestY + 2], .2 + .1 * muscle);
    seg(F.frontMirror, [0, chestY + 5], [0, chestY - 1.5], .12, muscle);
    if (def >= .45) for (let k = 0; k < 3; k++) seg(F.frontMirror, [Cx * .8, chestY - 4 - k * 2.6], [Cx * .93, chestY - 5.2 - k * 2.6], .15, muscle);
  }
  // Abdominals, scaled by muscle definition; navel and hip lines.
  const absW = .17 * (.5 + muscle * .5);
  seg(F.front, [0, chestY - 7], [0, waistY - 6], absW, muscle);
  for (let k = 0; k < 3; k++) if (muscle >= .3 * k) {
    const y = chestY - 10.5 - k * 5;
    bez(F.frontMirror, [.5, y], [2.6, y - .7], [Wx * .36, y + .3], absW, muscle);
  }
  bez(F.frontMirror, [Cx * .44, chestY - 7.5], [Wx * .48, waistY], [3, waistY - 9], absW, muscle);
  bez(F.frontMirror, [Hx * .8, hipY + 7.5], [Hx * .52, hipY + 1], [3, crotchY + 3], .14 + .1 * muscle);
  bez(F.front, [-.55, waistY - 2.4], [0, waistY - 3.4], [.55, waistY - 2.4], .16);
  bez(F.front, [-.4, waistY - 2.3], [0, waistY - 1.8], [.4, waistY - 2.3], .09);
  // Back: spine, shoulder blades, lats.
  seg(F.back, [0, neckBase - 3], [0, waistY - 2], .13);
  bez(F.backMirror, [Sx * .28, shoulderY - 4], [Sx * .28, chestY - 6], [Sx * .62, chestY - 3.5], .18);
  bez(F.backMirror, [Cx * .93, armpitY - 1], [Cx * .74, chestY - 9], [Wx * .55, waistY - 2], .16, muscle);
  // Arms (u across, t down from the shoulder joint).
  bez(F.armFront, [-.45 * Ra, .03 * L], [.05 * Ra, .16 * L], [.6 * Ra, .30 * L], .16);
  bez(F.armFront, [-.68 * Ra, .20 * L], [-.36 * Ra, .33 * L], [-.52 * Ra, .44 * L], .12 + .08 * muscle);
  bez(F.armFront, [-.35 * Ra, .47 * L], [0, .505 * L], [.25 * Ra, .47 * L], .13);
  bez(F.armFront, [.45 * Ra, .53 * L], [.36 * Ra, .67 * L], [.14 * Ra, .80 * L], .12);
  seg(F.armFront, [-.3 * Ra, .985 * L], [.25 * Ra, .985 * L], .1);
  bez(F.armBack, [.45 * Ra, .10 * L], [.05 * Ra, .30 * L], [.2 * Ra, .42 * L], .15);
  bez(F.armBack, [-.2 * Ra, .50 * L], [0, .535 * L], [.2 * Ra, .50 * L], .13);
  // Legs (outward offset from the leg axis, height).
  bez(F.legFront, [-.32 * tR, K + 1], [-.04 * tR, K - 3.4], [.25 * tR, K + 1], .17);
  bez(F.legFront, [-.25 * tR, K + 2.6], [-.04 * tR, K + 4.4], [.2 * tR, K + 2.6], .13);
  bez(F.legFront, [-.56 * tR, K + 15], [-.64 * tR, K + 5], [-.22 * tR, K + 3], .13 + .07 * muscle);
  bez(F.legFront, [.55 * tR, crotchY - 4], [.48 * tR, K + 14], [.3 * tR, K + 4.5], .1 + .07 * muscle);
  seg(F.legFront, [-.06 * tR, K - 5], [-.1 * tR, ankle + 6], .1);
  bez(F.legFront, [.48 * tR, K - 3], [.56 * tR, .2 * H], [.26 * tR, .1 * H], .12);
  bez(F.legBack, [-.32 * tR, K + .5], [0, K - 1.2], [.32 * tR, K + .5], .15);
  bez(F.legBack, [0, K - 5], [-.06 * tR, .2 * H], [.08 * tR, .13 * H], .14);
  bez(F.legBack, [.36 * tR, K - 3], [.46 * tR, .19 * H], [.16 * tR, .13 * H], .12);
  return out;
}

// Feminine 1, neutral .5, masculine 0.
const shapeValue = preset => ({ feminine: 1, neutral: .5, masculine: 0 })[preset] ?? 1;

const SKIN = { color: '#f3c6b1', shade: linear(.89, .70, .63), deep: linear(.78, .53, .48) };

export function bodyMaterial() {
  const color = c => ({ value: new THREE.Color(c) });
  const vec4 = () => ({ value: new THREE.Vector4() });
  const strokes = new THREE.DataTexture(new Float32Array(MAX_STROKES * 2 * 4), MAX_STROKES * 2, 1, THREE.RGBAFormat, THREE.FloatType);
  strokes.minFilter = strokes.magFilter = THREE.NearestFilter;
  const uniforms = {
    uHead: vec4(), uHairline: vec4(), uHairInfo: vec4(), uSkinInfo: vec4(), uTrunkY: vec4(), uTrunkY2: vec4(), uTrunkX: vec4(), uArm: vec4(), uLeg: vec4(),
    uStyle: { value: new THREE.Vector3(0, .15, 172) },
    uHair: color('#261815'), uHairHighlight: color('#4e352f'), uIris: color('#3b2219'), uLip: color('#d49279'),
    uJawShadow: color('#d99b82'), uForeheadShadow: color('#d99b82'),
    uNose: color('#c9886e'), uMouth: color('#5c2e26'), uLash: color('#1e1412'),
    uBrief: color('#2f4b8f'), uBriefTrim: color('#f1d24a'),
    uShoe: color('#f5f2ea'), uShoeAccent: color('#e0443e'), uSole: color('#c9c3b5'),
    uStrokes: { value: strokes }, uStrokeCount: { value: 0 },
  };
  return comicPatch(new THREE.MeshLambertMaterial({ color: SKIN.color }), {
    key: 'anime-body-v3', shade: SKIN.shade.clone(), deep: SKIN.deep.clone(), lit: .54, warm: 0, rim: .04, rimLight: .18, occlusion: '1.', dots: 0, flat: 1, uniforms: { ...uniforms, comicInk: color('#3a231e') },
    vertexHeader: 'attribute vec3 basePosition;\nattribute float ao;\nattribute float hairMask;\nvarying vec3 vBase;\nvarying float vAO;\nvarying float vHairMask;\n',
    vertexBody: 'vBase = basePosition;\nvAO = ao;\nvHairMask = hairMask;',
    fragmentHeader: 'varying float vAO;\n' + BODY_ART,
    artBody: 'diffuseColor.rgb = bodyArt(diffuseColor.rgb, comicInk);',
  });
}

// Landmarks are in the measured body's centimetres (before presentation).
export function updateBodyArt(material, model, character) {
  const u = material.userData.uniforms, lm = model.lm, H = lm.H, head = headFrame(H);
  // The hairstyle the displayed mesh was built with.
  const hair = hairShape(characterHair(character));
  u.uHead.value.set(head.y, head.r, head.z, hair.neck);
  u.uHairline.value.set(hair.top, hair.side, hair.drop, hair.back);
  u.uHairInfo.value.set(hair.curtain, hair.ears, hair.texture, hair.strip);
  u.uTrunkY.value.set(lm.neckTopY, lm.neckBaseY, lm.shoulderY, lm.chestY);
  u.uTrunkY2.value.set(lm.armpitY, lm.waistY, lm.hipY, lm.crotchY);
  u.uTrunkX.value.set(model.b.shoulder / 2, model.profileAt(lm.chestY).rx, model.profileAt(lm.waistY).rx, model.profileAt(lm.hipY).rx);
  u.uArm.value.set(model.jointR.x, model.jointR.y, lm.armAngle, lm.wristT);
  u.uLeg.value.set(lm.legX, model.thighR, model.upperR, model.neckR);
  u.uStyle.value.set(shapeValue(character.bodyPreset), character.proportions.muscleDefinition, H);
  const strokes = bodyStrokes(model, character), texture = u.uStrokes.value;
  texture.image.data.fill(0);
  texture.image.data.set(strokes.slice(0, MAX_STROKES * 8));
  texture.needsUpdate = true;
  u.uStrokeCount.value = Math.min(strokes.length / 8, MAX_STROKES);
}

// Skin and hair colours are plain uniforms: changing them never recompiles the
// shader or rebuilds the mesh. Shadow and halftone tints follow the tone, so
// deep tones shade toward a cool, saturated brown instead of muddy grey-black.
const SHADE_DEEP = { shade: linear(.78, .61, .56), deep: linear(.62, .42, .38) };
export function updateBodyAppearance(material, { skin = SKIN.color, hair = '#261815' } = {}) {
  const u = material.userData.uniforms, tone = new THREE.Color(skin);
  material.color.copy(tone);
  u.uHair.value.set(hair);
  const hairTone = new THREE.Color(hair).lerp(new THREE.Color('#8a6559'), .28);
  u.uHairHighlight.value.copy(hair === '#261815' ? new THREE.Color('#4e352f') : hairTone);
  const srgb = tone.clone().convertLinearToSRGB();
  const lightness = .2126 * srgb.r + .7152 * srgb.g + .0722 * srgb.b;
  const deepness = 1 - Math.max(0, Math.min(1, (lightness - .25) / .5));
  u.comicShade.value.copy(SKIN.shade).lerp(SHADE_DEEP.shade, deepness);
  u.comicDeep.value.copy(SKIN.deep).lerp(SHADE_DEEP.deep, deepness);
  u.uSkinInfo.value.set(deepness, 0, 0, 0);
  // Lips: a rosier, darker version of the tone.
  u.uLip.value.setRGB(srgb.r * .9, srgb.g * .63, srgb.b * .73, THREE.SRGBColorSpace);
}

export function bodyOutlineMaterial() {
  return outlineMaterial(.00105, '#3a231e');
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

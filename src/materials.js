import * as THREE from 'three';
import { headFrame } from './character/measurements.js';

// Comic-book rendering: flat cartoon colours, one hard shadow band, screen-space
// halftone dots in the deeper shade, ink rim lines and an inverted-hull outline.
// Comic materials bypass tone mapping so the palette renders as authored.

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
float comicHalftone(float amount) {
  vec2 cell = fract(mat2(.7071, -.7071, .7071, .7071) * gl_FragCoord.xy / comicDot) - .5;
  float r = amount * .58;
  return (1. - smoothstep(r - .08, r + .08, length(cell))) * step(.04, amount);
}
vec3 comicColor(vec3 base, vec3 light, vec3 n, vec3 toCamera, float occlusion) {
  float lit = dot(light, vec3(.299, .587, .114)) * mix(.55, 1., occlusion);
  float shadow = 1. - smoothstep(comicLit - .02, comicLit + .02, lit);
  // A soft gradient inside the lit band models the forms; the band edge stays hard.
  vec3 color = base * mix(.9, 1.05, smoothstep(comicLit, comicLit * 1.9, lit));
  color = mix(color, base * comicShade, shadow);
  // Warm subsurface glow where skin turns from light to shadow.
  color *= mix(vec3(1.), vec3(1.1, .82, .76), comicWarm * (1. - smoothstep(0., .09, abs(lit - comicLit))));
  float deep = smoothstep(comicLit * .92, comicLit * .30, lit);
  color = mix(color, base * comicDeep, comicHalftone(deep) * shadow * comicDots);
  // Baked occlusion darkens creases even where the key light reaches.
  color *= mix(.72, 1., occlusion);
  float glossy = smoothstep(comicLit * 1.95 - .02, comicLit * 1.95 + .02, lit) * comicGloss;
  color = mix(color, mix(base, vec3(1.), .55), glossy);
  float facing = abs(dot(n, toCamera));
  // Thin back-light rim just inside the ink line, strongest on the shadow side.
  float rimBand = smoothstep(.17, .23, facing) * (1. - smoothstep(.23, .34, facing)) * mix(.15, 1., shadow);
  color = mix(color, mix(base, vec3(1.), .4), rimBand * comicRimLight);
  return mix(color, comicInk, (1. - smoothstep(.07, .17, facing)) * comicRim);
}
`;

function comicPatch(material, { key, shade, deep, gloss = 0, saturation = 1, rim = 1, lit = .5, warm = 0, rimLight = .45, occlusion = '1.', dots = 1,
  vertexHeader = '', vertexBody = '', fragmentHeader = '', artBody = '', uniforms = {} }) {
  const shared = {
    comicShade: { value: shade }, comicDeep: { value: deep }, comicInk: { value: new THREE.Color(INK) },
    comicLit: { value: lit }, comicDot,
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

export function comicMaterial({ color = '#ffffff', map = null, gloss = 0, saturation = 1.35, side = THREE.DoubleSide } = {}) {
  return comicPatch(new THREE.MeshLambertMaterial({ color, map, side }), {
    key: 'comic-fabric-v1', gloss, saturation, shade: linear(.40, .40, .55), deep: linear(.17, .16, .28),
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
export function outlineMaterial(width = .0028) {
  const material=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide,toneMapped:false});
  material.onBeforeCompile=shader=>{
    shader.uniforms.outlineWidth={value:width};
    shader.vertexShader='uniform float outlineWidth;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float outlineDistance = -(modelViewMatrix * vec4(position, 1.)).z;
      transformed += normalize(normal) * outlineWidth * outlineDistance / length(modelMatrix[0].xyz);`);
  };
  material.customProgramCacheKey=()=> `comic-outline-v1-${width}`;
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
uniform vec4 uHead;    // headY, headR, headZ, longHair
uniform vec4 uTrunkY;  // neckTopY, neckBaseY, shoulderY, chestY
uniform vec4 uTrunkY2; // armpitY, waistY, hipY, crotchY
uniform vec4 uTrunkX;  // shoulderHalf, chestHalf, waistHalf, hipHalf
uniform vec4 uArm;     // jointX, jointY, armAngle, armLength
uniform vec4 uLeg;     // legX, thighR, upperArmR, neckR
uniform vec3 uStyle;   // feminine, definition, height
uniform vec3 uHair, uIris, uLip, uBrief, uBriefTrim, uShoe, uShoeAccent, uSole;
uniform highp sampler2D uStrokes;
uniform int uStrokeCount;
varying vec3 vBase;
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
  vec2 ep = vec2(p.z - uHead.z + 1.1, p.y - (headY - R * .06));
  // The long style's side curtains cover the ears.
  bool onEar = onHead && uHead.w < .5 && ax > R * .58 && abs(ep.y) < R * .3 && abs(ep.x) < R * .22;
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
  float art = 0., covered = 0.;
  for (int i = 0; i < uStrokeCount; i++) {
    vec4 ab = texelFetch(uStrokes, ivec2(2 * i, 0), 0), cw = texelFetch(uStrokes, ivec2(2 * i + 1, 0), 0);
    int f = int(cw.w);
    if (!live[f]) continue;
    art = max(art, (cw.w - float(f)) * 2. * stroke(frame[f], ab.xy, ab.zw, cw.xy, cw.z));
  }

  if (onFace) {
    // Eyes: sclera, iris, pupil and catch-light; lips and blush.
    vec2 eye = R * vec2(.29, -.02), er = R * vec2(.125, mix(.058, .072, fem));
    float inEye = fillIn((length((fp - eye) / er) - 1.) * er.y);
    col = mix(col, vec3(.97, .96, .93), inEye);
    float ir = length(fp - eye - R * vec2(-.012, -.006));
    col = mix(col, uIris, fillIn(ir - R * .056) * inEye);
    col = mix(col, ink, fillIn(ir - R * .028) * inEye);
    col = mix(col, vec3(1.), fillIn(length(hp - vec2(side * eye.x, eye.y) - R * vec2(.022, .024)) - R * .014) * inEye);
    col = mix(col, uLip, fem * fillIn((length((hp - R * vec2(0., -.60)) / R / vec2(.15, .055)) - 1.) * R * .055));
    col = mix(col, mix(col, vec3(.95, .45, .45), .35), fem * fillIn((length((fp - R * vec2(.42, -.36)) / R / vec2(.10, .055)) - 1.) * R * .05));
  }
  if (onHead) {
    // Painted hair over the hair volume: jagged fringe, shine and strands.
    float ang = atan(p.x, hz), aa = abs(ang);
    float frontness = 1. - smoothstep(.25, 1.35, aa), backness = smoothstep(1.75, 2.75, aa);
    float sides = mix(mix(.17, .47, frontness), -.8, uHead.w * smoothstep(.95, 1.45, aa));
    float hairline = mix(sides, mix(-.78, -1.25, uHead.w), backness);
    hairline -= frontness * .14 * abs(fract(ang * 2.3 + .5) - .5) * 2.;
    float hairD = hairline * R - hp.y;
    float hair = fillIn(hairD) * (onEar ? 0. : 1.);
    float shine = inkW(abs(hp.y - R * (.66 + .05 * sin(ang * 9.))), R * .035) * step(.38, fract(ang * 1.9 + .2)) * (1. - backness);
    float strands = inkW(abs(fract(ang * 1.4 + hp.y / R * .55) - .5) * R * 1.2, R * .016) * step(hairline * R + R * .12, hp.y) * step(hp.y, R * .55);
    col = mix(col, mix(mix(uHair, mix(uHair, vec3(.65, .78, 1.), .45), shine), ink, strands * .8), hair);
    lines = max(lines, inkW(abs(hairD), R * .02) * (onEar ? 0. : 1.) * step(p.y, headY + R * .9));
  }
  if (onTorso) {
    vec2 m = vec2(ax, p.y);
    if (front && fem < .5) col = mix(col, uLip * .85, fillIn(length(m - vec2(Cx * .52, chestY - 1.8)) - .55));
    if (!front) col = mix(col, skin * vec3(.75, .6, .6), fillIn(length(m - vec2(3.2, hipY + 5.)) - .4));
    // Sports top (feminine) with straps; drawn over the torso and back.
    if (fem > .5) {
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
  const lm = model.lm, H = lm.H, R = headFrame(H).r, fem = character.bodyPreset === 'feminine' ? 1 : 0;
  const def = character.proportions.muscleDefinition, muscle = Math.max(0, Math.min(1, .35 + def * 1.2 - fem * .25));
  const Sx = model.b.shoulder / 2, Cx = model.profileAt(lm.chestY).rx, Wx = model.profileAt(lm.waistY).rx, Hx = model.profileAt(lm.hipY).rx;
  const { chestY, waistY, hipY, crotchY, shoulderY, armpitY, neckBaseY: neckBase, neckTopY: neckTop } = lm;
  const Ra = model.upperR, L = lm.wristT, tR = model.thighR, K = .275 * H, ankle = .052 * H;
  const F = FRAMES, out = [];
  const bez = (frame, a, b, c, w, weight = 1) => { if (weight > .01) out.push(a[0], a[1], b[0], b[1], c[0], c[1], w, frame + Math.min(weight, 1) / 2); };
  const seg = (frame, a, b, w, weight) => bez(frame, a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, w, weight);
  const r = (x, y) => [x * R, y * R];
  // Face: lids, lashes, brows, nose, mouth, chin, cheek.
  const eye = [.29 * R, -.02 * R], ex = .125 * R, ey = (fem ? .072 : .058) * R, e = (x, y) => [eye[0] + x * ex, eye[1] + y * ey];
  bez(F.faceMirror, e(-1.05, -.1), e(0, 2.1), e(1.08, .15), R * (fem ? .03 : .022));
  bez(F.faceMirror, e(-.7, -.75), e(0, -1.35), e(.8, -.6), R * .009);
  if (fem) seg(F.faceMirror, e(.95, .25), e(1.45, 1.25), R * .02);
  else seg(F.faceMirror, r(.15, -.13), r(.27, -.16), R * .008);
  bez(F.faceMirror, r(.13, fem ? .15 : .13), r(.29, fem ? .27 : .21), r(.46, .15), R * (fem ? .026 : .045));
  seg(F.face, r(-.05, -.02), r(-.075, -.27), R * .014);
  bez(F.face, r(-.075, -.30), r(0, -.37), r(.07, -.31), R * .017);
  bez(F.faceMirror, r(.06, -.27), r(.115, -.30), r(.075, -.335), R * .011);
  bez(F.face, r(-.21, -.545), r(0, -.63), r(.21, -.545), R * .02);
  seg(F.faceMirror, r(.2, -.53), r(.235, -.565), R * .012);
  bez(F.face, r(-.08, -.70), r(0, -.725), r(.08, -.70), R * .012);
  bez(F.face, r(-.06, -.88), r(0, -.905), r(.06, -.88), R * .01, 1 - fem * .6);
  if (!fem) bez(F.faceMirror, r(.43, -.25), r(.40, -.40), r(.33, -.52), R * .012);
  bez(F.ear, r(.06, .19), r(-.24, .02), r(.05, -.21), R * .022);
  bez(F.ear, r(.02, .09), r(-.08, -.01), r(.03, -.08), R * .014);
  // Neck and chest.
  seg(F.frontMirror, [model.neckR * .9, neckTop + 2], [model.neckR * .22, neckBase - .4], fem ? .13 : .2);
  if (!fem) bez(F.front, [-.65, neckBase + 3.6], [0, neckBase + 3], [.65, neckBase + 3.6], .13);
  bez(F.frontMirror, [1.6, neckBase - 2.2], [Sx * .45, neckBase - .8], [Sx * .82, shoulderY - 1.8], .2);
  bez(F.front, [-1.2, neckBase - 1.6], [0, neckBase - 2.8], [1.2, neckBase - 1.6], .15);
  if (!fem) {
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

const SKIN = { color: '#f2bf98', shade: linear(.64, .43, .40), deep: linear(.40, .22, .23) };

export function bodyMaterial() {
  const color = c => ({ value: new THREE.Color(c) });
  const vec4 = () => ({ value: new THREE.Vector4() });
  const strokes = new THREE.DataTexture(new Float32Array(MAX_STROKES * 2 * 4), MAX_STROKES * 2, 1, THREE.RGBAFormat, THREE.FloatType);
  strokes.minFilter = strokes.magFilter = THREE.NearestFilter;
  const uniforms = {
    uHead: vec4(), uTrunkY: vec4(), uTrunkY2: vec4(), uTrunkX: vec4(), uArm: vec4(), uLeg: vec4(),
    uStyle: { value: new THREE.Vector3(0, .15, 172) },
    uHair: color('#3a2418'), uIris: color('#3f7fb5'), uLip: color('#d9786f'),
    uBrief: color('#2f4b8f'), uBriefTrim: color('#f1d24a'),
    uShoe: color('#f5f2ea'), uShoeAccent: color('#e0443e'), uSole: color('#c9c3b5'),
    uStrokes: { value: strokes }, uStrokeCount: { value: 0 },
  };
  return comicPatch(new THREE.MeshLambertMaterial({ color: SKIN.color }), {
    key: 'comic-body-v3', shade: SKIN.shade, deep: SKIN.deep, lit: .45, warm: 1, rimLight: .6, occlusion: 'vAO', dots: .45, uniforms,
    vertexHeader: 'attribute vec3 basePosition;\nattribute float ao;\nvarying vec3 vBase;\nvarying float vAO;\n',
    vertexBody: 'vBase = basePosition;\nvAO = ao;',
    fragmentHeader: 'varying float vAO;\n' + BODY_ART,
    artBody: 'diffuseColor.rgb = bodyArt(diffuseColor.rgb, comicInk);',
  });
}

// Landmarks are in the measured body's centimetres (before presentation).
export function updateBodyArt(material, model, character) {
  const u = material.userData.uniforms, lm = model.lm, H = lm.H, head = headFrame(H);
  const feminine = character.bodyPreset === 'feminine';
  u.uHead.value.set(head.y, head.r, head.z, feminine ? 1 : 0);
  u.uTrunkY.value.set(lm.neckTopY, lm.neckBaseY, lm.shoulderY, lm.chestY);
  u.uTrunkY2.value.set(lm.armpitY, lm.waistY, lm.hipY, lm.crotchY);
  u.uTrunkX.value.set(model.b.shoulder / 2, model.profileAt(lm.chestY).rx, model.profileAt(lm.waistY).rx, model.profileAt(lm.hipY).rx);
  u.uArm.value.set(model.jointR.x, model.jointR.y, lm.armAngle, lm.wristT);
  u.uLeg.value.set(lm.legX, model.thighR, model.upperR, model.neckR);
  u.uStyle.value.set(feminine ? 1 : 0, character.proportions.muscleDefinition, H);
  const strokes = bodyStrokes(model, character), texture = u.uStrokes.value;
  texture.image.data.fill(0);
  texture.image.data.set(strokes.slice(0, MAX_STROKES * 8));
  texture.needsUpdate = true;
  u.uStrokeCount.value = Math.min(strokes.length / 8, MAX_STROKES);
}

export function bodyOutlineMaterial() {
  return outlineMaterial(.0026);
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

import { ItemArt } from './artwork.js';
import { environmentFragment,atlasFragment } from './paintedArt.js';
import { ARTIFACT_ART } from './artManifest.js';
import { PALETTES,effectFor } from './effects.js';

function EnergyInk(effect) {
 const strong=['tall','void','celestial'].includes(effect.silhouette),voided=effect.silhouette==='void';
 return `<g class="aura-ink" opacity="${strong ? 0.5 : 0.25}"><path d="M129 396Q45 323 111 211c-7 69 29 58 10 113q-16 38 8 72Zm147-20q65-111 20-200 3 77-30 98 20 36 10 102Z" fill="${voided?'#111426':effect.primary}"/><path d="M114 367q-29-73 18-148m146 125q34-67 11-129" fill="none" stroke="${effect.secondary}" stroke-width="1.1"/>${strong?`<path d="M88 300q-28-37 7-99-5 35 17 43m198 99q45-45 13-122 5 47-19 55M145 167q-24-31 12-68-9 43 4 44m82-9q29-53-1-77 6 36-11 53" fill="none" stroke="${effect.primary}" stroke-width="2"/><path class="energy-scar" d="m74 377 20-62-8-17 24-39m218 103-12-48 9-18-18-46m-161-84 20-40-3-16 16-25" stroke="${effect.secondary}" stroke-width="1.2" fill="none"/>`:''}</g>`;
}

export function BackgroundLayer(item,theme,id) { return `<g data-layer="background"><rect width="400" height="520" fill="url(#${id}-sky)"/>${item?environmentFragment(theme,400,520,'class="painted-scene-background"'):''}<rect width="400" height="520" fill="#071321" opacity=".22"/><ellipse cx="200" cy="444" rx="130" ry="20" fill="#071321" opacity=".4"/></g>`; }
export function AuraLayer(item,theme,id) {
 const effect=effectFor(item?.visualEffectId,theme);if(!effect)return '';
 let silhouette=`<path d="M200 122C143 157 139 207 138 269c-13 54 4 103 62 129 56-21 75-78 60-129-1-66-9-111-60-147Z"/>`;
 if(effect.silhouette==='orb')silhouette='<circle cx="200" cy="253" r="87"/>';
 if(effect.silhouette==='lotus')silhouette='<path d="M200 358C39 315 31 166 159 244 99 95 296 92 242 243c124-78 116 74-42 115Z"/>';
 if(effect.silhouette==='tall'||effect.silhouette==='celestial')silhouette='<path d="M200 43C167 122 107 94 127 180 84 153 62 232 101 281c-42 62 7 115 45 109 2 33 32 46 54 52 22-6 52-19 54-52 38 6 87-47 45-109 39-49 17-128-26-101 20-86-40-58-73-137Z"/>';
 if(effect.silhouette==='void')silhouette='<path d="M200 54c-11 83-85 38-68 132-48-31-63 17-32 57-50-12-43 46 4 64-31 32-6 59 25 46-15 47 33 70 71 60 38 10 86-13 71-60 31 13 56-14 25-46 47-18 54-76 4-64 31-40 16-88-32-57 17-94-57-49-68-132Z"/>';
 return `<g data-layer="rear-aura" class="aura-layer" style="--aura-primary:${effect.primary};--aura-secondary:${effect.secondary};--aura-speed:${effect.speed}s"><g class="aura-glow" fill="${effect.primary}" opacity="${effect.glow}" filter="url(#${id}-soft)">${silhouette}</g><g class="aura-outline" fill="${effect.secondary}" fill-opacity=".06" stroke="${effect.primary}" stroke-opacity=".45" stroke-width="1.2">${silhouette}</g>${EnergyInk(effect)}${Array.from({length:effect.ribbonCount},(_,i)=>`<path class="spirit-ribbon ribbon-${i}" d="M${93-i*12} ${180+i*52}C330 ${80+i*55} 354 ${350-i*10} 90 ${355+i*21}S292 ${440+i*7} 321 ${202+i*20}" fill="none" stroke="${i%2?effect.secondary:effect.primary}" stroke-width="${i%2?1:2}" opacity=".5"/>`).join('')}${effect.silhouette==='void'?'<ellipse cx="200" cy="280" rx="44" ry="112" fill="#17152c" opacity=".35"/>':''}</g>`;
}
export function FormationLayer(item,aura,theme) {
 const p=PALETTES[theme],effect=effectFor(aura?.visualEffectId,theme),style=item?.visualEffectId||effect?.groundRing;
 if(!item&&(!effect||effect.groundRing==='none'))return '';
 const detailed=style==='loom-rings'||style==='celestial'||effect?.groundRing==='celestial',radius=detailed?137:112;
 return `<g data-layer="formation" class="formation-layer" transform="translate(200 427) scale(1 .29)"><g class="formation-spin"><circle r="${radius}" fill="${p.primary}" fill-opacity=".04" stroke="${p.secondary}" stroke-width="2"/><circle r="${radius-12}" fill="none" stroke="${p.primary}" stroke-width="1.2" stroke-dasharray="5 9"/>${Array.from({length:detailed?16:8},(_,i)=>`<path d="m0-${radius-5} 3 6-3 5-3-5Z" fill="${p.secondary}" transform="rotate(${i*(detailed?22.5:45)})"/>`).join('')}</g><g class="formation-counter"><circle r="${radius-28}" fill="none" stroke="${p.secondary}" stroke-width="1.5"/><path d="M-55 0H55M0-55v110m-39-39 78 78m-78 0 78-78" stroke="${p.primary}" stroke-width="1"/>${detailed?'<circle r="70" fill="none" stroke="#ffedbc" stroke-dasharray="2 12"/>':''}</g></g>`;
}
export function HandheldLayer(item,theme) {
 if(!item)return '';
 return `<g data-layer="handheld" class="handheld-artifact" data-effect="${item.visualEffectId}" transform="translate(246 218) rotate(18 38 50) scale(.72)"><g class="held-equipment-float">${ItemArt(item,120)}</g></g>`;
}
export function OrnamentLayer(item,theme) {
 if(!item)return '';
 return `<g data-layer="hair-ornament" transform="${item.previewAsset==='crown'?'translate(163 22) scale(.62)':'translate(204 48) scale(.37)'}">${ItemArt(item,120)}</g>`;
}
export function OrbitLayer(item,theme,intensity) {
 if(!item)return '';
 const count=intensity==='low'?3:7;
 return `<g data-layer="orbiting-artifacts" class="orbit-layer" transform="translate(200 268) scale(1 .67)"><ellipse rx="137" ry="137" fill="none" stroke="${PALETTES[theme].primary}" stroke-opacity=".15" stroke-dasharray="2 9"/><g class="needle-orbit">${Array.from({length:count},(_,i)=>{const angle=i*2*Math.PI/count;return `<g transform="translate(${Math.cos(angle)*137} ${Math.sin(angle)*137}) rotate(${i*360/count+30})"><g transform="translate(-13 -28)">${atlasFragment(ARTIFACT_ART,0,26,56)}</g></g>`;}).join('')}</g></g>`;
}
export function ParticleLayer(aura,theme,intensity) {
 const effect=effectFor(aura?.visualEffectId,theme);if(intensity==='off'||!effect)return '';
 const count=intensity==='low'?Math.min(3,effect.particleCount):Math.min(18,effect.particleCount);
 return `<g data-layer="foreground-particles" class="character-particles" fill="${effect.primary}">${Array.from({length:count},(_,i)=>`<g class="chi-particle" style="--drift:${(i%3-1)*18}px;--particle-time:${effect.speed+i%4}s;--particle-delay:${-i*1.6}s" transform="translate(${58+i*67%285} ${145+i*53%285})">${effect.particleType==='petal'?'<path d="M0 0q-8-12 2-10 9 4-2 10Z"/>':effect.particleType==='thread'?'<path d="M0 0q-7-8 0-16" fill="none" stroke="currentColor" stroke-width="1.2"/>':effect.particleType==='square'?'<rect x="-2" y="-2" width="4" height="4"/>':'<circle r="1.8"/>'}</g>`).join('')}</g>`;
}

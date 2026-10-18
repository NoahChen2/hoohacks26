// Original fashion illustrations created for this repository. Regenerate: node scripts/generate-explore-assets.mjs
import {writeFileSync,mkdirSync} from 'node:fs';
import {projects,ILLUSTRATION_PALETTES as palettes} from '../src/explore/projects.js';
mkdirSync('public/explore',{recursive:true});
const bodies={
  denim:'M111 100 Q160 118 209 100 L213 236 Q160 259 106 236 Z',
  jeans:'M100 63 L220 63 L233 153 L215 345 L167 345 L160 183 L151 345 L102 345 L87 153 Z',
  trousers:'M100 63 L220 63 L226 345 L165 345 L159 178 L151 345 L91 345 Z',
  skirt:'M109 108 L211 108 L249 294 Q160 313 72 294 Z',
  cami:'M105 77 L124 73 L127 113 Q160 132 193 113 L196 73 L215 77 L219 276 Q160 288 101 276 Z',
  halter:'M142 80 L178 80 L185 118 L221 243 Q160 277 100 243 L136 118 Z',
  bag:'M89 151 Q160 133 231 151 L239 279 Q160 311 80 279 Z M118 151 C101 45 221 45 204 151 L189 151 C201 70 119 70 133 151 Z',
  vest:'M111 77 L139 69 L160 112 L181 69 L209 77 Q199 139 227 157 L215 290 L161 279 L105 290 L94 157 Q123 136 111 77 Z',
  dress:'M118 74 L141 72 Q160 91 179 72 L202 74 L224 136 L200 155 L194 135 L190 179 L239 326 Q160 347 80 326 L130 179 L125 135 L119 155 L96 136 Z',
  apron:'M124 94 L196 94 L203 158 L233 179 L233 313 L87 313 L87 179 L117 158 Z',
};
const shirt='M105 83 L139 72 Q160 96 181 72 L215 83 L257 139 L221 167 L208 148 L214 289 Q160 299 106 289 L112 148 L99 167 L63 139 Z';
for(const [index,p] of projects.entries()){
  const [bg,cloth,trim]=palettes[index%palettes.length],h=p.height;
  const kind=p.kind;const d=bodies[kind]||shirt;
  const long=['shirt','wrap','jacket','cardigan','hoodie'].includes(kind);
  const sleeve=long?`<path d="M107 94 L75 120 L50 252 L86 263 L111 156 M213 94 L245 120 L270 252 L234 263 L209 156" fill="${cloth}" stroke="#29261e" stroke-opacity=".32" stroke-width="2"/>`:'';
  const denim=['denim','jeans','trousers'].includes(kind);
  const pockets=denim?'<path d="M105 83 Q111 124 141 123 M215 83 Q209 124 179 123 M158 68 L158 155 M100 76 L221 76 M115 178 L110 329 M206 178 L208 329"/>':kind==='bag'?'<path d="M111 182 L211 182 L211 250 Q160 268 111 250 Z M120 193 L202 193"/>':kind==='vest'?'<path d="M160 113 L160 279 M113 204 L145 204 M176 204 L207 204"/>':'<path d="M114 282 Q160 292 207 282 M124 103 Q141 128 136 179 M191 109 Q177 154 188 190 M124 244 Q152 228 170 246"/>';
  const flowers=p.aesthetic==='Cottagecore'?Array.from({length:24},(_,i)=>`<g transform="translate(${114+(i*31)%92} ${140+(i*37)%120})"><path d="M0 0 q7 -10 10 0 q-3 8 -10 0 q-8 6 -7 -2 q2 -7 7 2" fill="${trim}"/><circle r="1.7" fill="#8e7151"/></g>`).join(''):'';
  const patches=['denim','bag','hoodie','jacket'].includes(kind)?`<path d="M111 185 L153 176 L157 230 L116 236 Z" fill="${trim}" opacity=".7"/><path d="M118 191 L147 185 L151 224 L123 230 Z" fill="none" stroke="${cloth}" stroke-dasharray="3 3"/>`:'';
  const corset=kind==='denim'?'<path d="M111 100 Q160 118 209 100 L213 236 Q160 259 106 236 Z" fill="url(#fabric)" stroke="#494c50"/><path d="M158 113 L158 244 M129 111 L125 244 M186 111 L193 242" fill="none" stroke="#e9dac0" stroke-dasharray="4 3"/><path d="M153 127 L171 140 L153 153 L171 166 L153 179 L171 192 L153 205 L171 218" fill="none" stroke="#d6c09e" stroke-width="3"/>':'';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${h}" role="img" aria-label="Original illustration of ${p.color.toLowerCase()} ${kind}"><defs><pattern id="fabric" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${cloth}"/><path d="M0 0L5 5M-2 3L2 7" stroke="#fff" stroke-opacity=".09" stroke-width=".6"/></pattern><filter id="shadow" x="-40%" y="-30%" width="180%" height="170%"><feDropShadow dx="5" dy="12" stdDeviation="7" flood-color="#362c20" flood-opacity=".16"/></filter></defs><rect width="400" height="${h}" fill="${bg}"/><path d="M0 ${h*.7} Q200 ${h*.55} 400 ${h*.79} L400 ${h} L0 ${h}" fill="#fff" opacity=".14"/><g transform="translate(40 ${(h-360)/2}) rotate(${index%2?5:-5} 160 180)" filter="url(#shadow)">${sleeve}<path d="${d}" fill="url(#fabric)" stroke="#29261e" stroke-opacity=".3" stroke-width="2"/>${patches}${flowers}${corset}<g fill="none" stroke="${trim}" stroke-width="1.8" opacity=".8" stroke-linecap="round">${pockets}</g>${long?'<path d="M160 103 L160 284" stroke="#544c43" opacity=".35"/>'+[130,160,190,220,250].map(y=>`<circle cx="167" cy="${y}" r="2.4" fill="${trim}"/>`).join(''):''}</g><path d="M352 25 l0 27 m-13 -14 l26 0" stroke="#fffdf5" stroke-width="1.5" opacity=".7"/></svg>`;
  writeFileSync(`public/explore/${p.id}.svg`,svg);
}
for(let i=0;i<8;i++){
  const bg=palettes[i][0],skin=['#c98b66','#e5b995','#8b593e','#b77652'][i%4];
  writeFileSync(`public/explore/creator-${i}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bg}"/><path d="M7 64 Q8 43 32 43 Q57 43 57 64" fill="${palettes[i][1]}"/><path d="M15 30 Q12 7 32 8 Q54 7 50 34 L46 48 L17 48Z" fill="#3f302a"/><ellipse cx="32" cy="29" rx="13" ry="17" fill="${skin}"/><path d="M18 23 Q20 5 35 11 Q47 12 47 25 Q33 23 29 16 Q23 25 18 23" fill="#3f302a"/><path d="M25 30h2m10 0h2M29 39q3 2 6 0" stroke="#443228" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>`);
}

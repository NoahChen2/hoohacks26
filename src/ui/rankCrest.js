import { WORLDS } from '../progression.js';
import { RANK_MOTIFS } from './worldPresentation.js';
let crestSequence = 0;
export const escapeHtml = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Original inline SVG crest. @param {{tier:number,theme:string,size?:number,label?:string}} props */
export function RankCrest({tier=0,theme='cultivation',size=88,label}={}) {
 const t=Math.max(0,Math.min(7,Math.trunc(tier))); const w=WORLDS[theme]||WORLDS.cultivation;
 const metal=['#a19077','#b67743','#b0c6d3','#d5a638','#60b895','#eed18a','#b1bcec','#efcf80'][t];
 const id=`crest-${++crestSequence}`;
 const frame={cultivation:'M60 12 94 28 92 71Q88 91 60 105 32 91 28 71L26 28Z',garden:'M60 12C74 21 93 21 97 40S90 88 60 105C30 88 19 60 23 40S46 21 60 12Z',fantasy:'M60 10 98 31 91 78 60 106 29 78 22 31Z',runway:'M60 9 97 40 84 86 60 106 36 86 23 40Z',cyber:'M41 13h38l19 19v48l-19 21H41L22 80V32Z'}[theme]||'M60 12 96 32 90 80 60 105 30 80 24 32Z';
 const engraving={cultivation:'M35 36q8-10 16 0m18 0q8-10 16 0M34 77q10-5 15 5m22 0q5-10 15-5',garden:'M34 72q-13-18 2-33m-2 23-8-8m9-3 8-8M86 72q13-18-2-33m2 23 8-8m-9-3-8-8',fantasy:'m36 36 4 7-4 7-4-7Zm48 0 4 7-4 7-4-7ZM37 76l5 6-5 6m46-12-5 6 5 6',runway:'M34 38v31m4-28v26M86 38v31m-4-28v26M43 88l17 8 17-8',cyber:'M31 38h6v13h-6m58-13h-6v13h6M33 70v10h10m44-10v10H77M48 23h24'}[theme]||'';
 const motif=(RANK_MOTIFS[theme]||RANK_MOTIFS.cultivation)[t];
 const rays=Array.from({length:16},(_,i)=>`<path d="M60 18v${i%2?3:5}" transform="rotate(${i*22.5} 60 60)"/>`).join('');
 return `<svg class="rank-crest crest-tier-${t}" data-crest-world="${escapeHtml(theme)}" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(label||`${w.ranks[t]}, tier ${t+1}`)}"><title>${escapeHtml(w.ranks[t])}</title>
 <defs><linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1cf"/><stop offset=".28" stop-color="${metal}"/><stop offset=".5" stop-color="#fff8e6"/><stop offset=".65" stop-color="${metal}"/><stop offset="1" stop-color="#66513c"/></linearGradient><radialGradient id="${id}-enamel" cx="35%" cy="25%" r="80%"><stop stop-color="${w.color}"/><stop offset="1" stop-color="#14252d"/></radialGradient><linearGradient id="${id}-gem" x2="1" y2="1"><stop stop-color="#edfff7"/><stop offset=".5" stop-color="${w.color}"/><stop offset="1" stop-color="#172c37"/></linearGradient></defs>
 ${t>=4?`<g fill="url(#${id}-metal)" stroke="${metal}" stroke-width=".6"><path d="M31 39 12 25 18 51 9 47 20 72 17 83 36 92 26 72Z"/><path d="M89 39 108 25 102 51 111 47 100 72 103 83 84 92 94 72Z"/><path d="m16 32 10 28m-11-8 12 21m77-41L94 60m11-8L93 73" fill="none" stroke="#fff7dc"/></g>`:''}
 ${t>=6?`<g class="crest-celestial" fill="none" stroke="${metal}" stroke-width=".6"><circle cx="60" cy="59" r="53" stroke-dasharray="1 5"/><path d="m60 1 3 6-3 6-3-6ZM7 55l4 4-4 4-4-4Zm106 0 4 4-4 4-4-4Z" fill="${metal}"/></g>`:''}
 ${t>=1?`<path d="${frame}" fill="url(#${id}-metal)" stroke="#584932" stroke-width=".7"/><path d="${frame}" transform="translate(7.2 7.2) scale(.88)" fill="url(#${id}-enamel)" stroke="#fff0cf" stroke-width=".8"/>`:`<circle cx="60" cy="59" r="39" fill="url(#${id}-enamel)" stroke="url(#${id}-metal)" stroke-width="2"/>`}
 <circle cx="60" cy="59" r="${t?32:34}" fill="none" stroke="${metal}" stroke-width=".65" opacity=".75"/>
 <g class="crest-engraving" stroke="${metal}" stroke-width=".8" fill="none" opacity=".9">${t>=1?`<path d="${engraving}"/>`:''}${t>=2?rays:''}</g>
 <g transform="translate(10.8 10.8) scale(.82)"><g fill="none" stroke="#081d23" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 1.2)">${motif}</g><g class="crest-symbol" fill="none" stroke="url(#${id}-metal)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${motif}</g></g>
 ${t>=3?`<g fill="url(#${id}-gem)" stroke="#fff4cf" stroke-width=".6"><path d="m60 17 4 6-4 6-4-6Zm0 72 4 6-4 6-4-6Z"/>${t>=5?'<path d="m27 54 4 6-4 6-4-6Zm66 0 4 6-4 6-4-6Z"/>':''}</g>`:''}
 ${t===7?`<path d="m38 19-2-14 15 9 9-12 9 12 15-9-2 14-22 7Z" fill="url(#${id}-metal)" stroke="#fff6d5" stroke-width=".6"/><path d="m60 7 3 7-3 5-3-5Z" fill="url(#${id}-gem)"/>`:''}
 <path d="M45 100h30l-4 10H49Z" fill="url(#${id}-metal)" stroke="#776144" stroke-width=".5"/><text x="60" y="107.5" text-anchor="middle" font-family="Georgia,serif" font-size="7" font-weight="bold" fill="#293631">${['I','II','III','IV','V','VI','VII','VIII'][t]}</text></svg>`;
}
export function communityEmblem(s,size=48) {
 const id=`school-${++crestSequence}`;
 return `<svg class="community-emblem" width="${size}" height="${size}" viewBox="0 0 64 64" role="img" aria-label="${escapeHtml(s.name)} community emblem"><defs><linearGradient id="${id}" x2="1" y2="1"><stop stop-color="#fff1cc"/><stop offset=".5" stop-color="#c6a268"/><stop offset="1" stop-color="#7f633c"/></linearGradient></defs><path d="M32 2 58 16 54 46 32 62 10 46 6 16Z" fill="url(#${id})"/><path d="M32 7 53 19 50 43 32 57 14 43 11 19Z" fill="var(--world-color,#27786e)" stroke="#fff5df" stroke-width=".65"/><g stroke="#f4e2b9" fill="none" stroke-width="1" stroke-linejoin="round"><path d="M18 43h28M20 41V28h24v13M18 28h28L32 19ZM25 31v10m7-10v10m7-10v10M18 45h28M15 39q-6-11 1-17m-1 11-4-4m4 9-4-3m38 4q6-11-1-17m1 11 4-4m-4 9 4-3"/><path d="M23 49q5-3 9 0 4-3 9 0v4q-5-3-9 0-4-3-9 0Zm9 0v4"/></g><circle cx="32" cy="25" r="1.5" fill="#f4e2b9"/>${s.type==='university'?'<path d="M27 19a5 5 0 0 1 10 0" fill="none" stroke="#f4e2b9"/>':''}</svg>`;
}

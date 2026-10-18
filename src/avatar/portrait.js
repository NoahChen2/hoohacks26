import { CHARACTER_ART } from './artManifest.js';
import { PALETTES } from './effects.js';
import { equippedItems } from './inventory.js';
import { escapeHtml as esc } from '../ui/rankCrest.js';
export function CharacterPortrait(progress,{size=42,name=progress.avatar?.displayName||'You',current=true}={}) {
 const theme=progress.theme,p=PALETTES[theme],items=current?equippedItems(progress):{},advanced=items.frame?.requiredTier>=5,art=CHARACTER_ART[theme],cw=art.width/3,ch=art.height/2,row=items.robe?.requiredTier>=5?1:0;
 return `<svg class="character-portrait" width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="${esc(name)} static character portrait${items.frame?', '+esc(items.frame.name):''}"><rect x="1" y="1" width="46" height="46" rx="14" fill="${p.ink}" stroke="${advanced?p.secondary:p.primary}" stroke-width="${advanced?2:1}"/><svg x="4" y="4" width="40" height="40" viewBox="${cw*.27} ${row*ch} ${cw*.48} ${ch*.31}" preserveAspectRatio="xMidYMid slice" overflow="hidden"><image href="${art.src}" width="${art.width}" height="${art.height}"/></svg></svg>`;
}

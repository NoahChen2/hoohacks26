import { PaintedCharacter } from './paintedArt.js';
import './avatar.css';
import { WORLDS,tierFor } from '../progression.js';
import { equippedItems } from './inventory.js';
import { PALETTES } from './effects.js';
import { RankCrest,escapeHtml as esc } from '../ui/rankCrest.js';
import { BackgroundLayer,AuraLayer,FormationLayer,OrnamentLayer,HandheldLayer,OrbitLayer,ParticleLayer } from './layers.js';
export { observeCharacterScenes,disposeCharacterScenes } from './lifecycle.js';
let sequence=0;
/** A single layered renderer for every world. Preview overrides never mutate equipment. */
export function CharacterScene(progress,{previewItem=null,staticScene=false,compact=false,showCrest=true}={}) {
 const theme=progress.theme,p=PALETTES[theme],avatar=progress.avatar,items={...equippedItems(progress)};
 if(previewItem?.themeId===theme)items[previewItem.slot]=previewItem;
 const id=`character-${++sequence}`,color=/^#[0-9a-f]{6}$/i.test(avatar.outfitColors[theme])?avatar.outfitColors[theme]:p.robe;
 const intensity=avatar.intensity,paused=avatar.paused||staticScene;
 const title=items.title?.name||WORLDS[theme].ranks[tierFor(progress.xp)],name=avatar.displayName||'You';
 return `<figure class="character-scene ${compact?'character-compact':''} ${items.frame?.requiredTier>=5?'frame-advanced':''}" data-world="${theme}" data-effects="${intensity}" data-paused="${paused}" data-static="${staticScene}" data-running="false" data-art-ready="false" data-emote="neutral" role="button" tabindex="${staticScene?'-1':'0'}" aria-label="${esc(name)} character. Activate to greet." style="--character-primary:${p.primary};--character-secondary:${p.secondary};--character-ink:${p.ink}">
 <svg class="character-art" viewBox="0 0 400 520" role="img" aria-label="${esc(`${name}, wearing ${items.robe?.name||'a simple underlayer'}, holding ${items.main?.name||'no artifact'}, with ${items.aura?.name||'no aura'}. ${previewItem?'Preview only.':''}`)}"><title>${esc(name)} · ${esc(title)}</title><defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="${p.ink}"/><stop offset="1" stop-color="#0e242d"/></linearGradient><linearGradient id="${id}-cloth"><stop stop-color="${p.robe}"/><stop offset="1" stop-color="${p.ink}"/></linearGradient><linearGradient id="${id}-skin"><stop stop-color="#f4dfca"/><stop offset=".55" stop-color="#e8cbb4"/><stop offset="1" stop-color="#aa9396"/></linearGradient><linearGradient id="${id}-ivory"><stop stop-color="#f1ead6"/><stop offset="1" stop-color="#c7c8b4"/></linearGradient><filter id="${id}-soft" x="-35%" y="-25%" width="170%" height="150%"><feGaussianBlur stdDeviation="13"/></filter></defs>
 ${BackgroundLayer(items.background,theme,id)}${AuraLayer(items.aura,theme,id)}${FormationLayer(items.formation,items.aura,theme)}
 <g class="character-float">${PaintedCharacter(progress,items)}${OrnamentLayer(items.hair,theme)}${HandheldLayer(items.main,theme)}</g>
 ${OrbitLayer(items.orbit,theme,intensity)}${ParticleLayer(items.aura,theme,intensity)}<g class="focus-thread-sigil" fill="none" stroke="${p.primary}" stroke-width="1.3"><ellipse cx="200" cy="426" rx="118" ry="23"/><ellipse cx="200" cy="426" rx="98" ry="17" stroke-dasharray="4 10"/><path d="M95 418q-25-70 25-117M305 418q25-70-25-117"/></g>
 ${items.frame?`<g class="scene-profile-frame" fill="none" stroke="${p.secondary}" stroke-width="${items.frame.requiredTier>=5?1.8:.8}" opacity=".55"><path d="M25 74V28h48m254 0h48v46M25 438v46h48m254 0h48v-46"/>${items.frame.requiredTier>=5?'<path d="m200 15 5 8-5 8-5-8Zm0 474 5 8-5 8-5-8Z"/>':''}</g>`:''}</svg>
 ${showCrest?`<div class="character-rank" data-layer="rank-crest">${RankCrest({tier:tierFor(progress.xp),theme,size:64})}</div>`:''}<span class="scene-imprint" aria-hidden="true">RETHREAD / THE ARTISAN’S PATH</span>
 <span class="art-load-label" role="status">Unfolding your look…</span><span class="character-reaction" role="status" hidden></span><figcaption data-layer="display-name-title"><strong>${esc(name)}</strong><span>${esc(title)}</span>${previewItem?'<small>Preview only · your loadout is unchanged</small>':''}</figcaption></figure>`;
}

import { CharacterScene,observeCharacterScenes,disposeCharacterScenes } from './CharacterScene.js';
import { ITEM_BY_ID } from './items.js';
import { equipItem } from './inventory.js';
import { WORLDS } from '../progression.js';
import { escapeHtml as esc } from '../ui/rankCrest.js';
import { emit } from '../state.js';
import { playCharacterEmote } from './interactionEffects.js';

// Called only with the result of a newly earned reward; no pending ceremony is persisted.
export function showBreakthrough(progress,result) {
 if(!result.rankUp||!result.unlockedItemIds.length)return;
 document.querySelector('.breakthrough-dialog')?.close();
 const items=result.unlockedItemIds.map(id=>ITEM_BY_ID[id]).filter(item=>item?.themeId===progress.theme),highest=items.at(-1);
 if(!highest)return;
 const dialog=document.createElement('dialog'),previous=document.activeElement;
 dialog.className='avatar-modal breakthrough-dialog';dialog.dataset.world=progress.theme;dialog.setAttribute('aria-labelledby','breakthrough-title');
 dialog.dataset.effects=progress.avatar.intensity;dialog.dataset.paused=String(progress.avatar.paused);
 dialog.innerHTML=`<header class="avatar-modal-header"><div><span class="breakthrough-kicker">A thread becomes a legacy</span><h2 id="breakthrough-title">${esc(WORLDS[progress.theme].ranks[result.tier])}</h2><p>Breakthrough · tier ${result.tier+1} · all rewards already granted free</p></div><button class="btn small ghost" data-continue aria-label="Skip breakthrough ceremony">Skip</button></header><div class="avatar-modal-body"><div class="breakthrough-scene">${CharacterScene(progress,{previewItem:highest})}</div><div class="preview-details"><h3>Your new milestone cosmetics</h3><ul>${items.map(item=>`<li>${esc(item.name)}</li>`).join('')}</ul><p>Matching gifts are also waiting in your other worlds. No currency spent.</p><div class="breakthrough-actions"><button class="btn" data-equip-reward>Equip Reward</button><button class="btn ghost" data-continue>Continue</button></div><p role="status" class="breakthrough-status"></p></div></div>`;
 document.body.append(dialog);
 const scene=dialog.querySelector('.breakthrough-scene');
 scene.insertAdjacentHTML('beforeend',`<div class="ceremony-thread-gather" aria-hidden="true">${Array.from({length:6},(_,i)=>`<span style="--thread-x:${(i%2?1:-1)*(65+i*9)}px;--thread-y:${(i-3)*30}px;--thread-angle:${i*35}deg"></span>`).join('')}</div>`);
 dialog.querySelectorAll('[data-continue]').forEach(b=>b.onclick=()=>dialog.close());
 dialog.querySelector('[data-equip-reward]').onclick=()=>{const outcome=equipItem(progress,highest.id,highest.slot);dialog.querySelector('.breakthrough-status').textContent=outcome.message;if(outcome.ok){emit('avatar');const holder=dialog.querySelector('.breakthrough-scene');disposeCharacterScenes(holder);holder.innerHTML=CharacterScene(progress);observeCharacterScenes(holder);dialog.querySelector('[data-equip-reward]').disabled=true;}};
 dialog.addEventListener('close',()=>{disposeCharacterScenes(dialog);dialog.remove();if(previous?.isConnected&&!previous.disabled)previous.focus();else document.querySelector('#sh-close')?.focus();},{once:true});
 dialog.showModal();observeCharacterScenes(dialog);playCharacterEmote(dialog.querySelector('.character-scene'),'celebrate');
}

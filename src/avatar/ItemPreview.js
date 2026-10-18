import { CharacterScene,observeCharacterScenes,disposeCharacterScenes } from './CharacterScene.js';
import { ItemArt } from './artwork.js';
import { SLOTS } from './items.js';
import { WORLDS } from '../progression.js';
import { escapeHtml as esc } from '../ui/rankCrest.js';

export function showItemPreview(progress,item) {
 const dialog=document.createElement('dialog');dialog.className='avatar-modal item-preview-dialog';dialog.dataset.world=item.themeId;dialog.setAttribute('aria-labelledby','item-preview-title');
 const themed={...progress,theme:item.themeId};
 dialog.innerHTML=`<header class="avatar-modal-header"><div><h2 id="item-preview-title">${esc(item.name)}</h2><p>Zoomed preview · ${esc(WORLDS[item.themeId].name)} · equipment stays unchanged</p></div><button class="btn small ghost" data-dismiss aria-label="Close item preview">Close</button></header><div class="avatar-modal-body">${CharacterScene(themed,{previewItem:item})}<div class="preview-details">${ItemArt(item,220)}<p>${esc(item.description)}</p><div class="item-tags"><span>${item.rarity}</span><span>${SLOTS[item.slot]}</span><span>Tier ${item.requiredTier+1}</span></div><p>${item.acquisitionMethod==='shop'?`${item.currencyCost} ${WORLDS[item.themeId].currency}`:item.acquisitionMethod==='milestone'?'Free rank milestone · automatically granted':'Free starter item'}</p><p>Cosmetic only. No XP bonuses or competitive advantages.</p>${item.themeId!==progress.theme?`<p>Requires the ${WORLDS[item.themeId].name} world. Your ownership is retained.</p>`:''}</div></div>`;
 document.body.append(dialog);
 const previous=document.activeElement;
 dialog.addEventListener('close',()=>{disposeCharacterScenes(dialog);dialog.remove();previous?.focus();},{once:true});
 dialog.querySelector('[data-dismiss]').onclick=()=>dialog.close();
 dialog.showModal();observeCharacterScenes(dialog);
}

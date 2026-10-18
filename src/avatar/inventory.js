import { ITEMS, ITEM_BY_ID, SLOTS, THEME_IDS, MILESTONES, starterLoadout } from './items.js';
import { tierFor } from '../ranks.js';
/** @typedef {{version:number,ownedItemIds:string[],claimedMilestoneIds:string[],loadouts:Record<string,Record<string,string>>,intensity:'off'|'low'|'full',paused:boolean,outfitColors:Record<string,string>,displayName:string}} AvatarState */
const idsFrom=value=>Array.isArray(value)?value.map(x=>typeof x==='string'?x:x?.id).filter(x=>typeof x==='string'):[];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
export function grantMilestones(avatar,tier) {
 const newlyGranted=[];
 for(const milestone of MILESTONES.filter(m=>m.tier<=tier)) {
  if(!avatar.claimedMilestoneIds.includes(milestone.id)) {avatar.claimedMilestoneIds.push(milestone.id);newlyGranted.push(...milestone.itemIds);}
  // Repair a partial save without spending currency or duplicating inventory.
  avatar.ownedItemIds=[...new Set([...avatar.ownedItemIds,...milestone.itemIds])];
 }
 return newlyGranted;
}
/** Safely retains unknown legacy IDs and fields; no earned progression is removed. */
export function migrateAvatar(data={},tier=0,legacyInventory=[]) {
 const old=object(data), owned=[...idsFrom(old.ownedItemIds),...idsFrom(old.ownedItems),...idsFrom(old.inventory),...idsFrom(legacyInventory)];
 const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const avatar={...old,version:1,ownedItemIds:[...new Set([...owned,...ITEMS.filter(i=>i.acquisitionMethod==='starter').map(i=>i.id)])],claimedMilestoneIds:[...new Set(idsFrom(old.claimedMilestoneIds))],loadouts:{...object(old.loadouts||old.equippedByWorld)},intensity:['off','low','full'].includes(old.intensity)?old.intensity:reduced?'low':'full',paused:!!old.paused,outfitColors:{...object(old.outfitColors)},displayName:typeof old.displayName==='string'?old.displayName.slice(0,24):'You'};
 for(const theme of THEME_IDS) avatar.loadouts[theme]={...starterLoadout(theme),...object(avatar.loadouts[theme])};
 // Legacy single-world equipment remains owned and is kept in its original theme.
 if(old.equipped&&typeof old.equipped==='object') for(const [slot,id] of Object.entries(old.equipped)) {const item=ITEM_BY_ID[id];if(item&&slot in SLOTS){avatar.loadouts[item.themeId][slot]=id;avatar.ownedItemIds.push(id);}}
 avatar.ownedItemIds=[...new Set(avatar.ownedItemIds)];
 grantMilestones(avatar,tier);return avatar;
}
export function purchaseItem(progress,itemId) {
 const item=ITEM_BY_ID[itemId],avatar=progress.avatar;
 if(!item) return {ok:false,message:'This item is unavailable; existing ownership is retained.'};
 if(avatar.ownedItemIds.includes(itemId)) return {ok:false,message:'You already own this item.'};
 if(item.acquisitionMethod!=='shop') return {ok:false,message:'This item is granted free through a starter look or rank milestone.'};
 if(tierFor(progress.xp)<item.requiredTier) return {ok:false,message:`Reach tier ${item.requiredTier+1} before buying this item.`};
 if(progress.currency<item.currencyCost) return {ok:false,message:'Not enough currency.'};
 progress.currency-=item.currencyCost;avatar.ownedItemIds.push(itemId);
 return {ok:true,message:`${item.name} is now yours. Equip it in its slot.`};
}
export function equipItem(progress,itemId,slot,theme=progress.theme) {
 const item=ITEM_BY_ID[itemId],avatar=progress.avatar;
 if(!item||!avatar.ownedItemIds.includes(itemId)) return {ok:false,message:'Own this item before equipping it.'};
 if(item.themeId!==theme) return {ok:false,message:`This item requires the ${item.themeId} world. Ownership is retained when switching worlds.`};
 if(item.slot!==slot||!(slot in SLOTS)) return {ok:false,message:'This item belongs in a different equipment slot.'};
 if(tierFor(progress.xp)<item.requiredTier) return {ok:false,message:'Reach the required rank before equipping this item.'};
 avatar.loadouts[theme][slot]=itemId;return {ok:true,message:`Equipped ${item.name}.`};
}
export function unequipItem(progress,slot,theme=progress.theme) {
 if(!(slot in SLOTS)||!avatarLoadout(progress,theme))return {ok:false,message:'Unknown equipment slot.'};
 // Null explicitly preserves an empty slot across starter-loadout migration.
 progress.avatar.loadouts[theme][slot]=null;return {ok:true,message:`${SLOTS[slot]} unequipped.`};
}
export function avatarLoadout(progress,theme=progress.theme) {return progress.avatar?.loadouts?.[theme];}
export function equippedItems(progress,theme=progress.theme) {
 return Object.fromEntries(Object.entries(avatarLoadout(progress,theme)||{}).filter(([slot,id])=>{const item=ITEM_BY_ID[id];return item&&item.slot===slot&&item.themeId===theme&&progress.avatar.ownedItemIds.includes(id)&&tierFor(progress.xp)>=item.requiredTier;}).map(([slot,id])=>[slot,ITEM_BY_ID[id]]));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateProgress,completeProject,recordEarnedReward,rankings} from '../src/progression.js';
import {ITEMS,ITEM_BY_ID,THEME_IDS,SLOTS,MILESTONES,starterLoadout} from '../src/avatar/items.js';
import {migrateAvatar,grantMilestones,purchaseItem,equipItem,unequipItem,equippedItems} from '../src/avatar/inventory.js';
import {effectFor} from '../src/avatar/effects.js';

test('catalog has complete metadata, original artifacts, explicit aura prices and full world looks',()=>{
 assert.equal(new Set(ITEMS.map(i=>i.id)).size,ITEMS.length);
 for(const item of ITEMS){for(const field of ['id','name','description','slot','themeId','rarity','requiredTier','currencyCost','acquisitionMethod','visualEffectId','previewAsset','accessibleDescription'])assert.notEqual(item[field],undefined,`${item.id}: ${field}`);assert.ok(item.slot in SLOTS);assert.ok(item.currencyCost>=0);}
 const artifacts=['beginners-needle','jade-shuttle','seven-needle-array','mooncutter-shears','golden-spindle','celestial-loom','voidweaver-needle','thousand-thread-crown'];
 assert.deepEqual(artifacts.map(id=>ITEM_BY_ID[id].requiredTier),[0,1,2,3,4,5,6,7]);
 assert.deepEqual(artifacts.map(id=>ITEM_BY_ID[id].currencyCost),[0,40,100,160,220,300,400,500]);
 for(const theme of THEME_IDS.slice(1)){assert.equal(Object.keys(starterLoadout(theme)).length,9);assert.equal(ITEMS.filter(i=>i.themeId===theme&&i.id.startsWith(`${theme}-advanced-`)).length,9);}
 for(const id of ['quiet-chi','golden-core','lotus-soul','soul-transformation','immortal-weaver'])assert.ok(ITEM_BY_ID[id].currencyCost>0);
 assert.equal(ITEM_BY_ID['cultivation-milestone-2'].acquisitionMethod,'milestone');assert.equal(ITEM_BY_ID['cultivation-milestone-6'].currencyCost,0);
});
test('legacy progress, achievements, inventory, currency and school survive version 3 migration',()=>{
 const data={xp:4000,currency:73,communityId:'uva',achievements:['first-stitch'],completed:['shirt:mend'],inventory:['legacy-shirt',{id:'old-crown'}],avatar:{ownedItemIds:['old-relic'],customFlag:true},events:[{id:'saved-event',communityId:'virginia-tech'}]};
 const p=migrateProgress(data);assert.equal(p.version,3);assert.equal(p.xp,4000);assert.equal(p.currency,73);assert.equal(p.communityId,'uva');assert.deepEqual(p.events,data.events);assert.deepEqual(p.achievements,data.achievements);assert.deepEqual(p.completed,data.completed);assert.equal(p.avatar.customFlag,true);
 for(const id of ['legacy-shirt','old-crown','old-relic'])assert.ok(p.avatar.ownedItemIds.includes(id));
 assert.equal(p.avatar.claimedMilestoneIds.length,7);
 const again=migrateProgress(JSON.parse(JSON.stringify(p)));assert.deepEqual(again,p);
});
test('milestone grants are immediate, stable, free and idempotent',()=>{
 const p=migrateProgress({currency:9});assert.ok(p.avatar.ownedItemIds.includes('cultivation-milestone-0'));
 const result=completeProject(p,'first');assert.equal(p.currency,49);assert.equal(result.rankUp,true);assert.equal(result.unlockedItemIds.length,5);assert.ok(p.avatar.ownedItemIds.includes('cultivation-milestone-1'));
 const currency=p.currency,owned=[...p.avatar.ownedItemIds];assert.deepEqual(grantMilestones(p.avatar,1),[]);assert.equal(p.currency,currency);assert.deepEqual(p.avatar.ownedItemIds,owned);
 assert.equal(new Set(p.avatar.claimedMilestoneIds).size,p.avatar.claimedMilestoneIds.length);
});
test('purchases reject rank locks, overspending, duplicates and free grants',()=>{
 const p=migrateProgress({xp:0,currency:500});assert.equal(purchaseItem(p,'jade-shuttle').ok,false);assert.equal(p.currency,500);
 p.xp=100;p.currency=39;assert.equal(purchaseItem(p,'jade-shuttle').ok,false);assert.equal(p.currency,39);
 p.currency=40;assert.equal(purchaseItem(p,'jade-shuttle').ok,true);assert.equal(p.currency,0);
 assert.equal(purchaseItem(p,'jade-shuttle').ok,false);assert.equal(p.currency,0);
 assert.equal(purchaseItem(p,'cultivation-milestone-7').ok,false);assert.equal(purchaseItem(p,'missing').ok,false);
});
test('equipment validates ownership, rank, slot and world; unequip persists after migration',()=>{
 const p=migrateProgress({xp:100,currency:40});assert.equal(equipItem(p,'jade-shuttle','main').ok,false);
 purchaseItem(p,'jade-shuttle');assert.equal(equipItem(p,'jade-shuttle','hair').ok,false);assert.equal(equipItem(p,'jade-shuttle','main','garden').ok,false);assert.equal(equipItem(p,'jade-shuttle','main').ok,true);
 assert.equal(equippedItems(p).main.id,'jade-shuttle');p.avatar.ownedItemIds.push('voidweaver-needle');assert.equal(equipItem(p,'voidweaver-needle','main').ok,false);
 unequipItem(p,'main');assert.equal(equippedItems(p).main,undefined);assert.equal(equippedItems(migrateProgress(JSON.parse(JSON.stringify(p)))).main,undefined);
});
test('world loadouts, colors, preferences and contribution rankings survive switching and refresh',()=>{
 const p=migrateProgress({xp:100,currency:40,communityId:'virginia-tech'});purchaseItem(p,'jade-shuttle');equipItem(p,'jade-shuttle','main');p.avatar.outfitColors.cultivation='#112233';p.avatar.intensity='low';p.avatar.paused=true;
 const ranks=rankings(p);p.theme='garden';const garden=equippedItems(p);assert.equal(garden.main.id,'garden-starter-main');assert.deepEqual(rankings(p),ranks);
 p.avatar.outfitColors.garden='#aabbcc';p.theme='cultivation';const restored=migrateProgress(JSON.parse(JSON.stringify(p)));assert.equal(equippedItems(restored).main.id,'jade-shuttle');assert.equal(restored.avatar.intensity,'low');assert.equal(restored.avatar.paused,true);assert.equal(restored.avatar.outfitColors.garden,'#aabbcc');assert.equal(restored.avatar.outfitColors.cultivation,'#112233');
});
test('larger earned reward grants every crossed milestone and returns only the highest ceremony tier',()=>{
 const p=migrateProgress();const result=recordEarnedReward(p,{sourceType:'project',sourceId:'larger-earned-project',xp:1500,currency:40});assert.equal(result.tier,4);assert.equal(result.previousTier,0);assert.equal(result.unlockedItemIds.length,20);assert.equal(p.avatar.claimedMilestoneIds.length,5);
 assert.equal(recordEarnedReward(p,{sourceType:'project',sourceId:'larger-earned-project',xp:1500,currency:40}),null);
 assert.equal(recordEarnedReward(p,{sourceType:'project',sourceId:'invalid',xp:-1}),null);
 assert.equal(migrateProgress(p).xp,1500);assert.deepEqual(grantMilestones(p.avatar,4),[]);
});
test('typed aura registry stays within particle caps and reduced-motion defaults to low',()=>{
 for(const effect of ['quiet-chi','foundation-thread','golden-core','lotus-soul','soul-transformation','void-refinement','immortal-weaver'])for(const theme of THEME_IDS){const params=effectFor(effect,theme);assert.ok(params.particleCount<=18);assert.ok(params.speed>=12);assert.ok(params.ribbonCount<=3);}
 globalThis.matchMedia=()=>({matches:true});assert.equal(migrateAvatar().intensity,'low');delete globalThis.matchMedia;
 assert.equal(MILESTONES.length,8);
});

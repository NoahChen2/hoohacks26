import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import os from 'node:os';import path from 'node:path';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('restitch.v1')).progression);
try {
 await page.goto('http://127.0.0.1:5173');
 await page.evaluate(async()=>{const {state,emit}=await import('/src/state.js');state.progression.communityId='uva';emit('progression');});
 await page.getByRole('button',{name:'Upcycle',exact:false}).click();await page.locator('[data-steps]').first().click();await page.locator('#sh-complete').click();
 await page.locator('.breakthrough-dialog').waitFor();assert.equal((await saved()).currency,40);
 await page.getByRole('button',{name:'Equip Reward',exact:true}).click();assert.equal((await saved()).avatar.loadouts.cultivation.robe,'cultivation-milestone-1');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#sh-close').click();
 await page.getByRole('button',{name:'Ranks & schools'}).click();await page.locator('.profile-character .character-scene').waitFor();
 await page.getByRole('link',{name:'Open character pavilion',exact:false}).click();await page.locator('#character-world').waitFor();
 await page.locator('[data-buy-item="jade-shuttle"]').click();assert.equal((await saved()).currency,0);await page.locator('[data-equip-item="jade-shuttle"]').click();
 assert.equal((await saved()).avatar.loadouts.cultivation.main,'jade-shuttle');assert.equal((await saved()).events[0].communityId,'uva');
 await page.locator('[data-preview-item="jade-shuttle"]').click();await page.locator('.item-preview-dialog').waitFor();assert.equal((await saved()).avatar.loadouts.cultivation.main,'jade-shuttle');assert.equal(await page.locator('#pavilion-scene .character-scene').getAttribute('data-running'),'false');await page.keyboard.press('Escape');await page.locator('.item-preview-dialog').waitFor({state:'detached'});
 await page.locator('#outfit-color').fill('#336688');await page.locator('#outfit-color').dispatchEvent('change');
 await page.locator('#effect-intensity').selectOption('low');await page.locator('#pause-character').click();
 await page.reload();await page.locator('#character-world').waitFor();assert.equal(await page.locator('#effect-intensity').inputValue(),'low');assert.equal((await saved()).avatar.outfitColors.cultivation,'#336688');assert.equal((await saved()).avatar.paused,true);assert.equal(await page.locator('.breakthrough-dialog').count(),0);
 await page.locator('[data-clear-slot="main"]').click();await page.reload();await page.locator('#character-world').waitFor();assert.equal((await saved()).avatar.loadouts.cultivation.main,null);
 await page.locator('[data-equip-item="jade-shuttle"]').click();await page.locator('#character-world').selectOption('garden');assert.equal((await saved()).avatar.loadouts.garden.main,'garden-starter-main');
 await page.locator('#character-world').selectOption('cultivation');assert.equal((await saved()).avatar.loadouts.cultivation.main,'jade-shuttle');assert.equal((await saved()).currency,0);
 // A separate high-rank fixture exposes every effect without adding a reward/debug control.
 await page.evaluate(async()=>{const {state,emit}=await import('/src/state.js');const {migrateProgress}=await import('/src/progression.js');state.progression=migrateProgress({...state.progression,xp:6000,currency:10000});emit('avatar');});await page.reload();await page.locator('#character-world').waitFor();
 await page.locator('#effect-intensity').selectOption('full');await page.locator('#pause-character').click();
 await page.locator('#inventory-slot').selectOption('orbit');await page.locator('[data-buy-item="seven-needle-array"]').click();await page.locator('[data-equip-item="seven-needle-array"]').click();
 assert.equal(await page.locator('.needle-orbit > g').count(),7);
 await page.locator('#effect-intensity').selectOption('low');assert.equal(await page.locator('.needle-orbit > g').count(),3);assert.equal(await page.locator('.needle-orbit').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.locator('#effect-intensity').selectOption('off');assert.equal(await page.locator('.needle-orbit > g').count(),7);assert.equal(await page.locator('.needle-orbit').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.locator('#effect-intensity').selectOption('full');
 await page.locator('#inventory-slot').selectOption('aura');await page.locator('[data-buy-item="immortal-weaver"]').click();await page.locator('[data-equip-item="immortal-weaver"]').click();
 assert.ok(await page.locator('.chi-particle').count()<=18);
 await page.locator('#inventory-slot').selectOption('formation');await page.locator('[data-buy-item="celestial-loom"]').click();await page.locator('[data-equip-item="celestial-loom"]').click();
 await page.locator('#inventory-slot').selectOption('hair');await page.locator('[data-buy-item="thousand-thread-crown"]').click();await page.locator('[data-equip-item="thousand-thread-crown"]').click();
 await page.locator('#inventory-slot').selectOption('main');await page.locator('[data-buy-item="voidweaver-needle"]').click();await page.locator('[data-equip-item="voidweaver-needle"]').click();
 await page.locator('#character-background').selectOption('cultivation-milestone-7');
 await page.locator('.character-scene').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.character-scene')?.dataset.running==='true');
 await page.screenshot({path:path.join(os.tmpdir(),'rethread-immortal-pavilion.png')});
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.needle-orbit').evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.character-float').evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
 // Verify both starter and fully equipped advanced variants in each other world.
 for(const theme of ['garden','fantasy','runway','cyber']) {
  await page.locator('#character-world').selectOption(theme);
  assert.ok((await page.locator('.character-art').getAttribute('aria-label')).includes('holding'));
  await page.evaluate(async world=>{const {state,emit}=await import('/src/state.js');const {ITEMS}=await import('/src/avatar/items.js');const {purchaseItem,equipItem}=await import('/src/avatar/inventory.js');for(const item of ITEMS.filter(i=>i.id.startsWith(`${world}-advanced-`))){purchaseItem(state.progression,item.id);equipItem(state.progression,item.id,item.slot);}emit('avatar');const {renderCharacterPanel}=await import('/src/avatar/pavilion.js');renderCharacterPanel(document.getElementById('panel'));},theme);
  assert.equal(await page.locator('.equipment-slot strong').filter({hasText:'Unequipped'}).count(),0);
  for(const width of [1440,375]) {await page.setViewportSize({width,height:1000});assert.ok(await page.locator('#panel').evaluate(e=>e.scrollWidth<=e.clientWidth),`${theme} mobile fit`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 }
 await page.screenshot({path:path.join(os.tmpdir(),'rethread-pavilion-mobile.png')});
 await page.goto('http://127.0.0.1:5173/#/community');await page.locator('.profile-character .character-scene').waitFor();
 assert.ok(await page.locator('.rank-row .character-portrait').count()>0);assert.equal(await page.locator('.rank-row .character-particles').count(),0);
 assert.equal(await page.locator('.podium-card .rank-crest').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.locator('#panel').evaluate(el=>{el.scrollTop=el.scrollHeight;window.scrollTo(0,document.body.scrollHeight);});await page.waitForFunction(()=>document.querySelector('.profile-character .character-scene')?.dataset.running==='false');
 assert.equal(await page.locator('.profile-character .character-float').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
 await page.locator('#panel').evaluate(el=>{el.scrollTop=0;window.scrollTo(0,0);});await page.locator('.profile-character .character-scene').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('.profile-character .character-scene')?.dataset.running==='true');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('.profile-character .character-scene').getAttribute('data-running'),'false');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 const beforeMulti=await saved();
 await page.evaluate(async()=>{const {migrateProgress,recordEarnedReward}=await import('/src/progression.js');const {showBreakthrough}=await import('/src/avatar/BreakthroughDialog.js');const fixture=migrateProgress({xp:0,currency:0});const result=recordEarnedReward(fixture,{sourceType:'project',sourceId:'multi-tier-fixture',xp:1500});showBreakthrough(fixture,result);});
 assert.equal(await page.locator('.breakthrough-dialog').count(),1);assert.equal(await page.locator('#breakthrough-title').textContent(),'Jade Artisan');assert.equal(await page.locator('.breakthrough-dialog li').count(),4);await page.getByRole('button',{name:'Skip breakthrough ceremony'}).click();assert.deepEqual(await saved(),beforeMulti);
 assert.deepEqual(errors,[]);console.log('Avatar browser flow passed: free breakthrough/equip, shop, preview, loadouts, unequip/refresh, settings, exact needle modes, advanced looks in all worlds, static leaderboard portraits, reduced motion, mobile fit.');
} finally {await browser.close();}

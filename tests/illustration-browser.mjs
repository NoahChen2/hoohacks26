import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';import os from 'node:os';
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('restitch.v1')).progression);
try {
 await page.goto('http://127.0.0.1:5173/#/character');await page.locator('.character-scene[data-art-ready="true"]').waitFor();
 const before=await saved();
 await page.locator('button[data-emote="greet"]').click();assert.equal(await page.locator('[data-sprite-surface]').getAttribute('data-pose'),'greet');assert.equal(await page.locator('[data-sprite-clip]').getAttribute('x'),'418');
 await page.locator('button[data-emote="celebrate"]').click();assert.equal(await page.locator('[data-sprite-surface]').getAttribute('data-pose'),'celebrate');assert.equal(await page.locator('[data-sprite-clip]').getAttribute('x'),'836');
 await page.locator('button[data-emote="focus"]').click();assert.equal(await page.locator('.character-scene').getAttribute('data-emote'),'focus');assert.equal(await page.locator('[data-sprite-clip]').getAttribute('x'),'0');assert.deepEqual(await saved(),before,'Emotes never modify rewards, equipment or school attribution');
 await page.locator('#outfit-color').fill('#336688');await page.locator('#outfit-color').dispatchEvent('change');await page.waitForFunction(()=>document.querySelector('.character-sprite-image')?.getAttribute('href')?.startsWith('data:image/png'));
 await page.reload();await page.locator('.character-scene[data-art-ready="true"]').waitFor();assert.equal((await saved()).avatar.outfitColors.cultivation,'#336688');
 for(const theme of ['cultivation','garden','fantasy','runway','cyber']){
  await page.locator('#character-world').selectOption(theme);await page.locator('.character-scene[data-art-ready="true"]').waitFor();assert.ok((await page.locator('[data-sprite-surface]').getAttribute('data-source')).includes(`${theme}-sprites.png`));assert.equal(await page.locator('.painted-character').count(),1);assert.equal(await page.locator('[data-layer="character-body"]').count(),0);
  await page.locator('.pavilion-header').click({position:{x:100,y:100}});await page.waitForFunction(()=>{const c=document.querySelector('.interaction-canvas');return c&&(Number(c.dataset.activeParticles)>0||Number(c.dataset.activeBolts)>0);});assert.equal(await page.locator('.interaction-canvas').getAttribute('data-kind'),theme==='cyber'?'lightning':'mist');
  if(theme==='cyber')await page.screenshot({path:path.join(os.tmpdir(),'rethread-painted-cyber-lightning.png')});
  await page.setViewportSize({width:375,height:1000});assert.ok(await page.locator('#panel').evaluate(e=>e.scrollWidth<=e.clientWidth),`${theme} mobile overflow`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1100});
 }
 await page.locator('#effect-intensity').selectOption('off');await page.locator('.pavilion-header').click({position:{x:100,y:100}});await page.waitForFunction(()=>{const c=document.querySelector('.interaction-canvas');return !c||(c.dataset.activeParticles==='0'&&c.dataset.activeBolts==='0');});
 await page.locator('#effect-intensity').selectOption('full');await page.emulateMedia({reducedMotion:'reduce'});await page.locator('button[data-emote="greet"]').click();assert.equal(await page.locator('[data-sprite-surface]').getAttribute('data-pose'),'greet');assert.equal(await page.locator('.painted-character').evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await page.locator('.character-float').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>{const original=requestAnimationFrame;window.requestAnimationFrame=callback=>original(time=>callback(time-1000));});
 await page.locator('.pavilion-header').click({position:{x:100,y:100}});await page.waitForTimeout(200);
 assert.deepEqual(errors,[]);console.log('Illustration browser passed: painted assets in five worlds, clipped gesture frames, emotes without state changes, material tint/refresh, pointer mist/lightning, stale RAF timing, Off and reduced motion, mobile fit, no browser errors.');
} finally {await browser.close();}

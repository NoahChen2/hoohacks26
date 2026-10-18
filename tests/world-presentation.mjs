import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
const browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://127.0.0.1:5173/#/community');
 for(const world of ['cultivation','garden','fantasy','runway','cyber']) {
  await page.locator('#world').selectOption(world);
  assert.equal(await page.locator('.rank-stop').count(),8);
  assert.equal(await page.locator('.world-scenery').count(),1);
  await page.evaluate(()=>document.fonts.ready);
  const fonts={cultivation:'Cinzel',garden:'Cormorant Garamond',fantasy:'Uncial Antiqua',runway:'Bodoni Moda',cyber:'Orbitron'};
  assert.ok(await page.evaluate(font=>document.fonts.check(`16px "${font}"`),fonts[world]),`${world} font loaded`);
  assert.ok((await page.locator('.world-hero h2').evaluate(e=>getComputedStyle(e).fontFamily)).includes(fonts[world]));
  assert.notEqual(await page.locator('.world-particle').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.notEqual(await page.locator('.crest-stage > .rank-crest').evaluate(e=>getComputedStyle(e).animationName),'none');
  const ids=await page.locator('.rank-crest defs [id]').evaluateAll(es=>es.map(e=>e.id));
  assert.equal(ids.length,new Set(ids).size,'SVG gradients have unique IDs');
  for(const width of [1280,375]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.locator('#panel').evaluate(e=>e.scrollWidth<=e.clientWidth),`${world} ${width} overflow`);
  }
 }
 await page.setViewportSize({width:1280,height:900});
 await page.evaluate(async()=>{const {state}=await import('/src/state.js');const {renderCommunityPanel}=await import('/src/ui/communityPanel.js');state.progression.xp=6000;state.progression.theme='garden';renderCommunityPanel(document.getElementById('panel'));});
 assert.equal(await page.locator('.is-current strong').textContent(),'Evergreen Crown');
 assert.notEqual(await page.locator('.crest-stage .crest-orbit').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.screenshot({path:path.join(os.tmpdir(),'rethread-world-desktop.png')});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.crest-stage .crest-orbit').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('.world-particle').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('.crest-stage > .rank-crest').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('.crest-stage').evaluate(e=>getComputedStyle(e,'::after').animationName),'none');
 await page.setViewportSize({width:375,height:812});
 await page.screenshot({path:path.join(os.tmpdir(),'rethread-world-mobile.png')});
 assert.deepEqual(errors,[]);console.log('All five themes: 8 crests each, desktop/mobile fit, high-rank effects and reduced motion passed. Screenshots: '+os.tmpdir());
} finally {await browser.close();}

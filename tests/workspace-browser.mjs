import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const tab = name => page.locator(`#tabs [data-tab="${name}"]`);
try {
  await page.goto('http://127.0.0.1:5173/#/body');
  await tab('closet').click();
  assert.equal(new URL(page.url()).hash, '#/closet');
  await tab('upcycle').click();
  await page.goBack();
  await page.locator('#g-name').waitFor();
  assert.equal(await page.locator('body').getAttribute('data-page'), 'closet');
  await page.goForward();
  await page.locator('#up-body').waitFor();

  await tab('closet').click();
  await page.locator('#g-mat').selectOption('linen');
  await page.locator('#g-type').selectOption('longsleeve');
  assert.equal(await page.locator('#g-mat').inputValue(), 'linen', 'changing type preserves chosen fabric');
  const before = await page.locator('[data-num="chest"]').inputValue();
  await page.locator('[data-num="chest"]').fill('9999');
  await page.locator('[data-num="chest"]').dispatchEvent('change');
  assert.equal(await page.evaluate(async () => (await import('/src/state.js')).state.garments[0].chest), Number(before));
  await page.locator('[data-num="chest"]').fill(before);
  await page.locator('[data-num="chest"]').dispatchEvent('change');
  const hostile = '<img src=x onerror="window.name=\'unsafe\'">';
  await page.locator('#g-name').fill(hostile);
  await tab('upcycle').click();
  assert.equal(await page.locator('.g-mini.active span').textContent(), hostile);
  assert.equal(await page.locator('#panel img[src="x"]').count(), 0);
  assert.equal(await page.locator('.cap-title img').count(), 0);
  await page.locator('[data-steps]').first().click();
  assert.equal(await page.locator('#sheet').evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.locator('#sheet').evaluate(el => el.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#overlay').isVisible(), false);

  for (const name of ['community', 'character']) {
    await tab(name).click();
    await page.locator(name === 'character' ? '.character-pavilion' : '.world-hero').waitFor();
    assert.equal(await tab(name).getAttribute('aria-current'), 'page');
    assert.ok(await page.locator('#panel').evaluate(el => el.clientWidth > innerWidth * .9));
    assert.equal(await page.locator('.stage').isVisible(), false);
    await page.screenshot({ path: path.join(os.tmpdir(), `restitch-unified-${name}.png`) });
  }

  await page.goto('http://127.0.0.1:5173/#/community/schools/uva');
  await page.locator('[data-join="uva"]').waitFor();
  await tab('community').click();
  assert.equal(new URL(page.url()).hash, '#/community');
  assert.equal(await page.locator('.community-tabs').count(), 1);

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['body', 'closet', 'upcycle', 'community', 'character']) {
      await tab(name).click();
      if (name === 'character') await page.locator('.character-pavilion').waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} fits ${width}px`);
      assert.ok(await page.locator('#panel').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${name} panel fits ${width}px`);
      if (['body', 'closet', 'upcycle'].includes(name)) {
        assert.ok(await page.locator('#panel').evaluate(el => el.getBoundingClientRect().top >= document.querySelector('.stage').getBoundingClientRect().bottom - 1));
      }
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5173/#/body');
  await tab('body').waitFor();
  assert.equal(await page.locator('#tg-animate').isChecked(), false);
  assert.equal(await page.locator('#tg-spin').isChecked(), false);
  assert.deepEqual(errors, []);
  console.log('Unified workspace passed: history, direct links, full-width worlds, mobile layout, safe names, fabric retention, valid measurements, keyboard dialogs, reduced motion, no browser errors.');
} finally {
  await browser.close();
}

// test_segeditor.mjs — E2E test of the video segment editor feature
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dir = '/tmp/newdeck/_segtest';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('file://' + dir + '/index.html');
await page.waitForTimeout(1500);

// p11 has video 11-1.mp4 (index 10)
await page.evaluate(() => window.__deck.go(10));
await page.waitForTimeout(1200);

const t = (name, ok, extra = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

// 1. ✂ button exists on the video's frame
const btn = await page.$('.slide.visible .vidseg-btn');
t('segment button present on video frame', !!btn);

// 2. open panel
await btn.click();
await page.waitForTimeout(300);
t('panel opens', !!(await page.$('.vidseg-panel')));
const info1 = await page.textContent('.vidseg-panel .vsp-info');
t('panel shows current interval', /默认区间|自定义/.test(info1), info1.trim());

// 3. set start=2, end=4 and save
await page.fill('.vidseg-panel input[type=number] >> nth=0', '2');
await page.fill('.vidseg-panel input[type=number] >> nth=1', '4');
await page.click('.vidseg-panel .vsp-save');
await page.waitForTimeout(600);
t('panel closes after save', !(await page.$('.vidseg-panel')));

// 4. localStorage persisted
const stored = await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('dhseg::'));
  return keys.map(k => localStorage.getItem(k));
});
t('localStorage persisted', stored.some(s => { try { const o = JSON.parse(s); return o.s === 2 && o.e === 4; } catch { return false; } }), JSON.stringify(stored));

// 5. dataset applied immediately + video playing within segment
const vstate = await page.evaluate(() => {
  const v = document.querySelector('.slide.visible video');
  return { start: v.dataset.start, end: v.dataset.end, t: v.currentTime, paused: v.paused };
});
t('dataset.start/end applied', vstate.start === '2' && vstate.end === '4', JSON.stringify(vstate));
t('video playing (autoplay resumed after save)', !vstate.paused);

// 6. playback clamps to segment (wait past end boundary)
await page.waitForTimeout(3500);
const after = await page.evaluate(() => {
  const v = document.querySelector('.slide.visible video');
  return { t: v.currentTime, paused: v.paused };
});
t('playback loops within [2,4] (currentTime stayed in segment)', after.t >= 2 && after.t <= 4.2, JSON.stringify(after));

// 7. navigate away and back — override survives re-setup
await page.evaluate(() => window.__deck.go(9));
await page.waitForTimeout(400);
await page.evaluate(() => window.__deck.go(10));
await page.waitForTimeout(800);
const reapply = await page.evaluate(() => {
  const v = document.querySelector('.slide.visible video');
  return { start: v.dataset.start, end: v.dataset.end };
});
t('override survives page-away-and-back (re-applied on setup)', reapply.start === '2' && reapply.end === '4', JSON.stringify(reapply));

// 8. reset restores defaults
const btn2 = await page.$('.slide.visible .vidseg-btn');
await btn2.click();
await page.waitForTimeout(200);
t('panel shows saved state', /(已保存自定义片段)/.test(await page.textContent('.vidseg-panel .vsp-info')));
await page.click('.vidseg-panel .vsp-reset');
await page.waitForTimeout(400);
const reset = await page.evaluate(() => {
  const v = document.querySelector('.slide.visible video');
  const keys = Object.keys(localStorage).filter(k => k.startsWith('dhseg::'));
  return { start: v.dataset.start, end: v.dataset.end, keys };
});
t('reset clears localStorage + restores default range', reset.keys.length === 0, JSON.stringify(reset));

// 9. keyboard guard: arrow keys do nothing while panel open
await page.click('.slide.visible .vidseg-btn');
await page.waitForTimeout(200);
const before = await page.evaluate(() => window.__deck.page());
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(200);
const during = await page.evaluate(() => window.__deck.page());
t('arrow key blocked while panel open', before === during, `page ${before} -> ${during}`);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
t('Esc closes panel', !(await page.$('.vidseg-panel')));

t('no JS errors during whole test', errors.length === 0, errors.join('; '));
await browser.close();

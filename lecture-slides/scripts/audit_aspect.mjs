// audit_aspect.mjs — media frame aspect-ratio audit for a fixed-stage deck
// Usage: node audit_aspect.mjs <deck_dir>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import path from 'path';

const dir = path.resolve(process.argv[2]);
const THRESH = 1.12;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file://' + path.join(dir, 'index.html'));
await page.waitForTimeout(1200);

const total = await page.evaluate(() => window.__deck.total);
const rows = [];
for (let i = 0; i < total; i++) {
  await page.evaluate((n) => window.__deck.go(n), i);
  await page.waitForTimeout(350);
  // wait for all videos to have metadata
  await page.evaluate(() => {
    const vids = [...document.querySelectorAll('.slide.visible video')];
    window.__vidReady = vids.map((v) => v.readyState >= 1 || v.error !== null);
  });
  for (let t = 0; t < 20; t++) {
    const ok = await page.evaluate(() => {
      const vids = [...document.querySelectorAll('.slide.visible video')];
      return vids.every((v) => v.readyState >= 1 || v.error !== null);
    });
    if (ok) break;
    await page.waitForTimeout(100);
  }
  const res = await page.evaluate(() => {
    const slide = document.querySelector('.slide.visible');
    const out = [];
    slide.querySelectorAll('img, video').forEach((el) => {
      const src = el.getAttribute('src') || el.currentSrc || '';
      let mw = 0, mh = 0;
      if (el.tagName === 'IMG') { mw = el.naturalWidth; mh = el.naturalHeight; }
      else { mw = el.videoWidth; mh = el.videoHeight; }
      const box = el.closest('.fv') || el.closest('figure') || el.parentElement;
      const b = box.getBoundingClientRect();
      out.push({ src, mw, mh, bw: Math.round(b.width), bh: Math.round(b.height) });
    });
    return out;
  });
  const no = (i + 1).toString().padStart(2, '0');
  if (!res.length) { rows.push({ page: no, na: true }); continue; }
  for (const r of res) {
    if (!r.mw || !r.mh) { rows.push({ page: no, file: r.src, err: 'no metadata' }); continue; }
    const r1 = r.mw / r.mh, r2 = r.bw / r.bh;
    const mismatch = Math.max(r1 / r2, r2 / r1);
    rows.push({
      page: no, file: r.src,
      media: `${r.mw}x${r.mh} (${r1.toFixed(3)})`,
      frame: `${r.bw}x${r.bh} (${r2.toFixed(3)})`,
      mismatch: +mismatch.toFixed(3),
      flag: mismatch > THRESH,
    });
  }
}
await browser.close();

let flagged = 0;
for (const r of rows) {
  if (r.na) { console.log(`p${r.page}: N/A (no raster media)`); continue; }
  if (r.err) { console.log(`p${r.page}: ERROR ${r.file} ${r.err}`); flagged++; continue; }
  const mark = r.flag ? '  <-- MISMATCH' : '';
  if (r.flag) flagged++;
  console.log(`p${r.page}: ${r.file}  media ${r.media}  frame ${r.frame}  mismatch ${r.mismatch}${mark}`);
}
console.log(flagged ? `\nFLAGGED: ${flagged} containers above ${THRESH}` : `\nZERO mismatches above ${THRESH}`);
process.exit(flagged ? 2 : 0);

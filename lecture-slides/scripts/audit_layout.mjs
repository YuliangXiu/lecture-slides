// audit_layout.mjs — layout-balance audit for a fixed-stage deck
// Usage: node audit_layout.mjs <deck_dir>
// Measures per page: content bottom (vs 1080), bottom whitespace %, media count, text density.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import path from 'path';

const dir = path.resolve(process.argv[2]);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto('file://' + path.join(dir, 'index.html'));
await page.waitForTimeout(1500);
const total = await page.evaluate(() => window.__deck.total);
console.log('deck:', dir.split('/').pop(), '| total slides:', total);

const rows = [];
for (let i = 0; i < total; i++) {
  await page.evaluate((n) => window.__deck.go(n), i);
  await page.waitForTimeout(250);
  const res = await page.evaluate(() => {
    const slide = document.querySelector('.slide.visible');
    if (!slide) return null;
    const stage = document.getElementById('deckStage') || slide.closest('.deck-stage');
    const srect = stage ? stage.getBoundingClientRect() : { width: 1920, left: 0, top: 0 };
    const scale = srect.width / 1920;
    const skip = (el) => el.closest('.s-page, .deck-controls, .progressbar, .deck-toc, .deck-notes, .corner-badge, .cv-logo');
    let maxBottom = 0, minTop = 1080, maxRight = 0;
    slide.querySelectorAll('*').forEach((el) => {
      if (skip(el)) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      // content leaves only: media elements, or elements with DIRECT visible text
      const tag = el.tagName;
      const isMedia = (tag === 'IMG' || tag === 'VIDEO' || tag === 'SVG' || tag === 'CANVAS');
      let hasDirectText = false;
      if (!isMedia) {
        for (const n of el.childNodes) {
          if (n.nodeType === 3 && n.textContent.trim().length > 0) { hasDirectText = true; break; }
        }
      }
      if (!isMedia && !hasDirectText) return;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const bottom = (r.bottom - srect.top) / scale;
      const top = (r.top - srect.top) / scale;
      const right = (r.right - srect.left) / scale;
      if (bottom > maxBottom) maxBottom = bottom;
      if (top < minTop) minTop = top;
      if (right > maxRight) maxRight = right;
    });
    const imgs = slide.querySelectorAll('img').length;
    const vids = slide.querySelectorAll('video').length;
    const svgs = slide.querySelectorAll('svg').length;
    const textLen = (slide.innerText || '').replace(/\s+/g, ' ').trim().length;
    const title = (slide.querySelector('.s-title') || {}).textContent || '';
    return { maxBottom: Math.round(maxBottom), minTop: Math.round(minTop), maxRight: Math.round(maxRight), imgs, vids, svgs, textLen, title: title.trim().slice(0, 40) };
  });
  if (!res) continue;
  const ws = Math.round((1080 - res.maxBottom) / 1080 * 100);
  const media = res.imgs + res.vids;
  const density = res.textLen > 900 ? 'rich' : res.textLen > 350 ? 'medium' : 'thin';
  rows.push({ p: i + 1, ...res, ws, media, density });
  const flag = res.maxBottom < 850 ? ' ⚠️TOPCROWD' : '';
  const mediaTag = media === 0 ? (res.svgs > 0 ? ' [svg]' : ' [text-only]') : ` [${res.imgs}i${res.vids ? '+' + res.vids + 'v' : ''}]`;
  console.log(`p${String(i + 1).padStart(2)} bottom=${String(res.maxBottom).padStart(4)} ws=${String(ws).padStart(2)}% top=${String(res.minTop).padStart(4)} right=${String(res.maxRight).padStart(4)}${mediaTag} ${density.padEnd(6)} "${res.title}"${flag}`);
}
// media rhythm: runs of >=3 consecutive pages with zero img+video
let runs = [], run = [];
rows.forEach((r) => {
  if (r.imgs + r.vids === 0) run.push(r.p);
  else { if (run.length >= 3) runs.push(run.slice()); run = []; }
});
if (run.length >= 3) runs.push(run);
console.log('text-only runs (>=3 pages):', runs.length ? runs.map(r => `p${r[0]}-p${r[r.length - 1]}`).join(', ') : 'none');
console.log('top-crowded pages (bottom<850):', rows.filter(r => r.maxBottom < 850).map(r => 'p' + r.p).join(', ') || 'none');
console.log('thin pages (text<=350 & no media):', rows.filter(r => r.textLen <= 350 && r.imgs + r.vids === 0).map(r => 'p' + r.p).join(', ') || 'none');
await browser.close();

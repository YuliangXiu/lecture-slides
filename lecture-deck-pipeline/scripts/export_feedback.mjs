#!/usr/bin/env node
// export_feedback.mjs — 从 02-script/index.html 的 localStorage 导出/清空修改意见
// 用法:
//   node export_feedback.mjs <02-script URL> [--out feedback.json] [--clear]
// 依赖: playwright（NODE_PATH 指向 workspace node_modules）
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import fs from 'fs';

const FB_PREFIX = 'polish-feedback:';

function parseArgs(argv) {
  const url = argv.find(a => /^https?:\/\//.test(a));
  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? argv[outIdx + 1] : null;
  const clear = argv.includes('--clear');
  return { url, out, clear };
}

const { url, out, clear } = parseArgs(process.argv.slice(2));
if (!url) {
  console.error('用法: node export_feedback.mjs <02-script URL> [--out feedback.json] [--clear]');
  console.error('示例: node export_feedback.mjs http://localhost:8321/02-script/ --out /tmp/feedback.json');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500); // 等页面 JS 初始化（意见已由前端写入 localStorage）

// 读 + 解析所有 polish-feedback:* key
const feedback = await page.evaluate((prefix) => {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k.indexOf(prefix) !== 0) continue;
    const v = localStorage.getItem(k);
    if (!v) continue;
    const parts = k.split(':');
    out.push({
      sess: parseInt(parts[1], 10),
      page: parseInt(parts[2], 10),
      sid: parts[3],
      type: parts[4],          // "ppt" | "script" | "insert-before" | "insert-after"
      text: v,
    });
  }
  return out;
}, FB_PREFIX);

// 排序：按 sess, page, type（insert-before < ppt < script < insert-after），输出稳定
const TYPE_ORDER = { 'insert-before': 0, 'ppt': 1, 'script': 2, 'insert-after': 3 };
feedback.sort((a, b) => a.sess - b.sess || a.page - b.page || (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));

const json = JSON.stringify(feedback, null, 2);
if (out) {
  fs.writeFileSync(out, json, 'utf-8');
  console.log(`已导出 ${feedback.length} 条意见 → ${out}`);
} else {
  console.log(json);
}

if (clear) {
  const removed = await page.evaluate((prefix) => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    return keys.length;
  }, FB_PREFIX);
  console.log(`已清空 ${removed} 个 localStorage key`);
}

await browser.close();

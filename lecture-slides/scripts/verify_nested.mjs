#!/usr/bin/env node
// verify_nested.mjs — 圆角框体风格全页扫描验收
// 断言：有框体祖先的元素 → 顶部 1px 细边（非强调色）；无框体祖先 → 顶部 3px 强调线
// 用法：node verify_nested.mjs <页面绝对路径|URL> [--sel "<框体选择器>"] [--shot out.png]
// 依赖：NODE_PATH 指向含 playwright 的 node_modules（见 SKILL.md Step 4）
import { createRequire } from 'module';
import { resolve } from 'path';
import { existsSync } from 'fs';
const require = createRequire(import.meta.url);   /* ESM 不读 NODE_PATH，CJS require 会读 */
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const target = args.shift();
if (!target) { console.error('用法：node verify_nested.mjs <页面路径|URL> [--sel "<选择器>"] [--shot out.png]'); process.exit(2); }
let sel = '.card, .media-grid > figure:not(.plain), .ov-cell, .qbox, table.tbl, .stat';
let shot = null;
while (args.length) {
  const a = args.shift();
  if (a === '--sel') sel = args.shift();
  else if (a === '--shot') shot = args.shift();
}
const url = /^https?:\/\//.test(target) ? target
  : 'file://' + (existsSync(target) ? resolve(target) : target);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message.split('\n')[0]));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });

const report = await page.evaluate(sel => {
  const bad = [], seen = { outer: 0, inner: 0 };
  document.querySelectorAll(sel).forEach(el => {
    const cs = getComputedStyle(el);
    const nested = !!el.parentElement && !!el.parentElement.closest(sel);
    if (nested) {
      seen.inner++;
      /* 内层合格 = 顶边 1px 且颜色与侧边一致（即不再带强调线） */
      if (cs.borderTopWidth !== '1px' || cs.borderTopColor !== cs.borderLeftColor)
        bad.push('INNER ' + el.tagName + '.' + (el.className || '').toString().split(' ').slice(0, 2).join('.') +
                 ' top=' + cs.borderTopWidth + '/' + cs.borderTopColor);
    } else {
      seen.outer++;
      if (cs.borderTopWidth !== '3px')
        bad.push('OUTER ' + el.tagName + '.' + (el.className || '').toString().split(' ').slice(0, 2).join('.') +
                 ' top=' + cs.borderTopWidth + '/' + cs.borderTopColor);
    }
  });
  return { bad, seen };
}, sel);

console.log('扫描框体：最外层 ' + report.seen.outer + ' 个，嵌套内层 ' + report.seen.inner + ' 个');
if (report.bad.length === 0) console.log('PASS 全部框体符合规则：仅最外层 3px 强调线，内层 1px 细边');
else { console.log('FAIL：'); report.bad.slice(0, 20).forEach(s => console.log('  ' + s)); }
console.log('JS 错误：' + (errors.length ? errors.join(' | ') : '无'));
if (shot) await page.screenshot({ path: shot });
await browser.close();
process.exit(report.bad.length ? 1 : 0);

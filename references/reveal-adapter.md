# reveal.js deck 接入演讲者模式（模块 B）

reveal.js 引擎不原生导出 `__deck`，需要一段适配器（内联在 `Reveal.initialize(...)` 之后）。
本项目三套 deck（session-1/2/3）均用此方案，可作为参考实现。

## 适配器要点

```js
window.__deck = {
  total: Reveal.getTotalSlides(),
  page: function(){ return Reveal.getIndices().h; },          // 0-based
  go:   function(i){ Reveal.slide(Math.max(0, Math.min(this.total - 1, i))); },
  notes: function(i){                                          // 关键：无参调用返回当前页
    var idx = (i == null) ? this.page() : i;                   // presenter-inject 的 state() 调 notes() 无参
    return (window.__NOTES && window.__NOTES[idx]) || '';
  }
};
Reveal.on('slidechanged', function(e){ if (window.__onPage) window.__onPage(e.indexh); });
Reveal.on('ready',       function(e){ if (window.__onPage) window.__onPage(e.indexh); });  // 首帧也上报
```

`__hwyqSync` 协议（presenter.html 预览 iframe 驱动）：

```js
window.addEventListener('message', function(e){
  var d = e.data;
  if (!d || !d.__hwyqSync) return;
  if (d.cmd === 'goto' && typeof d.page === 'number') window.__deck.go(d.page - 1);
});
if (window.top !== window.self) {
  // 嵌入预览 iframe：关掉 reveal 自带键盘，方向键转发给 presenter 仲裁（避免双跳）
  try { Reveal.configure({ keyboard: false }); } catch (err) {}
  document.addEventListener('keydown', /* → parent.postMessage({__hwyqSync:1,cmd:'nav',dir}) */);
}
```

## 踩坑记录

- **reveal hash 是 0 基**：`#/4` = 第 5 页。模板的 `curF.src = 'index.html#/' + p`（1-based p）
  须改为 `+ (p - 1)`，否则首帧闪到下一页（800ms 自愈能纠正但有闪动）。
- **iframe 内必须 `Reveal.configure({keyboard:false})`**：否则方向键在 iframe 本地翻页 + 转发 nav，
  同一按键翻两页。
- **notes() 无参约定**：presenter-inject 的 `state()` 调 `d.notes()` 不带参取当前页备注；
  `durs()` 调 `d.notes(i)` 带索引。适配器两种调用都要支持。
- **notes 数据源**：讲稿 JSON（如 `02-script/data.js`）在构建期 inline 成 `window.__NOTES = [...]`
  注入 deck（自包含、file:// 可用），比运行时 `<script src>` 相对路径更稳。
- **deck 页数 ≠ 讲稿页数时要显式对齐**：如 deck 有 Break 页而讲稿没有，在末尾补短备注
  （durs 保底 12s），并核对 `__NOTES.length === Reveal.getTotalSlides()`。
- **英文讲稿语速校准**：CHAR_PER_MIN = 讲稿去空白总字符 / 总词数 × wpm
  （如 72484 chars / 15292 words × 130 wpm = 616）。方向别写反——words/chars 会得 27。
- **幂等注入**：deck 侧注入块用 `<!-- lecture-slides:begin/end -->` 标记包裹，
  重跑构建脚本时整体替换；re.sub 的 replacement 含 `\u` 转义会报 bad escape，用 `lambda m: block`。

## E2E 验收脚本模式（Playwright）

```
ctx.waitForEvent('page') + deck.keyboard.press('s')   → 拿到 presenter popup
断言：ind='1 / N'、dot.on、nbody 非空、#barSegs .seg 数 = N、#timeTicks .tick 数 = N
deck.evaluate(Reveal.slide(5)) → pres ind '6 / N'、当前 seg .on 索引 = 5
pres.click('#next') / pres.keyboard('ArrowRight') → deck getIndices().h 递增
pres.keyboard('End') → deck h=N-1、#nextWrap.dim
HTTP 下（同源）可直读 curF.contentDocument 断言预览跟随；file:// 只断言父页 DOM
```

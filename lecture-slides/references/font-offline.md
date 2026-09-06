# 字体离线本地化（VF + 子集化）

目标：整套课件拷到任何电脑、断网 file:// 双击打开，渲染与在线 Google Fonts 版一致。
**方案：可变字体（VF）原字 + 按课件实际字符集 pyftsubset 子集化 → 每家族 1 个 woff2**。
实测（30 页中文课件）：5 文件共 0.77 MB（NotoSerifSC 382K / NotoSansSC 292K / Playfair 正斜各 40K / JetBrainsMono 36K）。

## 为什么不用 Google Fonts 分片方案

GF 的 CSS 按 unicode-range 把 CJK 字体切成 ~100 片/字重，整包 216 个 woff2 共 10.8MB。
优点是渲染 100% 等价；缺点是文件数爆炸，用户观感差。VF 方案每家族 1 文件，体积缩 14 倍。

## 工作流（scripts/subset_fonts.py 模板）

1. **下载 VF 原字**（一次性，缓存放 /tmp 或项目 build 目录）：
   `https://github.com/google/fonts/raw/main/ofl/<family>/<Family>[wght].ttf`
   注意 URL 转义：`NotoSerifSC%5Bwght%5D.ttf`。Playfair 需正体 + Italic 两个文件。
2. **提取字符集**：两个 HTML 去掉 `<style>/<script>`、剥标签取文本 + `data-notes`/`data-ttitle`
   属性值（讲稿！最容易漏）+ ASCII 全集 + 全角标点 + 常用符号 ≈ 1000+ 字符。
3. **子集化**（fontTools，保留 wght 轴）：
   ```
   python -m fontTools.subset <vf.ttf> --text-file=chars.txt --flavor=woff2 \
     --output-file=<out>.woff2 --layout-features=* --glyph-names --notdef-outline --no-hinting
   ```
4. **fonts.css 声明**：`font-weight: 200 900`（区间，不是单值）+ `format('woff2-variations')`；
   斜体单独一条 `font-style: italic` 的 @font-face。
5. **HTML 接线**：index.html 与 presenter.html 都 `<link href="media/fonts/fonts.css">`
   （presenter 的 `.ind` 用 JetBrains Mono，漏接则演讲者屏断网回退）。

## 验收（三层，全部必须过）

1. **零外链**：Playwright `ctx.route(/^https?:\/\//, abort)` 真断网加载，
   断言无被拦截请求 + `document.fonts.status === 'loaded'`。
   - `fonts.check(spec, TXT)` 的 spec 必须是合法 font shorthand：`italic 600 16px "Family"`，
     且 **load 与 check 用同一段文本**（CJK 懒加载，check 只对已触发加载的字符返回 true）。
   - check 只认 @font-face 字体，系统字体（Arial）恒 false，属正常跳过。
2. **字符覆盖**：逐字符 `fonts.check`，讲稿 721 字符 × 4 家族全查，0 缺失 = 无回退。
3. **像素对比**：有网（GF）vs 断网（本地 VF）同页截图 diff。视频页先
   `v.pause(); v.currentTime = min(1, duration/2)` 冻结帧，否则帧相位抖动 ~1799px 假差异。

## VF 与 GF 静态字重的固有微差（可接受，不是 bug）

在线 GF 版与本地 VF 子集像素 diff 约 0.3–3.4%。定性证据链（都验过才算数）：
- 字符覆盖 0 缺失 + fonts.check 全 true → 无字形回退；
- 所有文本元素 bounding box **高度变化全为 0** → 无折行重排（回退必改行数）；
- 漂移只出现在自动列宽表格的 x/width（≤8.5px）→ VF 插值实例与 GF 预实例化静态字的
  advance width 亚像素差。

成因：GF 静态 woff2 是预实例化字形，VF 是运行时插值 + 子集化去 hinting，栅格化必有微差。
**结论口径：几何零漂移 + 覆盖 100% = "完美复现"达标**，像素级亚阈值差不影响观感。

## Pitfalls

- `--no-hinting` 必须加：GF 线上分片本身无 hinting，保留反而引入差异。
- 斜体家族别忘：Playfair Italic 的 VF 是独立文件，混用正体插值不出斜体。
- `data-notes` 讲稿字符是最大漏字来源——只在正文中找字符，演讲者屏断网就会回退。
- 字符集宁可多勿少：ASCII 全集 + 全角标点 + 箭头符号打满，多出的字符成本按字节计可忽略。
- 文件数敏感的用户：主动报"每家族 1 文件"而不是"共 N 个分片"，先给结论再讲原理。

---
name: lecture-slides
description: 制作 HTML 课件 / Lecture Slides 的完整体系，风格唯一：04-magazine 杂志排版风（米色纸面、衬线大标题、圆角卡片 + 顶部强调线、嵌套去重），并含 Keynote 式演讲者模式（观众屏全屏 + 演讲者屏预览/文稿/双进度条，按讲稿语速估算实时对比讲课节奏，file:// 双击可用），以及字体/媒体全离线本地化（VF 子集化，任何电脑断网打开完美复现）。当用户提到"做课件""lecture slides""课件样式/风格""框体样式统一""嵌套边框重复""演讲者视图""演讲者模式""双屏放映""presenter view""双进度条""讲课节奏""杂志风/编辑风课件""字体本地化""离线打开""自包含课件"时使用。适用于任何基于 CSS class 的静态 HTML 幻灯片/模板体系。
agent_created: true
---

# Lecture Slides（04-magazine 风格课件 + 演讲者模式）

## Overview

为课件（HTML Lecture Slides）提供三大能力，均以 **04-magazine 杂志排版风**为唯一视觉标准：

- **模块 A · 版式风格**：整套 04-magazine 期刊质感——米色纸面（`#f7f2e8`）、衬线大标题（Playfair Display + Noto Serif SC）、深红强调线（`#a5281b`）；所有框体统一为「细边 + 顶部 3px 强调线 + 12px 圆角 + 柔和投影」，嵌套结构 `:is()` 双段重置规则使只有**最外层**容器带强调线
- **模块 B · 演讲者模式**：Keynote 式双屏（观众屏全屏 + 演讲者屏预览/文稿），postMessage 跨窗口同步（file:// 可用），双进度条以讲稿语速估算实时显示讲课节奏；单屏环境自动退化为正常放映
- **模块 C · 离线本地化**：字体（VF + 按课件字符集子集化，每家族 1 个 woff2，全 deck 约 0.8MB）与媒体资源（按「页号-序号」命名收编）全部内嵌，整套文件夹拷贝到任何电脑断网 file:// 双击打开，渲染与在线版一致

**不再提供其他风格**——本 skill 只输出这一种视觉体系；颜色、字体、圆角等 tokens 直接取用，不做主题适配。

## Workflow

### Step 0 — 判定模块

用户只谈版式/样式 → 仅模块 A；谈演讲者视图/双屏/节奏 → 仅模块 B；谈离线/拷给别人/字体嵌入 → 仅模块 C；完整课件交付 → 全做。

### 模块 A — 应用 04-magazine 风格

**A1 前提盘点**：确认目标课件有这些框体类（按目标体系改写选择器，其余类名保持不变）：
```
.card, .media-grid > figure, .ov-cell, .qbox, table.tbl, .stat
```
无边框素材（logo、示意图）通常是 `.plain` 修饰类——保持无边框，不处理。

**A2 整体套用**：复制 `assets/magazine-style.css` 全文为目标课件的皮肤 CSS（或并入 `<style>`），
并在 `<head>` 加载字体：
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Noto+Serif+SC:wght@600;700;900&family=Noto+Sans+SC:wght@400;500;700&family=JetBrains+Mono:wght@500&display=swap">
```

**A3 冲突清理**：删除目标原有皮肤中与本风格冲突的规则——`border-radius:0`、粗实线边框、
非衬线标题字体声明、原有配色 tokens（`--slide-bg/--ink/--accent/--card/...` 整组替换）。
类名与 DOM 结构不动，只换皮肤。

**A4 嵌套特异性原理**（改错按此推理）：
- 重置规则特异性 `(0,2,2)` 高于被重置单类规则 `(0,1,1)`——保持 `:is(祖先) :is(目标)` 双段结构
- 内层顶边设 `1px` 而非 `0`：`0` 会"三边有边一边无边"破框；目标是**四边统一细边**
- `.plain` 不需显式排除（`border-style:none` 使 width 失效，computed 归 0），但**验收脚本必须 `:not(.plain)` 排除**，否则误报

**A5 自动验收**：
```bash
NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
  node scripts/verify_nested.mjs <页面路径或URL> [--sel "<框体选择器>"] [--shot out.png]
```
断言：有框体祖先的内层全部 1px 细边；无祖先的最外层全部 3px 强调线。另核对 tokens
`--radius:12px`、`--accent` computed 为 `rgb(165, 40, 27)`。

### 模块 B — 演讲者模式

**B1 前提检查**：deck 引擎导出 `window.__deck = { go, page(), total, notes(i) }`，翻页路径末尾触发 `window.__onPage(cur)` 回调，且预览同步支持 `goto` 消息（`__hwyqSync` 协议）。**reveal.js 引擎不原生导出 `__deck`**——按 `references/reveal-adapter.md` 加适配器。

**B2 接入**：
- `assets/presenter-inject.js` → 注入放映页（`<script>` 末尾）：S 键 + `[data-act="pres"]` 按钮开窗、state/meta 上报、命令仲裁
- `assets/presenter-template.html` → 复制为放映页同目录的 `presenter.html`，替换 `__TITLE__` 为课件标题
- 课堂总长与语速按需改 deck 侧常量：`COURSE_SEC`（默认 45×60）、`CHAR_PER_MIN`（默认 220 字/分）

**B3 设计要点**（详见 `references/presenter-mode.md`）：
- 双窗口 postMessage（TAG `__hwyqPres`），命令 = hello/nav/goto/fs；state 携 page/total/notes，meta 携 durs[]（每页估时 `max(12, 字数/语速×60)` 秒）
- 布局：左列当前页大预览（flex:1）+ 双进度条面板；右列下一页小预览（height:40%）+ 演讲文稿
- 双进度条：bar1 课堂时间 fill=elapsed/45min + 讲稿累计时刻刻度层；bar2 内容进度画布=讲稿总时长，分段层当前页高亮，fill=edge/totalSec；pace 徽标 = edge − elapsed（快/慢/正常，阈值 20s）
- 自愈：800ms 幂等重发 goto 给预览 iframe（引擎同页早退）；meta 5s 重发按内容 key 去重
- 单屏退化：不开演讲者窗口即正常放映；注入 JS 在 `window.top !== window.self` 时休眠

**B4 验收**：起 HTTP 服务（服务根 = 媒体相对路径可达的目录），Playwright 断言——开窗连通（ind/notes/dot）、双窗双向翻页同步、预览 iframe 收敛、双进度条分段数/刻度数/当前段高亮跟随翻页、End 后双条分化（fillContent ≫ fillTime）、pace 徽标文案、布局尺寸；file:// 冒烟只断言父页 DOM。

### 模块 C — 离线本地化（字体 + 媒体自包含）

**C1 媒体收编**：课件目录下建 `media/{images,videos}/`，所有引用按「页号-页内序号」重命名收编；
注意 grep 外部路径要覆盖所有协议相对/绝对形式，转码临时目录（如 `../media_conv/`）是惯犯。
验收：file:// 独立加载，img/video「从未成功加载」集合为空（`requestfailed` 里的 `ERR_ABORTED`
是引擎设播放区间后的良性中止，勿计失败）。

**C2 字体本地化**：`scripts/subset_fonts.py`（模板）——VF 原字 + pyftsubset 按课件字符集
（含 `data-notes` 讲稿！）子集化，每家族 1 个 woff2；fonts.css 用 `font-weight: 200 900`
区间声明 + `format('woff2-variations')`。验收三层：零外链断网加载、逐字符
`fonts.check` 覆盖 100%、有网/断网像素对比（视频页先冻结帧）。

**C3 与在线版的固有微差**（口径）：VF 插值实例 vs GF 静态实例存在 0.3–3.4% 像素差，
属栅格化微差**不是缺陷**——判定标准是「字符覆盖 0 缺失 + 所有文本元素高度变化为 0
（无折行重排）」。完整论证与 Pitfalls 见 `references/font-offline.md`。

## Pitfalls

- **不要用 JS 逐元素加类**：纯 CSS `:is()` 祖先-后代结构即可表达"嵌套深度 ≥ 1"，零 DOM 改动
- **内层顶边不要设 0px**（见 A4）
- **颜色断言用 computed value**：`rgb(165, 40, 27)` 空格风格因浏览器而异，比对前先打印实际值
- **表格需 `overflow:hidden`** 配合圆角，否则表头背景溢出
- **file:// 不能读 iframe contentWindow**（SecurityError）——测试限制非应用缺陷，冒烟只断言父页 DOM
- **进度条宽度断言要等 transition 收敛**（fill 带 250ms transition，立即读是中间帧）
- **deck 侧消息处理必须校验 `e.source === pwin`**，防同 TAG 消息劫持
- **预览 iframe 首帧带 `#/N` hash 直达当前页**，避免闪第 1 页

## Resources

### assets/magazine-style.css
04-magazine 完整皮肤 CSS（tokens、版头、框体统一 + 嵌套重置、封面、组件规则），整段复制即用。

### assets/presenter-inject.js
模块 B 注入放映页的 JS（开窗、协议、meta 估时计算），直接复制或并入构建产物。

### assets/presenter-template.html
模块 B 演讲者窗口整页模板（`__TITLE__` 占位符），复制到放映页同目录改名 presenter.html。

### references/presenter-mode.md
演讲者模式完整设计参考：消息协议表、双进度条数学、自愈机制、布局、验收要点。

### references/reveal-adapter.md
reveal.js deck 接入演讲者模式的适配器参考（`__deck` 桥接、`__hwyqSync` 协议、iframe 键盘禁用、hash 0 基坑、英文语速校准、幂等注入标记）。

### references/font-offline.md
字体离线本地化完整参考：VF 子集化工作流、三层验收（零外链/字符覆盖/像素对比）、VF vs GF 静态字重微差的定性证据链、Pitfalls。

### scripts/verify_nested.mjs
Playwright 全页扫描验收脚本：判定每个框体元素"有无框体祖先"，断言最外层 3px 强调线 / 内层 1px 细边，输出违规清单，可选截图。

### scripts/subset_fonts.py
模块 C 字体子集化模板脚本：字符集提取（含讲稿属性）→ pyftsubset 保留 wght 轴 → fonts.css 区间声明 → HTML 接线，改 DECK/FONTS 两处配置即用。

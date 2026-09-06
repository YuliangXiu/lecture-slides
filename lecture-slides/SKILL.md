---
name: lecture-slides
description: 制作 HTML 课件 / Lecture Slides 的完整体系，风格唯一：04-magazine 杂志排版风（米色纸面、衬线大标题、圆角卡片 + 顶部强调线、嵌套去重），并含 Keynote 式演讲者模式（观众屏全屏 + 演讲者屏预览/文稿/双进度条，按讲稿语速估算实时对比讲课节奏，file:// 双击可用），字体/媒体全离线本地化（VF 子集化，任何电脑断网打开完美复现），以及质量门禁与进阶组件（媒体框宽高比审计、布局平衡/留白审计、多页递进图像素对齐、视频片段编辑器 start/end 持久化），和从 151 条真实排版反馈归纳出的默认排版规律（Layout Doctrine：媒体主角放大、卡片等比不裁剪、砌砖无缝铺满、文字窄列让位、中英对照体系、渐进揭示动画）。当用户提到"做课件""lecture slides""课件样式/风格""框体样式统一""嵌套边框重复""演讲者视图""演讲者模式""双屏放映""presenter view""双进度条""讲课节奏""杂志风/编辑风课件""字体本地化""离线打开""自包含课件""排版优化""内容堆顶部/留白""媒体框比例/宽高比""递进图对齐""视频片段/剪辑区间""排版规律""布局偏好""媒体放大/铺满""砌砖布局""图文混排"时使用。适用于任何基于 CSS class 的静态 HTML 幻灯片/模板体系。
agent_created: true
---

# Lecture Slides（04-magazine 风格课件 + 演讲者模式）

## Overview

为课件（HTML Lecture Slides）提供三大能力，均以 **04-magazine 杂志排版风**为唯一视觉标准：

- **模块 A · 版式风格**：整套 04-magazine 期刊质感——米色纸面（`#f7f2e8`）、衬线大标题（Playfair Display + Noto Serif SC）、深红强调线（`#a5281b`）；所有框体统一为「细边 + 顶部 3px 强调线 + 12px 圆角 + 柔和投影」，嵌套结构 `:is()` 双段重置规则使只有**最外层**容器带强调线
- **模块 B · 演讲者模式**：Keynote 式双屏（观众屏全屏 + 演讲者屏预览/文稿），postMessage 跨窗口同步（file:// 可用），双进度条以讲稿语速估算实时显示讲课节奏；单屏环境自动退化为正常放映
- **模块 C · 离线本地化**：字体（VF + 按课件字符集子集化，每家族 1 个 woff2，全 deck 约 0.8MB）与媒体资源（按「页号-序号」命名收编）全部内嵌，整套文件夹拷贝到任何电脑断网 file:// 双击打开，渲染与在线版一致
- **模块 D · 质量门禁与进阶组件**（固定舞台 deck）：媒体框宽高比审计（容器贴合媒体真实比例）、布局平衡审计（"内容叶子"法，消除内容堆顶/底部大留白）、多页递进图像素对齐（同一元素连续各页 rect 全等）、视频片段编辑器（✂ 按钮设定 start/end，localStorage 持久化按片段播放）、final_accept 全链路 E2E
- **模块 E · 默认排版规律（Layout Doctrine）**：从 151 条真实排版反馈归纳出的**强制默认布局偏好**——媒体主角放大（≥80% 高度）、卡片等比不裁剪、砌砖无缝铺满、文字窄列让位（≤1/3 宽）、元素网格对齐咬合、中英对照体系、头像卡 80%、渐进揭示动画、稀疏页删除。**任何新建/修改课件页面时默认按此规律排版**，除非用户当次明确要求例外。

**不再提供其他风格**——本 skill 只输出这一种视觉体系；颜色、字体、圆角等 tokens 直接取用，不做主题适配。**排版行为同样不再逐次摸索**——模块 E 是默认行为，第一版排版就要符合。

## Workflow

### 视频素材下载（前置，涉及外部视频链接时必做）

当课件页面需要引入 YouTube 或 Bilibili 视频素材时，先调用 `video-download` skill（前置依赖）把视频下载到本地 `03-slides/media/decks/session-N/videos/`，再接入 deck（`<video data-vid>` + `video_config`）。**默认行为（用户 2026-09-06 指定）：只要用户给出 YouTube/Bilibili 链接就自动下载到本地，无需确认；只有全部方案失败才上报并保留 iframe 兜底。** 禁止直接用 YouTube/Bilibili iframe 嵌页面——破坏离线自包含（模块 C），观众断网打不开。

### Step 0 — 判定模块

用户只谈版式/样式 → 仅模块 A；谈演讲者视图/双屏/节奏 → 仅模块 B；谈离线/拷给别人/字体嵌入 → 仅模块 C；谈排版优化/留白/媒体框比例/递进图对齐/视频片段 → 模块 D；**新建课件页面 / 生成第一版讲义页 / 未指定排版要求时 → 默认套用模块 E 的 Layout Doctrine**；完整课件交付 → 全做（E 默认生效，D 负责验收）。

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
NODE_PATH=<含 playwright 的 node_modules 所在目录> \
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

### 模块 D — 质量门禁与进阶组件（固定舞台 deck）

适用 1920×1080 固定舞台引擎（`.deck-stage` transform 缩放、`.slide` 切换、`VIDEO_CONFIG` 视频区间、`window.__deck`）。

**D1 媒体框宽高比审计**：`scripts/audit_aspect.mjs <deck_dir>`——Playwright 逐页读
img `naturalWidth/Height`、video `videoWidth/Height` vs 容器（`.fv`）渲染比例，
mismatch = max(r1/r2, r2/r1)，阈值 1.12。症状 = `object-fit:contain` 下深色底露边。
修复三板斧：`.fv` 加 `aspect-ratio` / `figure` 设 `flex:none` + 显式宽 / 横版堆叠页把
media-grid 改 `column` 方向。横版媒体用横向框；同页多尺寸媒体允许但至少一轴对齐。

**D2 布局平衡审计**：`scripts/audit_layout.mjs`——**只测"内容叶子"**（直接含文字节点的
元素 + img/video/svg/canvas）的实际边界；容器 div 全撑满 1080 无区分度，测它必得全 1080
假象。content 页目标 bottom ≥880（≤18% 底部留白）；封面/结尾居中设计页除外。同一脚本
输出文字连段（≥3 页无媒体 run）与 top-crowded 清单，用于多媒体节奏排查。

**D3 多页递进图像素对齐**：同一元素出现在连续多页时位置必须完全一致——图片
`position:absolute` 于 1920×1080 舞台坐标系，四页同值；验收 = `getBoundingClientRect`
÷ stage scale 逐页比对 rect 全等（scrollHeight 无效，section 高度 auto）。若源参考图
恰为 1920×1080 渲染图，按源 box 归一化坐标 ×1920×1080 直接换算像素框后统一裁剪。

**D4 视频片段编辑器**：完整设计见 `references/segment-editor.md`——✂ 按钮（opacity .18
**常驻可点**）→ 模态面板（起止秒 + 取当前画面 + 保存/恢复默认）；localStorage
`dhseg::<pathname>::<vidKey>` 覆盖 VIDEO_CONFIG；引擎原有 timeupdate 钳制自动生效。
E2E 脚本 `scripts/test_segeditor.mjs`（14 项）。

**D5 终验**：离线零外链（拦截所有非 localhost http(s) 请求）+ 控制栏交互 + presenter
双屏连通 + 片段编辑器冒烟，一次性全链路 E2E。

### 模块 E — 默认排版规律（Layout Doctrine，强制默认）

> 来源：`lecture-01-introduction` 课程 151 条已解决的排版反馈（2026-08~09，六轮 polish 定稿）+ 最终代码形态核验（S2.05/S2.06/S2.28/S3.06/S3.12d/S3.15/Failure Gallery）。以下规则是**用户排版审美的默认值**——生成任何新页面时直接按此排版，第一版就要符合，不逐次试探。频率最高的不满词是"太空了"；频率最高的指令是"铺满/撑满/拉满/等宽/对齐/不裁剪"。

**E1 媒体主角原则（图/视频优先于文字）**
- 页面只要含媒体，媒体就是视觉主体。目标高度 ≥80% 可用 body 高度（多图 90–100%），横版大图直接 100% height。
- 文字一律退居窄列：图文页文字列占 **1/4–1/3 宽度**（flex 0.5–0.8，或固定 ~240px），媒体列 flex 1.2–1.5。文案再多也不许与媒体抢版面——宁可删字、加页，不放大文字列。
- 用户原话反复出现："把左边的文字挤得窄一点""右边的文字可以窄一点""文字部分 width 可以窄一点"。

**E2 卡片贴合媒体，绝不裁剪（aspect-locked, never crop）**
- 每个媒体卡片 `aspect-ratio` = 媒体原始宽高比；img/video 一律 `object-fit:contain`，**完整画幅**。"不要做任何 cropping"出现 10+ 次；视频"全部画幅都需要显示出来"。
- 禁止把媒体 crop 成统一尺寸/正方形再硬塞；禁止统一样式的卡片尺寸，卡片形状跟随媒体。
- 同行媒体**等高、宽度按比例自然各异**（S2.08#2："每张照片设置同样的高度，但未必要设置同样的宽度"）。

**E3 砌砖/网格铺满，无缝隙矩形（multi-media pages）**
- 多图页 = justified/masonry 砌砖式：同行等高、行与行上下边缘对齐、整体拼成**左右边都对齐的无缝矩形**（用户原话："所有图片之间可以拼的没有缝隙，最后所有图片放到一起可以形成一个上下左右边都对齐的矩形"）。
- 实现：N 列 grid（如 20 列）+ 每图 `grid-column: span 变宽` + 小 gap（12–28px）+ `align-content:center`。每图 media 框 `aspect-ratio` 跟随原图。
- 错落有致（素材库排版"上面两个，下面三个"）同属此原则；图不够就**补图**（网搜/素材库），不硬撑版面。

**E4 元素网格对齐与互相咬合（alignment）**
- 图文页各元素**顶部对齐 + 底部对齐**：文字卡片下边缘与媒体下边缘对齐；同列卡片等宽；文字区总高 = 媒体区总高（S1.09#2："右边两处文字总的高和左边图像卡片的高是一样的"）。
- 左文右图 / 左图右文是默认骨架；文字块内部垂直分布用 `justify-content:center` 填满。
- 表格页：table 撑满可用宽度，行高放宽（td padding ≈ 23px 18px），多栏 `justify-content:space-between`（S3.12d 定稿值）。

**E5 填满空间，不留空洞**
- 页面任何区域不许有大块空白——这是用户最高频的否决理由（"太空了"出现 6+ 页次）。
- 空卡片三解法：①拆成小卡片 + 动画逐个出现（S3.18）；②填入相关媒体（S3.14/S1.30/S2.24）；③放大文字/行距填满（S2.02#2）。
- 文字卡片大而空 → 内部 `justify-content:center` + 加大字号填充。

**E6 中英对照体系（bilingual system）**
- 标题：英文主标题 + **破折号或括号**加中文（同字号同字体，颜色可区分）。
- 术语注释：放页面**固定位置（默认左下角）的小文本卡片**做中英对照；**禁止把中文插进英文标题/正文行内**（用户原话："这个中文插入的方式的字体非常非常难看，一点都不协调"）。
- 名言/引用卡：正文英文，卡片下方补一行中文翻译（如"读史可以知兴替"）。

**E7 头像卡 80%（avatar cards）**
- 人物头像在卡片内占 **约 80% 面积**、居中放大；多人头像 + logo 整体在页面居中排布（logo 可跨行）。

**E8 渐进揭示动画（progressive reveal）**
- 卡片/图片**一张一张随 Next/↓ 出现**是默认叙事手段（S1.06#2/S3.07/S3.18/S1.12#2 一致要求）。
- 媒体替换场景：新出现元素**继承被替换元素的尺寸**（S1.16#2："这个视频的尺寸应该和这个文本框一样"）；惊喜型揭示 = 先出内容、再出人物大头照（S2.09）。

**E9 视频行为（video behavior）**
- 自动播放 + 循环；视频卡片 `aspect-ratio` = 原视频、完整画幅 contain；Next 可切换视频（尺寸继承）。

**E10 稀疏页果断处理（kill sparse pages）**
- 内容单薄的页面**直接删除或合并**，不硬撑（历史反馈删页 12 次）。宁精炼勿稀疏。

**E11 布局默认参数速查**（直接取用，不再试错）
| 场景 | 默认参数 |
| --- | --- |
| 图文混排 | 文字列 flex 0.5–0.8（≤1/3 宽）；媒体 ≥80% 高度 |
| 多图砌砖 | N 列 grid + span 变宽 + gap 12–28px；同行等高、整体无缝矩形 |
| 媒体卡片 | `aspect-ratio` = 媒体原比例；`object-fit:contain`；永不 crop |
| 元素对齐 | 顶部+底部双对齐；同列等宽；卡片下缘与媒体下缘对齐 |
| 表格 | td padding 23px 18px；`justify-content:space-between` |
| 头像卡 | 头像占卡片 80% 面积、居中 |
| 中文注释 | 左下角小卡片中英对照；标题破折号/括号附中文 |
| 动画 | 卡片逐个 Next 出现；替换元素继承尺寸 |

## Pitfalls

- **不要用 JS 逐元素加类**：纯 CSS `:is()` 祖先-后代结构即可表达"嵌套深度 ≥ 1"，零 DOM 改动
- **内层顶边不要设 0px**（见 A4）
- **颜色断言用 computed value**：`rgb(165, 40, 27)` 空格风格因浏览器而异，比对前先打印实际值
- **表格需 `overflow:hidden`** 配合圆角，否则表头背景溢出
- **file:// 不能读 iframe contentWindow**（SecurityError）——测试限制非应用缺陷，冒烟只断言父页 DOM
- **进度条宽度断言要等 transition 收敛**（fill 带 250ms transition，立即读是中间帧）
- **deck 侧消息处理必须校验 `e.source === pwin`**，防同 TAG 消息劫持
- **预览 iframe 首帧带 `#/N` hash 直达当前页**，避免闪第 1 页
- **悬停显现的按钮（`opacity:0; pointer-events:none`）不可交互**：Playwright hit-target 检测在鼠标移动前就失败，触屏也不可用——用常驻低透明度（.18）+ hover 加深
- **本地 HTTP server 必须 run_in_background 持久启动**：普通命令里 `cmd &` 会随 shell 退出被回收，下一条命令连接被拒
- **云同步目录（如 OneDrive）文件首次 HTTP 访问可能 404（按需水合延迟）**：重试即可，勿误判文件缺失
- **BSD grep 的 `\|` 交替静默失败**：用 `grep -E`；验证文案存在与否的正则要宽松，过严会把已落地内容误报为缺失（先读原文再定论）
- **模块 E 是默认值不是可选项**：新建页面时直接按 Layout Doctrine 排版，不要先做"常规布局"再等用户反馈改——用户对此类反复调整的成本已明确表达过不满。唯一例外：用户当次指令明确要求不同做法
- **"填满"与"不裁剪"冲突时的优先级**：先保 `object-fit:contain` 完整画幅（E2），再通过补图/补媒体把空间填满（E5），绝不靠 crop 或拉伸变形来凑满

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

### references/segment-editor.md
模块 D 视频片段编辑器完整参考：localStorage 数据模型（`dhseg::<pathname>::<vidKey>`）、✂ 按钮与模态面板交互链路、键盘/滚轮接管、样式要点、14 项 E2E 清单。

### scripts/audit_aspect.mjs
媒体框宽高比审计（`node audit_aspect.mjs <deck_dir>`）：img/video 原始比例 vs `.fv` 容器渲染比例，阈值 1.12，输出失配清单。

### scripts/audit_layout.mjs
布局平衡审计：内容叶子边界（content 页目标 bottom ≥880）+ 文字连段 + top-crowded 清单。

### scripts/test_segeditor.mjs
视频片段编辑器 14 项 E2E（按钮/面板/保存/持久化/钳制/翻页存活/重置/键盘封锁）。

### scripts/verify_nested.mjs
Playwright 全页扫描验收脚本：判定每个框体元素"有无框体祖先"，断言最外层 3px 强调线 / 内层 1px 细边，输出违规清单，可选截图。

### scripts/subset_fonts.py
模块 C 字体子集化模板脚本：字符集提取（含讲稿属性）→ pyftsubset 保留 wght 轴 → fonts.css 区间声明 → HTML 接线，改 DECK/FONTS 两处配置即用。

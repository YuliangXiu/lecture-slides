---
name: lecture-slides
description: 制作 HTML 课件 / Lecture Slides 的完整体系，风格唯一：04-magazine 杂志排版风（米色纸面、衬线大标题、圆角卡片 + 顶部强调线、嵌套去重），并含 Keynote 式演讲者模式（观众屏全屏 + 演讲者屏预览/文稿/双进度条，按讲稿语速估算实时对比讲课节奏，file:// 双击可用），字体/媒体全离线本地化（VF 子集化，任何电脑断网打开完美复现），以及质量门禁与进阶组件（媒体框宽高比审计、布局平衡/留白审计、多页递进图像素对齐、视频片段编辑器 start/end 持久化），和从 151 条真实排版反馈归纳出的默认排版规律（Layout Doctrine：媒体主角放大、卡片等比不裁剪、砌砖无缝铺满、文字窄列让位、中英对照体系、渐进揭示动画）。当用户提到"做课件""lecture slides""课件样式/风格""框体样式统一""嵌套边框重复""演讲者视图""演讲者模式""双屏放映""presenter view""双进度条""讲课节奏""杂志风/编辑风课件""字体本地化""离线打开""自包含课件""排版优化""内容堆顶部/留白""媒体框比例/宽高比""递进图对齐""视频片段/剪辑区间""排版规律""布局偏好""媒体放大/铺满""砌砖布局""图文混排""卡片编辑器""改卡片/移动卡片""删卡片""缩放卡片""替换媒体""裁剪媒体""四角控件""编辑课件元素""cardmove/cardresize/carddel""slide-edits 落盘""部署发布""媒体瘦身/压缩""视频裁剪""图片转 webp""trims.json""04-deploy 镜像""source 不动 deploy 裁剪""学生版发布到主页""COS 发布""build_publish""多屏路由""双屏窗口落位""看片台""缩略图""元素序号标注""#序号 定位""放映服务""cue-cards""cue 卡片""q 字段""本页在回答什么问题""逐字稿处理""cue_q_check""cue_q_apply""q 覆盖率"时使用。适用于任何基于 CSS class 的静态 HTML 幻灯片/模板体系。
agent_created: true
---

# Lecture Slides（04-magazine 风格课件 + 演讲者模式）

## Overview

为课件（HTML Lecture Slides）提供三大能力，均以 **04-magazine 杂志排版风**为唯一视觉标准：

- **模块 A · 版式风格**：整套 04-magazine 期刊质感——米色纸面（`#f7f2e8`）、衬线大标题（Playfair Display + Noto Serif SC）、深红强调线（`#a5281b`）；所有框体统一为「细边 + 顶部 3px 强调线 + 12px 圆角 + 柔和投影」，嵌套结构 `:is()` 双段重置规则使只有**最外层**容器带强调线
- **模块 B · 演讲者模式**：Keynote 式双屏（观众屏全屏 + 演讲者屏预览/文稿），postMessage 跨窗口同步（file:// 可用），双进度条以讲稿语速估算实时显示讲课节奏；单屏环境自动退化为正常放映。多屏窗口落位（观众 deck 去扩展屏、presenter/逐字稿去鼠标所在屏）见 B5 与 `references/multi-screen-routing.md`
- **模块 C · 离线本地化**：字体（VF + 按课件字符集子集化，每家族 1 个 woff2，全 deck 约 0.8MB）与媒体资源（按「页号-序号」命名收编）全部内嵌，整套文件夹拷贝到任何电脑断网 file:// 双击打开，渲染与在线版一致
- **模块 D · 质量门禁与进阶组件**（固定舞台 deck）：媒体框宽高比审计（容器贴合媒体真实比例）、布局平衡审计（"内容叶子"法，消除内容堆顶/底部大留白）、多页递进图像素对齐（同一元素连续各页 rect 全等）、视频片段编辑器（✂ 按钮设定 start/end，localStorage 持久化按片段播放）、final_accept 全链路 E2E
- **模块 E · 默认排版规律（Layout Doctrine）**：从 151 条真实排版反馈归纳出的**强制默认布局偏好**——媒体主角放大（≥80% 高度）、卡片等比不裁剪、砌砖无缝铺满、文字窄列让位（≤1/3 宽）、元素网格对齐咬合、中英对照体系、头像卡 80%、渐进揭示动画、稀疏页删除。**任何新建/修改课件页面时默认按此规律排版**，除非用户当次明确要求例外。
- **模块 F · PPT 卡片编辑器（02-script 编辑器）**：讲师在预览 iframe 里对**卡片**（figure 整卡）做移动 / 删除 / 缩放 / 裁剪 / 替换，四角常驻控件 + 左下放射菜单，保存后经 `slide-edits.json` journal 落盘、重建镜像重放。完整设计见 `references/card-editor.md`。
- **模块 G · 部署发布与媒体瘦身（04-deploy 双轨）**：03-slides = 权威完整源永不改动，04-deploy = 唯一可裁部署镜像。视频裁剪（`trims.json` 登记 + `apply_trims.py`）、未裁剪原片二压瘦身（`slim_videos.py`）、图片转 WebP（`slim_images.py`）、学生网页播放版发布到主页（`build_publish.py`）。完整设计见 `references/deploy-slimming.md`。
- **模块 H · 02-script 工作台配套**：逐字稿编辑工作台的日常工具——元素序号标注（意见写 `#序号` 定位）、看片台（76 页缩略图网格 + 跨 Session 拖拽重排）、缩略图管线（shoot_thumbs 三模式 + 增量 since-solved）、放映服务版本提示（postJSON）。完整设计见 `references/workbench-tools.md`。

**不再提供其他风格**——本 skill 只输出这一种视觉体系；颜色、字体、圆角等 tokens 直接取用，不做主题适配。**排版行为同样不再逐次摸索**——模块 E 是默认行为，第一版排版就要符合。

## Workflow

### 视频素材下载（前置，涉及外部视频链接时必做）

当课件页面需要引入 YouTube 或 Bilibili 视频素材时，先调用 `video-download` skill（前置依赖）把视频下载到本地 `03-slides/media/decks/session-N/videos/`，再接入 deck（`<video data-vid>` + `video_config`）。**默认行为（用户 2026-09-06 指定）：只要用户给出 YouTube/Bilibili 链接就自动下载到本地，无需确认；只有全部方案失败才上报并保留 iframe 兜底。** 禁止直接用 YouTube/Bilibili iframe 嵌页面——破坏离线自包含（模块 C），观众断网打不开。

### Step 0 — 判定模块

用户只谈版式/样式 → 仅模块 A；谈演讲者视图/双屏/节奏 → 仅模块 B；谈多屏窗口落位（观众 deck 去扩展屏、presenter 去主屏）→ 模块 B5；谈离线/拷给别人/字体嵌入 → 仅模块 C；谈排版优化/留白/媒体框比例/递进图对齐/视频片段 → 模块 D；**新建课件页面 / 生成第一版讲义页 / 未指定排版要求时 → 默认套用模块 E 的 Layout Doctrine**；谈编辑课件元素/移动删除缩放卡片/替换裁剪媒体 → 模块 F；谈部署/媒体瘦身/视频裁剪/图片转 webp/发布到主页/学生版 → 模块 G；谈元素序号标注/看片台/缩略图/放映服务 → 模块 H；完整课件交付 → 全做（E 默认生效，D 负责验收）。

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
- 布局：左列当前页大预览（flex:1）+ 双进度条面板；右列演讲文稿占满整列（备注滚动默认关，点「滚动」开关手动开启）
- **备注区自适应字号**：每页二分搜索字号使内容高度落在容器可用高度的 80%（clamp 20–36px，行高 1.6，间距全用 em）；触顶页把富余迭代分摊到 `--cue-pad`/`--cue-gap`，空档落在句间与起承转合之间。必须测内层包裹元素的 `offsetHeight`，`scrollHeight` 会被钳制导致误判。算法全文与 5 条 Pitfalls 见 `references/presenter-mode.md`
- 备注区可选承载 **cue-cards**（演讲提示卡）替代逐字稿：deck 侧 fetch `02-script/data/cuecards.json` 按 `sections[].slides[].id` 平铺成 `__cueFlat`，`state()` 带 `cue` 转发；presenter 侧 `apply()` 第 6 参优先渲染 cue，默认英文、L 键切换、localStorage 记忆
- 双进度条：bar1 课堂时间 fill=elapsed/45min + 讲稿累计时刻刻度层；bar2 内容进度画布=讲稿总时长，分段层当前页高亮，fill=edge/totalSec；pace 徽标 = edge − elapsed（快/慢/正常，阈值 20s）
- 自愈：800ms 幂等重发 goto 给预览 iframe（引擎同页早退）；meta 5s 重发按内容 key 去重
- 单屏退化：不开演讲者窗口即正常放映；注入 JS 在 `window.top !== window.self` 时休眠

**B4 验收**：起 HTTP 服务（服务根 = 媒体相对路径可达的目录），Playwright 断言——开窗连通（ind/notes/dot）、双窗双向翻页同步、预览 iframe 收敛、双进度条分段数/刻度数/当前段高亮跟随翻页、End 后双条分化（fillContent ≫ fillTime）、pace 徽标文案、布局尺寸；file:// 冒烟只断言父页 DOM。

**B5 多屏窗口路由**：双击 `play.command` 放映时把三窗口自动落对屏幕——观众 deck 去扩展屏、presenter 与逐字稿去**鼠标所在屏**。要点：主屏 = 鼠标所在屏（非系统主屏语义）；Cocoa↔窗口坐标翻转换算 `y窗口 = H-(y+h)`；`pv*` 传参链（`?pvx/pvy/pvw/pvh` → `pvTarget()` → `routeToPrimary()/fitTarget()`）；TCC 自动化权限（沙箱内只能 `bash -n` + `osacompile` 编译验证，真实落位需用户真机双击验收）。完整设计见 `references/multi-screen-routing.md`。

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

> 来源：真实课程项目 151 条已解决的排版反馈（2026-08~09，六轮 polish 定稿）+ 最终代码形态核验（S2.05/S2.06/S2.28/S3.06/S3.12d/S3.15/Failure Gallery）。以下规则是**用户排版审美的默认值**——生成任何新页面时直接按此排版，第一版就要符合，不逐次试探。频率最高的不满词是"太空了"；频率最高的指令是"铺满/撑满/拉满/等宽/对齐/不裁剪"。

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

### 模块 F — PPT 卡片编辑器（02-script 编辑器）

讲师在 `02-script/index.html` 点铅笔按钮进入编辑态，在预览 iframe 内直接编辑**卡片**。卡片 = figure 整卡（黑底 `.fv` + 视频 + 白字 `figcaption` 是一个不可拆分整体），四角常驻控件：`tl` ✥ 移动 / `tr` ✕ 删卡 / `br` ✛ 缩放 / `bl`「编辑多媒体」组合 SVG 弹放射菜单。保存走 `slide-edits.json` journal，重建时 deck_builder 镜像重放，结果与编辑器保存一致。

**核心规则（改动前必读，完整设计见 `references/card-editor.md`）**：

- **卡片根上溯**：从媒体向上沿「连续卡片链」取最外层 figure；兄弟检查只看「含可见媒体的兄弟」（figcaption 白底是卡内容不阻断）。后端按「最内层包含媒体的 figure」定位，前后端一致。
- **缩放 = 宽高完全独立**：dx/dy 分别驱动 w/h；媒体 `width/height:100% + object-fit:cover + object-position:50% 50%` → 以卡片 height 为基准等比、锁定原始宽高比、超宽时水平中轴对称裁剪；文字 `font-size × (h/h0)`。
- **flex-basis 吞宽度**：`.media-grid figure { flex:1 1 0 }` 的 basis:0px 优先于内联 width，必须先 `flex:0 0 auto`（拖动实时 + 退出裁剪 reseize + 后端落盘三处都要）。
- **四角防重叠三层**：卡内偏移 8px + 并查集连通分量档位（8/34/60/86px）+ 同卡上下两排硬约束 `off ≤ (minSide−48)/2`；minSide<70 时控件 scale(0.66)。
- **落盘 op 语义**：`cardmove{left,top}` / `carddel` / `cardresize{w,h,fs}` / `crop{ox,oy,zoom}` / `replace{src}`，绝对值幂等；`index` 是同标签局部序号（非混合序号）。Esc 退出不落盘。

### 模块 G — 部署发布与媒体瘦身（04-deploy 双轨）

完整设计见 `references/deploy-slimming.md`。核心契约：

- **两条铁律**：① 03-slides = 权威完整源，视频不裁剪、deck HTML 不改、VIDEO_CONFIG 数值不改，✂ 标记只登记进 `03-slides/media/trims.json`；② 04-deploy = 唯一可裁部署镜像，所有物理裁剪与 VIDEO_CONFIG 改写只发生在这里。
- **四个执行器（职责不重叠，均默认 dry-run，`--apply` 才动手）**：
  - `04-deploy/apply_trims.py` — 按 trims.json 物理裁剪 confirmed 视频 + 改写镜像 VIDEO_CONFIG（`0..新时长`）
  - `tools/slim_videos.py` — 未裁剪高码率原片二压瘦身（CRF24），与裁剪互补不重叠
  - `tools/slim_images.py` — gif→animated WebP、png→WebP，改写 04-deploy 的 index.html 引用
  - `tools/build_publish.py` — 从 04-deploy 生成学生网页播放版（COS 绝对 URL + presenter/✂ 禁用），发布到主页 repo
- **统一质量档位**：`libx264 CRF 24 + preset medium + yuv420p + -c:a copy + -movflags +faststart`，保证未裁剪原片与已裁剪片段在同一视觉质量带。
- **放映链路**：本地双击课程根 `play.command`（服务根 = 课程根），自动打开的观众 deck 用 `/03-slides/session-N/`（2026-09-09 起，含 `?pvx/pvy/pvw/pvh` 多屏定位），**不是** `/04-deploy/`；04-deploy 仅作发布用裁剪镜像。**必须由课程根 serve**，别把 03-slides / 04-deploy 单独当 server 根（否则 notes 404）。
- **重建镜像后重放**：03-slides 变动 → rsync 重建 04-deploy → 重跑 apply_trims + slim_images + slim_videos → build_publish。全程幂等，重复运行安全。

### 模块 H — 02-script 工作台配套

讲师打磨课件的日常工具，都落在 `02-script/index.html` + `play.command`，与模块 F（卡片编辑器）同属「编辑工作台」体系。完整设计见 `references/workbench-tools.md`：

- **元素序号标注（elnum）**：聚焦 `textarea[data-fb="ppt"]` 时同源 iframe 当前页元素叠加序号徽标，意见写 `#序号` 指认；`elnumCollect` 折叠规则决定「什么算一个可指认单元」，历史推断只改徽标配色不改编号。
- **看片台（board）**：76 页缩略图一屏网格 + 跨 Session 拖拽重排，保存走 `/api/reorder-slides` → 重建 deck → 自动回看片台。
- **缩略图管线（shoot_thumbs.cjs）**：sid 寻址 + `#/K/99` 直达最终展开态；三模式 `full` / `missing` / `since-solved`（增量，依赖 `resolved_at` 时间戳）；子进程必须注入 `NODE_PATH`。
- **放映服务版本提示（postJSON）**：放映服务是旧 Python 进程时新路由回 404 HTML，`res.json()` 解析报晦涩错误——前端须对非 JSON 响应做「请重新双击 play.command」提示。

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
- **云同步目录文件首次 HTTP 访问可能 404（按需水合延迟）**：重试即可，勿误判文件缺失
- **BSD grep 在 macOS 上对含中文的多模式搜索会静默返回空**：`\|` 交替尤甚，已三次导致误判「内容缺失」。**核查一律用 Python `str.count()`/逐行匹配**，至少也要 `grep -E`/`grep -F`；不要用裸 `grep -n "a\|b"`。验证文案存在与否的正则要宽松，过严会把已落地内容误报为缺失（先读原文再定论）
- **模块 E 是默认值不是可选项**：新建页面时直接按 Layout Doctrine 排版，不要先做"常规布局"再等用户反馈改——用户对此类反复调整的成本已明确表达过不满。唯一例外：用户当次指令明确要求不同做法
- **"填满"与"不裁剪"冲突时的优先级**：先保 `object-fit:contain` 完整画幅（E2），再通过补图/补媒体把空间填满（E5），绝不靠 crop 或拉伸变形来凑满
- **同文件多处修改严禁并行 Edit**（云同步目录双写竞争）：多个并行 Edit 各持旧快照整文件回写、后完成者胜，前面的编辑静默丢失。同文件多处改必须串行；改完 diff 文件实际状态再下结论，别只信「编辑已成功返回」
- **E2E 断言查视觉值（getBoundingClientRect）而非仅内联值**：flex-basis / transform 等会让内联 `style.*` 落下但视觉不变，只断言内联值会假通过
- **getBoundingClientRect 返回 transform 后视觉盒**：stage scale 缩小不改变元素中心；计算「两控件是否重叠/相距多远」要用视觉值，别用布局值
- **「某按钮没显示」先 dump DOM 判断是否真未渲染**：常见根因是坐标/层级重叠（后被渲染的兄弟盖住它），不是条件判断/样式/事件绑定问题
- **改写 VIDEO_CONFIG 后必须抽块 `node --check`**（模块 G）：正则 group 已含花括号时替换内容绝不能自带 `{}`，否则叠成 `{{...}}` 双括号，JS 对象字面量直接 SyntaxError 打崩整页。只 grep 目标数字会漏掉这类结构错误
- **裁剪/瘦身产物只落 04-deploy**（模块 G）：任何 `.slim.mp4` / `.trimming.mp4` / `.orig.mp4` / `.webp` 都不该出现在 03-slides——03-slides 是回退的干净源
- **双视图剪辑存档键必须归一化**（模块 D4）：`SEG_STORE` 用 `location.pathname` 生成，观众窗口（`…/session-N/`）与演讲者预览 iframe（`…/session-N/index.html`）会生成两个不同键，剪辑不互通。必须 `normPath()` 归一化 + `migrateSegKeys()` 旧键迁移 + `storage` 事件监听（非写入方即时 `setupVideos()` + seek + `playVideos()`）。详见 `references/segment-editor.md` 关联坑
- **自起服务加接口必须做非 JSON 版本提示**（模块 H）：`play.command` 这类脚本自起服务的旧 Python 进程「静态文件即时生效、进程不会」，新路由回 404 HTML 被 `res.json()` 解析报 `Unexpected token '<'`。前端统一 `postJSON` 封装，响应 `Content-Type` 非 JSON → 提示「放映服务是旧版本，请重新双击 play.command」
- **GIF→WebP 用 Pillow 必须逐帧收集 duration**（模块 G）：Pillow 12 的 `WebPImagePlugin._save_all` 只在打开时读一次 duration，不传 list 会全帧压成第一帧时长（总时长漂移）。逐帧收集 `gd=[im.info["duration"]...]` 后 `save(..., duration=gd, loop=0, method=6, quality=80)`；libwebp 会合并「逐像素等于前一帧」的 hold 重复帧，容器帧数可能少于源 GIF——是合并不是丢帧
- **Playwright `page.evaluate(fnString, arg)` 不会自动调用字符串函数**（模块 H）：必须传真函数值或 IIFE 字符串，否则拿到的只是函数体文本

## Resources

### assets/magazine-style.css
04-magazine 完整皮肤 CSS（tokens、版头、框体统一 + 嵌套重置、封面、组件规则），整段复制即用。

### assets/presenter-inject.js
模块 B 注入放映页的 JS（开窗、协议、meta 估时计算），直接复制或并入构建产物。

### assets/presenter-template.html
模块 B 演讲者窗口整页模板（`__TITLE__` 占位符），复制到放映页同目录改名 presenter.html。

### references/presenter-mode.md
演讲者模式完整设计参考：消息协议表、双进度条数学、自愈机制、布局、验收要点、cue-cards `q` 字段语义与格式硬约束。

### references/cue-q-workflow.md
cue-cards `q` 字段（「本页在回答什么问题」）补写全流程：L1 范式校准、分片写 patch、`cue_q_check.py` 门禁词表、`cue_q_apply.py` 合并、三链路 e2e、`save-feedback` 501 假阳性与零副作用还原、Pitfalls。

### references/reveal-adapter.md
reveal.js deck 接入演讲者模式的适配器参考（`__deck` 桥接、`__hwyqSync` 协议、iframe 键盘禁用、hash 0 基坑、英文语速校准、幂等注入标记）。

### references/font-offline.md
字体离线本地化完整参考：VF 子集化工作流、三层验收（零外链/字符覆盖/像素对比）、VF vs GF 静态字重微差的定性证据链、Pitfalls。

### references/segment-editor.md
模块 D 视频片段编辑器完整参考：localStorage 数据模型（`dhseg::<pathname>::<vidKey>`）、✂ 按钮与模态面板交互链路、键盘/滚轮接管、样式要点、14 项 E2E 清单。

### references/card-editor.md
模块 F PPT 卡片编辑器完整设计：卡片语义（figure 整卡 + 链式上溯）、四角控件、防重叠三层、放射状 1/4 扇形菜单、宽高独立缩放与 flex-basis 根因、裁剪/替换、落盘 op 语义、E2E 验证与调试教训。

### references/deploy-slimming.md
模块 G 部署发布与媒体瘦身完整设计：03-slides/04-deploy 双轨与两条铁律、trims.json schema、四个执行器（apply_trims / slim_videos / slim_images / build_publish）职责边界、放映链路、重建镜像重放 procedure、实战陷阱。

### references/multi-screen-routing.md
模块 B5 多屏窗口路由完整设计：主屏 = 鼠标所在屏语义、Cocoa↔窗口坐标翻转换算、JXA 读屏探测协议、`pv*` 传参链、presenter 双层主屏路由、TCC 自动化权限限制、竖屏适配、构建链与验收 marker。

### references/workbench-tools.md
模块 H 02-script 工作台配套完整设计：元素序号标注（elnumCollect 折叠规则 + 历史推断）、看片台（76 页网格 + 跨 Session 重排 + reorder-slides API）、缩略图管线（shoot_thumbs 三模式 + since-solved 增量 + NODE_PATH 坑）、放映服务版本提示（postJSON）。

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

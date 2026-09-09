---
name: lecture-deck-pipeline
description: HTML 课件构建流水线——用固定舞台引擎（1920×1080 缩放 + section 切换）从 Python 内容模块构建每讲多套离线 HTML 课件，配逐字稿 JSON 单一数据源、演讲者视图与放映启动器。当需要新建或迭代某一讲（Lecture N）的 session 课件（deck）、逐字稿对照页，或修复课件引擎/讲稿加载/放映启动器问题时使用。触发词：做课件、建 deck、改课件、新讲义、slides 重建、notes 不显示、play.command、deck_builder。
agent_created: true
---

# Lecture Deck Pipeline（课件构建流水线）

## Overview

用固定舞台引擎（1920×1080 `.deck-stage` transform 缩放 + `.slide` section 切换）从 Python 内容模块构建每讲多套离线 HTML 课件，配逐字稿 JSON 单一数据源、presenter 演讲者视图与 play.command 放映启动器。

**引擎与构建器提层到课程根 `_shared/` 后，各讲不再自带副本**：

| 位置 | 角色 |
|---|---|
| `_shared/deck-engine/` | 引擎资产（engine.js / style.base.css / presenter.html / presenter-inject.js / sync.js / controls.html / check_deck.mjs / final_accept.mjs / AUTHORING.md） |
| `_shared/build/` | 构建器（deck_builder.py / reorder_deck.py / gen_deckmeta.py） |
| `_shared/skins/lecture-NN.css` | 各讲差异样式层（按讲可选） |
| `_shared/tools/shoot_thumbs.cjs` | 缩略图拍摄（Playwright） |
| `_shared/viewer/` | 逐字稿工作台模板（`02-script/index.html` 由它渲染） |

新讲搭工作区时，`01-framework/` 下放**符号链接**指向 `_shared/deck-engine/`，而不是复制文件。

## 目录约定（勿混淆）

| 位置 | 角色 |
|---|---|
| `<课程根>/` | **权威交付**，零 .bak，最终产物只在此 |
| `<课程根>/_shared/` | **唯一权威引擎 + 构建器**（跨讲共享） |
| `<备份目录>/` | 所有备份（保留相对路径） |
| `<备份目录>/refactor-*/…-archive/` | 旧框架归档（**只读历史，勿再引用**） |
| `02-script/data/session{N}.json` | 讲稿唯一数据源 |
| `{lecture}/tools/content/session{N}_content.py` | 内容模块（`DECK['slides']`，构建源） |
| `03-slides/session-{N}/` | 各套 deck 产物 |

## Workflow：新建一讲

1. **建讲目录**：`lecture-0N-…/` 下建 `01-framework/`（符号链接到 `_shared/deck-engine/`）、`02-script/`、`03-slides/`、`tools/content/`。**不要复制引擎文件**。
2. **写内容模块** `tools/content/session{N}_content.py`：`DECK` 里必须写 `"lecture": N`（**int**，如 `2`；决定读 `_shared/skins/lecture-NN.css`；缺省回退 1 = 只用 base）。全英文正文；组件排版预算见 `_shared/deck-engine/AUTHORING.md`（严禁把截图当 raw data 直接贴——用组件重排）。**注意 media/{images,videos} 是课程素材不在框架里，须另拷进 deck 目录，否则 check_deck 报 404。**
3. **构建**：`python3 _shared/build/deck_builder.py {lecture}/tools/content/session{N}_content.py {lecture}/03-slides/session-N`（任意 cwd 均可，构建器自动上溯定位 `_shared`）。
4. **生成对照页元数据**：`python3 _shared/build/gen_deckmeta.py {lecture_root}`（读 deck 产物的 vstep 标记生成 `02-script/data/deckmeta.js`；**不要过滤 unit==1 的页**）。
5. **验收三连**（Playwright 经 `NODE_PATH=<含 playwright 的 node_modules 所在目录>`，node 用 PATH 里的 node）：
   - `node _shared/deck-engine/check_deck.mjs <deck_dir>` — 逐页 overflow/离线外链检查（传目录不传文件）
   - `node _shared/deck-engine/final_accept.mjs <http_base> [deck1 deck2 ...]` — 验收汇总（**http_base 是 http URL**，如 `http://127.0.0.1:8932/03-slides`，不传 decks 默认 session-1..3；传文件路径或课程根会报 invalid URL / undefined total）
   - 讲稿单一数据源端到端：用 `_shared/deck-engine/check_deck.mjs` 的 notes 检查，或自建脚本验证 `fetch ../../02-script/data/session{N}.json`
6. **放映**：课程根双击 `play.command`（内嵌 QuietServer，自动探端口 + 起浏览器）。

## 核心架构约束（违反必踩坑）

- **notes 单一数据源**：deck 不烘焙 data-notes；运行时 engine.js `loadScriptNotes()` fetch `../../02-script/data/session{N}.json`。**改 JSON 刷新即生效，无需重建 deck**。双语逐句对应（改 en 必同步改 zh，反之亦然）。
- **file:// 硬约束**：浏览器 API 层拒绝 file:// fetch 本地 JSON，Playwright route 也拦不住。一切验证必须经 http（`python3 -m http.server` 或 play.command）。file:// 下优雅降级：幻灯片照常，notes 浮层/presenter 显示 play.command 修复指引（presenter-inject 的 `nfail` 标志）。
- **play.command 启动器**（课程根双击运行）：`cd "$(dirname "$0")"` 保证服务根正确 → python socket `connect_ex` 探测空闲端口 → banner → 后台 `open` 浏览器 → 前台内嵌 QuietServer（`ThreadingHTTPServer` 子类：`address_family = AF_INET6` 双栈；`handle_error` 对 BrokenPipeError/ConnectionResetError 静默——浏览器 video 按需加载断连属正常；print 必须 `flush=True` 否则块缓冲永不显示）。模板见 assets/play.command。
- **frame404 检测**：02-script 对照页 iframe `onload` 读同源 contentDocument，匹配 python 404 页特征（title "Error response"）则替换白框为"服务目录不对，请双击 play.command"提示。
- **hash 步进协议 `#/N/S`**：engine.js 解析，`#/N` 跳页重置步进、`#/N/S` 显示前 S 个 vstep；`?still=1` 静态模式供 iframe 侧框。
- **iframe 懒物化**：单页 >150 个真实 iframe 会压垮 Playwright Chromium（Page crashed / exit 137）——渲染时只留 data-src 空 div，IntersectionObserver（rootMargin 400px）视口附近才物化。

## 已固化的工程教训

- scrollrow 内 img 必须 `max-width:none`（全局 `img{max-width:100%}` 截断超宽图）。
- vstep 页截图须先移除 `.vstep-off`；验收测溢出用 `getBoundingClientRect().bottom` vs viewport，scrollHeight 无效。
- 媒体容器贴合真实宽高比；多页递进图序列像素级对齐。
- **排版对齐标准**：标准内容页必须铺满到底边 1016（`flex:1;min-height:0` 拉伸），用 `audit_layout.mjs <session_dir>` 程序化审计全部内容页（active 副本在 `lecture-slides/scripts/audit_layout.mjs`；仓库内旧副本已归档）；唯一例外是刻意设计的电影感「cold open」四连页（留 37px 底隙）。详见 AUTHORING.md「Layout alignment standard」。
- BSD grep：`grep 'a\|b'` 静默空结果，一律 `grep -E`。
- 清理测试端口前必须 `lsof -i :PORT` 查归属，不能盲杀；测试启动器一律 stub `open`。
- 云同步目录上进程写文件可能报 PermissionError（Brokered file token refused）——文件实际未损坏，重试或换路径验证即可。

## 第二批固化教训

- **内联三件套同版律**：slide html 内联的 `<style>/<markup>/<script>` 是一个整体，部分替换（如沙漏 v1→v2 换 markup+script 但漏 style）会静默产出"JS 在跑但渲染缺失"的残废页。改完内容模块**必须重建并双向 grep 复核**（源模块与部署 index.html 各查一遍特征标记，如 `setProperty('--p'` 与 `hg-t::before{transform`）。多 worker 并行时主线编辑可能被 worker 收尾写入覆盖——重建后必复核部署态。
- **素材树单一根**：`03-slides/media/`（decks/session-N/{images,videos} + _shared）。deck_builder 不再创建 out_dir/media（2026-09-03 起删除 makedirs），session-N/ 下只留 index.html+presenter.html；发现 session 级 media 目录=残留，直接 rmdir。
- **DECK title 卫生**：builder 只剥 `^Lecture\s*\d+\s*·\s*` 前缀；模块 title 直接写干净名（如 `'The Core Logic & the Course Map'`），别写 'Course · Lecture 1 · Session 3' 这类混合串。
- **Playwright ESM**：脚本里 `import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright')`（NODE_PATH 对 ESM import 不生效）。
- **视频 E2E**：headless 需 `--autoplay-policy=no-user-gesture-required`；临时构建目录的 media 符号链接必须对准 `media/decks`（builder 若自建 out/media 装 fonts，直接 ln media 会变成 media/media）。
- **头像处理规则**：仅 invited/guest speaker 页对该页人物做面部处理，其余头像保持原图+圆形；面部处理脚本以输入路径为写盘路径——喂 bak 文件会覆盖备份，先 cp 到 /tmp 再跑；恢复/替换后用 md5 逐张校验。
- **Break 页沙漏 v2 动画**：CSS 变量 `--p`（0→1/300s）由 JS rAF 驱动，伪元素 calc 混算实现单向漏沙（无翻转），沙=var(--accent)。实机验证采样 `--p` 递进 + `getComputedStyle(::before).transform` 矩阵 + 倒计时递减。
- **改 engine.js 或内容模块后必须重建**才落盘（builder 整体内联）；networkidle 在含长连接的页面上会超时，Playwright 验证用 `waitUntil:'load'`+固定等待。
- **编辑模式 ops 持久化**：逐字稿页编辑模式（换/删/裁）若只对部署态 index.html 做字符串手术、ops 不落盘，任何重建都会静默清掉媒体编辑。现 play.command `_apply_slide_edits` 成功后追加 ops 到 `02-script/data/slide-edits.json`（`{sess: [{ts,page,title,ops}]}`），deck_builder.py 写完 index.html 后 `_replay_slide_edits` 按原序重放（`data-ttitle` 定位优先于页码、单批失败跳过、重放前整文件备份到 `bak/03-slides/*-replay-*`）。改 deck_builder 或 play.command 时不要破坏这条链路。
- **vsp 视频剪辑器存档必须用身份键 + 越界自愈**：部署态 deck 的「✂ 片段」剪辑器把 {s,e,p} 存 localStorage，旧版 key 是「页码.序号」位置键——页面重排后会把 A 视频的保存片段错套到 B 视频上（s 超出新视频时长 → timeupdate 循环把播放头钉死 → 视频「放不出来」、剪辑面板手柄/封面帧全部失效）。修复：① vidKey 改为 data-vid 身份键优先；② setupVideos/剪辑面板 loadedmetadata 时校验 s/e 越界即 clearSeg 回默认。注意：该剪辑器 JS 只存在于部署态 HTML，框架模块里没有——deck_builder 重建会把它整个抹掉，重建前需 diff。
- **play.command 已支持 HTTP Range/206**：默认 SimpleHTTPRequestHandler 忽略 Range 恒回 200 全量，浏览器视频 seek 需要分片。send_head/copyfile 已覆写（2026-09-03），别在改 play.command 时误删。
- **多屏窗口路由（主屏 = 鼠标所在屏）**：规则 = 运行 play.command 时**鼠标所在屏即主屏**；逐字稿与演讲者视图永远在鼠标所在屏，扩展屏只放观众 deck。用户明确否决「系统主屏」语义——主屏是动态的。
  - **坐标系统翻转（最容易踩的坑）**：`NSScreen.visibleFrame` 与 `NSEvent.mouseLocation` 是 **Cocoa 坐标**（系统主屏左下原点、y 向上）；AppleScript `bounds`、浏览器 `screen.availLeft/availTop`、`window.moveTo` 是**窗口/浏览器坐标**（系统主屏左上原点、y 向下，可为负）。直接把 visibleFrame 当 bounds 用会在扩展屏垂直错位（仅系统主屏因原点 (0,0) 侥幸正确）。换算（JXA 内完成）：取系统主屏完整高度 `H = NSScreen.screens[0].frame.size.height`，则 `x窗口 = x可见区`，`y窗口 = H - (y可见区 + h可见区)`。
  - play.command 探测协议：JXA（`osascript -l JavaScript` + `ObjC.import('AppKit')`）输出**首行 `MOUSE=N`（N = 鼠标所在屏序号，逐块判断 mouseLocation 落在哪屏 visibleFrame，未命中回退 0）**，其余每行一块屏的换算后 `x,y,w,h`。bash 提取：`MOUSE_IDX=$(sed -n '1s/^MOUSE=//p')`；主屏 `P_LINE = tail -n +2 | sed -n "$((MOUSE_IDX+1))p"`；扩展屏 `S_LINE = 其余第一块屏（awk -v m=... 'NR != m {print; exit}'）`；单屏机器 `S_LINE` 空 → 回退 `P_LINE`（两块内容同屏）。
  - 打开顺序：逐字稿（`open_on_screen`，AppleScript `make new window with properties {bounds:{x,y,x+w,y+h}}`，全局坐标可负，`set URL of active tab of front window`）→ `sleep 1` → 观众 deck（扩展屏可见区，deck 居前拿焦点）。每步 `|| open` 回退旧行为；探测失败 / Chrome 缺失全走回退，不阻塞放映。
  - **pv\* 传参链（演讲者目标屏 = 鼠标所在屏可见区）**：play.command 把鼠标屏可见区注入 deck URL `?pvx=&pvy=&pvw=&pvh=` → presenter-inject.js `pvTarget()` 解析 location.search，`openPresenter()` 弹窗 URL 透传 `?pvx=...`、`left/top` 定位到目标屏中心（负坐标合法）+ `pwin.moveTo` → presenter.html 顶部 `routeToPrimary()` 二次解析 `pv*`，`screen.availLeft/availTop !== (t.x,t.y)` 即 `moveTo`，随后 `fitTarget()`（竖屏 `availHeight > availWidth` 铺满、横屏只做不超界）。**无参数（手动打开）回退系统主屏 (0,0)**。仅在加载时路由一次，不打断用户后续手动拖动。
  - **TCC 自动化权限**：osascript 控制 Chrome 需宿主进程获「自动化 → Google Chrome」授权；未授权是 **-10004 事件拒绝**（`get version` 这类开放事件仍可过，别误判为语法错）。沙箱宿主无此权限 → 无法端到端实测窗口落屏；验收只能 `bash -n` + `osacompile -o /dev/null` 编译验证 + 用户实机双击目检。play.command 已加 `count windows` 探测预热 + 终端提示文案。
  - presenter 竖屏断点：`@media (max-width:1200px)` 把 main 双列 `grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)` 改单列上下两栏（rows `1.15fr/1fr`），`.f-next` 高 40%→30%。
  - 改 presenter-inject.js / presenter.html / play.command 后**必须重建三个 session** 才落盘（builder 内联 inject、整文件拷贝 presenter.html）；部署态 marker 自检：`pvTarget`、`pvw=`、`routeToPrimary`、`fitTarget`、`availLeft`。

### 幻灯片媒体编辑：index 错位与 CSS 钳制（勿删）

- **序号空间必须一致**：前端 editId 按 `img,video,iframe` 混合序号编号，后端 `_apply_slide_edits`/`_apply_ops` 按 tag 分组正则定位。若某页 video/iframe 排在 img 之前（如 page 7 首元素是视频），两者错位一位，编辑会**静默落到相邻图**。修复：`recordEmOp` 记录「同标签局部序号」`st.els.filter(x=>x.tagName===el.tagName).indexOf(el)`。改前端枚举或改后端定位时务必同步检查另一端。
- **全局 `img{max-width:100%;max-height:100%}` 会静默吞掉放大**：媒体格 figure 固定尺寸 + overflow:hidden，inline width/height 超出格子被钳回 → 拖手柄无反应、保存后"编辑没效果"。resize op 现已写入 `max-width/height:none`；网格内放大走 `flex` op（figure flex-grow 提权，兄弟回流，图片始终填满格子——后端会剥离固定 px），非网格放大用 `spill:1`（figure overflow:visible）。两处必须同步改：`play.command/_apply_slide_edits` 与 `_shared/build/deck_builder.py/_apply_ops`（前端 `02-script/index.html` 的 `emStartResize/recordEmOp` 由 `_shared/viewer` 模板生成，改模板后重建）。
- 修复用户已保存的错位编辑时：按 src 定位 img 改 style，journal 里删旧错位条目、换一条修正后的终态记录（重建 replay 可复现），不要只改文件不动 journal。

## Resources

### references/
- `AUTHORING.md` — 组件规范与排版预算（构建内容模块前必读）。

### assets/
- `play.command` — 放映启动器模板（QuietServer 版，复制到课程根改标题即可）。

### 视频 vsp 补丁同步
- 修 video bug 时若只改了部署 HTML 里的内联 engine，**必须把补丁回植到框架 `_shared/deck-engine/engine.js`**，否则重建回归。回植后验收三步：① `node --check`；② 规范化 diff（把 title/SCRIPT_SESSION/VIDEO_CONFIG 归一后 diff；注意不同 session 的 DECK_CONFIG 与 SYNC 层 script 序号可能不同）；③ `_shared/build/deck_builder.py session{N}_content.py /tmp/testbuild` 后 grep 补丁标记。
- 云同步目录上 grep 工具会假阴性，用 python 读文件。

## 线上发布：学生版 deck → 课程主页（常备链路）

- **工具**：课程根 `tools/build_publish.py`（幂等，断言式）——源 `04-deploy/session-{N}/index.html` → 主页 repo `<主页repo>/teaching/<课程slug>/session-{N}/index.html`。五变换：媒体 `../media/decks/`→COS 绝对 URL；notes fetch `../../02-script/data/`→`../data/`（JSON 快照随发布）；`openPresenter(){ return;` 禁用 presenter（S 键/按钮全兜底）；删演讲者按钮 DOM；`attachSegButton(){ return;` 禁 ✂ 剪辑器。fonts 整体拷 `out_root/fonts/`。
- **媒体上传**：`rclone copy 04-deploy/media/decks cos:<COS_BUCKET>/<COURSE_ID>/media/decks`（copy 幂等可增量）。上传未完成时浏览器请求 404→`ERR_BLOCKED_BY_ORB`，传完自愈——别误判为坏链。
- **官网接线**：`teaching/<课程slug>.html` lectures[N] 加 `sessions: [url,...]` 字段，renderLecture 优先按 sessions 渲染 `matBtn('Session N', …, 'fas fa-tv')`，无 sessions 才回退 PPT/Notes 占位。
- **脚本自检教训**：字面串残留检查用 `in`，别把含 `.` 的字面串传 `re.search`（`.` 通配会把 COS URL 里 `01/media/decks/` 误判成 `../media/decks/`）；「演讲者视图」字样在注释里也有，只有按钮 DOM regex（`<button[^>]*data-act="pres"`）是真判据。
- **更新流程**：改 notes JSON（免重建）→ 重跑 build_publish + commit/push；deck 重建/媒体改动 → 重跑 build_publish + rclone 增量 → push。公开仓库推送前做 PII 审计（课程邮箱属 Reach Us 设计内容，不算泄露）。
- **线上验收基线**：各 deck 页数正确、presBtn/segBtn 均无、notes=ok、COS 图 broken=0、JS 0 错误；官网 materials 正常渲染 Session 按钮。

## 看片台（缩略图墙）工程教训（2026-09-09）

- **`02-script/index.html` 是生成产物，严禁手工编辑**——唯一权威源是 `_shared/viewer/viewer.template.html` + `build_viewer.py` 的 COURSES 参数集。改产物 = 制造漂移，下次 `--all` 直接覆写。**改完模板必须重建**：`python3 build_viewer.py --all --repo-root "<课程根>"`。
- **`--repo-root` 必须指向直接含 `lecture-*` 的那一层（2026-09-09 加守卫）**：误传 `_shared` 会静默生成 `_shared/lecture-0X-*/02-script/index.html` 幽灵产物——内容正确、位置非法、无人引用，排查很费时间。现在 `_resolve_repo_root()` 会校验目录存在、含 `lecture-*`、且不在 `_shared` 内，违反直接 `SystemExit`；单课程 `--root` 同样禁止落在 `_shared` 内。发现 `_shared/lecture-*` 一律视为残留（非权威源，md5 与正确产物相同也只是巧合），用 `trash` 清掉，不要 `rm`。
- **从产物反推模板的可靠手法**（当只有产物被改过、模板是旧版时）：以已验证产物为蓝本，把 6 个 token 的**已解析值**反替换回去（`__TITLE__`/`__H1_EN__`/`__H1_ZH__`/`__SESSIONS_TEXT__`/`__SESSION_LIST__`/`__COURSE_DIR__`），写完用 `re.findall(r"__[A-Za-z0-9_]+__", s)` 校验残留；再重建产物与备份做 `diff -q`，必须逐字节一致。注意 `__SESSION_LIST__` 与 `__COURSE_DIR__` 各出现 2 处。
- **【核心坑】`aspect-ratio` + 百分比宽度不可放进 CSS Grid 轨道**：grid 轨道尺寸计算阶段，item 的 inline size 依赖轨道宽度、`aspect-ratio` 又依赖 inline size → 循环依赖，Chrome 把 block size 贡献当作 0 → 行轨道塌成 2px、卡片全部重叠。`minmax(0,1fr)` 和 `1fr` 两种写法**都塌**，改列定义无效。唯一解：`display: flex; flex-wrap: wrap` + `.bcell { flex: 0 0 calc((100% - (var(--cols) - 1) * var(--gap)) / var(--cols) - 0.02px); aspect-ratio: 16/9 }`，`.bsep { flex: 0 0 100% }`，`img` 绝对定位（`position:absolute; inset:0`）切断其参与高度计算。`-0.02px` 是亚像素余量，防 6 个恰好 100% 的项因浮点误差把最后一个挤到下一行。
- **E2E 几何断言必须校验矩形不重叠**：用 `Math.round(rect.top)` 分组算「每行 ≤N」在行塌陷时会**假通过**（同排卡片 top 相同被当成同一行）。必须同时断言：行内 `row[i].l < row[i-1].r - 0.5` 计数为 0（横向不重叠）、相邻行 top 差 ≥ 行高 - 1（纵向不重叠）、`cellH >= 90`（非塌陷）、`img` 实际渲染高度 ≥ 80。
- **看片台每行上限**：`bestGrid(W)` 的 `MAX_COLS = 6` 硬上限 + 由窗口宽度反推（`MIN_CELL=176, GAP=10, PAD=54`），**不再按页数反推高度压进一屏**；总高超出由 `.board-grid` 纵向滚动承担。列宽公式必须把 gap 算进去：`c = floor((avail + GAP) / (MIN_CELL + GAP))`（漏算 gap 会导致实测 cellW 偏小）。
- **跨 Session 拖拽后必须 `resyncBoardSess()`**：`data-sess` 建卡时写死、拖拽后不更新，会让筛选（按 `data-sess` 显隐）与分隔条计数用过期归属。以 DOM 里最近的前一个 `.bsep` 为准回写，在拖拽 `up` 时调用。筛选只改 `display`、DOM 线性序不动，`boardCommit` 的全排列校验才不受影响。
- **多 session 硬编码清理**：`boardCommit` 的 `all` 要用 `Object.keys(orders).reduce(...)` 而非 `[].concat(orders['1'], orders['2'], orders['3'])`；否则 6 session 的 lecture-02 保存重排会丢页。
- **云同步目录回写覆盖（2026-09-09 实测）**：在云同步路径上写入生成产物后，云端可能把旧版本/冲突版本推回，表现为「构建脚本报 wrote 但文件内容没变」或「刚写对的 L01 产物变回 L02 内容」。**构建后必须立即校验 md5 + 关键标记**（`board-filter`/`MAX_COLS`/`Promise.all([...])` 的 session 列表），并间隔数秒复测稳定性；发现被覆盖就重写并再次校验，不要假设一次写入即落盘。
  - **更强的自检手法**：不依赖文件 mtime，直接 `import build_viewer; build_viewer.render(key)` 拿内存渲染结果，与落盘内容比 `==`。一致说明落盘就是权威模板的产物，云同步没插进旧版本。
    ```python
    import importlib.util, sys, pathlib
    spec = importlib.util.spec_from_file_location("bv", "build_viewer.py"); bv = importlib.util.module_from_spec(spec)
    sys.argv = ["build_viewer.py"]; spec.loader.exec_module(bv)
    out = bv.render("lecture-01")   # 注意 render() 只吃 course_key，不是 (template, cfg)
    cur = pathlib.Path("<course>/02-script/index.html").read_text(encoding="utf-8")
    assert out == cur
    ```

### 回归测试套件（2026-09-09 落盘）

- **位置**：`_shared/viewer/tests/`（`run_all.sh` / `test_board.cjs` / `test_board_drag.cjs` / `lib/harness.cjs`）。此前这些脚本散在 `/tmp/lt02/`，已工程化落盘——**不要再写一次性临时脚本**，改测试请直接改这里。
- **一键跑**：`cd _shared/viewer/tests && bash run_all.sh`（自动定位仓库根 = 脚本上三级 `tests/ → viewer/ → _shared/ → 根`；`SHOTS=1` 出图到 `/tmp/board-shots/<lecture>/`，`SHOTS_DIR=` 改根目录，`BASE_PORT=9000` 换起始端口）。**截图必须按讲分目录**——两讲同名 `board-all.png` 平铺会互相覆盖。
- **分层**：`smoke_test_viewer.js` 只验「页面活着」（title/h1/#root/.slide/console），**不覆盖看片台**；看片台行为归 `test_board.cjs`（26 断言）；拖拽归 `test_board_drag.cjs`（7 断言，不写盘）。
- **期望值数据化**：`lib/harness.cjs` 的 `readExpect(courseDir)` 从 `02-script/data/session*.json` 累加 `sections[].slides[]` 推导总页数与各 session 页数。**禁止在测试里硬编码页数**——讲次增删/页数变动必须自动适配（L01=76 页/3 session，L02=685 页/6 session）。
- **端口自愈（必守）**：`harness.cjs` 的 `listen(port, tries=50)` 遇 `EADDRINUSE` 自动 `port+1` 重试并返回实际端口；`smoke_test_viewer.js` 的 `pickFreePort()` 同理。**测试不得假设固定端口可用**——用户常同时开着 `play.command`（Python `http.server`，`address_family=AF_INET6` 占 `*:PORT`），会直接撞车。日志里出现 `# port 8400 被占用，改用 8401` 是正常自愈，不是失败。
- **端口冲突排查**：`lsof -nP -iTCP:<port> -sTCP:LISTEN` 看 PID + `lsof -p <pid> | grep cwd` 看归属；**沙箱里 `ps` 被拒**（`operation not permitted`），只能用 `pgrep -x` / `pgrep -f` / `lsof`。别盲杀——可能是用户正在放映的服务。
- **几何断言不能只看「每行 ≤N」**：行塌陷时同排卡片 `top` 相同会被算作同一行而**假通过**。必须同时断言横向不重叠（`row[i].l < row[i-1].r - 0.5` 计数为 0）、相邻行纵向不重叠、`cellH >= 90`、`img` 实高 > 50。`GEOM_FN` 已封装。
- **bash 脚本自检**：`bash -n run_all.sh` 后跑一次真机；仓库根用相对路径上溯时要数清层级（曾少一级 → 解析成 `_shared` → 6 个套件全 ENOENT），并加启动前 `ls "$REPO_ROOT"/lecture-*` 校验。

## 隐藏页（hidden slides）全链路（2026-09-09 落定）

源课件里隐藏的幻灯片要在看片台标为隐藏，**唯一真源是源 `.pptx` 的 `show="0"`**，一路五层传递，任一层漏写就断链：

```
源 .pptx  show="0"
  → tools/deck_spec/sessionN.json        pages[].hidden
  → tools/content/sessionN_content.py    'hidden': True
  → 02-script/data/sessionN.json         slides[].hidden
  → deck 产物 <section … data-hidden="1">
```

- **反查源 pptx**：`python-pptx` 遍历 `slide.element` 找 `show == '0'`（备注里"这张幻灯片在源课件中是隐藏页。"是辅助线索，不是判据）。
- **L2 基线**：S1=10 / S2=7 / S3=0 / S4=6 / S5=43 / S6=25 = **91 页**。
- **引擎行为**：`HIDDEN` 集合来自 `data-hidden`；`buildToc()` 跳过隐藏页（TOC 序号连续无跳号）；`go()` 对隐藏页顺延到下一可见页；`visTotal = total - hiddenCount`；`?embed=1` 走 NO_SKIP 按原始页码寻址（看片台预览框需要）。

### 【核心坑】验收脚本取 TOC 序号/标题必须分 span，禁止解析 textContent

`.toc-link` 的 DOM 是 `<span class="n">15</span><span>1989 — The First Full-Body 3D Scan</span>`。
用 `el.textContent.match(/^(\d+)/)` 会把两段拼成 `151989` —— 既误判「TOC 序号有跳号（暴露隐藏页位置）」，
又误剥标题前缀（`hidden=0` 的 L1 session-2 就是这么被误报的）。
**正确写法**：序号取 `.n` span（`parseInt(nEl.textContent, 10)`），标题取**最后一个 `span`**；
泄漏检测用标题 span 组成的 `Set` 精确比对。`verify_hidden.mjs` 已按此修复。

### 引擎版本对齐是硬约束

`verify_hidden.mjs` 调用 `window.__deck.lastVisPage()`、`d.hiddenRule.visIndex()`。
**旧引擎快照缺这些方法 → 验收脚本直接崩**（`TypeError: … is not a function`）。
跑全量验收前先确认九个 deck 都由 canonical 引擎重建过：

```bash
# 版本探针：产物里 grep 关键方法名，逐个 deck 核对
for d in <lecture>/03-slides/session*/index.html; do
  printf '%s: ' "$d"
  grep -c 'lastVisPage\|hiddenRule\|visIndex' "$d"
done
```

重建九个 deck（L1×3 + L2×6）的实测耗时约数分钟；L1 重建会输出
`[journal] replayed N/N edit batches`，**证明 slide-edits 未丢**。

### 三套验收脚本的分工（跑全量时都要过）

| 脚本 | 覆盖 | 关键判据 |
|---|---|---|
| `check_deck.mjs <deck_dir>` | 逐页 overflow/破图/坏视频/空讲稿 | **用 `visTotal` 而非 `total` 比 TOC 条数**（否则每个隐藏页都误报「toc links 少一条」）；隐藏页另开 `?embed=1` 趟跑 |
| `verify_hidden.mjs` | 隐藏页 12 项行为语义 × light/dark | TOC 序号连续、隐藏标题不泄漏、`visTotal`、presenter 页码/进度段/End 键 |
| `final_accept.mjs <http_base>` | 整体功能汇总 | `total/nav/toc/notes/arrow/presNav` + `jsErr=0` + `ext=0`（离线合规） |

### 看片台分隔条标题（`.bsep`）

曾出现三重冗余：`Session 1Body Models: A History63 slides · 隐藏 10`。
源头在 `_shared/viewer/viewer.template.html`，改完必须 `python3 build_viewer.py --all --repo-root "<课程根>"` 重建，
再断言六条分隔条各自含 `Session N` + 主题名、且无叠字。E2E 采集 `sepTexts` / `headerText` 做语义断言。

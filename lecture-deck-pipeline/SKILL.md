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

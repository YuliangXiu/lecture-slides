# 历史固化教训（按日期归档）

> 由 `SKILL.md` 的相关章节拆出。**踩坑前扫一眼；日常不必通读。**

---

### 2026-09-09 末页导航三坑（勿改回去）

用户报告「演讲者模式末页方向键失灵、Home 跳第一页又自动弹回末页」。根因三条，全部在 `_shared/deck-engine/`：

1. **`defer()` 只会前向顺延**（`hidden.js`）：末页按 ←/↑ → `go(cur-1)` 命中隐藏页 → 顺延回 `cur` → `n===cur` 早退，按键被静默吞掉。修复：`defer(i, dir)` 带方向——`dir<0` 时往前找首个可见页；同时新增 `visAt(pos)` / `nextVis(i)` / `prevVis(i)` 直接按可见页序号寻址，避免「go(cur±1) 再 defer」在相邻隐藏页处折回原地。
2. **`advance`/`retreat` 只做 vstep、永不翻页**（`engine.js`）：页内无步进时返回 false，上下键在末页彻底失灵。修复：vstep 优先，用尽则翻页。
3. **焦点在预览 iframe 内时 Home 不上交**（`sync.js` + `presenter.html`）：`sync.js` 原本不处理 Home，iframe 自己翻到 0；而 presenter 的 800ms 兜底 `fsend` 仍按旧页重发 goto，把 iframe 拉回末页。修复：`sync.js` 把 Home/End 上交（`post({cmd:'home'|'end'})`）→ presenter 转发给 opener → 由 opener 权威翻页。

末页各键落点规范（`verify_hidden.mjs` 第 13 项已固化为回归断言）：

| 按键 | 末页行为 | 落点 |
|---|---|---|
| → / ↓ / Space / PageDown | 钳位，不越界 | 留在末页 |
| ← / ↑ / PageUp | 回退（vstep 在首步时让位翻页） | 上一可见页 |
| Home | 绝对寻址 | 首个可见页 |
| End | 绝对寻址 | 末个可见页 |

排查通则：**任何「按键无反应」优先查 `go()` 的 `n===cur` 早退**——钳位/顺延把目标算成当前页时，引擎静默返回，表面像键坏了。验证脚本用 `window.__hiddenRule.firstVis()`（**没有** `__deck.firstVisPage()`）。

### 2026-09-03 第二批固化教训

- **内联三件套同版律**：slide html 内联的 `<style>/<markup>/<script>` 是一个整体，部分替换（如沙漏 v1→v2 换 markup+script 但漏 style）会静默产出"JS 在跑但渲染缺失"的残废页。改完内容模块**必须重建并双向 grep 复核**（源模块与部署 index.html 各查一遍特征标记，如 `setProperty('--p'` 与 `hg-t::before{transform`）。多 worker 并行时主线编辑可能被 worker 收尾写入覆盖——重建后必复核部署态。
- **素材树单一根**：`03-slides/media/`（decks/session-N/{images,videos} + _shared）。deck_builder 不再创建 out_dir/media（2026-09-03 起删除 makedirs），session-N/ 下只留 index.html+presenter.html；发现 session 级 media 目录=残留，直接 rmdir。
- **DECK title 卫生**：builder 只剥 `^Lecture\s*\d+\s*·\s*` 前缀；模块 title 直接写干净名（如 `'The Core Logic & the Course Map'`），别写 '<课程名> · Lecture 1 · Session 3' 这类混合串。
- **Playwright ESM**：脚本里 `import { createRequire } from 'module'; const require = createRequire(import.meta.url); const { chromium } = require('playwright')`（NODE_PATH 对 ESM import 不生效）。
- **视频 E2E**：headless 需 `--autoplay-policy=no-user-gesture-required`；临时构建目录的 media 符号链接必须对准 `media/decks`（builder 若自建 out/media 装 fonts，直接 ln media 会变成 media/media）。
- **头像处理规则（用户定稿）**：仅 invited/guest speaker 页对该页人物做面部处理，其余头像保持原图+圆形；`avatar_face_crop.py`（已随 Task 2 归档）以输入路径为写盘路径——喂 bak 文件会覆盖备份，先 cp 到 /tmp 再跑；恢复/替换后用 md5 逐张校验。
- **Break 页沙漏 v2**（S1/S2 各一处，S3 无）：CSS 变量 `--p`（0→1/300s）由 JS rAF 驱动，伪元素 calc 混算实现单向漏沙（无翻转），沙=var(--accent)。实机验证采样 `--p` 递进 + `getComputedStyle(::before).transform` 矩阵 + 倒计时递减。
- **改 engine.js 或内容模块后必须重建**才落盘（builder 整体内联）；networkidle 在含长连接的页面上会超时，Playwright 验证用 `waitUntil:'load'`+固定等待。
- **编辑模式 ops 持久化（2026-09-03 事故修复）**：逐字稿页编辑模式（换/删/裁）曾只对部署态 index.html 做字符串手术、ops 不落盘——任何重建都会静默清掉媒体编辑。现 play.command `_apply_slide_edits` 成功后追加 ops 到 `02-script/data/slide-edits.json`（`{sess: [{ts,page,title,ops}]}`），deck_builder.py 写完 index.html 后 `_replay_slide_edits` 按原序重放（`data-ttitle` 定位优先于页码、单批失败跳过、重放前整文件备份到 bak/03-slides/*-replay-*）。改 deck_builder 或 play.command 时不要破坏这条链路。


- **vsp 视频剪辑器存档必须用身份键 + 越界自愈（2026-09-03 事故）**：部署态 deck 的「✂ 片段」剪辑器把 {s,e,p} 存 localStorage，旧版 key 是「页码.序号」位置键——页面重排后会把 A 视频的保存片段错套到 B 视频上（s 超出新视频时长 → timeupdate 循环把播放头钉死 → 视频「放不出来」、剪辑面板手柄/封面帧全部失效）。修复（已应用到 session-1/2/3 部署态 index.html）：① vidKey 改为 data-vid 身份键优先；② setupVideos/剪辑面板 loadedmetadata 时校验 s/e 越界即 clearSeg 回默认。注意：该剪辑器 JS 只存在于部署态 HTML，框架模块里没有——deck_builder 重建会把它整个抹掉，重建前需 diff。
- **play.command 已支持 HTTP Range/206**：默认 SimpleHTTPRequestHandler 忽略 Range 恒回 200 全量，浏览器视频 seek 需要分片。send_head/copyfile 已覆写（2026-09-03），别在改 play.command 时误删。
- **验证 deck 视频时不要用 `python3 -m http.server`（2026-09-09 踩坑）**：它同样不支持 Range → 视频 `currentTime` 恒为 0、seek 无效，看起来像「接线坏了」，实际只是服务端没给分片。用 play.command，或已沉淀的 `_shared/viewer/tests/lib/range_server.cjs`：`ROOT=<课程根> PORT=8401 node lib/range_server.cjs`，探活 `curl -s -r 0-99 -o /dev/null -w "%{http_code}" <mp4 地址>` 期望 **206**（越界 416、无 Range 200）。注意 URL 路径**相对 ROOT** 解析，写错会静默返回 404（body 仅 3 字节）。
- **内容源是 VIDEO_CONFIG 与媒体接线的唯一真源（2026-09-09 回归）**：`deck_builder.py` 只注入 `tools/content/sessionN_content.py` 里 `video_config` 声明的键，**不会**从产物 HTML 的 `data-vid` 推导。所以「手改产物 HTML 的 VIDEO_CONFIG / 把 iframe 换成 `<video>`」在下次重建时**静默丢失**。L01 session-3 曾因此丢两处：第 8 页本地视频接线退回 Bilibili iframe、`s003_h3r` 的 `end: 9.6` 回退成 `10`（越界，实测 9.604s）。铁律：**改接线先改 `.py` 再重建**。
  - `slide-edits.json` 的 journal **只覆盖有记录的 session**（L01 只有 s1/s2），无 journal 的 session 重建后没有任何重放保护。
  - 源侧 / 镜像侧 VIDEO_CONFIG 语义不同：源侧 = 源视频内的**播放窗口**（`53.77..101.32`），镜像侧 = 物理裁剪后的**全长**（`0..47.55`），差值恒等于 `keep_duration_s`。
- **多屏窗口路由（主屏 = 鼠标所在屏）**：完整设计、Cocoa↔窗口坐标换算、JXA 探测协议、`pv*` 传参链、竖屏断点全在 `lecture-slides` 的 `references/multi-screen-routing.md`（模块 B5），**此处不重复**。本脚手架特有的两条：
  - 改 `presenter-inject.js` / `presenter.html` / `play.command` 后**必须重建三个 session** 才落盘（builder 内联 inject、整文件拷贝 presenter.html）；部署态 marker 自检 `pvTarget`、`pvw=`、`routeToPrimary`、`fitTarget`、`availLeft`。
  - **TCC 自动化权限**使沙箱内无法端到端实测窗口落屏（osascript 控 Chrome 需宿主获授权，未授权报 **-10004 事件拒绝**，不是语法错）；验收只能 `bash -n` + `osacompile -o /dev/null` 编译验证 + 用户真机双击目检。

### 幻灯片媒体编辑：index 错位与 CSS 钳制（2026-09-04 #/7 事故，勿删）

- **序号空间必须一致**：前端 editId 按 `img,video,iframe` 混合序号编号，后端 `_apply_slide_edits`/`_apply_ops` 按 tag 分组正则定位。若某页 video/iframe 排在 img 之前（如 page 7 首元素是视频），两者错位一位，编辑会**静默落到相邻图**。修复：`recordEmOp` 记录「同标签局部序号」`st.els.filter(x=>x.tagName===el.tagName).indexOf(el)`。改前端枚举或改后端定位时务必同步检查另一端。
- **全局 `img{max-width:100%;max-height:100%}` 会静默吞掉放大**：媒体格 figure 固定尺寸 + overflow:hidden，inline width/height 超出格子被钳回 → 拖手柄无反应、保存后"编辑没效果"。resize op 现已写入 `max-width/height:none`；网格内放大走 `flex` op（figure flex-grow 提权，兄弟回流，图片始终填满格子——后端会剥离固定 px），非网格放大用 `spill:1`（figure overflow:visible）。两处必须同步改：`play.command/_apply_slide_edits` 与 `_shared/build/deck_builder.py/_apply_ops`（前端 `02-script/index.html` 的 `emStartResize/recordEmOp` 由 `_shared/viewer` 模板生成，改模板后重建）。
- 修复用户已保存的错位编辑时：按 src 定位 img 改 style，journal 里删旧错位条目、换一条修正后的终态记录（重建 replay 可复现），不要只改文件不动 journal。

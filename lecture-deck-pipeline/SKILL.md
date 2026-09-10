---
name: lecture-deck-pipeline
description: <机构名>《<课程名>》课程 HTML 课件的构建、复刻、验收与打磨流水线。当需要新建或迭代某一讲（Lecture N）的 session 课件（deck）、逐字稿对照页、修复课件引擎/讲稿加载/放映启动器问题、核验复刻页与源 PPT 的保真度（布局/元素位置/字号/动画顺序）、清理白块与白底媒体、让复刻页铺满舞台、给课件署上讲者姓名、或读修改意见队列批量润色 deck 与逐字稿时使用。触发词：做课件、建 deck、改课件、新讲义、slides 重建、deck_builder、复刻、保真、与源 PPT 不一致、动画顺序不对、字号不对、notes 不显示、play.command、白块、白底、不饱满、排版太空、抹掉原作者、署名、沙漏、倒计时、polish-slides、应用修改意见、按意见改课件、改逐字稿、插入页、feedback-history、unsolved、Ongoing。
agent_created: true
---

# Lecture Deck Pipeline（课件构建 · 复刻 · 验收 · 打磨流水线）

## 本 skill 的边界

| 领域 | 归属 |
|---|---|
| 视觉体系、演讲者模式、离线本地化、质量门禁、排版守则、编辑器与工作台**设计** | `lecture-slides` skill |
| **本脚手架**（`_shared/` 引擎 + `tools/content/session{N}_content.py` + `session{N}.json` + `02-script/`）的建构/复刻/验收/打磨**运维** | **本 skill** |
| 部署发布（镜像、瘦身、COS、主页） | `deploy-slides` skill |

**原 `polish-slides` 已于 2026-09-10 并入本 skill**（见「打磨闭环」一节）——四类意见的路由、逐字稿改写原则、`feedback-history.json` 队列与状态回写都在这里，不要再找那个 skill。


## Overview

用固定舞台引擎（1920×1080 `.deck-stage` transform 缩放 + `.slide` section 切换）从 Python 内容模块构建每讲三套离线 HTML 课件，配逐字稿 JSON 单一数据源、presenter 演讲者视图与 play.command 放映启动器。

**2026-09-09 提层后，引擎与构建器唯一权威源在课程根的 `_shared/`**（见下），各讲不再自带副本：

| 位置 | 角色 |
|---|---|
| `_shared/deck-engine/` | 引擎资产（engine.js / style.base.css / presenter.html / presenter-inject.js / sync.js / controls.html / check_deck.mjs / final_accept.mjs / AUTHORING.md） |
| `_shared/build/` | 构建器（deck_builder.py / reorder_deck.py / gen_deckmeta.py） |
| `_shared/skins/lecture-NN.css` | 各讲差异样式层（L01 无、L02 有） |
| `_shared/tools/shoot_thumbs.cjs` | 缩略图拍摄（Playwright）；增量模式 `since-changed` 按页面内容指纹判定；同 session 复用页面提速 |
| `_shared/viewer/` | 逐字稿工作台模板（02-script/index.html 由它渲染） |

新讲搭工作区时，`01-framework/` 下放**符号链接**指向 `_shared/deck-engine/`，而不是复制文件。

## 目录约定（勿混淆）

| 位置 | 角色 |
|---|---|
| `<课程目录>/` | **权威交付**，零 .bak，最终产物只在此 |
| `…/_shared/` | **唯一权威引擎 + 构建器**（跨讲共享） |
| `<备份目录>/` | 所有备份（保留相对路径） |
| `…/bak/refactor-*-deadcode/newdeck-framework-archive/` | 旧 newdeck-framework 归档（**只读历史，勿再引用**） |
| `02-script/data/session{N}.json` | 讲稿唯一数据源 |
| `<lecture>/tools/content/session{N}_content.py` | 内容模块（`DECK['slides']`，构建源） |
| `03-slides/session-{N}/` | 三套 deck 产物 |

## Workflow：新建一讲

1. **建讲目录**：`lecture-0N-…/` 下建 `01-framework/`（符号链接到 `_shared/deck-engine/`）、`02-script/`、`03-slides/`、`tools/content/`。**不要复制引擎文件**。
2. **写内容模块** `tools/content/sessionN_content.py`：`DECK` 里必须写 `"lecture": N`（**int**，如 `2`；决定读 `_shared/skins/lecture-NN.css`；缺省回退 1 = 只用 base）。全英文正文；组件排版预算见 `_shared/deck-engine/AUTHORING.md`（严禁把截图当 raw data 直接贴——用组件重排）。**注意 media/{images,videos} 是课程素材不在框架里，须另拷进 deck 目录，否则 check_deck 报 404。**
3. **构建**：`python3 _shared/build/deck_builder.py <lecture>/tools/content/sessionN_content.py <lecture>/03-slides/session-N`（任意 cwd 均可，构建器自动上溯定位 `_shared`）。
4. **生成对照页元数据**：`python3 _shared/build/gen_deckmeta.py <lecture_root>`（读 deck 产物的 vstep 标记生成 `02-script/data/deckmeta.js`；**不要过滤 unit==1 的页**）。
5. **验收三连**（Playwright 经 `NODE_PATH=<含 playwright 的 node_modules 所在目录>`，node 用 `node`）：
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
- **排版对齐标准**：标准内容页必须铺满到底边 1016（`flex:1;min-height:0` 拉伸），用 `audit_layout.mjs <session_dir>` 程序化审计（active 副本在 `lecture-slides/scripts/audit_layout.mjs`）；唯一例外是 S1 p12–15「COLD OPEN」电影感四连页（刻意模板，留 37px 底隙）。详见 AUTHORING.md「Layout alignment standard」。
- BSD grep：`grep 'a\|b'` 静默空结果，一律 `grep -E`。
- 清理测试端口前必须 `lsof -i :PORT` 查归属，不能盲杀；测试启动器一律 stub `open`。
- WorkBuddy 沙箱进程写 云同步目录 可能报 PermissionError（Brokered file token refused）——文件实际未损坏，重试或换路径验证即可。
- **凡「遍历一批固定编号输入」的校验脚本，编号必须从数据源发现，不能写死**。`02-script/build.py` 两讲已统一为 `discover_sessions()` 扫 `data/session*.json` 并排序（找不到即 `SystemExit`）。写死的失败模式是**静默漏检 + 假绿**——L02 曾因 `for n in (1,2,3,4,5)` 漏掉 session6 的 198 页，却照样打印 `OK`。同一模式须横向排查：`tools/e2e_cue.js` 的 `SESSIONS`、`tools/presenter_e2e.js` 的 `SESSIONS`、`tools/cue_check.py` 的 `sessions` 列表、**`<lecture>/tools/build_publish.py` 的 `SESSIONS = (1,2,3)`（发布链路，增讲即静默漏发；2026-09-09 已改 `discover_sessions(04-deploy)`，只收含 `index.html` 的目录）**、`_shared/viewer/tests/lib/harness.cjs:readExpect`（测试侧已正确）。**一处看似同类、实为有意设计，勿改**：`_shared/viewer/build_viewer.py` 的 `COURSES[*]["sessions"]` 是显式课程登记表（新增课程须登记）。~~① `<lecture>/tools/merge_notes.py:146` 的 `(1,2,3,4)` 刻意排除 S5~~ **（2026-09-10 已失效）**：S3（Overview）2026-09-09 删除并重编号（原 S4→3、原 S5→4），S4 又于 2026-09-10 删除（其页已分发进 S1–S3），L02 现存 1–3；`merge_notes.py` 的 `SESSION_TITLES/PARTS` 与循环范围均已改为 1–3，不再是例外。
- **删讲次 / 重编号：三种「session N」语义必须分开，判据用「页是否还活着」而非 sid 前缀**（2026-09-09 重编号 + 2026-09-10 删 S4 两次实战）：
  - **live 课程编号**（`03-slides/session-N/`、`session{N}.json`、`deck_spec|asset_manifest|media_dims/session{N}.json`）→ 改；
  - **源 PPT 序号**（`_archive/tools/replica/els/session{N}`、`tools/fx/anim_plan.json` 等的 `session{N}` 键、`DECK_REL`、`scan_white_blocks.py` 的 `(4,5,6)`）→ **绝不改**，盲改会毁掉整条复刻管线；
  - **源素材目录**（`03-slides/media/decks/session-6/` 等，被 S1–S3 引用上百处）→ **保留**。
  - **致命陷阱**：`cuecards.json` 里的 `S4.xxx` 键，其页可能已被分发到 S1/S2/S3 但**仍然存活**——按前缀批量删会误删上百张有效卡。正确判据是「该 sid 是否还出现在任一 `session{N}.json` 里」，只剔除真正消失的页。
  - **易漏点**：deck HTML 内联 `const SCRIPT_SESSION = "N";`（字符串形式，`re.search(r'=\s*(\d+)')` 匹配不到）；每页 kicker `Lecture NN · <主题> — Session N`；`deckmeta.js` 的 session 键；`tools/cue_out/session{N}.part*.json`（删讲次必须同步删，否则重跑 `cue_merge.py` 复活）；`_shared/viewer/build_viewer.py` 改完必须重跑 `--all --repo-root <课程根>` 重建 `02-script/index.html`。
  - **cue_check.py 的结构性局限**：它按 sid 前缀 `S{n}.` 去加载 `session{n}.json`。一旦某讲的页被分发到别的 session 而保留原前缀（如 S4.xxx 住进 session1/2/3.json），它就会去加载已删除的 `session{N}.json`，报出的 missing/extra 是失真而非真回归——排查前先确认 sid↔文件映射是否被打破。
  - ⚠️ **曾误列的「例外 ③：`<lecture>/02-script/gen_bilingual_notes.py:69` 是逐字稿页映射表」已证伪删除**（2026-09-09）。它其实是**真实的 session 遍历 + 写回 JSON**，与 L02 那份弃用守卫（`raise SystemExit(1)`）语义完全不同。**通则：同名文件跨讲语义可能不同，判「是不是讲次遍历」必须读全文，不能只看有没有守卫。**
- **「人工映射表 + 自动兜底」的脚本必须有越界前置断言**（2026-09-09 `gen_bilingual_notes.py` 教训）。该脚本 MANUAL 表随 en/zh 编辑变 stale，重跑在 `build_notes` 深处炸 `AssertionError`/`IndexError`，报错指不到真因。**判定某个 MANUAL 项是否仍需要**：en/zh 句数是否相等 + 1:1 拼接是否等于现有产物；相等即冗余，删。修完的验证要**四重**：`ast.parse` / 幂等（重跑产出与原数据 `a==b`）/ **正向敏感度**（造句数变化：改前崩、改后过）/ 边界（越界报可读错）。只跑「改前改后 diff 一致」不足以证明修好（可能两版都错）。
- **改完必须做正向敏感度测试**：临时造一个多出来的 `session-N` 目录，证明新版能发现、旧版会漏。
- **沙箱两条取数铁律（2026-09-09 实测）**：① `> /tmp/xxx` 重定向**不落盘**（写完立刻读会 `No such file`），要把输出喂给下一个程序就用管道直传 `cmd | python3 -c "json.load(sys.stdin)…"`；② `stat -f "%Sm …"` 格式串**失效**（吐出原始二进制 stat 字段如 `010000100000001a 255 …`），取 mtime 统一用 `ls -lT "$f" | awk '{printf "%s %s %s %s  %s\n",$6,$7,$8,$9,$NF}'`。
- **探测并发要收敛输出**：`pgrep -fl <pattern>` 匹配到带大段环境变量的进程（如含 `CODEBUDDY_SESSION_ID`）会一次吐几十 KB 被持久化。改逐个 `pgrep -f "$p" | wc -l` 或 `cut -c1-120`。
- **⚠️ 探测并发写入禁用 `find -newermt '-N seconds'`（2026-09-09 实测恒返回 0，静默假绿）**：本机 BSD find 的**相对时间**写法完全失效——`find . -newermt '-3600 seconds'` 返回 0，同一时刻 Python 扫描实得 446 个；绝对时间 `-newermt '2026-09-09 17:10:00'` 与 `-mmin -2` 均正常。**判定「无并发」前必须看到命中列表为空，而不是看到命令 exit 0。** 首选 Python：
  ```bash
  python3 -c "import os,time;now=time.time();[print(time.strftime('%H:%M:%S',time.localtime(m)),p) for m,p in sorted([(os.stat(os.path.join(dp,f)).st_mtime,os.path.join(dp,f)) for dp,dn,fn in os.walk('.') if '/.git' not in dp for f in fn if now-os.stat(os.path.join(dp,f)).st_mtime<120],reverse=True)]"
  ```
  次选 `find . -mmin -2 -type f`（分钟粒度，够用）。
- **改 `_shared/` 后各讲必须复验**（五层定式见上文「引擎版本对齐是硬约束」下一节）。`_shared` 是跨讲共享源，一次改动可能悄悄破坏未参与改动的讲。

## 2026-09-09 末页导航三坑（勿改回去）

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

## 2026-09-03 第二批固化教训

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

## Resources

### references/
- `AUTHORING.md` — 组件规范与排版预算（构建内容模块前必读）。

### assets/
- `play.command` — 放映启动器模板（QuietServer 版，复制到课程根改标题即可）。

### scripts/
- `export_feedback.mjs` —（备选，沿用原 `polish-slides`）用 Playwright 从某个已打开页面的 localStorage 导出/清空意见。**自动落盘后通常不再需要**——前端把意见写进磁盘 `feedback.json`，打磨流程直接读文件；仅当要从某个特定 origin 的已打开页面导出时用，且要求 origin 完全一致。

### 视频 vsp 补丁同步（2026-09-04）
- 修 video bug 时若只改了部署 HTML 里的内联 engine，**必须把补丁回植到框架 `_shared/deck-engine/engine.js`**，否则重建回归。回植后验收三步：① `node --check`；② 规范化 diff（把 title/SCRIPT_SESSION/VIDEO_CONFIG 归一后 diff，session-3 的 DECK_CONFIG 在 script[0]，script[1] 是 SYNC 层）；③ `_shared/build/deck_builder.py sessionN_content.py /tmp/testbuild` 后 grep 补丁标记。
- 云同步目录 路径上 grep/grep 工具会假阴性，用 python 读文件。

## 线上发布：学生版 deck → 课程主页（2026-09-07 起常备链路）

> 本节的实例值（桶名、域名、主页 repo 路径）是本课程特有的，所以留在这里；**通用的七阶段部署管线（镜像重建 → 裁剪 → 瘦身 → COS 上传 → 发布 → 线上验收）见 `deploy-slides` skill**，不在此重复。

- **工具**：`_shared/tools/deploy/build_publish.py`（幂等，断言式；2026-09-10 从课程根 `tools/` 上提）——源 `04-deploy/session-{N}/index.html` → 主页 repo `<主页repo>/teaching/<课程slug>/session-{N}/index.html`。五变换：媒体 `../media/decks/`→COS 绝对 URL（`<COS_BUCKET>-<AppID>.cos…/<lecture>/media/decks/`）；notes fetch `../../02-script/data/`→`../data/`（JSON 快照随发布）；`openPresenter(){ return;` 禁用 presenter（S 键/按钮全兜底）；删演讲者按钮 DOM；`attachSegButton(){ return;` 禁 ✂ 剪辑器。fonts 整体拷 `out_root/fonts/`。
- **COS 路径段**：`course_root.course_slug()` 只取 `lecture-NN` 前缀（目录名 `<lecture>` → COS 段 `<lecture>`）；不一致时用 `--cos-slug` 覆盖。拼错会**线下正常、线上全 404**。
- **媒体上传**：`rclone copy 04-deploy/media/decks cos:<COS_BUCKET>-<AppID>/<lecture>/media/decks`（420MB/49s；copy 幂等可增量）。上传未完成时浏览器请求 404→`ERR_BLOCKED_BY_ORB`，传完自愈——别误判为坏链。
- **官网接线**：`teaching/<课程slug>.html` lectures[N] 加 `sessions: [url,...]` 字段，renderLecture 优先按 sessions 渲染 `matBtn('Session N', …, 'fas fa-tv')`，无 sessions 才回退 PPT/Notes 占位。
- **脚本自检教训**：字面串残留检查用 `in`，别把含 `.` 的字面串传 `re.search`（`.` 通配会把 COS URL 里 `01/media/decks/` 误判成 `../media/decks/`）；「演讲者视图」字样在注释里也有，只有按钮 DOM regex（`<button[^>]*data-act="pres"`）是真判据。
- **更新流程**：改 notes JSON（免重建）→ 重跑 build_publish + commit/push；deck 重建/媒体改动 → 重跑 build_publish + rclone 增量 → push。公开仓库推送前做 PII 审计。
- **线上验收基线（2026-09-07 首发实测）**：三 deck 27/28/21 页、presBtn/segBtn 均无、notes=ok、COS 图 broken=0、JS 0 错误；官网 Week1 materials 渲染 Session 1|2|3。

## 看片台（缩略图墙）工程教训（2026-09-09）

- **`02-script/index.html` 是生成产物，严禁手工编辑**——唯一权威源是 `_shared/viewer/viewer.template.html` + `build_viewer.py` 的 COURSES 参数集。改产物 = 制造漂移，下次 `--all` 直接覆写。**改完模板必须重建**：`python3 build_viewer.py --all --repo-root "<<课程目录> 根>"`。
- **`--repo-root` 必须指向直接含 `lecture-*` 的那一层（2026-09-09 加守卫）**：误传 `_shared` 会静默生成 `_shared/lecture-0X-*/02-script/index.html` 幽灵产物——内容正确、位置非法、无人引用，排查很费时间。现在 `_resolve_repo_root()` 会校验目录存在、含 `lecture-*`、且不在 `_shared` 内，违反直接 `SystemExit`；单课程 `--root` 同样禁止落在 `_shared` 内。发现 `_shared/lecture-*` 一律视为残留（非权威源，md5 与正确产物相同也只是巧合），用 `trash` 清掉，不要 `rm`。
- **从产物反推模板的可靠手法**（当只有产物被改过、模板是旧版时）：以已验证产物为蓝本，把 7 个 token 的**已解析值**反替换回去（`__TITLE__`/`__H1_EN__`/`__H1_ZH__`/`__SESSIONS_TEXT__`/`__SESSION_LIST__`/`__COURSE_DIR__`/`__LECTURE_ID__`），写完用 `re.findall(r"__[A-Za-z0-9_]+__", s)` 校验残留；再重建产物与备份做 `diff -q`，必须逐字节一致。**各 token 的出现次数会随功能增加而变，不要凭记忆写死**：写脚本前先 `grep -c` 实测（2026-09-10 实测 `__COURSE_DIR__` 4 处、`__SESSION_LIST__` 3 处，旧版笔记写的「各 2 处」已过期）。替换时对每个 token 断言 `count == 期望`，命中数不符立即中止，别写出半对半错的模板。
  - **反向校验只禁「必须被参数化」的字面量**：`<lecture>` 在历史注释（事故复盘、页数说明）里也出现，两个文件本来就一致，一并禁止会假报错。禁的是 `<课程名> · Lecture 2`、`第 N 讲`、`data/session{1..N}`、`[1, 2, 3]`、`return 'LectureNN'`、`polish-feedback-v3:<lecture>` 这些。
  - **产物顶部已加「请勿直接编辑」HTML 注释**（2026-09-10）：警示随生成落到每一讲的 `index.html`，写明被覆盖的真实事故与正确改法。
- **`let board` 在 `renderPage()` 中段才声明 → 所有读 board 的函数不能在它之前调用（TDZ）**。2026-09-10 把首屏统计重算做成 `refreshStatsUI()` 时踩到：原 `renderStats` IIFE 位于 `renderPage` 开头，而 `computeLiveStats()` 要读 `board`，在开头调用会抛 `Cannot access 'board' before initialization`。做法：统计函数定义放哪都行（函数声明提升），但**调用点必须挪到 `board` 声明之后**（本仓库放在 `renderPage` 末尾、`attachFeedback()` 之后）。
- **「丢弃看片台改动」的路径必须按 `revertViewerState() → board = null → refreshStatsUI()` 排序**（2026-09-10 修复）：`refreshStatsUI → computeLiveStats → liveCardState` 会读 `board`，board 还挂着就仍按**未保存**状态算，表现为「关掉看片台后时长没还原」。三处入口同款：`closeBoardSilently` / `closeBoard` / `boardRefresh`。
- **卡片操作的三条语义约定（2026-09-10）**：
  - 多选批量判据 = `board.sel.size > 1 && board.sel.has(sid)`：点在已选中卡片上批量，点在未选中卡片上只影响它自己。
  - **批量删除会清空选中，批量隐藏保留选中**（删除不可逆、留选中易误操作下一批；隐藏保留是为了接着挪剩下的）。因此「撤销批量删除」只能逐张点——测试里必须逐张撤销，否则会漏掉一张导致统计对不上。
  - 隐藏与待删除**都**从逐字稿卡片列表摘掉（`syncViewerState` 只切 `.is-hidden`，不删元素——order 全排列与 `data-page` 对齐都依赖元素在）；保持「看得见就计入时长」这条一致性。取消隐藏时只摘有内容的卡片，空壳（`data-hidden="1"`）留给保存重排后由服务端重建。
- **`video_min` = 该页视频播放时长（分钟），是卡片时间的一半（2026-09-10 补算）**：逐字稿卡片时间 = `en 词数 / 130 + video_min`，顶栏标签写的就是「口播+视频」。但 `video_min` 自建库起恒为 0（`merge_notes.py` 只写死 0 占位），所以卡片时间实际只算口播、deck 里的视频时间从未计入。补算工具：`tools/recalc_video_min.py --sessions 1,2,3 [--apply]`。
  - **口径 = 同页各视频时长之和，但同一文件只计一次**：一页多个视频是分步依次播放（AUTHORING.md 的 Video mode），所以不同片段相加；而 session2 页31/32 是**同一段视频**用 `data-vu=1/2/3` 三个步进分组改 `object-position` 做平移取景，按 3 倍计入会各虚增 204s（合计 6.8 min）——实测这两个页就是靠这条纠正的。
  - 无 `data-start`/`data-end` 烘焙（剪辑片段存 localStorage，是运行时状态），按文件完整时长计。
  - 先校验「deck `<section>` 数 == JSON 扁平页数」且标题逐页一致，不符**拒绝写盘**（宁可不写也不能错位）。
  - 保留 2 位小数（≈0.6s）：1 位会引入 ±3s/页 舍入误差，133 页累计可差数分钟。
  - `video_min` **只存在于 `session{N}.json`**：`reorder_deck` 走 `rebuild_sections` 原样保留 slide dict（已核对），deck_builder 完全不用它（无需重建 deck）；但 `merge_notes.py` 会从外部 spec 重建 JSON 并把 `video_min` 写回 0 —— 那个工具是导入用的一次性脚本，**别在补算后重跑它**。
  - 注意演示器侧是另一套口径：`presenter-inject.js` 的 `durs()` 按 **notes 字符数**估算（下限 12s），与卡片时间（词数+视频）不是同一个数，别互相印证。
- **时长实时重算（2026-09-10）**：`computeLiveStats()` 是唯一口径——看片台打开时 hidden/removed 取看片台 Set、Session 归属取看片台 DOM（`data-sess`，跨 Session 拖动即时把时长挪过去）；关闭时取讲稿 JSON。分节时长仍按 JSON 分节归属（看片台没有分节信息，跨 Session 拖动后「该页算哪一节」保存前无定义）。调用点：`boardApplyOp`、拖拽 `up()`、`openBoard`、三个丢弃路径、`renderPage` 末尾。`SLIDE_INFO` 按 sid 建索引，`en` 缺失按 0 计（不让一页脏数据整页崩）。
  - **测试断言口径**：期望值用 `window.DATA` 原始词数/视频时长现算，**不要加总页面上单页时长**（UI 是「先求和再取一位小数」，逐项取整再加会累积误差）；两个显示值相减误差上限约 0.1 → 变化量类断言容差 0.11、直接比对 0.06。
  - **拖拽类 E2E 必须取「相邻且跨 Session」的一对卡片**：跨几十张时先 `scrollIntoView` 到目标会把源卡片滚出视口，之前缓存的 `boundingBox` 坐标随即失效，`mouse.down` 落在别的卡片上——实测 L01 因此误判。相邻对天然同屏；再按需微调 `.board-grid.scrollTop` 并用网格矩形（不是窗口）校验两者可见。
- **删除 = 搬进垃圾桶暂存（2026-09-10）**：删除不再只是打标记留在网格里，卡片会被搬到
  `.board-trash`（「垃圾桶」页签），网格回到只剩有效页的干净状态；桶内可多选批量还原。
  实现要点，每条都踩过：
  - **还原位置 = 链式锚点**：`board.home[sid] = { next, idx, sess }`，`next` 记的是删除时
    **紧邻的下一张卡片**（不跳过同批删除的！）。逐张还原时顺 `home[next].next` 链找到第一张
    仍在网格里的卡片，插到它前面。若把 `next` 记成「批外第一张」，同批几张的锚点会全部指向
    同一张，逐张还原时后插的排到前面 —— 相对顺序被翻过来（实测抓到）。
  - **DOM 归位由状态决定，不由「点了哪个按钮」决定**：在垃圾桶里点 ◐ 隐藏会同时把它移出
    `removed` 集合，若不按状态重新归位，卡片会留在垃圾桶里而状态已不是删除态。
    正确写法：`removed.has(sid) ? 去垃圾桶 : 回网格（有 home 记录就回原位）`。
  - **`orders` 必须覆盖全部页**：被删的页已不在网格 DOM 里，要按 `data-sess` 追加到所属
    session 末尾——后端 `check_permutation` 要求并集是全排列，漏一个就整体失败；
    `keep_orders` 随后会按 `removed` 过滤掉，所以位置无所谓但**必须出现且归属正确**。
  - **垃圾桶容器要自己绑「点卡片 = 选中」**：网格那条路径在拖拽的 `pointerup` 里按
    「有没有移动过」区分点击/拖拽，垃圾桶没有拖拽，不单独绑就点不动。
  - **删除/还原后必须重跑 `applyBoardFilter()`**：底栏「当前显示 N / M 页」与顶栏 meta 由它
    写；只改 DOM 不重跑会停在旧数字（实测：删 4 页，页签写 339、底栏仍写 343）。
    这条已加负向验证（退回旧实现 → trash 套件 1 号断言 FAIL）。
  - 页签切换清空选中集：否则「还原」按钮会出现在「全部」页签上，语义含糊。
- **【核心坑】`aspect-ratio` + 百分比宽度不可放进 CSS Grid 轨道**：grid 轨道尺寸计算阶段，item 的 inline size 依赖轨道宽度、`aspect-ratio` 又依赖 inline size → 循环依赖，Chrome 把 block size 贡献当作 0 → 行轨道塌成 2px、卡片全部重叠。`minmax(0,1fr)` 和 `1fr` 两种写法**都塌**，改列定义无效。唯一解：`display: flex; flex-wrap: wrap` + `.bcell { flex: 0 0 calc((100% - (var(--cols) - 1) * var(--gap)) / var(--cols) - 0.02px); aspect-ratio: 16/9 }`，`.bsep { flex: 0 0 100% }`，`img` 绝对定位（`position:absolute; inset:0`）切断其参与高度计算。`-0.02px` 是亚像素余量，防 6 个恰好 100% 的项因浮点误差把最后一个挤到下一行。
- **E2E 几何断言必须校验矩形不重叠**：用 `Math.round(rect.top)` 分组算「每行 ≤N」在行塌陷时会**假通过**（同排卡片 top 相同被当成同一行）。必须同时断言：行内 `row[i].l < row[i-1].r - 0.5` 计数为 0（横向不重叠）、相邻行 top 差 ≥ 行高 - 1（纵向不重叠）、`cellH >= 90`（非塌陷）、`img` 实际渲染高度 ≥ 80。
- **看片台每行上限**：`bestGrid(W)` 的 `MAX_COLS = 6` 硬上限 + 由窗口宽度反推（`MIN_CELL=176, GAP=10, PAD=54`），**不再按页数反推高度压进一屏**；总高超出由 `.board-grid` 纵向滚动承担。列宽公式必须把 gap 算进去：`c = floor((avail + GAP) / (MIN_CELL + GAP))`（漏算 gap 会导致实测 cellW 偏小）。
- **跨 Session 拖拽后必须 `resyncBoardSess()`**：`data-sess` 建卡时写死、拖拽后不更新，会让筛选（按 `data-sess` 显隐）与分隔条计数用过期归属。以 DOM 里最近的前一个 `.bsep` 为准回写，在拖拽 `up` 时调用。筛选只改 `display`、DOM 线性序不动，`boardCommit` 的全排列校验才不受影响。
- **多 session 硬编码清理**：`boardCommit` 的 `all` 要用 `Object.keys(orders).reduce(...)` 而非 `[].concat(orders['1'], orders['2'], orders['3'])`；否则 6 session 的 <lecture> 保存重排会丢页。
- **【核心坑】凡是「销毁并重建看片台状态」的入口都必须先判 `board.dirty`（2026-09-09 修复）**。`boardRefresh()`（刷新缩略图）内部 `board = null; keep.layer.remove(); openBoard();`，曾漏掉 `closeBoard()` 里那句 `if (board.dirty && !confirm(...)) return;` → 用户「点 ✕ 删除 → 还没保存 → 顺手点刷新缩略图」时，未保存的删除/隐藏标记被**静默丢弃**，用户看到的是「我明明删了，怎么又回来了」，且零提示。修复即补上同款 confirm 守卫。
  - **排查通则**：用户报「删了又回来 / 改了没生效」时，先问「中间点过哪个按钮」，再顺着所有会重建 state 的入口（`openBoard` / `boardRefresh` / `closeBoard` / 筛选切换）逐个查 dirty 守卫，不要只盯保存链路——保存链路本身可能是对的。
  - 回归断言 = `_shared/viewer/tests/test_board_refresh_dirty.cjs`（R0–R4）；**R2 只认 `type === 'confirm'`，`alert` 不算通过**（首版把 alert 当 PASS，差点漏掉缺陷）。负向验证：删掉守卫 → R2/R3/R4 FAIL 且 `is-removed=false`。
- **刷新缩略图的增量判据 = 页面内容指纹（2026-09-09 需求 D，`since-changed`）**：旧版 `since-solved` 只认 `feedback-history.json` 里 `status=solved` 且 `resolved_at` 晚于上次拍摄的页 → **任何不走意见流的本地更新全部漏拍**（手改 deck、换图换视频、调 VIDEO_CONFIG、改 CSS），点「刷新缩略图」后纹丝不动。新判据三段：① 该页 `<section>` 块的 HTML；② 该块引用的本地素材 `mtime+size`（文件名不变、内容换掉也能发现；素材缺失也计入）；③ deck 级渲染依赖（内联 `<style>`、`VIDEO_CONFIG` 块、`fonts/fonts.css` 及其 `url()` 字体、katex vendor）。**刻意不含 `<script>`**（引擎代码，不随页内容变）与 `feedback*.json`。
  - **【核心坑】任何全局量都不能进「按页指纹」**：首版把 `deckHtml.length` 混进哈希 —— 它是整份 deck 的长度，改任意一页会让**所有页**指纹一起变，等于全量重拍。`test_thumbs_fingerprint.cjs` 的 F2（改一页文字只应重拍该页）实测报 `needed=51` 抓出来的。
  - **升级路径必须处理「老 manifest 没有 `fp` 字段」**：直接判「无指纹→重拍」会让升级后第一次刷新全量重拍（L02 505 页）。用 `缩略图 mtime >= 所有内容输入 mtime` 兜底 —— 确实没变就只**补登指纹不重拍**，变过才拍。F8/F8b 是双向断言。
  - **deck 页数与讲稿页数必须逐 session 对齐**（`<section>` 数 == `session{N}.json` 扁平页数）：对不上就无法按页码取 section，脚本会整段重拍并在 `warn` 里说明。增删页后先核对这个。
  - `DRY=1` 干跑：只算计划、不起 http.server、不开浏览器、不写盘，并回传每页指纹。排查「该拍的没拍/不该拍的拍了」先用它。
  - 回归断言 = `test_thumbs_fingerprint.cjs`（F0–F8b，临时副本 + media symlink，不碰真实仓库）。负向验证：换回旧 `feedback-history` 判据 → F2/F3/F4/F5 全部 `needed=0`、F7 报「一条假 solved 意见就能触发重拍」。
- **缩略图拍摄速度（2026-09-09 需求 E，21 页 2min → 3.1s）**，三处改动按贡献排序：
  1. **同 session 复用浏览器页**：首次 `goto` 后用 `window.__deck.go(n-1,true)` + `setStep(99)` 翻页，**不要每页 goto**。根因是 deck 把整本讲内联在一个 HTML（L02 session-5 有 582 张 `<img>`）且**没有 lazy loading**，每次 goto 都要重下重解全部图片 —— 实测 4.8s/页，绝大部分是重复加载；复用后 0.53s/页。
  2. **`?still=1` + `DECK_CONFIG.magicMove=false`**：still=1 关自动播放（否则视频继续走帧，同一页两次拍到不同画面，缩略图随拍摄时机漂移）；关补间避免抓到动画中间帧。两者都开时，复用路径与 goto 路径的截图**逐字节相同**。
  3. **`reducedMotion:'reduce'` 替代硬等**：deck 里已有 `@media (prefers-reduced-motion: reduce) { animation-duration:0.01ms }`，开这个开关后不必为「opacity 350ms + 最多 240ms 延迟」的入场动画干等，`SETTLE_MS` 可从 500 降到 60。
  - **⚠️ 不要靠压缩 `SETTLE_MS` 提速**：直接压到 180ms 会把**页脚文本块整个拍丢**（沙盒 S3.02 实测 diff 13.6%；500ms 时 0.005%）。加速靠复用页面，不是靠少等。
  - `settlePage` 的视频等待不要「无条件等 seeked + 9s 兜底」：`readyState>=2` 直接定位并返回、`==1` 直接返回，否则等 `loadeddata` + 2.5s 兜底。图片兜底 8s→3s。
  - **验证提速是否安全，必须与「慢基线」逐字节比对**：先 `SETTLE_MS=500` 跑一遍存图当基线，再跑快版，`diff=0.0000%` 才算通过。拿仓库里既有的缩略图当基线是无效的——它们可能是旧 deck 拍的（L01 基线是 Sep 6，deck 是 Sep 9 重建，逐页 diff 高达 60%）。
- **「刷新缩略图」的进度条（2026-09-09 需求 E）**：`shoot_thumbs.cjs` 边拍边写 `PROGRESS_FILE`（**原子写 tmp+rename**，避免读到半截），两讲 `play.command` 提供 `GET /api/reshoot-progress` 回读。前端 `REFRESH_SLOW_MS=5000` 内跑完不显示进度条（快任务闪一下反而干扰），超过后每 700ms 轮询，显示「已重拍 N / M 页 · 当前 SID · 预计剩余 X」。**分子=已拍页数，分母=本次需拍页数**（不是全讲页数）。收尾写 `running:false` 让前端停止轮询。
  - **服务端自己清理旧进度文件**（`_reshoot_thumbs` 里先 `os.remove`），所以连续两次刷新不会读到上一次的 `total/done`；前端不必自己清。
  - **端到端实测**：`live_progress_check.cjs <baseUrl> [session|all]` 打真实服务器（不拦 POST），逐帧采样遮罩文案与进度条宽度；`shot_progress.cjs` 截实拍图。实测推进 0→11.8→30.3→51.3→71.1→85.5→98.7%。
  - **想看进度条得先把任务做长**：提速后一次刷新只需几秒，5s 阈值几乎不触发。临时把演示副本的 `REFRESH_SLOW_MS` 改成 500 再截图，**改完必须还原**（真实产物应只有 1 处 `REFRESH_SLOW_MS = 5000`）。
- **【核心坑】「刷新缩略图」报「未知错误」= deck 首帧加载超时，先量加载再查别的（2026-09-09 事故）**。链路：`shoot_thumbs.cjs` 的 `page.goto(..., waitUntil:'load')` 45s 超时 → `out.ok=false`，而 `failed` 里只有字符串、**没有 `error` 字段** → 前端 `data.error || data.warn || '未知错误'` 落到「未知错误」。所以「未知错误」几乎总是**拍摄端超时**，不是前端 bug。
  - **真凶（本例）**：KaTeX 三件套被**逐次累积注入**。`fx_lib.head_of()` 取「旧 html 直到 `</header>`」，而旧 html 已含上一次注入的 `KATEX` 前缀，`replica_all.page_html()` 再拼一次 → 每跑一轮 fx 补丁页首就多一份。累积到 S5 **每页 25 份、全 deck 7344 个 `<script src=katex.min.js>`**（S1=370 / S2=335 / S4=1637 / S5=7344），浏览器解析 7k+ script 元素，加载从 1.6s 涨到 **60s**。
  - **量法**：`node` 起 Playwright 打 `?embed=1&still=1#/1/99`，记 `Date.now()` 差与 `performance.getEntriesByType('resource')` 按扩展名聚合的字节数。正常单 session ≤2.5s；>45s 必是 deck 结构问题（重复注入）或素材过大。
  - **查法**：`grep -c '<script src="../vendor/katex/katex.min.js"></script>' 03-slides/session-N/index.html` —— 正常值应 ≤ 页数（每页最多 1 个）；远超页数即重复注入。
  - **修法**：`python3 tools/fix_katex_dup.py`（干跑 `--dry`）对每页做「每种注入块只留第一次」，同时写回 `tools/content/session{N}_content.py` 与 `03-slides/session-N/index.html`（**两者必须一致，只改一边下次重建会回退**）。根因修复在 `fx_lib.strip_injected()` + `head_of()` 里先剥离，使生成幂等。
  - **⚠️ 去重只应在两处**：`head_of()`（取旧 html）与 `fix_katex_dup.py`（存量清理）。**不要在 `fx_patch.py` 里对 `patch['html']` 剥**——patch 的 html 本身就该带 KATEX 前缀，剥掉会让公式页失去 loader（本轮真实踩过，S2 的 katex 脚本从 24 页削到 4 页）。
  - **⚠️ 动这块前先确认没有并发 fx 进程**：本工作区曾另有会话在跑 `fx_patch`（`bak/fx-<ts>/` 每分钟新增一个），会边改边覆盖，导致「修好又坏」的假象。用 `ls -dt bak/fx-* | head` 看是否在持续增长。
  - 护栏已加在 `shoot_thumbs.cjs`：deck 内 katex script 块数 > `sections.length` 时在 `warn` 里点名并给出修复命令（**阈值用 `sections.length`，用 `SESSIONS.length*2` 会让 S1 误报**）。
- **【核心坑】缩略图「重影」= 拍到了上一页淡出到一半的中间帧（2026-09-10 事故）**。症状：缩略图上残留上一页的图像（半透明灰字/图形叠在当前页上）。判据很好记：**当前页 opacity 不是 1、且同时有别的 `.slide` 可见**。
  - **根因**：翻页靠 `.slide` 的 opacity 过渡。引擎 `go()` 先把旧页 `classList.remove('active','visible')`、再给新页加，两件事同一帧完成；但旧页 1→0 是**过渡**不是瞬时。而 `style.base.css` 的 `@media (prefers-reduced-motion: reduce)` 只把 `animation-duration` 压到 0.01ms，**`transition-duration` 反而写成 0.2s**：
    ```css
    *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.2s !important; }
    ```
    拍摄端为提速开了 `reducedMotion:'reduce'` 且只等 `SETTLE_MS=60`，截图正好落在淡出中途 —— 实测 178 页**全部**命中，当前页 opacity 只有 0.31~0.53。
  - **修法**：截图前注入一条把过渡/动画全部压成瞬时的样式（`CAPTURE_CSS`，`transition-duration:0s !important`）。它比 reduced-motion 那条规则晚注入、同优先级后者胜出。**只影响拍摄上下文，不改 deck 产物、不影响放映观感**。
  - **⚠️ 不要靠加大 `SETTLE_MS` 修**：那是把 0.2s 过渡等完，既慢又不确定（过渡起点取决于进页时机），505 页要多花 100 秒。`SETTLE_MS` 只管「图/字体/视频是否就绪」，不管过渡。
  - **拍摄前自检已加**：`waitForFunction` 断言「当前页 opacity ≥0.999 且无其它页可见」，超时 2s 才放弃并在 `warn` 里点名。正常路径开销为 0（实测 65 页 7.6s，与修复前同速）。
  - **验证配方**：`capture = 无注入` vs `有注入`，逐页读 `getComputedStyle(act).opacity` 与「可见的其它 slide 数」。修复前 178/178 有重影、修复后 0/178；再与 `SETTLE_MS=500` 的慢基线逐字节比 `diff=0.000%` 才作数。
  - **【关键设计】指纹必须含「渲染配方版本」`RENDER_VER`**：`since-changed` 只比对**页面内容**（section HTML + 素材 mtime + deck 级 CSS/字体），渲染配方变了它**看不出来** → 修好拍摄逻辑后老缩略图永远不刷新。所以把 `RENDER_VER` 混进指纹哈希，拍法一改就全体失效、自动重拍，不必手工跑一次 `full`。**改拍摄逻辑（注入、等待策略、截图参数）必须 +1**，和 `FP_VER` 同理。
  - **本坑跨讲**：`_shared/tools/shoot_thumbs.cjs` 是 L01/L02 共用唯一副本，改一次两讲都受益。<lecture> 实测同样中招（S3.10 标题里透出上一页的「Course at a Glance」），重拍后恢复。
- **【核心坑】指纹测试 `test_thumbs_fingerprint.cjs` 的 F2/F3 会「假红」**：它们取 `sids[中位数]` 当样本页，若该页恰好含 `<style>`/`<link>` 块，改它等于改了 **deck 级渲染依赖**（进指纹 C 段）→ 全部页重拍，断言「只有该页」必然失败。**这是测试的样本选择缺陷，不是指纹逻辑错**。验证指纹正确性请挑一个**不含 style/link 的页**做纯文本编辑，实测 `needed=1` 且 `plan=["1:S1.000"]`。（修复前同样 FAIL，与本轮改动无关。）
- **「刷新缩略图」只刷选中 Session（2026-09-09 需求 E）**：`refreshTargetSessions()` —— `board.filter` 为空集（= 显示全部）返回全部 Session，否则只返回筛中的那些（按课程顺序）。POST 载荷、遮罩副标题、alert 文案都走这个范围。回归 = `test_refresh_scope.cjs`（S0–S6），**拦截 `POST /api/reshoot-thumbs` 校验载荷、不真拍不写盘**。
  - 测遮罩文案时要**gate 住响应**在请求在途时读，否则请求一结束遮罩就被撤掉、只能读到空串（首版就这么假红了一次）。
- **Esc 取消多选（2026-09-09，早已实现勿重复做）**：看片台 keydown 里 `if (board.sel.size) { boardClearSel(); return; }` —— 分层语义：**第一次 Esc 只清多选、第二次才关看片台**。回归 = `test_board_multisel.cjs` 的 M11/M11b。
- **卡片正中「跳转」按钮（2026-09-09 需求 G）**：每张 `.bcell` 加 `.bjump`（↧，圆形，默认半透明常显），点它关闭看片台 → 按 `data-sid`（**不按页码**，页码随拖拽变）定位 `.slide` → 展开所属 session（若折叠）→ 加 `.open` → `scrollIntoView` → `.jump-hit` 高亮 1.8s → 刷新 `updateNavButtons`（展开前 `display:none`，iframe 尺寸为 0）。
  - **⚠️ 核心坑：按钮在卡片几何中心，会与「从中心起手拖拽」冲突**。首版给 `.bjump` 单独监听 click 并在 `pointerdown` 里 `return`，结果 `test_board_drag` D1 与 `test_board_multisel` M7/M8 全线 FAIL（拖不动了）。**正解：不给它独占指针事件**，改在拖拽的 `up()` 里按「指针是否移动过」分流——`moved=false` 且按下目标是 `.bjump` → 跳转；`moved=true` → 拖拽。回归 = `test_board_jump.cjs` 的 J9。
  - 跳转要先 `closeBoardSilently()`（`board.layer` 是全屏 fixed 层，留着会盖住页面）；未保存改动沿用 confirm 守卫。
  - 回归 = `test_board_jump.cjs`（J0–J9）。**J9 必须排在跳转步骤之前**，否则跳转关掉看片台后，一旦 J2 失败就卡死后续步骤（负向验证踩过）。
- **在本环境里起常驻服务器**：`&` / `nohup` / `disown` 起的后台进程会随命令结束被回收，`setsid` 不存在。**要常驻必须用 `run_in_background` 的 Bash 任务**；若要在后续命令里访问，用 `( cmd & )` 子 shell 形式。`play.command` 的内嵌 Python 可用「提取 `<<'PYEOF'` 之间的正文到 /tmp/xxx.py」的方式单独跑，**课程根由 cwd 决定**（`LECTURE_ROOT = os.getcwd()`），因此可把 cwd 指到沙盒副本做无副作用实测。
- **卡片操作按钮组（2026-09-09）**：右上 `.bops` = `.bcopy`（⧉ 复制完整序号 `Lecture0X-SessionNN-S1.003`）/ `.bhide`（◐）/ `.bdel`（✕）；左上 `.bsel`（✓ 多选）**刻意不在 `.bops` 内**。
  - 序号前缀走新占位符 `__LECTURE_ID__`（`build_viewer.py` 由 `lecture_no` 生成 `Lecture%02d`）。
  - `navigator.clipboard` 在 `file://` 下是 `undefined`（非安全上下文）→ 必须 `legacyCopy()` 走 `execCommand('copy')` 兜底，否则复制静默失败。
  - **批量复制（2026-09-09 需求 C）**：选中多张时点其中任意一张的 ⧉ → 一次复制整批序号，`', '` 分隔，顺序 = `board.grid` 的 DOM 顺序（即用户看到的排列顺序）。抽 `boardSidLabel(cell)` 供单张/批量共用；`boardCopyId()` 仅在 `board.sel.size > 1 && board.sel.has(cell.dataset.sid)` 时走批量分支，**未选中或仅选一张必须保持单张语义**（M15/M16 守）。
    - 批量取**全部已选中页（含筛选态下不可见的）**，与「整组拖拽只搬可见页」口径不同 —— 浮条文案必须把两者分别写清，否则用户会以为复制的也只是一部分。
    - 提示条 `boardToast(msg, isErr, multi)`：`multi=true` 加 `.board-toast.multi` 放开 `nowrap` 允许换行（超长裁到 3 行）；**剪贴板内容始终完整**，提示条只是反馈，不要因为显示不下就截断写进剪贴板的文本。
- **多选整组拖拽（2026-09-09 需求 B）**：`board.sel`（`Set<sid>`）+ `.bsel` 点击委托（`stopPropagation`，不触发拖拽）。
  - **选中态**：`.bcell.is-sel` 橙色描边 + inset 阴影，`.bsel.on` 全亮；底部浮条 `.bsel-bar` 显示「已选中 N 页」+「清空」。
  - **`.bsel` 默认 `opacity:.55` 半透明常显**——曾写成 `opacity:0`（仅 hover 显示），视觉自验发现「多选入口看不见」。**多选功能必须一眼可见。**
  - **整组拖拽用「同尺寸锚点 `.bdrop-anchor`」策略**：拖动中只移动 anchor + clone，组内卡片加 `.is-dragging { display:none }` 让位（避免多占 N−1 格导致其余卡片反复重排抖动）；松手后按原 DOM 顺序 `group.forEach(c => grid.insertBefore(c, anchor))` 插入，天然保持组内相对顺序。
  - 整组只含**可见**卡片（筛选态下隐藏的选中页不参与），浮条文案显式说明；指针角标 `.bsel-badge` 显示「N 页」。
  - **`board.sel` 绝不能进 `boardStateKey()`** —— 否则纯选卡会误点亮「保存重排」（M3 断言守住）。
  - Esc 分层：有多选时第一次 Esc 只 `boardClearSel()`，再按一次才 `closeBoard()`。
  - **剪贴板类断言需显式授权**：`page.context().grantPermissions(['clipboard-read','clipboard-write'], { origin })` —— 127.0.0.1 虽是安全上下文，但 `clipboard-read` 默认仍被拒，不授权会让 `readText()` 抛错或读到空串。
  - **`remapFeedbackGlobal()` 页码口径（2026-09-09 修复）**：hidden 页仍占位（放映跳过），removed 页被后端**真删**，故编号必须**跳过 `removedSet`** —— 按含删除页的原始序编号会让删除点之后每一页页码偏大，意见被静默挂到别的页上。
- **云同步目录 回写覆盖（2026-09-09 实测）**：在 云同步目录 路径上写入生成产物后，云端可能把旧版本/冲突版本推回，表现为「构建脚本报 wrote 但文件内容没变」或「刚写对的 L01 产物变回 L02 内容」。**构建后必须立即校验 md5 + 关键标记**（`board-filter`/`MAX_COLS`/`Promise.all([...])` 的 session 列表），并间隔数秒复测稳定性；发现被覆盖就重写并再次校验，不要假设一次写入即落盘。
  - **更强的自检手法**：不依赖文件 mtime，直接 `import build_viewer; build_viewer.render(key)` 拿内存渲染结果，与落盘内容比 `==`。一致说明落盘就是权威模板的产物，云同步目录 没插进旧版本。
    ```python
    import importlib.util, sys, pathlib
    spec = importlib.util.spec_from_file_location("bv", "build_viewer.py"); bv = importlib.util.module_from_spec(spec)
    sys.argv = ["build_viewer.py"]; spec.loader.exec_module(bv)
    out = bv.render("<lecture>")   # 注意 render() 只吃 course_key，不是 (template, cfg)
    cur = pathlib.Path("<course>/02-script/index.html").read_text(encoding="utf-8")
    assert out == cur
    ```

## 源 PPT 动画复现（2026-09-09 落定，L02 S4/S5/S6 全量）

**适用**：把外部源 PPTX 复刻进 live deck 时，需要还原其进入/退出/路径动画与触发顺序。

### 源稿动画的真实口径（先读，别凭想象）

- **三个源 deck 的 `<p:transition>` 全部是自闭合标签**（`<p:transition spd="slow"/>`），即「无切换效果 + 指定速度」→ live 瞬切**语义等价**，无需改动。判断切换有没有效果，看是不是自闭合，不是看有没有 `<p:transition>`。
- `<p:timing>` 里绝大多数效果是 `mediacall`（视频/音频触发），**不是视觉动画**。L02 实测 806 条效果中 458 条是 mediacall，真正视觉动画仅 348 条、涉 28 页。
- 效果分布（L02）：`entr/appear` 107、`exit/appear` 4、`entr/fade` 4、`exit/fade` 4、`path` 2、`entr/flyIn` 1，**时长全为 500ms**。

### 五种动画机制与对应实现

| 源稿效果 | live 实现 | 关键属性 |
|---|---|---|
| 进入 appear/fade | `data-vu="N"` 步进组 + 引擎淡入 | `class="el entr-appear"`（瞬时，覆写 transition） |
| 进入 flyIn | 同上 + 位移 | `class="el entr-flyIn"`（`translateY(28px)` → 0） |
| 退出 exit | 步号到达时隐藏 | `data-vuexit="N"` + `EXIT_JS`（MutationObserver） |
| 路径 animMotion | 步号到达时平移 | `data-mpx/data-mpy/data-mpdur` + `MPATH_JS` |
| 同元素多步（先 appear 再移动） | 元素留原步 + 补零尺寸占位步组 | `data-mpstep="N"` |

### 六个必修缺陷（每个都会让动画肉眼不对）

1. **vstep 开关必须真正写进 HTML**。`vstep` 参数被接收但没落盘 → 步进永不生效（L02 曾 S4 仅 7/23、S5 仅 14/99 页生效）。判据：`if 'data-vu=' in rep: vstep = True`，且 patch 里 `'vstep': True if ('data-vu=' in html or r.get('has_click')) else None`。
2. **组级动画要展开到子元素**。动画作用于 `<p:grpSp>` 时整组联动，而复刻时组被展平成独立元素 → 必须从 `anim_plan.json` 取组步号下发给组内子元素。
3. **路径动画必须判断当前页**：`section.classList.contains('active')`，否则非当前页的路径动画也会播放（踩过）。且过渡时长内采样会读到中途 transform，验收要等过渡跑完。
4. **exit 方向不能反**。源稿 `exit` 是「本步消失」，而 vstep 语义是「本步出现」——直接把 exit 元素塞进步进组会让它反着动。
5. **同一元素的多个动画不能合并**。live 的 `data-vu` 每个元素只能归一组，`spid=6` 先 appear 再沿路径移动会被压成一步 → 补零尺寸占位 div 承载移动步。
6. **源稿首个效果是 `withEffect`（前面无 `clickEffect`）时整批会被丢**。`extract_pptx.parse_timing` 的 `stage==0` 分支跳过 → 从 `anim_plan` 兜底取步号。

### 抽取与验收工具（`tools/fx/`，可直接复用）

- `extract_animations.py` → `animations.json`（切换 + 效果）
- `build_anim_plan.py` → `anim_plan.json`（效果 → 点击步映射）
- `expand_group_anims.py` → `group_anim_map.json`（组结构）
- `extract_motion_paths.py` → `motion_paths.json`（路径坐标）
- `verify_animations.py`：源稿步数 vs live 步组数（**验收口径**：一致=22 / 不一致=0 才算过）
- `probe_anim.cjs`：**浏览器实测**步进/退出/路径，**这是最有价值的验收手段**——静态扫 HTML 看不出时序
- `check_anim_markup.py`：快速自检各类标记是否注入

### 踩坑记录（血泪）

- **禁止连续多次 `h.replace('<div class="el"', ...)`**：第一次替换后该字面量就不存在了，后续替换**静默失效**（本轮 `mpstep` 被 `entr-appear` 挤掉过）。必须一次性拼好 class 与属性再替换。
- `spd` 是字符串（slow/med/fast）不是数字，`int()` 会崩。
- **`<p:cTn>` 是嵌套结构**，非贪婪正则 `(.*?)</p:cTn>` 会错配内层闭合标签。改为「匹配起始标签 + 窗口限定到下个 `presetClass` 之前」。
- **`<p:style>` 主题填充的元素会被抽取器丢弃**：`do_sp` 只读 spPr 的 fill/line，用主题样式上色的形状（spPr 里是 `noFill`）命中末尾「无文字无填充无描边 → 丢弃」。真实案例 5.232 的「右箭头 4」，丢了它整页动画消失。解法：新增 `ELS_ADD` 表补录。
- **大 deck（295 页）浏览器加载**：`waitUntil` 用 `commit`（`load`/`domcontentloaded` 会超时），再等 section 数量稳定。
  - ⚠️ **「两次采样相等即稳定」是错的**：首次采样 n=0 时下一轮立即相等 → 拿到半张页面（`verify_dom.cjs` 曾因此把 S5 的 180 页误判 `no-rep`，几何核验假红）。正确判据：**先要求 `n >= 映射表最大 idx`，再判稳定**；跑完还要断言 `gotN >= wantN`，不满足就显式报错，不能静默出结果。
- 浏览器实测依赖：`createRequire('<skill 安装目录>/binaries/node/workspace/package.json')` 再 `req('playwright')`。
- 沙箱里 `python -m http.server` 后台进程会随命令结束而消失，`verify_dom.cjs` 等脚本直接用 `file://` 协议传 base 即可。

### 动画复现的验收基线（L02，2026-09-09）

| 脚本 | 判据 | 实测值 |
|---|---|---|
| `verify_animations.py` | 源稿步数 vs live 步组数 | 一致 22 / 不一致 0 / 源页未被引用 6 |
| `verify_dom.cjs` | 元素几何逐页匹配 | S4 73/73、S5 293/293，最差偏差 ≤0.1px |
| `probe_anim.cjs` | 浏览器实测步进/退出/路径时序 | 路径 step3 才平移（-154.9, 72.2）；exit 在 2/4/6/8 步依次淡出 |

## 源 PPT 复刻的「白色块」清理（2026-09-10 口径定稿，取代 09-09 三工具链）

**现象**：复刻源 PPT 后页面上出现一块块白色方块。

**成因**：源 PPT 页面背景是纯白，作者用 `fill=#FFFFFF` 画「遮盖矩形」（盖掉旧文字/上一帧再叠新内容）。白底上完全不可见；live 皮肤层把画布改成米色（`--slide-bg:#f7f2e8`）后全部显形。**不是渲染 bug，是背景色变化让源稿的隐形元素显形。** 另有第二类：早期把公式当图片贴进来（`pngcrop/*.png`），改用 KaTeX 重排后图片白底仍留在页面上。

### 判定的正确入口：`tools/fx/white_truth.py`（一次覆盖 S1/S2/S4/S5/S6）

```bash
python3 tools/fx/white_truth.py --thresh 0.93   # 扫描并落盘两张表（阈值见下文，必须带）
python3 tools/fx/white_truth.py --dry-run       # 只看结果
```

产出 `tools/fx/white_transparent.json`（应透明）与 `tools/fx/white_hidden.json`（透明白块时须一并隐藏的元素），外加全量审计 `white_audit.json`。

**(1) 必须读 els 的 `fill`，不能读源 pptx 的 XML。**
源稿的白色常写成 `<a:solidFill><a:schemeClr val="bg1"/></a:solidFill>`（走主题色）或靠 `<p:style><a:fillRef idx="3">` 间接取色。直接正则 `srgbClr val="FFFFFF"` **五个 deck 一个都扫不到**（09-10 实测 0 个）。els 的 `fill` 字段是抽取器已解析的结果，正是渲染器实际用的值。

**(2) 「源稿该处是否纯白」的判据：白占比 ≥ 0.55 且 (白+墨) ≥ `--thresh`（默认 0.93）。**
在源 PNG 上取该 box 区域、**向内收缩 2px** 避开抗锯齿，然后：
- 白 = `min(r,g,b) ≥ 250`；墨 = `min(r,g,b) ≤ 200`；中间调（抗锯齿带）不计。
- 只数白占比会漏：**带文字的白色标签**（"Generation (+ clothing)"）白占比只 0.6~0.9 → 被误判成「源稿里可见」而拒绝透明。
- 只看 (白+墨) 会误伤：**纯深色像素**也满足 `(白+墨) ≥ 0.98`（实测 white=0.065 / ink=0.933）。所以 **白占比必须过半**。
- ⚠️ **阈值 0.97 太严，会让同一行的兄弟元素判定不一致**。实测 S5.123 三个并排图注条（同一份渐变定义、同一 y 坐标）：spid 7 的 box 只有文字 → bg=0.985 入选；spid 8 的 box 顶部被上方人像的腿侵入 → bg=0.970 落选。肉眼完全是同一类白条。
  全量统计后 **0.93 是自然断点**：`bg ≥ 0.93` 的 88 条全是白条；`bg ≤ 0.897` 的（S4.35 spid 19/20 在蓝色 roundRect 里当公式高亮底）必须保留。中间没有样本。
  → **定 0.93**，L02 得 88 个 / 42 页。

**(3) `occlusion()` 只认「更早绘制、且带文字」的被盖元素。**
白块盖住旧文字（S1.010 的 spid 52 盖住 spid 50 的旧 "Generation"），源稿里两者都不可见；透明后旧文字会与新文字**重叠成一团**。因此有遮挡时，那些元素必须一并进 `white_hidden.json`。
但**不要把图片/视频算进去**：它们已被 `white_to_alpha` 转成透明底，直接叠在米色上**与源稿视觉一致**，没有「露出多余内容」的问题。早期版本一视同仁，导致 S1.010 的 spid 41 被无谓保留。
z 序用 els 数组下标近似（els 按源 spTree 顺序抽取 = 绘制顺序）。

**(4) 生成器消费点（两个通路都要改，且改在正确分支）**
- `s12_replica.py` / `replica_all.py` 各自 `_WT` / `_WH` 读 JSON，键 `"S1:10"` → `(sn, no)` 数字元组（`_PFX2NUM = {'S1':1,'S2':2,'S4':4,'S5':5,'S6':6}`）。
- `_render_el` 开头 `if spid in WHITE_HIDDEN.get((sn, no), ()): return ''`。
- 透明时**同时清 `fill` 与 `grad`**：只清 fill 时渐变分支会接管。
- ⚠️ 改动必须落在 `if not ov:` 的**主分支**上，另一条只覆盖少数带 `_ov` 的元素。

**(5) 【易漏】必须同时判 `grad`，不能只判 `fill`。**
作者常用 `<a:gradFill>` 从 `#FFFFFF` 到 `#FFFFFF` 画「白色图注条」（PowerPoint 里用渐变填充但两端同色，效果等于纯色）。只看 `fill` 会整类漏掉：L02 实测 **18 个**这样的元素分布在 **8 个源页**（S5.122/123/139、S6.97/98/115/118/120），全是图注条，在米色画布上留出一条条白横带（S4.157 残 4788px²、S4.294/295 各约 5 万 px²）。
判据见 `white_truth._grad_is_white()`：所有色标都在 `WHITE_VALS` 里 ⇒ 等价于纯白。
⚠️ 本文件的 docstring 曾声称「按 `fill` 字段，漏掉 `grad` 与渲染期被改写的半透明白块」，但那只是**描述**，代码里没有实现 —— 2026-09-10 才发现并补上。

**L02 实测（`--thresh 0.93`）**：88 个应透明 / 42 页；4 个被盖元素需一并隐藏（`S1:10→50`、`S5:131→6`、`S6:103→10`、`S6:110→6`，均已对照源 PDF 确认源稿里本就不可见）。
- ⚠️ **重跑时必须固定阈值**。用默认值会因阈值差异静默"移除"条目（0.98 下丢 S1:10→41、S5:14→9、S5:21→9、S6:22→9；0.97 下丢 7 条）。落盘口径写在这里：**`--thresh 0.93`**。

### 结果度量：`tools/fx2/white_block_scan.py`（像素级，跑在渲染截图上）

前面都是「按元素判」，这个是「按画面判」，两者互补。白 = `max(255-r,255-g,255-b) ≤ 8`，连通域 ≥ `--min-area`（默认 4000 screen px²）；跳过 `hasRep == False` 的纯 live 设计页（它们的白卡片是设计本身）；把每个白区归因到重叠度最高的元素，报 `img`/`bg`/`txt`/`media`/`kx`。

配套 `tools/fx2/shoot_pages.cjs <base> <outdir> [sessions]` 出图 + 每页元素几何（stage 坐标）。
- ⚠️ S1/S2 通路的内层 `.rep` 是 `width:0;height:0`，`getBoundingClientRect().width` 恒为 0 → `repScale=0`。必须读 `DOMMatrixReadOnly(getComputedStyle(rep).transform).a`。
- 几何一律用 **stage 坐标** `(r.left - st.left) / scale`（`scale = st.width/1920`），不要混用 rep 局部坐标。
- ⚠️ **`wb.json` 的 `box` 是屏幕坐标、`stage` 是 stage 坐标；`.els.json` 的 `l/t/w/h` 也是 stage 坐标。归因时两边必须同单位**——混用会把全部结果标错。

#### 【核心坑】扫描器自己会产两类假阳性（不修就得到假数字）

1. **低填充率连通域** —— 细边框、网格线、虚线框的包围盒很大但真实面积很小。
   实测 `mbd6b74ddc8-c0-0-0-0.png` 外圈 1-3px 白描边，包围盒 474×348、填充率仅
   3.5%，被误报成「图片白底」。
   过滤条件：`fill = area / (w*h) < 0.35` → 丢弃。
2. **透明容器抢走归因** —— 复刻层里的圆角框（`roundRect`）、分组壳、位置占位 div
   没有任何 fill/img/text，却因为框大而覆盖住整块白区。实测 S1.010 的绿色圆角框
   `cov=0.980` 夺冠，把底下真正的白源（视频，`cov=0.902`）挤掉 →
   「视频自带白底」被误报成「形状白块」，于是去找一个根本不存在的修复对象。
   过滤条件：只让 `paints = media|img|bg|hasText|hasKx` 的元素参与归因。

另外 `media=true` 的白区里**混着视频封面 `poster`**（`els.json` 不区分），所以
「视频白底 N 处」不等于「N 个视频白底」。

### 视频自带白底 → `mix-blend-mode: darken`（`tools/fx/vid_blend.py`）

**现象**：很多视频是讲者自己的白底 slide 录屏，白底贴到米色画布上就是一块硬白。
L02 实测 109 个被引用视频里 57 个属于此类，涉及 39 页。

**为什么不能 keying**：视频逐帧，白色既可能是背景也可能是内容（白衣服、白墙、白字）；
重编码还会损伤素材。源视频必须保持原样。

**解法（纯 CSS，不动文件）**：`darken` 即 `result = min(backdrop, source)` 逐通道。
- 源为白 → `min(米色, 255) = 米色` → **白底等价于透明**
- 源比米色深 → `min(米色, source) = source` → **逐像素完全不变**（恒等）
- 源比米色浅但非纯白（浅灰）→ 被钳到米色（视觉上本就分辨不出）

**关键安全性质**：对深色背景/彩色照片的视频是**恒等变换**。实测 S1.006b（深底视频）
与 S4.054（无白底）整页像素差 = **0.0000**；S2.027 白占比 0.439 → 0.000、
暗部 0.130 → 0.130（内容分毫未动）。

#### 【核心坑 1】底色必须写 `var(--slide-bg)`，**不能写透明**
`mix-blend-mode` 只在**同一个 stacking context** 内找 backdrop。复刻层的内层 `.rep`
带 `transform: scale(K)`，而 **transform 会创建 stacking context** → 视频看不到页面米色。
实测同一页同一帧：

| 容器背景 | 白占比 |
|---|---|
| 不改（baseline） | 0.1949 |
| `transparent` | 0.1944 ← **几乎没变，等于没生效** |
| `var(--slide-bg)` | **0.0000** ← 生效 |

所以「把容器清成透明」是错的，会让人误以为 mix-blend-mode 本身不奏效。
正确做法是**在隔离组内自己铺一层画布色**。顺带好处：米色取自 CSS 变量，换主题自动跟随；
若画布改纯白，`darken` 对白底即恒等变换（自动退化为「什么都不做」）。
`<video>` 自身的 `background:#000` 也要一并换成 `var(--slide-bg)`（`object-fit:contain`
的信箱区会露底色，用黑会变黑边）。

#### 【核心坑 2】诊断脚本改 `transform` 会制造假阳性
`probe_video_blend.cjs` 为了让截图是 1:1 stage，把 `.rep` 的 `transform` 覆写成 `none`
—— **顺手消掉了那个 stacking context**，于是"看起来生效"。
必须用 `probe_blend_ctx.cjs`（**不改 transform**，逐个试多种 backdrop 写法）才能看到真相。

#### 判据（写进 `tools/fx/white_videos.json`，可审计）

| 条件 | 含义 |
|---|---|
| 首帧（t=1s，失败则回退 0.3/0）纯白占比 ≥ **0.35** | 画面以白为主 |
| 且 暗部（`max(r,g,b) ≤ 60`）占比 < **0.50** | 不是暗底场景 → 白必是背景 |

L02 结果：**57 个视频入列**，0 个因「暗部主导」被排除。
被排除的都是白色作为内容的情况（白衣服、白墙、明亮天空），此时钳到米色会伤内容 ——
宁可少做也不误伤。想关闭就清空 `white_videos.json` 再重建 deck。

#### 影响面
- `tools/fx/s12_replica.py`（S1/S2 的 `_media_html` 两个分支）
- `tools/fx/ext_video.py` 的 `video_html`
- `tools/fx/replica_all.py` 的 `_render_el_blend` 包装（S4/S5/S6 的 media 走 `gen_replica.render_el`，只能字符串替换改写）

改完必须 `regen_replica.py --apply <所有受影响 sid>` + 重建 deck，否则内容模块里还是旧样式。

### 白底图 → 透明：`tools/white_to_alpha.py`（09-09 起）

见下方专节。批量驱动脚本是 `tools/fx2/apply_white_to_alpha.py`（两趟：探测 → 备份 → 转换，只处理 deck 实际引用的图）。

### 【核心坑】自动判定「图表白底」还是「灰色 3D 渲染白底」做不到

`tools/fx2/white_key_charts.py` 的做法是**人工白名单**（18 张），不要试图用启发式自动化。已实测失败的 5 种：颜色中间调占比、灰色连通域尺寸、粗灰腐蚀、膨胀后洪泛、收紧 keying 阈值——**每一种都会在浅灰 3D 模型**（`m2ff4012699-x.png` 等）**上打洞**。图表/线稿/截图需要**全局 keying**（不限于边缘连通），而 3D 渲染需要**边缘连通 keying**，二者的白色在像素统计上无法区分。

keying 的反解（消除白边）：`a = 1 − min(r,g,b)/255`，`F = (p − 255(1−a))/a`。

### 验收基线（L02）

同一扫描口径（`white_block_scan.py --dir <渲染截图>`，min-area 4000）前后对比：

| 类型 | 处理前 | 处理后 |
|---|---|---|
| 图片白底 | 86 | 0 |
| 视频内容白 | 43 | 1 |
| 文字/公式白区 | 10 | 0 |
| 背景/形状白块 | 2 | 0 |
| **合计** | **141** | **1** |
| 涉及页数 | 85 | 1 |

图片层：311 张 deck 引用图中 131 张边连通 keying + 18 张全局 keying（1 张 jpg→png 改扩展名，引用同步改写）。
视频层：57 个白底视频加 `mix-blend-mode:darken`（见上文专节）。
**最终剩余 1 处**：`S1.011` 的视频 `vaad48c8602.mp4` 是 3D 雪地/地形场景（白占比 0.166，未过 0.35 门槛），白色是雪与天空，**是内容**，正确排除。

回归全绿：`verify_session` 65/91/111 OK、`font_audit` 0 缺口、`font_truth` 0 不符、`check_deck` ALL CLEAN ×3。

- ⚠️ **不能只按 `fill=#ffffff` 无脑透明**——先跑 `white_truth.py` 区分「源稿真纯白」与「压在有色内容上/被上层盖住」，否则会误删公式底色或露出下层不该露的内容。
- ⚠️ 改元素表后 `verify_session.cjs` 会报「缺元素」——它需加载 `white_hidden.json` 跳过隐藏 spid。注意键格式：JSON 里是 `"S1:10"`，脚本里的 `srcKey` 是 `"S1.10"`，要做 `srcKey.replace('.', ':')`。
- ⚠️ `verify_session.cjs` 的 base 是 `http://127.0.0.1:8795` 这类根路径时**必须显式传空 prefix**（`... 1 "" ""`）：缺省 prefix 是 `/<lecture>`，配根路径会拼出不存在的 URL，全部页报 `no-active-section`（看起来像全崩，其实是路径错）。

### 邻接查出并修掉的真 bug：`CLIP_PATHS` 预设几何覆盖不全 + 两条通路分叉

清白块时发现 **S1.010 两块绿色圆角框之间的双向箭头 ⇔ 被渲染成灰方块**。
根因：`gen_replica.geom_style()` 对 `prstGeom` 只处理 `roundRect`/`ellipse` 与
`prst in CLIP_PATHS`，**其余一律静默退化成矩形**（不报错、不告警）。
而补齐表只写在 `replica_all.py`（管 S4/S5/S6），`s12_replica.py`（管 S1/S2）**根本没有**——
`_reapply_gen_patches()` 里甚至写着「本通路不需要 replica_all 的额外预设几何」，
这个判断是错的：预设几何与画布几何无关，S1.010 的 `leftRightArrow` 就是反例。

**修法（已落定）**：表搬到 `tools/fx/extra_clip.py` 单一来源，两条通路都
`from extra_clip import EXTRA_CLIP`（`s12_replica` 在 `_reapply_gen_patches()` 里
`dict(G._PRISTINE['CLIP_PATHS'], **EXTRA_CLIP)`）。全量未覆盖 prst 统计：

| prst | 处数 | 所在源 deck |
|---|---|---|
| `flowChartMerge` | 15 | S6 |
| `wedgeRoundRectCallout` | 5 | S5 |
| `flowChartOr` | 2 | S5/S6 |
| `leftRightArrow` | 2 | S1 |
| `rightBrace` | 2 | S1 |
| `wedgeEllipseCallout` | 1 | S6 |

- ⚠️ 新增任何 `prstGeom` 支持时**必须改 `extra_clip.py`**，不要改 `replica_all.py` 里的局部表（会重新分叉）。
- ⚠️ 排查方法：遍历 5 个源 deck 的 els，收集所有 `k=='shape'` 的 `prst`，与
  `set(CLIP_PATHS)|{'roundRect','ellipse','rect','line'}` 求差集，**只看有 fill 的**（纯描边的形状退化成矩形也看不出来）。

## 源 PPT 复刻：S1/S2 与 S4/S5 的关键差异（2026-09-09 落定）

S1/S2 用 `tools/fx/s12_replica.py`（不是 `replica_all.py`）。**两套通路只差画布几何，但差异会咬人**：

| 项 | S1/S2 | S4/S5 |
|---|---|---|
| 源画布 | **960×540 pt**（`canvas_emu=[12192000,6858000]`） | 960×720 pt |
| stage | 1920×1080，`s=1.5` | 1440×1080 |
| pt→px | **×2**（`pt*(4/3)*1.5`） | 不同 |
| 生成器 | `s12_replica.py` | `replica_all.py` |

**⚠️ 绝不要 import `replica_all`**——它在模块级直接打 S4/S5 专用补丁（`STAGE_W=1440`、`K=0.73148`、bullet 缩进表），import 即污染 S1/S2。需要它的工具函数就抽到独立模块（如 `tools/fx/metrics.py` 的 `est_lines_real`）。

**源画布不是 1280×720**：1280×720 只是 @96dpi 的 px 值；pt 值是 960×540。所以 pt→stage 就是 ×2，**不要**再乘 1.25 去凑 1600 宽的 PNG。

### 字号被静默缩小（52.9px ≠ 56px）

`gen_replica.render_paras` 的 shrink 判定是 `est > h_px*1.04`，但 `est` 用**行高 1.22** 累加、真正渲染用**行高 1.098**。11% 高估会把多段文本框顶过阈值 → `shrink<1` → 28pt 的 56px 被压成 52.9px。

**修法**：把 `G.est_lines` 替换成 `return 0`（不是 `return 1`——返回 1 仍会按「1 行 × 1.22」累加）。返回 0 利用 `and est > 0` 短路，est 恒 0 → shrink 恒 1.0。

**验证方法**：`tools/fx/fs2.cjs` 量「非 KaTeX 的 span」字号，必须和**源 PDF**（`get_text('dict')` 的 `size`）比，不要拿旧截图当基准。deck 里看到的字号也可能是**旧构建**——重建后必须重新量。

### 翻转形状里的文字方向（S2.012/013 箭头标签）

`gen_replica` 只把 `flipH/flipV` 写进 `.elg`（几何层），`.rtxt`（文字层）不动 → 几何翻了、文字还按 `rot` 摆着，差 180°（文字上下颠倒）。

**实测源 PDF 文字基线方向（8/8 全中）**：`flipV` 生效时 **净方向 = rot + 180**。
**修法**：只给 `.rtxt` 加 `transform:rotate(180deg)`（`.el` 已带 `rotate(rot)`，`.rtxt` 是 `inset:0` 同心，叠加后正是 rot+180），`.elg` 的翻转保持不变。
**安全前提**：`rotate(180deg)` 绕中心转，只有 `anchor=ctr` + `algn=ctr` 时文字落点不变——L02 的 8 处全满足，代码里要加 `centered` 守卫。

### 下标/上标字号

`font-size:.72em` 的 `em` 相对**父元素**（`.rtxt`/`<p>` 都没设 font-size → 落到默认 16px），`.72em` = 11.52px，而源稿是 `48px×0.72 ≈ 34.6px`。
**修法**：从同一 span 已写好的 `font-size:NNpx` 反解出本 run 字号再 ×0.72，写绝对值。
**同处必查**：`render_paras` 产出的 style 末尾**常无 `;`**（如 `color:#1c1c1e`），拼接前不补 `;` 会得到 `color:#1c1c1evertical-align:sub` → 颜色解析失败、字号丢失。

### 复刻层溢出（check_deck 报 bottom/right 越界）

内层 `.rep` 是 1920×1080 + `translate(-bx0,-by0)`，它**自身**的包围盒会越出舞台（子元素其实都在外层 clip 容器内，视觉无问题，但 check_deck 遍历所有后代）。
**修法**：内层改成 `width:0;height:0;overflow:visible`——零尺寸被 check_deck 的 `b.width>0`/`b.height>0` 守卫跳过，坐标原点语义不变（点 p → k·(p−b0)），子元素照旧绝对定位在 stage 坐标上。**必须显式 `overflow:visible`**，否则 CSS 里 `.rep` 默认的 `hidden` 会裁掉全部子元素。

### S1/S2 复刻的标准流程

```bash
python3 tools/fx/s12_replica.py 1 --out /tmp/p1.py     # 生成补丁
python3 tools/fx/s12_replica.py 2 --out /tmp/p2.py
python3 tools/fx_patch.py 1 /tmp/p1.py                 # 写入 content 模块
python3 tools/fx_patch.py 2 /tmp/p2.py
python3 ../../../_shared/build/deck_builder.py tools/content/session1_content.py 03-slides/session-1
python3 ../../../_shared/build/deck_builder.py tools/content/session2_content.py 03-slides/session-2
node ../../../_shared/deck-engine/check_deck.mjs 03-slides/session-1
node ../../../_shared/deck-engine/check_deck.mjs 03-slides/session-2
node ../../../_shared/deck-engine/final_accept.mjs http://127.0.0.1:8412/<lecture>/03-slides session-1 session-2
```

- `check_deck.mjs` / `final_accept.mjs` 吃**目录**或 **http_base**，不是文件路径。
- 视频 seek 需要 Range 支持：`_shared/viewer/tests/lib/range_server.cjs`（`ROOT=<课程根> PORT=8412`，须 `run_in_background`）。
- `final_accept` 的正确调用：`node final_accept.mjs <http_base> [deck1 deck2 ...]`，deck 名是 `session-1` 这种（不是路径）。

## 复刻页保真核验链（2026-09-10 落定，L02 三套全量通过）

用户要求「确保每张 slide 的布局、元素位置、字体与样式、动画触发方式与顺序都与源 PPT 一致」。
为此建立**五层客观核验链**——每层都有独立真值来源，不靠肉眼。**改任何生成器逻辑后，五层全跑**。

| 层 | 工具 | 真值来源 | 判定 |
|---|---|---|---|
| 1 生成器一致性 | `tools/fx2/sync_check.py` | 当前生成器重算结果 | 已落盘 html == 重算 html（0 脱节） |
| 2 元素几何 | `tools/fx2/verify_session.cjs <base> <sn> [sids] [prefix]` | els 的 box（绝对 stage 坐标） | 双向最近邻，TOL=3px |
| 3 视觉动画步数 | `tools/fx2/timing_truth.py` + `export_anim.py` | 源 pptx `<p:timing>` 的 mainSeq | 剔除 mediacall 后的步数 |
| 4 字号 | `tools/fx2/font_truth.py --sn 1 2 3` | **源 PDF 的渲染字号** | `css_px == pdf_pt × 2` |
| 5 引擎级 | `_shared/deck-engine/check_deck.mjs <deck_dir>` | 浏览器实测 | ALL CLEAN |

**关键：字号真值必须取源 PDF**（`pymupdf` 的 `get_text('dict')` 的 `size`），不要拿 pptx XML 的 `sz`——
继承链走错时 XML 值本身就是错的（见下）。核验 session-3 时 `verify_session` 的 prefix 传 `''`（play.command 的服务根就是课程目录）。

### 九类根因（都在 `tools/fx/`，成因已写进代码注释）

1. **monkey-patch 跨模块污染**：`gen_replica` 是单例，`s12_replica` 与 `replica_all` 都改它的
   `est_lines`/`render_paras`/`esc`/`CLIP_PATHS`，**谁后 import 谁赢**。`regen_replica.build_html`
   同进程混用两条通路 → 先渲染 S4 页会把 S1/S2 的 shrink 打开。
   修法：文件顶部用 `G._PRISTINE` 固定原始实现，各模块 `_reapply_gen_patches()` 每次渲染前
   **从 pristine 逐级重建自己的链条**（链条要逐级对齐，只把根部指回 pristine 会跳过中间层修正）。
2. **辅助表「表非空就跳过」**：`pptx_props.WRAP` / `alpha_fill.ALPHA` / `ph_geom._CACHE` 被两条通路共用，
   后一家看到「非空」就永不加载 → nowrap / 半透明 / 占位符几何静默缺失。
   修法：三张表的 `load()` 改成**按 `(sn, rel)` 增量加载**，调用方无条件调用。
3. **字号继承链走错**（`tools/fx/size_truth.py`）：普通 TextBox（`<p:sp>` 无 `<p:ph>`）被按母版
   `bodyStyle` 取 28pt，而 OOXML 规定它继承 `presentation.xml` 的 `defaultTextStyle`（本 deck 18pt）。
   继承顺序：run `sz` → 段落 `defRPr` → 形状 `lstStyle` →（**仅占位符**）layout 占位符 → master 占位符
   → master txStyles → `defaultTextStyle`。最后乘 `bodyPr/normAutofit@fontScale`。
4. **项目符号继承丢失**（`bullet_truth.py` + `bullet_fill.py`）：els 只记显式 `buChar`
   （全量 2388 段里仅 108 段），母版继承的圆点全丢。同时补 `marL`/`indent` 悬挂缩进。
   注意：`sldNum`/`ftr`/`dt` 占位符**不能**按 bodyStyle 取（会给页码安圆点）。
5. **空段被抽取器丢弃**（`para_truth.py` + `blank_fill.py`）：只含 `<a:endParaRPr>` 的空段是撑开
   行距的实体。空段必须用 `\u00a0` 而非空串——`render_paras` 会跳过空 run，字号塌到 16px。
6. **行距用固定系数 1.18**（`line_truth.py` + `line_fill.py`）：该系数按 Calibri 校准，
   Helvetica Neue 自然行高约 1.4。改为**从源 PDF 实测**：行距 = 段内折行的行进量 ÷ 字号；
   段间距 `gap = (dy - (li_b - li_a + k)·lh_pt) / (k+1)`。三个坑：
   - 漏 `+k` 把空段当零高度（7.1pt → 36.3pt）；按「1 次行进」算又把段内折行全算成段间距
     （S4.8 得出 112pt，页面溢出 1254px）。
   - 行距只能取**段内折行**的行进量；元素只有一段且不折行时，唯一的行进量其实是跨段距离。
   - 要按**字号过滤**混入的邻元素文本行（S4.39 的 32pt 框混进 18pt URL 行 → 3.0em）。
7. **shrink 自动缩字**：按**我们自己估的行数**反推缩放，估大就静默改字号（S6.171 的 28pt → 23.4pt）。
   硬约束是「字号用源值」，故彻底关闭：`G.est_lines = est_lines_noshrink`（恒返回 0）。
   PowerPoint 自己的 `normAutofit fontScale` 另走 `fscale`，保留。
8. **动画步数来源不可靠**（重建 `tools/fx/build_anim_s12.py`）：旧 `anim_s12.json` 把
   `interactiveSeq`（点**视频本身**的暂停/继续）算成翻页点击 → 步数虚高（S2.012 5→3、S2.013 3→1）；
   组动画（`<p:grpSp>`）的 spid 未展开成子元素 → 丢步（S1.013/031）。
   判据是「该步有没有**非 mediacall** 效果」，不能写成「有没有 clickEffect 且非 mediacall」
   ——PPT 允许一组的首个效果是 `withEffect`（S2.42 被误判成媒体步）。
9. **占位步的语义未标注**：为对齐点击次数补的零尺寸 div 分两类——只含 mediacall 的（不算视觉步）
   与视觉动作重复出现的（算，如 PowerPoint 的「按段落逐条出现」）。加 `data-phkind="media|visual"`，
   核验器据此判定。

### 踩坑
- **`_render_el` 有两个分支**：`if not ov:` 那条只覆盖带 `_ov` 覆写的少数元素；绝大多数走下面
  `G.render_el` 的主分支。改文本后处理要落在主分支上才生效（2026-09-10 白改一次）。
- `#/N/S` 的 N 是 **1-based**（`window.__deck.page() === N-1`）。
- live `S3.*` 的源 deck（CVPR2019）在 els/media_map 里编号是 **4**；`S4.175→S6.133`、`S4.207→S6.163`。
- `els_path` 在 `_archive/tools/replica/els/session{N}/`（不是 `slide-library/decks/external/.../slides/`）。
- 校验器只对**有 `.rep fullbleed` 的页**做几何比对；纯 live 页跳过。

### 复刻页重生成的标准流程（改生成器后必跑）

```bash
# 1) 找出全部复刻页 sid
python3 - <<'EOF'
import sys, os
ROOT='<lecture_root>'
for p in ['tools','tools/fx','tools/fx2','tools/content']: sys.path.insert(0, os.path.join(ROOT,p))
import regen_replica as RR
out=[]
for sn in (1,2,3):
    mod=RR.load_mod(os.path.join(ROOT,f'tools/content/session{sn}_content.py'),f'sc{sn}')
    ids=RR.live_ids(sn)
    out += [ids[i] for i,sl in enumerate(mod.DECK['slides']) if 'rep fullbleed' in (sl.get('html') or '')]
print(','.join(out))
EOF
# 2) 重生成 -> 3) 一致性 -> 4) 重建 deck -> 5) 五层核验 -> 6) 刷新缩略图
python3 tools/fx2/regen_replica.py --apply "$SIDS"
python3 tools/fx2/sync_check.py
for n in 1 2 3; do python3 _shared/build/deck_builder.py tools/content/session${n}_content.py 03-slides/session-$n; done
node tools/fx2/verify_session.cjs http://127.0.0.1:8321 {1,2,3} "" ""
python3 tools/fx2/font_truth.py --sn 1 2 3
node _shared/deck-engine/check_deck.mjs 03-slides/session-N
node _shared/tools/shoot_thumbs.cjs <lecture_root> 1,2,3 "" since-changed
```

**验收基线（L02，2026-09-10）**：`sync_check` 0 脱节 / `verify_session` 65+91+111 全 OK /
`font_truth` 0 不符 / `font_audit` 0 缺口 / `check_deck` 三套 ALL CLEAN /
缩略图增量 125 张 0 失败。

## 品牌化 + 构建顺序（`tools/branding.py` + `tools/rebuild.sh`，2026-09-10 落定）

把「别人的课」改成本讲自己的课。三件事：首页署名、结束页沙漏、抹掉原作者姓名。
**版式 1:1 抄 LectureNN**（`<lecture>/tools/content/session*_content.py`）。

### 首页（`cover`）
```html
<div class="cv">
  <div class="cv-kicker rv">WESTLAKE UNIVERSITY · DIGITAL HUMANS · FALL 2026</div>
  <div class="cv-band rv d1"><h1 class="cv-title">Lecture 02<br>Body Models</h1></div>
  <div class="cv-meta rv d2">
    <div><b>Instructor:</b> <作者> · <实验室></div>
    <div><b>TAs:</b> <TA 名单></div>
    <div><b>Session:</b> Lecture 02 · Session N — <副标题></div>
  </div>
</div>
```

### 结束页（`closing` + 沙漏）
抄 LectureNN 的 `<style>.brk-*/.hg-*</style>` + `.cls/.brk-row` 结构 + 倒计时 JS
（`DUR=300000`，随 `window.__deck.page()===idx` 启停，`--p` 驱动沙漏 CSS）。
**注意**：LectureNN 只在 session1/2 的末页放了沙漏，session3 没放。本次按用户要求
**三套都放**。

### 姓名脱敏的判据（关键，别一刀切）

不要无脑全删。判据是「**是否暴露讲课人另有其人**」：

| 位置 | 处理 | 理由 |
|---|---|---|
| 逐字稿**说话内容字段**（`lines`/`enter`/`exit`/`q`） | 改写或整行删 | `taught by Professor <原讲者> of the University of Tübingen`、`based on SMPL Made Simple tutorial + talk by <原讲者>` 这类句子直接暴露 |
| 逐字稿 `facts`（备课便签） | **保留** | 不上幻灯也不进讲稿，是讲师自己的备课笔记 |
| 页面上的**文献引用** | 删作者名，整段重建为「标题 + 会期 + 年份」 | 用户当次明确要求「全部抹掉」。重建后顺便去掉原本表示可点击的蓝色 `#0070C0`，视觉更干净 |
| `_shared/deck-engine/` 里作**注释示例**的人名 | 换成中性词 | `/* next 为汉字（如 "你好。"）*/` 这类 |

实测 L02：逐字稿命中 36+12+4 条；引用 24 处（10 个不同段落）。

### 【核心流程坑】三步有强顺序依赖 → 一律走 `tools/rebuild.sh`

```
regen（生成器从源 PPT 重算复刻页 html，**覆盖整页**）
  → brand（首页/结束页/姓名与引用脱敏）
    → build（deck_builder 渲染成 03-slides/session-N/index.html）
```

**先 brand 后 regen 会静默丢改动** —— 实测 20 处引用脱敏被写回带作者名的原样。
更阴的是**中间态 grep 还是干净的**（因为还没 regen 重算），到 build 完才发现。
`rebuild.sh` 末尾自带自检：姓名残留必须 0、沙漏必须存在，任一不满足就非零退出。

```bash
bash tools/rebuild.sh                 # 全量
bash tools/rebuild.sh --no-regen      # 只 brand + build（改文案时）
bash tools/rebuild.sh --sids S3.041   # 只 regen 指定页
```

### 脱敏实现上的两个正则坑

1. **不能对「Python 源文件文本」用 `\b`**。源文件里不换行空格写成转义序列 `\xa0`
   （4 个可见字符），于是 `...Romero, J.,\xa0Black, M. J...` 在源文本里是 `0` + `Black`
   —— 两个都是 word char，`\bBlack\b` **匹配不到**（实测 8 个引用段被静默跳过，
   而 deck 里明明还有）。改用 `(?<![A-Za-z])Black(?![A-Za-z])`。
2. **不要用「逐个删作者名 token」**。会把 `Bolkart, T., Black, M.J.,` 里的分隔逗号
   一起吃掉，渲染成 `BolkartTzionas`。改为**整段重建**（显式列举引用段，L02 只有 10 个）。

### 备份策略：4.1 GB 媒体不要进 云同步目录

`03-slides` 的 4.1 GB 里 99% 是 `media/`。整体复制进 云同步目录 会触发 4.1 GB 重传。
拆成两份：
- 项目内 `03-slides-bak/`（`rsync -a --exclude 'media/'`，约 34 MB）—— 覆盖会改动的一切
- 本地磁盘 `<备份目录>/media-<ts>/media`（非 云同步目录 路径）

⚠️ **真正的排版源不在 `03-slides/` 里，而在 `tools/content/session*_content.py`** ——
备份时容易漏。连同 `02-script/data/` 一起存。

## 排版拟合：让复刻页铺满舞台（`tools/fx/fit.py`，2026-09-10 落定）

**现象**：复刻页内容挤在中间，左右各留一大片空 —— 用户报「绝大多数内容都聚集在
中间百分之六七十的区域里」。实测 **session-3 有 96/111 页横向填充率恰好 0.57**
（1053/1840）。根因有两条，都不在「排版」上，而在**缩放的算法**上：

| 通路 | 原算法 | 问题 |
|---|---|---|
| `replica_all.py`（S4/S5/S6，源 4:3） | **固定 `K = 0.73148`** | 该值是「整张 1440×1080 画布塞进可用高」算出来的，**完全不看内容占多大**。源页四周的留白被原样搬过来 |
| `s12_replica.py`（S1/S2，源 16:9） | `k = min(W/cw, H/ch, **1.0**)` | 上限 1.0 只能缩不能放（为守「字号不超源稿」的旧硬约束） |

**修法**：按**内容包围盒**求统一缩放 `k = min(W_avail/cw, H_avail/ch)`（`fit.py`）。
**统一缩放是关键** —— 等比变换保持所有元素的相对位置、尺寸与图层指向，所以
「箭头指公式」「文字跟图片」这类有明确指向关系的版面**无需特殊处理**，放大后自动
仍然对齐。可用区取 `W=1920 / H=(1026-236)=790`（上让 header 底、下让页脚）。

实测（208 个复刻页）：中位横向填充 **0.57 → 0.66~0.73**，纵向填充中位 **0.98~1.00**，
**202 页变好 / 6 页不变 / 0 页变差**，平均 +0.19。

### 【三条必踩的坑】

1. **`k` 必须允许 < 1（收缩）**。把下限定成 1.0「不必要就不缩」是错的：源内容本来
   就大（`ch` 接近整张画布）的页面无法收缩，直接冲出容器 —— 实测 session-2 有
   15 页报 `overflow bottom 1090~1250px`。「2D 拟合」的语义就是**大了要缩、小了要放**。

2. **`replica_all` 的内层 `.rep` 必须做成 `0×0` + `overflow:visible`**（与
   `s12_replica` 一致）。原来它声明 `1440×1080`，带 `scale(k)` 后**自身包围盒**
   变成 `1440k×1080k` —— k 到 1.3 就是 1872×1404，直接冲出 1920×1080 视口，
   `check_deck` 报 `overflow bottom 1247px`（视觉上没问题，纯粹是包围盒）。
   `s12_replica` 早就这么做，本模块此前漏了 —— 因为改 k 之前它固定 0.73，永远缩不会放。
   塌成 0×0 后 `check_deck` 的 `b.width>0 && b.height>0` 守卫会跳过它。

3. **外框高度取满 `avail`，不能取 `h_px`**。内容比可用区矮时要垂直居中（`offy>0`），
   外框取 `h_px` 就包不住居中内容 —— 实测 S4.243/S4.247 外框 236..426、内容从 536
   开始，越界 300px。

### `SAFETY_PAD`：为什么两侧要故意内缩 8px

内容包围盒是按**元素盒**算的，而 `.rtxt` **刻意不设 `overflow:hidden`**（源稿允许文字
溢出形状框，是复刻的既有约定）。文字的**视觉**范围因此会比盒子略大 —— 实测 3 页溢出
4~11px，被外层 `overflow:hidden` 切掉（可能切到降部）。两侧各让 8px ≈ 用掉 2% 空间，
视觉察觉不到。改完剩余越界 **1 页 3px**（可接受）。

### 测量工具（都在 `tools/layout/`）
- `survey.py` —— **静态**量算：解析产物 HTML 的 `.rep`/`.el` 几何，算内容外接矩形 ÷
  可用区 = `fw`/`fh`/`fa`；并按元素构成分类 `LOOSE`（可重排）/ `LOCKED`（含公式或
  线/箭头 → 保结构）。**改任何几何前先跑它**，用数字定位病灶。
- `check_fit.cjs` —— **渲染后**量算：拿 DOM 包围盒比对外层容器边界，发现「内容被
  `overflow:hidden` 裁掉」。**改完 k 必跑** —— 拟合是「外层 top/height + 内层
  translate+scale」的组合，算错一处就会悄悄丢内容。
- `check_presenter.cjs` —— 三套 presenter.html 冒烟（改共享引擎后必跑）。
- `measure_safe.cjs` —— 量 live 设计页的实际安全区（本次没用上：它返回 0/1920/1080
  全幅，因为 live 的 `.slide` 自带 padding，量到的是 padding 外框，没有信息量）。

### ⚠️ 不要试图「重排」「改字号」来解决不饱满
用户的直觉描述是「排版不饱满」，但**根因是缩放没做二维拟合**，不是版面结构问题。
真正需要「重排」的只有极少数（内容构成确实稀疏的页），而**逐页二维拟合一次性
解决了 202/208 页**。先做拟合，再看还剩哪些真的需要重排。

## 白底图 → 透明背景（`tools/white_to_alpha.py`，2026-09-09）

源 PPT 图多为纯白底，贴到米色画布上会出现白方块。**不用分割算法**的纯几何解法：

1. **白判定** `d(p) = 255 − min(r,g,b)`（离白最大通道差）。核心白 `d ≤ 8`，抗锯齿带 `d ≤ 32`。不用「RGB 全 ≥ 250」——会把 (255,255,0) 这类偏色算成白。
2. **只处理与图像边框连通**的白色区域（scipy 连通域，无 scipy 退回 BFS）。被主体包围的内部白（白衬衫、白纸）不接触边框 → 保持不透明。**这是「不用分割还能保住主体」的关键。**
3. **过渡带精确反解**（un-premultiply）：`a = 1 − min(r,g,b)/255`，`F = (p − 255(1−a))/a`。满足白底合成恒等式 `F·a + 255(1−a) = p`，叠回纯白**逐像素相等**（实测 max|Δ|=0），既无白残边也无硬锯齿。
4. 边缘连通白区占比 < `--min-bg-frac`（默认 10%）的图**原样复制**。

**验证标准**（用户明确要求）：处理后叠在纯白上必须与原图完全一致——脚本内置 `verify()` 自动断言。

**CLI**：`python3 tools/white_to_alpha.py --inplace DIR [--recursive] [--dry-run] [--report J]`（或 `--in DIR --out OUT`）。输出统一 PNG（RGBA）。需 managed python（有 PIL/numpy/scipy）。
- `--inplace`（09-10 新增）：src == dst 时跳过 `copy2`，jpg→png 转换后删掉旧文件。原来必须 `--out` 到另一个目录，批量改引用很别扭。
- **批量驱动**：`tools/fx2/apply_white_to_alpha.py`（两趟：探测 → 备份 → 转换）。只处理 deck 实际引用的图，不碰 `_archive/`。备份落到 **非 云同步目录** 路径（`<备份目录>/media-orig-<ts>/`）——曾试图把 4.1 GB 媒体备份进 云同步目录，同步风暴，撤了。
- 改扩展名（`m250a619f21.jpeg → .png`）后**必须同步改写引用**：`tools/content/session2_content.py`。
- `tools/fx2/img_white_scan.py` 可先全量扫描候选（与 `white_to_alpha` 同一判据，即边缘连通白），再决定批量范围。L02 实测：扫描 311 张 deck 引用图，131 张转透明。
- 与 `white_key_charts.py` 的分工：本脚本只动**边缘连通白**（保住白衬衫、内部白纸）；图表/线稿/截图那 18 张需**全局 keying**，走白名单。

## 往 deck 里插入一张源 PPT 页（2026-09-09 落定）

用户会说「把 source.pptx 第 N 页加上，插在 Sx.yyy 前面」。参考实现：
`tools/insert_s1_002.py`（L02 插入源页 2 → S1.002）。

**关键步骤**

1. **先确认源页内容，别信用户给的关键词**。用户按「内容」指认，关键词可能不在页面文字里。
   实例：用户说「第二页关于 civilization 的」，但源页 2 唯一文字是 `Images from wikicommons`
   ——"civilization" 在 **notesSlide1 的讲稿**里。用 `pymupdf` 读 PDF 文字 +
   渲染 `slides_png/slides_png.NNN.png` 目视核对，两边都要看。
2. **确认它真的没被生成过**。L02 的 S1 映射是源页 1 → 源页 3（S1.000 → S1.003），源页 2 从未进 deck。
   查 `02-script/data/session{N}.json` 的 sid 序列即可。
3. **生成复刻层**：`s12_replica.render_rep(sn, 源页号, '')`（第三个参数传 `''`——
   源页若无标题占位符，传 deck 标题会触发 `_is_dup_title` 逻辑）。
   再套 `KATEX + R.repCSS + <header class="s-head"> + rep + RENDER`，与其他复刻页一致。
4. **两个数据源必须同步写**（只改一边，重建 deck 会丢页/错位）：
   - `02-script/data/session{N}.json` → `sections[0].slides` 插入位置
   - `tools/content/session{N}_content.py` → `DECK['slides']` 插入源码块
   内容模块用 `_shared/build/reorder_deck.py` 的 `split_slides_blocks` / `reassemble`
   解析后插入，保证缩进与分隔符风格与既有块一致。
5. **id 用源页号**（`S1.002`），插在锚点前，不动既有 sid。
6. **必须显式写 `notes`**（逐句中英对照）。engine.js 的取法是 `notes || en` ——
   notes 为空会静默回退成 en，presenter 里就只剩英文。空 notes 不报错，只会静默降级。
7. 重建 + `gen_deckmeta.py` + `check_deck` + `final_accept`，再截图与源页上下拼接目视核对。

**「疑似变形」的澄清**：判断图片是否被拉伸，**必须先查源 pptx 的 box AR**，
不能只看图片原始宽高比。实例：源页 2 的 spid=9（图 1856×1164，AR 1.5945）
在 deck 里 box AR = 1.519，差 4.7% —— 但源 box 是 2986135×1965960 EMU（AR 1.5189），
**源稿自己拉伸了这张图**，`object-fit:fill` 正是忠实复现。

## 拖拽重排 `split_slides_blocks` 尾逗号坑（2026-09-09 修复）

- **现象**：看片台拖拽重排全线失败，`重排失败：slides 列表闭合异常：',\n]}\n'`，页面回滚。
- **根因**：`_shared/build/reorder_deck.py::split_slides_blocks()` 假设「最后一个 slide dict 之后紧跟 `]`」，但生成的 `tools/content/session{N}_content.py` 结尾写成 `},\n]}`——**合法 Python 尾逗号**。**是书写风格触发，不是语义错误**——同一批文件里有的带尾逗号（卡死）、有的恰好不带（能重排），所以只测单个 session 永远复现不了。
- **修复**：闭合检查处 `tail.lstrip()` 后先跳过一个可选 `,` 再校验 `]`；尾逗号原样留在 `tail` 里，`reassemble()` 拼回时自动保留，无需额外处理。
- **回归测试**：`_shared/build/test_reorder_split.py`（T1–T6，20 项，零依赖 PASS/FAIL 风格）。**必须吃真实内容模块**（全部讲、全部 session 的 `_content.py`）——同一批文件里尾逗号风格不一致，只测单个 session 永远复现不了。
- **写测试时必踩的坑**：`reassemble()` 是**归一化重写**（首元素贴到 `[` 之后、统一元素间分隔符），对未归一化文件**不**逐字节还原。断言要写成「(a) 语义等价 —— 拼回后 import 出的 slide 列表一致；(b) 二次切分再拼回逐字节幂等」。直接断言 `out == src` 会得到假 FAIL（首版就这么错，2 项红）。
- **AST 切分通识**：`ast` 的 `col_offset` 是 **UTF-8 字节偏移**，中文字符会错位，须用 `line.encode('utf-8')[:col].decode('utf-8')` 换算（`_abs_pos()`）。
- **验收基线**：各 session 切分块数 = 该 session 的页数；置换→组装→import→`check_align` 全 OK；json/module/deck 三方页数与 hidden 计数一致；`test_reorder_split.py` 20/20 + `test_apply_hidden.py` 47/47 全绿。
- **统计 deck 隐藏页别数错**：deck 产物**没有** `data-page` 属性（数它恒 0）；`html.count('data-hidden="1"')` 会把 JS 注释里的同名字符串算进去。正确做法：`re.findall(r'<section class="slide[^>]*>', html)` 后在标签内统计。
- **排查「用户报数据被删」时的判据**：前端 `removed` 集合初始恒空、只有点 ✕ 才加入，`hidden` 从 JSON 回填。若某批页消失且它们原本 `hidden: true`，先看是不是浏览器 payload 里的删除操作（用户点的），别急着归因代码——沙盒里可验证代码路径会保留 hidden 页并打 `data-hidden`。

### 回归测试套件（2026-09-09 落盘）

- **位置**：`_shared/viewer/tests/`（`run_all.sh` / `test_board.cjs` / `test_board_drag.cjs` / `test_feedback_save.cjs` / `verify_hidden_script.cjs` / `test_board_refresh_dirty.cjs` / `test_board_delete_e2e.cjs` / `test_board_multisel.cjs` / `test_board_shift.cjs` / `test_board_batch.cjs` / `test_board_stats.cjs` / `test_board_trash.cjs` / `test_thumbs_fingerprint.cjs` / `test_refresh_scope.cjs` / `test_board_jump.cjs` / `live_progress_check.cjs` / `shot_multisel.cjs` / `shot_multicopy.cjs` / `shot_progress.cjs` / `lib/harness.cjs`）。此前这些脚本散在 `/tmp/lt02/`，已工程化落盘——**不要再写一次性临时脚本**，改测试请直接改这里。
- **已知假红（非缺陷）**：`test_thumbs_fingerprint.cjs` 的 F2「改某页文字只应重拍该页」在 **<lecture> 恒 FAIL**（`needed=64`）——测试取中位数页做样本，该页含 `<style>`/`<link>`，改它等于改 deck 级依赖，全量重拍是**正确行为**；<lecture> 样本页不含则通过。看到 F2 单条红不要误判成缩略图指纹坏了。根因是样本选择缺陷，修复方式是挑不含 style/link 的页。
- **一键跑**：`cd _shared/viewer/tests && bash run_all.sh`（自动定位仓库根 = 脚本上三级 `tests/ → viewer/ → _shared/ → 根`；`SHOTS=1` 出图到 `/tmp/board-shots/<lecture>/`，`SHOTS_DIR=` 改根目录，`BASE_PORT=9000` 换起始端口）。**截图必须按讲分目录**——两讲同名 `board-all.png` 平铺会互相覆盖。
- **单讲跑**：`ONLY=<lecture> bash run_all.sh`（子串匹配，可逗号分隔多个；默认跑全部 `lecture-*`）。并发期间别的会话正在写某讲时**必须用它绕开**，不要为了跑全量而等或抢。
- **分层**：`smoke_test_viewer.js` 只验「页面活着」（title/h1/#root/.slide/console），**不覆盖看片台**；看片台行为归 `test_board.cjs`（26 断言）；拖拽归 `test_board_drag.cjs`（7 断言，不写盘）；意见落盘去重归 `test_feedback_save.cjs`（12 断言，临时副本）；隐藏页过滤归 `verify_hidden_script.cjs`（9 断言）；刷新缩略图 dirty 保护归 `test_board_refresh_dirty.cjs`（5 断言）；**删除页端到端消失归 `test_board_delete_e2e.cjs`（A0–A10，会真实写盘但脚本内部自建隔离副本）**；**多选整组拖拽 + 批量复制序号归 `test_board_multisel.cjs`（M1–M16）**；**缩略图增量判据归 `test_thumbs_fingerprint.cjs`（F0–F8b，DRY 不写盘、无需端口）**。端口分配 `BASE+0..BASE+7`。
- **测试样本必须自备（2026-09-09 A10 血案）**：A10 校验 `remapFeedbackGlobal()` 改写的意见键页码，原设计从 `02-script/data/feedback.json` 水合出样本 —— 但 **<lecture> 的该文件是空文件（items=0）**，样本恒为 0，断言永远跳过、打印 `ALL OK` 的假绿。修法：加 `A10a` 播种步骤，测试自己按重排前 DOM 真值往 localStorage 写 4 条意见键（覆盖删除点前 / 删除页本身 / 删除点后 / 末页，首条带 `ppt`+`script` 两种 type），并强制 `n>0` 否则 FAIL。**通则：比对类断言的输入若来自仓库文件，要么测试自备，要么显式断言样本量下限。**
- **断言不得依赖「错误实现才有的副作用」**：A10 首版靠 `counter.fbItems`（即「remap 写错 → 触发写盘 POST」）取样，remap 修好后副作用消失、断言静默跳过。**修 bug 时必须同时确认断言还在真跑**。
- **`page.evaluate` 取不到内联 `<script>` 里的 `const`**（IIFE 作用域）：`FB_KEY` 在页面里不可见，测试侧用 `FB_PREFIX = 'polish-feedback-v3:' + path.basename(COURSE_SRC)` 自拼（`__COURSE_DIR__` 注入值 = lecture 目录名，非 `--course` 短名）。
- **修完断言必做负向验证**：临时还原错误实现 → 断言必须 FAIL 且报出可定位的真值差异（A10 实测报 `S1.010 键=1:7 真值=1:6`；批量复制实测报 `FAIL M13 n=1 want=3 clip=LectureNN-Session01-S1.006b`）→ 再恢复产物并 grep 确认无残留标记。
- **断言里的格式正则不能比数据更严**：M13c 首版写 `/^Lecture\d{2}-Session\d{2}-S\d+\.\d+$/`，被合法 sid `S1.006b`（字母后缀）判 FAIL。**先取真实样本再定正则**，或直接与 DOM 真值比对而不校验格式。
- **自验截图前先确认目标特性真实存在**：`shot_multicopy.cjs` 首版按 light/dark 各出一套图，但 **viewer 模板根本没有暗色主题**（无 `prefers-color-scheme`、无 `data-theme`），两张图逐字节相同 —— 看着「都验了」，实为假自验。出图前先 grep 确认主题机制存在，否则只出 light 并在脚本头注明。
- **`test_board_delete_e2e.cjs` 的做法值得照抄**：脚本自己 `mkdtempSync` 复制 `02-script`/`tools`/`03-slides`、把 media 目录 `symlink` 过去（不复制 800MB+）、复制 `_shared`，再用 `NEWDECK_SHARED=<副本>` 启动**真** `reorder_deck.py`——所以它能跑真实链路却绝不碰真实仓库。断言链：点 ✕ → `is-removed` → 保存重排 → 后端返回 ok → `location.reload()` 后**看片台不再有该 sid + 卡片数 −1 + 其余卡片无连带丢失 + 逐字稿正文 `.slide[data-sid]` 也不含**。**负向验证过**：把后端换成「返回 ok=true 但不写盘」的桩，精确报 `FAIL A5 / A6 / A8` 且 `exit=1`——证明断言不是空跑。
- **期望值数据化**：`lib/harness.cjs` 的 `readExpect(courseDir)` 从 `02-script/data/session*.json` 累加 `sections[].slides[]` 推导总页数与各 session 页数。**禁止在测试里硬编码页数**——讲次增删/页数变动必须自动适配。**任何写进文档的页数都只是当次快照，验收一律现场从数据源推导**（L02 曾 685 页/6 session，经两轮删讲次与页面重分发后现为 267 页/3 session）。
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
- **L02 现状（2026-09-10）**：**0 隐藏页** —— 三套 65/91/111 = **267 页**，deck 的 `data-hidden` 与 json 的 `hidden` 两侧都是 0。历史上曾有 60 页隐藏（09-09 S5+S6 合并后 S1=10/S2=9/S3=7/S4=3/S5=31）、更早 91 页（6 session 时期）；**隐藏页在删讲次与页面重分发中被物理移除了，这是有意的内容决策，不是断链**。
  **页数与隐藏数随内容迭代变动，验收脚本一律从数据源推导，不要硬编码**；`hidden=0` 的讲（L01/L02 现在都是）也必须让断言保留判别力，不能退化成空跑（见下文「断言可以退化，不可以静默缺席」）。
- **引擎行为**：`HIDDEN` 集合来自 `data-hidden`；`buildToc()` 跳过隐藏页（TOC 序号连续无跳号）；`go()` 对隐藏页顺延到下一可见页；`visTotal = total - hiddenCount`；`?embed=1` 走 NO_SKIP 按原始页码寻址（看片台预览框需要）。

### 「隐藏页不出现在观众视图与演讲者视图」是单一实现

这条规则**只有一份实现**，跨讲复用，各讲不得自行判定：

| 层 | 权威文件 | 职责 |
|---|---|---|
| 判定 | `_shared/deck-engine/hidden.js` | 唯一规则实现，暴露 `window.__hiddenRule`（`hiddenSet`/`visIndex`/`defer`/`firstVis`/`lastVis`/`mask`/`attrCount`…）；`attrCount() !== hiddenCount` 时 `console.error` |
| 观众视图 | `_shared/deck-engine/engine.js` | 消费 `__hiddenRule`，不自行判定 |
| 演讲者视图 | `_shared/deck-engine/presenter-inject.js` + `presenter.html` | 经 `meta` 消息收 `hiddenMask` / `lastVisPage` / `visTotal` |
| 构建 | `_shared/build/deck_builder.py` | 把 `hidden.js` **内联到 `engine.js` 之前**（engine 初始化即读） |
| 部署 | `_shared/build/apply_hidden.py` | 04-deploy 镜像按删除处理；各讲 `04-deploy/apply_hidden.py` 是软链 |

**两套页码语义**：原始页码 raw（讲稿 JSON / cue-cards / `durs` 按此索引）vs 可见页号 vis（观众计数器 / TOC / 演讲者页数）。
混用就会出现 1,2,4,5 跳号。**不得**用 `durs[i] === 0` 反推隐藏页——时长 0 与隐藏是两件事。

### 部署侧 `apply_hidden.py` 的三条铁律

三个真 bug 都是**静默出错、只在部署态暴露**，因此固化为铁律：

1. **判定基准是源，不是镜像。** 镜像会被脚本改写成剔除态，以镜像为基准重跑就会回退。
   判断「有没有隐藏页」必须同时读 `03-slides/*.html` 的 `data-hidden` 与 `02-script/data/sessionN.json` 的 `hidden`，并校验两者一一对应。
2. **产物 section 是 `class="slide layout-xxx"`，不是裸 `class="slide"`。** 正则漏掉 `layout-*` 前缀会恒 0 命中，脚本「成功」却什么都没删。
3. **末页隐藏要吃到 tail 边界。** 最后一个 section 之后还有 `</main>` / `.progressbar` / `<script>`，切分逻辑写错会漏删末页。

重跑语义：镜像已剔除则走 `resync`（只补齐 fetch 指向与镜像 JSON，**绝不回退**）；
镜像处于半剔除态（section 数与源不符）直接报错，要求重建镜像。

**回归自测（零依赖，合成 fixture + 真实 deck 双覆盖）**：

```bash
python3 _shared/build/test_apply_hidden.py                      # 自动扫描全部 lecture
python3 _shared/build/test_apply_hidden.py --deck <lecture>
```

8 个用例：T1 中间隐藏 / **T2 末页隐藏（唯一能同时命中坑 1+2）** / T3 连续多页 / T4 无隐藏页 noop /
T5 revert-fetch / **T6 重复执行幂等（坑 3 守门）** / T7 半剔除态必须报错 / T8 真实 deck 回归。
**fixture 必须复现真实产物形态**（`class="slide layout-xxx"`、tail 含 `</main>` + progressbar + fetch），否则测不出东西。
2026-09-09 基线：**PASS 62 / FAIL 0**。

### 逐字稿页（`02-script/index.html`）里隐藏页 / 删除页怎么处理（2026-09-09 落定）

用户要求「隐藏或删除的页面也不要在逐字稿里显示」。两条路径的落点完全不同：

| 类型 | 后端行为 | 逐字稿侧要做的事 |
|---|---|---|
| `removed`（看片台 ✕ 删除 + 保存重排） | `reorder_deck.py` 把它从 `02-script/data/sessionN.json`、`tools/content/sessionN_content.py`、deck 产物 `<section>` **三处物理剔除**，后续页序前移 | **无需过滤**，数据里已经没有了 |
| `hidden`（源 pptx `show="0"`） | 只在放映时跳过，**仍留在 deck 与 JSON 里** | 逐字稿渲染时**必须跳过显示，但必须保留 DOM 占位壳** |

**核心约束：hidden 页占位壳不可删。** `gen_deckmeta.py` 的页码 = deck 产物里 `<section>` 的文档序号；`hidden.js` 靠 `data-hidden` 属性在 DOM 里保留 hidden 页 → **hidden 页仍占 deck 页码索引**。逐字稿渲染时若把 hidden 页整个丢掉，`data-page` 会跳号，直接连带打坏三样东西：预览 iframe 的 `#/page/step` 定位、意见 key、`slide-edits.json` 的 journal 重放。另外 `reorder_deck.check_permutation()` 要求 `order` 是当前 sid 的全排列，前端 `endDrag()` 的 order 来自 `.slide:not(.insert-draft)` 的 DOM 完整序——**丢壳会让保存重排直接报错**。

正确做法（模板里 6 处，缺一即漏）：

```js
// 1) CSS：视觉上消失，但仍在文档流外不占布局
.slide.is-hidden { display: none; }
// 2) 渲染时保留占位壳
if (hidden) { slides += `<div class="slide is-hidden" data-hidden="1" data-sid="..."></div>`; }
// 3) 页码计数仍含 hidden（section 计数不减）
// 4) 统计口径改用「可见页数」：bootstrap() 的 shown / total_shown
// 5) renderStats() 用 total_shown；session-head 用 st.shown
// 6) attachFeedback() 分母 filter(s => !s.hidden)
```

- **验收**：`_shared/viewer/tests/verify_hidden_script.cjs`（9 断言，真值直接读 `session*.json`，9 条覆盖占位壳存在 / `data-hidden="1"` / 计算样式 `display:none` / 可见卡片数 === 非 hidden 页数 / 可见卡片不含 hidden sid / **每 session 的 `data-page` 严格 1..N 连续** / 统计口径）。
- **`data-page` 是 session 内序号，不是全局序号**：`sessionHTML()` 里 `let page = 0` 每 session 重置，故每 session 各自 `1..该 session 全部页数（含 hidden）`。断言时必须按 `data-sess` 分组校验，写成全局 `1..total` 会假 FAIL（实测报 `n=537 first=1 last=306`）。
- **负向验证三连（证明断言非空跑）**：display 失效 → 3 FAIL；丢占位壳 → 2 FAIL（H4 报 `S1: n=51 want=61`）；page 跳号 → 1 FAIL。
- **L01 零 hidden 是正常现象**：L01 三个 session 全为 0，L02 才有 60 个。验收脚本必须能跑 `hidden=0` 的讲且不退化成空断言（H1–H3 退化为「全可见」，H4 仍有判别力）。
- **用户口径「隐藏或删除的页面不要在 `02-script/index.html` 显示」的落点**：`removed` 页由后端物理剔除，逐字稿天然没有（断言在 `test_board_delete_e2e.cjs` A8：重载后 `.slide[data-sid]` 不含被删 sid）；`hidden` 页是「视觉不显示 + 保留占位壳」（断言在 `verify_hidden_script.cjs`）。**不要为了让正文「干净」而删掉 hidden 占位壳**——见上文核心约束。

### 【核心坑】验收脚本取 TOC 序号/标题必须分 span，禁止解析 textContent

`.toc-link` 的 DOM 是 `<span class="n">15</span><span>1989 — The First Full-Body 3D Scan</span>`。
用 `el.textContent.match(/^(\d+)/)` 会把两段拼成 `151989` —— 既误判「TOC 序号有跳号（暴露隐藏页位置）」，
又误剥标题前缀（`hidden=0` 的 L1 session-2 就是这么被误报的）。
**正确写法**：序号取 `.n` span（`parseInt(nEl.textContent, 10)`），标题取**最后一个 `span`**；
泄漏检测用标题 span 组成的 `Set` 精确比对。`verify_hidden.mjs` 已按此修复。

### 【核心坑】断言可以退化，不可以静默缺席

`verify_hidden.mjs` 曾把演讲者视图 8/9/10/11 四项整块挂在 `if (hiddenCount > 0)` 上——
**`hiddenCount=0` 的 deck（如 L01 三套）因此从未验证过演讲者视图**，部署侧三个 bug 正是这样潜伏下来的。

现已改为：8/9/10 对 `hiddenCount=0` **同样断言**（退化为原始页码，`visTotal === total`，仍有判别力）；
只有第 11 项（跳隐藏页顺延）需要真隐藏页，跳过时报告里显式写 `pres.skipped` 说明原因，
`pres.asserted` 标出实际执行项。embed 分支的 `skipped` 同样带 `reason`。
**写验收脚本时，任何 `if (条件) { 断言 }` 的「条件」都要问：条件不成立时是「无意义」还是「被掩盖」？后者必须报错或显式标注。**

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

### 改 `_shared/` 后如何确认各讲未被改坏（五层复验，2026-09-09 定式）

`deck_builder.py` 把 `hidden.js` → `engine.js` → `sync.js` → `presenter-inject.js` → `controls.html`
**内联进 deck HTML**，所以 deck 与引擎是「**构建时刻快照**」关系，不是运行时引用。
推论：改 `_shared/deck-engine/` **不会自动影响已构建的 deck**；判定某讲 deck 是否用上新引擎，
看 mtime 先后即可（deck 晚于引擎文件 = 已含新版）。反过来说，改完 `_shared` 若想生效**必须重建**。

只读验证某讲未被改坏，按这五层从便宜到贵依次跑（全程不写盘，可与其他会话并发）：

| 层 | 命令 | 判据 |
|---|---|---|
| 1 | `python3 _shared/build/apply_hidden.py <lecture_root>`（**不加 `--apply`**） | 打印 `DRY-RUN OK` 且前后 mtime 快照一致 |
| 2 | 数 `03-slides/*/index.html` 的 `data-hidden` 与 `data/sessionN.json` 的 `hidden` | 两者一一对应 |
| 3 | `python3 _shared/build/test_apply_hidden.py --deck <lecture-dir>` | `PASS n / FAIL 0 / RESULT: ALL GREEN` |
| 4 | `bash _shared/viewer/tests/run_all.sh`（并发期间用 `ONLY=<讲名子串>`） | smoke 零 console 错误 + board 26/26 + drag 7/7 + feedback_save 12/12 + hidden 9/9 + refresh_dirty 5/5 + delete_e2e A0–A10 + multisel M1–M16 + shift 17 组 + batch 12 组 + stats 8 组 + trash 10 组 + thumbs_fingerprint F0–F8b + refresh_scope S0–S6 + board_jump J0–J9 |
| 5 | `check_deck.mjs <deck_dir>`×N + `verify_hidden.mjs <base> <session-dir>…` + `final_accept.mjs <base>` | `ALL CLEAN` / `issues: []` / `jsErr=[]` |

注意：`run_all.sh` 遍历**全部** `lecture-*`，并发期间会撞上别的会话正在写的讲；
只想验一讲用 `ONLY=<lecture> bash run_all.sh`（自动跳过其余讲并打印 `# skip …`），
或手跑单个套件（端口 8561–8567 之类错开，避开用户 `play.command` 的 8321/8322/8400）。

### 三套验收脚本的分工（跑全量时都要过）

| 脚本 | 覆盖 | 关键判据 |
|---|---|---|
| `check_deck.mjs <deck_dir>` | 逐页 overflow/破图/坏视频/空讲稿 | **用 `visTotal` 而非 `total` 比 TOC 条数**（否则每个隐藏页都误报「toc links 少一条」）；隐藏页另开 `?embed=1` 趟跑 |
| `verify_hidden.mjs <http_base> <session-dir>…` | 隐藏页 12 项行为语义 × light/dark | TOC 序号连续、隐藏标题不泄漏、`visTotal`、presenter 页码/进度段/End 键。**传目录不要传 `index.html`**——脚本自己拼 `/index.html`，多传一层会 404 超时 |
| `final_accept.mjs <http_base>` | 整体功能汇总 | `total/nav/toc/notes/arrow/presNav` + `jsErr=0` + `ext=0`（离线合规） |

### 看片台分隔条标题（`.bsep`）

曾出现三重冗余：`Session 1Body Models: A History63 slides · 隐藏 10`。
源头在 `_shared/viewer/viewer.template.html`，改完必须 `python3 build_viewer.py --all --repo-root "<课程根>"` 重建，
再断言六条分隔条各自含 `Session N` + 主题名、且无叠字。E2E 采集 `sepTexts` / `headerText` 做语义断言。

## 打磨闭环：意见队列 → deck + 逐字稿（原 `polish-slides`，2026-09-10 并入本 skill）

讲师在 `02-script/index.html` 逐页写意见 → 点「导出意见」并入 `02-script/data/feedback-history.json` → 本流程读 `status:"unsolved"` 队列 → 路由 → 全局润色 → 重建验收 → 打 `solved`。

**调用**：传 `feedback-history.json` 路径（前端导出时复制到剪贴板的就是这个路径尾段）；传的是 `feedback.json`（旧习惯）时取**同目录的 history**。队列为空直接告知「无待处理意见」，**不要空跑构建**。

### 存储契约（前端 ↔ 本流程的唯一接口）

两个文件职责分离，**不要混用**：

| 文件 | 角色 |
|---|---|
| `feedback.json` | **临时存储**：只存当前编辑页的意见。`/api/save-feedback`、`/api/clear-feedback` 只碰它，清空它不影响 history |
| `feedback-history.json` | **唯一历史账本 + 本流程的任务队列**。以 `key = "sess:sid:type"` 为稳定槽位；同槽位差异文本追加为 `key#2`、`key#3`… 变体（带 `variant_of`），不覆盖原条目 |

记录字段 `{key, sess, sid, type, page, text, status, opened_at, resolved_at}`；`sid` 含点**不含冒号**（`S1.03`），`page` 是 1-based（deck index 要 `page-1`）。

- **status 三态**：`unsolved`（待处理）/ `Ongoing`（已认领、处理中，防重复派发）/ `solved`（已修复，带 `resolved_at`）。
- **写入方只有两个**：① `play.command` 的 `/api/export-feedback`（幂等：同槽位全家含 `#n` 变体中已有完全相同文本 → 跳过）；② 本流程修复成功后打 `solved`。**不做 reconcile 式补记**。

### 队列读取与回写

1. 读 `records`，过滤 `status == "unsolved"`，按 `sess → page → type` 排序（type 序 `insert-before < ppt < script < insert-after`）——同页插入必须**先于**该页修改，否则 page 索引漂移。记下每条的 `key`（含 `#n`）供回写。
2. **动手前先标 `Ongoing`**（原子写回），并行 run 看到即跳过。中途崩溃则下轮遇长期 `Ongoing` 向用户确认后改回 `unsolved` 再处理。
3. 成功修复且通过验收后改 `solved` + `resolved_at`，**原子写回**（同目录临时文件 + `os.replace`；跨分区会失败）。部分失败只把成功的打 solved，失败的回滚 `unsolved` 并在回复里说明。

### 四类意见的路由

| type | 目标文件 | 改什么 |
|---|---|---|
| `ppt` | `tools/content/session{N}_content.py` | `DECK['slides'][page-1]['html']`（排版 / 内容 / 动画） |
| `script` | `02-script/data/session{N}.json` | 按 `sid` 定位，改 `en` 并**同步 `zh`** |
| `insert-before` / `insert-after` | **两者** | 在 `sid` 前/后新增一页（deck 插 slide + 逐字稿插 en/zh 条目） |

### 逐字稿改写原则（硬约束，不是机械替换）

讲师意见通常啰嗦、口语化，中文比英文复杂。把它当**内容要点**，不是要照抄的文本：

1. **先英后中**：先用**平实简单的英文**写要点（CET-4/6 词汇、短句优先、避免从句堆叠），定稿后再**逐句翻中文**，保证 `en`/`zh` 逐句对应、语义等价。中文可更丰满、更贴近讲师语气，但结构仍与英文逐句对齐。
2. **顺承讲课节奏**：让新文案与上/下页自然衔接——承接上页已讲的、为下页铺垫。可压缩啰嗦表达、调整叙事节奏。
3. **内容优先于措辞**：要讲什么必须保留，怎么讲可自由重排精简。宁可更短更清楚，也不逐字复述啰嗦原文。
4. **PPT 意见也是逐字稿的内容来源**：某页只有 `ppt` 意见时，逐字稿**默认跟随 PPT 同步改写**；`ppt` 意见里夹带的可口述内容点（举的例子、补充背景、某句可直接讲出来的话）要主动提炼进 `en`/`zh`，别因为「没提文字稿意见」就漏掉。

### 强制前置：意见增强

**每次运行都必须把收集到的全部意见先交给 `prompt-optimizer` skill 处理**，生成更具体、可验收的增强提示词，再用它去改 Slides。**先增强、后修改，顺序不可颠倒。** 增强结构 = 修改目标（deliverable 明确、可验收）+ 涉及范围（sid/page、deck 哪一部分、逐字稿哪些句、是否波及邻页衔接）+ 预期效果（可观察/可检查）+ 约束（双语逐句对应、排版守则、幂等守卫等本项目硬规则照抄进约束项）。

意见原文已足够具体时只做**格式规范化 + 补全隐含约束**，**不得为「增强」而改变讲师原意**；讲师原意与增强结果冲突时以原意为准并在呈现时标注。增强产物先在回复里简要呈现（每条一行：sid+type → 增强要点），再进入应用。

含 YouTube/Bilibili 链接的 `ppt` / `insert-*` 意见：**先按 `video-download` skill 下载到本地** `03-slides/media/decks/session-N/videos/` 再落 deck（`<video data-vid>` + `video_config` 的 `{key:{start,end}}`），禁止 iframe 外链（破坏离线自包含）。**例外**：`script` 意见里的链接仅作资料引注、无「引入视频」意图时，只改逐字稿文案。

### 两项一致性（验收标准）

1. **PPT ↔ 逐字稿一致**：`ppt` / `insert-*` 改动落 deck 后，逐字稿对应的 `en`/`zh` 必须同步反映同样内容；`script` 改动若改变页面内容，deck 排版也要跟上。二者始终同一事实来源。
2. **中英对照一致**：逐字稿每个 slide 的 `en` 与 `zh` 逐句对应、语义等价、无漏译多译。这是讲师明确的硬要求。

### 打磨专属的坑

- **`notes` 退化成整块拼接（2026-09-10 实锤）**：`merge_notes.interleave()` 先 `split_en`（按 `(?<=[.!?])\s+(?=[A-Z"'(0-9])` 切）与 `split_zh`（按 `(?<=[。！？])` 切），**只有两侧句数相等才逐句交错**，否则 fallback 成 `en + " " + zh` 一整段——presenter 备注区的中英对照直接失效，而 JSON 校验与 deck 都不报错，不看备注发现不了。改完 `en`/`zh` 必须重算 `notes = interleave(en, zh)` 并**断言 `len(split_en) == len(split_zh)`**（中文习惯少一句：英文用分号合并、中文用句号断开，最易在此翻车）。把 `interleave` 抄进校验脚本，别信「看起来差不多」。
- **看片台「保存重排」会与打磨并发写同一份 `session{N}.json`**（2026-09-10 实锤：讲师一边让 agent 润色备注、一边在看片台删页，36 秒内 session3 少了 21 页）。读改写整份 JSON 前必须加**竞态守卫**：`st0 = os.stat(path)` → 构建新 doc → 写前再 `os.stat` 比对 `(st_mtime_ns, st_size)`，变了就跳过并提示重跑，否则静默吞掉讲师那次删除。另外**分节边界别用下标，用 anchor slide id**（`ids.index(anchor)`），否则一次删除就把后面所有节边界推错位；anchor 消失时跳过该节、最后按顺序重编号 `{sn}.{i+1}` 补掉编号空洞。
- **sid / page 会漂移**：`page` 可能过时，`sid` 也可能是历史删除/重编号的孤儿 id（实测 `1:S1.23` 的真身在 session3 的 The Roadmap）。定位真身**以文本关键词 + 标题匹配为准**（拿 text 里的独特短语搜 `session{N}.json` 与 deck ttitle），`page`/`sid` 只作起点提示。截图自验先读 deck 页脚「n / N」确认页码，别信 feedback 的 page 直算 `go(page-1)`。
- **并行 run 冲突**：动手前查文件 mtime 近 30s 是否有写入，或直接向用户确认错峰策略。`Ongoing` 标记**只防重复认领，不防同文件交叉覆写**。另一 run 还可能「做了不认领」（曾 5 条 unsolved 已被并行 run 全部实现但状态未动）——认领后先考古：diff `bak/` 最新备份、grep 部署态 HTML、对照 `session{N}.json`，判断每条是否已实现，**已实现的只做核验（check_deck + final_accept + 截图）后关账，缺的才补，绝不盲目重做**。谁打 solved 谁负责验证。
- **清空只清临时层**：直接删 `feedback.json` 是白清（前端会把 localStorage 里的旧意见写回）。正确姿势：① 讲师页面点「清空」按钮；② 开 `02-script/index.html?fbwipe=1` 应急清 localStorage。意见是否处理完看 history 的 `status`，与 `feedback.json` 无关。旧版 `_reconcile_feedback`（save/clear 联动 history）已删除，别再找它。
- **`.media-grid figure img` 全局绝对定位坑**：style 里有 `.media-grid figure img, .media-grid figure video { position:absolute; inset:0; width:100%; height:100% }`——媒体 figure 内**任何** inline icon `<img>`（如四宫格卡片图标）都会被强制绝对定位堆到容器左上角（讲师报过「icon 全堆左上角」即此因）。修复：icon 内联加 `position:static` 压制。
- **`zh-note` 现在直接写在内容模块里**（2026-09-09 重构后）：形如 `<span class="zh-note" data-ann="zh:\bTERM\b">中文</span>`，改/删中文注释直接改 `session{N}_content.py` 再重建即可。旧的构建期注入链路（`ann.py` + `/tmp/ann_map.json`）已随重构删除，不要再找 ann_map。
- **`#序号` 定位意见**：`ppt` 意见文本里的 `#N` 指 `02-script/index.html` 元素序号标注（elnum）给当前页元素打的序号（DOM 文档序、唯一连续），**不是**卡片编辑器落盘 op 的 `index`（同标签局部序号）。规则见 `lecture-slides` 的 `references/workbench-tools.md`。
- **localStorage 的 origin 隔离**：`http://localhost:8321` / `:8322` / `file://` 是不同存储桶。**自动落盘已绕开此坑**——前端把意见写进磁盘 `feedback.json`，本流程直接读文件，不依赖 Playwright 读 localStorage。`scripts/export_feedback.mjs` 仅在需要「从某个已开着的页面导出」时作备选，且要求 origin 完全一致。
- **`final_accept.mjs` 的 http server 必须与验收在同一条 shell 命令内启动**（`python3 -m http.server … & SRV=$!; …; kill $SRV`）——后台 `&` 跨 Bash 调用会被杀，报 `ERR_CONNECTION_REFUSED`。
- **缩略图 `since-solved` 依赖 `resolved_at`**：本流程给条目打 `solved` 写 `resolved_at`，会触发对应页在下次「刷新缩略图」时增量重拍——**属预期联动，不是 bug**。

## 内联资产去重：HTML 体积 −51%（`_shared/build/dedupe_assets.py`，2026-09-10）

deck HTML 把 KaTeX（js/css/fonts）与引擎 JS 逐页内联，**同一份资源块在一份 HTML 里重复几十上百次**（去重前每套 deck 有 39 / 62 / 109 个重复块）。`dedupe_assets.py` 把逐字节相同的 `<link rel=stylesheet>` / 外部 `<script src>` / `<style>` / 内联 `<script>` 合并为一份，`MIN_BLOCK = 60`（低于此长度不动，避免把零碎内联脚本误合并）。

已接入 `deck_builder.py` 写盘后的后处理，**去重后每个 deck 只剩 1 个重复块**：

| deck | 去重前 | 去重后 |
|---|---|---|
| session-1 | 389 KB | **287 KB** |
| session-2 | 538 KB | **357 KB** |
| session-3 | 972 KB | **385 KB** |

- **kill switch**：`DECK_NO_DEDUP=1` 关闭后处理（怀疑去重引入问题时用）。
- **安全性证据**：去重是**纯后处理，不改内容** —— `tools/content/session{N}_content.py` 三个模块的哈希在去重前后**逐字节不变**。
- **一条诚实的测量结论**：用 `tools/fx2/perf_probe.cjs` 冷加载实测，load 时间在 ±3% 噪声内（349→359 / 428→440 / 512→509 ms）。**瓶颈是 DOM 节点数（3000–6000）与媒体解码，不是 script 解析**。体积下降的价值在传输、diff 与结构可读性，**别把它宣传成「打开更快」**。

## 两层验收：哈希层 + 像素层（2026-09-10 落定）

重构/优化 deck 时，「结果和之前完全一样」必须能被机器判定。只做一层会陷入两难：全过说明没真优化，全败又分不清「优化」与「改坏」。所以建两层：

1. **哈希层** —— `shasum -a 256 -c .refactor/baseline.sha256`
   证明**生成器行为没变**。适用于**不改变产物**的重构（公共逻辑上提、死代码清理）。基线含 9 个产物：3 套 `index.html` + `presenter.html` + 3 个内容模块。
2. **像素层** —— `python3 tools/fx2/pixdiff.py --a .refactor/before --b .refactor/after`
   证明**渲染结果没变**。**只有它能覆盖「本来就要改字节」的优化**（如内联去重 −51%、排版拟合改几何）。判据：`max|Δ|>8` 的像素占比 ≤ 0.1%。

| `.refactor/` 内容 | 用途 |
|---|---|
| `baseline.sha256` | **当前有效基线**。今后任何生成器改动都必须让它保持全 OK |
| `baseline-prededupe.sha256` | 优化**前**的哈希（用于证明「只有去重这一步改了字节」） |
| `before/` `after/` | 15 张渲染截图（3 套 × 5 页抽样，前后必须同一批页） |

**抽样页必须覆盖四类风险面**：含 KaTeX 公式的页、含视频的页、多图页、含动画步进的页。只比哈希要么全过（说明没真优化）、要么全败（无法区分优化与改坏）。

**性能/体积类改动不能用哈希层验收**（产物本来就该变），也不能只看缩小比例——必须像素层证明「只是变小，不是变样」。

### 代码治理工具链（`tools/`，可复用）

| 工具 | 用途 |
|---|---|
| `live_modules.py` | **运行时 `sys.modules` 快照**——抓「谁真的被加载了」。**静态依赖图不可靠**：生成器走 `spec_from_file_location` 动态加载，静态 import 图扫不到，`depgraph.py` 会漏报/误报 |
| `find_dead.py` | 找无人引用、不会被运行时加载的文件 |
| `prune.py` | 把死代码**搬到本地磁盘隔离区**（不是删）。自带 `LIVE_CLI` 白名单（否则会把治理脚本自己和兄弟脚本一起搬走）与去重逻辑（同一文件出现在两个分组会让 `getsize` 抛 `FileNotFoundError`） |
| `bakstore.py` | 带自动清理的备份（`KEEP = 2`）；`regen_replica.py` / `branding.py` 都已接入 |


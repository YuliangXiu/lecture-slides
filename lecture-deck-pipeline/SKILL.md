---
name: lecture-deck-pipeline
description: <机构名>《<课程名>》课程 HTML 课件的构建、复刻、验收与打磨流水线。当需要新建或迭代某一讲（Lecture N）的 session 课件（deck）、逐字稿对照页、把整讲逐字稿口语化润色（降难度到托福口语水平、四六级词汇、短句不卡顿）并同步逐字稿页/演讲者页/观众页三处、修复课件引擎/讲稿加载/放映启动器问题、核验复刻页与源 PPT 的保真度（布局/元素位置/字号/动画顺序）、清理白块与白底媒体、让复刻页铺满舞台、给课件署上讲者姓名、调整演讲者视图（含「本页还有动画吗」绿红边框指示器）、或读修改意见队列批量润色 deck 与逐字稿时使用。触发词：做课件、建 deck、改课件、新讲义、slides 重建、deck_builder、复刻、保真、与源 PPT 不一致、动画顺序不对、字号不对、notes 不显示、play.command、白块、白底、不饱满、排版太空、抹掉原作者、署名、沙漏、倒计时、演讲者视图、presenter、动画指示器、边框绿红、stepInfo、polish-slides、应用修改意见、按意见改课件、改逐字稿、插入页、feedback-history、unsolved、Ongoing、逐字稿润色、口语化改写、口语稿、念起来不卡顿、托福口语、降低词汇难度、cue-cards 同步、三视图同步。
agent_created: true
---

# Lecture Deck Pipeline（课件构建 · 复刻 · 验收 · 打磨流水线）

## 本 skill 的边界

| 领域 | 归属 |
|---|---|
| 视觉体系、演讲者模式、离线本地化、质量门禁、排版守则、编辑器与工作台**设计** | `lecture-slides` skill |
| **本脚手架**（`_shared/` 引擎 + `tools/content/session{N}_content.py` + `session{N}.json` + `02-script/`）的建构/复刻/验收/打磨**运维** | **本 skill** |
| 部署发布（镜像、瘦身、COS、主页） | `deploy-slides` skill |

**原 `polish-slides` 已于 2026-09-10 并入本 skill**（见 `references/polish.md`）——四类意见的路由、逐字稿改写原则、`feedback-history.json` 队列与状态回写都在那里，不要再找那个 skill。

> ⚠️ **只并了 `polish-slides` 一个，`deploy-slides` 没有并、也不该并。**（2026-09-10 复核：连讲者本人都一度以为 deploy 已并进来）
> 判据不是"都在讲课件"，而是**生命周期与 generalization 范围**：
> - `polish-slides` 与本 skill 同生命周期、同文件、同触发（都是在 `_shared/` 脚手架上改 deck + 逐字稿），并进来消掉一次跨 skill 跳转 = 净收益。
> - `deploy-slides` 是**另一条生命周期**（内容定稿之后的镜像/瘦身/COS/主页发布），且是 **course-agnostic 模板**
>   （实例值全是 `<...>` 占位符，可套到别的课），自带 `scripts/cos_sync.py` / `check_cos_env.py` / `scrub_placeholders.py`。
>   并进来只会让本 skill 更长，还破坏它的跨课程复用性。
> - 同理 **`lecture-slides` 保持独立**：它是 course-agnostic 的**设计系统**，本 skill 是绑死本课程 `_shared/` 脚手架的**运维手册**。
>
> `04-magazine` 是 `lecture-slides` 的**唯一**风格（无 01/02/03 并存），**不要**去 `html-course-slides` 找模板：
> 那是 reveal.js 5.x 的另一条已废弃技术栈（本课程零 reveal.js 引用），已删除。

## 入口路由（先在这里定位，再读对应 reference）

**SKILL.md 只放路由与常驻约束。具体怎么做在各 `references/` 里——按用户的话查下表，只读需要的那一个或两个，不要通读。**

| 用户说的话（典型） | 读哪个 reference | 要重建 deck 吗 |
|---|---|---|
| 做课件 / 建 deck / 新讲义 / slides 重建 | 本文下方「Workflow：新建一讲」 | 要 |
| 复刻 / 与源 PPT 不一致 / 白块 / 白底图 / 动画顺序不对 | `references/replica-reproduce.md` | 要 |
| 核验保真 / 字号不对 / 元素位置不对 / 排版不饱满 / 太空 | `references/replica-verify.md` | 要 |
| 抹掉原作者 / 署名 / 首页 / 沙漏 | `references/branding-build.md`（且必须走 `rebuild.sh`） | 要 |
| 隐藏页 / 放映跳过 | `references/hidden-slides.md` | 要 |
| 看片台 / 缩略图 / #序号定位 | `references/thumbnail-wall.md` | 要 |
| 演讲者视图 / 动画指示器 / 边框绿红 | `references/presenter-anim-indicator.md` | 要（全部讲） |
| **polish-slides `<feedback-history.json>`** / 按意见改课件 / 逐字稿润色 / 口语化改写 | `references/polish.md` | 改 `ppt`/`insert-*` 要；只改 `script` 不用 |
| 插入一张源 PPT 页 / 拖拽重排 | `references/deck-editing.md` | 要 |
| 验收 / 体积异常 / 哈希对不上 / 像素回归 | `references/acceptance.md` | 不用 |
| **改引擎 / 改 `_shared/` / 五层复验** | `references/acceptance.md`（「引擎版本对齐」「五层复验」两节） | 要（全部讲） |
| 踩坑前查历史 | `references/lessons.md` | —— |
| 上线上传 / 发布 / 瘦身 | **不在这里** → `deploy-slides` skill | —— |

**强顺序依赖**：涉及复刻页的改动一律走 `bash tools/rebuild.sh`（`regen → brand → build`），顺序颠倒会静默丢改动。详见 `references/branding-build.md`。

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
| `<课程根>/` | **权威交付**，零 .bak，最终产物只在此 |
| `<课程根>/_shared/` | **唯一权威引擎 + 构建器**（跨讲共享） |
| `<备份目录>/` | 所有备份（保留相对路径） |
| `…/bak/refactor-<ts>-deadcode/newdeck-framework-archive/` | 旧 newdeck-framework 归档（**只读历史，勿再引用**） |
| `02-script/data/session{N}.json` | 讲稿唯一数据源 |
| `{lecture}/tools/content/session{N}_content.py` | 内容模块（`DECK['slides']`，构建源） |
| `03-slides/session-{N}/` | 三套 deck 产物 |

## Workflow：新建一讲

1. **建讲目录**：`lecture-0N-…/` 下建 `01-framework/`（符号链接到 `_shared/deck-engine/`）、`02-script/`、`03-slides/`、`tools/content/`。**不要复制引擎文件**。
2. **写内容模块** `tools/content/sessionN_content.py`：`DECK` 里必须写 `"lecture": N`（**int**，如 `2`；决定读 `_shared/skins/lecture-NN.css`；缺省回退 1 = 只用 base）。全英文正文；组件排版预算见 `_shared/deck-engine/AUTHORING.md`（严禁把截图当 raw data 直接贴——用组件重排）。**注意 media/{images,videos} 是课程素材不在框架里，须另拷进 deck 目录，否则 check_deck 报 404。**
3. **构建**：`python3 _shared/build/deck_builder.py {lecture}/tools/content/sessionN_content.py {lecture}/03-slides/session-N`（任意 cwd 均可，构建器自动上溯定位 `_shared`）。
4. **生成对照页元数据**：`python3 _shared/build/gen_deckmeta.py {lecture_root}`（读 deck 产物的 vstep 标记生成 `02-script/data/deckmeta.js`；**不要过滤 unit==1 的页**）。
5. **验收三连**（Playwright 经 `NODE_PATH=<含 playwright 的 node_modules 所在目录>`，node 用 `<node 可执行文件>`）：
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
- WorkBuddy 沙箱进程写 OneDrive 可能报 PermissionError（Brokered file token refused）——文件实际未损坏，重试或换路径验证即可。
- **凡「遍历一批固定编号输入」的校验脚本，编号必须从数据源发现，不能写死**。`02-script/build.py` 两讲已统一为 `discover_sessions()` 扫 `data/session*.json` 并排序（找不到即 `SystemExit`）。写死的失败模式是**静默漏检 + 假绿**——L02 曾因 `for n in (1,2,3,4,5)` 漏掉 session6 的 198 页，却照样打印 `OK`。同一模式须横向排查：`tools/e2e_cue.js` 的 `SESSIONS`、`tools/presenter_e2e.js` 的 `SESSIONS`、`tools/cue_check.py` 的 `sessions` 列表、**`lecture-01/tools/build_publish.py` 的 `SESSIONS = (1,2,3)`（发布链路，增讲即静默漏发；2026-09-09 已改 `discover_sessions(04-deploy)`，只收含 `index.html` 的目录）**、`_shared/viewer/tests/lib/harness.cjs:readExpect`（测试侧已正确）。**一处看似同类、实为有意设计，勿改**：`_shared/viewer/build_viewer.py` 的 `COURSES[*]["sessions"]` 是显式课程登记表（新增课程须登记）。~~① `lecture-02/tools/merge_notes.py:146` 的 `(1,2,3,4)` 刻意排除 S5~~ **（2026-09-10 已失效）**：S3（Overview）2026-09-09 删除并重编号（原 S4→3、原 S5→4），S4 又于 2026-09-10 删除（其页已分发进 S1–S3），L02 现存 1–3；`merge_notes.py` 的 `SESSION_TITLES/PARTS` 与循环范围均已改为 1–3，不再是例外。
- **删讲次 / 重编号：三种「session N」语义必须分开，判据用「页是否还活着」而非 sid 前缀**（2026-09-09 重编号 + 2026-09-10 删 S4 两次实战）：
  - **live 课程编号**（`03-slides/session-N/`、`session{N}.json`、`deck_spec|asset_manifest|media_dims/session{N}.json`）→ 改；
  - **源 PPT 序号**（`_archive/tools/replica/els/session{N}`、`tools/fx/anim_plan.json` 等的 `session{N}` 键、`DECK_REL`、`scan_white_blocks.py` 的 `(4,5,6)`）→ **绝不改**，盲改会毁掉整条复刻管线；
  - **源素材目录**（`03-slides/media/decks/session-6/` 等，被 S1–S3 引用上百处）→ **保留**。
  - **致命陷阱**：`cuecards.json` 里的 `S4.xxx` 键，其页可能已被分发到 S1/S2/S3 但**仍然存活**——按前缀批量删会误删上百张有效卡。正确判据是「该 sid 是否还出现在任一 `session{N}.json` 里」，只剔除真正消失的页。
  - **易漏点**：deck HTML 内联 `const SCRIPT_SESSION = "N";`（字符串形式，`re.search(r'=\s*(\d+)')` 匹配不到）；每页 kicker `Lecture 02 · Body Models — Session N`；`deckmeta.js` 的 session 键；`tools/cue_out/session{N}.part*.json`（删讲次必须同步删，否则重跑 `cue_merge.py` 复活）；`_shared/viewer/build_viewer.py` 改完必须重跑 `--all --repo-root <课程根>` 重建 `02-script/index.html`。
  - **cue_check.py 的结构性局限**：它按 sid 前缀 `S{n}.` 去加载 `session{n}.json`。一旦某讲的页被分发到别的 session 而保留原前缀（如 S4.xxx 住进 session1/2/3.json），它就会去加载已删除的 `session{N}.json`，报出的 missing/extra 是失真而非真回归——排查前先确认 sid↔文件映射是否被打破。
  - ⚠️ **曾误列的「例外 ③：`lecture-01/02-script/gen_bilingual_notes.py:69` 是逐字稿页映射表」已证伪删除**（2026-09-09）。它其实是**真实的 session 遍历 + 写回 JSON**，与 L02 那份弃用守卫（`raise SystemExit(1)`）语义完全不同。**通则：同名文件跨讲语义可能不同，判「是不是讲次遍历」必须读全文，不能只看有没有守卫。**
- **「人工映射表 + 自动兜底」的脚本必须有越界前置断言**（2026-09-09 `gen_bilingual_notes.py` 教训）。该脚本 MANUAL 表随 en/zh 编辑变 stale，重跑在 `build_notes` 深处炸 `AssertionError`/`IndexError`，报错指不到真因。**判定某个 MANUAL 项是否仍需要**：en/zh 句数是否相等 + 1:1 拼接是否等于现有产物；相等即冗余，删。修完的验证要**四重**：`ast.parse` / 幂等（重跑产出与原数据 `a==b`）/ **正向敏感度**（造句数变化：改前崩、改后过）/ 边界（越界报可读错）。只跑「改前改后 diff 一致」不足以证明修好（可能两版都错）。
- **改完必须做正向敏感度测试**：临时造一个多出来的 `session-N` 目录，证明新版能发现、旧版会漏。
- **沙箱两条取数铁律（2026-09-09 实测）**：① `> /tmp/xxx` 重定向**不落盘**（写完立刻读会 `No such file`），要把输出喂给下一个程序就用管道直传 `cmd | python3 -c "json.load(sys.stdin)…"`；② `stat -f "%Sm …"` 格式串**失效**（吐出原始二进制 stat 字段如 `010000100000001a 255 …`），取 mtime 统一用 `ls -lT "$f" | awk '{printf "%s %s %s %s  %s\n",$6,$7,$8,$9,$NF}'`。
- **探测并发要收敛输出**：`pgrep -fl <pattern>` 匹配到带大段环境变量的进程（如含 `CODEBUDDY_SESSION_ID`）会一次吐几十 KB 被持久化。改逐个 `pgrep -f "$p" | wc -l` 或 `cut -c1-120`。
- **⚠️ 探测并发写入禁用 `find -newermt '-N seconds'`（2026-09-09 实测恒返回 0，静默假绿）**：本机 BSD find 的**相对时间**写法完全失效——`find . -newermt '-3600 seconds'` 返回 0，同一时刻 Python 扫描实得 446 个；绝对时间 `-newermt '2026-09-09 17:10:00'` 与 `-mmin -2` 均正常。**判定「无并发」前必须看到命中列表为空，而不是看到命令 exit 0。** 首选 Python：
  ```bash
  python3 -c "import os,time;now=time.time();[print(time.strftime('%H:%M:%S',time.localtime(m)),p) for m,p in sorted([(os.stat(os.path.join(dp,f)).st_mtime,os.path.join(dp,f)) for dp,dn,fn in os.walk('.') if '/.git' not in dp for f in fn if now-os.stat(os.path.join(dp,f)).st_mtime<120],reverse=True)]"
  ```
  次选 `find . -mmin -2 -type f`（分钟粒度，够用）。
- **改 `_shared/` 后各讲必须复验**（五层定式见 `references/hidden-slides.md` 的「引擎版本对齐是硬约束」）。`_shared` 是跨讲共享源，一次改动可能悄悄破坏未参与改动的讲。

## Resources

### references/（按需读，别通读）

| 文件 | 装什么 | 何时读 |
|---|---|---|
| `references/AUTHORING.md` | 组件规范与排版预算 | **写内容模块前必读** |
| `replica-reproduce.md` | 复刻怎么"做出来"：动画复现、白块清理、S1/S2 与 S4/S5 差异、白底图转透明 | 复刻 / 白块 / 白底图 |
| `replica-verify.md` | 复刻怎么"验准"：保真核验链、排版拟合（铺满舞台） | 核验保真 / 排版不饱满 |
| `branding-build.md` | 品牌化 + `rebuild.sh` 构建顺序 | 署名 / 抹原作者 |
| `hidden-slides.md` | 隐藏页全链路（hidden.js、部署侧铁律、逐字稿页处理、断言不许静默缺席） | 隐藏页 |
| `thumbnail-wall.md` | 看片台（缩略图墙）+ 分隔条标题 | 看片台 / 缩略图 |
| `presenter-anim-indicator.md` | 演讲者视图「本页还有动画吗」绿红边框 | 演讲者视图 |
| `polish.md` | 打磨闭环（原 `polish-slides`）+ 逐字稿口语化润色 | 按意见改课件 / 润色逐字稿 |
| `deck-editing.md` | 插入源 PPT 页、拖拽重排 `split_slides_blocks` | 插入页 / 重排 |
| `acceptance.md` | 内联去重 · 两层验收（哈希+像素）· **引擎版本对齐 + 五层复验** · 发布衔接 | 验收 / 改引擎 / 上线 |
| `lessons.md` | 按日期归档的历史固化教训 | 踩坑前扫一眼 |

### assets/
- `play.command` — 放映启动器模板（QuietServer 版，复制到课程根改标题即可）。

### scripts/
- `export_feedback.mjs` —（备选，沿用原 `polish-slides`）用 Playwright 从某个已打开页面的 localStorage 导出/清空意见。**自动落盘后通常不再需要**——前端把意见写进磁盘 `feedback.json`，打磨流程直接读文件；仅当要从某个特定 origin 的已打开页面导出时用，且要求 origin 完全一致。

### 视频 vsp 补丁同步（2026-09-04）
- 修 video bug 时若只改了部署 HTML 里的内联 engine，**必须把补丁回植到框架 `_shared/deck-engine/engine.js`**，否则重建回归。回植后验收三步：① `node --check`；② 规范化 diff（把 title/SCRIPT_SESSION/VIDEO_CONFIG 归一后 diff，session-3 的 DECK_CONFIG 在 script[0]，script[1] 是 SYNC 层）；③ `_shared/build/deck_builder.py sessionN_content.py /tmp/testbuild` 后 grep 补丁标记。
- OneDrive 路径上 grep/grep 工具会假阴性，用 python 读文件。

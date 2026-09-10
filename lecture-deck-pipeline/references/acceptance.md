# 构建产物验收与发布衔接

> 由 `SKILL.md` 的相关章节拆出。**验收 / 体积异常 / 哈希对不上 / 像素回归 / 改引擎后复验 / 上线上传时读。**
>
> 含四块：内联资产去重 · 两层验收（哈希 + 像素）· **引擎版本对齐与五层复验** · 发布衔接。

---

### 内联资产去重：HTML 体积 −51%（`_shared/build/dedupe_assets.py`，2026-09-10）

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

### 两层验收：哈希层 + 像素层（2026-09-10 落定）

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

### 线上发布：学生版 deck → 课程主页（2026-09-07 起常备链路）

> 本节的实例值（桶名、域名、主页 repo 路径）是本课程特有的，所以留在这里；**通用的七阶段部署管线（镜像重建 → 裁剪 → 瘦身 → COS 上传 → 发布 → 线上验收）见 `deploy-slides` skill**，不在此重复。

- **工具**：`_shared/tools/deploy/build_publish.py`（幂等，断言式；2026-09-10 从课程根 `tools/` 上提）——源 `04-deploy/session-{N}/index.html` → 主页 repo `~/Code/<主页repo>/teaching/<课程slug>/session-{N}/index.html`。五变换：媒体 `../media/decks/`→COS 绝对 URL（`<COS_BUCKET>-<AppID>.cos…/lecture-01/media/decks/`）；notes fetch `../../02-script/data/`→`../data/`（JSON 快照随发布）；`openPresenter(){ return;` 禁用 presenter（S 键/按钮全兜底）；删演讲者按钮 DOM；`attachSegButton(){ return;` 禁 ✂ 剪辑器。fonts 整体拷 `out_root/fonts/`。
- **COS 路径段**：`course_root.course_slug()` 只取 `lecture-NN` 前缀（目录名 `<课程目录>` → COS 段 `lecture-01`）；不一致时用 `--cos-slug` 覆盖。拼错会**线下正常、线上全 404**。
- **媒体上传**：`rclone copy 04-deploy/media/decks cos:<COS_BUCKET>-<AppID>/lecture-01/media/decks`（420MB/49s；copy 幂等可增量）。上传未完成时浏览器请求 404→`ERR_BLOCKED_BY_ORB`，传完自愈——别误判为坏链。
- **官网接线**：`teaching/<课程slug>.html` lectures[N] 加 `sessions: [url,...]` 字段，renderLecture 优先按 sessions 渲染 `matBtn('Session N', …, 'fas fa-tv')`，无 sessions 才回退 PPT/Notes 占位。
- **脚本自检教训**：字面串残留检查用 `in`，别把含 `.` 的字面串传 `re.search`（`.` 通配会把 COS URL 里 `01/media/decks/` 误判成 `../media/decks/`）；「演讲者视图」字样在注释里也有，只有按钮 DOM regex（`<button[^>]*data-act="pres"`）是真判据。
- **更新流程**：改 notes JSON（免重建）→ 重跑 build_publish + commit/push；deck 重建/媒体改动 → 重跑 build_publish + rclone 增量 → push。公开仓库推送前做 PII 审计。
- **线上验收基线（2026-09-07 首发实测）**：三 deck 27/28/21 页、presBtn/segBtn 均无、notes=ok、COS 图 broken=0、JS 0 错误；官网 Week1 materials 渲染 Session 1|2|3。

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
只想验一讲用 `ONLY=<课程目录> bash run_all.sh`（自动跳过其余讲并打印 `# skip …`），
或手跑单个套件（端口 8561–8567 之类错开，避开用户 `play.command` 的 8321/8322/8400）。

### 三套验收脚本的分工（跑全量时都要过）

| 脚本 | 覆盖 | 关键判据 |
|---|---|---|
| `check_deck.mjs <deck_dir>` | 逐页 overflow/破图/坏视频/空讲稿 | **用 `visTotal` 而非 `total` 比 TOC 条数**（否则每个隐藏页都误报「toc links 少一条」）；隐藏页另开 `?embed=1` 趟跑 |
| `verify_hidden.mjs <http_base> <session-dir>…` | 隐藏页 12 项行为语义 × light/dark | TOC 序号连续、隐藏标题不泄漏、`visTotal`、presenter 页码/进度段/End 键。**传目录不要传 `index.html`**——脚本自己拼 `/index.html`，多传一层会 404 超时 |
| `final_accept.mjs <http_base>` | 整体功能汇总 | `total/nav/toc/notes/arrow/presNav` + `jsErr=0` + `ext=0`（离线合规） |

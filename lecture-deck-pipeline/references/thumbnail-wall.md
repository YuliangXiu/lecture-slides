# 看片台（缩略图墙）工程教训

> 由 `SKILL.md` 的相关章节拆出。**看片台 / 缩略图 / #序号定位 / 元素标注 / 分隔条标题时读。**

---

### 看片台（缩略图墙）工程教训（2026-09-09）

- **`02-script/index.html` 是生成产物，严禁手工编辑**——唯一权威源是 `_shared/viewer/viewer.template.html` + `build_viewer.py` 的 COURSES 参数集。改产物 = 制造漂移，下次 `--all` 直接覆写。**改完模板必须重建**：`python3 build_viewer.py --all --repo-root "<<课程根> 根>"`。
- **`--repo-root` 必须指向直接含 `lecture-*` 的那一层（2026-09-09 加守卫）**：误传 `_shared` 会静默生成 `_shared/lecture-0X-*/02-script/index.html` 幽灵产物——内容正确、位置非法、无人引用，排查很费时间。现在 `_resolve_repo_root()` 会校验目录存在、含 `lecture-*`、且不在 `_shared` 内，违反直接 `SystemExit`；单课程 `--root` 同样禁止落在 `_shared` 内。发现 `_shared/lecture-*` 一律视为残留（非权威源，md5 与正确产物相同也只是巧合），用 `trash` 清掉，不要 `rm`。
- **从产物反推模板的可靠手法**（当只有产物被改过、模板是旧版时）：以已验证产物为蓝本，把 7 个 token 的**已解析值**反替换回去（`__TITLE__`/`__H1_EN__`/`__H1_ZH__`/`__SESSIONS_TEXT__`/`__SESSION_LIST__`/`__COURSE_DIR__`/`__LECTURE_ID__`），写完用 `re.findall(r"__[A-Za-z0-9_]+__", s)` 校验残留；再重建产物与备份做 `diff -q`，必须逐字节一致。**各 token 的出现次数会随功能增加而变，不要凭记忆写死**：写脚本前先 `grep -c` 实测（2026-09-10 实测 `__COURSE_DIR__` 4 处、`__SESSION_LIST__` 3 处，旧版笔记写的「各 2 处」已过期）。替换时对每个 token 断言 `count == 期望`，命中数不符立即中止，别写出半对半错的模板。
  - **反向校验只禁「必须被参数化」的字面量**：`lecture-02` 在历史注释（事故复盘、页数说明）里也出现，两个文件本来就一致，一并禁止会假报错。禁的是 `<课程名> · Lecture 2`、`第二讲`、`data/session{1..N}`、`[1, 2, 3]`、`return 'Lecture02'`、`polish-feedback-v3:lecture-02` 这些。
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
- **多 session 硬编码清理**：`boardCommit` 的 `all` 要用 `Object.keys(orders).reduce(...)` 而非 `[].concat(orders['1'], orders['2'], orders['3'])`；否则 6 session 的 lecture-02 保存重排会丢页。
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
  - **本坑跨讲**：`_shared/tools/shoot_thumbs.cjs` 是 L01/L02 共用唯一副本，改一次两讲都受益。lecture-01 实测同样中招（S3.10 标题里透出上一页的「Course at a Glance」），重拍后恢复。
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
- **OneDrive 回写覆盖（2026-09-09 实测）**：在 云同步目录路径上写入生成产物后，云端可能把旧版本/冲突版本推回，表现为「构建脚本报 wrote 但文件内容没变」或「刚写对的 L01 产物变回 L02 内容」。**构建后必须立即校验 md5 + 关键标记**（`board-filter`/`MAX_COLS`/`Promise.all([...])` 的 session 列表），并间隔数秒复测稳定性；发现被覆盖就重写并再次校验，不要假设一次写入即落盘。
  - **更强的自检手法**：不依赖文件 mtime，直接 `import build_viewer; build_viewer.render(key)` 拿内存渲染结果，与落盘内容比 `==`。一致说明落盘就是权威模板的产物，OneDrive 没插进旧版本。
    ```python
    import importlib.util, sys, pathlib
    spec = importlib.util.spec_from_file_location("bv", "build_viewer.py"); bv = importlib.util.module_from_spec(spec)
    sys.argv = ["build_viewer.py"]; spec.loader.exec_module(bv)
    out = bv.render("lecture-01")   # 注意 render() 只吃 course_key，不是 (template, cfg)
    cur = pathlib.Path("<course>/02-script/index.html").read_text(encoding="utf-8")
    assert out == cur
    ```

### 看片台分隔条标题（`.bsep`）

曾出现三重冗余：`Session 1Body Models: A History63 slides · 隐藏 10`。
源头在 `_shared/viewer/viewer.template.html`，改完必须 `python3 build_viewer.py --all --repo-root "<课程根>"` 重建，
再断言六条分隔条各自含 `Session N` + 主题名、且无叠字。E2E 采集 `sepTexts` / `headerText` 做语义断言。

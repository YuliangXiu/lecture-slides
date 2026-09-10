# deck 结构性编辑：插入页与拖拽重排

> 由 `SKILL.md` 的相关章节拆出。**只在「插入一张源 PPT 页 / 拖拽重排 / split_slides_blocks」类任务时读。**

---

### 往 deck 里插入一张源 PPT 页（2026-09-09 落定）

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

### 拖拽重排 `split_slides_blocks` 尾逗号坑（2026-09-09 修复）

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
- **已知假红（非缺陷）**：`test_thumbs_fingerprint.cjs` 的 F2「改某页文字只应重拍该页」在 **lecture-02 恒 FAIL**（`needed=64`）——测试取中位数页做样本，该页含 `<style>`/`<link>`，改它等于改 deck 级依赖，全量重拍是**正确行为**；lecture-01 样本页不含则通过。看到 F2 单条红不要误判成缩略图指纹坏了。根因是样本选择缺陷，修复方式是挑不含 style/link 的页。
- **一键跑**：`cd _shared/viewer/tests && bash run_all.sh`（自动定位仓库根 = 脚本上三级 `tests/ → viewer/ → _shared/ → 根`；`SHOTS=1` 出图到 `/tmp/board-shots/<lecture>/`，`SHOTS_DIR=` 改根目录，`BASE_PORT=9000` 换起始端口）。**截图必须按讲分目录**——两讲同名 `board-all.png` 平铺会互相覆盖。
- **单讲跑**：`ONLY=<课程目录> bash run_all.sh`（子串匹配，可逗号分隔多个；默认跑全部 `lecture-*`）。并发期间别的会话正在写某讲时**必须用它绕开**，不要为了跑全量而等或抢。
- **分层**：`smoke_test_viewer.js` 只验「页面活着」（title/h1/#root/.slide/console），**不覆盖看片台**；看片台行为归 `test_board.cjs`（26 断言）；拖拽归 `test_board_drag.cjs`（7 断言，不写盘）；意见落盘去重归 `test_feedback_save.cjs`（12 断言，临时副本）；隐藏页过滤归 `verify_hidden_script.cjs`（9 断言）；刷新缩略图 dirty 保护归 `test_board_refresh_dirty.cjs`（5 断言）；**删除页端到端消失归 `test_board_delete_e2e.cjs`（A0–A10，会真实写盘但脚本内部自建隔离副本）**；**多选整组拖拽 + 批量复制序号归 `test_board_multisel.cjs`（M1–M16）**；**缩略图增量判据归 `test_thumbs_fingerprint.cjs`（F0–F8b，DRY 不写盘、无需端口）**。端口分配 `BASE+0..BASE+7`。
- **测试样本必须自备（2026-09-09 A10 血案）**：A10 校验 `remapFeedbackGlobal()` 改写的意见键页码，原设计从 `02-script/data/feedback.json` 水合出样本 —— 但 **lecture-02 的该文件是空文件（items=0）**，样本恒为 0，断言永远跳过、打印 `ALL OK` 的假绿。修法：加 `A10a` 播种步骤，测试自己按重排前 DOM 真值往 localStorage 写 4 条意见键（覆盖删除点前 / 删除页本身 / 删除点后 / 末页，首条带 `ppt`+`script` 两种 type），并强制 `n>0` 否则 FAIL。**通则：比对类断言的输入若来自仓库文件，要么测试自备，要么显式断言样本量下限。**
- **断言不得依赖「错误实现才有的副作用」**：A10 首版靠 `counter.fbItems`（即「remap 写错 → 触发写盘 POST」）取样，remap 修好后副作用消失、断言静默跳过。**修 bug 时必须同时确认断言还在真跑**。
- **`page.evaluate` 取不到内联 `<script>` 里的 `const`**（IIFE 作用域）：`FB_KEY` 在页面里不可见，测试侧用 `FB_PREFIX = 'polish-feedback-v3:' + path.basename(COURSE_SRC)` 自拼（`__COURSE_DIR__` 注入值 = lecture 目录名，非 `--course` 短名）。
- **修完断言必做负向验证**：临时还原错误实现 → 断言必须 FAIL 且报出可定位的真值差异（A10 实测报 `S1.010 键=1:7 真值=1:6`；批量复制实测报 `FAIL M13 n=1 want=3 clip=Lecture02-Session01-S1.006b`）→ 再恢复产物并 grep 确认无残留标记。
- **断言里的格式正则不能比数据更严**：M13c 首版写 `/^Lecture\d{2}-Session\d{2}-S\d+\.\d+$/`，被合法 sid `S1.006b`（字母后缀）判 FAIL。**先取真实样本再定正则**，或直接与 DOM 真值比对而不校验格式。
- **自验截图前先确认目标特性真实存在**：`shot_multicopy.cjs` 首版按 light/dark 各出一套图，但 **viewer 模板根本没有暗色主题**（无 `prefers-color-scheme`、无 `data-theme`），两张图逐字节相同 —— 看着「都验了」，实为假自验。出图前先 grep 确认主题机制存在，否则只出 light 并在脚本头注明。
- **`test_board_delete_e2e.cjs` 的做法值得照抄**：脚本自己 `mkdtempSync` 复制 `02-script`/`tools`/`03-slides`、把 media 目录 `symlink` 过去（不复制 800MB+）、复制 `_shared`，再用 `NEWDECK_SHARED=<副本>` 启动**真** `reorder_deck.py`——所以它能跑真实链路却绝不碰真实仓库。断言链：点 ✕ → `is-removed` → 保存重排 → 后端返回 ok → `location.reload()` 后**看片台不再有该 sid + 卡片数 −1 + 其余卡片无连带丢失 + 逐字稿正文 `.slide[data-sid]` 也不含**。**负向验证过**：把后端换成「返回 ok=true 但不写盘」的桩，精确报 `FAIL A5 / A6 / A8` 且 `exit=1`——证明断言不是空跑。
- **期望值数据化**：`lib/harness.cjs` 的 `readExpect(courseDir)` 从 `02-script/data/session*.json` 累加 `sections[].slides[]` 推导总页数与各 session 页数。**禁止在测试里硬编码页数**——讲次增删/页数变动必须自动适配。**任何写进文档的页数都只是当次快照，验收一律现场从数据源推导**（L02 曾 685 页/6 session，经两轮删讲次与页面重分发后现为 267 页/3 session）。
- **端口自愈（必守）**：`harness.cjs` 的 `listen(port, tries=50)` 遇 `EADDRINUSE` 自动 `port+1` 重试并返回实际端口；`smoke_test_viewer.js` 的 `pickFreePort()` 同理。**测试不得假设固定端口可用**——用户常同时开着 `play.command`（Python `http.server`，`address_family=AF_INET6` 占 `*:PORT`），会直接撞车。日志里出现 `# port 8400 被占用，改用 8401` 是正常自愈，不是失败。
- **端口冲突排查**：`lsof -nP -iTCP:<port> -sTCP:LISTEN` 看 PID + `lsof -p <pid> | grep cwd` 看归属；**沙箱里 `ps` 被拒**（`operation not permitted`），只能用 `pgrep -x` / `pgrep -f` / `lsof`。别盲杀——可能是用户正在放映的服务。
- **几何断言不能只看「每行 ≤N」**：行塌陷时同排卡片 `top` 相同会被算作同一行而**假通过**。必须同时断言横向不重叠（`row[i].l < row[i-1].r - 0.5` 计数为 0）、相邻行纵向不重叠、`cellH >= 90`、`img` 实高 > 50。`GEOM_FN` 已封装。
- **bash 脚本自检**：`bash -n run_all.sh` 后跑一次真机；仓库根用相对路径上溯时要数清层级（曾少一级 → 解析成 `_shared` → 6 个套件全 ENOENT），并加启动前 `ls "$REPO_ROOT"/lecture-*` 校验。

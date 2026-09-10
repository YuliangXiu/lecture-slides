# 隐藏页（hidden slides）全链路

> 由 `SKILL.md` 的相关章节拆出。**只在「隐藏页 / 放映跳过 / 隐藏页计数错位」类任务时读。**

---

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
python3 _shared/build/test_apply_hidden.py --deck <课程目录>
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

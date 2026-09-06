---
name: polish-slides
description: 从 02-script/data/feedback-history.json 读取所有 status=unsolved 的意见条目作为任务队列，把「PPT 意见 / 逐字稿意见 / 前插 / 后插」四类修改意见路由到 deck 与逐字稿并全局润色，保证 PPT-逐字稿一致、中英对照一致，重建验收后把已修复条目打上 solved。调用方式：polish-slides <feedback-history.json 或 feedback.json 路径>。触发词：polish-slides、slide-polish、应用修改意见、导出修改意见、按意见改课件、改逐字稿、polish slides、插入页。
agent_created: true
---

# Polish Slides（修改意见收集与应用流水线）

## Overview

课件打磨闭环：讲师在双语逐字稿对照页逐页记录意见，点「导出意见」把 feedback.json 的当前意见按合并规则并入 `02-script/data/feedback-history.json`（新意见→新增 unsolved；完全相同→跳过；同槽位少量文字差异→不覆盖原条目，差异另存为 `key#2` 新记录）。本 skill 每次运行时**从 feedback-history.json 读取全部 `status:"unsolved"` 条目作为任务队列** → 解析 → 路由 → 全局润色 → 重建验收 → 把已成功修复的条目打上 `solved`。

- **收集端（已完成，见前端）**：`02-script/index.html` 每页卡片含两个 textarea（`ppt` / `script`）+ 上下各一个「＋插入」按钮（`insert-before` / `insert-after`）。所有输入即时写 localStorage，`600ms` debounce 后 POST `/api/save-feedback` —— **只写临时存储 feedback.json**。
- **导出按钮行为**：点击「导出意见」→ POST `/api/export-feedback` 把 feedback.json 当前意见合并进 feedback-history.json → 剪贴板复制的是 **history 文件路径尾段**（从 `lecture-xx` 目录组件起，如 `lecture-01-introduction/02-script/data/feedback-history.json`）。
- **本 skill 负责**：读 history 的 unsolved 队列 → 路由 → 全局润色（含前后插入新页）→ 重建验收 → 打 solved。

## 前置依赖

- **`prompt-optimizer` skill（提示词增强，强制前置步骤，见 Workflow 第 2 步）**：所有意见在应用前必须先经它增强。
- **`video-download` skill（含视频链接意见的前置，见 Workflow 第 3 步）**：处理含 YouTube/Bilibili 链接的 `ppt` / `insert-*` 意见时，先按它把视频下载到本地再落 deck。
- 复用 `lecture-deck-pipeline` 的构建与验收脚本（`deck_builder.py` / `check_deck.mjs` / `final_accept.mjs`）。
- 目录约定、notes 单一数据源、file:// 硬约束、云同步目录（如 OneDrive）覆写规则等**全部沿用** lecture-deck-pipeline 的 SKILL.md，不在此重复。

## 意见的存储契约（前端 ↔ 本 skill 的接口）

本 skill 的任务队列来自 `02-script/data/feedback-history.json` 的 `records`（见下「持久化与分工」）。每条记录的字段与意见条目一致（feedback.json 是前端临时存储，字段格式相同）：

```json
{
  "saved_at": "2026-09-02T19:00:00.000Z",
  "records": {
    "1:S1.03:ppt": {
      "key": "1:S1.03:ppt", "sess": 1, "page": 3, "sid": "S1.03", "type": "ppt",
      "text": "把 gallery 放大改成 hover 居中显示",
      "status": "unsolved", "opened_at": "...", "resolved_at": null
    }
  }
}
```

字段含义：

| 字段 | 说明 |
|---|---|
| `sess` | `1|2|3` → 对应 `session{N}_content.py` 与 `02-script/data/session{N}.json` |
| `page` | 1-based 页码 → deck 内容模块的 `DECK['slides'][page-1]` |
| `sid` | slide id，如 `"S1.01"`（含点**不含冒号**）→ 在 `session{N}.json` 里按 id 定位 |
| `type` | `ppt` / `script` / `insert-before` / `insert-after`（见下表） |
| `text` | 意见原文（自然语言，需你转成具体改动，不是机械替换） |

### 持久化与分工（feedback.json ↔ feedback-history.json，2026-09-03 重设计）

- **feedback.json = 临时存储**：只存「当前正在编辑页面的意见」，前端自动落盘 + 清空按钮都只碰它，**不承担历史记录功能**。
- **feedback-history.json = 唯一历史账本 + 本 skill 的任务队列**（同目录）：以 `key = "sess:sid:type"` 为稳定槽位，每条记录含
  `{key, sess, sid, type, page, text, status, opened_at, resolved_at}`；同槽位的差异文本作为 `key#2`、`key#3`… 变体记录追加（含 `variant_of` 字段），不覆盖原条目。
- **status 三态**：`unsolved`（待处理 = 本 skill 的任务）/ `Ongoing`（已被认领、处理中，防重复派发）/ `solved`（已修复，带 `resolved_at`）。旧数据中的 `pending`/`resolved` 已一次性迁移；导出时后端也会自动归一。
- **写入方只有两个**：① play.command 的 `/api/export-feedback`（合并规则见上，幂等：同槽位全家含 `#n` 变体中已有完全相同文本 → 跳过）；② 本 skill 修复成功后把条目打 `solved`。
- **save / clear 与 history 完全解耦**：`/api/save-feedback`、`/api/clear-feedback` 只写 feedback.json。不要指望「清空」影响 history，也不要往 history 里做 reconcile 式补记。

### 任务队列的读取与回写（本 skill 的接口）

1. **读取**：解析 `02-script/data/feedback-history.json`，取 `records` 中所有 `status == "unsolved"` 的条目，按 `sess → page → type` 排序处理。
2. **先标 Ongoing（防止重复派发，2026-09-04 起）**：开始处理某条意见前，立即把该条 `status` 改为 `"Ongoing"`（原子写回，同下）。status 是三态：`unsolved`（待处理）→ `Ongoing`（已被某 agent 认领、处理中）→ `solved`（已修复，带 `resolved_at`）。这样多个 agent / 多轮运行并行时，其他运行看到 `Ongoing` 就会跳过，不会重复应用同一条意见。若本轮 agent 中途崩溃，下轮运行遇到长期停在 `Ongoing` 的条目应向用户确认后重新认领（改回 unsolved 再处理）。
3. **回写**：每条意见**成功修复并通过验收后**，把对应记录改为 `status:"solved"` + `resolved_at`（ISO 时间戳），原子写回（临时文件 + os.replace）。部分失败时只把成功的打 solved，失败的保持原状态（unsolved 或 Ongoing→回滚为 unsolved）并在回复中说明。
4. **去重提醒**：同槽位存在 `#n` 变体记录时，逐条独立判断是否已由本次修复覆盖；同页多条意见可合并实施，但**逐条**回写状态。

## 四类意见的路由

| type | 目标文件 | 修改对象 |
|---|---|---|
| `ppt` | `session{N}_content.py` | `DECK['slides'][page-1]['html']`（排版/内容/动画） |
| `script` | `02-script/data/session{N}.json` | 按 `sid` 找 slide，改 `en` 并**同步 `zh`** |
| `insert-before` | **两者** | 在 `sid` 之前新增一页（deck 插 slide + 逐字稿插 en/zh 对应条目） |
| `insert-after` | **两者** | 在 `sid` 之后新增一页（同上） |

> 插入类意见的 `text` 是「要新增的页 / 素材 / 文字写法 / 页数」的纯文字描述，需你解读成具体的新页内容，并**同时**落到 deck 与逐字稿两处，保证二者一致。

### 含 YouTube/Bilibili 链接的意见（视频素材下载前置，2026-09-06 起）

- 当某条 `ppt` / `insert-before` / `insert-after` 意见的 `text` 里出现 YouTube 或 Bilibili 链接（或纯 BV 号），且语义是「引入/替换视频」时，**先调用 `video-download` skill 把视频下载到本地** `03-slides/media/decks/session-N/videos/`，再落 deck（`<video data-vid>` + `video_config` 的 `{key:{start,end}}`），**禁止直接用 YouTube/Bilibili iframe 外链嵌页面**（破坏离线自包含）。
- 下载全程不向用户确认（`video-download` 的默认行为）；仅当所有备选方案都失败（403/412 等）才上报，并保留 iframe / 占位兜底等用户裁决。
- **例外**：`script` 意见里的链接仅作资料引注、无「引入视频」意图时，不触发下载——只改逐字稿文案。

## 调用方式（参数规范）

```text
polish-slides <feedback-history.json 路径>

# 例（从课程目录起算；讲师页「导出意见」按钮复制到剪贴板的即是此类路径）
polish-slides lecture-01-introduction/02-script/data/feedback-history.json
```

- 首选传 feedback-history.json 路径。若传入的是 feedback.json（旧习惯），取其**同目录的 feedback-history.json** 作为任务队列。
- 队列为空（无 unsolved 条目）时直接告知「无待处理意见」，不要空跑构建。

## 逐字稿意见的转写与润色原则（硬约束）

讲师提文字稿（`script` / `insert-*` 的逐字稿部分）意见时，通常讲得啰嗦、口语化，且中文比英文复杂。应用时**不要机械照搬意见原文**，把意见当作「内容要点」，先吸收、再重写：

1. **先转英文、再翻中文**（写作顺序）：
   - 先提炼意见里要传达的内容点，用**平实简单的英文**写出来——词汇控制在 CET-4/6 或托福水平，短句优先，避免从句堆叠、生僻词。
   - 英文定稿后，再**逐句翻译成中文**，保证 `en`/`zh` 逐句对应、语义等价（这是硬规则）。中文可以比英文更丰满、更口语、更贴近讲师语气，但结构仍与英文逐句对齐。

2. **顺承讲课节奏**：不是孤立改这一页，而是让新文案与**上一页、下一页**自然衔接——承接上页已讲的、为下页做铺垫。可适当压缩啰嗦表达、调整叙事节奏，把讲师说的内容「整合进去」而不是「塞进去」。

3. **内容优先于措辞**：意见里「要讲什么」必须保留，「怎么讲的措辞」可自由重排、精简、润色。宁可写得更短更清楚，也不逐字复述啰嗦原文。

4. **PPT 意见也是逐字稿的内容来源**：某页只有 `ppt` 意见、没有 `script` 意见时，逐字稿**默认跟随 PPT 的调整**同步改写；同时 `ppt` 意见文本里若夹带了本可直接口述的内容点（举的例子、补充的背景、某句可以直接讲出来的话），要主动提炼进 `en`/`zh`，不要因为「没提文字稿意见」就漏掉。

## Workflow

### 1. 解析意见（任务队列）
读取 feedback-history.json 的 `records`，过滤 `status == "unsolved"` 的条目，按 `sess → page → type` 排序（type 序：`insert-before < ppt < script < insert-after`），同一页的插入要在改该页之前处理，避免 page 索引漂移。每条记录记下它的 `key`（含可能的 `#n` 后缀），供第 6 步回写状态。

### 2. 意见增强（强制前置步骤，固定工作流，不可跳过）

**规则（2026-09-03 用户定稿）：每次运行本 skill，都必须把收集到的全部修改意见先交给 `prompt-optimizer` skill处理，生成更具体、更明确的增强提示词，再用增强后的提示词去修改 Slides 内容。先增强、后修改——顺序不可颠倒。**

做法：

1. 加载 `prompt-optimizer` skill，把**逐条意见**（连同其 `sess/page/sid/type` 上下文）作为待优化的原始 prompt 交给它处理。
2. 增强 prompt 必须满足以下结构（对应 prompt-optimizer 的 OPTIMIZE 框架），且**核心主旨不偏移**——增强的目的是**更准确、更高效地修改 Slides 内容**，不是扩写意见或加戏：
   - **修改目标**：这条意见最终要把该页/该段逐字稿改成什么样（deliverable 明确、可验收）；
   - **涉及的内容范围**：明确到哪一页（sid/page）、deck 的哪个部分（html 布局 / 动画 / 媒体）、逐字稿的哪些句子（en/zh 对应范围）、是否波及相邻页衔接；
   - **预期效果**：改完后可观察/可检查的结果（如「gallery 缩略图 hover 后放大居中，不遮挡控制栏」「该页 en 拆成两句且 zh 逐句对应」），并写明约束（双语逐句对应、排版守则、幂等守卫等本项目硬规则照抄进约束项）。
3. 若某条意见原文已经足够具体（目标/范围/效果三要素齐全），增强步骤只需做**格式规范化 + 补全隐含约束**，不得为了「增强」而改变讲师原意。
4. 增强产物（增强提示词清单）先在回复中简要呈现（每条：sid+type → 增强要点一句话），再进入第 3 步应用。讲师原意与增强结果冲突时，以讲师原意为准并在呈现时标注。

### 3. 路由 + 应用（硬约束）

- **live 内容模块路径**：`session{N}_content.py` 不在课程工作目录，实际在部署工程 `<repo>/newdeck-framework/`（改前先 `ls -la` 按修改时间确认最新版，勿改 bak/ 里的旧副本）。改前备份到 `newdeck-framework/bak/*.pre-polish-*.bak`。
- **script 意见**：`session{N}.json` 是逐字稿唯一数据源，改 `en` **必须同步改 `zh`**（双语逐句对应，讲师明确抱怨过不对应）。**不要机械照搬意见原文**——遵循「逐字稿意见的转写与润色原则」（先提炼要点 → 平实简单英文 → 再逐句翻中文）。改完刷新即生效，无需重建 deck。
- **ppt 意见**：改 `session{N}_content.py` 的 html。遵守「守卫 sentinel + `_func(html)`」幂等模式；媒体容器贴合真实宽高比；多页递进图序列像素级对齐。
- **insert-before/after**：在 deck 的 `DECK['slides']` 对应位置插新 slide（含 `layout/ttitle/notes/html`），同时在 `session{N}.json` 的对应位置插新 slide 条目（`en` + `zh` 同步编写，逐句对应）。插入后后续 slide 的 `page` 会顺移，注意维护索引一致性。
- **含视频链接的意见**：见上方「四类意见的路由 · 含 YouTube/Bilibili 链接的意见」——先 `video-download` 下载到本地再落 deck，禁止 iframe 外链。
- 逐条应用时，对每条意见做「是否可行 + 如何落地」的判断。

### 4. 两项一致性（全局润色的验收标准）

1. **PPT ↔ 逐字稿一致**：每条 `ppt` / `insert-*` 改动落到 deck 后，逐字稿里对应的 `en`/`zh` 必须同步反映同样内容；**某页只有 PPT 意见、没有文字稿意见时，文字稿默认跟随 PPT 调整**。反过来 `script` 改动若改变了页面内容，deck 排版也要跟上。二者始终同一事实来源。
2. **中英对照一致**：逐字稿每个 slide 的 `en` 与 `zh` 逐句对应、语义等价、无漏译/多译。这是讲师明确的硬要求。

### 5. 重建 + 验收（复用 pipeline）

```bash
python3 deck_builder.py session{N}_content.py <云端同步根目录>/03-slides/session-{N}/
node check_deck.mjs <deck_dir>          # 逐页 overflow/离线外链
node final_accept.mjs <course>/03-slides
```

### 6. 回写状态（solved）
应用并通过验收后，把本次成功修复的每条记录（第 1 步记下的 `key`）改为 `status:"solved"` + `resolved_at`，**原子写回** feedback-history.json（临时文件 + `os.replace`；云同步目录（如 OneDrive）上先写 /tmp 同分区临时文件再 os.replace 会跨设备，直接用同目录临时文件）。失败的条目保持 `unsolved` 并在回复中说明原因。**不要**动 feedback.json——它只是前端当前页的临时存储，清空与否由讲师在页面上操作。

## 关键坑

- **sid / page 会漂移（2026-09-04 实锤）**：`1:S1.23` 实际目标在 session3 的 The Roadmap（S1.21–S1.27 是历史删除/重编号的孤儿 id），feedback 里的 `page` 也可能过时。定位真身时**以文本关键词 + 标题匹配为准**（用 text 里的独特短语在 session{N}.json 和 deck ttitle 里搜），`page`/`sid` 只作起点提示。截图自验同理：先读 deck 页脚 "n / N" 指示器确认页码，别信 feedback 的 page 直算 `go(page-1)`。
- **并行 polish run 冲突**：另一运行可能同时在改同一批文件（session json / content modules）。动手前用文件 mtime 检查近 30s 是否有写入活动，或直接向用户确认错峰策略；`Ongoing` 标记只防重复认领，不防同文件交叉覆写。**另一 run 还可能「做了不认领」**（2026-09-04 实锤：5 条 unsolved 已被并行 run 全部实现但状态未动）。认领后先考古：diff `bak/` 最新备份、grep 部署态 HTML、对照 session{N}.json，判断每条是否已实现——已实现的只做核验（check_deck + final_accept + 截图）后关账，缺的才补，**绝不盲目重做**。谁打 solved 谁负责验证。
- **重建会清掉编辑模式的媒体编辑（2026-09-03 事故）**：编辑模式（换/删/裁）的 ops 只对部署态 index.html 做手术。现已有持久化链路：play.command 落 ops 到 `02-script/data/slide-edits.json`，deck_builder.py 重建后自动重放——**重建必须走 deck_builder.py**（自带重放），不要手工改部署态 index.html。跑 polish 前若怀疑有未落日志的编辑，先 diff 部署态 vs 内容模块重建产物（`03-slides/session-N/index.html` 逐 section 对比）确认无差异再动手。
- **卡片编辑器 op 语义（重建重放时与 polish 的交互）**：编辑器现支持五类 op——`cardmove{left,top}` / `carddel` / `cardresize{w,h,fs}` / `crop{ox,oy,zoom}` / `replace{src}`，全部**绝对值、幂等**，重建重放任意顺序结果一致；其中 `cardresize` 会给卡内媒体注入 `fill`（w/h 100% + `object-fit:cover`）+ `flex:0 0 auto` + `fs` 落 figcaption。含义：**已保存的编辑器修改会与 polish 改动叠加，不会丢**——但若 polish 改了某张已被编辑器动过的卡片的 html 结构（如重排 figure 内媒体、改 figcaption），重放的 `cardmove`/`cardresize` 会按 op 里的 `index`（**同标签局部序号**，非 img/video/iframe 混合序号）定位，结构变了可能错位。对「编辑器已动过 + polish 也要动」的同一页，改完先 diff 重建产物确认重放仍命中正确元素。完整设计见 `lecture-slides` skill 的 `references/card-editor.md`。
- **清空只清临时层（2026-09-03 重设计后）**：`feedback.json` 只是临时存储，真正的状态在讲师浏览器 localStorage（`polish-feedback-v2:*` 键）+ history 文件。直接清文件等于白清（前端会把 localStorage 的旧意见写回）。正确姿势：① 讲师页面点「清空」按钮（POST /api/clear-feedback，只清 feedback.json）或开 `02-script/index.html?fbwipe=1` 应急清 localStorage；② 意见是否处理完看 history 的 `status`，与 feedback.json 无关。旧版 `_reconcile_feedback`（save/clear 联动 history）已删除，别再找它。
- **`.media-grid figure img` 全局绝对定位坑**：style.css 有 `.media-grid figure img, .media-grid figure video { position:absolute; inset:0; width:100%; height:100% }`——媒体 figure 内**任何** inline icon `<img>`（如四宫格卡片图标）都会被强制绝对定位堆到容器左上角（讲师抱怨过「icon 全堆左上角」即此因）。修复：icon 内联加 `position:static` 压制。
- **封面 zh-note 是构建期注入的**：`<span class="zh-note">` 不在内容模块里，是 deck_builder 运行 `ann.py` 按 `/tmp/ann_map.json` 注入的（`{sess: {page: [{pattern, chinese, flags}]}}`）。删某页的中文注释 = 删 ann_map 对应条目，别去 grep 内容模块找 span。ann_map 在 /tmp，重启即失（缺失时全部页都不注入，属静默降级）。
- **`final_accept.mjs` 的 http server 必须与验收同一条 shell 命令内启动**（`python3 -m http.server ... & SRV=$!; ...; kill $SRV`），后台 `&` 跨 Bash 调用会被杀，报 ERR_CONNECTION_REFUSED。

- **localStorage 的 origin 隔离**：`http://localhost:8321` 与 `http://localhost:8322`、`file://` 是不同存储桶。**自动落盘已绕开此坑**——前端把意见写进磁盘 feedback.json，本 skill 直接读文件，不再依赖 Playwright 读 localStorage。旧 `scripts/export_feedback.mjs` 仅在需要「从某个已开着的页面导出」时作备选，且要求 origin 完全一致。
- **`sid` 含点号但不含冒号**：解析 key 时 `sid` 在 `parts[3]`，安全；但 `page` 用 1-based，deck 的 index 是 0-based，换算时 `page-1`。
- **插入会漂移 page**：处理多页插入时按从后往前（或按 page 从大到小）应用，或插完后重算索引，避免「插一页后原意见的 page 全部错位」。
- **script 改 zh 同步**是硬规则，漏改会被讲师指出。
- **notes 单一数据源**：deck 的 `notes` 取 `session{N}.json`，改逐字稿即改 notes，无需重建 deck；但改了 `session{N}_content.py` 的 html 必须重建 deck。
- 云同步目录覆写：沙箱拒 cp 覆写/rm，用 `mv 旧→bak + cp 新`。

## Resources

### scripts/
- `export_feedback.mjs` —（备选）Playwright 从 localStorage 导出/清空意见。自动落盘后通常不再需要；仅当要从某个已打开的页面 origin 导出时用。

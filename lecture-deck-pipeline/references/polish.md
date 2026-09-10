# 打磨闭环：意见队列 + 逐字稿润色

> 由 `SKILL.md` 的相关章节拆出。**只在「应用修改意见 / 按意见改课件 / 逐字稿润色 / 口语化改写」类任务时读。**

---

### 打磨闭环：意见队列 → deck + 逐字稿（原 `polish-slides`，2026-09-10 并入本 skill）


> **这就是原来 `/polish-slides <path>` 做的事**——把 skill 名换成 `lecture-deck-pipeline` 即可，参数与语义完全不变。

讲师在 `02-script/index.html` 逐页写意见 → 点「导出意见」并入 `02-script/data/feedback-history.json` → 本流程读 `status:"unsolved"` 队列 → 路由 → 全局润色 → 重建验收 → 打 `solved`。

**调用**（等价于旧的 `/polish-slides <path>`）：

```text
/lecture-deck-pipeline <feedback-history.json 路径>
```

自然语言同样命中（触发词已进 skill description）：**「把 feedback-history.json 里未处理的意见应用到课件」**、**「按意见改课件」**、**「run polish」**。不想打 skill 名就直接这么说 + 贴路径。

**调用约定**：传 `feedback-history.json` 路径（前端导出时复制到剪贴板的就是这个路径尾段）；传的是 `feedback.json`（旧习惯）时取**同目录的 history**。队列为空直接告知「无待处理意见」，**不要空跑构建**。

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

### 逐字稿口语化润色 + 三视图同步（2026-09-10 落定，L02 全量 267 页实战）

**场景**：讲者要把整讲逐字稿改成「念得出来的口播英文」（典型需求：定位托福口语 24 分、四六级词汇、句子短、不卡顿），
并保证逐字稿页 / 演讲者页 / 观众页三处一致。**这不是「打磨闭环」的 `script` 意见**——那条是按队列改个别页，
这条是**全量重写语言层**，且**内容、结构、逻辑顺序一律不动**。

### 先记住这条架构事实：`notes` 是 en/zh 的**严格逐句交错**

`02-script/data/session{N}.json` 里 `notes` = `en句1 + zh句1 + en句2 + zh句2 …`，由 `tools/merge_notes.py` 的
`interleave()` 生成。presenter 的 `splitNotes()` 靠标点分句、再按「含不含汉字」二分出 en/zh 两条流。
**⇒ 改 en 时句数必须与 zh 严格相等。少一句、多一句、合并两句，presenter 的分句就会整体错位，
hover 折叠的逐字稿片段全部对不上。** 所以润色的第一硬约束是：**一句还一句，不许合并 / 拆分 / 重排。**

### 三视图为何能一次同步（数据拓扑）

| 视图 | 文件 | 数据来源 |
|---|---|---|
| 逐字稿工作台 `02-script/index.html` | 由 `_shared/viewer/viewer.template.html` 渲染 | 运行时 `fetch('data/session{N}.json')` + `data/cuecards.json` |
| 演讲者页 `session-N/presenter.html` | deck 经 postMessage 转发 `state.notes` / `state.cue` | 由 deck 转发，自己不 fetch |
| 观众页 `03-slides/session-N/index.html` | `engine.js` 的 `loadScriptNotes()` | 运行时 `fetch('../../02-script/data/session{N}.json')` |

**三处都是运行时读同一份 JSON ⇒ 只改数据文件，三套 deck 与三套页面都不用重建、不用 rebake。**
（`data-notes` 属性在产物里全是空串，不要试图去改 HTML。）

### 唯一需要单独回填的地方：cue-cards 的 IN / OUT

`cuecards.json` 的 `en.enter` / `en.exit` 有相当一部分是**逐字照抄当时 en 的首句 / 末句**（L02 实测 221 / 177 处），
另一些是讲者自己写的口播句。改完 en 后要用**相等性**判定（不要模糊匹配）：

用**备份的旧 en** 分句 → `enter == 旧首句` 才替换为新首句；不等说明是另写的口播句，**必须保留**。
L02 实测：163 ENTER + 143 EXIT 替换、103 + 120 保留。**zh 侧中文没动就一律不动。**
回填后 `cuecards.json` 与 `cuecards-session{N}.json` 要一起写（后者是前者的子集副本）。

### 工作流

1. **备份**：`~/WorkBuddy/bak/script-polish-<ts>/` ← `session{1..N}.json` + `cuecards*.json`。
   后文所有「旧 en」比对都依赖它，**不带备份无法判定 cue-cards 该不该改**。
2. **分句口径必须与生产同源**：`re.split(r'(?<=[.!?])\s+(?=[A-Z"“\'(])', t)` —— 与 `merge_notes.split_en` 一致。
   用宽松断句器（`(?<=[.!?])\s+`）会把 `Beeler et al. 2011 template.` 切成两句，句数对不上，
   后面整套校验全部失真。**校验器口径与生产口径不同源 = 白做。**
3. **按 section 切批次**（不要按讲，也不要整讲一坨），导出
   `{sid, title, media, en_sents[], zh_sents[], cue_enter, cue_exit}`，**每个 section 一批子 agent**。
   L02 实测 22 批 / 859 句，一次派 8 批、三轮跑完。
4. **统一作业说明 `BRIEF.md`** 必须包含：① 一句还一句等硬约束；② 书面词 → 日常词替换表；
   ③ 讲者本人的语法六条清单；④ 真实的改写前后样例（3–4 组，比抽象规则有效得多）；
   ⑤ 明确输出 JSON schema。子 agent 要求自校验句数。
5. **二轮收紧**：统计仍 >25 词的句子，单独派批次压到 ≤24 词（仍是「一句还一句」）。
6. **回填**：`en` = 新句 join；`notes` = en/zh 重新 interleave；`zh` **不动**；然后按上面规则回填 cue-cards；
   同步 `tools/notes_out/session{N}.part*.json`（讲稿上游暂存，不同步下次 merge 会覆盖回去）。
7. **验收**（见下）。

### 自动化验收（全部要有，缺一不可）

| 检查 | 手段 | 判据 |
|---|---|---|
| 句数守恒 | 逐页 `len(en_sents) == len(zh_sents)`；总句数 == 润色前 | 全等 |
| notes roundtrip | `interleave(new_en, zh) == notes` 逐页比对 | 267/267 一致 |
| 硬信息 | 正则抽 `\d[\d,]*` 与专名（首字母大写多字词），比对润色前后 | 集合差为空 |
| 观众页 | 浏览器读每页 `dataset.notes`，与 JSON 逐页比 | 零不一致 |
| 演讲者页 | 进 cues 模式，比 `.cue-in` / `.cue-out` 文案 == `cuecards.json`；`.cue-note .seg` 非空 | 命中率 100% |
| 逐字稿页 | 浏览器断言 cue 卡 IN 文案 == 新首句 | 一致 |
| 语言指标 | 均句长 / 最长句 / 首词 So·And·But 占比 / 弱化词计数 | 见下 |

L02 达标值：均句长 14.3、**最长句 25 词、>25 词的句子 0**、`just` 14→3、`very` 8→1、
路标语 `However/That said/The catch` 2→6、`Here's the key…` 3→10、`That's why/Which means` 0→7。
**「最长句 ≤ 25 词」是最有操作性的收敛判据**，比「均句长」更能反映「念得出来」。

### 坑

- **`>25 词` 的句子是最容易漏的**：一轮子 agent 往往会留几处。必须程序化统计后开二轮，不要靠肉眼。
- **数字丢失的假警报**：`Nevatia and Binford in 1973 fit …` → `… fit … in 1973` 只是语序变化，
  集合比对会报「丢了 1973」。**判据要看过的是不是同一批数字**，不是位置。
- **`kind of` 别一刀切删**：`this kind of creature work` / `that kind of instrumentation` 是正当用法，
  只有 `kind of` 当模糊填充词时才要删。**同类：`just` 表「刚才」(the gap we just saw) 也不算弱化词。**
- **输入取自资料库时的两个时序坑**：`drive/get_download_link.py` 返回的签名 URL 带
  `x-cos-security-token`，**手抄会 `InvalidAccessKeyId`** —— 用管道让脚本取链接后当场 curl。
  `kind=web` 的在线 page 走 page 事务 `create_page_transaction` → `list_page_artifacts` 拿 `data.url`
  下载静态产物即可，**只读不 commit 是无副作用的**。

### 顺带修掉的「写死讲次编号」第三第四处

同一个反模式在前几轮已修过 `02-script/build.py`，本轮又抓到两处，**要横向全扫**：

- `tools/presenter_e2e.js`：`SESSIONS = [1,2,3,4]`，S4 删除后第 4 项必 404 → 从 `03-slides/` 发现。
- `tools/e2e_cue.js`：`SESSIONS = [1,2,3,4]`；且 `EXPECT = {1:63,2:70,3:24,4:80,5:308}` + `TOTAL = 545`
  是「5 讲 545 页」年代的化石，**必然 10 条断言全红**；探针页写死 `S4.100/S4.192` 同样必挂。
  全部改为从 `session{N}.json` / `cuecards.json` 推导；探针改为「每讲取第一个有卡的页」。
- **「长期假红」与「假绿」同样是校验器失效** —— 一处永远不过的验收会被整体无视，
  比没有验收更糟（它会训练人忽略红色）。改完**必须做变异测试**证明断言仍然有效：
  故意把期望值改错 / 换不存在的探针 sid，确认它如期报错，再还原。

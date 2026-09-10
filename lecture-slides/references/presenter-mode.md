# 演讲者模式（Keynote 式双屏 + 双进度条）设计参考

为静态 HTML 课件实现 Keynote/PowerPoint 式演讲者视图：观众屏全屏放映，演讲者屏显示
当前页大预览 + 演讲文稿 + 双进度条，两屏实时同步。**全程无构建工具、
file:// 双击可用**（postMessage 跨窗口通信不触发 file:// 同源限制，同源 iframe 的
contentWindow 直访才会）。

## 架构

```
放映窗口 index.html ──postMessage(TAG: __hwyqPres)── 演讲者窗口 presenter.html
        │                                              │
        │ window.__deck = { go, page(), total, notes(i) }   ← 引擎导出，唯一权威
        │ window.__onPage = state 回调（引擎 go() 末尾触发）
        └── 演讲者窗口内的当前页预览 = index.html 的 iframe
            复用 SYNC_JS 的 goto 协议（__hwyqSync TAG）驱动
```

三个可复用组件（见 `assets/`）：
- `presenter-inject.js` — 注入放映窗口（deck）：S 键/按钮开窗、state/meta 上报、nav/goto/fs 命令处理
- `presenter-template.html` — 演讲者窗口整页（占位符 `__TITLE__` 替换为课件标题）
- 前提：deck 引擎导出 `window.__deck`（go/page/total/notes），且 SYNC_JS 支持 `goto` 消息

## 消息协议（TAG = `__hwyqPres`）

| 方向 | cmd | 载荷 | 时机 |
|---|---|---|---|
| pres → deck | hello | — | 打开时 + 500/1500/3500ms 重试 |
| pres → deck | nav | dir ±1 | 演讲者按键/按钮（由 deck 统一仲裁） |
| pres → deck | goto | page | Home/End/跳页 |
| pres → deck | fs | — | 请求观众屏全屏 |
| deck → pres | state | page/total/notes | 翻页回调 + hello 应答 + 900ms 兜底 |
| deck → pres | meta | durs[]/courseSec | hello 应答 + 900ms 兜底 + 每 5s 幂等重发 |
| iframe → pres | (SYNCTAG nav) | dir ±1 | 预览 iframe 内方向键，转发回 deck 仲裁 |

自愈设计：演讲者窗口每 800ms 向当前页预览 iframe 幂等重发 goto（引擎同页早退，无视觉扰动），
克服 iframe 加载窗口期的消息丢失；meta 每 5s 重发，presenter 按 `durs.join(',')+':'+courseSec`
内容 key 去重，重复包无副作用。

## 双进度条（讲课节奏仪表）

两条画布不同，差异即节奏：

- **bar1 课堂时间**（蓝）：fill = 已讲秒数 / 课堂总时长（默认 45min）。刻度层（timeTicks）
  标记「按讲稿语速讲完第 i 页应到达的时刻」= cum[i]/courseSec，末刻度 = 讲稿预计结束点。
- **bar2 内容进度**（绿）：画布 = 讲稿预计总时长 totalSec。分段层（barSegs）按每页估时占比
  分段（当前页 .on 高亮）。fill = edge/totalSec，其中
  `edge = cum[page-1] + min(本页已讲秒数, durs[page-1])`，本页已讲 = elapsed − slideStart
  （slideStart 在 apply() 换页时记为计时器当前值）。
- **pace 徽标** = edge − elapsed：> 20s「快 +m:ss」（超前，黄）；< −20s「慢 −m:ss」（落后，粉）；
  否则「正常」（绿）。讲得快 → 绿条跑赢蓝条；讲得慢 → 蓝条跑赢绿条。

**每页估时**：`max(12, 去空白字数 / 220 × 60)` 秒（中文正常语速 220 字/分；保底 12s）。
在 deck 侧计算（能读 `__deck.notes(i)`），随 meta 发送；常量 `COURSE_SEC`（课堂总长）与
`CHAR_PER_MIN`（语速）按课程实际改。

## 布局

```
main grid: 1.5fr | 1fr
左列：当前页大预览(flex:1) + .bars 双进度条面板
右列：aside.notes 演讲文稿占满整列（flex:1，上下边缘紧贴容器，顶天立地）
```

备注滚动默认关闭（`.nbody` overflow:hidden），演讲者点「滚动」开关后才切为 overflow:auto
（`.nbody.scroll`），用于回看长讲稿；关闭时自动回顶并清滚动锚点。

预览 iframe 首帧带 `#/N` hash 直达当前页避免闪第 1 页；之后靠 goto 消息驱动。

## 单屏退化

不开演讲者窗口 = 正常全屏放映，无任何开销（注入 JS 只在 window.top === window.self 时激活，
嵌入 compare.html 等父页场景自动休眠）。

## 备注区自适应字号（内容铺满容器）

备注区内容量逐页差 3 倍（一页 167 字符、另一页 844 字符），固定字号必然「要么挤要么空」。
做法是每页二分搜索一个字号，让内容高度落在容器可用高度的目标填充率上。

```js
var FS_MIN = 20, FS_MAX = 36, FS_TARGET = 0.80;

function fitCues() {
  var wrap = nb.firstElementChild;          // 内层包裹元素，见下方 Pitfalls
  var boxH = nb.clientHeight - 上下 padding;
  nb.style.setProperty('--cue-pad', '0em');
  nb.style.setProperty('--cue-gap', '0em');
  var best;
  nb.style.fontSize = FS_MAX + 'px';
  if (wrap.offsetHeight <= boxH * FS_TARGET) {
    best = FS_MAX;                          // 装得下 = 触顶页，跳过二分
  } else {
    var lo = FS_MIN, hi = FS_MAX; best = FS_MIN;
    for (var it = 0; it < 20; it++) {
      var mid = (lo + hi) / 2;
      nb.style.fontSize = mid + 'px';
      if (wrap.offsetHeight <= boxH * FS_TARGET) { best = mid; lo = mid; }
      else { hi = mid; }
      if (hi - lo < 0.1) break;
    }
    nb.style.fontSize = best.toFixed(1) + 'px';
  }
  /* 富余分摊：字号已定，把剩余空间变成行距/间距，而不是留底部一片空白 */
  var lis = wrap.querySelectorAll('.cue-lines li');
  var blocks = wrap.querySelectorAll('.cue-q, .cue-in, .cue-out, .cue-facts');
  if (lis.length || blocks.length) {
    var padPx = 0, gapPx = 0;
    for (var r = 0; r < 8; r++) {
      var rest = boxH * FS_TARGET - wrap.offsetHeight;
      if (rest < 6) break;
      var dPad = lis.length ? rest * 0.6 / (2 * lis.length) : 0;
      var dGap = blocks.length ? rest * 0.4 / blocks.length : 0;
      var nPad = Math.min(padPx + dPad, best * 0.75);
      var nGap = Math.min(gapPx + dGap, best * 0.85);
      if (nPad <= padPx + 0.01 && nGap <= gapPx + 0.01) break;
      padPx = nPad; gapPx = nGap;
      nb.style.setProperty('--cue-pad', (padPx / best).toFixed(3) + 'em');
      nb.style.setProperty('--cue-gap', (gapPx / best).toFixed(3) + 'em');
    }
    if (wrap.offsetHeight > boxH * 0.98) {   // 兜底：收回，保证不滚动
      var k = (boxH * 0.98) / wrap.offsetHeight;
      nb.style.setProperty('--cue-pad', (padPx * k / best).toFixed(3) + 'em');
      nb.style.setProperty('--cue-gap', (gapPx * k / best).toFixed(3) + 'em');
    }
  }
  nb.classList.toggle('cues-over', wrap.offsetHeight > boxH);
}
```

配套 CSS 的关键：所有间距用 `em`（随字号缩放），并用 CSS 变量承接分摊量。

```css
.nbody.cues { white-space:normal; overflow:hidden; line-height:1.6; }
.cues .cue-lines li { padding:calc(.3em + var(--cue-pad,0em)) 0 calc(.3em + var(--cue-pad,0em)) 1.15em; }
.cues .cue-q { margin:0 0 calc(.8em + var(--cue-gap,0em)); }
/* IN 在 cue 列表之上，OUT 在列表之下（按讲述顺序，不可合并成单个 .cue-io） */
.cues .cue-in { margin:0 0 calc(.85em + var(--cue-gap,0em)); }
.cues .cue-out { margin:calc(1em + var(--cue-gap,0em)) 0 0; }
```

## cue-cards 结构顺序（讲述顺序）

卡片 DOM 顺序固定为 `q → IN → cue-lines → OUT → facts`：IN 回答「怎么进场」、
cues 是正文骨架、OUT 回答「怎么收尾」、facts 是可引用的数字/名词。`cueCardHTML()`
必须按此顺序拼接；`fitCues()` 的测量选择器要包含 `.cue-in` 与 `.cue-out`。

### `q` 字段：本页在回答什么问题（补写工作流）

`q` 是每张卡的**内容类型标记**，回答「这页在回答什么问题」，渲染在卡片最顶部
（presenter 的 `.cue-q`、02-script 的 `.cue-lang .q`）。它不是统一比例——L1 按 session
分布极不均：S1 开场叙事 1/27、S2 历史/里程碑 9/28、S3 课程信息 21/21。

**数据模型**：`{slideId: {en: {q, lines[], enter, exit, facts}, zh: {...}}}`，
`q` 与其它字段同级，**只改 `en.q` / `zh.q` 两个叶子**，逐字稿本体
（`session{N}.json`）与其余字段字节不动。

**格式硬约束**（照 L1 范式校准，31 条 `q` 零例外）：

| 项 | EN | ZH |
|---|---|---|
| 句式 | 小写开头疑问句 | 疑问句 |
| 标点 | **不带问号** | **不带问号** |
| 长度 | 5–11 词（median 7） | 6–28 字（median 12） |

**疑问句判定用「含」而非「开头」**：L1 存在 `faces in 1999 — what about bodies`
这类前置名词结构，判 `EN_WH` 要全串搜索，不能锚定首词。

**留空规则**（L1 范式核对得出，两条容易搞反）：

- 标题本身已是疑问句 → **不填** `q`（`S1.10 What Is Human Digitization?` 无 `q`）
- 标题是名词短语但页面在回答一个问题 → **填** `q`（`S1.09 The Uncanny Valley` 有 `q`）
- Cover / 纯图片页 → 不填

**生成流程**（分片写 patch → 门禁 → apply → e2e，见 `references/cue-q-workflow.md`）：
单次写满全部条目会触发输出截断，必须**一文件一校验**小步推进；
`_q_targets.json` 是建议上限而非硬指标，只写实际判断过的页。

### 同一改造要同步到 02-script（逐字稿工作台）

`02-script/index.html` 的 cue cards 与 presenter 同源，**两处改造必须两边都做**：

- 顺序：`.cue-io` 拆成 `.cue-in`（`margin:0 0 10px`）/ `.cue-out`（`margin:10px 0 0`），
  IN 用 `--blue`、OUT 用 `--accent`。
- hover 展开：`.cue-note` 折叠动画同上，但 02-script 是**浅色长滚动文档**，
  **不需要 presenter 的 `.cues-peek` 溢出兜底**（展开只把下方内容推下去）。
- 02-script 的 cue cards 是**双语并排**（`.cue-body` grid `1fr 1fr`），
  每列各用本页对应语言的逐字稿做对齐，`cueBlock()` 要算 `segEn` / `segZh` 两份。

**TDZ 陷阱（会导致整页白屏且 console 无报错）**：02-script 的
`STOP` / `RELCH` / `ZHRE` 三个常量若声明在 `renderPage()` 中段，而同函数内更早的
`DATA.sessions.forEach → sessionHTML → cueBlock → alignSegs → sentsOf` 会先执行，
抛 `Cannot access 'ZHRE' before initialization`，`#root` 留空。**必须前置到
`renderPage()` 顶部。** 排查手法：页面标题正常、无 console 报错但 `#root` 为空时，
手动 `await bootstrap()` 抓异常栈，别只盯 console。

## hover 展开逐字稿片段（cue 行 → 讲稿对齐）

演讲时对着压缩过的 cue 行讲，常需要「这句话在逐字稿里怎么说的」。做法：hover 某行时，
在该行与下一行之间向下折叠展开对应的逐字稿片段。

折叠动画用 `grid-template-rows: 0fr → 1fr`，不测高、收起时占位为 0，因此**不干扰
`fitCues()` 的未展开态测高**：

```css
.cues .cue-note { display:grid; grid-template-rows:0fr;
  transition:grid-template-rows .28s cubic-bezier(.4,0,.2,1); }
.cues .cue-note > div { overflow:hidden; }           /* 内层必须 overflow:hidden */
.cues .cue-note .seg { font-size:.82em; padding-left:.72em;
  border-left:2px solid #2c3140; opacity:0; transition:opacity .2s ease .06s; }
.cues .cue-lines li:hover .cue-note { grid-template-rows:1fr; }
.cues .cue-lines li:hover .cue-note .seg { opacity:1; }
```

### 对齐算法 alignSegs()

逐字稿是 EN/ZH 交替的整段串，cue 行是压缩改写，两者没有显式对应关系，必须算。

1. 按语言分开切句（复用 presenter 已有的 `splitNotes` 分句器）。
2. 词元：EN 取 `[a-z0-9]+` 并过滤 STOP 词；ZH 二元切分（bigram）。
3. IDF 加权 `log(1 + N/(1+df))`。
4. 单调贪心 + 窗口 `MAXSPAN=5` 句 + 距离惩罚 `DISTPEN=0.012` + 跨度惩罚 `SPANPEN=0.08`
   + 低分不推进游标 `MINRAW=0.15`（把机会留给下一行）。
5. **中文拼接不加空格**：`var JOIN = (lang === 'zh') ? '' : ' ';`，`sents.slice(...).join(JOIN)`。
   否则片段里出现「。 地图」这种多余空格。

实测 936 行命中 930 行（99.4%），平均片段 70 字符。span 惩罚 0 → 0.08 使平均片段
103 → 76 字符：宁可短片段也不摊大饼。

### splitNotes 的中文断句（易漏，改一处必须同步三处）

**`splitNotes` 有三份副本**：`_shared/deck-engine/presenter.html`（权威源）、
`_shared/deck-engine/engine.js`（约 L770，备注分句渲染）、以及各课程
`02-script/index.html`（cue 行对齐用）。**改任何一处都要同步其余两处。**

原实现只认西文句界 `next === ' '`，中文句号后直接接汉字 ⇒ **整段中文被当成一句**
（实测 `sentsOf(zh,'zh').length === 1`），后果是中文模式只有 cue 首行命中片段、
其余全空。正确写法：

```js
while (j < s.length && '"\'\u201d\u2019)]\u300d\u300f'.indexOf(s[j]) >= 0) { buf += s[j]; j++; }
/* 中文强标点：中文不用空格分隔，句号后直接接汉字，故无条件断句 */
if (c === '\u3002' || c === '\uff01' || c === '\uff1f') {
  out.push(buf.trim()); buf = ''; i = j - 1; continue;
}
var next = s[j];
/* next 为汉字（中文文本里夹的英文句点，如 "你好。"）同样视为句界 */
if (j >= s.length || next === ' ' || /[\u4e00-\u9fa5]/.test(next)) { ... }
```

自检：修复后对任一页应满足 `sentsOf(zh).length === sentsOf(en).length`（中英逐字稿
一一对应）。全量验收用提取**文件真实源码**跑（不要手抄复现），统计中文命中率应
与英文持平（实测 464/468 vs 465/468）。

### 三个必须处理的鲁棒性问题

- **周期性 state 会打断 hover 动画**：`postMessage` 反序列化后 `cue === c` 永假，
  每次 hello/自愈/步进都会整体重建 DOM。必须用指纹
  `cueKey === page + '|' + cueLang && cueNotes === notes` 判断是否真的需要重建。
- **展开撑高可能溢出**：hover 时给 `.nbody` 临时加 `.cues-peek`（`overflow-y:auto`），
  `mouseover` 加、`mouseout` 延迟 320ms 移除（给移入片段留时间），
  `transitionend` 时把该行滚入可见区。
- **低分行不要渲染空容器**：`seg` 为空时根本不生成 `.cue-note`，避免空动画与占位。

实测（27 页、备注区 1050×781）：零溢出，填充率 79.5%–85.1%，中位 ~80%；
触顶页从 54%/60% 提升到 79.5%。

### Pitfalls

- **不能用 `nb.scrollHeight` 测量**：内容小于容器时它被钳制为 `clientHeight`，二分会被
  误判为「永远溢出」、字号永远卡在下限。必须给内容包一层 `<div class="cue-wrap">`，
  测它的 `offsetHeight`。
- **触顶判定不要用 `best >= FS_MAX - 0.05`**：二分收敛精度是 0.1，实际停在 35.9，
  判定永不成立、富余分摊完全不触发。先单独测一次 `FS_MAX` 是否装得下。
- **单次按比例分摊不够**：em 换算与行盒边界有误差，一次算完往往差几个百分点。
  用迭代（每次追加剩余量的 60%/40%，最多 8 轮）逼近，再加等比兜底。
- **模拟大尺寸容器时父级也要设尺寸**：`.nbody` 是 flex 子项，只给它 `height` 会被
  父容器压扁（实测 clientHeight 仅 82px）；要给父容器同样设 `width/height/flex:none`。
- **截图只截视口**：`agent-browser screenshot "#nbody"` 超出的部分全黑（非渲染缺陷）。
  要看清整块需隐藏兄弟节点 + `transform: scale()` 压进视口。
- **窗口尺寸必须显式设成演示尺寸**：agent-browser 默认 800×477，会让 `.hint` 提示条
  盖住 cue 区（`elementFromPoint` 命中 `.hint` 而非 `li`），并触发 `cues-over`
  （字号压到下限 15px）。先 `agent-browser set viewport 1920 1080`，此时应为
  `fs: 20px`、`over: false`、`scrollHeight === clientHeight`。
- **`agent-browser hover <sel>` 不可靠**：返回 Done 但 `:hover` 样式未生效。改用
  `agent-browser mouse move <x> <y>`，坐标先用 `getBoundingClientRect()` 算，
  并用 `elementFromPoint` 预校验命中元素。
- **`set viewport` 会重置 eval 目标 tab**，设置后必须重新 `agent-browser tab tN`。
  弹窗/新 tab 同理（`tab 1` 不接受位置整数，必须 `tab t1`）。
- **验证动画是过渡而非瞬变**：用 `requestAnimationFrame` 采样 `getBoundingClientRect().height`
  存进数组，hover 后读回。展开应在 ~250ms 内 0 → 目标高度，出现中间帧才算真动画。
- **测真实链路要用 deck 的放映按钮**：按钮是 `[data-act=pres]`（class `dbtn`，无 id），
  用 `document.querySelector('[data-act=pres]').click()`。presenter 只接受
  `e.source === opener` 的消息，`window.open(..., '<其他窗口名>', ...)` 不会建立握手。

## Pitfalls

- **file:// 不能读 iframe contentWindow.__deck**（不透明源 SecurityError）——这是测试限制
  非应用缺陷；测试只断言父页 DOM（ind/notes/dot），或走 HTTP。
- **测试断言进度条宽度要等 transition 收敛**：fill 带 250ms width transition，翻页后立即读
  computed width 拿到的是中间帧——用 waitForFunction 收敛后再断言。
- **key 守卫**：deck 侧消息处理必须校验 `e.source === pwin`，否则任意页面发同 TAG 消息可
  劫持翻页。
- **首帧直达**：iframe src 必须带 `#/N`；onload 后 ready 标志位 + 后续 goto，双保险。
- **durs 保底 12s**：无备注页不会归零，避免分段宽 0 与 cum 重复刻度。
- 备注数据在 `data-notes` 属性上；换课件时确认引擎 `notes(i)` 读取路径一致。

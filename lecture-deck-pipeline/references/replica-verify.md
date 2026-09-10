# 复刻：把复刻页验准

> 由 `SKILL.md` 的相关章节拆出。**只在「核验保真度 / 字号不对 / 元素位置不对 / 排版不饱满」类任务时读。**

---

### 复刻页保真核验链（2026-09-10 落定，L02 三套全量通过）

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

### 排版拟合：让复刻页铺满舞台（`tools/fx/fit.py`，2026-09-10 落定）

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

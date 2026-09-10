# 复刻：把源 PPT 页做出来

> 由 `SKILL.md` 的相关章节拆出。**只在「复刻 / 与源 PPT 不一致 / 白块 / 白底图」类任务时读。**

---

### 源 PPT 动画复现（2026-09-09 落定，L02 S4/S5/S6 全量）

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
- 浏览器实测依赖：`createRequire('<含 playwright 的 node_modules 所在目录>/package.json')` 再 `req('playwright')`。
- 沙箱里 `python -m http.server` 后台进程会随命令结束而消失，`verify_dom.cjs` 等脚本直接用 `file://` 协议传 base 即可。

### 动画复现的验收基线（L02，2026-09-09）

| 脚本 | 判据 | 实测值 |
|---|---|---|
| `verify_animations.py` | 源稿步数 vs live 步组数 | 一致 22 / 不一致 0 / 源页未被引用 6 |
| `verify_dom.cjs` | 元素几何逐页匹配 | S4 73/73、S5 293/293，最差偏差 ≤0.1px |
| `probe_anim.cjs` | 浏览器实测步进/退出/路径时序 | 路径 step3 才平移（-154.9, 72.2）；exit 在 2/4/6/8 步依次淡出 |

### 源 PPT 复刻的「白色块」清理（2026-09-10 口径定稿，取代 09-09 三工具链）

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
- ⚠️ `verify_session.cjs` 的 base 是 `http://127.0.0.1:8795` 这类根路径时**必须显式传空 prefix**（`... 1 "" ""`）：缺省 prefix 是 `/<课程目录>`，配根路径会拼出不存在的 URL，全部页报 `no-active-section`（看起来像全崩，其实是路径错）。

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

### 源 PPT 复刻：S1/S2 与 S4/S5 的关键差异（2026-09-09 落定）

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
node ../../../_shared/deck-engine/final_accept.mjs http://127.0.0.1:8412/<课程目录>/03-slides session-1 session-2
```

- `check_deck.mjs` / `final_accept.mjs` 吃**目录**或 **http_base**，不是文件路径。
- 视频 seek 需要 Range 支持：`_shared/viewer/tests/lib/range_server.cjs`（`ROOT=<课程根> PORT=8412`，须 `run_in_background`）。
- `final_accept` 的正确调用：`node final_accept.mjs <http_base> [deck1 deck2 ...]`，deck 名是 `session-1` 这种（不是路径）。

### 白底图 → 透明背景（`tools/white_to_alpha.py`，2026-09-09）

源 PPT 图多为纯白底，贴到米色画布上会出现白方块。**不用分割算法**的纯几何解法：

1. **白判定** `d(p) = 255 − min(r,g,b)`（离白最大通道差）。核心白 `d ≤ 8`，抗锯齿带 `d ≤ 32`。不用「RGB 全 ≥ 250」——会把 (255,255,0) 这类偏色算成白。
2. **只处理与图像边框连通**的白色区域（scipy 连通域，无 scipy 退回 BFS）。被主体包围的内部白（白衬衫、白纸）不接触边框 → 保持不透明。**这是「不用分割还能保住主体」的关键。**
3. **过渡带精确反解**（un-premultiply）：`a = 1 − min(r,g,b)/255`，`F = (p − 255(1−a))/a`。满足白底合成恒等式 `F·a + 255(1−a) = p`，叠回纯白**逐像素相等**（实测 max|Δ|=0），既无白残边也无硬锯齿。
4. 边缘连通白区占比 < `--min-bg-frac`（默认 10%）的图**原样复制**。

**验证标准**（用户明确要求）：处理后叠在纯白上必须与原图完全一致——脚本内置 `verify()` 自动断言。

**CLI**：`python3 tools/white_to_alpha.py --inplace DIR [--recursive] [--dry-run] [--report J]`（或 `--in DIR --out OUT`）。输出统一 PNG（RGBA）。需 managed python（有 PIL/numpy/scipy）。
- `--inplace`（09-10 新增）：src == dst 时跳过 `copy2`，jpg→png 转换后删掉旧文件。原来必须 `--out` 到另一个目录，批量改引用很别扭。
- **批量驱动**：`tools/fx2/apply_white_to_alpha.py`（两趟：探测 → 备份 → 转换）。只处理 deck 实际引用的图，不碰 `_archive/`。备份落到 **非 OneDrive** 路径（`~/WorkBuddy/<ts>/bak/<课程目录>-media-orig-<ts>/`）——曾试图把 4.1 GB 媒体备份进 OneDrive，同步风暴，撤了。
- 改扩展名（`m250a619f21.jpeg → .png`）后**必须同步改写引用**：`tools/content/session2_content.py`。
- `tools/fx2/img_white_scan.py` 可先全量扫描候选（与 `white_to_alpha` 同一判据，即边缘连通白），再决定批量范围。L02 实测：扫描 311 张 deck 引用图，131 张转透明。
- 与 `white_key_charts.py` 的分工：本脚本只动**边缘连通白**（保住白衬衫、内部白纸）；图表/线稿/截图那 18 张需**全局 keying**，走白名单。

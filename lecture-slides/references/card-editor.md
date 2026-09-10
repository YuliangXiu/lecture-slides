# PPT 卡片编辑器（02-script 编辑器模块）

`02-script/index.html` 的编辑器模块（`em*` 函数，约 570 行）——讲师点铅笔按钮进入编辑态，在预览 iframe 里对**卡片**做移动 / 删除 / 缩放 / 裁剪 / 替换，保存后落到 deck 源文件。本文件是该编辑器的完整设计，改动前先读。

## 架构与坐标系

- **双视图**：父页 `02-script/index.html` 通过同源 iframe 嵌 `03-slides/session-N/index.html`（deck 渲染页）。编辑器把所有 overlay（hit-patch、四角控件、菜单、toast）挂到 **iframe 的 document** 上，不是父页。
- **关键换算**：`st.scale = stage宽 / 1920`（约 0.438）。iframe 内元素 `style.width/left/top` 是 **1920×1080 布局坐标系**的 px；`getBoundingClientRect()` 返回**屏幕值**（×scale）。落盘 / 重建 / op 属性全用 1920 系，屏幕上指针位移要 `÷ scale` 才能写回布局值。
- 编辑器上下文存 `editStates`（`.slide-preview` → st），st 含 `{box, frame, win, doc, session, page, els, cards, ops, scale, cropMode, cropEl, patches, nodes, toast, midBtns}`。

## 卡片语义（前后端必须一致）

- **卡片 = figure 整卡**，一个不可拆分的整体。以 S1.05 为例：`<figure>` 整卡 = 黑底 `.fv` 容器 + `<video>` + 白字块 `<figcaption>`，移动 / 删除 / 缩放都作用在这个 figure 根上，卡内图文永远随整卡走。
- **`emIsCardish(el)`**：`FIGURE` 直接是卡片；`class` 含 `card|stat|qbox` 是卡片；否则看 `elnumHasChrome(el)`（有底色/边框/阴影的容器）。
- **`emCardRoot(el, sec)`**：从媒体向上找卡片根，**沿连续卡片链取最外层**——视觉卡片常是嵌套结构，只停在最内层会把卡砍在媒体层、丢掉 figcaption 等兄弟。每层上溯做兄弟检查 `sibHasOther`：父级若还装着**别的含可见媒体的兄弟**（网格外层）就不吞；纯文字/装饰兄弟（如 figcaption 白字块）是当前卡内容，不阻断上溯。
- **后端对齐**：后端按「最内层包含该媒体的 figure」定位（`_enclosing_figure`），`carddel` 删该 figure 整段。前后端取根规则一致，编号标注（elnum）也用「最外层整卡」折叠。

## 四角常驻控件

每个卡片挂一个 `.__em_patch` hit-patch（`position:fixed; z-index:2147480000`），覆盖层随卡位置实时 `layoutEm` 重排。四角控件 `.__em_card_ctl`（24px 圆、蓝 `#1478ff`、白描边 2px、`box-sizing:border-box`）：

- `tl` ✥ — `pointerdown` → 拖动移动（`cardmove{left,top}`，绝对值幂等，批内任意顺序重放一致）
- `tr` ✕ — `click` → 删除整卡（`carddel`）
- `br` ✛ — `pointerdown` → 拖动缩放（`cardresize{w,h,fs}`）
- `bl` 「编辑多媒体」组合 SVG — `click` → 弹出 1/4 扇形菜单（见下）

控件工厂 `ctl(cls, label, title)`：label 以 `<svg` 开头走 `innerHTML`（组合图标），否则 `textContent`（字符）。左下图标 = `<svg viewBox="0 0 24 24">` 里的圆角媒体框(stroke 1.9) + 播放三角 + 右下斜置铅笔（笔身平行四边形 + 笔尖三角），白色图形落在同款蓝圆上，传达「编辑卡内多媒体」。

## 四角控件防重叠（emDedupeCorners，三层）

`layoutEm` 末尾每次布局后调用。目标：同 slide 多元素（尤其嵌套卡/重叠卡）的四角图标互不遮挡。

1. **卡内偏移**：控件从外置改到卡片边框内部，偏移 8px 起步。
2. **并查集连通分量**：视觉相交的 patch 归入同组，组内各卡按序分配档位 `8/34/60/86px`（档距 26 ≥ 控件直径 24），跨卡错开。
3. **同卡上下两排硬约束**：`off ≤ (minSide − 48) / 2` —— 两控件中心距 = `minSide − 2·off − 24` 必须 ≥ 视觉直径 24。`getBoundingClientRect` 返回 transform 后视觉盒，scale 缩小不改变中心，所以用视觉 `minSide` 算。`minSide < 70` 时控件 `scale(0.66)`。

## 放射状 1/4 扇形菜单（emOpenMenu）

左下图标点击后，以**该图标中心为圆心**在**第一象限（0°..90°，即向卡内右上）**沿弧排布按钮：

- 按钮 `.__em_mid_btn`：26px 圆形（`border-radius:50%` + 2px 白描边），橙 `#e8862c`（hover `#f79a3e`）区别四角蓝；✂ 裁 / ⟳ 换，中文说明在 `title`。
- 角度 `a0=80 → a1=10`（N 个按钮在弧上均分），半径 `R = 54 + 18×(N−2)` 随按钮数自适应防重叠。
- 弹出动画：按钮先定位在圆心、`opacity:0`，双 `requestAnimationFrame` 后移到弧位、`opacity:1`（`transition: left/top/opacity .18s`）。
- 点按钮外任意处（`pointerdown` 且 target 不在按钮内）收起。

## 缩放（emStartResize）——宽高完全独立

- `width` / `height` 由指针 dx / dy **分别**驱动（`w = w0 + dx/scale`，`h = h0 + dy/scale`），实时写内联，min 40px。
- **内部媒体语义**：媒体 `width/height:100%` + `object-fit:cover` + `object-position:50% 50%` → 以卡片 **height 为基准等比缩放**，始终锁定媒体原始宽高比、禁止拉伸变形；内容宽度超出卡片 width 时以水平中轴线为中心左右对称裁剪，拖动过程中实时生效。文字 `font-size × (h/h0)` 跟随。
- **flex-basis 吞宽度根因**：`.media-grid figure { flex:1 1 0 }` 的 `flex-basis:0px` 优先于内联 `width`——只写 `style.width` 视觉不变（"向左拖没反应"）。修复 = `root.style.flex = '0 0 auto'`（basis 回退到 width），三层都要做：拖动实时（mv 首行）、退出裁剪 reseize、后端落盘。

## 裁剪（crop）与替换（replace）

- **裁剪**：只改展示，不改媒体文件。`object-fit:cover` + `object-position` 平移（`ox/oy` 0–100%，拖动），滚轮 `zoom`（1–3，`transform:scale` + 父容器 `overflow:hidden`）。进入裁剪后 patch 上 mousedown/wheel 走 `emCropPan/emCropWheel`。
- **退出裁剪 reseize**（`emCardReseize`）：height 不变，`宽 = h × 媒体固有宽高比`（img `naturalWidth/naturalHeight`、video `videoWidth/videoHeight`，兜底用当前 rect 比例），等比铺满无留白。
- **替换**（`emPickReplace`）：隐藏 file input → 读 base64 → `POST /api/upload-media` → 换 `el.src`（video 额外 `load()`）实时预览。

## 落盘链路（前端 ops → 后端字符串手术 → journal → 重建重放）

1. 前端把每次操作记进 `st.ops`（Map，key = `editId`），同元素/同卡片多次操作**合并为一条复合 op**（`Object.assign`，属性可并存）。
2. 保存时 `POST /api/apply-slide-edits`，body = `{session, page, ops}`。
3. play.command（Python）对 deck 源做**字符串手术**落盘，同时把 ops 写进 `02-script/data/slide-edits.json` journal。
4. 重建时 `deck_builder.py` 从 journal **镜像重放**同样的手术——双侧逐行一致（strip 校验），保证「编辑器保存」与「重建」结果相同。

**op 语义**（绝对值、幂等，重放任意顺序结果一致）：

| op | 字段 | 作用 |
| --- | --- | --- |
| `cardmove` | `left, top` | position:relative + 绝对位移 |
| `carddel` | — | 删最内层包含该媒体的 figure 整段 |
| `cardresize` | `w, h, fs?` | 卡尺寸；`fs` 落 figcaption font-size；卡内媒体注入 `fill`（w/h 100% + cover）+ `flex:0 0 auto` |
| `crop` | `ox, oy, zoom` | object-position + transform scale |
| `replace` | `src` | 换媒体 src |

**index 坑（2026-09-04 #/7 事故）**：`index` 必须是「**同标签局部序号**」——后端按 tag 分组正则定位（`img[2]` = 本页第 3 个 `<img>`），而 `editId` 是 img/video/iframe 混合序号。混用会静默落到相邻元素上。

**Esc = 不保存退出**：退出即重载 iframe 还原（`exitSlideEdit(st, true)` 标记 `dataset.emExit` 让下次 enter 等新文档就绪），journal 不变。

## E2E 验证与调试教训

三套回归：`_verify_cards.mjs`（13，编辑器行为）、`_verify_elnum.mjs`（14，元素编号）、`_verify_cardops.py`（12，后端落盘）。全部 Esc 退出不落盘，断言 journal 长度不变。

- **E2E 断言查视觉值（getBoundingClientRect）而非仅内联值**——flex-basis 吞宽度时内联 `style.width` 已落下但视觉没变，只断言内联值会假通过。
- **「裁」按钮不显示的根因是坐标重叠**（两按钮同 left/top，「换」后渲染覆盖「裁」），不是未渲染——先 dump DOM 里按钮是否俱在。
- **getBoundingClientRect 返回 transform 后视觉盒**：scale 缩小不改变布局中心，同卡两排控件用视觉 minSide 算距离。
- **Playwright 定位 iframe 按 URL**（`fr.url().indexOf('session-1') >= 0`）而非 locator try/catch——locator 不抛错，try/catch 探测会误匹配首帧。
- **同文件多处修改严禁并行 Edit**：云同步目录 目录双写竞争（各持旧快照整文件回写，后完成者胜）导致编辑静默丢失；同文件多处改必须串行，改完 diff 实际状态再下结论。
- **测试 HTTP server 必须支持 Range 请求**，否则视频 seek 挂起。

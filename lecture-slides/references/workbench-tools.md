# 02-script 编辑工作台配套（元素序号标注 / 看片台 / 缩略图管线）

> 这些能力都落在 `02-script/index.html`（编辑工作台）与 `play.command`（放映服务），不是 deck 本身，但都是讲师打磨课件的日常工具。与模块 F（卡片编辑器）同属「编辑工作台」体系。

## 1. 元素序号标注（elnum，意见定位）

讲师在逐字稿页 `textarea[data-fb="ppt"]` 写意见时，可以直接写 `#序号` 指认页面里的某个元素——聚焦输入框时，同源 iframe 当前页内所有可指认元素会叠加**右上角序号徽标 + 虚线轮廓**；失焦/重聚焦清理，iframe load 后自动重挂。

- **编号规则**：DOM 文档序（深度优先 = 源码添加顺序），刷新稳定、唯一连续。
- **`elnumCollect` 折叠规则**（决定「什么算一个可指认单元」）：
  - 媒体叶子（img/video/iframe）单独编号。
  - chrome 容器（有底色/边框/阴影）：纯文字 → 整体一号；单媒体 + 短文字（≤80 字）→ 随媒体一号。
  - 混合大容器 → 拆子元素；透明布局容器 → 只递归；空壳 → 不编号。
  - `UL/OL/TABLE` 永远整体一号；`.vstep-off` / `.s-page` / `.vidseg-btn` 排除。
  - 卡片化 v2 后：**含可见媒体的卡片容器**（figure / chrome 底色 / card 类）整体一个编号。
- **徽标碰撞避让**：自动下移（40 次尝试 + 换行回卷）。
- **历史推断只改徽标配色、不改编号**：回放 `slide-edits.json` 该页 ops（批内 index 指批前状态、批间按序、delete 左移）→ ✎ 橙强信号（已被编辑器动过）；匹配 `feedback-history.json` 该页 ppt 意见文本的类型/方位关键词 → 蓝弱信号。

> 注意：`#序号` 编号与卡片编辑器落盘 op 的 `index`（同标签局部序号）是**两套编号**，勿混用。

## 2. 看片台（board，跨 Session 缩略图网格 + 拖拽重排）

- 76 页缩略图一屏网格：横屏 10 列 / 竖屏 6 列自适应（`bestGrid` 枚举列数取最大格宽）。
- **跨 Session 拖拽重排**：浮动 clone + 实时 `insertBefore`，session 分隔条计数实时更新；保存 POST `/api/reorder-slides {orders:{1:[],2:[],3:[]}}` → 重建 deck → `sessionStorage lt-board` reload 自动回看片台。
- `reorder_deck.py`：AST 元素跨度切分（roundtrip 字节级一致）+ `run_multi` + `check_align` + `reshoot_thumbs`。
- Holding Bar 保留不动（单 session 微调用，与看片台是两条独立入口）。

## 3. 缩略图管线（shoot_thumbs.cjs）

Playwright **sid 寻址**截图 + manifest cache-bust。sid 寻址保证重排 / 意见重映射都不使缩略图失效。

- **最终状态**：缩略图须呈现该页动画全部播完的样子——URL 用 `#/K/99`（传大数直达全展开，`applyStep` clamp 到该页最大步）；`settlePage` 增加全图 decode 等待（8s/图兜底）、沉降 320→500ms。
- **三种模式（argv[5]）**：
  - `full`：全量重拍。
  - `missing`：只补 manifest 无记录或 jpg 缺失的页。
  - `since-solved`：`missing` ∪ {`status=solved` 且 `resolved_at > 该页 manifest ts` 的 sid}——增量重拍，把全量 1–2 分钟降到秒级。
- **边界全覆盖**：history 不存在 / records 非法 → 退化 missing 并返回 warn；solved 缺 `resolved_at` → 保守重拍该页；manifest 缺失 → 自然全量（首次运行）；jpg 缺失 → 必拍。
- **NODE_PATH 坑**：裸跑 cjs 报 `Cannot find module 'playwright'`；三处子进程调用点（`play.command` 的 `_reshoot_thumbs` / `_reshoot_bg`、`reorder_deck` 的 `reshoot_thumbs`）必须注入 `NODE_PATH=<含 playwright 的 node_modules 所在目录>`。
- 返回值 `{mode, needed, skipped, warn?}`；前端 `boardRefresh` 走 `since-solved`，`needed=0` 提示「已是最新」，否则「已更新 N 页（其余 M 页未变更）」。

## 4. 放映服务旧进程版本提示（postJSON）

- 症状：点「刷新缩略图」报 `Unexpected token '<'`——根因是放映服务（`play.command`）是接口改造前双击启动的**旧 Python 进程**：静态文件即时生效，但 Python 进程里的新路由 `/api/reshoot-thumbs` 不存在，回 404 HTML，被 `res.json()` 解析报晦涩错误。
- 修法：`02-script/index.html` 加 `postJSON` 公共封装（三处 fetch 统一），响应 `Content-Type` 非 JSON → 提示「放映服务是旧版本…请重新双击 play.command」。
- **通用教训**：给「脚本自起服务」类项目加接口时，前端必须对非 JSON 响应做版本提示——用户不会意识到后台进程需要重启。连带修掉 boardRefresh 失败时不关全屏遮罩的 bug。

## 双视图剪辑同步

观众窗口与演讲者预览 iframe 的片段剪辑存档键不一致、以及观众视角自动播放失败——见 `segment-editor.md` 的「关联坑」。

# 视频片段编辑器（Segment Editor）设计参考

适用引擎：固定舞台 deck（1920×1080 `.deck-stage`、`VIDEO_CONFIG` 视频区间、`window.__deck`）。
功能：每个视频可在放映时手动设定 start/end 秒，localStorage 持久保存，此后每次播放只播该片段。

## 数据模型

```js
// localStorage key：deck 路径 + 视频配置键 双重隔离（多 deck 同浏览器互不干扰）
const SEG_STORE = 'dhseg::' + (location.pathname || 'deck');
// 每个视频一条：dhseg::<pathname>::<vidKey> = {"s": <start秒>, "e": <end秒|null>}
```

`vidKey` 解析：`v.dataset.vid` 优先，回退 `页码.序号`（与 `VIDEO_CONFIG` 键规则一致）。
`vidCfg()` 中 **localStorage 覆盖优先于 VIDEO_CONFIG**：有 override 时改写 `cfg.start/end`，并挂 `cfg.__key = key`。

## 交互链路

1. `setupVideos()` 给每个视频绑定（bound-once 块内）：`v.dataset.segkey = c.__key` + `attachSegButton(v)`
2. `attachSegButton(v)`：在视频父元素（`.fv`）append ✂ 按钮；父元素 `position:static` 时改 `relative`
   - **按钮必须常驻可点**：`opacity:.18; pointer-events:auto`，hover/`:focus-visible` 加深至 1
   - 纯 hover 显现（`opacity:0; pointer-events:none`）会被 Playwright hit-target 检测拒点，触屏也不可用
3. `openSegPanel(v)`：模态面板（fixed 居中 z-index:9999）——
   - 信息行：视频总时长 / 当前生效区间（区分"已保存片段"与"默认"）
   - 起止秒 number 输入 + 「取当前画面」按钮（把 `v.currentTime` 填入对应输入框）
   - 「保存并应用」：`saveSeg` + 立即写 `v.dataset.start/end` + seek 片段头 + `v.play()`
   - 「恢复默认」：`clearSeg`（删 localStorage）+ 从 `VIDEO_CONFIG` 重取默认
4. 键盘/滚轮接管：keydown 顶部 `if (segPanel) { if (e.key === 'Escape') closeSegPanel(); return; }`
   （原有 INPUT/TEXTAREA 跳过逻辑仍在其后）；wheel 顶部 `if (segPanel) return;`
5. 生效机制：无需改播放逻辑——引擎原有 `timeupdate` 钳制（超过 end seek 回 start）读
   `dataset.start/end`，`setupVideos()` 每次 `go()` 重读 override，翻页往返自动存活。

## 样式要点（追加进皮肤 CSS 末尾）

- `.vidseg-btn`：absolute `top:10px right:10px`，深色底圆角小按钮，常驻低透明
- `.vidseg-panel` 系列深色模态：`.vsp-head/.vsp-x/.vsp-info/.vsp-row/.vsp-cur/.vsp-tip/.vsp-btns/.vsp-save/.vsp-reset`

## E2E 验收清单（test_segeditor.mjs，14 项）

按钮存在 → 面板开 → 默认区间显示 → 设 2/4 秒保存 → localStorage 持久化 →
dataset 应用 → 播放钳制在片段内（timeupdate 后 currentTime ∈ [2,4]）→ 翻页往返后 override 仍生效 →
面板显示"已保存"标记 → 恢复默认清 storage → 面板开时方向键阻断 → Esc 关闭 → 零 JS 错误。

## 关联坑

- localStorage 在 file:// 下按 file 路径隔离——同一 deck 拷贝到别的路径，片段设置不跟随（可接受）。
- 保存后立即 `v.play()` 会被浏览器自动播放策略拦（无用户手势时静默失败）——面板由点击触发，
  属用户手势上下文，实测可播。

# 演讲者模式（Keynote 式双屏 + 双进度条）设计参考

为静态 HTML 课件实现 Keynote/PowerPoint 式演讲者视图：观众屏全屏放映，演讲者屏显示
当前页大预览 + 下一页预览 + 演讲文稿 + 双进度条，两屏实时同步。**全程无构建工具、
file:// 双击可用**（postMessage 跨窗口通信不触发 file:// 同源限制，同源 iframe 的
contentWindow 直访才会）。

## 架构

```
放映窗口 index.html ──postMessage(TAG: __hwyqPres)── 演讲者窗口 presenter.html
        │                                              │
        │ window.__deck = { go, page(), total, notes(i) }   ← 引擎导出，唯一权威
        │ window.__onPage = state 回调（引擎 go() 末尾触发）
        └── 演讲者窗口内的两块预览 = index.html 的 iframe
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

自愈设计：演讲者窗口每 800ms 向两块预览 iframe 幂等重发 goto（引擎同页早退，无视觉扰动），
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
右列：下一页小预览(flex:none; height:40%) + aside.notes 演讲文稿(flex:1)
```

预览 iframe 首帧带 `#/N` hash 直达当前页避免闪第 1 页；之后靠 goto 消息驱动。

## 单屏退化

不开演讲者窗口 = 正常全屏放映，无任何开销（注入 JS 只在 window.top === window.self 时激活，
嵌入 compare.html 等父页场景自动休眠）。

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

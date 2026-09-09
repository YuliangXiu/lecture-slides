# 多屏窗口路由设计参考（play.command + presenter）

适用场景：放映者双屏（或多屏）环境，双击课程根 `play.command` 启动放映后，三个窗口要自动落对屏幕——观众 deck、逐字稿页（`02-script/index.html`）、演讲者视图（`presenter.html`）。

## 总规则（用户定稿语义）

- **主屏 = 运行 `play.command` 时鼠标所在的那块屏**（不是系统设置里的"主显示器"——用户明确否决系统主屏语义）。
- 逐字稿页 + 演讲者视图 → 鼠标所在屏（主屏）；观众 deck → 扩展屏（其余屏）。
- 扩展屏只显示观众视角；presenter 与逐字稿始终在鼠标所在屏。
- 单屏环境（无扩展屏）→ 全部回退到唯一屏。

## 关键：两套坐标系的翻转

Cocoa 与 Web/AppleScript 的坐标原点不同，直接混用会垂直错位（实测扩展屏错位 267px）：

| 来源 | 坐标系 | 原点 |
|---|---|---|
| `NSScreen.visibleFrame` / `NSEvent.mouseLocation` | Cocoa | 主屏左下角，y 向上 |
| AppleScript `bounds` / 浏览器 `screen.avail*` | 窗口坐标 | 主屏左上角，y 向下（可为负） |

换算（`H = screens[0].frame.size.height`）：

```
x窗口 = x
y窗口 = H - (y + h)
```

`screens` 数组第 1 项是带菜单栏的主屏。本机实测：主屏 `0,0,1080,1890`（竖屏）、扩展屏 `-1920,324,1920,1005`（横屏，在主屏左侧）——扩展屏坐标可为负。

## play.command 的实现要点

1. **读屏（JXA）**：`osascript -l JavaScript` + `ObjC.import('AppKit')` + `NSScreen.screens` 实时读每屏 `visibleFrame`。
2. **探测协议（输出到 stdout，bash 解析）**：
   - 首行 `MOUSE=N`——逐块判断鼠标落屏（用 `NSEvent.mouseLocation`），未命中回退 `0`。
   - 其余每行一屏，换算后输出 `x,y,w,h`（窗口坐标）。
   - bash 取屏：`P_LINE = tail -n +2 | sed -n "$((MOUSE_IDX+1))p"`（鼠标屏）；`S_LINE = 其余第一块屏`（扩展屏）；单屏时两者都回退 P。
3. **`open_on_screen()`**：AppleScript `make new window with properties {bounds:{x,y,x+w,y+h}}`（全局坐标可为负）建窗 → `set URL of active tab of front window` 导航。
4. **打开顺序**：先逐字稿（主屏）→ `sleep 1` → 观众 deck（扩展屏），保证 deck 居前拿焦点。
5. **回退链**：扩展屏缺失 → 回退主屏；AppleScript 失败 → 回退普通 `open`。
6. **默认打开的 deck 是 `/03-slides/session-1/`，不是 `/04-deploy/`**（2026-09-09 起，用户明确要求）。单屏回退分支同样开 02-script + 03-slides/session-1（不注入 pv*）。改 `play.command` 时各 lecture 的副本要一起对齐。

## pv* 传参链（deck → presenter 的目标屏定位）

```
play.command 把鼠标屏可见区注入 deck URL ?pvx/pvy/pvw/pvh
  → presenter-inject.js pvTarget() 解析，弹窗透传并定位目标屏中心
  → presenter.html routeToPrimary() 二次自检 moveTo + fitTarget()
  → 无参数时回退系统主屏 (0,0)
```

## presenter 双层主屏路由

- `presenter-inject.js` 的 `openPresenter()`：`window.open('presenter.html','hwyqPres','width=1360,height=860,left=0,top=0')` + `pwin.moveTo(0,0)`（macOS 主屏 frame 原点 =(0,0)）。
- `presenter.html` IIFE 顶部 `routeToPrimary()`：自检 `screen.availLeft/availTop` 非 0 即 `window.moveTo(0,0)` 二次迁移；竖屏主屏 `resizeTo(availWidth, availHeight)` 铺满。
- **竖屏适配**：`@media (max-width:1200px)` 把水平双列 `main` 改上下两栏（`1.15fr/1fr`），适配 1080×1920 竖屏主屏。

## TCC 自动化权限（硬限制）

- `osascript` 控制 Chrome 需要宿主进程有「自动化 → Google Chrome」授权。
- 未授权时**开放事件**（如 `get version`）仍可通过，但 `count windows` / `make new window` 报 **-10004 事件拒绝**——**不能据开放事件通过就误判语法正确**。
- WorkBuddy 宿主无此授权，沙箱内**无法端到端控制真实 Chrome 窗口**，只能 `bash -n` + `osacompile -o /dev/null` 编译验证。
- play.command 已加 `count windows` 授权探测：拒绝/未授权时终端提示授予权限，并回退普通 `open` 不阻塞放映。

## 构建链注意

`deck_builder.py` 会把 `presenter-inject.js` **内联**进各 `index.html`、`presenter.html` **整文件拷贝**到 out_dir——改这两处源文件后必须重建 session-1/2/3，否则部署态不生效。

## 验收（marker 静态检查 + 编译）

- 编译：`bash -n play.command` + `osacompile -o /dev/null`。
- 部署态 marker 三套齐备：`moveTo(0, 0)`、`left=0,top=0`、`routeToPrimary`、`availLeft`、`@media max-width:1200px`、`pvTarget`、`pvw=`、`fitTarget`。
- **真实双屏窗口落位只能由用户真机验收**（终端宿主双击 play.command、首次接受 TCC 授权后目检三窗口归属）——这是全链路唯一无法在沙箱自动化验证的环节。

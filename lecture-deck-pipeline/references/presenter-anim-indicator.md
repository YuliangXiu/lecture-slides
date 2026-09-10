# 演讲者视图「本页还有动画吗」边框指示器

> 由 `SKILL.md` 的相关章节拆出。**只在「演讲者视图 / 动画指示器 / 边框绿红 / stepInfo」类任务时读。**

---

### 演讲者视图「本页还有动画吗」边框指示器（2026-09-10 落定）

需求：讲师看演讲者窗口时，要一眼知道**现在按 ↓ 会出动画还是翻页**。当前页预览框描边实时翻色：

| 颜色 | 含义 | 角标文案 |
|---|---|---|
| **绿** | 本页还有未显示的动画步：按 ↓ 先出下一步，**不翻页** | `有动画 k/n` |
| **红** | 本页已无动画可出：按 ↓ **直接翻页** | `无动画`（本页无步进单元）/ `动画 n/n 已出完` |

### 判据只有一条：`__deck.stepInfo()`（engine.js）

```js
stepInfo() → { total, left, step, more }   // more === (left > 0)
```

**`more` 的定义就是「按 ↓ 会不会翻页」**，实现即直接数 DOM 里带 `.vstep-off` 的单元：

```js
const units = vstepUnits(slides[cur]);
let left = 0; for (const u of units) if (u.classList.contains('vstep-off')) left++;
```

- **不读 `vstep` 计数器**。那个变量由 `vstepNext` / `vstepPrev` / `applyStep` 三条路径各自维护，另算一份早晚漂移；DOM 的 `.vstep-off` 是渲染出来的实际状态，唯一真值。
- 与 `vstepNext` 的判据**严格等价**（`idx === -1` ⟺ `left === 0`），所以指示器与真实行为不可能不一致。
- `total <= 1` 时 `left` 恒 0（`vstepReset` 只把 `i > 0` 置 off）→ 恒 `more=false`，与「只剩一个单元时按 ↓ 无步可走」的实际行为一致。
- `total === 0` 是**合法的「本页无步进单元」**，不是「未知」。

### 数据链路（三段，缺一段指示器就哑）

```
engine.js  stepInfo()  →  presenter-inject.js  state/vstep 消息带 anim  →  presenter.html  setAnim(a)
```

- **`state` 与 `vstep` 两条消息都要带 `anim`**。只在 `state` 带会漏掉「出完最后一步」——那一步只发 `vstep`、不翻页，边框不会由绿转红。
- `notifyVstep()` 在三个步进函数**改完 DOM 之后**调用，所以钩子里读 `stepInfo()` 拿到的是步进后的新状态；顺序颠倒会慢一拍。
- 旧版放映窗口没有 `stepInfo` → 传 `null` → presenter 清空角标、不画边框，**退化为无指示器**而不是猜一个颜色。

### 实现要点（都在 `presenter.html`）

- **用 `.f-cur::after` 绝对定位画环，不要改 `border`**：不动布局、不挤压 iframe；`pointer-events:none` 保证不挡预览内的鼠标交互。
- **`setAnim` 的守卫只能是 `typeof a.total !== 'number'`**。踩过的坑：写成 `a.total < 1` 当未知 → 把占多数的「无动画」页全部变成无指示器（分母 59/65 全哑，测试报 `class=[] 文案=""`）。**「拿不到数据」与「明确无动画」是两回事。**
- 重复 `state`（hello / 800ms 自愈 / 步进）用同值调 `setAnim` 是幂等的，颜色与文案都不变、不触发过渡抖动。

### 回归：`_shared/deck-engine/test_presenter_anim.mjs`

```bash
NODE_PATH=<含 playwright 的 node_modules> node _shared/deck-engine/test_presenter_anim.mjs \
  http://127.0.0.1:8411/<课程目录>/03-slides            # 省略 deck 默认 session-1..3
```

**base_url 必须指向 `03-slides` 那一层**（与 `final_accept.mjs` 同口径）。传成课程根会 404，脚本会自诊断报出「base_url 必须指向 03-slides」而不是 15 秒后抛超时。

五组断言，A/B 是核心：

| 组 | 判据 |
|---|---|
| **A 逻辑等价** | 逐页扫：`more=true` 必须「advance 后留在本页」、`more=false` 必须「advance 后到达 `nextVis`」、末页必须钳位。**不引用任何中间量，直接比对「声称」与「实际」** |
| **B 步进序列** | 一页上连按到动不了，`more` 必须恰为 `[true × (total-1), false]`。守「出完最后一步由绿转红」 |
| C 计数自洽 | `total===0 ⇒ step=left=0`；否则 `step+left===total` 且 `1<=step<=total` |
| D presenter 实时翻色 | 打开演讲者窗口，用**真实 ArrowDown 按键**驱动全链路，逐步核对 `.f-cur` class 与 `#astat` 文案 |
| E 红/绿二选一 | 两个 class 不得同时存在、也不得都不存在 |

**L01 与 L02 各 27/27 通过（2026-09-10）**，分布：

| 讲 | 扫描页 | 有动画（绿） | 红-无动画 | 走到底（绿→红已验） |
|---|---|---|---|---|
| L01 | 27 / 28 / 21 | 5 / 3 / 3 | 22 / 25 / 18 | 5 / 3 / 3 |
| L02 | 65 / 91 / 111 | 6 / 3 / 7 | 59 / 88 / 104 | 6 / 3 / 7 |

**交叉核对过**：静态数每页 distinct `data-vu`（无则数 `<video>`）+ `data-vstep="1"` 开关，与引擎 `stepInfo()` 逐页一致 —— 两个独立方法互证，不是同一套代码自证。

#### 测试自身两个坑（首版都踩了）

1. **`go(同页)` 会早退、不做 `vstepReset`**。想「回到该页第 1 步」必须显式 `setStep(1)`；靠 `go(i)` 复位会继承上一步已消耗的步数，B 段序列误报（实测报 `p16 total=2 实得[false] 期望[true,false]`）。
2. **`waitForFunction` 的回调必须返回布尔**。写 `() => window.__deck && window.__deck.stepInfo` 返回函数对象，Playwright 序列化失败 → 报的是超时，看着像「等了 15 秒没等到」，实际是求值出错。

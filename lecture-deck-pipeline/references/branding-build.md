# 品牌化与构建顺序

> 由 `SKILL.md` 的相关章节拆出。**只在「抹掉原作者 / 署名 / 首页 / 沙漏」或需要跑 `rebuild.sh` 时读。**

---

### 品牌化 + 构建顺序（`tools/branding.py` + `tools/rebuild.sh`，2026-09-10 落定）

把「别人的课」改成本讲自己的课。三件事：首页署名、结束页沙漏、抹掉原作者姓名。
**版式 1:1 抄 Lecture01**（`<课程目录>/tools/content/session*_content.py`）。

### 首页（`cover`）
```html
<div class="cv">
  <div class="cv-kicker rv">WESTLAKE UNIVERSITY · DIGITAL HUMANS · FALL 2026</div>
  <div class="cv-band rv d1"><h1 class="cv-title">Lecture 02<br>Body Models</h1></div>
  <div class="cv-meta rv d2">
    <div><b>Instructor:</b> <作者> · <实验室></div>
    <div><b>TAs:</b> Jiaxin Wang · Siyuan Yu</div>
    <div><b>Session:</b> Lecture 02 · Session N — <副标题></div>
  </div>
</div>
```

### 结束页（`closing` + 沙漏）
抄 Lecture01 的 `<style>.brk-*/.hg-*</style>` + `.cls/.brk-row` 结构 + 倒计时 JS
（`DUR=300000`，随 `window.__deck.page()===idx` 启停，`--p` 驱动沙漏 CSS）。
**注意**：Lecture01 只在 session1/2 的末页放了沙漏，session3 没放。本次按用户要求
**三套都放**。

### 姓名脱敏的判据（关键，别一刀切）

不要无脑全删。判据是「**是否暴露讲课人另有其人**」：

| 位置 | 处理 | 理由 |
|---|---|---|
| 逐字稿**说话内容字段**（`lines`/`enter`/`exit`/`q`） | 改写或整行删 | `taught by Professor Gerard Pons-Moll of the University of Tübingen`、`based on SMPL Made Simple tutorial + talk by Michael Black` 这类句子直接暴露 |
| 逐字稿 `facts`（备课便签） | **保留** | 不上幻灯也不进讲稿，是讲师自己的备课笔记 |
| 页面上的**文献引用** | 删作者名，整段重建为「标题 + 会期 + 年份」 | 用户当次明确要求「全部抹掉」。重建后顺便去掉原本表示可点击的蓝色 `#0070C0`，视觉更干净 |
| `_shared/deck-engine/` 里作**注释示例**的人名 | 换成中性词 | `/* next 为汉字（如 "Michael Black。"）*/` 这类 |

实测 L02：逐字稿命中 36+12+4 条；引用 24 处（10 个不同段落）。

### 【核心流程坑】三步有强顺序依赖 → 一律走 `tools/rebuild.sh`

```
regen（生成器从源 PPT 重算复刻页 html，**覆盖整页**）
  → brand（首页/结束页/姓名与引用脱敏）
    → build（deck_builder 渲染成 03-slides/session-N/index.html）
```

**先 brand 后 regen 会静默丢改动** —— 实测 20 处引用脱敏被写回带作者名的原样。
更阴的是**中间态 grep 还是干净的**（因为还没 regen 重算），到 build 完才发现。
`rebuild.sh` 末尾自带自检：姓名残留必须 0、沙漏必须存在，任一不满足就非零退出。

```bash
bash tools/rebuild.sh                 # 全量
bash tools/rebuild.sh --no-regen      # 只 brand + build（改文案时）
bash tools/rebuild.sh --sids S3.041   # 只 regen 指定页
```

### 脱敏实现上的两个正则坑

1. **不能对「Python 源文件文本」用 `\b`**。源文件里不换行空格写成转义序列 `\xa0`
   （4 个可见字符），于是 `...Romero, J.,\xa0Black, M. J...` 在源文本里是 `0` + `Black`
   —— 两个都是 word char，`\bBlack\b` **匹配不到**（实测 8 个引用段被静默跳过，
   而 deck 里明明还有）。改用 `(?<![A-Za-z])Black(?![A-Za-z])`。
2. **不要用「逐个删作者名 token」**。会把 `Bolkart, T., Black, M.J.,` 里的分隔逗号
   一起吃掉，渲染成 `BolkartTzionas`。改为**整段重建**（显式列举引用段，L02 只有 10 个）。

### 备份策略：4.1 GB 媒体不要进 OneDrive

`03-slides` 的 4.1 GB 里 99% 是 `media/`。整体复制进 OneDrive 会触发 4.1 GB 重传。
拆成两份：
- 项目内 `03-slides-bak/`（`rsync -a --exclude 'media/'`，约 34 MB）—— 覆盖会改动的一切
- 本地磁盘 `~/WorkBuddy/bak/<课程目录>-media-<ts>/media`（非 OneDrive 路径）

⚠️ **真正的排版源不在 `03-slides/` 里，而在 `tools/content/session*_content.py`** ——
备份时容易漏。连同 `02-script/data/` 一起存。

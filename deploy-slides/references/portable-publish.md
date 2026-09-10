# 公开便携化发布（Publish a Portable Copy）

> 本 skill 的 live 版（`~/.workbuddy/skills/deploy-slides/`）含真实路径、品牌名、实例值——只适合本机用。若要把它发布到公开仓库（如 GitHub monorepo）供他人复用，必须先做 **PII 便携化**：把实例值替换为占位符，并保证公开树 0 个 PII 命中。本文档是这条「live → 公开便携版」发布链路的完整配方。

## 双层策略（贯穿始终）

- **live** = 含真实路径的完整工作版，保留不动（本机排障用）
- **公开版 / monorepo** = 便携净化版，实例值全部占位化，供他人复用

> 关键约定：**公开版改写不回写 live**。两个版本的 SKILL.md / references 内容从此出现占位化差异，属设计内。

## 占位符体系（统一使用）

把真实实例值替换为 `<中文占位符>`：

| 实例值 | 占位符 |
|---|---|
| 课程根目录（绝对路径） | `<课程根>` |
| 主页 repo 路径 | `<主页repo>` |
| 主页域名 | `<主页域名>` |
| 课程 slug | `<课程slug>` |
| COS 桶名 | `<COS_BUCKET>` |
| COS 区域 | `<COS_REGION>` |
| 课程/会话 id | `<COURSE_ID>` |
| venv 路径 | `<venv>` |
| 本 skill 目录 | `<本 skill 目录>` |

两类通用化改写（品牌/实例引用 → 通用表述）：
- 品牌名 → 通用词：OneDrive →「云同步目录」、<课程名> →「HTML 课件」、具体课程目录名（如 `<课程目录>`）→「真实课程项目」
- 描述性名称 → 直白词：`lecture-xx 课程 151 条反馈` → `真实课程项目 151 条反馈`

## 流程（严格执行，勿跳步）

### Step 1 — 建立 scrub 断言脚本
用 `scripts/scrub_placeholders.py` 执行占位化改写。三函数配合防漏替/防误替：
- `sub1(p, pairs, tag="")`：每个精确替换必须**恰好命中 1 次**（防漏替）
- `subN(p, pairs)`：全局替换，打印命中次数（须 ≥1，高频 token 用这个）
- `forbid(p, tokens)`：断言残留 token **不出现**（防误替）

用法：编辑脚本底部的 `sub1_jobs` / `subN_jobs`（old→new 映射），跑：
```bash
python3 scripts/scrub_placeholders.py
```
输出 `ALL SCRUB PASSED` 即本批改写全绿。

> ⚠️ `forbid` 只对**待发布内容文件**执行；文档类（如 SKILL.md 讲解用途必然举例这些 token）不纳入 forbid，否则会被误判为残留。

### Step 2 — 全树 PII 回归扫描（必须，且用 -E）
对公开树重跑敏感 token 扫描。**macOS BSD grep 注意**：多分支模式用 `grep -E` + `|`，不能用 `\|`（BSD 不按字面解释 `\|`，会静默无输出）。

```bash
grep -rnE '<本机绝对路径前缀>|<云同步目录>|<机构名>|<课程名>|<作者名>|<COS 桶名>|<COS 区域>|<课程 slug>|<课程目录名>|<邮箱域名>|sk-[A-Za-z0-9]{6}|AKIA|PRIVATE KEY' . --exclude-dir=.git
```
目标：**EXIT=1（零命中）**。只允许保留三类：
- `~/.workbuddy/skills/<skill>` 安装说明（`~` 指任意用户主目录，非具体用户名）
- 「云同步目录」「真实课程项目」等已通用化的词
- **配方文档自身的规则表/词表/示例**（见下）

**命中必须先二分再动手，别一刀切判 DIRTY**（2026-09-09 实测教训）：

| 类别 | 例子 | 处置 |
|---|---|---|
| **硬身份信息**（零容忍） | `/Users/<name>` 绝对路径、邮箱、用户名、`CloudStorage`、学校名、真实课程目录名、`sk-…`/`AKIA` | 必须清理 |
| **配方教学示例**（必须保留） | 本文档的品牌名改写规则表（含 `<课程目录>` 作示例）、`scrub_placeholders.py` 的 `FORBID` 词表、grep 模板里的 `PRIVATE KEY`/`AKIA` | 保留，白名单排除 |

一刀切扫描会把配方文档判成 DIRTY，导致误改甚至误删有价值的审计词表。扫描脚本要带
`ALLOW_SUBSTR` 白名单（匹配**整行**特征串，如 `FORBID = [`、`OneDrive →「云同步目录」`），
只对非白名单命中判失败；白名单是**分析工具参数**，不写入任何镜像文件。

命中则逐文件 Edit 清理，不要用批量 sed。

### Step 3 — git commit 前杂项清理
- `find . -name '__pycache__' -o -name '*.pyc' | grep -v '.git'`，有则删除
- 改动后的 py 脚本 `python3 -m py_compile <file>.py`
- `git status --short` 复核：只含预期 modified/untracked，无临时文件

### Step 4 — fetch + 远端复验（关键，易踩坑）
```
git fetch origin
git log --oneline ..origin/main    # 看远端是否有未预料的新提交
```
**对 fetch 到的远端新提交做 PII grep 复验**（不只信本地）：
```
git grep -nE '<敏感token>' <远端ref> -- .
```
> ⚠️ 教训（2026-09-08 实测）：远端曾有一个同主题提交 `573ddef` 根本**没 scrub**，含 30+ 处实例值已公开。若只 push 本地而不复验远端，PII 会留在公开历史里。

**再扫一遍全历史**（`git rev-list <远端ref>` 逐提交 × 全树），别只扫 HEAD——
旧提交里的残留 HEAD 可能已修掉，但仍在公开历史中可被 `git log -p` 翻出。
判据同上（硬/软二分），重点确认「硬身份信息」是否曾经出现过：

```bash
for c in $(git rev-list origin/main); do
  for f in $(git ls-tree -r --name-only "$c"); do
    git show "$c:$f" | grep -nE '/Users/[A-Za-z]|[[:alnum:]_.+-]+@[[:alnum:]_-]+\.[A-Za-z]{2,}|<作者名>|CloudStorage' && echo "  ^^ $c $f"
  done
done
```
零命中即公开历史干净，**无需 force-with-lease 重写**（重写有分叉风险，非必要不做）。

若远端有含 PII 的同主题提交：
1. 确认其父提交 == 本地 HEAD（无分叉）
2. 在父提交上直接 commit 干净便携版
3. `git push --force-with-lease origin main` 强制覆盖，把脏提交从公开历史移除
4. 复验：`git grep <敏感token> origin/main -- .` 应零命中

### Step 5 — commit + push
- 提交信息风格对齐仓库既有格式（如 `feat: sync module G/H/B5 + add deploy-slides skill`）
- 先「合并同类项」：把同类改动归并到一个 commit，避免拆碎
- macOS 若遇陈旧 `.git/index.lock` 阻塞：确认无活跃 git 进程后 `rm .git/index.lock` 再试

## 常见坑

| 坑 | 修复 |
|---|---|
| macOS `grep -C2 "a\|b"` 无输出 | 改用 `grep -E -C2 'a|b'` |
| 只信本地状态，忽略 fetch 到的新提交 | Step 4 必须对远端 ref 做 PII 复验 |
| 只扫 HEAD，不扫全历史 | 旧提交残留仍在公开历史；Step 4 用 `git rev-list` 逐提交扫 |
| 一刀切把配方文档判成 DIRTY | 硬身份信息 vs 配方教学示例二分；脚本带 `ALLOW_SUBSTR` 白名单 |
| 脚本里写死实例默认值 | 改为读环境变量（如 `COS_BUCKET/COS_REGION/COS_PREFIX`），缺参 `argparse.error()` fail-fast |
| 硬编码他人安装目录路径 | 用 `<本 skill 目录>` 占位 |
| 想让公开仓库像 live 一样直接跑 | 放弃——公开版可读性/可复用性优先，参数占位化 + 文档说明 |

## 整包重扫的工程要点（2026-09-10，3 个 skill 全量重同步）

Step 1 的 `sub1/subN` 适合「改几个已知实例值」。当要**整包重扫一份已大幅领先的 live 版**（live 内容量数倍于公开版）时，逐条 `sub1` 不现实——改用**有序替换表**脚本（`re.sub` 全局 + 顺序敏感 + 前后置阶段）。下面每条都实际踩过：

1. **规则必须按「长/具体 → 短/泛化」排序**，否则短规则先吃掉长规则的匹配。典型：绝对路径 `/Users/<user>/…/<课程目录>` 必须在 `/Users/<user>`、`lecture-01` 之前替换，否则会拼出 `/Users/<作者>` 这类半截占位符。
2. **依赖「另一条规则的产物」的规则要放最后，或另开后置阶段**。实例：想让 `…/<课程目录>/_shared/` 收敛成 `…/_shared/`，这条必须在 `… Course → <课程目录>` 之后跑；同表但顺序靠前就永远不命中。
3. **有些段落必须整段改写（前置字面替换），不能让通用规则过一遍**。典型是 **FORBID 黑名单本身**与**扫描命令里的模式串**——它们是「列出敏感词」的文本，通用规则会把它们变成 `"<作者>", "<作者>"` 这种乱码，既难读又失去示范价值。前置替换（按原文整段换）比后置修补稳定。
4. **别把「通用密钥/邮箱样式」误当本机 PII**。`sk-` / `AKIA` / `PRIVATE KEY` 这类是**模式关键词**，不是某个人的信息，出现在「教你扫什么」的文档里是正确的。把它们一并 forbid 会造成永远无法归零的假失败。
5. **占位化后必须再跑语法自检**：`python3 -m py_compile <f>.py`、`node --check <f>.mjs`、`bash -n <f>.command`。一条正则写宽了会把脚本里的字符串或变量名一起改掉，而 **`forbid` 扫描查不出来**（它扫敏感词，不扫语法）。
6. **「删目录再整目录 `cp`」会连同仓库独有文件一起删掉**（如各 skill 的 `.gitignore`），`git status` 报 `D`。先备份这些文件，或 `git checkout HEAD -- <路径>` 恢复后再 `git add -A`。
7. **零命中判据要用 `git grep` 自己的退出码**：`git grep … | head` 的 `$?` 是 `head` 的退出码、恒为 0，会给出「还有命中」的假象。取 `git grep` 的退出码（**1 = 零命中**），或把结果重定向到文件再数行数。
8. **验证「去重/瘦身类优化真的生效」，用开关做对照重建**，而不是翻旧备份。例：`DECK_NO_DEDUP=1 <builder> … /tmp/a` 与正常构建逐文件比字节——当场可复现，不依赖历史笔记。实测 `1991 KB → 1028 KB（−48%）`，远比引用几天前的数字可靠。


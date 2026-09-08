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
- 品牌名 → 通用词：OneDrive →「云同步目录」、Digital Humans →「HTML 课件」、具体课程目录名（如 `lecture-01-introduction`）→「真实课程项目」
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
# 把 <你的实例值> 替换为你本机的真实值再跑
grep -rnE '<本机绝对路径>|<云同步目录品牌>|<学校/课程名>|<你的用户名>|<你的域名>|<COS桶名>|<COS区域>|<课程slug>|<课程目录名>|<你的邮箱>|sk-[A-Za-z0-9]{6}|AKIA|PRIVATE KEY' . --exclude-dir=.git
```
目标：**EXIT=1（零命中）**。只允许保留两类通用路径：
- `~/.workbuddy/skills/<skill>` 安装说明（`~` 指任意用户主目录，非具体用户名）
- 「云同步目录」「真实课程项目」等已通用化的词

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
| 脚本里写死实例默认值 | 改为读环境变量（如 `COS_BUCKET/COS_REGION/COS_PREFIX`），缺参 `argparse.error()` fail-fast |
| 硬编码他人安装目录路径 | 用 `<本 skill 目录>` 占位 |
| 想让公开仓库像 live 一样直接跑 | 放弃——公开版可读性/可复用性优先，参数占位化 + 文档说明 |

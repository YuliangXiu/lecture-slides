---
name: deploy-slides
description: 课件网页部署发布的完整流水线——把 HTML 课件从本地权威源，经过视频剪辑、图片压缩、视频二压瘦身，上传到腾讯云 COS 对象存储，最后生成学生网页播放版发布到课程主页 repo。当用户提到"部署课件""发布到主页""上传 COS""腾讯云对象存储""COS 上传""媒体压缩/瘦身""视频剪辑/裁剪""图片转 webp""学生版发布""deploy""publish""build_publish""coscmd""cos upload""部署发布"时使用。负责编排部署镜像重建、裁剪/压缩执行器、COS 幂等上传、主页 repo 更新与 git 提交，并覆盖工具/密钥缺失、转码失败、幂等重试等异常场景。
agent_created: true
---

# Deploy Slides（课件网页部署发布流水线）

## Overview

把课程 HTML 课件从本地「权威源」一路部署到「云端可访问的学生版」，是一个**多阶段、可幂等重放**的管线。本 skill 是这条管线的**编排入口**，职责是：

1. **媒体瘦身**——视频按 `trims.json` 裁剪、未裁剪原片二压、gif/png 转 WebP（复用课程仓自带执行器，见 `lecture-slides` 模块 G）。
2. **上传 COS**——把瘦身后的媒体递归、幂等上传到腾讯云 COS 指定桶/前缀。
3. **更新主页**——生成学生网页播放版 HTML，落到主页 repo 的 `teaching/<课程slug>/`，再 git commit + push。

**核心思想**（与 `lecture-slides` 模块 G 一致，本 skill 不重复实现，只编排）：**源永不动，裁剪与瘦身只在部署镜像（04-deploy）上发生，`trims.json` 是裁剪唯一真源。**

> 关系说明：`lecture-slides` 模块 G 记录**四个执行器怎么工作**（`references/deploy-slimming.md`）；本 `deploy-slides` 负责**按正确顺序把整条部署管线跑通**，并补上 COS 上传与主页发布这两段模块 G 未覆盖的环节。做课件样式/裁剪细节去看 lecture-slides；做端到端部署来看本 skill。

## 输入 / 输出（部署契约）

### 输入（部署前必须具备）

| 输入项 | 默认位置 / 说明 | 角色 |
|---|---|---|
| 课程根 | `<课程根>` | 服务根，含 03-slides / 02-script / 04-deploy |
| 权威源 | `<课程根>/03-slides/`（含 `media/trims.json` 真源） | 永不改动的完整源 |
| 部署镜像 | `<课程根>/04-deploy/` | 唯一可裁剪、可瘦身、可发布处 |
| 主页 repo | `<主页repo>/` | 学生版 HTML 的 git 落点 |
| 密钥 | `~/.rclone.conf` 的 `cos` remote（provider=TencentCOS，权限 600；备选 coscmd 的 `~/.cos.conf` / 环境变量） | COS 上传凭证（rclone 已配好） |

### 输出（部署完成后产生）

| 输出项 | 落点 | 说明 |
|---|---|---|
| 裁剪后视频 | `<课程根>/04-deploy/media/decks/session-N/videos/` | `ffmpeg` CRF24 产物 + 已改写 VIDEO_CONFIG |
| WebP 图片 | 同上，`.gif/.png` 旁新增 `.webp` | 原图保留，可回退 |
| 二压瘦身视频 | 同上，`.slim.mp4` 覆盖原片 + `.orig.mp4` 备份 | 仅未裁剪高码率原片 |
| COS 媒体 | `cos://<COS_BUCKET>/<COURSE_ID>/media/decks/` | 学生版引用的绝对 URL 指向这里 |
| 学生版 HTML | `<主页repo>/teaching/<课程slug>/{session-1,session-2,session-3}/index.html` + `data/` `fonts/` | 已改 COS 绝对 URL、禁用演讲者/✂ |

**成功后用户可见结果**：主页 repo `teaching/<课程slug>/` 的提交，学生版链接可公开访问且媒体从 COS 加载。

> **占位符约定**：本 skill 为可复用模板。文中 `<课程根>` `<主页repo>` `<主页域名>` `<课程slug>` `<COS_BUCKET>` `<COS_REGION>` `<COURSE_ID>` `<venv>` `<本 skill 目录>` 均为**实例占位符**，使用前替换为你的实际值（课程根目录、主页仓库路径、主页发布子路径、COS 桶名/区域/课程前缀、Python 隔离 venv 等）；代码块示例同理，替换后执行。

## 依赖工具与配置项

### 媒体处理工具（本机已装，brew 前缀 `/opt/homebrew/bin`）

| 工具 | 用途 | 检查 |
|---|---|---|
| `ffmpeg` / `ffprobe` | 视频裁剪、二压、时长校验 | `ffmpeg -version` |
| `gif2webp` | gif → animated WebP | `gif2webp -version` |
| `cwebp` | png → WebP | `cwebp -version` |

执行器脚本内置候选路径（`/opt/homebrew/bin`、`/usr/local/bin`、`PATH`），缺失时 FATAL 退出。

### COS 上传工具

- **首选 `rclone`**：`~/.rclone.conf` 已配 `cos` remote（provider=TencentCOS，权限 600）。新 shell PATH 无 homebrew，须用全路径 `/opt/homebrew/bin/rclone`。
- 备选 `coscmd`（腾讯云官方 Python CLI，`--skipmd5` 幂等同步，本机**未装**）；再备选 Python SDK `cos-python-sdk-v5`（配合 `scripts/cos_sync.py`）。
- rclone / coscmd 的安装、配置、幂等上传命令与密钥管理详见 `references/cos-upload.md`。

### COS 配置项（默认值，可被参数覆盖）

| 配置 | 值 | 说明 |
|---|---|---|
| 存储桶 | `<COS_BUCKET>` | AppID 已含 |
| 区域 | `<COS_REGION>` | |
| 前缀 | `<COURSE_ID>/media/decks/` | 与 `build_publish.py` 的 `COS_PREFIX` 一致 |
| 基础 URL | `https://<COS_BUCKET>.cos.<COS_REGION>.myqcloud.com` | 学生版 HTML 引用此域名 |
| 密钥 | `~/.rclone.conf` 的 `cos` remote | 已配置（权限 600）；coscmd 走 `~/.cos.conf` 或环境变量 `COS_SECRET_ID`/`COS_SECRET_KEY`（均 git 忽略，勿入库） |

> 密钥约定：**绝不写入任何 repo 或 SKILL.md**。本机环境变量或 `~/.cos.conf` 里保存；丢失/过期时按「异常处理」走失败分支。

### 主页发布工具

- `git`（主页 repo 内），`python3`（跑 `tools/build_publish.py`）。
- 推送前按用户默认前置做 **PII 审计**：`teaching/<课程slug>/` 产物里不应残留本机绝对路径、`~/.workbuddy/`、课程绝对路径、密钥。

## 执行步骤（七阶段管线）

> 通用纪律：**每一步先 dry-run / 先检查，确认无误再 `--apply` / 真传 / commit**。执行器均幂等，重复运行安全。媒体改动**只落 04-deploy**，03-slides 永不碰。

### Stage 0 — 文件清理与环境前置检查

#### 0a. 文件清理（部署前必做）

部署前先整体清一遍，避免旧文件/中间产物混进发布流。**原则：对 slides 播放无直接关联的旧文件一律归档（只移动、不删除）；纯垃圾（自动再生的）可直接删。**

1. 全课程仓扫描候选（排除 `.workbuddy/` 与已归档目录）：
   - 旧版本/备份：`*.bak`、`*.orig.*`、`*.pre-*.bak`、`*.polished.json` 等无引用的旧快照
   - 一次性脚本：`_verify_*`、`audit_*`、`build_merge_map*`、`write_merge_map*` 等无引用的验证/生成脚本
   - 中间产物：`tmp_media/`、`replica/`、`merge-map.draft.*`、`merge-map.v1.*` 等 staging/旧版
   - 纯垃圾（可直接删）：`.DS_Store`、`__pycache__/`、`*.pyc`、`*.tmp`、`*~`

2. **`.bak` 一律归档，不逐个确认**（作者 2026-09-08 确立的惯例）：`mv` 到各 lecture 的 `_archive/`（镜像原相对路径）；跑完 `find . -name '*.bak' -not -path '*/.workbuddy/*' -not -path '*/_archive/*'` 应剩 0。

3. 归档前 grep 判定「是否被引用」：`play.command` / `index.html` / `build.py` / `deck_builder.py` 等运行时/管线读取的文件**不归档**。active 数据文件（`session{N}.json`、`deckmeta.js`、`feedback*.json`、`slide-edits.json`、`merge-map.json` 等）必须保留原位。

4. 归档目录统一命名 `_archive/`，附 `README.md` 记录清单与理由；纯垃圾（`.DS_Store`/`__pycache__`/`.pyc`）直接删除（编译器/系统会自动重建，属正常）。

5. 清理后自检：active 数据文件逐一在位、引用路径有效，`play.command` 放映链路不受影响。

#### 0b. 环境工具检查

```bash
# 媒体工具齐不齐
which ffmpeg ffprobe gif2webp cwebp
# COS 工具与密钥齐不齐（本 skill 自带检查脚本）
python3 <本 skill 目录>/scripts/check_cos_env.py
```

`check_cos_env.py` 输出三态：READY（rclone 或 coscmd 之一 + 密钥齐）、MISSING_TOOL（两者都缺，给出安装命令）、MISSING_KEY（有工具无密钥）。不是 READY 就**停在 Stage 0**，别往下跑（见异常处理）。

### Stage 1 — 重建部署镜像

03-slides 有新增/修正时才需要；以 03-slides 为源 rsync 到 04-deploy（排除 `_source`、`.DS_Store`）。校验 `03-slides/media/trims.json` 仍与最新源同步。

### Stage 2 — 视频裁剪（apply_trims）

```bash
cd <课程根>
python3 04-deploy/apply_trims.py            # dry-run：列出将要重裁的 confirmed 条目
python3 04-deploy/apply_trims.py --apply    # 幂等：已裁跳过，缺失重裁
```

只处理 `trims.json` 里 `status=confirmed` 的条目；物理裁剪（`ffmpeg -ss ... -t ...` CRF24）+ 改写镜像 VIDEO_CONFIG 为 `0..新时长`。改完抽 VIDEO_CONFIG 块过 `node --check`。

### Stage 3 — 图片瘦身（slim_images）

```bash
python3 tools/slim_images.py          # dry-run
python3 tools/slim_images.py --apply  # gif→animated WebP、png→WebP + 改写镜像 HTML 引用
```

只转「被 deck HTML 实际引用」的图片；新增 `.webp` 保留原图（可回退）。

### Stage 4 — 视频二压（slim_videos）

```bash
python3 tools/slim_videos.py          # dry-run
python3 tools/slim_videos.py --apply  # 未裁剪高码率原片 CRF24 二压
```

与 Stage 2 互补不重叠（不重复压已裁剪片段）。落地走 `临时 → 校验 → 备份 .orig.mp4 → os.replace`。

### Stage 5 — 上传 COS（幂等同步，**整目录全量**）

```bash
/opt/homebrew/bin/rclone copy <课程根>/04-deploy/media/decks \
    cos:<COS_BUCKET>/<COURSE_ID>/media/decks --transfers 8 \
    --exclude '.DS_Store' --exclude '*.orig.mp4'
```

`rclone copy` 天然幂等（已存在且 size 一致的对象跳过，**重试安全**）。

> **必须整目录全量 `copy`，不要只传「本次改动的几个视频/图片」。**
> 实战教训（2026-09-07）：slim_images 早已把 04-deploy 的 HTML 图片引用改写成 `.webp`，但历史上传只覆盖过视频与旧 `.png/.jpg`，**89 个 `.webp` 从未进 COS**——学生版图片会 404。整目录 `rclone copy` 天然补齐所有新格式（`.webp`、替换后的同名视频），重跑安全。
> 排除 `.DS_Store` 与 `*.orig.mp4`（二压备份，不该上线）。`cos` remote 见 `references/cos-upload.md`；coscmd 等价命令 `coscmd upload -r --skipmd5 ... /<COURSE_ID>/media/decks/`。

### Stage 6 — 生成学生版并发布主页

```bash
python3 tools/build_publish.py --root <课程根> --repo <主页repo> --dry-run
python3 tools/build_publish.py --root <课程根> --repo <主页repo>
```

产物落到 `teaching/<课程slug>/`。然后：

```bash
cd <主页repo>
git status            # 确认只有 teaching/<课程slug>/ 相关改动（PII 审计）
git add teaching/<课程slug>/
git commit -m "..."   # 合并同类项：本次发布归一个 commit
git push
```

> **build_publish 容错**（2026-09-07 起）：步骤 3/4（presenter 函数级禁用、删除 `data-act="pres"` 按钮）在 04-deploy 源已移除 presenter 时**跳过并统计为 absent，不再报错**。若跑旧版报 `未找到 openPresenter 函数`，请用课程仓 `tools/build_publish.py` 最新版。

### Stage 7 — 线上验收（发布后必做）

GitHub Pages 有 1–2 分钟构建延迟，push 后稍等再验。从用户视角确认「页面显示正常、资源可访问」，四步：

```bash
# ① 页面可达 + 无旧文案残留（以本次 Session→Slide 为例）
curl -s --max-time 25 "https://<主页域名>/teaching/<课程slug>.html" | grep -oE 'matBtn\("(Slide|Session) ' | sort | uniq -c
#    期望: 1 matBtn("Slide     （0 个 Session）

# ② 学生版 deck 引用的媒体是 COS 绝对 URL，且无相对路径残留（应输出 0）
curl -s --max-time 25 "https://<主页域名>/teaching/<课程slug>/session-1/index.html" | grep -cF '../media/decks/'
curl -s --max-time 25 "https://<主页域名>/teaching/<课程slug>/session-1/index.html" | grep -oE 'cos\.myqcloud\.com[^"]+\.webp' | wc -l   # webp 引用数

# ③ 关键媒体对象（新替换的视频 / 新传的 webp）HEAD 可达，视频应返回 video/mp4
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --max-time 20 -I \
  "https://<COS_BUCKET>.cos.<COS_REGION>.myqcloud.com/<COURSE_ID>/media/decks/session-1/videos/<某视频>.mp4"

# ④ 抽查全部被引用 COS URL 均 200（可选全量）：从线上 index.html 提取 URL 逐一 HEAD
curl -s --max-time 25 "https://<主页域名>/teaching/<课程slug>/session-1/index.html" \
  | grep -oE 'https://[^"]*myqcloud\.com[^"]*' | sort -u | while read u; do
      code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -I "$u"); [ "$code" != 200 ] && echo "FAIL $code $u"
    done; echo "HEAD 检查完成（无 FAIL 行即全部 200）"
```

四步全过才算部署完成；任一步失败先查「异常处理」表，**不要手改部署态 HTML 蒙混**（会被重建覆盖）。

### Stage 8 — 公开便携化发布（把本 skill 发到公开仓库）

上面 Stage 0–7 全程在本机 live 版（含真实路径/实例值）上跑。若要把**本 skill 本身**发布到公开仓库（如 GitHub monorepo）供他人复用，先做 **PII 便携化**：把实例值替换为占位符，保证公开树 0 个 PII 命中。

本 live 版保留真实路径（本机排障用）；**便携化的改写只发生在公开工作副本，不回写 live**，两版内容从此有占位化差异（设计内）。完整配方见 `references/portable-publish.md`，要点：

```bash
# ① 用断言脚本做占位化改写（编辑 script 内 old→new 映射后运行）
python3 scripts/scrub_placeholders.py          # 输出 ALL SCRUB PASSED
# ② 全树 PII 回归扫描（务必 -E + |，macOS BSD grep 不用 \|）
#    下面 grep 的 token 是**占位符教学示例**——使用者在自己的机器上换成自己的路径/名称值
grep -rnE '<本机绝对路径>|<用户主目录>|<云同步目录品牌>|<学校名>|<课程名>|<你的用户名>|<你的域名>|<COS桶名>|<COS区域>|<课程slug>|<课程目录名>|<你的邮箱>|sk-[A-Za-z0-9]{6}|AKIA|PRIVATE KEY' . --exclude-dir=.git
# ③ fetch 后必须对远端新提交做 PII 复验（防历史遗留脏提交）
git fetch origin && git grep -nE '<敏感token>' origin/main -- .
# 若无分叉且远端有脏提交，force-with-lease 覆盖；有分叉则 rebase 后再推
```

> grep 命令中的 token 是**可复用占位符教学示例**——使用者在自己的机器上替换为真实的路径/名称（`portable-publish.md` 有同款模板）。
> ⚠️ 2026-09-08 实测教训：远端曾有一个同主题提交**没 scrub**，含 30+ 处实例值已公开。只信本地状态会漏掉它。必须对 fetch 到的远端 ref 复验。

## 异常处理（成功 / 失败 / 重试）

### 成功判定标准（每阶段各自）

| 阶段 | 成功信号 |
|---|---|
| Stage 2 | 目标视频实测时长 ≈ `keep_duration_s`（±0.3s）；VIDEO_CONFIG 已是 `0..新时长`；`node --check` 通过 |
| Stage 3 | `.webp` 生成且镜像 HTML 引用已改 `.webp`；原图仍在 |
| Stage 4 | `.orig.mp4` 备份存在、产物确实变小、时长守恒 |
| Stage 5 | rclone/coscmd 返回 0，无 `ERROR` 输出；COS 上 webp 对象数与本地镜像 webp 数一致；抽查一个对象 head 得到 200 |
| Stage 6 | build_publish 静态自检通过（无残留 `../media/decks/`、`../../02-script/`、`data-act="pres"`）；git push 成功 |
| Stage 7 | 页面 200、无旧文案残留（`Session`=0）；学生版 deck 无相对媒体路径；抽查视频/webp HEAD 200 且 `Content-Type` 正确 |

### 失败处理（按现象 → 动作）

| 现象 | 判定 | 动作 |
|---|---|---|
| Stage 0 报 `MISSING_TOOL` | rclone 与 coscmd 均未装 | 按 `references/cos-upload.md` 装 rclone（或 coscmd）；装完重跑 Stage 0 |
| Stage 0 报 `MISSING_KEY` | 无 `COS_SECRET_ID/KEY` | 停下来向用户要密钥；**不得跳过上传或硬编码密钥** |
| ffmpeg 缺失 | 媒体工具不在候选路径 | 确认 brew 前缀 `/opt/homebrew/bin`；装工具后重跑 |
| 裁剪时长校验失败 | 转码产物时长偏差 >0.5s | 检查 trims.json `start_s/end_s` 是否越界；修正后重跑（幂等，只重裁该条） |
| VIDEO_CONFIG `node --check` 报错 | 改写引入语法错误 | 检查是否叠了双花括号 `{{...}}`；修后重跑 |
| slim 产物比原片大 | 已近码率极限 | 记入 `OVERRIDE_SKIP` 清单，让脚本幂等跳过，**不要反复重压** |
| rclone/coscmd `ERROR` / 网络超时 | 上传中断 | 直接重跑同一条命令——`rclone copy` / `--skipmd5` 保证已传文件跳过、未传续传 |
| 学生版图片 404 但本地 HTML 引用是 `.webp` | 该 webp 从未上传 COS（历史只传过视频/旧格式） | 整目录重跑 Stage 5 `rclone copy`（幂等补齐所有新格式），再验 Stage 7 ③④ |
| 密钥过期（403 / AccessDenied） | 凭证失效 | 让用户在 CAM 重建子账号密钥后更新 `~/.rclone.conf`（`rclone config`）或 `~/.cos.conf`，重跑 Stage 5，其余阶段结果不受影响 |
| build_publish 报 `未找到 openPresenter 函数` | 用了旧版脚本（源已移除 presenter） | 确认在用课程仓 `tools/build_publish.py` 最新版（步骤 3/4 容错：源无则跳过）；不要改部署态 HTML 绕过 |
| build_publish 静态自检失败 | 变换漏项 | 修 build_publish 或手工补漏，**不要手改部署态 index.html**（会被重建覆盖） |
| git push 被拒 | 远程有新提交（主页 repo 常有 `[auto]` 自动提交，如 Google Scholar stats 刷新 `[skip ci]`） | `git fetch && git rebase origin/master`（或 `git pull --rebase`）再 push；仍失败则保留本地 commit 上报 |
| Stage 7 线上 404 / 仍是旧内容 | GitHub Pages 构建未完成（1–2 分钟） | 等 1–2 分钟重跑 Stage 7；期间可用 cache-bust（URL 加 `?v=N`）避开 CDN 缓存 |

### 重试语义（幂等性总则）

- **Stage 2/3/4**：执行器按「目标产物实测状态」判幂等，重跑安全，只补缺失项。
- **Stage 5**：`rclone copy` / `coscmd --skipmd5` 均天然幂等，中断后直接续跑。
- **Stage 6**：build_publish 六项变换幂等，重跑覆盖同份产物；git commit 只做一次，重试时先确认无未提交残留。
- **回退**：03-slides 源始终完好，任何阶段失败都可从源重建镜像、重放整条管线。

## 参考

- `references/cos-upload.md` — COS 上传完整配方（rclone 已配置 + coscmd/SDK 备选、幂等命令、密钥管理、失败重试）。
- `references/portable-publish.md` — 把本 skill 发布到公开仓库的 PII 便携化配方（占位符体系、六步流程、常见坑）。
- `scripts/check_cos_env.py` — Stage 0 环境/密钥检查脚本。
- `scripts/cos_sync.py` — COS 幂等上传（SDK 备选，coscmd 不可用时用）。
- `scripts/scrub_placeholders.py` — Stage 8 PII 占位化断言脚本（`sub1`/`subN`/`forbid` 三函数）。
- `lecture-slides` skill 模块 G（`references/deploy-slimming.md`）— 四个执行器的完整设计、trims.json schema、重建重放 procedure、实战陷阱。

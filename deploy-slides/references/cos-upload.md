# COS 上传完整配方（腾讯云对象存储）

> 本文件是 `deploy-slides` Stage 5（上传 COS）的权威细节。目标：把瘦身后的媒体**幂等、可重试**地同步到 COS，供学生版 HTML 通过绝对 URL 引用。

## 1. 目标与路径约定

| 项 | 值 |
|---|---|
| 存储桶 | `<COS_BUCKET>-<AppID>`（AppID 已含，勿再加 `-<AppID>` 后缀） |
| 区域 | `<COS_REGION>` |
| COS 前缀 | `/<lecture>/media/decks/` |
| 本地源 | `<课程根>/04-deploy/media/decks/` |
| 基础 URL | `https://<COS_BUCKET>-<AppID>.cos.<COS_REGION>.myqcloud.com` |

路径映射：本地 `04-deploy/media/decks/session-N/videos/x.mp4` → COS Key `<lecture>/media/decks/session-N/videos/x.mp4`。

学生版 HTML（`build_publish.py` 产物）把 `../media/decks/` 替换为 `https://<COS_BUCKET>-<AppID>.cos.<COS_REGION>.myqcloud.com/<lecture>/media/decks/`，所以 COS 上的 Key 必须与本地相对路径**严格一致**。

## 2. 首选工具：rclone（本机已配置并验证）

本机 `~/.rclone.conf` 已配好 `cos` remote（provider=TencentCOS，权限 600），smoke test 通过、实际已用 `rclone copy` 上传 420MB/49s。

```bash
# 验证 remote 已配
/opt/homebrew/bin/rclone listremotes      # 应含 cos:
/opt/homebrew/bin/rclone lsd cos:<COS_BUCKET>-<AppID>

# 幂等同步（重试安全：已存在且 size 一致的对象跳过）
# 整目录全量 copy，排除 .DS_Store 与二压备份 .orig.mp4
/opt/homebrew/bin/rclone copy <课程根>/04-deploy/media/decks \
    cos:<COS_BUCKET>-<AppID>/<lecture>/media/decks --transfers 8 \
    --exclude '.DS_Store' --exclude '*.orig.mp4'
```

- **必须用全路径 `/opt/homebrew/bin/rclone`**：新开 shell 的 PATH 不含 homebrew，裸 `rclone` 会找不到命令（`~/.rclone.conf` 的 `cos` remote 已配好；验证：`/opt/homebrew/bin/rclone listremotes` 应含 `cos:`）。
- **必须整目录全量 `copy`，不要只上传本次改动的文件**：2026-09-07 实战教训——slim_images 早已把 04-deploy HTML 的图片引用改写成 `.webp`，但历史上传只覆盖过视频与旧 `.png/.jpg`，**89 个 `.webp` 从未进 COS**，学生版图片 404。整目录 `copy` 幂等补齐所有新格式/替换后的同名视频，重跑安全。
- `--exclude '.DS_Store' --exclude '*.orig.mp4'`：前者避免 macOS 元数据文件上线；后者避免二压备份原片（可能很大）被传上去。若已误传，用 `rclone delete` 定向清理。
- 配置变更：`rclone config`（编辑 remote），改完 `rclone lsd` 验证。
- `copy` 是「仅新增/更新目标缺失项」，不会删除目标多余对象（与 `sync` 不同，更安全）。
- 核对：`/opt/homebrew/bin/rclone lsf cos:<COS_BUCKET>-<AppID>/<lecture>/media/decks --include '*.webp' | wc -l` 与本地 webp 数对比，确认新格式已全量就位。

### 2.1 若 rclone 未配置（新机器 / 换机）

```bash
brew install rclone
rclone config   # 交互式新建 remote：type=s3, provider=TencentCOS, endpoint=cos.<COS_REGION>.myqcloud.com
                # access_key_id=<SecretId>, secret_access_key=<SecretKey>
```

> 腾讯云 COS 兼容 S3 协议，rclone 用 `s3` 类型 + TencentCOS provider 即可；remote 名统一叫 `cos`，桶名 `<COS_BUCKET>-<AppID>`。

## 3. 备选工具 A：coscmd

腾讯云官方 Python CLI，一条命令完成递归幂等上传（本机未装，rclone 不可用时再装）。

### 3.1 安装

```bash
# 装进隔离 venv（勿污染系统环境）
<skill 安装目录>/binaries/python/versions/3.13.12/bin/python3 -m venv <venv>
<venv>/bin/pip install coscmd
# 或系统级（简单场景）
pip3 install coscmd
```

验证：`coscmd --version`（或 `<venv>/bin/coscmd --version`）。

### 3.2 配置（密钥写入 `~/.cos.conf`）

```bash
coscmd config -a <SecretId> -s <SecretKey> -b <COS_BUCKET>-<AppID> -r <COS_REGION>
```

- `SecretId` / `SecretKey` 来自腾讯云访问管理（CAM）API 密钥。
- 配置落盘到 `~/.cos.conf`，**属敏感文件，绝不可进 git**。确认 `~/.gitignore` 或 shell 历史不会泄露。
- 也可用环境变量临时覆盖：`coscmd` 优先读命令行/环境；保险起见配置后立即 `coscmd list` 验证能列出桶。

### 3.3 幂等上传

```bash
coscmd upload -r --skipmd5 <课程根>/04-deploy/media/decks/ /<lecture>/media/decks/
```

- `-r`：递归目录；`--skipmd5`：已存在且 size+md5 一致的对象跳过（**重试安全**）。
- 与 rclone 一样**整目录全量上传**（补齐 webp 等新格式）；coscmd 无内置 exclude，若本地混入 `.DS_Store`/`.orig.mp4` 需先清本地再传或用 `coscmd delete` 事后清理。
- 目标前缀**必须带前导 `/`**（相对桶根）。
- 校验：上传后 `coscmd list -r /<lecture>/media/decks/ | wc -l` 与本地文件数一致；抽查 `coscmd info /<lecture>/media/decks/<某文件>` 返回 200。

### 3.4 常用维护命令

```bash
coscmd list -r /<lecture>/media/decks/        # 列出前缀下所有对象
coscmd info /<lecture>/media/decks/<key>      # 查单个对象头
coscmd delete -r -f /<lecture>/media/decks/xxx  # 删（慎用，勿带 -f 盲删根前缀）
```

## 4. 备选工具 B：Python SDK（qcloud_cos）

coscmd 不可用时用 SDK 直连。`deploy-slides/scripts/cos_sync.py` 是一个幂等上传封装（按 size + 自定义元数据 md5 判重，重跑安全）。

```bash
<venv>/bin/pip install cos-python-sdk-v5
COS_SECRET_ID=xxx COS_SECRET_KEY=yyy python3 <本 skill 目录>/scripts/cos_sync.py \
    --src <课程根>/04-deploy/media/decks --prefix /<lecture>/media/decks --apply
```

## 5. 密钥管理铁律

1. 密钥只存两处：`~/.rclone.conf`（rclone 的 `cos` remote）或 `~/.cos.conf`（coscmd）/ 环境变量 `COS_SECRET_ID` / `COS_SECRET_KEY`（SDK）。
2. **绝不写进** SKILL.md、任何 repo、日志、shell 历史、或对话明文回显。
3. 密钥过期/泄露 → 立即在 CAM 控制台禁用旧密钥、换新，更新 `rclone config`（或重跑 `coscmd config`），重跑 Stage 0 检查 + Stage 5 上传。
4. 团队共享：每人用自己的子账号密钥，最小权限（仅 `<COS_BUCKET>-<AppID>` 桶的读写）。

## 6. 失败与重试

| 场景 | 表现 | 处理 |
|---|---|---|
| rclone remote 未配 | `rclone listremotes` 无 `cos:` | 按 2.1 新建 remote；或改用 coscmd（第 3 节） |
| 未配置 | `coscmd list` 报 auth 错 | 重跑 `coscmd config`，然后 `coscmd list` 验证 |
| 网络中断 | 上传中途 `ERROR` / 超时 | 直接重跑同一条 `rclone copy` 或 `coscmd upload -r --skipmd5`，已传对象跳过 |
| 403 / AccessDenied | 密钥无权限或过期 | 换新密钥（更新 rclone remote 或 coscmd config），重跑 |
| 桶/区域写错 | 404 / NoSuchBucket | 核对桶名 `<COS_BUCKET>-<AppID>`、区域 `<COS_REGION>` |
| 本地与 COS 不同步 | 漏传/多传 | 用 `rclone lsf` 或 `coscmd list -r` 与本地 `find` 对比文件数与 Key |

**关键结论**：上传环节天然幂等，任何失败都**直接重跑**，不会重复计费已传对象，也不会覆盖正确内容。

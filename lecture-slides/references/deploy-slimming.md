# 部署发布与媒体瘦身（04-deploy 双轨）

> 模块 G 完整设计。来源：真实课程项目 2026-09-07 落地的一套部署/裁剪/瘦身/发布管线。核心思想一句话：**源永不动，裁剪与瘦身只在部署镜像上发生，登记表是唯一真源。**

## 1. 双轨架构与两条铁律

```
<课程根>/                        ← 课程根（服务根）
├─ 03-slides/                     权威完整源（index.html 引用 ../media/decks/…）
│  ├─ session-N/index.html        ← 永不修改（含 VIDEO_CONFIG 数值）
│  └─ media/
│     ├─ trims.json               ← 裁剪元数据唯一登记处（真源）
│     └─ decks/session-N/videos/… ← 源视频，永不裁剪
├─ 02-script/                     逐字稿 + 编辑器工作台（内嵌 iframe 预览指向 03-slides）
└─ 04-deploy/                     部署镜像（唯一可裁剪、可改写处）
   ├─ apply_trims.py              裁剪执行器
   ├─ README.md                   本文档约定
   ├─ session-N/index.html        ← VIDEO_CONFIG 在此被改写为 0..新时长
   └─ media/decks/session-N/videos/… ← 裁剪产物落这里（与源同路径）
```

两条铁律：

| # | 规则 | 含义 |
|---|---|---|
| 1 | **03-slides 永不改动** | 权威完整源。视频不裁剪、deck HTML 不修改、VIDEO_CONFIG 不改数值。用户 ✂ 标记只以 `start_s/end_s` 登记进 `03-slides/media/trims.json`。 |
| 2 | **04-deploy 是唯一可裁镜像** | 所有物理裁剪（ffmpeg）与 VIDEO_CONFIG 改写只发生在这里。重建镜像后重跑 `apply_trims.py` 即可复现，源永远干净。 |

违反铁律 1 的判断标准：任何 `03-slides/media/**` 下的 mp4/gif 被物理改写，或 `03-slides/session-*/index.html` 的 VIDEO_CONFIG 数值被改——两者都应只发生在 `04-deploy/`。

## 2. trims.json 登记处（唯一裁剪真源）

位置 `03-slides/media/trims.json`，schema v1。每条 clip：

```jsonc
{
  "schema": 1,
  "clips": [
    {
      "deck": "session-3",
      "vid": "s008_uncanny",                    // 必须匹配 deck 内 data-vid / VIDEO_CONFIG 键
      "slide": "S3.08",
      "file_rel": "media/decks/session-3/videos/uncanny-valley-demo.mp4",  // 相对课程根
      "deck_rel": "session-3/index.html",       // 相对 04-deploy
      "start_s": 53.7748, "end_s": 101.3217,   // 用户 ✂ 标记的秒（可小数）
      "fps": 30,
      "start_frame": 1614, "end_frame": 3040,  // = ceil(start_s*fps)
      "source_duration_s": 120.67,
      "keep_duration_s": 47.55,                 // = end_s - start_s
      "status": "confirmed",                    // ← confirmed 才会被执行
      "note": ""
    }
  ]
}
```

**status 语义**：`unconfirmed` 永不执行（apply_trims.py 直接 skip）；只有用户确认后置 `confirmed` 才进裁剪管线。未经 confirmed 的条目不删、不改、不执行。

## 3. 四个执行器（职责边界，不重叠）

| 脚本 | 职责 | 关键参数 | 默认行为 |
|---|---|---|---|
| `04-deploy/apply_trims.py` | 按 trims.json 物理裁剪 confirmed 视频 + 改写镜像 VIDEO_CONFIG | `--apply` / `--only <vid>` / `-v` | dry-run |
| `tools/slim_videos.py` | 未裁剪的高码率原片二压瘦身（CRF24 重编码） | `--apply` / `--only <name>` / `-v` | dry-run |
| `tools/slim_images.py` | 图片瘦身：gif→animated WebP、png→WebP，并改写镜像 HTML 引用 | `--apply` / `-v` | dry-run |
| `tools/build_publish.py` | 从 04-deploy 生成学生网页播放版，发布到主页 repo | `--root` / `--repo` / `--out-sub` / `--dry-run` | — |

### 3.1 apply_trims.py — 视频裁剪

每条 `status=confirmed` 的 clip 做两件事（顺序固定）：

1. **物理裁剪**：`ffmpeg -ss <start_s> -i <源> -t <keep_duration_s>`。`-ss` 放 `-i` 前（输入 seek）+ 逐帧 libx264 重编码 + `-c:a copy`。先写 `.trimming.mp4` 临时文件，ffprobe 校验裁后时长（±0.5s）通过才 `os.replace` 原子落位。
2. **改写 VIDEO_CONFIG**：把镜像 deck HTML 里 `VIDEO_CONFIG[vid]` 从 `{"start": 旧, "end": 旧}` 改为 `{"start": 0, "end": <keep_duration_s>}`——窗口已烘进文件，播放器从 0 播到新时长。

质量档位：`libx264 CRF 24 + preset medium + yuv420p + -c:a copy + -movflags +faststart`（与 slim_videos 完全一致，保证「未裁剪原片」与「已裁剪片段」在同一视觉质量带）。

**幂等**：目标文件已存在且实测时长 ≈ keep_duration_s（±0.3s）→ 跳过裁剪；VIDEO_CONFIG 已是 `0..新时长` → 跳过改写。

### 3.2 slim_videos.py — 未裁剪原片二压瘦身

与 apply_trims.py **互补不重叠**：apply_trims 处理 trims.json 里 confirmed 的裁剪（已 CRF24 重编码过，再压会叠加第二次世代损耗）；slim_videos 只处理「未裁剪、仍保持源码率」的高码率原片，一次 CRF24 重编码即可大幅瘦身。

落地方式：`temp(.slim.mp4) → 校验(时长±0.3s 且确实变小) → 备份原文件(.orig.mp4) → os.replace 覆盖`。覆盖只发生在 04-deploy；03-slides 源完好，可随时取回原始码率。

两个跳过清单（幂等关键）：
- `KEEP_FILES`：用户裁决保全片（如 kep-s6 全程播）或已近极限（VP9 0.11Mbps）。
- `OVERRIDE_SKIP`：**实测重压反而变大**的候选——CRF24 重编码产物 > 原片，说明绝对码率已近内容极限（如 10-1.mp4 2.33Mbps 1080p 屏幕录制）。此清单让脚本幂等跳过，避免每次完整编码再回退。

### 3.3 slim_images.py — 图片瘦身

- **gif → animated WebP**：`gif2webp -lossy -m 6 -q 80`。注意 gif2webp 无 `-method/-quality`，只有 `-m <int>`(0..6) 与 `-q <float>`(0..100)。帧数/时长守恒。
- **png → WebP**：`cwebp -q 90`（有损，视觉无损）。
- **只转「被 deck HTML 实际引用」的图片**：收集 04-deploy 三份 index.html 里引用到的相对路径，未引用的残留图（`.padded.bak.png` 等）保持原样。
- 转码后**改写 04-deploy 的 index.html 引用**为 `.webp`（只改 `../media/decks/` 路径内的 .gif/.png，保守正则防误伤 CSS/data URI）。presenter.html 不引用图片，不改。
- 落地方式：**新增 .webp、保留原 .gif/.png**（用户选定，安全可回退）。

### 3.4 build_publish.py — 学生网页播放版

源 `04-deploy/session-N/index.html` → 出 `<主页repo>/teaching/<课程slug>/session-N/index.html`。幂等变换：

1. 媒体路径 `../media/decks/` → COS 绝对 URL
2. notes fetch `../../02-script/data/session` → `../data/session`
3. `openPresenter()` 首行注入 `return;`（函数级禁用；**容错**：源镜像已移除 presenter 时该步跳过、统计 `absent`，不报错）
4. 删除控制栏「演讲者视图」按钮 DOM（`data-act="pres"`；同上，源已无此按钮则跳过）
5. `attachSegButton()` 首行注入 `return;`（✂ 剪辑按钮禁用）
6. 复制 notes JSON + fonts/

静态自检：残留 `../media/decks/`、`../../02-script/`、`data-act="pres"` 按钮 DOM 任一项 → RuntimeError。

## 4. 放映链路

本地放映 = 双击课程根 `play.command`（内置 http 服务，**服务根 = 课程根**）。

- **自动打开的观众 deck 用 `/03-slides/session-N/`，不是 `/04-deploy/`**（2026-09-09 起，用户明确要求）。`DECK_URL` 还注入 `?pvx/pvy/pvw/pvh`（鼠标屏可见区）供 presenter 定位。
- 04-deploy 仍是**发布用裁剪镜像**（瘦身后供 `build_publish.py` 生成学生版），只是不再作为双击 `play.command` 的默认打开页；终端里仍可手动点 04-deploy 链接预览。
- deck 讲稿 fetch `../../02-script/data/sessionN.json`，从 `/03-slides/session-N/` 或 `/04-deploy/session-N/` 出发向上两级都落到课程根。所以**必须由课程根 serve**，不要把 04-deploy 单独当 server 根（否则 notes 404）。
- 02-script 逐字稿对照页的内嵌 iframe 预览指向 03-slides 权威源（它是编辑工作台，不是放映物）。
- 演讲者视图已移除（2026-09-07）：04-deploy 的 presenter.html 及 deck 内 presenter 入口均删除。**注意**：03-slides 侧保留 presenter.html（放映走 03-slides 后，演讲者视图仍可用）。
- 各 lecture 的 `play.command` 须保持同一形态，仅 session 数量不同；改一处记得 diff 其余几处。

## 5. 重建镜像后重新应用（procedure）

03-slides 有新增/修正 → 重建镜像后，裁剪要重放一遍：

```bash
# 1) 重建镜像：以 03-slides 为源 rsync 到 04-deploy（排除 _source/.DS_Store）
# 2) 校验 trims.json 仍与最新 03-slides 同步
python3 04-deploy/apply_trims.py            # dry-run 确认将要重裁的条目
python3 04-deploy/apply_trims.py --apply    # 幂等执行：已裁的跳过，缺失的重裁
python3 tools/slim_images.py                # dry-run
python3 tools/slim_images.py --apply        # 图片瘦身 + 引用改写
python3 tools/slim_videos.py                # dry-run
python3 tools/slim_videos.py --apply        # 视频二压瘦身
python3 tools/build_publish.py --root <课程根> --repo <主页repo> --dry-run
python3 tools/build_publish.py --root <课程根> --repo <主页repo>
```

脚本按「目标文件实测时长 ≈ keep_duration_s」判幂等，重建后目标文件回落到源全长 → 自动重裁，重复运行安全。

## 6. 已知陷阱（实战翻车，勿重蹈）

- **replacement 严禁自带花括号**：改写正则 `("vid"\s*:\s*\{)[^}]*(\})` 的 group(1) 已含开括号、group(2) 是闭括号，替换内容若再带 `{}` 会叠成 `{{"start": ...}}` 双括号——VIDEO_CONFIG 是 JS 对象字面量，直接 SyntaxError 打崩整页脚本。**只放纯内容**。
- **改完必须做 JS 语法校验**：把 `const VIDEO_CONFIG = { … };` 声明块抽出来过 `node --check`。只 grep 目标数字会漏掉双括号这类结构错误。
- **路径拼接别用 `lstrip("./")`**：deck HTML 里 media src 含 `../media/decks/…`，lstrip 会吞掉 `../` 导致路径全错。以 HTML 所在目录为基准 `os.path.join(html_dir, src)` 解析。
- **ffmpeg/ffprobe/gif2webp/cwebp 前置**：脚本内置候选路径（`/opt/homebrew/bin`、`/usr/local/bin`、PATH），不可用时 FATAL 退出。本机 brew 前缀是 `/opt/homebrew/bin`。
- **同文件多处修改严禁并行 Edit**（云同步目录双写竞争）：多个并行 Edit 各持旧快照整文件回写、后完成者胜。同文件多处改必须串行。
- **重压反而变大的候选不要反复试错**：完整编码一遍再回退很费时，且触发累计删除拦截。实测变大的记进 `OVERRIDE_SKIP` 清单让脚本幂等跳过。
- **瘦身/裁剪产物只落 04-deploy**：任何 `.slim.mp4`、`.trimming.mp4`、`.orig.mp4`、`.webp` 都不该出现在 03-slides。03-slides 是回退的干净源。

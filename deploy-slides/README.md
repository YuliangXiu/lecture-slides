# deploy-slides

课件网页部署发布流水线：视频剪辑/压缩 → 图片转 WebP → 上传腾讯云 COS → 更新课程主页 → 公开便携化发布。

- `SKILL.md` — 主编排入口（输入输出契约、七阶段步骤、依赖配置、成功/失败/重试）。
- `references/cos-upload.md` — COS 上传完整配方（rclone 已配置 + coscmd/SDK 备选、整目录全量同步 + webp 教训、密钥管理）。
- `references/portable-publish.md` — 把本 skill 发布到公开仓库的 PII 便携化配方（占位符体系、六步流程、常见坑）。
- `scripts/check_cos_env.py` — Stage 0 环境与密钥检查（rclone 或 coscmd 二选一 READY）。
- `scripts/cos_sync.py` — COS 幂等上传（SDK 备选，coscmd 不可用时用）。
- `scripts/scrub_placeholders.py` — Stage 8 PII 占位化断言脚本（`sub1`/`subN`/`forbid` 三函数）。

与 `lecture-slides`（模块 G）配合使用：裁剪/瘦身执行器的**实现细节**在 lecture-slides，本 skill 负责**端到端编排 + COS 上传 + 主页发布**。公开版（monorepo）与 live 版的占位化差异属设计内，便携化改写不回写 live。

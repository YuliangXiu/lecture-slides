#!/usr/bin/env python3
"""deploy-slides Stage 0 环境/密钥检查脚本。

检查部署管线的前置依赖是否就绪，输出三态报告：
  READY        —— 媒体工具 + COS 上传工具（rclone 或 coscmd）+ 密钥 全齐
  MISSING_TOOL —— rclone 与 coscmd 都缺（给出安装命令）
  MISSING_KEY  —— 上传工具已装但无密钥（rclone [cos] remote / ~/.cos.conf / 环境变量）

用法:
  python3 check_cos_env.py

退出码: 0=READY, 1=MISSING_TOOL, 2=MISSING_KEY, 3=媒体工具缺失
"""
import os
import re
import shutil
import sys

MEDIA_TOOLS = ["ffmpeg", "ffprobe", "gif2webp", "cwebp"]
RCLONE_BIN = "rclone"
COSCMD_BIN = "coscmd"
RCLONE_CONF = os.path.expanduser("~/.rclone.conf")
COS_CONF = os.path.expanduser("~/.cos.conf")


def find_tool(name):
    """在 brew 前缀 / 常见前缀 / PATH 中查找可执行文件。"""
    candidates = [
        f"/opt/homebrew/bin/{name}",
        f"/usr/local/bin/{name}",
    ]
    for c in candidates:
        if os.path.exists(c) and os.access(c, os.X_OK):
            return c
    return shutil.which(name)


def rclone_cos_remote_ok():
    """~/.rclone.conf 是否配了名为 cos 的 remote（provider=TencentCOS 或 type=s3）。"""
    if not os.path.exists(RCLONE_CONF):
        return False
    try:
        with open(RCLONE_CONF, "r", encoding="utf-8") as f:
            txt = f.read()
    except OSError:
        return False
    return bool(re.search(r"^\[cos\]\s*$", txt, re.M))


def has_key():
    """密钥是否可用：rclone [cos] remote 优先，其次 ~/.cos.conf，再环境变量。"""
    if rclone_cos_remote_ok():
        return True, f"{RCLONE_CONF} 的 [cos] remote"
    if os.environ.get("COS_SECRET_ID") and os.environ.get("COS_SECRET_KEY"):
        return True, "环境变量 COS_SECRET_ID / COS_SECRET_KEY"
    if os.path.exists(COS_CONF):
        return True, f"{COS_CONF}"
    return False, ""


def main():
    missing_media = [t for t in MEDIA_TOOLS if find_tool(t) is None]
    rclone_path = find_tool(RCLONE_BIN)
    coscmd_path = find_tool(COSCMD_BIN)
    tool = rclone_path or coscmd_path
    key_ok, key_src = has_key()

    # 媒体工具是硬前置（执行器自己也会 FATAL，这里提前暴露）
    if missing_media:
        print("[MISSING_MEDIA] 缺少媒体工具: %s" % ", ".join(missing_media))
        print("  请确认 brew 前缀 /opt/homebrew/bin 下已安装 ffmpeg/gif2webp/cwebp。")
        sys.exit(3)

    if tool is None:
        print("[MISSING_TOOL] 未找到 rclone 或 coscmd（COS 上传工具）")
        print("  首选 rclone:  brew install rclone")
        print("              rclone config  # 新建 remote: type=s3, provider=TencentCOS, endpoint=cos.<COS_REGION>.myqcloud.com")
        print("  备选 coscmd: python3 -m venv <venv>")
        print("              <venv>/bin/pip install coscmd")
        sys.exit(1)

    if not key_ok:
        print("[MISSING_KEY] 上传工具已装（%s）但无密钥" % tool)
        print("  rclone: 确认 ~/.rclone.conf 有 [cos] remote（rclone config 新建/编辑）")
        print("  coscmd: coscmd config -a <SecretId> -s <SecretKey> -b <COS_BUCKET> -r <COS_REGION>")
        print("  或导出: export COS_SECRET_ID=... COS_SECRET_KEY=...")
        sys.exit(2)

    print("[READY] 媒体工具齐、上传工具=%s、密钥=%s" % (tool, key_src))
    sys.exit(0)


if __name__ == "__main__":
    main()

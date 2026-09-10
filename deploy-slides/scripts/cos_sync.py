#!/usr/bin/env python3
"""COS 幂等上传（备选，qcloud_cos SDK 直连）。

当 coscmd 不可用时用此脚本递归上传本地媒体目录到 COS，按
「对象 size + 自定义元数据 md5」判重，重跑安全。

前置:
  pip install cos-python-sdk-v5
  环境变量 COS_SECRET_ID / COS_SECRET_KEY

用法:
  COS_SECRET_ID=xxx COS_SECRET_KEY=yyy python3 cos_sync.py \
      --src <本地目录> --prefix /lecture-01/media/decks/ \
      [--bucket <COS_BUCKET>-<AppID>] [--region <COS_REGION>] \
      [--apply]      # 缺省 dry-run，只打印将要上传/跳过的文件

判重策略:
  head_object 查对象 Content-Length + x-cos-meta-md5；与本地一致则跳过，
  否则上传并在元数据写入本地 md5。首次上传（head 404）视为 new。
"""
import argparse
import hashlib
import os
import sys


def md5_file(path, chunk=8 * 1024 * 1024):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(chunk), b""):
            h.update(block)
    return h.hexdigest()


def iter_files(src):
    for root, _dirs, files in os.walk(src):
        for name in sorted(files):
            full = os.path.join(root, name)
            rel = os.path.relpath(full, src)
            yield full, rel


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--prefix", default="/lecture-01/media/decks/")
    ap.add_argument("--bucket", default="<COS_BUCKET>-<AppID>")
    ap.add_argument("--region", default="<COS_REGION>")
    ap.add_argument("--apply", action="store_true", help="真正上传；缺省 dry-run")
    args = ap.parse_args()

    secret_id = os.environ.get("COS_SECRET_ID")
    secret_key = os.environ.get("COS_SECRET_KEY")
    if not (secret_id and secret_key):
        print("[MISSING_KEY] 需导出 COS_SECRET_ID / COS_SECRET_KEY")
        sys.exit(2)

    try:
        from qcloud_cos import CosConfig, CosS3Client
    except ImportError:
        print("[MISSING_SDK] 需先: pip install cos-python-sdk-v5")
        sys.exit(1)

    config = CosConfig(Region=args.region, SecretId=secret_id, SecretKey=secret_key)
    client = CosS3Client(config)
    prefix = args.prefix.rstrip("/")

    n_up = n_skip = n_new = 0
    for full, rel in iter_files(args.src):
        key = f"{prefix}/{rel}"
        local_size = os.path.getsize(full)
        local_md5 = md5_file(full)
        status = "new"
        try:
            resp = client.head_object(Bucket=args.bucket, Key=key)
            cos_size = int(resp.get("Content-Length", -1))
            cos_md5 = str(resp.get("x-cos-meta-md5") or resp.get("x-cos-meta-MD5") or "").strip().strip('"')
            status = "skip" if (cos_size == local_size and cos_md5 == local_md5) else "changed"
        except Exception:
            status = "new"  # head 失败(404 等) → 视为新对象

        if status == "skip":
            n_skip += 1
            if not args.apply:
                print(f"SKIP  {key}")
            continue

        if status == "new":
            n_new += 1
        else:
            n_up += 1

        print(f"{'UPLOAD' if status == 'new' else 'REUPL'}  {key}")
        if args.apply:
            client.upload_file(
                Bucket=args.bucket,
                LocalFilePath=full,
                Key=key,
                EnableMD5=False,
                **{"x-cos-meta-md5": local_md5},
            )

    print(f"\n结果: 上传={n_up} 新增={n_new} 跳过={n_skip} 总={n_up + n_new + n_skip}")
    if not args.apply:
        print("(dry-run) 加 --apply 才真正上传")


if __name__ == "__main__":
    main()

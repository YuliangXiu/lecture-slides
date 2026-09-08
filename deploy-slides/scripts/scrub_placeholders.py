#!/usr/bin/env python3
"""PII 占位化断言脚本（可复用）。

用法：
  1. 编辑本脚本底部的 FILES / PAIRS / FORBID 三份配置。
     - FILES: 待占位化改写的文件路径列表（相对/绝对均可）
     - PAIRS: [(old, new), ...] 精确替换映射，每个 old 必须恰好命中 1 次（防漏替）
     - FORBID: ['token_1', ...] 残留敏感 token 黑名单，断言其不出现（防误替）
  2. 运行: python3 scrub_placeholders.py
  3. 输出 "ALL SCRUB PASSED" 即本批改写全绿，可进入 git 提交环。

设计要点（对齐 live 实测经验）：
  - sub1: 长上下文精确子串，断言命中恰好 1 次。用于只该出现一次的实例值。
  - subN: 高频 token 全局替换，打印命中次数（须 >=1）。用于多次出现的同一实例值。
  - forbid: 断言任何残留敏感 token 不出现。防止替换后仍有漏网。
  - 三函数配合：sub1/subN 防漏替，forbid 防误替。
"""
from __future__ import annotations

import sys
from pathlib import Path


def sub1(path: Path, pairs: list[tuple[str, str]], tag: str = "") -> None:
    """每对 old->new 精确替换必须恰好命中 1 次，否则报错退出。"""
    t = path.read_text(encoding="utf-8")
    for old, new in pairs:
        n = t.count(old)
        if n != 1:
            print(f"  [sub1 FAIL] {path.name} {tag!r}: '{old}' 命中 {n} 次（须为 1）")
            sys.exit(1)
        t = t.replace(old, new)
    path.write_text(t, encoding="utf-8")
    print(f"  [sub1 OK] {path.name} {tag!r}")


def subN(path: Path, pairs: list[tuple[str, str]]) -> None:
    """全局替换，每对打印命中次数，须 >=1。"""
    t = path.read_text(encoding="utf-8")
    for old, new in pairs:
        n = t.count(old)
        if n < 1:
            print(f"  [subN FAIL] {path.name}: '{old}' 命中 0 次（须 >=1）")
            sys.exit(1)
        t = t.replace(old, new)
        print(f"  [subN OK] {path.name}: '{old}' x{n} -> '{new}'")
    path.write_text(t, encoding="utf-8")


def forbid(path: Path, tokens: list[str]) -> None:
    """断言敏感 token 不残留。"""
    t = path.read_text(encoding="utf-8")
    leftovers = [tok for tok in tokens if tok in t]
    if leftovers:
        print(f"  [forbid FAIL] {path.name}: 残留 {leftovers}")
        sys.exit(1)
    print(f"  [forbid OK] {path.name}")


# ---------------------------------------------------------------------------
# 配置区：按任务改写
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent  # skill 目录


def main() -> None:
    # 敏感 token 黑名单。按需加长；覆盖本机路径/品牌名/实例值/密钥样式。
    # 下面带 <> 的词是**占位符教学示例**——使用者在自己的机器上的移植时，
    # 把它们替换成自己的真实实例值（如真实用户名、COS 桶/区域、课程项目名等），
    # 再对 RELEASE_NOTE.md 等「待发布内容文件」做 forbid。
    # 通用结构敏感样式（路径前缀、密钥前缀、邮箱后缀等）可直接沿用。
    FORBID = [
        "/Users/", "OneDrive", "Westlake", "西 湖", "西湖", "Digital Human",
        "<你的用户名>", "<你的域名>", "<COS桶名>", "<COS区域>", "<课程项目名>",
        "lecture-01", "lecture-02",
        "gmail", "sk-", "AKIA", "PRIVATE KEY", "<你的github用户名>.github",
    ]

    # (文件, [(old, new), ...], tag) —— 精确替换，每个 old 恰 1 次
    sub1_jobs = []

    # (文件, [(old, new), ...]) —— 全局替换，每个 old >=1 次
    subN_jobs = []

    # 默认跑本脚本所在目录下的临时清单。实际任务中按需填充 sub1_jobs/subN_jobs。
    # 示例（去注释启用）：
    # sub1_jobs.append((REPO_ROOT / "SKILL.md", [
    #     ("课程根 OneDrive 绝对路径", "<课程根>"),
    # ], "example"))
    # subN_jobs.append((REPO_ROOT / "SKILL.md", [
    #     ("project-name", "<课程slug>"),
    # ]))

    for p, pairs, tag in sub1_jobs:
        if p.exists():
            sub1(p, pairs, tag)
    for p, pairs in subN_jobs:
        if p.exists():
            subN(p, pairs)

    # 对涉及的文件统一 forbid（也可只对 sub1/subN 后的文件做）
    # 注意：仅对「要发布的实际内容」forbid。本文档/SKILL.md 是讲解用途，
    # 必然要举例这些 token，不应参与 forbid，否则会误判。
    for f in [REPO_ROOT / "RELEASE_NOTE.md"]:  # 替换为待发布内容文件
        if f.exists():
            forbid(f, FORBID)

    print("ALL SCRUB PASSED")


if __name__ == "__main__":
    main()

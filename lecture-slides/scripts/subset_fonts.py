# -*- coding: utf-8 -*-
"""字体离线本地化模板：可变字体 + 按课件字符集子集化（lecture-slides 模块 C）

用法：改 DECK（课件目录）与 FONTS（所需家族）后运行。
前提：/tmp/vfonts/ 已下载 VF 原字（google/fonts GitHub ofl/ 目录，注意 [wght] 转义 %5B%5D）。
产出：DECK/media/fonts/{fonts.css, N×woff2}，并把两个 HTML 的字体 link 指向本地。

依赖：运行本脚本的 python 需装有 fonttools + brotli（`pip install fonttools brotli`）；
子集化调用同一解释器（可用环境变量 PYTHON_BIN 覆盖）。
"""
import os, re, subprocess, sys, html as H

# ==== 按课件修改这三处 ====
DECK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "your-deck")  # 课件目录
VDIR = "/tmp/vfonts"                                                          # VF 原字缓存
FONTS = [  # (源文件, 输出名, css family, 斜体?)
    ("NotoSerifSC%5Bwght%5D.ttf",   "noto-serif-sc.woff2",     "Noto Serif SC",   False),
    ("NotoSansSC%5Bwght%5D.ttf",    "noto-sans-sc.woff2",      "Noto Sans SC",    False),
    ("PlayfairDisplay%5Bwght%5D.ttf", "playfair-display.woff2", "Playfair Display", False),
    ("PlayfairDisplay-Italic%5Bwght%5D.ttf", "playfair-italic.woff2", "Playfair Display", True),
    ("JetBrainsMono%5Bwght%5D.ttf", "jetbrains-mono.woff2",    "JetBrains Mono",  False),
]
# 各家族 wght 轴范围（写进 @font-face 的 font-weight 区间）
RANGE = {"Noto Serif SC": "200 900", "Noto Sans SC": "100 900",
         "Playfair Display": "400 900", "JetBrains Mono": "100 800"}

PY = os.environ.get("PYTHON_BIN") or sys.executable  # 装有 fontTools 的 python（默认取运行本脚本的解释器）
FDIR = os.path.join(DECK, "media", "fonts")

# ---- 1. 字符集：全部文本 + data-notes/ttitle 讲稿 + ASCII + 全角标点缓冲 ----
chars = set()
for fn in ("index.html", "presenter.html"):
    p = os.path.join(DECK, fn)
    if not os.path.exists(p):
        continue
    raw = open(p, encoding="utf-8").read()
    t = re.sub(r"<style.*?</style>|<script.*?</script>", "", raw, flags=re.S)
    for attr in re.findall(r'data-(?:notes|ttitle)="([^"]*)"', raw):
        chars.update(H.unescape(attr))
    chars.update(H.unescape(re.sub(r"<[^>]+>", " ", t)))
chars |= set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
chars |= set(" .,:;!?()[]{}'\"-_/@#%&*+=<>~`|^$\\")
chars |= set("，。：；！？（）【】『』「」‘’“”—…·、《》〈〉￥％＋－×÷＝／")
chars |= set("©®™°±×÷≈≠≤≥→←↑↓↔⇒•◦·§¶†‡′″")
chars -= {"\n", "\t"}
charfile = os.path.join(VDIR, "chars.txt")
os.makedirs(VDIR, exist_ok=True)
open(charfile, "w", encoding="utf-8").write("".join(sorted(chars)))
print(f"字符集: {len(chars)} 个字符")

# ---- 2. 子集化（保留 wght 可变轴；--no-hinting 与 GF 线上行为一致）----
os.makedirs(FDIR, exist_ok=True)
total = 0
for src, out, fam, ital in FONTS:
    dst = os.path.join(FDIR, out)
    r = subprocess.run([PY, "-m", "fontTools.subset", os.path.join(VDIR, src),
        "--text-file=" + charfile, "--flavor=woff2", "--output-file=" + dst,
        "--layout-features=*", "--glyph-names", "--notdef-outline",
        "--no-hinting"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-500:]
    total += os.path.getsize(dst)
    print(f"  {out}: {os.path.getsize(dst)/1024:.0f} KB")

# ---- 3. fonts.css：VF 区间声明 ----
faces = []
for src, out, fam, ital in FONTS:
    style = "italic" if ital else "normal"
    faces.append(
        f"@font-face {{ font-family: '{fam}'; font-style: {style}; "
        f"font-weight: {RANGE.get(fam, '200 900')}; font-display: swap; "
        f"src: url('{out}') format('woff2-variations'); }}")
css = "/* lecture-slides 本地字体：VF + 按课件字符集子集化（每家族 1 文件） */\n" + "\n".join(faces) + "\n"
open(os.path.join(FDIR, "fonts.css"), "w", encoding="utf-8").write(css)

# ---- 4. HTML 接线：字体 link 指本地（替换 Google Fonts link）----
NEW = {"fonts.css"} | {f[1] for f in FONTS}
removed = 0
for f in os.listdir(FDIR):
    if f not in NEW:
        os.remove(os.path.join(FDIR, f)); removed += 1
for fn in ("index.html", "presenter.html"):
    p = os.path.join(DECK, fn)
    if not os.path.exists(p):
        continue
    h = open(p, encoding="utf-8").read()
    h = re.sub(r'<link[^>]*fonts\.googleapis\.com[^>]*>', '', h)
    h = re.sub(r'<link[^>]*fonts\.gstatic\.com[^>]*>', '', h)
    if "media/fonts/fonts.css" not in h:
        h = h.replace("<style>", '<link rel="stylesheet" href="media/fonts/fonts.css">\n<style>', 1)
    open(p, "w", encoding="utf-8").write(h)
print(f"清理旧文件 {removed} 个；fonts/ 共 {len(os.listdir(FDIR))} 文件，字体共 {total/1024/1024:.2f} MB")
print("验收：见 references/font-offline.md（零外链 / 字符覆盖 / 像素对比三层）")

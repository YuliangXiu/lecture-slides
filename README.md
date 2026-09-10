# lecture-slides

Three independent agent skills for building, polishing and deploying **HTML lecture slides**:

| Skill | Directory | What it does |
|---|---|---|
| `lecture-slides` | [`lecture-slides/`](./lecture-slides/) | The **design system**: one visual language (04-magazine editorial style), a Keynote-style presenter view, fully offline self-contained output, quality gates and layout audits, a PPT-style card editor, and the Layout Doctrine (the default typography rules distilled from 151 rounds of real feedback). |
| `lecture-deck-pipeline` | [`lecture-deck-pipeline/`](./lecture-deck-pipeline/) | The **build / replicate / verify / polish pipeline**: fixed-stage engine + Python content modules, a single-source bilingual speaker-script JSON, presenter view, `play.command` launcher; replication of an external slide deck (geometry, fonts, animation order, white-block cleanup, stage fitting, rebranding); the five-layer fidelity verification chain; the hidden-slide chain; and the review-comment feedback loop (formerly the separate `polish-slides` skill). |
| `deploy-slides` | [`deploy-slides/`](./deploy-slides/) | The **deploy pipeline**: trims/slims media into a deploy mirror, idempotently syncs the media folder to Tencent COS, generates the student web build, commits it to the course homepage repo, and runs online acceptance. |

Each directory is a complete skill in the standard agent-skills format (`SKILL.md` + `assets/` + `references/` + `scripts/`).

**How they relate.** `lecture-slides` is course-agnostic — it describes *how to build this kind of deck* and applies to any CSS-class-based static HTML slide project. `lecture-deck-pipeline` is written for a specific scaffold (`_shared/` engine + build layer, `tools/content/session{N}_content.py` content modules, `session{N}.json` speaker scripts, `02-script/` front end), but its directory contract and routing rules generalize to any deck + bilingual-script project. `deploy-slides` is a course-agnostic template: every instance value (course root, homepage repo, COS bucket/region/prefix, publish domain) appears as a `<...>` placeholder that you substitute per course.

`lecture-deck-pipeline` and `deploy-slides` both *reference* `lecture-slides` rather than restating it: the visual system, presenter view, offline localization, quality gates and workbench designs live in `lecture-slides` (and its `references/`); the scaffold-specific operation and pitfalls live in `lecture-deck-pipeline`; the publish chain lives in `deploy-slides`.

## Repository layout

```
README.md                        # this file
lecture-slides/                  # skill 1: the design system
  SKILL.md                       # entry: triggers, module workflow, pitfalls
  assets/
    magazine-style.css           # 04-magazine skin (drop-in)
    presenter-inject.js          # presenter-view injection script
    presenter-template.html      # presenter window template
  references/
    presenter-mode.md            # message protocol, dual progress bars, self-healing
    reveal-adapter.md            # reveal.js engine adapter
    font-offline.md              # variable-font subsetting + acceptance tests
    segment-editor.md            # video segment editor design (module D + dual-view sync)
    deploy-slimming.md           # deploy mirror: trim/slim executors design (module G)
    multi-screen-routing.md      # multi-screen presenter routing (module B5)
    workbench-tools.md           # editor workbench tooling (module H)
    card-editor.md               # PPT card editor design (module F)
    cue-q-workflow.md            # cue-cards `q` field workflow
  scripts/
    verify_nested.mjs            # nested-frame acceptance scan
    subset_fonts.py              # font subsetting template
    audit_aspect.mjs             # media aspect-ratio audit
    audit_layout.mjs             # layout-balance audit
    test_segeditor.mjs           # segment editor E2E
lecture-deck-pipeline/           # skill 2: build / replicate / verify / polish
  SKILL.md                       # entry: directory contract, build/verify loop, replication,
                                 #        white-block cleanup, stage fitting, rebranding,
                                 #        hidden slides, feedback queue, pitfalls
  assets/
    play.command                 # macOS launcher (HTTP server + browser windows)
  scripts/
    export_feedback.mjs          # optional localStorage export helper
  references/
    AUTHORING.md                 # engine authoring rules: layout doctrine, media, notes
deploy-slides/                   # skill 3: end-to-end deploy pipeline
  SKILL.md                       # entry: I/O contract, stages, failure/retry
  README.md                      # directory map
  references/
    cos-upload.md                # Tencent COS upload recipe (rclone / coscmd / SDK)
    portable-publish.md          # recipe for scrubbing this skill into a portable copy
  scripts/
    check_cos_env.py             # stage-0 env & key check (READY/MISSING_TOOL/MISSING_KEY)
    cos_sync.py                  # idempotent COS upload via qcloud_cos SDK (fallback)
    scrub_placeholders.py        # placeholder-scrub assertion helper
```

## Skill 1 — `lecture-slides` (the design system)

One visual standard, plus the machinery around it:

- **Module A · Editorial style** — full skin CSS: warm paper background, serif display type (Playfair Display + Noto Serif SC), deep-red accent lines, unified card frames ("thin border + 3px top accent + 12px radius + soft shadow"). Pure-CSS `:is()`-based nested-frame reset keeps the accent line on the outermost container only. Zero DOM changes.
- **Module B · Presenter view** — Keynote-style dual-screen: audience fullscreen + presenter window whose right column is a full-height speaker-notes pane (adaptive font size that fills the container; scrolling off by default with a manual toggle; optional cue-cards instead of raw notes), synced via `postMessage` (works over `file://`). Two progress bars estimate lecture pace in real time from note scripts: a course-time bar and a per-slide content bar with a fast/slow pace badge. Module B5 adds multi-screen window routing.
- **Module C · Offline localization** — self-contained decks: media re-indexed under `media/{images,videos}/`; fonts localized via variable-font subsetting (`pyftsubset`, one woff2 per family, ~0.8 MB for a full CJK deck). Copy the folder to any machine, no network, double-click `index.html`.
- **Module D · Quality gates** — media aspect-ratio audit (container must match the media's real ratio), layout-balance audit, pixel-aligned progressive reveals across pages, a video segment editor with persisted start/end, and a full E2E acceptance.
- **Module E · Layout Doctrine (default)** — the default typography rules distilled from 151 rounds of real layout feedback: media as protagonist (≥80% height), cards aspect-locked and never cropped, brick-layout grids that fill the page edge-to-edge, text in narrow columns, a strict bilingual system (English body, Chinese in fixed footnotes, never inline), progressive reveal animations, sparse pages removed.
- **Modules F–H · Editor tooling** — PPT card editor design (module F), the `02-script/` editor workbench (element numbering, thumbnail board with cross-session reordering, thumbnail pipeline, launcher version hints), and multi-screen routing. See the matching files under `references/`.

### Usage

Point your assistant's skill loader at `lecture-slides/` — i.e. copy the folder into your skills directory:

```bash
cp -R lecture-slides ~/.workbuddy/skills/lecture-slides   # e.g. for WorkBuddy
```

The skill triggers on requests like "make lecture slides", "unify card styles", "presenter view", "dual progress bar", "offline / self-contained deck", "media boxes are cropped / layout has dead space", "video segment". Manual use is fine too — the CSS, JS, and reference docs are self-explanatory.

## Skill 2 — `lecture-deck-pipeline` (building, replicating, verifying, polishing)

The orchestration skill for a whole lecture. It owns:

- **The directory contract** — authoritative deck source vs. deploy mirror, and the `_shared/` engine + builder layer shared across lectures. Content lives in Python modules (`tools/content/session{N}_content.py`); the speaker script is a single JSON source of truth; the deck is a fixed-stage deck (not reveal.js) rendered offline. `assets/play.command` starts a local HTTP server and opens the front end plus the deck windows (multi-screen aware). `references/AUTHORING.md` is the engine's authoring guide.
- **Replication of an external deck** — two replica pipelines (16:9 and 4:3 source canvases), OOXML inheritance chains (font size, bullets, line spacing), animation reproduction (entry/exit/motion-path with trigger order), and a **five-layer fidelity verification chain** (generator consistency → element geometry → animation steps → font size → engine-level check) where every layer has an independent ground truth.
- **White-block / white-background cleanup** — source decks hide "cover rectangles" on a white canvas which become visible once the canvas turns cream; images and videos carry white backgrounds too. The skill documents the element-level and pixel-level detection thresholds (and why automated chart-vs-render classification fails), edge-connected alpha keying, and the `mix-blend-mode: darken` trick for white-backed videos.
- **Stage fitting** — replicating a source deck whose page size does not match the target ratio leaves content crammed into the middle 60–70%. The fix is a per-page 2D fit on the *content bounding box*, not a fixed scale factor.
- **Rebranding** — cover page credits, an hourglass countdown on each session's closing page, and redacting the original authors' names from the speaker script and citations, with a fixed step order (`regen → brand → build`) because running them out of order silently loses edits.
- **Hidden slides** — the source `.pptx` `show="0"` flag propagates through five layers; the rule implementation is single-sourced and shared across lectures.
- **The feedback loop** (formerly the separate `polish-slides` skill) — read `status: "unsolved"` records from the project's feedback history, enhance each comment through the `prompt-optimizer` skill, route it to the deck or the bilingual script, rebuild, verify, and close the resolved items.
- **Two-layer acceptance** — a hash layer (generator behaviour unchanged) plus a pixel layer (rendered result unchanged), because a single layer cannot distinguish "optimised" from "broken".

> **Absorbed skill.** `polish-slides` was merged into this skill (2026-09-10). Its queue contract, comment routing, transcription rules and status writes now live in the "打磨闭环" section of `SKILL.md` — that skill no longer exists.

### Usage

```bash
cp -R lecture-deck-pipeline ~/.workbuddy/skills/lecture-deck-pipeline   # e.g. for WorkBuddy
```

The skill triggers on requests like "make the course slides", "build the deck", "new lecture", "notes not showing", "play.command", "deck_builder", "white blocks", "layout not filling the stage", "redact the original author", "apply the review comments", "insert a page".

## Skill 3 — `deploy-slides` (deploying)

Runs the end-to-end publish pipeline for a course deck project, as an idempotent, replayable workflow:

1. **Stage 0–4** — file cleanup, environment/key check, rebuild the deploy mirror from the authoritative source, then trim videos (`trims.json`), slim referenced images to WebP, and re-compress untouched high-bitrate originals — all inside the deploy mirror only; the source never changes.
2. **Stage 5** — idempotent full-directory sync of the slimmed media folder to Tencent COS (`rclone copy` or `coscmd --skipmd5`, or the bundled SDK script); re-running after an interruption is safe.
3. **Stage 6** — generate the student web build (media URLs rewritten to COS absolute URLs, presenter features disabled) and commit it to the course homepage repo.
4. **Stage 7** — online acceptance from the user's view: page reachable, no stale copy, no leftover relative media paths, COS objects return 200 with the right `Content-Type`.

`SKILL.md` is the orchestration entry (I/O contract, per-stage commands, success/failure/retry table); `references/cos-upload.md` holds the full COS recipe (tool install/config, idempotent upload commands, key management rules, failure table); `scripts/` provides the stage-0 env check and an SDK-based upload fallback.

**Instance placeholders.** The skill is a reusable template. Everywhere you see `<课程根>` (course root), `<主页repo>` (homepage repo path), `<主页域名>` (publish domain), `<课程slug>` (publish sub-path under the homepage `teaching/` tree), `<COS_BUCKET>` / `<COS_REGION>` / `<COURSE_ID>` (Tencent COS bucket / region / course prefix), or `<venv>` / `<本 skill 目录>` (Python venv / skill install dir), substitute your own values before executing. The two scripts read `COS_BUCKET` / `COS_REGION` / `COS_PREFIX` from the environment instead of hard-coding instance values.

### Usage

```bash
cp -R deploy-slides ~/.workbuddy/skills/deploy-slides   # e.g. for WorkBuddy
```

The skill triggers on requests like "deploy the course slides", "publish to the homepage", "upload to COS", "slim / compress media", "build the student web version". Pair it with `lecture-slides` module G (media executors' internals); this skill only orchestrates the correct order and fills in the COS-upload and homepage-publish stages module G does not cover.

## Notes

- All internal paths are portable: scripts resolve their own interpreter (`sys.executable`, overridable with `PYTHON_BIN`) and never reference a specific user's home or sync directory. `deploy-slides` instance values are placeholders (see above), and its scripts take bucket/region/prefix from the environment (`COS_BUCKET` / `COS_REGION` / `COS_PREFIX`).
- Requires Playwright for the acceptance scripts and `fonttools` + `brotli` for font subsetting (installed into whichever Python runs the script). Deploying additionally needs `ffmpeg`/`ffprobe`, `gif2webp`/`cwebp`, and one COS upload tool (rclone, coscmd, or the qcloud_cos SDK).
- **Live vs. portable copies.** The maintainer's working copy of these skills is kept alongside the course project and contains real paths and instance values; the copies in this repository are the scrubbed, portable versions. The scrub is one-way: portable rewrites are never written back to the live copy.

## Verified on

A production CJK deck project: 114 media assets, 1073-char CJK+Latin charset.
Acceptance: offline reproduce PASS (zero external requests, 100% glyph coverage, zero text-element reflow), presenter view 32/32 HTTP + 4/4 `file://` assertions. The `deploy-slides` pipeline was exercised end-to-end on the same project (media slimming, COS sync, homepage publish and online acceptance all green).

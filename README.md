# lecture-slides

Four independent agent skills for building, polishing and deploying **HTML lecture slides**:

| Skill | Directory | What it does |
|---|---|---|
| `lecture-deck-pipeline` | [`lecture-deck-pipeline/`](./lecture-deck-pipeline/) | Builds and iterates a course deck project end to end: fixed-stage engine + Python content modules, a single-source bilingual speaker-script JSON, presenter view, and the `play.command` launcher. Owns the directory contract, build/acceptance commands and the engine's authoring rules. |
| `lecture-slides` | [`lecture-slides/`](./lecture-slides/) | Builds decks in one visual system (04-magazine editorial style) with a Keynote-style presenter view and fully offline, self-contained output. |
| `polish-slides` | [`polish-slides/`](./polish-slides/) | Runs the feedback loop on an existing deck project: reads a queue of unsolved review comments, routes them to the deck and its bilingual speaker script, rebuilds, verifies, and closes the resolved items. |
| `deploy-slides` | [`deploy-slides/`](./deploy-slides/) | End-to-end deploy pipeline for a course deck project: trims/slims media into a deploy mirror, idempotently syncs the media folder to Tencent COS, then generates the student web build and commits it to the course homepage repo. |

Each directory is a complete skill in the standard agent-skills format (`SKILL.md` + `assets/` + `references/` + `scripts/`). They are independent: `polish-slides` reuses `lecture-deck-pipeline`'s build and acceptance scripts but does not depend on this repo's `lecture-slides` skill, and `deploy-slides` only *references* `lecture-slides` module G for the internals of its media executors. All four expect an HTML-slide workflow; `lecture-deck-pipeline` and `polish-slides` are written for a specific course scaffold (`_shared/` engine + build layer, `tools/content/session{N}_content.py` content modules, `session{N}.json` speaker scripts, `02-script/` front end) but their directory and routing rules generalize to any deck + bilingual-script project. `deploy-slides` is a course-agnostic template: every instance value (course root, homepage repo, COS bucket/region/prefix, publish domain) appears as a `<...>` placeholder that you substitute per course.

## Repository layout

```
README.md                        # this file
lecture-deck-pipeline/           # skill 1: building a deck project
  SKILL.md                       # entry: directory contract, build/accept loop, pitfalls
  assets/
    play.command                 # macOS launcher (HTTP server + browser windows)
  references/
    AUTHORING.md                 # engine authoring rules: layout doctrine, media, notes
lecture-slides/                  # skill 2: building slides
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
    multi-screen-routing.md      # multi-screen presenter routing (module H)
    workbench-tools.md           # editor workbench tooling (module B5)
    card-editor.md               # PPT card editor design (module F)
  scripts/
    verify_nested.mjs            # nested-frame acceptance scan
    subset_fonts.py              # font subsetting template (portable)
    audit_aspect.mjs             # media aspect-ratio audit
    audit_layout.mjs             # layout-balance audit
    test_segeditor.mjs           # segment editor E2E
polish-slides/                   # skill 3: applying review feedback
  SKILL.md                       # entry: queue, routing, rewrite rules, status writes
  scripts/
    export_feedback.mjs          # optional localStorage export helper
deploy-slides/                   # skill 4: end-to-end deploy pipeline
  SKILL.md                       # entry: I/O contract, seven stages, failure/retry
  README.md                      # directory map
  references/
    cos-upload.md                # Tencent COS upload recipe (rclone / coscmd / SDK)
  scripts/
    check_cos_env.py             # stage-0 env & key check (READY/MISSING_TOOL/MISSING_KEY)
    cos_sync.py                  # idempotent COS upload via qcloud_cos SDK (fallback)
  .gitignore
```

## Skill 1 — `lecture-deck-pipeline` (building a deck project)

The orchestration skill for a whole lecture: it owns the directory contract (authoritative deck source vs. deploy mirror), the `_shared/` engine + builder layer shared across lectures, and the build → verify loop. Content lives in Python modules (`tools/content/session{N}_content.py`); the speaker script is a single JSON source of truth; the deck is a fixed 1920×1080 stage (not reveal.js) rendered offline. `assets/play.command` starts a local HTTP server and opens the front end plus the deck windows (multi-screen aware). `references/AUTHORING.md` is the engine's authoring guide — layout doctrine, media rules, notes display, keyboard control, thumbnail-gallery recipes.

### Usage

```bash
cp -R lecture-deck-pipeline ~/.workbuddy/skills/lecture-deck-pipeline   # e.g. for WorkBuddy
```

The skill triggers on requests like "make the course slides", "build the deck", "new lecture", "notes not showing", "play.command", "deck_builder".

## Skill 2 — `lecture-slides` (building)

One visual standard, five capabilities:

- **Module A · Editorial style** — full skin CSS: warm paper background, serif display type (Playfair Display + Noto Serif SC), deep-red accent lines, unified card frames ("thin border + 3px top accent + 12px radius + soft shadow"). Pure-CSS `:is()`-based nested-frame reset keeps the accent line on the outermost container only. Zero DOM changes.
- **Module B · Presenter view** — Keynote-style dual-screen: audience fullscreen + presenter window whose right column is a full-height speaker-notes pane (adaptive font size that fills the container; scrolling off by default with a manual toggle; optional cue-cards instead of raw notes), synced via `postMessage` (works over `file://`). Two progress bars estimate lecture pace in real time from note scripts: a course-time bar and a per-slide content bar with a fast/slow pace badge.
- **Module C · Offline localization** — self-contained decks: media re-indexed under `media/{images,videos}/`; fonts localized via variable-font subsetting (`pyftsubset`, one woff2 per family, ~0.8 MB for a full CJK deck). Copy the folder to any machine, no network, double-click `index.html`.
- **Module D · Quality gates** — media aspect-ratio audit (container must match the media's real ratio), layout-balance audit, pixel-aligned progressive reveals across pages, a video segment editor with persisted start/end, and a full E2E acceptance.
- **Module E · Layout Doctrine (default)** — the default typography rules distilled from 151 rounds of real layout feedback: media as protagonist (≥80% height), cards aspect-locked and never cropped, brick-layout grids that fill the page edge-to-edge, text in narrow columns, a strict bilingual system (English body, Chinese in fixed footnotes, never inline), progressive reveal animations, sparse pages removed.
- **Modules F–H · Editor tooling** — PPT card editor design (module F), dual-view video segment editor with auto-playback repair (module D/G updates), deploy-mirror trim/slim design (module G), multi-screen presenter routing (module H), and editor workbench tooling (module B5). See the matching files under `references/`.

### Usage

Point your assistant's skill loader at `lecture-slides/` — i.e. copy the folder into your skills directory:

```bash
cp -R lecture-slides ~/.workbuddy/skills/lecture-slides   # e.g. for WorkBuddy
```

The skill triggers on requests like "make lecture slides", "unify card styles", "presenter view", "dual progress bar", "offline / self-contained deck", "media boxes are cropped / layout has dead space", "video segment". Manual use is fine too — the CSS, JS, and reference docs are self-explanatory.

## Skill 3 — `polish-slides` (polishing)

Closes the loop between reviewer feedback and a deck project:

1. **Queue** — reads `status: "unsolved"` records from the project's feedback history file (each record carries `sess` / `sid` / `page` / `type` and the raw comment text).
2. **Enhance** — every comment is first passed through the `prompt-optimizer` skill to produce a specific, verifiable edit instruction (mandatory step).
3. **Route** — four comment types map to concrete targets: `ppt` → the deck content module's slide HTML; `script` → the bilingual speaker script (English first, then Chinese, sentence-aligned); `insert-before` / `insert-after` → a new page inserted into both deck and script.
4. **Rewrite** — comments are treated as content points, not literal text: extract the point, write plain simple English, then translate sentence-by-sentence into Chinese. Comments containing YouTube/Bilibili links trigger the `video-download` skill first — no external iframes, offline containment is a hard rule.
5. **Verify** — rebuilds the deck and runs the project's acceptance scripts; then marks each successfully fixed record `solved` with a timestamp (atomic write-back).

### Usage

```bash
# in a shell where your assistant can invoke skills, from the course project root
polish-slides <课程根>/02-script/data/feedback-history.json
```

Run it from the course project directory, passing the path of the feedback history file (the lecturer-side export button copies exactly this kind of path — `<课程根>` is a placeholder for the course root directory). The skill reads all unsolved records as its task queue.

## Skill 4 — `deploy-slides` (deploying)

Runs the end-to-end publish pipeline for a course deck project, as a seven-stage, idempotent, replayable workflow:

1. **Stage 0–4** — environment/key check, rebuild the deploy mirror from the authoritative source, then trim videos (`trims.json`), slim referenced images to WebP, and re-compress untouched high-bitrate originals — all inside the deploy mirror only; the source never changes.
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

## Verified on

A production 30-slide CJK deck: 114 media assets, 1073-char CJK+Latin charset.
Acceptance: offline reproduce PASS (zero external requests, 100% glyph coverage, zero text-element reflow), presenter view 32/32 HTTP + 4/4 `file://` assertions. The `deploy-slides` pipeline was exercised end-to-end on the same course project (media slimming, COS sync, homepage publish and online acceptance all green).

# lecture-slides

Two independent agent skills for building and polishing **HTML lecture slides**:

| Skill | Directory | What it does |
|---|---|---|
| `lecture-slides` | [`lecture-slides/`](./lecture-slides/) | Builds decks in one visual system (04-magazine editorial style) with a Keynote-style presenter view and fully offline, self-contained output. |
| `polish-slides` | [`polish-slides/`](./polish-slides/) | Runs the feedback loop on an existing deck project: reads a queue of unsolved review comments, routes them to the deck and its bilingual speaker script, rebuilds, verifies, and closes the resolved items. |

Each directory is a complete skill in the standard agent-skills format (`SKILL.md` + `assets/` + `references/` + `scripts/`). They are independent: `polish-slides` does not depend on this repo's `lecture-slides` skill. Both expect an HTML-slide workflow; `polish-slides` is written for a specific course scaffold (`session{N}_content.py` content modules, `session{N}.json` speaker scripts, `02-script/` front end) but its routing rules generalize to any deck + bilingual-script project.

## Repository layout

```
README.md                        # this file
lecture-slides/                  # skill 1: building slides
  SKILL.md                       # entry: triggers, module workflow, pitfalls
  assets/
    magazine-style.css           # 04-magazine skin (drop-in)
    presenter-inject.js          # presenter-view injection script
    presenter-template.html      # presenter window template
  references/
    presenter-mode.md            # message protocol, dual progress bars, self-healing
    reveal-adapter.md            # reveal.js engine adapter
    font-offline.md              # variable-font subsetting + acceptance tests
    segment-editor.md            # video segment editor design (module D)
  scripts/
    verify_nested.mjs            # nested-frame acceptance scan
    subset_fonts.py              # font subsetting template (portable)
    audit_aspect.mjs             # media aspect-ratio audit
    audit_layout.mjs             # layout-balance audit
    test_segeditor.mjs           # segment editor E2E
polish-slides/                   # skill 2: applying review feedback
  SKILL.md                       # entry: queue, routing, rewrite rules, status writes
  scripts/
    export_feedback.mjs          # optional localStorage export helper
```

## Skill 1 — `lecture-slides` (building)

One visual standard, five capabilities:

- **Module A · Editorial style** — full skin CSS: warm paper background, serif display type (Playfair Display + Noto Serif SC), deep-red accent lines, unified card frames ("thin border + 3px top accent + 12px radius + soft shadow"). Pure-CSS `:is()`-based nested-frame reset keeps the accent line on the outermost container only. Zero DOM changes.
- **Module B · Presenter view** — Keynote-style dual-screen: audience fullscreen + presenter window with next-slide preview and speaker notes, synced via `postMessage` (works over `file://`). Two progress bars estimate lecture pace in real time from note scripts: a course-time bar and a per-slide content bar with a fast/slow pace badge.
- **Module C · Offline localization** — self-contained decks: media re-indexed under `media/{images,videos}/`; fonts localized via variable-font subsetting (`pyftsubset`, one woff2 per family, ~0.8 MB for a full CJK deck). Copy the folder to any machine, no network, double-click `index.html`.
- **Module D · Quality gates** — media aspect-ratio audit (container must match the media's real ratio), layout-balance audit, pixel-aligned progressive reveals across pages, a video segment editor with persisted start/end, and a full E2E acceptance.
- **Module E · Layout Doctrine (default)** — the default typography rules distilled from 151 rounds of real layout feedback: media as protagonist (≥80% height), cards aspect-locked and never cropped, brick-layout grids that fill the page edge-to-edge, text in narrow columns, a strict bilingual system (English body, Chinese in fixed footnotes, never inline), progressive reveal animations, sparse pages removed.

### Usage

Point your assistant's skill loader at `lecture-slides/` — i.e. copy the folder into your skills directory:

```bash
cp -R lecture-slides ~/.workbuddy/skills/lecture-slides   # e.g. for WorkBuddy
```

The skill triggers on requests like "make lecture slides", "unify card styles", "presenter view", "dual progress bar", "offline / self-contained deck", "media boxes are cropped / layout has dead space", "video segment". Manual use is fine too — the CSS, JS, and reference docs are self-explanatory.

## Skill 2 — `polish-slides` (polishing)

Closes the loop between reviewer feedback and a deck project:

1. **Queue** — reads `status: "unsolved"` records from the project's feedback history file (each record carries `sess` / `sid` / `page` / `type` and the raw comment text).
2. **Enhance** — every comment is first passed through the `prompt-optimizer` skill to produce a specific, verifiable edit instruction (mandatory step).
3. **Route** — four comment types map to concrete targets: `ppt` → the deck content module's slide HTML; `script` → the bilingual speaker script (English first, then Chinese, sentence-aligned); `insert-before` / `insert-after` → a new page inserted into both deck and script.
4. **Rewrite** — comments are treated as content points, not literal text: extract the point, write plain simple English, then translate sentence-by-sentence into Chinese. Comments containing YouTube/Bilibili links trigger the `video-download` skill first — no external iframes, offline containment is a hard rule.
5. **Verify** — rebuilds the deck and runs the project's acceptance scripts; then marks each successfully fixed record `solved` with a timestamp (atomic write-back).

### Usage

```bash
# in a shell where your assistant can invoke skills
polish-slides lecture-01-introduction/02-script/data/feedback-history.json
```

Run it from the course project directory, passing the path of the feedback history file (the lecturer-side export button copies exactly this kind of path). The skill reads all unsolved records as its task queue.

## Notes

- All internal paths are portable: scripts resolve their own interpreter (`sys.executable`, overridable with `PYTHON_BIN`) and never reference a specific user's home or sync directory.
- Requires Playwright for the acceptance scripts and `fonttools` + `brotli` for font subsetting (installed into whichever Python runs the script).

## Verified on

A production 30-slide CJK deck: 114 media assets, 1073-char CJK+Latin charset.
Acceptance: offline reproduce PASS (zero external requests, 100% glyph coverage, zero text-element reflow), presenter view 32/32 HTTP + 4/4 `file://` assertions.

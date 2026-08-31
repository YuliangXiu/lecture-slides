# lecture-slides

An agent skill for building **HTML lecture slides** — magazine-editorial style, Keynote-style presenter view, and fully offline self-contained decks. Built for [WorkBuddy](https://www.workbuddy.cn)-style AI assistants (Claude Code / agent skills format), but the assets and references are useful for any HTML slide workflow.

## What it does

Three modules, one visual standard (**04-magazine** editorial style — warm paper background, serif display type, deep-red accent lines, rounded cards):

- **Module A · Editorial style** — full skin CSS (`assets/magazine-style.css`): unified card frames ("thin border + 3px top accent + 12px radius + soft shadow"), with `:is()`-based nested-frame reset rules so only the outermost container carries the accent line. Zero DOM changes, pure CSS.
- **Module B · Presenter view** — Keynote-style dual-screen (audience fullscreen + presenter window with next-slide preview and speaker notes), synced via `postMessage` (works over `file://`). Dual progress bars estimate lecture pace in real time from speaker-note scripts (chars-per-minute model): a course-time bar and a content-progress bar with per-slide segments and a fast/slow pace badge.
- **Module C · Offline localization** — make a deck fully self-contained: media assets re-indexed under `media/{images,videos}/` with `page-sequence` naming, and fonts localized via **variable-font subsetting** (`pyftsubset`, one woff2 per family, ~0.8 MB for a full CJK deck). Any computer, no network, double-click `index.html`, identical rendering.

## Repository layout

```
SKILL.md                     # Skill entry: triggers, 3-module workflow, pitfalls
assets/
  magazine-style.css         # Module A skin (drop-in)
  presenter-inject.js        # Module B injection script (open window, protocol, timing)
  presenter-template.html    # Module B presenter window template
references/
  presenter-mode.md          # Protocol table, dual-progress-bar math, self-healing
  reveal-adapter.md          # reveal.js engine adapter notes
  font-offline.md            # VF subsetting workflow + 3-layer acceptance tests
scripts/
  verify_nested.mjs          # Playwright: nested-frame acceptance scan
  subset_fonts.py            # Module C font subsetting template
```

## Usage (agent skill)

Point your assistant's skill loader at this repo's root (or copy the folder into your skills directory). The skill triggers on requests like "make lecture slides", "unify card styles", "presenter view", "dual progress bar", "offline/self-contained deck".

Manual use is fine too — the CSS, JS, and reference docs are self-explanatory.

## Verified on

A production 30-slide CJK deck: 114 media assets, 1073-char CJK+Latin charset.
Acceptance: offline reproduce PASS (zero external requests, 100% glyph coverage, zero text-element reflow), presenter view 32/32 HTTP + 4/4 `file://` assertions.

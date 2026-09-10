<!-- synced from _shared/deck-engine/AUTHORING.md (2026-09-09) -->
# AUTHORING GUIDE — Magazine Editorial deck (fixed 1920×1080 stage)

Engine: fixed 16:9 stage (`.deck-viewport > .deck-stage#deckStage`, 1920×1080, scaled by JS).
NOT reveal.js. Slides are `<section class="slide">` children of the stage; the builder
generates the section/s-wrap/s-page wrapper — your `html` field is the content INSIDE
`<div class="s-wrap">`.

## Slide dict contract
```python
{"layout": "content",          # cover | toc | content | closing | break
 "ttitle": "TOC entry (short EN)",
 "notes":  "spoken EN script for this slide (from session JSON, verbatim)",
 "html":   "…content inside s-wrap…"}
```
- NEVER include `<section>`, `s-wrap`, or `s-page` in html.
- Notes (single source of truth): decks configured with `script.session` bake an EMPTY
  `data-notes=""` and fetch `02-script/data/session{N}.json` at runtime (engine.js
  loadScriptNotes) — set the `notes` field only in independent decks without a script
  config, where it is baked as fallback. For script-less decks deck_builder injects
  `SCRIPT_SESSION = null` and engine.js skips the fetch entirely (baked notes become
  the source, `dataset.notes = 'ok'` immediately — check_deck passes without a JSON).
  Presenter mode reads notes from the deck page
  (postMessage), so it needs the page served over http (file:// fetch is blocked).
- Notes display (engine.js + presenter.html, 2026-09-02): notes are split into
  sentences (`splitNotes`, abbreviation-aware — Dr./e.g./etc. don't break) and
  rendered as one <p> per sentence with a blank line between them — in BOTH the
  deck N-overlay (.deck-notes p) and the presenter script panel (#nbody p). The
  presenter auto-scrolls overflowing notes in proportion to the current page's
  estimated duration (inPage/durs[i]) × speed. e2e compares notes text with
  whitespace stripped (`replace(/\s+/g,'')`) because <p> concatenation drops
  inter-sentence spaces.
- Sentence-splitting hardening (2026-09-02 PM): name initials like
  "Michael J. Black" must NOT split at "J." — rule = standalone single capital
  letter + preceding word capitalized (name) → no split; preceding word
  lowercase (e.g. "part A.") → normal boundary. Guard: if the FOLLOWING word is
  a sentence-starter (Now/And/So/This/...), split anyway (covers "Part B.
  Now..."). GOTCHA: a match() regex without a capture group makes m[1]
  undefined — `/^[A-Z]/.test(undefined)` silently tests the string "undefined"
  (false). Always add the capture group you index.
- Scroll speed bar (2026-09-02 PM): presenter notes header has a range slider
  (×0.5–×3) persisted in localStorage key `DH_notes_scroll_speed` — global
  across all decks/sessions on the same origin (localhost:port; a different
  port = different origin = fresh store). Manual scrolling no longer pauses
  auto-scroll: an anchor {top, frac} is captured during user scroll
  (wheel/touchmove/pointerdown set a flag; the scroll handler records the
  anchor only while the flag is up, debounced 500ms); the auto target becomes
  anchor.top + (frac - anchor.frac) × maxScroll, i.e. scrolling resumes from
  wherever the user left it. Anchor resets on page change. verify_v2.mjs
  covers all of this (11 checks).

## Page skeleton (standard content slide)
```html
<header class="s-head">
  <div class="kicker">SESSION 2 · HISTORY</div>
  <h2 class="s-title">Title of the slide</h2>
  <p class="s-lead">Optional italic subtitle</p>
</header>
<div class="s-body">
  ... blocks (see components) ...
</div>
```

## Budget rules (hard, 1920×1080, padding 96/64/64)
- Usable area: 1728 × ~900 px inside s-wrap (after s-head ≈ 120–170px).
- --fs-body is 22px, blist line-height 1.55 → a bullet line ≈ 34px.
- Safe limits per slide: ≤ 6 bullets (1 line each) OR ≤ 4 bullets (2 lines each)
  + one media row ≤ 420px tall. When in doubt, split content across slides.
- Tables: ≤ 6 rows + header. Cards c2/c3: card text ≤ 5 short lines.
- If a slide is dense, use `.blist.tight` (18px) and shorter phrasing — never shrink
  below 16px anywhere.

## Layout alignment standard (fill-to-bottom 1016, edge alignment)
- **Fill-to-bottom invariant**: a standard content slide's last content element must
  reach `bottom = 1016` (the `.s-wrap` content box bottom = 1080 − 64px bottom padding).
  Achieve it by giving the main body container `flex:1; min-height:0` so it stretches
  to fill `.s-wrap`'s `flex-direction:column`. The `.s-wrap` padding is
  `var(--pad-t) var(--pad-x) 64px` (`--pad-t:58px; --pad-x:84px` default; a print/wide
  media block overrides to `96px/64px`).
- **S1.02 sample grid** (the gold-standard "pixel-aligned" page):
  `.wam { flex:1; min-height:0; display:grid; grid-template-columns:1032px 668px;
  grid-template-rows:280px 280px 1fr; gap:20px 28px }` — explicit px columns/rows, the
  `1fr` last row absorbs leftover height and pushes content flush to the bottom edge.
- **Audit programmatically** (don't eyeball 81 pages): `audit_layout.mjs <session_dir>`
  (archived in the framework) serves the deck over http and walks every page measuring
  the max content `bottom`/`right` vs `TARGET_BOTTOM=1016`. Element-filtering gotchas —
  you MUST exclude or the result is a useless "everything = 1080×1920":
  - `.s-wrap` — the full-height padding wrapper (exclude by class).
  - `.s-page` — the decorative page number, absolutely positioned at bottom-right, would
    falsely report "filled" every time.
  - full-bleed background layers — any element with rect `width ≥ 1900 && height ≥ 1050`.
  - `.scrollrow` inner content — horizontal overflow is by design; keep the `.scrollrow`
    container itself (for its bottom) but skip its children.
  - `.deck-controls` / `.deck-toc` / `.deck-notes` UI chrome.
- **Cold-open cinematic exception (S1 p12–15)**: the "The Main Medium of Intellect /
  The Measure of All Things / The Definition of AGI / The First Step to AGI" sequence is
  a DELIBERATE cinematic "cold open" beat, NOT misalignment. It shares one template:
  centered column `left:296; width:1327`, image `top:161; height:758` (bottom 919),
  caption/foot `top:950` → bottom ≈979, a uniform ~37px gap at the bottom. It is
  internally pixel-consistent; keep the WHOLE sequence consistent if you ever touch one
  page (the 37px gap is breathing room, not a bug — confirmed with the instructor).

## Components (all pre-styled; do NOT invent new CSS)
- Lists: `<ul class="blist">…</ul>` / `.blist.tight`. Bullets auto "§".
- Cards: `<div class="cards c2|c3|c4"><div class="card"><h3>…</h3>…</div></div>`
- Stats: `<div class="statrow"><div class="stat"><div class="num">20</div><div class="lab">open-source repos</div></div>…</div>` (4 cols default)
- Table: `<table class="tbl"><thead>…</thead><tbody>…</tbody></table>`
- Media: `<div class="media-grid fill"><figure><div class="fv"><img src="media/images/9-1.png" alt="…"></div><figcaption>caption</figcaption></figure>…</div>`
  - variants: `.light` (light bg), `.wrap`, `figure.plain` (no frame), `figure.solo`
  - nesting: `.mrow` / `.mcol` for combined layouts
  - videos: `<video src="media/videos/12-1.mp4" data-vid="s012_demo" muted playsinline></video>`
- Quote: `<div class="qbox"><div class="q">"…"</div><div class="who">— <b>Who</b>, context</div></div>`
- Flow: `<div class="flow"><div class="fnode">Images</div><div class="farrow">→</div>…</div>`
- Prompt box (dark mono): `<div class="promptbox">…</div>`
- Bad chips: `<div class="badlist"><span>six fingers</span>…</div>` (auto ✕)
- Tag chips: `<span class="tagchip">3D reconstruction</span>`
- Overview matrix: `.ov > .ov-row > (.ov-rlab + .ov-cell(.tg/.qq))`, bottom `.ov-q`
- Profile: `.pf > .pf-col ×3` (photo+chips | education .pf-item(.t/.o/.d) | jobs, `.hl` = current)
- Compare: `.cmp > .cmp-col` (+ `.me` highlight), lists `.cmp-list`
- Cover: `.cv > .cv-kicker + .cv-band>.cv-title + .cv-meta` (layout="cover", NO s-head)
- TOC page: `.toc > .toc-item(.no/.tx, .on on current)` (layout="toc")
- Closing: `.cls > .cls-title + .cls-grid` (layout="closing")
- Inline SVG diagrams: `<div class="g-html"><svg viewBox="…">…</svg></div>` — keep text ≥ 18px, use `var(--accent)` / `var(--ink)`.
- Reveal animation: add `rv d1…d6` classes to top-level blocks (`rl/rr/rs` variants).

## Media rules (unified layout, 2026-09-03)
Decks live at `…/lecture-NN/03-slides/session-N/`; media and fonts live at the
`03-slides/` level (ONE physical copy per lecture — never inside session dirs):

- fonts:   `03-slides/fonts/fonts.css` (referenced from deck as `../fonts/fonts.css`)
- shared:  cross-session byte-identical assets go to `media/decks/_shared/{images,videos}/<semantic-name>`
- per-session: `media/decks/session-N/images|videos/<page>-<idx>.<ext>`
  (page = 1-based slide number, idx = order on page; subdirs like `hero/`, `lab/` allowed)
- source library (creative archive, never referenced by decks at runtime):
  `media/_source/{history,modern,kepu}/…`
- Index: regenerate `media/INDEX.md` + `media-manifest.json` via
  `03-slides-reorg-tools/gen_index.py <03-slides-root>` after adding media.

In content modules reference assets as (deck sits one level below 03-slides/):

    <img src="../media/decks/session-N/images/9-1.png">
    <img src="../media/decks/_shared/images/smpl.png">
    <video src="../media/decks/session-N/videos/12-1.mp4" data-vid="s012_demo" muted playsinline></video>

Reference by relative path only. No external URLs. No rendering screenshots of old
slides — always re-typeset raw data with components.
- Every figure gets a short figcaption. `alt` always present.
- Videos: add `data-vid` and, if a trim/loop window is needed, an entry in
  `DECK["video_config"]` keyed by that vid: `{"start": 4, "end": 16}` (seconds).

## Voice / language
- All slide text in English. Kicker = short section label (e.g. "SESSION 2 · HISTORY").
- Notes = the spoken script from the session JSON (verbatim `en` field of the slide).

## Build + check loop
```
# 构建器唯一位置：_shared/build/（本目录只放引擎资产，不再放构建脚本）
# 任意 cwd 均可，构建器自动上溯定位 _shared
python3 _shared/build/deck_builder.py <module.py> <out_dir>
NODE_PATH=<含 playwright 的 node_modules 所在目录> \
  <node 可执行文件> \
  _shared/deck-engine/check_deck.mjs <out_dir>
```
check_deck.mjs reports: per-slide overflow (>1080/1920), broken media, JS errors,
missing notes, controls presence. Iterate until "ALL CLEAN".

## Stepped reveal (vstep)
- Mark a slide `"vstep": True` in the content module → builder adds `data-vstep="1"`.
- Two unit modes (engine picks automatically):
  1. **Video mode** (legacy): units = every `<video>`'s `figure`; entry shows only the
     first, next/prev steps through, shown video autoplays, others pause.
  2. **Grouped mode**: put `data-vu="N"` on ANY elements; same N = one group, toggled
     together (e.g. an institution card + its map pin). Units = groups sorted by N.
     Entry shows group 1; next reveals N+1; after the last group, next turns the page.
     Hidden units keep layout space (visibility:hidden, no reflow).
- Grouped units must NOT rely on transform for the reveal (pins etc. keep their own
  transform); the CSS transition is opacity-only.
- `#/N/S` hash and 02-script side frames work unchanged; regen unit counts with
  `python3 _shared/build/gen_deckmeta.py <lecture_root>` (counts max data-vu when present, else <video).

## Keyboard control (arrow keys, 2026-09)
- **↓ / ↑ = current-page animation steps only** (`vstepNext`/`vstepPrev`). On pages
  without vstep units, or already at the first/last step, they do NOTHING — they
  never turn the page.
- **→ / ← = direct page turn** (`go(cur±1)`), skipping any remaining steps on the
  current page.
- Space / PageDown / PageUp keep the legacy combined semantics (step first, page
  turn when steps exhausted) — same as the on-screen prev/next buttons, wheel and
  touch swipe.
- During a page transition (engine `busy` window, 120 ms) all four arrow keys are
  ignored, so fast key repeat cannot double-turn or step into a freshly reset page.
- EMBED mode, segPanel-open state, and INPUT/TEXTAREA focus still swallow all of
  the above (unchanged guard order in the keydown handler).

## Map-with-pins recipe (exact-fit crop)
- Pin (left,top) % are relative to the map container AND assume the image fills it
  exactly. If the container aspect ≠ image aspect, object-fit shifts the geography.
- Deterministic fix: measure the container (W×H px), then pre-crop the image to
  EXACTLY that aspect (PIL center band crop + resize), e.g. 668×250 → aspect 2.672.
  cover == contain, pins stay exact: y_new = (y_old*H_img - cropTop)/cropH*100.
- After cropping, re-check label spans for mutual overlap and container clipping
  (getBoundingClientRect intersection test).

## Logo transparency recipe (white-bg → transparent PNG)
- For dark/colored logos composited on white: alpha = (255 - min(r,g,b))/255, then
  un-premultiply fg = (observed - 255*(1-a))/a. Works for antialiased edges, keeps
  interior whites as transparent ("ink on card" look, no beige-box residue).
- Source logos from slide-library decks: unzip source.pptx ppt/media/*, resolve
  which images a page uses via ppt/slides/_rels/slideN.xml.rels.
- Emblem-only crops (square) read best in small cards; wordmarks go in card text.
- GOTCHA: `ln -sfn src dir` onto an EXISTING dir nests the symlink inside it
  (media/media) — rm the dir first, then `ln -s`.

## Thumbnail gallery recipe (hover + click, ported from <主页域名>)
- Site source of truth: thumbnail.html (MOCK_IMAGES: name→url→link) + css/thumbnail.css.
  Effect = `transition: transform .3s ease` on the img, `.item:hover img { transform:
  scale(1.05) }` cropped by an `overflow:hidden` plate, click opens the paper page.
- In a deck, wrap each figure `<img>` in `<a class="hwl" href="LINK" target="_blank"
  rel="noopener">` with the plate styles on the anchor (display:block + the img's old
  w/h + overflow:hidden). Do the wrap as an IDEMPOTENT post-process at the END of the
  content module (deck_builder imports it), matching only bare hero `<img>` tags so
  re-import can't double-wrap; guard with `if '.hwl:hover img' in html: return html`.
- Hero filenames (hero-1..hero-30 + a/b variants) map 1:1 to the site thumbnail
  numbering → the anchor href is the same publication.html#<slug> (target _blank for
  lecture use; deck stays offline, link activates only on click).

### Advanced: hover to CENTER (zoom to ~60% slide, "蹦到 slide 中间")
- When you want the hovered thumb to pop out and CENTER itself on the 1920×1080 slide
  (instead of scaling in place), use:
  `.hwl:hover img { position:fixed; left:50%; top:50%;
  transform:translate(-50%,-50%) scale(var(--hz)); transform-origin:center;
  z-index:9999; box-shadow:0 28px 72px rgba(0,0,0,.38);
  animation:hwl-pop .2s ease }`
  `@keyframes hwl-pop { from { transform:translate(-50%,-50%) scale(1) }
  to { transform:translate(-50%,-50%) scale(var(--hz)) } }`
- **Why it centers**: `.deck-stage` carries `transform: translate(x,y) scale(f)` (set by
  engine.js `fit()`), so `.deck-stage` becomes the containing block for `position:fixed`
  descendants → `left/top:50%` resolves against the 1920×1080 stage, and
  `translate(-50%,-50%)` centers it exactly.
- **CRITICAL pitfall**: the img must use an explicit `width:{w}px;height:{h}px`, NEVER
  `width:100%/height:100%`. Under `position:fixed`, a percentage width re-resolves to the
  containing block (1920×1080) instead of the anchor, so the thumb first fills the whole
  slide then ×`--hz` blows up to hundreds of percent (observed 13420px wide). Explicit px
  keeps `translate(-50%,-50%)` resolving to 50% of the thumb's own size.
- `--hz = round(min(1152/w, 648/h), 2)` (1152×648 = 60% of 1920×1080) caps any aspect
  ratio at ≤60% of the slide, no overflow.
- Use a `@keyframes` zoom (scale 1 → scale(--hz), always centered) instead of
  `transition: transform`: a plain transition interpolates from the identity matrix and
  produces an ugly "fly-then-scale" trajectory. Leaving hover restores instantly (no
  reverse animation), which reads as a crisp pop.

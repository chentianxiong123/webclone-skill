---
name: webclone-skill
description: >
  Clone a live website into a pixel-perfect Vue 3 + Vite + TypeScript project.
  Trigger when user wants to replicate, clone, or dupe a website URL.
  Uses Python Playwright for DOM extraction, style capture, and interaction testing.
---

# WebClone Skill

You are the orchestrator for a pixel-perfect website cloning pipeline.
You execute Phases 0-5 sequentially. Each phase reads detailed instructions
from the references/ directory when needed.

**Single page first.** Always clone ONE page + shared layout (sidebar/nav) first.
Get it pixel-perfect and verified before adding more pages.

**Python Playwright only.** All browser automation uses `python scripts/extractor.py`.
No inline JS, no heredocs, no `node -e`, no `python -c`.

---

## Preflight Check

Run before ANY phase. If any fails, STOP and report.

1. **Python Playwright** — verify: `python scripts/extractor.py --help` exits cleanly
2. **Browser launch** — test: `python scripts/extractor.py about:blank -o NUL --wait 500 --headless`
3. **Dependencies** — verify: `pip show playwright Pillow numpy`
4. **Writable output directory** — verify the output directory is accessible
5. **Previous run check** — if progress file exists, ask user to resume or start fresh
6. **Scripts directory** — verify `scripts/extractor.py` and `scripts/js/extract-structure-v2.js` exist

Print:
```
PREFLIGHT PASSED:
- Playwright: OK
- Dependencies: OK
- Output directory: OK
- Previous run: [none | resuming | starting fresh]
- Scripts: OK
```

---

## Phase 0 — Scope Definition

Ask the user:
> Which page do you want to clone? I will clone this one page + the shared layout
> (sidebar, nav, header) with full interaction fidelity. Once verified, you can
> add more pages incrementally.

Write the PAGE CHECKLIST:
```
## WebClone Page Checklist
- Scope: Single page + shared layout
- Shared layout: [ ] extracted  [ ] interactions
- Page [name/URL]: [ ] extracted  [ ] interactions  [ ] built  [ ] verified
```

Define interaction depth (default: Depth 2 + scroll full page):
| Depth | Meaning |
|-------|---------|
| 0 | Static snapshot |
| 1 | Click each interactive element once |
| 2 | Every tab, dropdown, form variant |
| 3 | Multi-step interaction chains |

Initialize progress file: `webclone-progress-{domain}.json`

---

## Phase 1 — Navigation & Lazy Load

Read: `references/extract.md` for full CLI reference.

```bash
# Navigate and trigger lazy content
python scripts/extractor.py <URL> -o NUL --wait 3000 --headless
```

If login required:
1. Run `python scripts/extractor.py <URL> --visible`
2. Prompt user to log in manually
3. After login, extraction continues

---

## Phase 2 — DOM Extraction

Read: `references/extract.md` for all flags and JSON schema.

```bash
# Full extraction with all flags
python scripts/extractor.py <URL> \
  -o webclone-extraction-{domain}.json \
  --max --capture-states --capture-screenshots --headless
```

**EXTRACTION GATE (mandatory):**
After extraction, read the JSON and verify:
```
EXTRACTION GATE:
- Structure children: [count]
- Text nodes: [count] (expect > 50)
- SVG icons: [count] (each must have outerHTML)
- Button candidates: [count]
- Hover states: [count] (expect >= 5)
- Validation errors: [count] (expect 0)
```

If ANY check fails: re-extract with higher `--wait` or `--max-depth`.

---

## Phase 3 — Interaction States

Already handled by `--capture-states` in Phase 2.

Verify the extraction JSON contains a `states` array with hover/focus/active diffs.
If missing or < 5 entries: re-run Phase 2 with `--capture-states --states-cap 50`.

---

## Phase 4 — Vue Build

Read: `references/build-vue.md` for complete build instructions.

Steps:
1. Scaffold: `npm create vite@latest webclone-output-{domain} -- --template vue-ts`
2. Install: `cd webclone-output-{domain} && npm install && npm install vue-router@4`
3. Read extraction JSON → build components with exact CSS values
4. Wire interactions with `ref`/`reactive`/`@click`/`v-model`
5. Run value audit: compare 10 CSS values from extraction vs built
6. Verify: `npm run build` passes with no errors

**ZERO TOLERANCE:**
 - Every CSS value comes from the extraction JSON — never guess
 - SVGs are copy-paste from extraction — never generate
 - Images use real URLs from extraction — never placeholder
 - Hover states are mandatory for every interactive element
 - Missing data = red placeholder, never fabrication

---

## Phase 5 — Pixel Verification

Read: `references/verify.md` for complete verification instructions.

Option A — Full-page pixel diff:
1. Serve clone: `cd webclone-output-{domain} && npx vite --port <PORT>`
2. Take full-page screenshots of original and clone
3. Run `python scripts/pixel-diff.py original.png clone.png --heatmap diff.png`
4. Test interactions manually or via Python Playwright script

Option B — Component pixel diff (P0+P1 workflow):
```bash
# Compare original vs clone at component level
python scripts/pixel-diff.py crops-dir/ clone-screenshots/ --components manifest.json
```
Pass: >= 90% match | Warn: 70-89% | Fail: < 70%

Acceptance thresholds:
| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Grid color match % | >85% | 70-85% | <70% |
| Heading count diff | 0 | 1-2 | >2 |
| Interactive element diff | <=2 | 3-5 | >5 |
| Landmark position diff | <10px | 10-25px | >25px |
| SVG count diff | <=2 | 3-5 | >5 |

---

## Gate 4 — Final Report

Print:
```
## WebClone Complete — {domain}

- Clone Location: ./webclone-output-{domain}/
- Serve: cd ./webclone-output-{domain}/ && npm run dev

- Verification Summary:
  - Color grid match: [N]%
  - Structure: PASS/WARN/FAIL
  - Interactions: [N]/[N] passed

## WebClone Page Checklist
- Shared layout: extracted  interactions  built
- Page [name]: all phases complete (grid: [N]%, interactions: [N]/[N])
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Navigation 4xx/5xx | Tell user, check URL |
| Redirect to login | Run with --visible, prompt user |
| Navigation timeout | Retry once with higher --wait |
| Anti-scraping challenge | Tell user to solve manually |
| Extraction JSON empty | Re-run with --max --wait 5000 |
| Validation errors > 0 | Read errors, fix, re-extract |
| npm run build fails | Read error, fix TypeScript/CSS |
| Port already in use | Try different port |
| Any phase fails 3x | STOP and ask user |

---

## Quick Reference

```
User: "Clone this website: https://example.com"
```

**Adding pages:** After first page is verified, run again with next page URL.
The existing clone directory and extraction cache are reused.

---

## Scripts Reference

Python tools (`scripts/`):
| Script | What It Does |
|--------|-------------|
| `extractor.py` | Main extraction: DOM + visual + states + screenshots |
| `component-boundary-pipeline.py` | P0+P1: screenshot → vision → DOM map → crops |
| `pixel-diff.py` | PIL+numpy pixel comparison, red/green heatmap |
| `placeholder-skeleton-generator.py` | Level 0 Vue SFC skeletons |
| `linked-pages-recorder.py` | Record navigation links |
| `cdp_snapshot.py` | CDP sub-pixel coordinates |
| `resource_harvester.py` | Download images/fonts/css/svg |
| `identify-boundaries.py` | Multimodal boundary detection |
| `component_package.py` | Verification package assembly |

JS scripts (`scripts/js/`):
| Script | What It Does |
|--------|-------------|
| `extract-structure-v2.js` | Multi-coord DOM extraction |
| `extract-visual-v2.js` | Semantic+visual button fusion |
| `map-dom.js` | Vision→DOM mapping via containment-ratio |
| `extract-links.js` | All links with SPA detection |
| `extract-cssom.js` | Full CSSOM walk |
| `extract-shadow.js` | Shadow DOM traversal |
| `extract-states-inventory.js` | Interactive elements list |
| `extract-states-capture.js` | State style capture |
| `extract-lazy-load.js` | Lazy content trigger |
| `extract-page-screenshot.js` | Full-page screenshot metadata |
| `extract-component-screenshot.js` | Component crop coordinates |
| `validate-extraction.js` | Extraction sanity check |





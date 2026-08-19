---
name: clone-website
description: Reverse-engineer and clone websites with an automated data-extraction pipeline and AI agent code generation. Uses web-clone engine to snapshot + proxy the target page first, then all extraction runs against the local snapshot — bypassing login walls and anti-scraping. Produces pixel-perfect HTML/CSS/JS clones or Next.js components.
argument-hint: "<url1> [<url2> ...]"
user-invocable: true
---

# Clone Website

You are about to reverse-engineer and clone **$ARGUMENTS** as pixel-perfect, functional replicas.

**Core strategy: snapshot first, then extract locally.** web-clone downloads the page + all assets + API proxy as a fully offline static snapshot. Every extraction script runs against `http://localhost:8080/` — the local snapshot — never the live URL. This bypasses login walls, anti-scraping, and rate limits entirely.

---

## Guiding Principles

### 1. Data Before Code
Never guess a CSS value, spacing, or color. Extraction scripts produce exact `getComputedStyle()` values. Fabricated values fail pixel-diff.

### 2. Snapshot Is the Source of Truth
The local snapshot (`http://localhost:8080/`) is the reference for ALL subsequent steps. All extraction, screenshot, verification commands use the snapshot URL — never the live URL.

### 3. Spec Files Are the Contract
Every component gets a `.spec.md` file BEFORE any builder is dispatched. If a builder has to guess anything, extraction was incomplete.

### 4. Extract Behavior, Not Just Appearance
Capture both the visual state AND the transition (duration, easing, trigger).

### 5. Build Must Always Compile
Every generated file passes `npm run build` before completion.

---

## Phase 0 — Preflight

```bash
node --version          # >= 20.0.0
pnpm --version
cd /tmp/webclone-skill
pnpm install
pnpm build
```

**PREFLIGHT GATE:** All checks pass.

---

## Phase 1 — Snapshot & Serve (下载 + 启动本地服务器)

**Step 1a: Download the page as a static snapshot.**

```bash
cd /tmp/webclone-skill

pnpm dev:cli <URL> \
  -o ./snapshot \
  --adapter playwright \
  --executable-path /usr/bin/google-chrome \
  --scan-depth 2 \
  --max-assets 200 \
  --concurrency 6
```

This downloads the HTML, all CSS/JS/images/assets, and preserves the full page structure. The API proxy records any dynamic endpoints used.

**Step 1b: Start the snapshot server (serves locally on port 8080).**

```bash
cd /tmp/webclone-skill/snapshot
PORT=8080 node server.js &
```

Verify: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` → returns 200.

**Step 1c: Run ALL extraction scripts against the local snapshot.**

```bash
# Set local URL once
LOCAL_URL=http://localhost:8080/

# DOM tree + bounding rects + computed styles
node scripts/js/extract-structure-v2.js $LOCAL_URL

# Full CSSOM walk (all CSS rules)
node scripts/js/extract-cssom.js $LOCAL_URL

# Interactive elements inventory
node scripts/js/extract-states-inventory.js $LOCAL_URL

# Hover/focus/active state CSS diffs
node scripts/js/extract-states-capture.js $LOCAL_URL

# Full-page screenshot at 3 viewports
node scripts/js/extract-page-screenshot.js $LOCAL_URL

# Links extraction
node scripts/js/extract-links.js $LOCAL_URL

# Shadow DOM extraction
node scripts/js/extract-shadow.js $LOCAL_URL

# Component screenshots
node scripts/js/extract-component-screenshot.js $LOCAL_URL

# Visual extraction
node scripts/js/extract-visual-v2.js $LOCAL_URL

# Lazy load detection
node scripts/js/extract-lazy-load.js $LOCAL_URL

# DOM mapping
node scripts/js/map-dom.js $LOCAL_URL

# Validate all extraction results
node scripts/js/validate-extraction.js $LOCAL_URL
```

All scripts output structured JSON files. These are the raw data for Phase 2-3.

**SNAPSHOT GATE:**
- Port 8080 returns 200
- `extract-structure-v2.js` produces DOM tree with bounding rects
- `extract-cssom.js` produces CSS rules (>100)
- `extract-states-inventory.js` produces interactive elements (>0)

---

## Phase 2 — Inspection & Topology

Analyze the extracted JSON files to map the page structure. Read the DOM tree, CSS rules, and interaction records.

**Write two spec files** in `<app-root>/docs/research/<site-key>/<page-key>/`:

### `PAGE_TOPOLOGY.md`
Map every distinct section from the DOM tree:
- Visual order (by y-coordinate from bounding rects)
- Fixed/sticky overlays vs flow content
- Column structure and z-index layers
- Interaction model per section (static/click/scroll/time-driven)

### `BEHAVIORS.md`
Record every behavior from `extract-states-capture.js` output:
- Scroll-triggered changes (before/after CSS values, trigger position)
- Click-driven tabs/pills (state per click, content changes)
- Hover states (CSS property changes, transition timing)
- Responsive breakpoints (from `extract-visual-v2.js`)

---

## Phase 3 — Component Spec Files

For each section in PAGE_TOPOLOGY, write a component spec:

**Path:** `docs/research/<site-key>/<page-key>/components/<ComponentName>.spec.md`

**Template:**

```markdown
# <ComponentName> Specification

## Overview
- **Target file:** `<output>/<ComponentName>.tsx` or `<output>/components/<ComponentName>.vue`
- **Screenshot:** `docs/design-references/<site-key>/<page-key>/<name>.png`
- **Interaction model:** <static | click-driven | scroll-driven | time-driven>

## DOM Structure
<From extract-structure-v2.js output — exact tag/class hierarchy>

## Computed Styles (exact values from extract-cssom.js)

### Container
- display: ...
- padding: ...
- background: ...

### <Child>
- fontSize: ...
- color: ...

## States & Behaviors
<From extract-states-capture.js output — exact before/after CSS diffs>

## Assets
- Image: <from snapshot, use local path>
- Icons: <from DOM tree>

## Text Content (verbatim)
<From DOM tree — exact textContent>

## Responsive
<From extract-visual-v2.js — layout changes per viewport>
```

---

## Phase 4 — Code Generation

Choose your output target:

### Option A: Standalone HTML/CSS/JS (fastest)
```bash
node scripts/js/generate-source.mjs -o ./output
```
Reads all Phase 1 extraction JSON files and generates a single `index.html` + `server.js`.

### Option B: Vue 3 + TypeScript Project
```bash
pnpm dev:cli ./snapshot \
  -o ./output \
  --convert-local \
  --codegen-framework vue \
  --codegen-typescript \
  --codegen-generate-drafts
```

### Option C: Next.js (JCodesMore pattern)
Write TypeScript components per spec files using `templates/nextjs-clone/`.

**CODEGEN GATE:** Build passes. All CSS values match extraction JSON.

---

## Phase 5 — Verification

### 5a. Serve both pages
```bash
# Original (already running from Phase 1)
# http://localhost:8080/

# Clone
cd ./output && npx vite --port 3001
```

### 5b. Pixel diff
```bash
# Screenshot snapshot at 1440px
# Screenshot clone at 1440px
python scripts/python/pixel-diff.py original.png clone.png --heatmap diff.png
```

### 5c. Acceptance thresholds

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Pixel diff % | <10% | 10-25% | >25% |
| CSS value accuracy | 100% | 90-99% | <90% |

---

## Error Handling

| Error | Action |
|-------|--------|
| Snapshot fails | Increase `--scan-depth 3` or `--max-assets 500` |
| Port 8080 in use | Use `PORT=8081 node server.js` |
| Extraction empty | Check server.js is running, re-run extraction |
| Codegen build fails | Fix TypeScript errors |
| Phase fails 3x | **STOP** and ask user |

---

## Quick Reference

```
User: "Clone https://fanyi.baidu.com"

Phase 0: pnpm build
Phase 1: pnpm dev:cli <URL> -o ./snapshot --serve &
         node scripts/js/*.js http://localhost:8080/    (13 scripts)
Phase 2: Write PAGE_TOPOLOGY.md + BEHAVIORS.md
Phase 3: Write <Component>.spec.md per section
Phase 4: node scripts/js/generate-source.mjs -o ./output
Phase 5: python scripts/python/pixel-diff.py orig.png clone.png
```

---

## Scripts Reference

| Script | Purpose | Input |
|--------|---------|-------|
| `pnpm dev:cli <URL> -o out --adapter playwright --serve` | Snapshot + download + start server | Live URL |
| `scripts/js/extract-structure-v2.js` | DOM tree + bounding rects | Local URL |
| `scripts/js/extract-cssom.js` | Full CSSOM walk | Local URL |
| `scripts/js/extract-states-capture.js` | Hover/focus/active state diffs | Local URL |
| `scripts/js/generate-source.mjs` | Standalone HTML/CSS/JS generation | Extraction JSON |
| `scripts/python/pixel-diff.py` | Visual diff comparison | 2 PNG files |

---

## Completion Report

```
## Clone Complete

- Source: <URL>
- Snapshot: ./snapshot/ (http://localhost:8080/)
- Extraction data: 13 JSON files
- Output: ./output/
- Sections built: <N>
- Spec files written: <N>
- Pixel diff: <N>%
- Build status: PASS/FAIL
```
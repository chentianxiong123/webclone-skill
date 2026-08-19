---
name: clone-website
description: Reverse-engineer and clone websites with an automated data-extraction pipeline and AI agent code generation. Uses web-clone engine for snapshot + deep JS extraction scripts + JCodesMore-style spec-driven agent dispatch. Produces pixel-perfect HTML/CSS/JS clones or Next.js components.
argument-hint: "<url1> [<url2> ...]"
user-invocable: true
---

# Clone Website

You are about to reverse-engineer and clone **$ARGUMENTS** as pixel-perfect, functional replicas.

This skill combines two capabilities:
1. **Automated data extraction** — web-clone engine + 17 deep Playwright scripts that capture DOM tree, computed styles, CSSOM, interactions, and behavior states as structured JSON
2. **Spec-driven AI agent code generation** — following JCodesMore's methodology: extract everything first, write auditable spec files, then dispatch builder agents with exact values

## Guiding Principles

These truths separate a successful clone from a "close enough" mess:

### 1. Data Before Code
Never guess a CSS value, spacing, or color. The extraction scripts produce exact `getComputedStyle()` values. If the data says `padding: 16px 20px 0px 24px`, that's what goes in the code. Fabricated values fail pixel-diff.

### 2. Spec Files Are the Contract
Every component gets a `.spec.md` file BEFORE any builder is dispatched. The spec contains DOM structure, exact computed styles, all interaction states, and real text content. If a builder has to guess anything, extraction was incomplete.

### 3. Small Tasks, Perfect Results
A section with 3+ distinct sub-components gets broken into separate builders. Rule of thumb: if the builder prompt exceeds ~150 lines of spec content, split it.

### 4. Extract Behavior, Not Just Appearance
A website is a living thing. Elements move, change, appear, and disappear on scroll, hover, click, and time. Capture both the visual state AND the transition (duration, easing, trigger).

### 5. Build Must Always Compile
Every generated file passes `npm run build` before completion. A broken build is never acceptable.

---

## Phase 0 — Preflight

Run all checks. If any fails, **STOP** and report.

```bash
node --version          # >= 20.0.0
pnpm --version
pnpm install
pnpm build
```

**PREFLIGHT GATE:** All checks pass before proceeding.

---

## Phase 1 — Snapshot (Automated Data Collection)

Use the web-clone engine to download the page and all resources:

```bash
cd /tmp/webclone-skill

pnpm dev:cli <URL> \
  -o ./snapshot \
  --adapter playwright \
  --executable-path /usr/bin/google-chrome \
  --extract-components \
  --max-assets 200 \
  --concurrency 6
```

Run deep extraction scripts on the live page:

```bash
# DOM tree + bounding rects + computed styles
node scripts/js/extract-structure-v2.js <URL>

# Full CSSOM walk (all 13k+ CSS rules)
node scripts/js/extract-cssom.js <URL>

# Interactive elements inventory
node scripts/js/extract-states-inventory.js <URL>

# Hover/focus/active state CSS diffs
node scripts/js/extract-states-capture.js <URL>

# Page screenshot
node scripts/js/extract-page-screenshot.js <URL>
```

**SNAPSHOT GATE:** Assets downloaded > 0, DOM tree captured, CSSOM complete, interactive elements found.

---

## Phase 2 — Inspection & Topology

Analyze extracted data to map the page:

```bash
# Page structure overview
pnpm dev:cli inspect <URL> --outline

# Find specific elements
pnpm dev:cli inspect <URL> --locate "Search"
```

**Write two spec files** in `<app-root>/docs/research/<site-key>/<page-key>/`:

### `PAGE_TOPOLOGY.md`
Map every distinct section: visual order, fixed/sticky overlays, column structure, z-index layers, interaction model (static/click/scroll/time-driven).

### `BEHAVIORS.md`
Record every observed behavior:
- Scroll-triggered header changes (trigger position, before/after styles, transition)
- Click-driven tabs/pills (state per tab, content changes)
- Hover states (property changes, transition timing)
- Responsive breakpoints (1440px → 768px → 390px layout changes)
- Scroll-driven animations (IntersectionObserver thresholds, keyframes)

---

## Phase 3 — Component Spec Files

For each section in PAGE_TOPOLOGY, write a component spec file:

**Path:** `docs/research/<site-key>/<page-key>/components/<ComponentName>.spec.md`

**Template:**

```markdown
# <ComponentName> Specification

## Overview
- **Target file:** `src/components/sites/<site-key>/<page-key>/<ComponentName>.tsx`
- **Screenshot:** `docs/design-references/<site-key>/<page-key>/<name>.png`
- **Interaction model:** <static | click-driven | scroll-driven | time-driven>

## DOM Structure
<Describe the element hierarchy>

## Computed Styles (exact values from getComputedStyle)

### Container
- display: ...
- padding: ...
- background: ...
- (every relevant property)

### <Child>
- fontSize: ...
- color: ...
- ...

## States & Behaviors

### <Behavior name>
- **Trigger:** <scroll position 50px | click .tab | hover>
- **State A (before):** property: value → **State B (after):** property: value
- **Transition:** transition: all 0.3s ease
- **Implementation:** <CSS transition + listener | IntersectionObserver>

### Hover states
- <Element>: <property>: <before> → <after>, transition: <value>

## Assets
- Image: public/sites/<site-key>/<page-key>/images/<file>.webp
- Icons: <IconComponent> from shared icons module

## Text Content (verbatim)
<All text from live site>

## Responsive
- **Desktop (1440px):** <layout>
- **Tablet (768px):** <what changes>
- **Mobile (390px):** <what changes>
```

---

## Phase 4 — Code Generation

Choose your output target:

### Option A: Standalone HTML/CSS/JS (fastest, zero dependencies)
```bash
node scripts/js/generate-source.mjs <URL> -o ./output
```
Produces a single `index.html` + `server.js` that works standalone.

### Option B: Vue 3 + TypeScript Project
```bash
pnpm dev:cli <URL> \
  -o ./output \
  --extract-components \
  --codegen-framework vue \
  --codegen-typescript \
  --codegen-generate-drafts
```

### Option C: Next.js (JCodesMore pattern)
Write TypeScript components per spec files using the `templates/nextjs-clone/` scaffold. Dispatch builder agents per component.

**CODEGEN GATE:** Build passes. All CSS values match extraction JSON. Images use real URLs.

---

## Phase 5 — Verification

### 5a. Serve both pages
```bash
# Serve original
cd ./snapshot && node server.js &          # port 8080

# Serve clone
cd ./output && npm run dev                  # or npx vite
```

### 5b. Pixel diff
```bash
python scripts/python/pixel-diff.py \
  --original original.png \
  --clone clone.png \
  --heatmap diff.png
```

### 5c. Acceptance thresholds

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Pixel diff % | <10% | 10-25% | >25% |
| Interactive element diff | <=2 | 3-5 | >5 |
| CSS value accuracy | 100% | 90-99% | <90% |

### 5d. Interaction test
```bash
python scripts/python/test-interactions.py --url http://localhost:3001
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Navigation timeout | Retry with `--timeout 30000` |
| Anti-scraping | Use `--adapter playwright --headed` |
| Component extraction empty | Increase `--component-depth 8` or `--memory-limit 4096` |
| Codegen build fails | Fix TypeScript errors |
| Phase fails 3x | **STOP** and ask user |

---

## Quick Reference

```
User: "Clone https://fanyi.baidu.com"
Agent: Phase 0 → 1 → 2 → 3 → 4 → 5, sequentially with GATE checks.
```

### Scripts Reference

| Script | Purpose |
|--------|---------|
| `pnpm dev:cli <URL> -o out --adapter playwright` | Snapshot + resource download |
| `scripts/js/extract-structure-v2.js <URL>` | DOM tree + bounding rects |
| `scripts/js/extract-cssom.js <URL>` | Full CSSOM walk |
| `scripts/js/extract-states-capture.js <URL>` | Hover/focus/active state diffs |
| `scripts/js/generate-source.mjs <URL> -o out` | Standalone HTML/CSS/JS generation |
| `scripts/python/pixel-diff.py orig clone` | Visual diff comparison |

---

## What NOT to Do

- Don't guess CSS values — extract them
- Don't dispatch a builder without a spec file
- Don't give one builder more than 150 lines of spec
- Don't extract only default state — capture all states
- Don't skip asset extraction — without real images, clones look fake
- Don't declare complete before pixel-diff passes

---

## Completion Report

```
## Clone Complete

- Source: <URL>
- Output: <path>
- Sections built: <N>
- Components created: <N>
- Spec files written: <N>
- Assets downloaded: <N>
- Pixel diff: <N>%
- Build status: PASS/FAIL
- Known gaps: <list>
```
# web-clone-skill

**像素级网页克隆 Agent Skill** — 基于 `@web-clone/core` 引擎，Agent 自动编排从抓取到代码生成的完整 pipeline。

Uses the `web-clone` monorepo (TypeScript) as the engine, wrapped with Agent-phase orchestration.
Extends with pixel-diff verification, interaction state capture, and the 12 deep DOM extraction JS scripts.

---

## Agent Quick Start

When user says "clone this website: https://example.com", execute **Phase 0 → Phase 5** sequentially.
Do NOT skip any phase. Do NOT skip any GATE check.

**Single page first.** Always clone ONE page + shared layout (sidebar/nav) before adding more pages.

---

## Phase 0 — Preflight

Run all checks. If any fails, **STOP** and report.

```bash
# 0a. Check Node version
node --version  # must be >= 20.0.0

# 0b. Check pnpm
pnpm --version

# 0c. Install dependencies (first run only)
pnpm install

# 0d. Install Playwright browsers
pnpm browsers:install

# 0e. Verify CLI works
pnpm dev:cli --help

# 0f. Check writable output dir
touch ./webclone-output/.probe && rm ./webclone-output/.probe
```

Print:
```
PREFLIGHT PASSED:
- Node: >=20.0.0 OK
- pnpm: OK
- Dependencies: installed
- Playwright: OK
- Output dir: writable
- Previous run: [none | resuming | starting fresh]
```

---

## Phase 1 — Snapshot (抓取 + 资源下载)

Read: `references/snapshot.md` for full CLI reference.

```bash
pnpm dev:cli <URL> \
  -o ./snapshot \
  --adapter playwright \
  --extract-components \
  --max-assets 200 \
  --concurrency 6 \
  --timeout 15000
```

**SNAPSHOT GATE (mandatory):**

After snapshot completes, run validation:

```bash
pnpm dev:cli ./snapshot --validate
```

Check:
- Total assets downloaded > 0
- HTML snapshot file exists and non-empty
- Validation errors: expect 0

If any check fails: re-run with `--retry-count 3` or higher `--max-assets`.

---

## Phase 2 — Inspect (页面分析)

Read: `references/inspect.md`.

```bash
# Page summary
pnpm dev:cli inspect <URL>

# Structure outline (find repeating patterns = component candidates)
pnpm dev:cli inspect <URL> --outline

# Convert to markdown for quick review
pnpm dev:cli inspect <URL> --md --budget 2000

# Locate specific elements
pnpm dev:cli inspect <URL> --locate "Search"
```

**INSPECT GATE:**
- Confirm whether page is SPA or SSR
- Record page title, element count, script count
- Identify 3-5 candidate component selectors for Phase 3

---

## Phase 3 — Deep Extraction (深度提取)

Two sub-steps:

### 3a. Structured Query (结构化数据提取)

Read: `references/query.md`.

```bash
# Extract all links with SPA detection
node scripts/js/extract-links.js <URL>

# Extract full CSSOM
node scripts/js/extract-cssom.js <URL>

# Extract interactive elements
node scripts/js/extract-states-inventory.js <URL>

# Extract hover/focus/active states
node scripts/js/extract-states-capture.js <URL>
```

### 3b. Component Extraction (via web-clone engine)

```bash
pnpm dev:cli <URL> \
  -o ./snapshot \
  --extract-components \
  --component-depth 5 \
  --memory-limit 2048
```

**EXTRACTION GATE:**
- Component count > 0
- Interactive element candidates > 0
- States captured >= 5 (hover/focus/active diffs)
- CSSOM extracted completely
- SVG elements counted with outerHTML preserved

---

## Phase 4 — Code Generation (框架代码生成)

Read: `references/codegen.md`.

```bash
# Generate Vue 3 + TypeScript project
pnpm dev:cli <URL> \
  -o ./output \
  --extract-components \
  --codegen-framework vue \
  --codegen-typescript \
  --codegen-generate-drafts \
  --codegen-extract-shared
```

Available frameworks: `vue`, `react`, `angular`, `svelte`, `jquery`

**CODEGEN GATE:**
- `npm run build` in generated project passes with 0 errors
- All generated components have valid TypeScript types
- CSS values match extraction JSON exactly (no fabrication)
- SVGs are copy-paste from extraction (never generated)
- Images use real URLs (never placeholder)

---

## Phase 5 — Verification (像素验证 + 交互测试)

Read: `references/verify.md`.

### 5a. Serve both original and clone

```bash
# Start clone server
cd ./output/__drafts__ && npx vite --port 3001
```

### 5b. Pixel diff

```python
python scripts/python/pixel-diff.py original.png clone.png --heatmap diff.png
```

### 5c. Acceptance thresholds

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Grid color match % | >85% | 70-85% | <70% |
| Heading count diff | 0 | 1-2 | >2 |
| Interactive element diff | <=2 | 3-5 | >5 |
| Landmark position diff | <10px | 10-25px | >25px |
| SVG count diff | <=2 | 3-5 | >5 |
| CSS value accuracy | 100% | 90-99% | <90% |

### 5d. Interaction test (Playwright)

```bash
node scripts/python/test-interactions.py --url http://localhost:3001
```

---

## Gate — Final Report

Print:

```
## WebClone Complete — {domain}

- Snapshot: ./snapshot/
- Generated Code: ./output/
- Serve: cd ./output/__drafts__ && npm run dev

- Verification Summary:
  - Color grid match: [N]%
  - Structure: PASS/WARN/FAIL
  - Interactions: [N]/[N] passed
  - CSS accuracy: [N]%
```

---

## Error Handling

| Error | Action |
|-------|--------|
| Navigation 4xx/5xx | Tell user, check URL |
| Redirect to login | Use `--headed --adapter playwright`, prompt user |
| Navigation timeout | Retry once with higher `--timeout` |
| Anti-scraping challenge | Tell user to solve manually |
| Component extraction empty | Re-run with higher `--component-depth` or `--memory-limit` |
| Codegen build fails | Read error, fix TypeScript/CSS |
| Port already in use | Try different port |
| Any phase fails 3x | **STOP** and ask user |

---

## Quick Reference

```
User: "Clone this website: https://example.com"
Agent: Phase 0 → 1 → 2 → 3 → 4 → 5, sequentially with GATE checks.
```

**Adding pages:** After first page is verified, run again with next page URL.
The existing output directory and extraction cache are reused.

---

## Script Reference

### Engine CLI (TypeScript, via pnpm)

| Command | What It Does |
|---------|-------------|
| `pnpm dev:cli <URL> -o out --adapter playwright` | Snapshot + resource download |
| `pnpm dev:cli inspect <URL> --outline` | Page structure analysis |
| `pnpm dev:cli query <URL> <selector>` | Structured data extraction |
| `pnpm dev:cli <URL> --codegen-framework vue` | Generate Vue 3 code |
| `pnpm dev:cli <URL> --serve --run` | Start local HTTP server |

### Deep Extraction (JS scripts)

| Script | What It Does |
|--------|-------------|
| `scripts/js/extract-structure-v2.js` | Multi-coord DOM extraction |
| `scripts/js/extract-visual-v2.js` | Semantic + visual button fusion |
| `scripts/js/map-dom.js` | Vision → DOM mapping via containment-ratio |
| `scripts/js/extract-links.js` | All links with SPA detection |
| `scripts/js/extract-cssom.js` | Full CSSOM walk |
| `scripts/js/extract-shadow.js` | Shadow DOM traversal |
| `scripts/js/extract-states-inventory.js` | Interactive elements list |
| `scripts/js/extract-states-capture.js` | State style capture |
| `scripts/js/extract-lazy-load.js` | Lazy content trigger |
| `scripts/js/extract-page-screenshot.js` | Full-page screenshot metadata |
| `scripts/js/extract-component-screenshot.js` | Component crop coordinates |
| `scripts/js/validate-extraction.js` | Extraction sanity check |

### Verification (Python)

| Script | What It Does |
|--------|-------------|
| `scripts/python/pixel-diff.py` | PIL + numpy pixel comparison, red/green heatmap |
| `scripts/python/test-interactions.py` | Playwright-based interaction testing |

---

## Adding New Pages

After Phase 5 passes for the first page:

1. User provides next page URL
2. Run Phase 3b (component extraction) on new URL with `--incremental`
3. Run Phase 4 for new page
4. Run Phase 5 verification
5. Merge new components into existing output project

The existing clone directory and extraction cache are reused across pages.

# webclone-skill

Pi Agent Skill for AI-driven website cloning.

**Snapshot first, extract locally, AI generates code.** Bypasses login walls and anti-scraping by downloading the page as a static snapshot with API proxy, then running all extraction and generation against the local copy.

---

## Quick Start

```bash
# Install
cd webclone-skill && pnpm install

# Clone a website (Pi Agent executes Phase 0-5)
# Phase 1: web-clone downloads page → local snapshot on port 8080
# Phase 2-3: 13 extraction scripts run against http://localhost:8080/
# Phase 4: AI generates HTML/CSS/JS from extracted data
# Phase 5: pixel-diff verification
```

Or install as a Pi Skill:

```bash
cp -r webclone-skill ~/.pi/agent/skills/clone-website
# Pi loads automatically on next session
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        webclone-skill                            │
│                                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐  │
│  │  web-clone   │   │ Extraction   │   │  AI Code Generation │  │
│  │   engine     │──▶│   scripts    │──▶│                     │  │
│  │              │   │  (13 scripts)│   │  HTML / Vue / Next  │  │
│  │ Snapshot +   │   │              │   │                     │  │
│  │ API proxy    │   │ DOM · CSS    │   │  ← SKILL.md drives │  │
│  └──────────────┘   │ Interactions │   │  AI agent dispatch  │  │
│         │           │ States       │   └─────────────────────┘  │
│         ▼           └──────────────┘              │              │
│  ┌──────────────┐                                ▼              │
│  │ ./snapshot/  │                          ┌─────────────┐      │
│  │ index.html   │                          │ ./output/   │      │
│  │ assets/      │                          │ index.html  │      │
│  │ server.js    │                          │ server.js   │      │
│  └──────────────┘                          └─────────────┘      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Verification: pixel-diff.py + test-interactions.py         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
webclone-skill/
├─ SKILL.md                    ← Pi Agent Skill definition (load on startup)
├─ README.md / README_zh.md    ← This file
│
├─ apps/cli/                   ← web-clone CLI (snapshot engine)
│  └─ src/                     ← TypeScript source
│
├─ packages/                   ← web-clone TypeScript monorepo
│  ├─ core/        ← Snapshot core (fetch, parse, assemble, convert)
│  ├─ codegen/     ← Framework code generators (Vue/React/Angular/Svelte)
│  ├─ adapter-playwright/  ← Playwright browser adapter
│  ├─ adapter-puppeteer/   ← Puppeteer browser adapter
│  └─ adapter-common/      ← Shared adapter utilities
│
├─ scripts/
│  ├─ js/                       ← Deep extraction scripts (13 total)
│  │  ├─ extract-structure-v2.js    DOM tree + bounding rects + computed styles
│  │  ├─ extract-cssom.js           Full CSSOM walk (all CSS rules)
│  │  ├─ extract-states-inventory.js Interactive elements list
│  │  ├─ extract-states-capture.js  Hover/focus/active state CSS diffs
│  │  ├─ extract-page-screenshot.js Full-page screenshots (multi-viewport)
│  │  ├─ extract-component-screenshot.js Component crop screenshots
│  │  ├─ extract-links.js          All links with SPA detection
│  │  ├─ extract-shadow.js         Shadow DOM traversal
│  │  ├─ extract-visual-v2.js      Visual/semantic analysis
│  │  ├─ extract-lazy-load.js      Lazy loading detection
│  │  ├─ map-dom.js                DOM mapping
│  │  ├─ validate-extraction.js    Extraction sanity check
│  │  └─ generate-source.mjs       Extract JSON → standalone HTML/CSS/JS
│  ├─ python/
│  │  ├─ pixel-diff.py             Visual diff comparison (heatmap)
│  │  └─ test-interactions.py     Playwright interaction testing
│  └─ wrappers/                    ← CLI wrapper scripts (AI agent calls)
│
├─ references/                     ← Detailed command documentation
│  ├─ snapshot.md / inspect.md / query.md
│  ├─ codegen.md / verify.md
│  └─ INSPECTION_GUIDE.md
│
└─ templates/
   └─ nextjs-clone/               ← JCodesMore Next.js starter template
```

---

## Pipeline

| Phase | Step | Tool | Input | Output |
|-------|------|------|-------|--------|
| 0 | Preflight | `pnpm build` | — | Build passes |
| 1 | Snapshot | `pnpm dev:cli <URL> -o ./snapshot --serve` | Live URL | Static page + API proxy on :8080 |
| 2 | Extract | 13 `extract-*.js` scripts | `http://localhost:8080/` | 13 JSON files (DOM/CSS/interactions) |
| 3 | Spec | AI writes `.spec.md` per component | JSON data | Auditable spec files |
| 4 | Generate | `generate-source.mjs` or AI writes code | Spec + JSON | HTML/CSS/JS or framework project |
| 5 | Verify | `pixel-diff.py` | Original + clone PNG | Pass/fail with heatmap |

**Key insight:** All extraction runs against the local snapshot (`:8080`), never the live URL. Login walls, anti-scraping, and rate limits are completely bypassed.

---

## Output Options

| Option | Output | Best For |
|--------|--------|----------|
| A: Standalone | Single `index.html` + `server.js` | Fastest, zero dependencies |
| B: Vue 3 | Vue 3 + TypeScript project | Component-based apps |
| C: Next.js | Next.js project from template | Production full-stack |

---

## Requirements

- Node.js >= 20
- pnpm >= 9
- Google Chrome (or specify `--executable-path`)
- Python 3 (for pixel-diff.py)

---

## Related

- Engine: [kkkqkx123/web-clone](https://github.com/kkkqkx123/web-clone)
- JCodesMore/clone-website skill: integrated as `SKILL.md`
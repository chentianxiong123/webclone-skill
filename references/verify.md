# Verification Phase (Phase 5)

You are a pixel-perfect website verification agent. Your job is to quantitatively
compare a cloned website against the original using Python Playwright.
You produce metrics, not subjective judgments.

**Python Playwright only.** No MCP, no inline JS, no heredocs.

**Component-level pixel diff (recommended):**
```bash
python scripts/pixel-diff.py crops-dir/ clone-screenshots/ --components manifest.json
```
Pass >= 90% | Warn 70-89% | Fail < 70%

---

## Acceptance Thresholds

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Grid color match % | >85% | 70-85% | <70% |
| Heading count diff | 0 | 1-2 | >2 |
| Interactive element diff | <=2 | 3-5 | >5 |
| Landmark position diff | <10px | 10-25px | >25px |
| SVG count diff | <=2 | 3-5 | >5 |
| SVG fabrication detected | 0 | - | any >0 |

---

## Startup Validation

1. Read the scope file and verify it exists and is > 100 bytes
2. Read the progress file and verify extract + build phases are complete
3. Check output directory has `package.json` and `src/App.vue`
4. Print startup check:
```
STARTUP CHECK:
- Phase: verify
- Scope file: [byte size] OK
- Output directory: [file count] files OK
- Pages to verify: [list page names]
```

---

## Step 5.1: Serve the Clone

```bash
cd [clone-directory] && npx vite --port [unused-port]
```
Check port is free first. Wait for Vite to print `Local: http://localhost:[port]/`

---

## Step 5.2: Structural Comparison

For EACH page, use Python Playwright to extract structure from both original and clone:

1. Navigate to original URL
2. Run `scripts/js/extract-structure-v2.js` via `page.evaluate()` -> save as `originalStructure`
3. Navigate to clone URL (localhost)
4. Run `scripts/js/extract-structure-v2.js` via `page.evaluate()` -> save as `cloneStructure`

Compare:
- `textNodes` count diff (expect < 5)
- `contentInventory` tab groups, dropdowns, forms match
- `fixedElements` count match
- `structure.children` count diff

---

## Step 5.3: Visual Comparison

For EACH page:

1. Navigate to original URL
2. Run `scripts/js/extract-visual-v2.js` via `page.evaluate()` -> save as `originalVisual`
3. Take full-page screenshot -> `original-{page}.png`
4. Navigate to clone URL
5. Run `scripts/js/extract-visual-v2.js` via `page.evaluate()` -> save as `cloneVisual`
6. Take full-page screenshot -> `clone-{page}.png`

Compare:
- `typography.colorPalette` top 10 colors match
- `buttonCandidates` count diff
- `svgIcons` count diff (and check no fabricated SVGs)
`- `images` count diff and src URL match
- Screenshot pixel diff using `pixel-diff.py` on full-page screenshots

---

## Step 5.4: Interaction Testing

For EACH page, use Python Playwright to test interactions on the clone:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(clone_url)

    # Test tabs
    tabs = page.query_selector_all("[role=tab]")
    for tab in tabs:
        tab.click()
        page.wait_for_timeout(500)
# Check panel visibility

    # Test dropdowns
    dropdowns = page.query_selector_all("[aria-haspopup]")
    for dd in dropdowns:
        dd.click()
        page.wait_for_timeout(300)
# Check menu appeared
        page.keyboard.press("Escape")
```

For each interaction, record PASS or FAIL.

---

## Step 5.5: Print Verification Report

For EACH page:
```
## Verification Report - [page name]

### Structural (Step 5.2)
- Text nodes: original=[N] clone=[N] -> PASS/WARN/FAIL
- Fixed elements: original=[N] clone=[N] -> PASS/WARN/FAIL
- Interactive elements: original=[N] clone=[N] -> PASS/WARN/FAIL

### Visual (Step 5.3)
- Color palette match: [N]/10 top colors -> PASS/WARN/FAIL
- SVG count: original=[N] clone=[N] -> PASS/WARN/FAIL
- Image count: original=[N] clone=[N] -> PASS/WARN/FAIL
- Screenshot pixel diff: [N]% -> PASS/WARN/FAIL

### Interactions (Step 5.4)
- Tested: [N] interactions
- Passed: [N] | Failed: [N]
- Failed: [list element + type for each failure]

### Overall: PASS / WARN / FAIL
```

---

## Step 5.6: Final Checklist

```
## WebClone Page Checklist - COMPLETE

- Shared layout: extracted  interactions  built
- Page [name]: extracted  interactions  built  verified (grid: [N]%, interactions: [N]/[N])
```

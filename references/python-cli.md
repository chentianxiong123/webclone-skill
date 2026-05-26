# Python CLI Reference

All scripts use Python Playwright. Run from the skill root directory.

## extractor.py — Main Extraction Pipeline

```bash
python scripts/extractor.py <URL> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o FILE` | extraction-result.json | Output JSON path |
| `--max` | off | Enable all: cdp + harvest + shadow + cssom + states + screenshots |
| `--headless` | on | Run headless |
| `--visible` | off | Show browser window |
| `--wait N` | 2000 | Settle wait after navigation (ms) |
| `--max-depth N` | 10 | DOM traversal depth |
| `--capture-states` | off | Extract hover/focus/active style diffs |
| `--states-cap N` | 30 | Max elements to sample for states |
| `--capture-screenshots` | off | Crop per-element screenshots |
| `--screenshots-dir DIR` | auto | Screenshot output directory |
| `--harvest` | off | Download all network resources |
| `--harvest-dir DIR` | auto | Resource output directory |
| `--shadow` | off | Pierce open shadow roots |
| `--cssom` | off | Walk full CSSOM |
| `--cdp-snapshot` | off | Sub-pixel CDP DOMSnapshot |
| `--multi-viewport WxH,...` | off | Comma-separated viewports |
| `--legacy` | off | Use legacy extraction scripts |

## component-boundary-pipeline.py — P0+P1

```bash
python scripts/component-boundary-pipeline.py <URL> [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o FILE` | auto (components-{ts}.json) | Output JSON path |
| `--mock-multimodal` | off | Use mock boundaries (no API key) |
| `--provider openai|anthropic` | auto | LLM provider for boundary detection |
| `--model MODEL` | auto | Model name |
| `--headless` | on | Run headless |
| `--visible` | off | Show browser window |
| `--wait N` | 2000 | Settle wait (ms) |
| `--compare-with DIR` | off | Clone screenshots dir to diff against |

## pixel-diff.py — Pixel Comparison

```bash
# Single image comparison
python scripts/pixel-diff.py image_a.png image_b.png --threshold 10 --heatmap diff.png

# Batch component comparison
python scripts/pixel-diff.py original-dir/ clone-dir/ --components manifest.json
```

| Flag | Default | Description |
|------|---------|-------------|
| `--threshold N` | 10 | Per-channel RGB difference threshold |
| `--output FILE` | none | Diff image output path |
| `--heatmap FILE` | none | Generate red/green heatmap |
| `--components FILE` | none | JSON with component cropRects for batch diff |

## placeholder-skeleton-generator.py — Vue Skeletons

```bash
python scripts/placeholder-skeleton-generator.py extraction.json -o components/
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o DIR` | components/ | Output directory |
| `--filter LABEL ...` | none | Only generate for these labels |

## linked-pages-recorder.py — Link Inventory

```bash
# From URL
python scripts/linked-pages-recorder.py <URL> -o linked-pages.json

# From extraction JSON
python scripts/linked-pages-recorder.py extraction.json -o linked-pages.json

# From saved HTML
python scripts/linked-pages-recorder.py page.html --html -o linked-pages.json
```

## identify-boundaries.py — Multimodal Boundary Detection

```bash
python scripts/identify-boundaries.py screenshot.png -o boundaries.json --provider openai
```
Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in environment.

## component_package.py — Verification Package

```bash
python scripts/component_package.py extraction.json -o extraction-package/
```
Outputs: manifest.json, text_boxes.json, design_tokens.json, verify_prompt.md

## cdp_snapshot.py — CDP Sub-pixel Coordinates

Used as a library by extractor.py. Captures float-precision bounds via Chrome DevTools Protocol.

## resource_harvester.py — Network Resource Capture

Used as a library by extractor.py. Intercepts all page responses and saves images/fonts/css/svg.
```

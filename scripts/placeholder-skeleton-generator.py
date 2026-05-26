"""
placeholder-skeleton-generator.py — P2.1: Generate Level 0 placeholder skeleton
Vue components from extraction JSON. These are pixel-diff targets: the skeleton
must visually match the extracted component bounding box.

Usage:
    python placeholder-skeleton-generator.py <extraction.json> [--output components/]
    python placeholder-skeleton-generator.py <extraction.json> --css-from <extraction.json>
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def skeleton_css(component: dict, indent: int = 0) -> str:
    """Generate the placeholder CSS for a component root."""
    bb = component.get("bounding_box", {})
    dom = component.get("dom", {}) or {}
    rect = (dom.get("rect") or {}) if isinstance(dom, dict) else {}

    # Use visual bounding box dimensions from extraction
    x1 = bb.get("x1", 0)
    y1 = bb.get("y1", 0)
    x2 = bb.get("x2", 0)
    y2 = bb.get("y2", 0)
    w = rect.get("w") or (x2 - x1 if x2 > x1 else 200)
    h = rect.get("h") or (y2 - y1 if y2 > y1 else 40)

    # Layout role from position field
    position = dom.get("styles", {}).get("position", "relative") if isinstance(dom, dict) else "relative"

    # For sticky components, capture the top value
    top_val = None
    if position == "sticky" and dom.get("styles"):
        top_val = dom["styles"].get("top")

    lines = [
        "  margin: 0;",
        "  width: auto;",
        "  position: relative;",
        f"  /* extracted: {w}×{h} from bounding_box */",
    ]

    if position == "sticky" and top_val:
        lines.insert(2, f"  position: sticky;")
        lines.insert(3, f"  top: {top_val};")
        lines.remove("  position: relative;")
    elif position != "relative":
        lines.insert(2, f"  /* position: {position} — skeleton uses relative */")

    return "\n".join(f"{'  ' * indent}{l}" for l in lines)


def skeleton_template(label: str, component: dict) -> str:
    """Generate the template block with placeholder comment."""
    bb = component.get("bounding_box", {})
    dom = component.get("dom", {}) or {}
    x1 = bb.get("x1", 0); y1 = bb.get("y1", 0)
    x2 = bb.get("x2", 0); y2 = bb.get("y2", 0)
    rect = (dom.get("rect") or {}) if isinstance(dom, dict) else {}
    w = rect.get("w") or max(1, x2 - x1)
    h = rect.get("h") or max(1, y2 - y1)

    tag = (dom.get("tag", "div") if isinstance(dom, dict) else "div")
    classes = (dom.get("classes", []) if isinstance(dom, dict) else [])
    cls_str = " ".join(classes[:5]) if classes else f"{label.replace('_', '-')}-skeleton"

    type_hint = component.get("type_hint", "content")

    return f"""  <div class="{cls_str} skeleton-level-0" style="width: {w}px; height: {h}px;">
    <!-- Level 0 placeholder for: {label} ({type_hint}) -->
    <!-- Screenshot target for pixel-diff: entire component root -->
  </div>"""


def component_readme(label: str, component: dict, output_dir: Path) -> str:
    """Generate README.md for the component package."""
    bb = component.get("bounding_box", {})
    dom = (component.get("dom") or {}) if isinstance(component.get("dom"), dict) else {}
    rect = dom.get("rect", {}) or {}
    selector = dom.get("selector", "unknown") if isinstance(dom, dict) else "unknown"
    type_hint = component.get("type_hint", "unknown")
    notes = component.get("notes", "")
    w = rect.get("w", "?")
    h = rect.get("h", "?")
    confidence = component.get("confidence", 0)

    return f"""# {label}

## Component Metadata

| Field | Value |
|---|---|
| Label | `{label}` |
| Type Hint | `{type_hint}` |
| DOM Selector | `{selector}` |
| Extracted Size | `{w}×{h}px` |
| Confidence | `{confidence}` |
| Notes | `{notes}` |

## Layout Role

- **Position**: `{dom.get("styles", {}).get("position", "relative") if isinstance(dom, dict) else "relative"}`
- **Tag**: `{dom.get("tag", "div") if isinstance(dom, dict) else "div"}`

## Props Interface

```typescript
// Stage 1: hardcoded from extraction
interface {label.replace('-', '').replace('_', '')}Props {{
  // TODO: define from Stage 1 hardcoded values
}}
```

## Pixel-Diff Target

Screenshot target: `{label}.png` from component-boundary-pipeline crops.

Level 0 skeleton passes pixel-diff when match_ratio ≥ 90%.
""".strip()


def vue_component(label: str, component: dict, output_dir: Path) -> dict:
    """
    Generate a Level 0 placeholder Vue SFC.
    Returns: { vue_path, spec_path, readme_path, label, bounding_box }
    """
    # Sanitize label for use as directory/component name
    safe = label.replace("_", "-").replace(" ", "-")
    comp_dir = output_dir / safe
    comp_dir.mkdir(parents=True, exist_ok=True)

    vue_name = f"{safe.replace('-', '')}.vue"
    # Convert: header-bar → HeaderBar.vue
    vue_name = "".join(p.title() for p in safe.split("-")) + ".vue"
    vue_path = comp_dir / vue_name
    spec_path = comp_dir / f"{vue_name.replace('.vue', '.spec.ts')}"
    readme_path = comp_dir / "README.md"

    # Build the Vue SFC
    bb = component.get("bounding_box", {})
    dom = (component.get("dom") or {}) if isinstance(component.get("dom"), dict) else {}
    rect = dom.get("rect", {}) or {}
    selector = dom.get("selector", "") if isinstance(dom, dict) else ""
    type_hint = component.get("type_hint", "content")
    notes = component.get("notes", "")
    x1 = bb.get("x1", 0); y1 = bb.get("y1", 0)
    x2 = bb.get("x2", 0); y2 = bb.get("y2", 0)
    w = rect.get("w") or max(1, x2 - x1)
    h = rect.get("h") or max(1, y2 - y1)

    classes = (dom.get("classes", []) if isinstance(dom, dict) else [])
    cls_str = " ".join(classes[:5]) if classes else f"{safe}-skeleton"

    position = dom.get("styles", {}).get("position", "relative") if isinstance(dom, dict) else "relative"
    top_val = dom["styles"].get("top") if position == "sticky" and isinstance(dom, dict) else None

    css_lines = [
        f".{safe.replace('-', '')}-skeleton {{",
        "  margin: 0;",
        "  width: auto;",
        "  position: relative;",
        f"  /* extracted: {w}×{h}px */",
    ]
    if position == "sticky" and top_val:
        css_lines[2] = "  position: sticky;"
        css_lines[3] = f"  top: {top_val};"
        del css_lines[4]  # remove duplicate position: relative
    elif position != "relative":
        css_lines[2] = f"  /* position: {position} — using relative in skeleton */"

    css_lines.append("  /* Level 0 placeholder — dashed border, muted bg */")
    css_lines.append("  border: 1px dashed #ccc;")
    css_lines.append("  background: #fafafa;")
    css_lines.append("  min-height: 40px;")
    css_lines.append("}")

    vue_content = f"""<!-- {vue_name} — Level 0 Placeholder Skeleton -->
<!-- Pixel-diff target: extracted {label}.png (bounding_box {x1},{y1}→{x2},{y2}) -->
<!-- DOM selector: {selector} -->
<!-- Confidence: {component.get('confidence', 0):.0%} -->

<template>
  <div class="{cls_str} skeleton-level-0" style="width: {w}px; min-height: {h}px;">
    <!-- Level 0 placeholder: {label} ({type_hint}) -->
    <!-- Pixel-diff validation target: {safe}.png -->
  </div>
</template>

<script setup lang="ts">
// TODO: Stage 1 — hardcoded props from extraction
// TODO: Stage 2 — same-page repetition extraction
// TODO: Stage 3 — cross-page unification
</script>

<style scoped>
{chr(10).join(css_lines)}
</style>
""".strip()

    spec_content = f"""// {vue_name.replace('.vue', '.spec.ts')} — Pixel-diff verification placeholder
// TODO: implement pixel-diff test against extracted {label}.png
import {{ describe, it, expect }} from 'vitest';

describe('{label} placeholder pixel-diff', () =>
{{
  it('Level 0 skeleton passes pixel-diff threshold', () =>
  {{
    // TODO: load {label}.png from extraction crops dir
    // TODO: render this component to canvas
    // TODO: compare pixel-by-pixel, expect match_ratio >= 90
    expect(true).toBe(true); // placeholder
  }});
}});
""".strip()

    vue_path.write_text(vue_content, encoding="utf-8")
    spec_path.write_text(spec_content, encoding="utf-8")
    readme_path.write_text(component_readme(label, component, comp_dir), encoding="utf-8")

    return {
        "label": label,
        "vue_path": str(vue_path.relative_to(output_dir)),
        "spec_path": str(spec_path.relative_to(output_dir)),
        "readme_path": str(readme_path.relative_to(output_dir)),
        "bounding_box": bb,
        "dom_selector": selector,
        "confidence": component.get("confidence", 0)
    }


def generate_all(extraction_json: Path, output_dir: Path, filter_labels: list[str] | None = None) -> list[dict]:
    """
    Read extraction JSON and generate skeleton components for all components.
    """
    data = json.loads(extraction_json.read_text(encoding="utf-8"))

    # Support multiple JSON structures
    components = data.get("components", []) if isinstance(data, dict) else data

    # Filter if labels specified
    if filter_labels:
        components = [c for c in components if c.get("label", "") in filter_labels]

    results = []
    for comp in components:
        label = comp.get("label", "unknown")
        result = vue_component(label, comp, output_dir)
        results.append(result)
        print(f"  [OK] {label:25s} → {result['vue_path']}")

    return results


def main():
    ap = argparse.ArgumentParser(description="P2.1: Generate Level 0 placeholder skeleton Vue components")
    ap.add_argument("extraction", type=Path, help="Extraction JSON (from component-boundary-pipeline or extractor)")
    ap.add_argument("--output", "-o", type=Path, default=Path("components"), help="Output directory for skeleton components")
    ap.add_argument("--filter", nargs="+", help="Only generate for these labels")
    args = ap.parse_args()

    output_dir = args.output
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Generating Level 0 skeletons from: {args.extraction}")
    print(f"Output directory: {output_dir}")
    if args.filter:
        print(f"Filter labels: {args.filter}")

    results = generate_all(args.extraction, output_dir, args.filter)

    manifest = {
        "total": len(results),
        "output_dir": str(output_dir),
        "components": results
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"Generated {len(results)} Level 0 skeleton components")
    print(f"Manifest: {manifest_path}")
    return manifest


if __name__ == "__main__":
    main()
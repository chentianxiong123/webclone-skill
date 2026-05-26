"""
component_package.py — Assemble a multi-modal verification package from an
extraction result JSON.

Input:  extraction JSON from extractor.py (enhanced mode)
Output: a self-contained package dir:
    <out_dir>/
      manifest.json              — index of all parts
      text_boxes.json            — per-line text rects from CDP
      design_tokens.json         — color/font/spacing histogram
      component_screenshots/     — element crops (already captured)
      css_rules.json             — relevant CSS rules per component
      viewport_diffs.json        — multi-viewport structural diffs
      snapshots/                 — CDP layout JSON per viewport
      verify_prompt.md           — prompt to hand to a vision model
"""
from __future__ import annotations

import json
import textwrap
from pathlib import Path
from typing import Any

DEFAULT_FONT_SIZES = [
    "10px","11px","12px","13px","14px","15px","16px","17px","18px","20px",
    "21px","22px","23px","24px","26px","28px","30px","32px","36px","40px",
    "42px","48px","56px","64px","72px","80px","96px"
]


def build_token_stats(extracted: dict[str, Any]) -> dict[str, Any]:
    """Aggregate Design Tokens: color palette, font scale, spacing, shadows."""
    visual = extracted.get("visual") or {}

    # color palette
    palette_raw = (visual.get("typography") or {}).get("colorPalette", [])
    palette = []
    for entry in palette_raw:
        c = entry.get("color", "")
        if c and c not in ("rgba(0, 0, 0, 0)", "transparent"):
            palette.append({"color": c, "count": entry.get("count", 1)})

    # font scale — histogram of fontSize values
    type_scale = (visual.get("typography") or {}).get("typeScale", [])
    size_hist = {}
    weight_hist = {}
    for t in type_scale:
        sz = t.get("fontSize", "")
        wt = t.get("fontWeight", "")
        if sz: size_hist[sz] = size_hist.get(sz, 0) + 1
        if wt: weight_hist[wt] = weight_hist.get(wt, 0) + 1

    # spacing from CSSOM rules
    spacing_vals = set()
    for rule in (extracted.get("cssom") or {}).get("stylesheets", []):
        css = rule.get("cssText", "")
        for kw in ["padding", "margin", "gap"]:
            idx = css.find(kw + ":")
            if idx == -1:
                idx = css.find(kw + "-")
            if idx != -1:
                seg = css[idx:].split(";", 1)[0]
                spacing_vals.add(seg.strip())

    # shadows
    shadows = set()
    for rule in (extracted.get("cssom") or {}).get("stylesheets", []):
        css = rule.get("cssText", "")
        idx = css.find("box-shadow:")
        if idx != -1:
            shadows.add(css[idx:].split(";", 1)[0].strip())

    return {
        "colorPalette": palette[:30],
        "fontScale": dict(sorted(size_hist.items(), key=lambda x: float(x[0].rstrip("px")) if x[0].endswith("px") else 0)),
        "fontWeights": dict(sorted(weight_hist.items())),
        "spacingSamples": sorted(list(spacing_vals))[:30],
        "boxShadows": sorted(list(shadows))[:20]
    }


def build_css_lookup(extracted: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    """Index CSS rules by selector substring — fast lookup for a given element."""
    cssom = extracted.get("cssom") or {}
    by_tag: dict[str, list[dict[str, str]]] = {}
    for rule in cssom.get("stylesheets", []):
        sel = rule.get("selector") or ""
        if not sel or sel.startswith("*") or sel.startswith(":"):
            continue
        css_text = rule.get("cssText", "")
        for kw in ["color", "background", "border", "radius", "shadow", "font", "padding", "margin", "width", "height"]:
            if kw + ":" in css_text.lower():
                for t in ["div", "span", "a", "button", "li", "p", "h1", "h2", "h3", "nav", "header", "section"]:
                    if t in sel:
                        by_tag.setdefault(t, []).append({"selector": sel, "cssText": css_text[:400]})
                        break
    return by_tag


def assemble(input_json: Path, out_dir: Path) -> dict[str, Any]:
    data = json.loads(input_json.read_text(encoding="utf-8"))
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    # screenshots subdir
    shot_dir = out_dir / "component_screenshots"
    shot_dir.mkdir(exist_ok=True)

    # --- text boxes ---
    cdp = data.get("cdpSnapshot") or {}
    docs = cdp.get("documents", [])
    tb_out = []
    if docs:
        doc0 = docs[0]
        nodes = doc0.get("nodes", [])
        layout = doc0.get("layout", [])
        # build nodeName lookup
        node_names: dict[int, str] = {}
        for n in nodes:
            node_names[n["i"]] = n.get("nodeName", "")

        for tb in doc0.get("textBoxes", []):
            li = tb.get("layoutIdx", -1)
            lay = layout[li] if 0 <= li < len(layout) else {}
            ni = lay.get("nodeIdx", -1)
            tag = node_names.get(ni, "")
            bounds = tb.get("bounds")
            if bounds:
                tb_out.append({
                    "lineText": "[text-content]",  # placeholder — caller fills from DOM
                    "tag": tag,
                    "rect": {
                        "x": round(bounds[0], 3),
                        "y": round(bounds[1], 3),
                        "w": round(bounds[2], 3),
                        "h": round(bounds[3], 3)
                    },
                    "blendedBg": lay.get("blendedBackgroundColor"),
                    "paintOrder": lay.get("paintOrder"),
                    "fontSize": lay.get("computedStyles", [None] * 40)[7] if lay.get("computedStyles") else None,
                    "fontWeight": lay.get("computedStyles", [None] * 40)[8] if lay.get("computedStyles") else None,
                })

    (out_dir / "text_boxes.json").write_text(json.dumps(tb_out, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- design tokens ---
    tokens = build_token_stats(data)
    (out_dir / "design_tokens.json").write_text(json.dumps(tokens, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- CSS lookup ---
    css_lookup = build_css_lookup(data)
    (out_dir / "css_lookup.json").write_text(json.dumps(css_lookup, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- multi-viewport diffs ---
    mv = data.get("multiViewport", [])
    if len(mv) >= 2:
        diffs = []
        base = mv[0].get("structure") or {}
        for vp in mv[1:]:
            cur = vp.get("structure") or {}
            diffs.append({
                "fromViewport": mv[0].get("viewport"),
                "toViewport": vp.get("viewport"),
                "note": "structural differences between viewports (comparing _stats, childCount)"
            })
        (out_dir / "viewport_diffs.json").write_text(json.dumps(diffs, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- copy screenshots ---
    existing_shots = data.get("elementScreenshots", [])
    copied = []
    shot_src_dir = Path(input_json).with_name(input_json.stem + "-screenshots")
    for rec in existing_shots:
        src = shot_src_dir / rec.get("file", "")
        if src.exists():
            dst = shot_dir / src.name
            import shutil
            shutil.copy2(src, dst)
            copied.append(str(dst.relative_to(out_dir)))
    (out_dir / "screenshots_index.json").write_text(json.dumps(copied, ensure_ascii=False, indent=2), encoding="utf-8")

    # --- verification prompt ---
    prompt = _build_verify_prompt(data, tokens, len(tb_out), len(copied))
    (out_dir / "verify_prompt.md").write_text(prompt, encoding="utf-8")

    # --- manifest ---
    manifest = {
        "source": str(input_json.resolve()),
        "textBoxCount": len(tb_out),
        "tokenColors": len(tokens.get("colorPalette", [])),
        "cssRuleSelectors": sum(len(v) for v in css_lookup.values()),
        "screenshotCount": len(copied),
        "multiViewportCount": len(mv),
        "keyframes": [kf.get("name") for kf in data.get("cssom", {}).get("keyframes", [])],
        "files": {
            "text_boxes": "text_boxes.json",
            "design_tokens": "design_tokens.json",
            "css_lookup": "css_lookup.json",
            "screenshots_index": "screenshots_index.json",
            "viewport_diffs": "viewport_diffs.json",
            "verify_prompt": "verify_prompt.md"
        }
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def _build_verify_prompt(data: dict[str, Any], tokens: dict[str, Any], tb_count: int, shot_count: int) -> str:
    n = len(data.get("textNodes", []))
    b = len(data.get("visual", {}).get("buttonCandidates", []))
    f = len(data.get("fixedElements", []))
    cdp_nodes = 0
    for d in (data.get("cdpSnapshot") or {}).get("documents", []):
        cdp_nodes += d.get("layoutCount", 0)
    v = data.get("visual", {}) or {}
    return textwrap.dedent(f"""\
    # Component Verification Prompt

    You are a pixel-perfect frontend cloning assistant. Use the data below to
    verify whether a cloned page matches the original.

    ## Original Page
    URL: {data.get("url","")}
    Mode: {data.get("mode","")}

    ## Extraction Stats
    | Category | Count |
    |---------|-------:|
    | Text nodes (DOM) | {n} |
    | CDP layout nodes (sub-pixel) | {cdp_nodes} |
    | Per-line text boxes (CDP) | {tb_count} |
    | Button candidates (sem+vis) | {b} |
    | Fixed/sticky elements | {f} |
    | Element screenshots | {shot_count} |

    ## Design Tokens (primary candidates)
    ### Color Palette (top by frequency)
    {', '.join(c['color'] for c in tokens.get('colorPalette', [])[:12])}

    ### Font Scale (px)
    {', '.join(sorted(tokens.get('fontScale', {}).keys(), key=lambda x: float(x.rstrip('px')) if x.endswith('px') else 0)[:15])}

    ### Font Weights
    {', '.join(sorted(tokens.get('fontWeights', {}).keys()))}

    ### Spacing Samples
    {', '.join(tokens.get('spacingSamples', [])[:12])}

    ### Box Shadows
    {', '.join(tokens.get('boxShadows', [])[:8])}

    ## @keyframes Animations
    {', '.join(kf.get('name','') for kf in data.get('cssom',{}).get('keyframes',[])) or 'none detected'}

    ## Verification Checklist
    1. Load the original URL in a browser and take a full-page screenshot.
    2. Load the cloned page and take a full-page screenshot at the same viewport size.
    3. For each color in the palette above, check the cloned page uses the same hex/rgb values.
    4. For each font size in the scale, verify the cloned page matches.
    5. Count fixed/sticky elements — verify they are position:fixed/sticky in the clone.
    6. Compare the {shot_count} element screenshots against their counterparts in the clone.
    7. For every text box rect in text_boxes.json, verify the clone places the text at the same coordinates.
    8. Check that all @keyframes animations in the original are reproduced in the clone CSS.
    9. For each button candidate, verify hover/focus/active states match.

    ## Output Format
    Report a numeric similarity score (0-100%) per category and an overall score.
    List any discrepancies with the exact CSS property or coordinate that differs.
    """).strip()


if __name__ == "__main__":
    import sys
    inp = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("test-max-baidu.json")
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else inp.with_name(inp.stem + "-package")
    m = assemble(inp, out)
    print(f"Package written to: {out}")
    print(f"  text_boxes: {m['textBoxCount']}")
    print(f"  colors: {m['tokenColors']}")
    print(f"  screenshots: {m['screenshotCount']}")
    print(f"  css selectors indexed: {m['cssRuleSelectors']}")
    print(f"  files: {list(m['files'].keys())}")

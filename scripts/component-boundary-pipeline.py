"""
component-boundary-pipeline.py 鈥?P0 + P1: Component boundary identification,
DOM mapping, and component-level screenshot extraction.

Pipeline steps:
  1. Navigate + full-page screenshot (extract-page-screenshot.js)
  2. Multivodal boundary detection (OpenAI/Anthropic 鈥?optional, mock available)
  3. Map visual bounding boxes to DOM selectors (map-dom.js)
  4. For each mapped component: crop component screenshot from full page

Usage:
    python component-boundary-pipeline.py <url> [--output components.json] [--mock-multimodal]
    python component-boundary-pipeline.py <url> --compare-with ./clone-screenshots/
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).parent
ENHANCED_SCRIPTS = SCRIPT_DIR / "js"
FALLBACK_SCRIPTS = SCRIPT_DIR / "js"  # fallback: same as enhanced


def load_script(name: str) -> str:
    for d in [ENHANCED_SCRIPTS, FALLBACK_SCRIPTS]:
        p = d / name
        if p.exists():
            return f"() => {{ {p.read_text(encoding='utf-8')} }}"
    raise FileNotFoundError(f"Script not found: {name}")


def run_eval(page, name: str) -> dict:
    script = load_script(name)
    return page.evaluate(script)


def screenshot_page(page, path: Path) -> dict:
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    page.screenshot(path=str(path), full_page=True)
    return page.evaluate("() => ({ viewport: { width: window.innerWidth, height: window.innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight } })")


def call_multimodal(screenshot_path: Path, provider: str, model: str | None) -> list[dict]:
    import base64, os
    img_b64 = base64.b64encode(screenshot_path.read_bytes()).decode("utf-8")

    if provider == "anthropic":
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        resp = client.messages.create(
            model=model or "claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                {"type": "text", "text": """\
Identify every visually distinct UI component in this screenshot. For each output:
[{"label":"...","bounding_box":{"x1":0,"y1":0,"x2":1440,"y2":64},"type_hint":"layout","notes":"..."}]

Rules:
- Cover EVERY visually distinct region, no overlap, no gaps
- Layout containers="layout", buttons/inputs="interactive", cards="content", modals="overlay"
- Use structural names, not text content
- Output ONLY JSON array, no markdown
"""}]}]
        )
        raw = resp.content[0].text.strip()
    else:
        import openai
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        resp = client.chat.completions.create(
            model=model or "gpt-4o",
            messages=[{"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                {"type": "text", "text": """\
Identify every visually distinct UI component in this screenshot. For each output:
[{"label":"...","bounding_box":{"x1":0,"y1":0,"x2":1440,"y2":64},"type_hint":"layout","notes":"..."}]

Rules:
- Cover EVERY visually distinct region, no overlap, no gaps
- Layout containers="layout", buttons/inputs="interactive", cards="content", modals="overlay"
- Use structural names, not text content
- Output ONLY JSON array, no markdown
"""}]}],
            max_tokens=4096, temperature=0
        )
        raw = resp.choices[0].message.content.strip()

    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:].strip()
    return json.loads(raw.strip())


def map_dom(page, components: list[dict]) -> dict:
    src = (ENHANCED_SCRIPTS / "map-dom.js").read_text(encoding="utf-8")
    # Remove the auto-run block (COMPONENTS_PLACEHOLDER check) since we're passing
    # the data directly to mapDomComponents
    js = src.replace("COMPONENTS_PLACEHOLDER", json.dumps(components))
    # Remove the auto-execution block at the bottom
    js = js.replace(
        "\nif (typeof window !== 'undefined' && window.VCOMPONENTS) {\n  return mapDomComponents(window.VCOMPONENTS);\n}",
        ""
    )
    # Call mapDomComponents directly with the injected data
    result = page.evaluate(f"() => {{ {js}; return mapDomComponents({json.dumps(components)}); }}")
    return result


def crop_components(screenshot_path: Path, components: list[dict], out_dir: Path) -> list[dict]:
    """Crop each component's bounding box from the full-page screenshot."""
    from PIL import Image
    out_dir.mkdir(parents=True, exist_ok=True)

    results = []
    full = Image.open(str(screenshot_path))
    full_w, full_h = full.size

    for c in components:
        dom = c.get("dom") or {}
        sel = (dom.get("selector") or "").strip()
        if not sel or sel == "NO_DOM_MATCH":
            results.append({**c, "crop_error": "no dom selector"})
            continue

        bb = c.get("bounding_box", {})
        x1 = max(0, int(bb.get("x1", 0)))
        y1 = max(0, int(bb.get("y1", 0)))
        x2 = min(full_w, int(bb.get("x2", full_w)))
        y2 = min(full_h, int(bb.get("y2", full_h)))
        w, h = x2 - x1, y2 - y1
        if w <= 0 or h <= 0:
            results.append({**c, "crop_error": "invalid bounding box"})
            continue

        crop_path = out_dir / f"{c['label']}.png"
        try:
            crop = full.crop((x1, y1, x2, y2))
            crop.save(str(crop_path))
            results.append({
                **c,
                "original_screenshot": str(screenshot_path),
                "crop_rect": {"x": x1, "y": y1, "width": w, "height": h},
                "crop_path": str(crop_path.relative_to(out_dir)),
                "crop_size": {"width": w, "height": h}
            })
        except Exception as e:
            results.append({**c, "crop_error": str(e)})

    return results


def run_full_pipeline(
    url: str,
    output: str | None,
    provider: str | None,
    model: str | None,
    mock_multimodal: bool,
    headless: bool,
    wait_ms: int,
    compare_dir: str | None
) -> dict:
    import os
    if provider is None:
        provider = "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "openai"

    ts = int(time.time() * 1000)
    out_path = Path(output) if output else Path(f"components-{ts}.json")
    screenshot_path = Path(f"screenshot-{ts}.png")
    crop_dir = out_path.with_suffix("").with_name(out_path.stem + "-crops")

    components_data = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        print(f"[1/4] Navigating to {url} ...")
        page.goto(url, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(wait_ms)

        print(f"[2/4] Screenshot + boundary detection ...")
        meta = screenshot_page(page, screenshot_path)
        print(f"       Screenshot: {screenshot_path} ({screenshot_path.stat().st_size} bytes)")

        if mock_multimodal:
            print(f"       [MOCK] Simulating multivodal boundary detection ...")
            from PIL import Image
            img = Image.open(str(screenshot_path))
            w, h = img.size
            # Generate plausible mock boundaries based on image size
            boundaries = [
                {"label": "header-bar", "bounding_box": {"x1": 0, "y1": 0, "x2": w, "y2": 60}, "type_hint": "layout", "notes": "Top navigation"},
                {"label": "main-content", "bounding_box": {"x1": 0, "y1": 60, "x2": w, "y2": h - 200}, "type_hint": "content", "notes": "Primary content area"},
                {"label": "footer", "bounding_box": {"x1": 0, "y1": h - 200, "x2": w, "y2": h}, "type_hint": "layout", "notes": "Footer area"},
            ]
        else:
            boundaries = call_multimodal(screenshot_path, provider, model)

        print(f"       {len(boundaries)} visual components detected")

        print(f"[3/4] Mapping to DOM selectors ...")
        mapped = map_dom(page, boundaries)

        print(f"[4/4] Cropping component screenshots ...")
        crops = crop_components(screenshot_path, mapped.get("components", []), crop_dir)

        browser.close()

    result = {
        "url": url,
        "provider": "mock" if mock_multimodal else provider,
        "model": model,
        "screenshot": str(screenshot_path),
        "page_meta": meta,
        "crops_dir": str(crop_dir),
        "components": crops,
        "total": len(crops)
    }

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"Component inventory: {result['total']} components")
    for c in crops:
        status = c.get("crop_error") or "OK"
        sel = ((c.get("dom") or {}).get("selector") or "NO_DOM")[:60]
        print(f"  {'[ERR]' if status != 'OK' else '[OK]'} {c['label']:25s} 鈫?{sel}")
        if status != "OK":
            print(f"       error: {status}")

    print(f"\nFull result: {out_path}")
    print(f"Crops dir: {crop_dir} ({len(list(crop_dir.glob('*.png')))} PNGs)")
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="P0+P1: Component boundary + DOM mapping + crops")
    ap.add_argument("url")
    ap.add_argument("--output", "-o")
    ap.add_argument("--provider", choices=["openai", "anthropic"])
    ap.add_argument("--model")
    ap.add_argument("--mock-multimodal", action="store_true", help="Use mock boundaries (no API key needed)")
    ap.add_argument("--headless", action="store_true", default=True)
    ap.add_argument("--visible", dest="headless", action="store_false")
    ap.add_argument("--wait", type=int, default=2000)
    ap.add_argument("--compare-with", dest="compare_with", help="Clone screenshots dir to diff against")
    args = ap.parse_args()

    result = run_full_pipeline(
        args.url, args.output, args.provider, args.model,
        args.mock_multimodal, args.headless, args.wait, args.compare_with
    )

    if args.compare_with:
        from pixel_diff import diff_components
        clone_dir = Path(args.compare_with)
        crop_dir = Path(result["crops_dir"])
        diffs = diff_components(crop_dir, clone_dir, result["components"], threshold=10, output_base=crop_dir / "diff")
        print(f"\n{'='*60}")
        print(f"Pixel diff: {len(diffs)} components")
        for d in diffs:
            pct = d.get("match_ratio", 0)
            status = "PASS" if pct >= 90 else "WARN" if pct >= 70 else "FAIL"
            print(f"  [{status}] {d['label']}: {pct}% ({d.get('diff_pixels', 0)} px)")


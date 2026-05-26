"""
WebClone Extractor 鈥?Python Executor (enhanced pipeline)

Default mode: enhanced. Loads scripts from scripts/js/
first, falls back to scripts/js/ if a script is not found.

Pipeline (enhanced):
  1. goto(url, networkidle) + initial settle
  2. extract-lazy-load.js  -> trigger progressive content
  3. extract-structure-v2.js (with multi-coord + maxDepth options)
  4. extract-visual-v2.js
  5. (optional) extract-states-inventory.js + per-element hover/focus/active diff
  6. (optional) per-element screenshots clipped by rect
  7. validate-extraction.js  -> errors / warnings / stats

Legacy mode: runs scripts individually (slower, more control) (extract-structure-v2.js + extract-visual-v2.js)
plus extract-lazy-load.js. Triggered via --legacy.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

# Local modules
sys.path.insert(0, str(Path(__file__).resolve().parent))
import cdp_snapshot
from resource_harvester import ResourceHarvester

ROOT = Path(__file__).resolve().parent.parent  # webclone-skill root
ENHANCED_DIR = ROOT / "scripts" / "js"
LEGACY_DIR = ROOT / "scripts" / "js"  # fallback: same as enhanced


def auto_scroll_for_lazy_assets(page: Page, max_iterations: int = 30, step_ms: int = 600) -> None:
    """Scroll to bottom in chunks so the harvester sees every lazy-loaded image/font.
    Different from extract-lazy-load.js (which is a JS measurement) 鈥?this is the
    Python-side trigger so page.on('response') fires for everything."""
    last_h = 0
    same_count = 0
    for _ in range(max_iterations):
        h = page.evaluate("() => document.body.scrollHeight")
        if h == last_h:
            same_count += 1
            if same_count >= 2:
                break
        else:
            same_count = 0
        last_h = h
        page.evaluate("() => window.scrollBy(0, window.innerHeight)")
        page.wait_for_timeout(step_ms)
    page.evaluate("() => window.scrollTo(0, 0)")
    page.wait_for_timeout(300)


def find_script(name: str, prefer_enhanced: bool = True) -> Path:
    order = (ENHANCED_DIR, LEGACY_DIR) if prefer_enhanced else (LEGACY_DIR, ENHANCED_DIR)
    for d in order:
        p = d / name
        if p.exists():
            return p
    raise FileNotFoundError(f"Script not found in {ENHANCED_DIR} or {LEGACY_DIR}: {name}")


def load_script(name: str, prefer_enhanced: bool = True, replacements: dict[str, Any] | None = None) -> str:
    src = find_script(name, prefer_enhanced).read_text(encoding="utf-8")
    if replacements:
        for placeholder, value in replacements.items():
            src = src.replace(placeholder, json.dumps(value))  # always use json.dumps to escape properly
    return f"() => {{ {src} }}"


def run_eval(page: Page, name: str, prefer_enhanced: bool = True, replacements: dict[str, Any] | None = None, label: str | None = None) -> Any:
    label = label or name
    try:
        script = load_script(name, prefer_enhanced=prefer_enhanced, replacements=replacements)
        return page.evaluate(script)
    except Exception as e:
        print(f"  [ERROR] {label}: {e}", file=sys.stderr)
        return {"error": str(e), "script": name}


def capture_states(page: Page, candidates: list[dict[str, Any]], cap: int = 30) -> list[dict[str, Any]]:
    """For each candidate (sample), trigger hover / focus / active and diff styles."""
    diffs = []
    sample = candidates[:cap]
    for idx, c in enumerate(sample):
        sel = c.get("cssSelector")
        xpath = c.get("xpath")
        base = c.get("baseStyles") or {}
        if not sel or not xpath:
            continue
        record = {"selector": sel, "xpath": xpath, "tag": c.get("tag"), "text": c.get("text"), "rect": c.get("rect"), "states": {}}

        for state in ("hover", "focus", "active"):
            try:
                # reset: move pointer away to clear any prior hover
                page.mouse.move(0, 0)
                page.evaluate("() => document.activeElement && document.activeElement.blur()")
                page.wait_for_timeout(50)

                if state == "hover":
                    page.locator(sel).first.hover(timeout=2000)
                elif state == "focus":
                    page.locator(sel).first.focus(timeout=2000)
                elif state == "active":
                    loc = page.locator(sel).first
                    loc.hover(timeout=2000)
                    box = loc.bounding_box()
                    if not box:
                        continue
                    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
                    page.mouse.move(cx, cy)
                    page.mouse.down()
                page.wait_for_timeout(250)

                snap = run_eval(page, "extract-states-capture.js", replacements={"XPATH_PLACEHOLDER": xpath}, label=f"states[{state}]:{idx}")
                if state == "active":
                    page.mouse.up()
                if isinstance(snap, dict) and snap.get("found"):
                    state_styles = snap.get("styles") or {}
                    delta = {k: v for k, v in state_styles.items() if base.get(k) != v}
                    if delta:
                        record["states"][state] = delta
            except PWTimeout:
                continue
            except Exception as e:
                # one bad candidate shouldn't break the run
                print(f"  [WARN] state {state} on {sel[:60]}: {e}", file=sys.stderr)
                continue

        if record["states"]:
            diffs.append(record)
    return diffs


def safe_filename(s: str, idx: int) -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", s)[:40] or f"el-{idx}"
    return f"{idx:03d}_{base}.png"


def capture_element_screenshots(page: Page, items: list[dict[str, Any]], out_dir: Path, key: str, max_count: int = 40) -> list[dict[str, Any]]:
    out_dir.mkdir(parents=True, exist_ok=True)
    captures = []
    for i, it in enumerate(items[:max_count]):
        rect = it.get("rect") or it.get("viewport") or it.get("coords", {}).get("viewport")
        if not rect or rect.get("w", 0) <= 0 or rect.get("h", 0) <= 0:
            continue
        fname = safe_filename(it.get("text") or it.get("tag") or key, i)
        try:
            page.screenshot(path=str(out_dir / fname), clip={
                "x": max(0, rect["x"]), "y": max(0, rect["y"]),
                "width": rect["w"], "height": rect["h"]
            })
            captures.append({"key": key, "index": i, "file": str((out_dir / fname).relative_to(out_dir.parent)), "rect": rect, "label": it.get("text") or it.get("tag")})
        except Exception as e:
            print(f"  [WARN] screenshot {key}[{i}]: {e}", file=sys.stderr)
    return captures


def extract_enhanced(url: str, *, headless: bool, max_depth: int, capture_states_flag: bool, states_cap: int,
                     capture_screenshots: bool, screenshots_root: Path, wait_ms: int,
                     cdp_snapshot_flag: bool, harvest: bool, harvest_dir: Path | None,
                     shadow_flag: bool, cssom_flag: bool, multi_viewport: list[tuple[int, int]] | None) -> dict[str, Any]:
    out: dict[str, Any] = {"url": url, "mode": "enhanced", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S")}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        # Network harvester attached BEFORE navigation so we catch every response
        harvester = None
        if harvest:
            hd = harvest_dir or Path("./harvest")
            harvester = ResourceHarvester(out_dir=hd)
            harvester.attach(page)
            print(f"-> Harvester attached, dumping to {hd}")

        print(f"-> Navigating to {url}")
        try:
            page.goto(url, wait_until="networkidle", timeout=45000)
        except PWTimeout:
            print("  [WARN] networkidle timeout 鈥?continuing with domcontentloaded", file=sys.stderr)
        page.wait_for_timeout(wait_ms)

        if harvest:
            print("-> Auto-scrolling to trigger lazy assets for harvester")
            auto_scroll_for_lazy_assets(page)

        print("-> Phase: lazy-load")
        out["lazyLoad"] = run_eval(page, "extract-lazy-load.js", label="lazy-load")

        print(f"-> Phase: structure-v2 (maxDepth={max_depth})")
        out_struct = run_eval(page, "extract-structure-v2.js", replacements={"OPTIONS_PLACEHOLDER": {"maxDepth": max_depth, "maxTextNodes": 0, "includeHidden": False, "collectFixed": True}}, label="structure-v2")
        if isinstance(out_struct, dict):
            out.update(out_struct)
        else:
            out["structureError"] = out_struct

        print("-> Phase: visual-v2")
        out["visual"] = run_eval(page, "extract-visual-v2.js", label="visual-v2")

        if capture_states_flag:
            print(f"-> Phase: states inventory (cap={states_cap})")
            inv = run_eval(page, "extract-states-inventory.js", label="states-inventory")
            if isinstance(inv, dict) and inv.get("candidates"):
                out["statesInventory"] = {"totalFound": inv.get("totalFound"), "sampleSize": min(len(inv["candidates"]), states_cap)}
                print(f"   capturing {min(len(inv['candidates']), states_cap)}/{inv.get('totalFound')} candidates...")
                out["states"] = capture_states(page, inv["candidates"], cap=states_cap)
                print(f"   captured {len(out['states'])} elements with non-empty state diffs")

        if capture_screenshots:
            print("-> Phase: element screenshots")
            shot_dir = screenshots_root
            captures = []
            visual = out.get("visual") or {}
            if isinstance(visual.get("buttonCandidates"), list):
                captures += capture_element_screenshots(page, visual["buttonCandidates"], shot_dir / "buttons", "button", max_count=40)
            if isinstance(out.get("fixedElements"), list):
                captures += capture_element_screenshots(page, out["fixedElements"], shot_dir / "fixed", "fixed", max_count=20)
            out["elementScreenshots"] = captures
            print(f"   wrote {len(captures)} crops to {shot_dir}")

        if cssom_flag:
            print("-> Phase: full CSSOM")
            out["cssom"] = run_eval(page, "extract-cssom.js", label="cssom")
            t = (out["cssom"] or {}).get("totals") or {}
            print(f"   {t.get('rules', 0)} rules, {t.get('mediaQueries', 0)} @media, {t.get('keyframes', 0)} @keyframes, {t.get('fontFaces', 0)} @font-face, {t.get('crossOrigin', 0)} cross-origin sheets")

        if shadow_flag:
            print("-> Phase: shadow DOM")
            out["shadow"] = run_eval(page, "extract-shadow.js", label="shadow")
            print(f"   {(out['shadow'] or {}).get('totalHosts', 0)} shadow hosts found")

        if cdp_snapshot_flag:
            print("-> Phase: CDP DOMSnapshot (sub-pixel layout)")
            try:
                snap = cdp_snapshot.capture(page)
                out["cdpSnapshot"] = snap
                docs = snap.get("documents", [])
                if docs:
                    d0 = docs[0]
                    print(f"   doc[0]: {d0['nodeCount']} nodes, {d0['layoutCount']} layout nodes, {d0['textBoxCount']} text boxes")
            except Exception as e:
                print(f"  [ERROR] CDP snapshot: {e}", file=sys.stderr)
                out["cdpSnapshotError"] = str(e)

        if multi_viewport:
            print(f"-> Phase: multi-viewport ({len(multi_viewport)} sizes)")
            mv = []
            for vw, vh in multi_viewport:
                try:
                    page.set_viewport_size({"width": vw, "height": vh})
                    page.wait_for_timeout(400)
                    rec = {"viewport": {"w": vw, "h": vh}}
                    rec["structure"] = run_eval(page, "extract-structure-v2.js",
                                                replacements={"OPTIONS_PLACEHOLDER": {"maxDepth": 6, "maxTextNodes": 100, "includeHidden": False, "collectFixed": True}},
                                                label=f"struct@{vw}x{vh}")
                    if cdp_snapshot_flag:
                        try:
                            rec["cdpSnapshot"] = cdp_snapshot.capture(page)
                        except Exception as e:
                            rec["cdpSnapshotError"] = str(e)
                    mv.append(rec)
                    print(f"   captured {vw}x{vh}: {((rec.get('structure') or {}).get('_stats') or {}).get('kept')} structural nodes")
                except Exception as e:
                    print(f"  [WARN] viewport {vw}x{vh}: {e}", file=sys.stderr)
            out["multiViewport"] = mv
            # restore default viewport
            page.set_viewport_size({"width": 1440, "height": 900})

        print("-> Phase: validation")
        # Trim DATA before passing to avoid massive script size
        validation_payload = {
            "structure": out.get("structure"),
            "_stats": out.get("_stats"),
            "textNodes": out.get("textNodes", [])[:50],  # only need count for validator
            "_truncated": out.get("_truncated"),
            "scrollState": out.get("scrollState"),
            "fixedElements": out.get("fixedElements"),
            "lazyLoad": out.get("lazyLoad"),
            "svgIcons": (out.get("visual") or {}).get("svgIcons"),
            "buttonCandidates": (out.get("visual") or {}).get("buttonCandidates"),
            "cssCustomProperties": (out.get("visual") or {}).get("cssCustomProperties"),
            "fontFaces": (out.get("visual") or {}).get("fontFaces"),
            "typography": (out.get("visual") or {}).get("typography")
        }
        # restore actual textNodes count for the stats line
        if isinstance(out.get("textNodes"), list):
            validation_payload["textNodes"] = [None] * len(out["textNodes"])
        out["validation"] = run_eval(page, "validate-extraction.js", replacements={"EXTRACTION_PLACEHOLDER": validation_payload}, label="validate")

        if harvester:
            harvester.detach(page)
            manifest = harvester.finalize()
            out["harvest"] = {
                "dir": str(harvester.out_dir),
                "totalCaptured": manifest["totalCaptured"],
                "totalSkipped": manifest["totalSkipped"],
                "byBucket": manifest["byBucket"]
            }
            print(f"-> Harvested {manifest['totalCaptured']} files: {manifest['byBucket']}")

        browser.close()
    return out


def extract_legacy(url: str, scripts: list[str], headless: bool, wait_ms: int) -> dict[str, Any]:
    out: dict[str, Any] = {"url": url, "mode": "legacy", "scripts": scripts}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")
        page.wait_for_timeout(wait_ms)
        for name in scripts:
            print(f"-> Executing (legacy): {name}")
            key = name.replace(".js", "").replace("extract-", "")
            out[key] = run_eval(page, name, prefer_enhanced=False, label=name)
        browser.close()
    return out


def print_summary(result: dict[str, Any]) -> None:
    print("\n=== Extraction Summary ===")
    print(f"  mode: {result.get('mode')}")
    if result.get("mode") == "enhanced":
        ll = result.get("lazyLoad") or {}
        print(f"  lazy-load: {ll.get('iterations')} iters, {ll.get('initialHeight')}->{ll.get('finalHeight')}px (+{ll.get('elementsAdded')} els)")
        stats = result.get("_stats") or {}
        print(f"  structure: kept={stats.get('kept')} totalEls={stats.get('totalEls')} maxDepth={stats.get('maxDepthReached')}")
        print(f"  textNodes: {len(result.get('textNodes', []))}")
        print(f"  fixedElements: {len(result.get('fixedElements', []))}")
        v = result.get("visual") or {}
        print(f"  buttons (semantic+visual): {len(v.get('buttonCandidates', []))}")
        print(f"  svgIcons: {len(v.get('svgIcons', []))}  images: {len(v.get('images', []))}  bgImages: {len(v.get('bgImages', []))}")
        print(f"  cssCustomProperties: {len(v.get('cssCustomProperties', {}))}  fontFaces: {len(v.get('fontFaces', []))}")
        print(f"  pseudoElements: {len(v.get('pseudoElements', []))}")
        if "cssom" in result:
            t = (result["cssom"] or {}).get("totals") or {}
            print(f"  cssom: rules={t.get('rules')} @media={t.get('mediaQueries')} @keyframes={t.get('keyframes')} @font-face={t.get('fontFaces')} crossOrigin={t.get('crossOrigin')}")
        if "shadow" in result:
            print(f"  shadow hosts: {(result['shadow'] or {}).get('totalHosts', 0)}")
        if "cdpSnapshot" in result:
            d = (result["cdpSnapshot"].get("documents") or [{}])[0]
            print(f"  cdpSnapshot doc[0]: nodes={d.get('nodeCount')} layout={d.get('layoutCount')} textBoxes={d.get('textBoxCount')}")
        if "multiViewport" in result:
            print(f"  multi-viewport: {len(result['multiViewport'])} sizes")
        if "states" in result:
            print(f"  states captured: {len(result['states'])}")
        if "elementScreenshots" in result:
            print(f"  element screenshots: {len(result['elementScreenshots'])}")
        if "harvest" in result:
            h = result["harvest"]
            print(f"  harvest: {h['totalCaptured']} files into {h['dir']}  ({h['byBucket']})")
        val = result.get("validation") or {}
        print(f"  validation: errors={len(val.get('errors', []))}  warnings={len(val.get('warnings', []))}")
        for e in val.get("errors", [])[:5]:
            print(f"    ! {e}")
        for w in val.get("warnings", [])[:8]:
            print(f"    ~ {w}")
    else:
        for k, v in result.items():
            if k in ("url", "mode", "scripts"):
                continue
            if isinstance(v, dict):
                print(f"  {k}: keys={list(v.keys())[:6]}")


def parse_viewports(spec: str | None) -> list[tuple[int, int]] | None:
    if not spec:
        return None
    out = []
    for part in spec.split(","):
        part = part.strip()
        if "x" in part:
            w, h = part.split("x", 1)
            out.append((int(w), int(h)))
    return out or None


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract DOM structure from websites")
    parser.add_argument("url")
    parser.add_argument("--output", "-o", default="extraction-result.json")
    parser.add_argument("--legacy", action="store_true", help="Use legacy extract-structure/visual scripts")
    parser.add_argument("--scripts", nargs="+", default=None, help="(legacy mode only) override script list")
    parser.add_argument("--headless", dest="headless", action="store_true", default=True)
    parser.add_argument("--visible", dest="headless", action="store_false")
    parser.add_argument("--wait", type=int, default=2000, help="Settle wait after navigation (ms)")
    parser.add_argument("--max-depth", type=int, default=10)
    parser.add_argument("--capture-states", action="store_true")
    parser.add_argument("--states-cap", type=int, default=30)
    parser.add_argument("--capture-screenshots", action="store_true")
    parser.add_argument("--screenshots-dir", default=None, help="Directory for element screenshots (default: <output>-screenshots)")
    parser.add_argument("--cdp-snapshot", action="store_true", help="Capture sub-pixel CDP DOMSnapshot (layout + paintOrders + textBoxes)")
    parser.add_argument("--harvest", action="store_true", help="Dump every image/font/css/svg the page loads to disk")
    parser.add_argument("--harvest-dir", default=None, help="Directory for harvested resources (default: <output>-harvest)")
    parser.add_argument("--shadow", action="store_true", help="Pierce open shadow roots and report internals")
    parser.add_argument("--cssom", action="store_true", help="Walk full CSSOM (every rule + @media + @keyframes + @font-face)")
    parser.add_argument("--multi-viewport", default=None, help="Comma-separated viewports e.g. '375x667,768x1024,1280x800,1920x1080'")
    parser.add_argument("--max", action="store_true", help="Shortcut: enable cdp-snapshot + harvest + shadow + cssom + capture-states + capture-screenshots")
    args = parser.parse_args()

    if args.max:
        args.cdp_snapshot = True
        args.harvest = True
        args.shadow = True
        args.cssom = True
        args.capture_states = True
        args.capture_screenshots = True

    print("=" * 60)
    print(" WebClone Extractor")
    print(f"   enhanced scripts: {ENHANCED_DIR}")
    print(f"   legacy   scripts: {LEGACY_DIR}")
    print(f"   mode: {'legacy' if args.legacy else 'enhanced'}")
    print("=" * 60)

    if args.legacy:
        scripts = args.scripts or ["extract-structure-v2.js", "extract-visual-v2.js"]
        result = extract_legacy(args.url, scripts, args.headless, args.wait)
    else:
        out_path = Path(args.output)
        shot_dir = Path(args.screenshots_dir) if args.screenshots_dir else out_path.with_suffix("").with_name(out_path.stem + "-screenshots")
        harvest_dir = Path(args.harvest_dir) if args.harvest_dir else out_path.with_suffix("").with_name(out_path.stem + "-harvest")
        result = extract_enhanced(
            args.url,
            headless=args.headless,
            max_depth=args.max_depth,
            capture_states_flag=args.capture_states,
            states_cap=args.states_cap,
            capture_screenshots=args.capture_screenshots,
            screenshots_root=shot_dir,
            wait_ms=args.wait,
            cdp_snapshot_flag=args.cdp_snapshot,
            harvest=args.harvest,
            harvest_dir=harvest_dir,
            shadow_flag=args.shadow,
            cssom_flag=args.cssom,
            multi_viewport=parse_viewports(args.multi_viewport)
        )

    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print_summary(result)
    print(f"\nResults saved to: {args.output}")


if __name__ == "__main__":
    main()








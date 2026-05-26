"""Test with REAL bounding boxes from the baidu translate page structure.
These coordinates are derived from the actual extracted element positions."""
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

# Real bounding boxes from the baidu translate page, identified from the extraction
# data and the actual structure-v2 output
MOCK_BOUNDARIES = [
    # header area — "在线翻译" text is at y=21, h=17, so header roughly 0-60
    {"label": "page-header", "bounding_box": {"x1": 0, "y1": 0, "x2": 1440, "y2": 60},
     "type_hint": "layout", "notes": "Top bar with logo and nav links"},

    # nav-links cluster around x=151..295 (在线翻译, 我的文件 etc.)
    {"label": "main-nav", "bounding_box": {"x1": 140, "y1": 18, "x2": 500, "y2": 40},
     "type_hint": "interactive", "notes": "Primary navigation links"},

    # the sticky bar area — y=60 from fixedElements extraction
    {"label": "sticky-bar", "bounding_box": {"x1": 20, "y1": 60, "x2": 1351, "y2": 110},
     "type_hint": "layout", "notes": "Sticky filter/tab bar"},

    # upload area card — y=544..673 from button candidates
    {"label": "upload-section", "bounding_box": {"x1": 35, "y1": 450, "x2": 670, "y2": 680},
     "type_hint": "content", "notes": "Upload document card"},
]

def main():
    url = "https://fanyi.baidu.com/mtpe-individual/transText#/"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(url, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(300)

        print(f"[1/3] Navigated to {url}")
        print(f"[2/3] Mock boundaries: {len(MOCK_BOUNDARIES)} regions")
        print(f"[3/3] Mapping to DOM...")

        js_setup = f"window.VCOMPONENTS = {json.dumps(MOCK_BOUNDARIES)};"
        result = page.evaluate(f"""() => {{
            {js_setup}
            {open(str(Path(__file__).parent / 'scripts' / 'map-dom.js'), encoding='utf-8').read()}
            return mapDomComponents(window.VCOMPONENTS);
        }}""")
        browser.close()

    out = {"url": url, "components": result["components"], "total": result["total"]}
    out_path = Path("test-p0-components.json")
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"DOM-mapped {out['total']}/{len(MOCK_BOUNDARIES)} components")
    for c in out["components"]:
        dom = c.get("dom") or {}
        sel = (dom.get("selector") or "NO_DOM_MATCH")[:75]
        conf = c.get("confidence", 0)
        area_ratio = f"{c.get('intersection_area', 0)}/{c.get('box_area', 1)}"
        tag = dom.get("tag", "?")
        text = (dom.get("textContent") or "")[:40]
        print(f"  [{conf:.0%}] {c['label']:25s} → {sel}")
        print(f"        tag={tag}  area={area_ratio}  text='{text}'")
    print(f"\nSaved: {out_path}")
    return out

if __name__ == "__main__":
    main()

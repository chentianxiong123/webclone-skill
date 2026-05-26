"""
linked-pages-recorder.py 鈥?P2.2: Record all navigation links from extraction
without following them. Produces a linked-pages.json manifest for the clone.

Usage:
    python linked-pages-recorder.py <url> --output linked-pages.json
    python linked-pages-recorder.py <extraction.json> [--output linked-pages.json]
    python linked-pages-recorder.py <url> --use-extraction <extraction.json>
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent / "js"


def load_script(name: str) -> str:
    p = SCRIPT_DIR / name
    if p.exists():
        return p.read_text(encoding="utf-8")
    raise FileNotFoundError(f"Script not found: {name}")


def extract_from_url(url: str, wait_ms: int = 2000) -> dict:
    """Use Playwright + extract-links.js to get all links from a live URL."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(url, wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(wait_ms)

        js = load_script("extract-links.js")
        result = page.evaluate(f"() => {{ {js} }}")
        browser.close()

    return result


def extract_links_from_html(html_path: Path) -> list[dict]:
    """Extract links directly from a saved HTML file (without browser)."""
    from html.parser import HTMLParser
    import re

    content = html_path.read_text(encoding="utf-8", errors="replace")

    class LinkExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.links = []

        def handle_starttag(self, tag, attrs):
            if tag == "a":
                href = dict(attrs).get("href", "")
                self.links.append({
                    "href": href,
                    "text": "",
                    "tag": "a",
                    "selector": f"a[href='{href}']" if href else "",
                    "bounding_box": {},
                    "classes": []
                })

    parser = LinkExtractor()
    parser.feed(content)

    text_map = {}
    for m in re.finditer(r'<a[^>]*>(.*?)</a>', content, re.DOTALL | re.IGNORECASE):
        key = m.group(0)
        text_map[key] = m.group(1).strip()

    for link in parser.links:
        for full_tag, link_text in text_map.items():
            if link["href"] in full_tag:
                link["text"] = link_text[:100]
                break

    return parser.links


def record_from_extraction(extraction_json: Path, output_json: Path | None = None) -> dict:
    """Read extraction JSON, use page.goto + extract-links.js to get all links."""
    from playwright.sync_api import sync_playwright

    data = json.loads(extraction_json.read_text(encoding="utf-8"))
    url = data.get("url", "") if isinstance(data, dict) else ""
    if not url:
        raise ValueError(f"No 'url' field in {extraction_json}")

    print(f"  Extracting links from: {url}")
    result = extract_from_url(url, wait_ms=2000)

    if output_json:
        output_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  Written: {output_json} ({result['total']} links)")

    return result


def record_from_url(url: str, output_json: Path | None = None, wait_ms: int = 2000) -> dict:
    """Navigate URL and extract all links via Playwright + extract-links.js."""
    print(f"  Navigating to: {url}")
    result = extract_from_url(url, wait_ms=wait_ms)

    if output_json:
        output_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  Written: {output_json} ({result['total']} links)")

    return result


def record_from_html(html_path: Path, output_json: Path | None = None) -> dict:
    """Extract links directly from a saved HTML file (no browser)."""
    print(f"  Parsing HTML: {html_path}")
    links = extract_links_from_html(html_path)

    result = {
        "source": str(html_path),
        "total": len(links),
        "links": links,
        "summary": {
            "http": sum(1 for l in links if l["href"].startswith("http")),
            "hash": sum(1 for l in links if l["href"].startswith("#")),
            "relative": sum(1 for l in links if not l["href"].startswith(("http", "#", "mailto:", "tel:"))),
            "mailto": sum(1 for l in links if l["href"].startswith("mailto:")),
            "tel": sum(1 for l in links if l["href"].startswith("tel:")),
            "inNav": 0, "inHeader": 0, "spaInternal": 0  # not available from raw HTML
        }
    }

    if output_json:
        output_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  Written: {output_json} ({len(links)} links)")

    return result


def main():
    ap = argparse.ArgumentParser(description="P2.2: Record navigation links from URL/JSON/HTML (no following)")
    ap.add_argument("source", nargs="?", help="URL, extraction JSON, or HTML file")
    ap.add_argument("--output", "-o", type=Path, help="Output JSON path")
    ap.add_argument("--extraction-json", type=Path, dest="extraction_json",
                    help="Extraction JSON (extracts url from it)")
    ap.add_argument("--url", help="URL to navigate and extract links from")
    ap.add_argument("--html", type=Path, dest="html_file",
                    help="Parse HTML file directly (no browser)")
    ap.add_argument("--wait", type=int, default=2000, help="Wait ms after load")
    args = ap.parse_args()

    output = args.output or Path("linked-pages.json")

    # Determine source type
    if args.url:
        result = record_from_url(args.url, output, args.wait)
    elif args.html_file:
        result = record_from_html(args.html_file, output)
    elif args.extraction_json:
        result = record_from_extraction(args.extraction_json, output)
    elif args.source:
        src = Path(args.source)
        if src.suffix.lower() == ".json":
            # Try as extraction JSON first
            try:
                data = json.loads(src.read_text(encoding="utf-8"))
                if isinstance(data, dict) and "url" in data:
                    result = record_from_extraction(src, output)
                else:
                    result = record_from_url(src.read_text().strip(), output, args.wait)
            except json.JSONDecodeError:
                # Not JSON 鈥?treat as URL
                result = record_from_url(src.read_text().strip(), output, args.wait)
        elif src.suffix.lower() in (".html", ".htm"):
            result = record_from_html(src, output)
        else:
            # Assume URL
            result = record_from_url(str(src), output, args.wait)
    else:
        ap.print_help()
        return

    print(f"\n{'='*60}")
    print(f"Link inventory: {result['total']} links")
    summary = result.get("summary", {})
    for key in ["http", "hash", "relative", "mailto", "tel"]:
        count = summary.get(key, 0)
        if count > 0:
            print(f"  {key:12s}: {count}")

    links = result.get("links", [])
    nav_count = sum(1 for l in links if l.get("inNav"))
    header_count = sum(1 for l in links if l.get("inHeader"))
    spa_internal_count = sum(1 for l in links if l.get("isSpaInternal"))
    if nav_count:
        print(f"  inNav       : {nav_count}")
    if header_count:
        print(f"  inHeader    : {header_count}")
    if spa_internal_count:
        print(f"  spaInternal : {spa_internal_count}  (use <router-link> in Vue)")

    if links:
        print(f"\nSample links:")
        for link in links[:5]:
            href = link.get("href", "")[:70]
            text = link.get("text", "")[:40]
            protocol = link.get("protocol", "")
            print(f"  [{protocol:16s}] {href}")
            if text:
                print(f"    text: {text}")

    print(f"\nFull manifest: {output}")
    return result


if __name__ == "__main__":
    main()

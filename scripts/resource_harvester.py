"""
Resource harvester — intercept every network response while a page loads
and dump images/fonts/stylesheets/svgs to disk with a manifest.

Usage:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        harvester = ResourceHarvester(out_dir=Path("./harvest"))
        harvester.attach(page)
        page.goto(url)
        ...
        manifest = harvester.finalize()
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import Page, Response

# content-type prefix -> bucket directory
BUCKETS: list[tuple[str, str]] = [
    ("image/svg", "svg"),
    ("image/", "images"),
    ("font/", "fonts"),
    ("application/font", "fonts"),
    ("application/x-font", "fonts"),
    ("text/css", "css"),
    ("application/javascript", "js"),
    ("text/javascript", "js"),
    ("application/json", "json"),
]

# also recognize by extension when content-type lies
EXT_BUCKETS = {
    ".woff": "fonts", ".woff2": "fonts", ".ttf": "fonts", ".otf": "fonts", ".eot": "fonts",
    ".png": "images", ".jpg": "images", ".jpeg": "images", ".gif": "images", ".webp": "images", ".avif": "images", ".ico": "images",
    ".svg": "svg",
    ".css": "css",
    ".js": "js", ".mjs": "js"
}


def _safe_name(url: str, content_type: str) -> str:
    parsed = urlparse(url)
    last = parsed.path.rsplit("/", 1)[-1] or "index"
    last = re.sub(r"[^A-Za-z0-9._-]+", "_", last)[:80]
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    if "." not in last:
        ext = ""
        for k, v in EXT_BUCKETS.items():
            if k in content_type:
                ext = k
                break
        last = last + ext
    return f"{h}_{last}"


def _bucket(url: str, content_type: str) -> str | None:
    ct = (content_type or "").lower()
    for prefix, b in BUCKETS:
        if ct.startswith(prefix):
            return b
    path = urlparse(url).path.lower()
    for ext, b in EXT_BUCKETS.items():
        if path.endswith(ext):
            return b
    return None


class ResourceHarvester:
    def __init__(self, out_dir: Path, max_bytes_per_file: int = 8 * 1024 * 1024) -> None:
        self.out_dir = Path(out_dir)
        self.max_bytes = max_bytes_per_file
        self.records: list[dict[str, Any]] = []
        self._seen: set[str] = set()
        self._handler = None

    def attach(self, page: Page) -> None:
        self.out_dir.mkdir(parents=True, exist_ok=True)

        def on_response(resp: Response) -> None:
            try:
                url = resp.url
                if url in self._seen:
                    return
                if url.startswith("data:") or url.startswith("blob:"):
                    return
                ct = resp.headers.get("content-type", "")
                bucket = _bucket(url, ct)
                if not bucket:
                    return
                self._seen.add(url)
                # body() raises if response was a 304 or aborted
                try:
                    body = resp.body()
                except Exception as e:
                    self.records.append({"url": url, "bucket": bucket, "skipped": str(e)})
                    return
                if len(body) > self.max_bytes:
                    self.records.append({"url": url, "bucket": bucket, "skipped": f"size>{self.max_bytes}"})
                    return
                bucket_dir = self.out_dir / bucket
                bucket_dir.mkdir(parents=True, exist_ok=True)
                fname = _safe_name(url, ct)
                fpath = bucket_dir / fname
                fpath.write_bytes(body)
                self.records.append({
                    "url": url,
                    "bucket": bucket,
                    "contentType": ct,
                    "status": resp.status,
                    "size": len(body),
                    "path": str(fpath.relative_to(self.out_dir))
                })
            except Exception as e:
                # swallow — don't break the page load
                self.records.append({"url": getattr(resp, "url", "?"), "error": str(e)})

        self._handler = on_response
        page.on("response", on_response)

    def detach(self, page: Page) -> None:
        if self._handler:
            try: page.remove_listener("response", self._handler)
            except Exception: pass

    def finalize(self) -> dict[str, Any]:
        manifest = {
            "totalCaptured": len([r for r in self.records if "path" in r]),
            "totalSkipped": len([r for r in self.records if "skipped" in r or "error" in r]),
            "byBucket": {},
            "records": self.records
        }
        for r in self.records:
            if "path" in r:
                b = r["bucket"]
                manifest["byBucket"][b] = manifest["byBucket"].get(b, 0) + 1
        manifest_path = self.out_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        return manifest

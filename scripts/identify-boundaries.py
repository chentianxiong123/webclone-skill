"""
identify-boundaries.py — Multivodal component boundary detection.

Uses a vision-capable LLM API to look at a page screenshot and identify
visual component boundaries. Returns a structured list of components
with labels, bounding boxes, and type hints.

Provider-agnostic: currently supports OpenAI GPT-4o / Anthropic Claude 3.5 Sonnet.
Set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment.

Usage:
    python identify-boundaries.py <screenshot.png> [--output boundaries.json]
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from typing import Literal

DEFAULT_PROMPT = """\
You are a UI component detection system. Look at the screenshot of a web page.
Identify every visually distinct component that has a clear boundary on screen.
A component boundary is defined as: a rectangular region that a designer
would treat as a single unit — it has internal coherence and is separated
from its neighbors by whitespace, borders, or background color changes.

For each component, output:
- label: a short descriptive name (e.g. "header-nav", "hero-banner", "pricing-card")
- bounding_box: {x1, y1, x2, y2} in PIXELS (from top-left of the screenshot)
- type_hint: "layout" | "interactive" | "content" | "media" | "form" | "overlay"
- notes: one sentence describing what this component does

Rules:
- Cover EVERY visually distinct region. Overlap is forbidden.
- Layout containers (header, sidebar, footer, section) are components.
- Interactive elements (buttons, inputs, tabs) are components if visually prominent.
- Content blocks (cards, article previews) are components.
- Overlays (modals, toasts, dropdowns) are components — mark type_hint as "overlay".
- Do NOT name things by their text content. Use structural names.
- Pixel coordinates must be integers. x1 < x2, y1 < y2.
- Be thorough. Missing a component = failing the task.
- Output ONLY valid JSON in this exact format, no markdown, no explanation:

[
  {"label": "header-bar", "bounding_box": {"x1": 0, "y1": 0, "x2": 1440, "y2": 64}, "type_hint": "layout", "notes": "Top navigation bar with logo and nav links"},
  {"label": "hero-section", "bounding_box": {"x1": 0, "y1": 64, "x2": 1440, "y2": 400}, "type_hint": "content", "notes": "Main hero with headline and CTA"},
  ...
]
"""


def load_image_b64(path: Path) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def call_openai(image_b64: str, model: str = "gpt-4o") -> list[dict]:
    import openai
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    resp = client.chat.completions.create(
        model=model,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}},
                {"type": "text", "text": DEFAULT_PROMPT}
            ]
        }],
        max_tokens=4096,
        temperature=0
    )
    raw = resp.choices[0].message.content.strip()
    # strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def call_anthropic(image_b64: str, model: str = "claude-sonnet-4-20250514") -> list[dict]:
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
    resp = client.messages.create(
        model=model,
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": image_b64}},
                {"type": "text", "text": DEFAULT_PROMPT}
            ]
        }]
    )
    # find json in response
    raw = resp.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def detect(
    screenshot_path: str,
    provider: Literal["openai", "anthropic"] | None = None,
    model: str | None = None,
    output_path: str | None = None
) -> dict[str, Any]:
    p = Path(screenshot_path)
    if not p.exists():
        raise FileNotFoundError(f"Screenshot not found: {screenshot_path}")

    image_b64 = load_image_b64(p)
    img_w, img_h = _image_size(p)

    # Auto-detect provider
    if provider is None:
        if os.environ.get("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            provider = "openai"
        else:
            raise RuntimeError("Set ANTHROPIC_API_KEY or OPENAI_API_KEY in environment")

    if provider == "anthropic":
        results = call_anthropic(image_b64, model=model or "claude-sonnet-4-20250514")
    else:
        results = call_openai(image_b64, model=model or "gpt-4o")

    # Validate coordinates
    validated = []
    for r in results:
        bb = r.get("bounding_box", {})
        x1 = max(0, int(bb.get("x1", 0)))
        y1 = max(0, int(bb.get("y1", 0)))
        x2 = min(img_w, int(bb.get("x2", img_w)))
        y2 = min(img_h, int(bb.get("y2", img_h)))
        if x1 >= x2 or y1 >= y2:
            continue
        validated.append({
            "label": r.get("label", "unknown"),
            "bounding_box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "type_hint": r.get("type_hint", "content"),
            "notes": r.get("notes", "")
        })

    output = {
        "screenshot": str(p.resolve()),
        "image_width": img_w,
        "image_height": img_h,
        "component_count": len(validated),
        "provider": provider,
        "model": model,
        "components": validated
    }

    if output_path:
        Path(output_path).write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {len(validated)} components to {output_path}")

    return output


def _image_size(path: Path) -> tuple[int, int]:
    import struct
    # PNG: read width/height from IHDR chunk at offset 16
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        w = struct.unpack(">I", data[16:20])[0]
        h = struct.unpack(">I", data[20:24])[0]
        return w, h
    # JPEG: use minimal library
    try:
        from PIL import Image
        im = Image.open(str(path))
        return im.size
    except ImportError:
        return 0, 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Detect component boundaries via multivodal LLM")
    ap.add_argument("screenshot", help="Path to screenshot.png")
    ap.add_argument("--output", "-o", help="Output JSON path")
    ap.add_argument("--provider", choices=["openai", "anthropic"], default=None)
    ap.add_argument("--model", default=None)
    args = ap.parse_args()
    result = detect(args.screenshot, provider=args.provider, model=args.model, output_path=args.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))

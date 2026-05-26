"""
pixel-diff.py — Pixel-level image comparison for component verification.
Uses PIL + numpy for a simple, dependency-light diff.
Outputs: match %, diff heatmap PNG, and a per-channel breakdown.
"""
from __future__ import annotations

import numpy as np
from pathlib import Path
from PIL import Image

DEFAULT_THRESHOLD = 10  # per-channel RGB difference threshold
DEFAULT_THRESHOLD_B = 30  # larger threshold for background differences


def diff_images(
    img_a: str | Path,
    img_b: str | Path,
    threshold: int = DEFAULT_THRESHOLD,
    output_diff: str | Path | None = None
) -> dict:
    """
    Compare two images pixel-by-pixel.
    Returns: { match_ratio, diff_pixels, total_pixels, diff_path }
    """
    a = Image.open(str(img_a)).convert("RGB")
    b = Image.open(str(img_b)).convert("RGB")

    # Must be same size to compare
    if a.size != b.size:
        wa, ha = a.size
        wb, hb = b.size
        # Scale b to match a
        b = b.resize((wa, ha), Image.LANCZOS)
        diff_path = str(output_diff) if output_diff else None
        return {
            "match_ratio": 0.0,
            "diff_pixels": wa * ha,
            "total_pixels": wa * ha,
            "note": f"Images differ in size {wa}x{ha} vs {wb}x{hb} — scaled b to a",
            "diff_path": diff_path,
            "size_mismatch": True
        }

    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)

    diff = np.abs(a_arr - b_arr)
    # Mark as different if ANY channel exceeds threshold
    diff_mask = diff.max(axis=2) > threshold

    total_pixels = a_arr.shape[0] * a_arr.shape[1]
    diff_pixels = int(diff_mask.sum())
    match_ratio = round((total_pixels - diff_pixels) / total_pixels * 100, 2)

    result = {
        "match_ratio": match_ratio,
        "diff_pixels": diff_pixels,
        "total_pixels": total_pixels,
        "diff_percent": round(diff_pixels / total_pixels * 100, 2),
        "size": {"width": a.size[0], "height": a.size[1]},
        "diff_path": None
    }

    if output_diff:
        diff_img = Image.fromarray(diff.astype(np.uint8))
        diff_img.save(str(output_diff))
        result["diff_path"] = str(output_diff)

    return result


def generate_diff_image(
    img_a: str | Path,
    img_b: str | Path,
    threshold: int = DEFAULT_THRESHOLD,
    output_heatmap: str | Path | None = None
) -> Image | None:
    """Generate a heatmap image where differing pixels are red."""
    try:
        from PIL import ImageDraw
    except ImportError:
        return None

    a = Image.open(str(img_a)).convert("RGB")
    b = Image.open(str(img_b)).convert("RGB")
    if a.size != b.size:
        return None

    a_arr = np.array(a, dtype=np.float32)
    b_arr = np.array(b, dtype=np.float32)

    diff = np.abs(a_arr - b_arr)
    diff_mask = diff.max(axis=2) > threshold

    heatmap = np.zeros((a_arr.shape[0], a_arr.shape[1], 3), dtype=np.uint8)
    # Green where same, red where different
    heatmap[~diff_mask] = [0, 200, 0]      # green for matching
    heatmap[diff_mask] = [255, 0, 0]       # red for differing
    # Fade to yellow at edges of diff regions (optional: just use red for now)

    img = Image.fromarray(heatmap)
    if output_heatmap:
        img.save(str(output_heatmap))
    return img


def diff_components(
    original_dir: Path,
    clone_dir: Path,
    components: list[dict],
    threshold: int = DEFAULT_THRESHOLD,
    output_base: Path | None = None
) -> list[dict]:
    """
    Diff all components between original and clone directories.
    components: list of { label, cropRect }
    Returns: list of { label, match_ratio, diff_percent, diff_pixels, diff_path }
    """
    results = []
    for comp in components:
        label = comp.get("label", "unknown")
        rect = comp.get("cropRect")
        if not rect:
            results.append({"label": label, "error": "no cropRect"})
            continue

        # Build expected filenames
        orig_path = original_dir / f"{label}.png"
        clone_path = clone_dir / f"{label}.png"

        if not orig_path.exists():
            results.append({"label": label, "error": f"original not found: {orig_path}"})
            continue

        diff_path = None
        if output_base:
            diff_path = output_base / f"{label}-diff.png"

        result = diff_images(orig_path, clone_path, threshold=threshold, output_diff=diff_path)
        result["label"] = label
        if diff_path and Path(diff_path).exists():
            result["diff_path"] = str(diff_path)
        results.append(result)

    return results


if __name__ == "__main__":
    import argparse
    import json

    ap = argparse.ArgumentParser(description="Pixel-diff two images or component directories")
    ap.add_argument("image_a", help="Original image or directory")
    ap.add_argument("image_b", help="Clone image or directory")
    ap.add_argument("--output", "-o", help="Diff heatmap output path")
    ap.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD)
    ap.add_argument("--heatmap", help="Generate heatmap to this path")
    ap.add_argument("--components", help="JSON file with component cropRects for batch diff")
    args = ap.parse_args()

    if args.components:
        import json
        comps = json.loads(Path(args.components).read_text())
        results = diff_components(Path(args.image_a), Path(args.image_b), comps, args.threshold, Path(args.image_a).parent / "diff")
        for r in results:
            status = "PASS" if r.get("match_ratio", 0) >= 90 else "FAIL" if r.get("match_ratio", 0) < 70 else "WARN"
            print(f"[{status}] {r['label']}: {r.get('match_ratio', 0)}% ({r.get('diff_pixels', 0)} diff px)")
    else:
        result = diff_images(args.image_a, args.image_b, args.threshold, args.output)
        if args.heatmap:
            generate_diff_image(args.image_a, args.image_b, args.threshold, args.heatmap)
        print(f"Match: {result['match_ratio']}%  Diff: {result['diff_pixels']}/{result['total_pixels']} px")
        if result.get("diff_path"):
            print(f"Diff image: {result['diff_path']}")
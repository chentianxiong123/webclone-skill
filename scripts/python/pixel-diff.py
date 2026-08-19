#!/usr/bin/env python3
"""
pixel-diff.py — Pixel-level comparison between original and clone screenshots.

Uses PIL (Pillow) + numpy for grid-based color matching and generates
a red/green heatmap showing differences.

Usage:
    python pixel-diff.py original.png clone.png --heatmap diff.png
    python pixel-diff.py original-crops/ clone-screenshots/ --components manifest.json
"""

import argparse
import json
import os
import sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont


def load_image(path):
    img = Image.open(path).convert('RGB')
    return np.array(img), img


def grid_color_match(orig, clone, grid_size=5):
    """Compare colors on a grid for a fast overall match score."""
    h, w = orig.shape[:2]
    orig_small = Image.fromarray(orig).resize((w // grid_size, h // grid_size))
    clone_small = Image.fromarray(clone).resize((w // grid_size, h // grid_size))

    orig_arr = np.array(orig_small).reshape(-1, 3)
    clone_arr = np.array(clone_small).reshape(-1, 3)

    diff = np.abs(orig_arr.astype(int) - clone_arr.astype(int))
    match = np.sum(diff <= 10) / len(diff) * 100
    return match


def full_pixel_diff(orig_arr, clone_arr):
    """Compute per-pixel difference."""
    diff = np.abs(orig_arr.astype(int) - clone_arr.astype(int))
    total_diff = diff.sum() / (diff.shape[0] * diff.shape[1] * 3 * 255) * 100
    return total_diff


def create_heatmap(orig_img, clone_img, output_path):
    """Create a red/green heatmap overlay showing differences."""
    min_w = min(orig_img.width, clone_img.width)
    min_h = min(orig_img.height, clone_img.height)

    orig_cropped = orig_img.crop((0, 0, min_w, min_h))
    clone_cropped = clone_img.crop((0, 0, min_w, min_h))

    orig_arr = np.array(orig_cropped).astype(int)
    clone_arr = np.array(clone_cropped).astype(int)

    diff = np.abs(orig_arr - clone_arr)
    mask = (diff.sum(axis=2) > 30).astype(np.uint8) * 255

    # Create heatmap: green = match, red = mismatch
    heatmap = np.zeros((min_h, min_w, 3), dtype=np.uint8)
    heatmap[mask == 0] = [0, 200, 0]   # green for match
    heatmap[mask > 0] = [200, 0, 0]     # red for mismatch

    heatmap_img = Image.fromarray(heatmap)
    heatmap_img.save(output_path)
    return mask


def compare_files(orig_path, clone_path, heatmap_path=None):
    """Compare two image files."""
    orig_arr, orig_img = load_image(orig_path)
    clone_arr, clone_img = load_image(clone_path)

    # Resize if dimensions differ
    if orig_arr.shape != clone_arr.shape:
        clone_img = clone_img.resize((orig_img.width, orig_img.height))
        clone_arr = np.array(clone_img)

    match_pct = grid_color_match(orig_arr, clone_arr)
    pixel_diff_pct = full_pixel_diff(orig_arr, clone_arr)

    mask = None
    if heatmap_path:
        mask = create_heatmap(orig_img, clone_img, heatmap_path)

    return {
        'match_percent': round(match_pct, 2),
        'pixel_diff_percent': round(pixel_diff_pct, 2),
        'heatmap': heatmap_path if heatmap_path else None,
    }


def compare_directories(orig_dir, clone_dir, components_path=None):
    """Compare directories of cropped component screenshots."""
    orig_files = sorted(f for f in os.listdir(orig_dir) if f.endswith(('.png', '.jpg')))
    clone_files = sorted(f for f in os.listdir(clone_dir) if f.endswith(('.png', '.jpg')))

    # Load component manifest if provided
    manifest = {}
    if components_path and os.path.exists(components_path):
        with open(components_path) as f:
            manifest = json.load(f)

    results = {}
    for f in orig_files:
        if f not in clone_files:
            results[f] = {'status': 'MISSING'}
            continue
        result = compare_files(
            os.path.join(orig_dir, f),
            os.path.join(clone_dir, f)
        )
        results[f] = result

    # Summary
    matched = [r for r in results.values() if r.get('match_percent', 0) > 85]
    warned = [r for r in results.values() if 70 <= r.get('match_percent', 0) <= 85]
    failed = [r for r in results.values() if r.get('match_percent', 0) < 70 or r.get('status') == 'MISSING']

    summary = {
        'total': len(results),
        'matched': len(matched),
        'warned': len(warned),
        'failed': len(failed),
        'average_match': round(np.mean([r.get('match_percent', 0) for r in results.values()]), 2),
    }

    print(f"\nPixel Diff Summary:")
    print(f"  Total components:  {summary['total']}")
    print(f"  Matched (>85%):    {summary['matched']}")
    print(f"  Warned (70-85%):   {summary['warned']}")
    print(f"  Failed (<70%):     {summary['failed']}")
    print(f"  Average match:     {summary['average_match']}%")

    if failed:
        print(f"\n  Failed components:")
        for f, r in results.items():
            if r.get('status') == 'MISSING' or r.get('match_percent', 0) < 70:
                status = 'MISSING' if r.get('status') == 'MISSING' else f"{r.get('match_percent', 0)}%"
                print(f"    ✗ {f}: {status}")

    return results, summary


def main():
    parser = argparse.ArgumentParser(description='Pixel diff comparison')
    parser.add_argument('original', help='Original screenshot or directory')
    parser.add_argument('clone', help='Clone screenshot or directory')
    parser.add_argument('--heatmap', '-h', help='Output heatmap file (for single file comparison)')
    parser.add_argument('--components', help='Component manifest JSON (for directory comparison)')
    args = parser.parse_args()

    if os.path.isfile(args.original):
        result = compare_files(args.original, args.clone, args.heatmap)
        print(f"\nPixel Diff Result:")
        print(f"  Color grid match: {result['match_percent']}%")
        print(f"  Pixel diff:       {result['pixel_diff_percent']}%")
        if result['heatmap']:
            print(f"  Heatmap:          {result['heatmap']}")

        threshold = 85
        if result['match_percent'] >= threshold:
            print(f"\n  ✓ PASS (>= {threshold}%)")
            sys.exit(0)
        elif result['match_percent'] >= 70:
            print(f"\n  ⚠ WARN (70-{threshold}%)")
            sys.exit(1)
        else:
            print(f"\n  ✗ FAIL (< 70%)")
            sys.exit(2)
    else:
        results, summary = compare_directories(args.original, args.clone, args.components)
        threshold = 85
        if summary['average_match'] >= threshold:
            print(f"\n  ✓ PASS (avg >= {threshold}%)")
            sys.exit(0)
        elif summary['average_match'] >= 70:
            print(f"\n  ⚠ WARN (70-{threshold}%)")
            sys.exit(1)
        else:
            print(f"\n  ✗ FAIL (avg < 70%)")
            sys.exit(2)


if __name__ == '__main__':
    main()

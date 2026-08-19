# Verification Reference

## Pixel Diff

Compare rendered screenshots of original and clone.

```bash
python scripts/python/pixel-diff.py original.png clone.png --heatmap diff.png
```

Output:
- Match percentage
- Red/green heatmap (diff.png)
- Per-component breakdown

## Component-Level Diff

```bash
# Compare component crops
python scripts/python/pixel-diff.py \
  original-crops/ \
  clone-screenshots/ \
  --components manifest.json
```

## Acceptance Thresholds

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Grid color match % | >85% | 70-85% | <70% |
| Heading count diff | 0 | 1-2 | >2 |
| Interactive element diff | <=2 | 3-5 | >5 |
| Landmark position diff | <10px | 10-25px | >25px |
| SVG count diff | <=2 | 3-5 | >5 |
| CSS value accuracy | 100% | 90-99% | <90% |

## Interaction Testing

```bash
node scripts/python/test-interactions.py --url http://localhost:3001
```

Tests:
- All clickable elements respond
- Hover states trigger
- Form inputs accept text
- Dropdowns expand
- Modals open/close

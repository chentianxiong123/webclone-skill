# Inspect Reference

Analyze page structure without downloading all assets.

## Quick Summary

```bash
pnpm dev:cli inspect <URL>
```

Output: title, element count, script count, top repeating structures.

## Structure Outline

```bash
pnpm dev:cli inspect <URL> --outline
```

Find repeating DOM patterns = component candidates.

## Locate Elements

```bash
pnpm dev:cli inspect <URL> --locate "Search"
```

Find elements by text content.

## Count Elements

```bash
pnpm dev:cli inspect <URL> --count ".card"
```

## Markdown View

```bash
pnpm dev:cli inspect <URL> --md --budget 2000
```

Render page HTML as Markdown for quick review.

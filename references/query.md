# Query Reference

Extract structured data from HTML pages using CSS selectors.

## Basic Query

```bash
pnpm dev:cli query <URL> ".card"
```

Extracts text content from matching elements.

## Row Extraction

```bash
pnpm dev:cli query <URL> ".item" --row "title=h2, link=a@href, price=.price"
```

Named fields with selectors, optionally with attribute extraction.

## Table Parsing

```bash
pnpm dev:cli query <URL> "table" --table
```

Parse HTML tables into rows with headers.

## Filter Rows

```bash
pnpm dev:cli query <URL> ".item" --row "name=h3, price=.price" --where "price > 10"
```

## Output Formats

| Flag | Format |
|------|--------|
| (default) | TSV |
| `--json` | JSON |
| `--count` | Element count only |
| `--html` | Raw innerHTML |

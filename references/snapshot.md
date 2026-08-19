# Snapshot Reference

Engine: `@web-clone/core` via CLI

## Basic Snapshot

```bash
pnpm dev:cli <URL> -o <OUTPUT_DIR>
```

## Full Snapshot with Components

```bash
pnpm dev:cli <URL> \
  -o <OUTPUT> \
  --adapter playwright \
  --extract-components \
  --max-assets 200 \
  --concurrency 6 \
  --timeout 15000 \
  --retry-count 2
```

## Resource Control

| Flag | Default | Description |
|------|---------|-------------|
| `--max-assets` | 100 | Max resources to download |
| `--max-file-size` | 50MB | Per-file size limit |
| `--resource-preset` | default | none / minimal / default / no-media / aggressive |
| `--include-wasm` | false | Include .wasm |
| `--include-media` | false | Include video + audio |
| `--include-fonts` | false | Include fonts |
| `--exclude-images` | false | Exclude image files |
| `--exclude-css` | false | Exclude CSS |
| `--exclude-js` | false | Exclude JS |

## Browser Options

| Flag | Description |
|------|-------------|
| `--adapter playwright` | Use Playwright |
| `--adapter puppeteer` | Use Puppeteer |
| `--headed` | Visible browser (for debugging) |
| `--viewport 1920x1080` | Custom viewport |
| `--user-agent <ua>` | Custom UA |
| `--locale zh-CN` | Locale setting |
| `--hybrid` | Browser for HTML, HTTP pool for assets |

## Output Modes

| Flag | Description |
|------|-------------|
| `-m bundle` | Directory structure with separated resources (default) |
| `-m single` | Single self-contained HTML file |
| `--pretty` | Prettify HTML output |
| `--no-inline` | Skip data URI inlining |

## Validation

```bash
# Validate an existing snapshot
pnpm dev:cli <OUTPUT_DIR> --validate

# Clean broken files
pnpm dev:cli <OUTPUT_DIR> --clean
```

## Serve Locally

```bash
pnpm dev:cli <OUTPUT_DIR> --serve --run --serve-port 8080
```

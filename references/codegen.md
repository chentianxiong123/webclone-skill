# Code Generation Reference

Generate framework code from extracted page components.

## Generate Vue 3 Project

```bash
pnpm dev:cli <URL> \
  -o ./output \
  --extract-components \
  --codegen-framework vue \
  --codegen-typescript \
  --codegen-generate-drafts \
  --codegen-extract-shared
```

## Generate React Project

```bash
pnpm dev:cli <URL> \
  -o ./output \
  --extract-components \
  --codegen-framework react \
  --codegen-typescript \
  --codegen-css-modules \
  --codegen-generate-drafts
```

## All Supported Frameworks

| Framework | Flag | Extra Options |
|-----------|------|---------------|
| Vue 3 | `vue` | — |
| Vue 2 | `vue` (auto-detected) | — |
| React | `react` | `--codegen-css-modules` |
| Angular | `angular` | — |
| Svelte | `svelte` | — |
| jQuery | `jquery` | — |

## Codegen Options

| Flag | Description |
|------|-------------|
| `--codegen-framework <type>` | Target framework |
| `--codegen-typescript` | Use TS (default: true) |
| `--codegen-generate-drafts` | Generate complete project in `__drafts__/` |
| `--codegen-extract-shared` | Extract shared logic to `shared/` |
| `--component-depth <n>` | Limit component recognition depth |
| `--component-filter <expr>` | Filter by confidence/type |

## Post-Generation

```bash
cd ./output/__drafts__
pnpm install
pnpm run build   # must pass with 0 errors
```

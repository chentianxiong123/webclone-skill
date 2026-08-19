#!/usr/bin/env bash
# init.sh — One-click setup for web-clone-skill
#
# Install dependencies and verify the environment.

set -e

echo "=== web-clone-skill Setup ==="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "✗ Node.js not found. Install Node.js >= 20.0.0"
    exit 1
fi
NODE_VER=$(node --version | cut -d'v' -f2)
MAJOR=$(echo "$NODE_VER" | cut -d'.' -f1)
if [ "$MAJOR" -lt 20 ]; then
    echo "✗ Node.js version $NODE_VER < 20. Required: >= 20"
    exit 1
fi
echo "✓ Node.js: $NODE_VER"

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo "→ Installing pnpm..."
    npm install -g pnpm
fi
echo "✓ pnpm: $(pnpm --version)"

# Install dependencies
echo "→ Installing dependencies..."
pnpm install
echo "✓ Dependencies installed"

# Install Playwright browsers
echo "→ Installing Playwright browsers..."
npx playwright install chromium
echo "✓ Playwright installed"

# Verify CLI
echo "→ Verifying CLI..."
pnpm dev:cli --help > /dev/null 2>&1
echo "✓ CLI ready"

echo ""
echo "=== Setup Complete ==="
echo "Usage: node scripts/wrappers/snapshot.mjs <URL> -o ./output --adapter playwright --extract-components"
echo "       node scripts/wrappers/codegen.mjs <URL> --framework vue -o ./output"
echo ""

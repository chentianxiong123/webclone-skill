#!/usr/bin/env node
// scripts/wrappers/serve.mjs
// Wrapper: Start snapshot HTTP server
// Usage: node scripts/wrappers/serve.mjs <OUTPUT_DIR> [--port PORT]

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/wrappers/serve.mjs <OUTPUT_DIR> [--port PORT]');
  process.exit(1);
}

const child = spawn('pnpm', ['dev:cli', ...args, '--serve', '--run'], {
  cwd: dirname(__dirname),
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => process.exit(code));

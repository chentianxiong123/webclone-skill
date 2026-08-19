#!/usr/bin/env node
// scripts/wrappers/inspect.mjs
// Wrapper: Run web-clone inspect subcommand
// Usage: node scripts/wrappers/inspect.mjs <URL> [options]

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/wrappers/inspect.mjs <URL> [--outline | --md | --locate TEXT | --count SEL]');
  process.exit(1);
}

const child = spawn('pnpm', ['dev:cli', 'inspect', ...args], {
  cwd: dirname(__dirname),
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => process.exit(code));

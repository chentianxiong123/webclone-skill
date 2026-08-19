#!/usr/bin/env node
// scripts/wrappers/codegen.mjs
// Wrapper: Run web-clone code generation
// Usage: node scripts/wrappers/codegen.mjs <URL> --framework <vue|react|angular|svelte|jquery> [-o output]

import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/wrappers/codegen.mjs <URL> --framework <type> [-o output]');
  process.exit(1);
}

// Ensure codegen flags are set
const baseArgs = [
  'dev:cli',
  ...args,
  '--extract-components',
  '--codegen-typescript',
  '--codegen-generate-drafts',
  '--codegen-extract-shared',
];

const child = spawn('pnpm', baseArgs, {
  cwd: dirname(__dirname),
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => process.exit(code));

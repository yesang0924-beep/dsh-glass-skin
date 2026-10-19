#!/usr/bin/env node
/**
 * Self-contained pre-flight for the packaged theme:
 *   1. both halves parse;
 *   2. package.json and client VERSION agree;
 *   3. the structure regression suite passes;
 *   4. the pre-6.0 data migration suite passes.
 *
 * The host stylesheet / mount / coverage gates in the development tree compare
 * the skin against the shipped DSH bundles. They are not part of an installed
 * theme, so they stay in skins/_tools/verify.ps1; this file must work from a
 * tarball install with no other repository around it.
 *
 *   node tools/verify.mjs
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const failures = [];

function run(label, args) {
  process.stdout.write(`\n── ${label} ──\n`);
  // stdio: 'inherit' is the mode that also works under the DSH file sandbox;
  // piped stdio is rejected there (EPERM) before the child even starts.
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) failures.push(label);
}

run('client syntax', ['--check', path.join(ROOT, 'client.js')]);
run('host syntax', ['--check', path.join(ROOT, 'index.js')]);

const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const source = readFileSync(path.join(ROOT, 'client.js'), 'utf8');
const version = /const VERSION = '([^']+)'/.exec(source)?.[1];
if (manifest.version !== version) {
  failures.push('version drift');
  console.error(`version drift: package.json=${manifest.version} client.js=${version ?? 'missing'}`);
}

run('structure regression', [path.join(HERE, 'continuous-glass.test.mjs')]);
run('pre-6.0 migration', [path.join(HERE, 'migration.test.mjs')]);

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nALL PACKAGE CHECKS PASSED');

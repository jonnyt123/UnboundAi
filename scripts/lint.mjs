import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const roots = ['src', 'scripts', 'tests'];
const files = [];
for (const root of roots) walk(root);
let failed = false;
for (const file of files) {
  if (!/\.(js|mjs)$/.test(file)) continue;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
  }
  const content = readFileSync(file, 'utf8');
  const banned = [/[\s\S]\beval\s*\(/, /new\s+Function\s*\(/];
  if (file.startsWith('src/')) banned.push(/console\.log\s*\(/);
  for (const pattern of banned) {
    if (pattern.test(content)) {
      failed = true;
      console.error(`Banned release pattern ${pattern} in ${file}`);
    }
  }
}
if (failed) process.exit(1);
console.log(`lint: checked ${files.length} source/test files`);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path); else files.push(path);
  }
}

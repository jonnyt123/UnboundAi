import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const requiredDocs = [
  'docs/GDD.md','docs/ARCHITECTURE.md','docs/ART_BIBLE.md','docs/AUDIO.md',
  'docs/PERFORMANCE.md','docs/QA.md','docs/DECISIONS.md','docs/ASSUMPTIONS.md',
  'docs/ASSET_PROVENANCE.md','THIRD_PARTY_NOTICES.md','README.md','AGENTS.md'
];

for (const file of requiredDocs) {
  await stat(join(root, file));
}

const runtimeFiles = ['index.html','styles.css'];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else runtimeFiles.push(relative(root, path));
  }
}
await walk(join(root, 'src'));

let total = 0;
for (const file of runtimeFiles) {
  const path = join(root, file);
  const bytes = (await stat(path)).size;
  total += bytes;
  if (bytes > 512 * 1024) throw new Error(`${file} exceeds 512 KiB (${bytes} bytes)`);
  if (/\.(html|css|js|mjs)$/.test(file)) {
    const text = await readFile(path, 'utf8');
    if (/https?:\/\//.test(text)) throw new Error(`${file} contains an external runtime URL`);
  }
}
if (total > 1024 * 1024) throw new Error(`runtime source exceeds 1 MiB (${total} bytes)`);
console.log(`Asset/provenance gate passed: ${runtimeFiles.length} runtime files, ${total} source bytes, no remote runtime assets.`);

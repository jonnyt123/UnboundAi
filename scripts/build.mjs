import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'styles.css', 'src']) cpSync(item, join(out, item), { recursive: true });

const meta = {
  name: 'THREAD//NULL',
  buildTime: new Date().toISOString(),
  runtime: 'Canvas2D + Web Audio + ES Modules',
  sourceMaps: false,
};
writeFileSync(join(out, 'build-meta.json'), JSON.stringify(meta, null, 2));

const html = readFileSync(join(out, 'index.html'), 'utf8');
for (const ref of ['./styles.css', './src/main.js']) {
  const local = ref.replace('./', '');
  if (!existsSync(join(out, local))) throw new Error(`Missing built asset: ${ref}`);
  if (!html.includes(ref)) throw new Error(`index.html no longer references ${ref}`);
}
console.log('build: static production bundle written to dist/');

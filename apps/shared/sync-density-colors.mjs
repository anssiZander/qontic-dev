import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const source = new URL('./density-colors.js', import.meta.url);
const copies = [
  new URL('../comparative/free-particle/js/density-colors.js', import.meta.url),
  new URL('../pilot-wave/classical-limit-draft/src/density-colors.js', import.meta.url),
];
export async function syncDensityColors(check = false) {
  const content = await readFile(source, 'utf8');
  for (const target of copies) {
    if (check) {
      const current = await readFile(target, 'utf8').catch(() => '');
      if (current !== content) throw new Error('Density colors differ. Run node apps/shared/sync-density-colors.mjs from the repository root.');
    } else await writeFile(target, content);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncDensityColors(process.argv.includes('--check'));
  console.log('Density color sources are synchronized.');
}

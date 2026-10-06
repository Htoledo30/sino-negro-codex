import { mkdir, copyFile, cp, writeFile, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  dest = path.join(root, 'dist');
await mkdir(dest, { recursive: true });
for (const file of ['index.html', 'style.css', 'manifest.webmanifest', 'sw.js'])
  await copyFile(path.join(root, file), path.join(dest, file));
for (const dir of ['src', 'assets'])
  await cp(path.join(root, dir), path.join(dest, dir), { recursive: true });
const digest = createHash('sha256');
for (const file of [
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'sw.js',
  ...(await readdir(path.join(root, 'src'))).sort().map((f) => 'src/' + f),
  ...(await readdir(path.join(root, 'assets'))).sort().map((f) => 'assets/' + f),
])
  digest.update(await readFile(path.join(root, file)));
const fingerprint = digest.digest('hex').slice(0, 12);
await writeFile(
  path.join(dest, 'sw.js'),
  (await readFile(path.join(root, 'sw.js'), 'utf8')).replace(
    /const CACHE\s*=\s*['"][^'"]+['"]/,
    `const CACHE='sino-negro-v2.0.0-${fingerprint}'`,
  ),
);
await writeFile(path.join(dest, '.nojekyll'), '');
console.log(`Produção gerada em ${dest}. Hospede o conteúdo de dist em HTTPS.`);

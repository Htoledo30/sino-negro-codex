import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2),
  arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', arg('--dir', '.'));
const base = arg('--base', '/'),
  port = Number(arg('--port', 4173));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!pathname.startsWith(base)) {
        res.writeHead(404);
        res.end('Fora do escopo.');
        return;
      }
      let filename = path.resolve(root, '.' + path.sep + pathname.slice(base.length));
      if (filename !== root && !filename.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      const data = await readFile(filename);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Arquivo não encontrado.');
    }
  })
  .listen(port, '0.0.0.0', () =>
    console.log(`SINO NEGRO: http://localhost:${port}${base} | arquivos: ${root}`),
  );

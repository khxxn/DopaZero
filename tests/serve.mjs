import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 8765);
const fixtureRoutes = new Set(['/', '/watch', '/results', '/feed/subscriptions', '/feed/what_to_watch']);
const publicFiles = new Map([
  ['/tests/fixture.html', 'text/html; charset=utf-8'],
  ['/dopazero-youtube.user.js', 'text/javascript; charset=utf-8'],
]);

http.createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    // Decode before allowlisting. Do not expose arbitrary workspace files.
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    const requested = fixtureRoutes.has(pathname) ? '/tests/fixture.html' : pathname;
    const type = publicFiles.get(requested);
    const filename = path.resolve(root, `.${requested}`);
    const relative = path.relative(root, filename);
    if (!type || relative.startsWith('..') || path.isAbsolute(relative)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    const content = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': content.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400, {
      'Content-Type': 'text/plain; charset=utf-8',
    }).end(error.code === 'ENOENT' ? 'Not found' : 'Bad request');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`DopaZero DOM fixture: http://127.0.0.1:${port}/tests/fixture.html`);
});

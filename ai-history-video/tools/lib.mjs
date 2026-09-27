// Shared helpers for the render and snapshot tools: a tiny static file
// server for the project directory, and a headless Chromium page with the
// film loaded and initialised.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.ttf': 'font/ttf', '.wav': 'audio/wav',
  '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg',
};

export function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, path.normalize(url));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

export async function openFilm(server) {
  const browser = await chromium.launch({
    args: ['--disable-gpu', '--disable-accelerated-2d-canvas', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const { port } = server.address();
  await page.goto(`http://127.0.0.1:${port}/film/index.html?mode=render`);
  try {
    await page.waitForFunction(() => window.F && window.F.ready, null, { timeout: 120000 });
  } catch (e) {
    throw new Error('Film failed to initialise:\n' + errors.join('\n'));
  }
  return { browser, page, errors };
}

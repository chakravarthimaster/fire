// Render every frame of the film to build/frames/ as JPEG, in parallel.
//   node tools/render.mjs [--workers 4] [--from 0] [--to <sec>] [--quality 94]
// Also writes build/timeline.json (scene timing, narration placement and
// sound cues), which tools/score.py uses to build the soundtrack.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, openFilm } from './lib.mjs';

const args = {};
process.argv.slice(2).forEach((a, i, all) => {
  if (!a.startsWith('--')) return;
  const next = all[i + 1];
  args[a.slice(2)] = next === undefined || next.startsWith('--') ? true : next;
});
const workers = Number(args.workers || 4);
const quality = Number(args.quality || 94);
const outDir = path.join(ROOT, 'build', 'frames');
fs.mkdirSync(outDir, { recursive: true });

const server = await serve();
const first = await openFilm(server);
const timeline = await first.page.evaluate(() => F.timelineJSON());
fs.writeFileSync(path.join(ROOT, 'build', 'timeline.json'), JSON.stringify(timeline, null, 1));
const fps = timeline.fps;
const total = Math.ceil(timeline.duration * fps);
const f0 = Math.max(0, Math.floor(Number(args.from || 0) * fps));
const f1 = Math.min(total, args.to ? Math.ceil(Number(args.to) * fps) : total);
if (args['timeline-only']) {
  console.log(`timeline: ${timeline.duration.toFixed(2)}s, ${timeline.cues.length} cues`);
  await first.browser.close();
  server.close();
  process.exit(0);
}
console.log(`rendering frames ${f0}..${f1 - 1} of ${total} (${timeline.duration.toFixed(2)}s @ ${fps}fps) with ${workers} workers`);

const pages = [first];
for (let i = 1; i < workers; i++) pages.push(await openFilm(server));

let done = 0;
const t0 = Date.now();
const chunk = Math.ceil((f1 - f0) / workers);
await Promise.all(pages.map(async ({ page, errors }, w) => {
  const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => F.renderFrame(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    fs.writeFileSync(path.join(outDir, `f${String(f).padStart(5, '0')}.jpg`), buf);
    done++;
    if (done % 300 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`  ${done}/${f1 - f0} frames, ${(done / el).toFixed(1)} fps, eta ${(((f1 - f0) - done) / (done / el)).toFixed(0)}s`);
    }
    if (errors.length) throw new Error(`worker ${w} page error at frame ${f}:\n${errors.join('\n')}`);
  }
}));
console.log(`done: ${f1 - f0} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
for (const p of pages) await p.browser.close();
server.close();

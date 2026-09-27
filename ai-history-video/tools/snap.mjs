// Render stills for review.
//   node tools/snap.mjs 12.5 30 41          -> build/snaps/t0012.50.png ...
//   node tools/snap.mjs --sheet 0 25 16     -> contact sheet of 16 frames in [0, 25)
//   node tools/snap.mjs --scene dream 12    -> contact sheet of 12 frames across a scene
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, openFilm } from './lib.mjs';

const args = process.argv.slice(2);
const out = path.join(ROOT, 'build', 'snaps');
fs.mkdirSync(out, { recursive: true });

const server = await serve();
const { browser, page, errors } = await openFilm(server);

async function sheet(times, name) {
  const cols = times.length <= 4 ? 2 : times.length <= 9 ? 3 : 4;
  const buf = await page.evaluate(async ({ times, cols }) => {
    const rows = Math.ceil(times.length / cols);
    const w = 1920 / cols, h = 1080 / cols;
    const c = document.createElement('canvas');
    c.width = 1920; c.height = h * rows;
    const g = c.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height);
    times.forEach((t, i) => {
      F.renderFrame(t);
      const x = (i % cols) * w, y = Math.floor(i / cols) * h;
      g.drawImage(F.main, x + 1, y + 1, w - 2, h - 2);
      g.font = '500 20px Montserrat'; g.fillStyle = '#ff0'; g.fillText(t.toFixed(2) + 's', x + 8, y + 24);
    });
    return c.toDataURL('image/jpeg', 0.9);
  }, { times, cols });
  const file = path.join(out, name + '.jpg');
  fs.writeFileSync(file, Buffer.from(buf.split(',')[1], 'base64'));
  console.log(file);
}

if (args[0] === '--sheet') {
  const [a, b, n] = args.slice(1).map(Number);
  const times = Array.from({ length: n }, (_, i) => a + ((b - a) * i) / n);
  await sheet(times, `sheet_${a}_${b}`);
} else if (args[0] === '--scene') {
  const id = args[1], n = Number(args[2] || 12);
  const s = await page.evaluate((id) => {
    const s = F.timeline.scenes.find((x) => x.id === id);
    return s && { start: s.start, dur: s.dur };
  }, id);
  if (!s) throw new Error('no scene ' + id);
  const times = Array.from({ length: n }, (_, i) => s.start + 0.2 + ((s.dur - 0.4) * i) / (n - 1));
  await sheet(times, `scene_${id}`);
} else if (args[0] === '--timeline') {
  const tl = await page.evaluate(() => F.timelineJSON());
  for (const s of tl.scenes) console.log(s.id.padEnd(14), s.start.toFixed(2).padStart(7), s.dur.toFixed(2).padStart(6), s.clips.map((c) => `${c.key}@${c.start.toFixed(1)}`).join(' '));
  console.log('duration', tl.duration.toFixed(2), 'cues', tl.cues.length);
} else {
  for (const a of args) {
    const t = Number(a);
    const buf = await page.evaluate((t) => { F.renderFrame(t); return F.main.toDataURL('image/png'); }, t);
    const file = path.join(out, `t${t.toFixed(2).padStart(7, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(buf.split(',')[1], 'base64'));
    console.log(file);
  }
}
if (errors.length) console.error('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
server.close();

/*
 * Film engine (shared with "The Thinking Machine", adapted for "What's Worth Building").
 *
 * Every frame is a pure function of time: F.renderFrame(t) draws the film at
 * t seconds, so frames can be rendered in any order, in parallel, and the
 * same timeline drives both the picture and the sound (see F.collectCues).
 */
(function () {
  'use strict';

  const W = 1920, H = 1080, BAR = 138; // 2.39:1 letterbox inside 16:9
  const F = (window.F = {
    W, H, BAR, TOP: BAR, BOT: H - BAR, CX: W / 2, CY: H / 2,
    scenes: {}, timeline: null, ready: false,
  });

  // ---------------------------------------------------------------- math
  F.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  F.lerp = (a, b, t) => a + (b - a) * t;
  F.prog = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : F.clamp((t - a) / (b - a)));
  F.smooth = (t) => { t = F.clamp(t); return t * t * (3 - 2 * t); };
  F.smoother = (t) => { t = F.clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  F.easeIn = (t) => Math.pow(F.clamp(t), 3);
  F.easeOut = (t) => 1 - Math.pow(1 - F.clamp(t), 3);
  F.easeInOut = (t) => { t = F.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  F.easeOutExpo = (t) => { t = F.clamp(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
  F.easeInExpo = (t) => { t = F.clamp(t); return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); };
  F.easeOutBack = (t, s = 1.70158) => { t = F.clamp(t); const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  /** 0 before a, rises to 1 by b, holds until c, falls to 0 by d. */
  F.env = (t, a, b, c = Infinity, d = Infinity) => {
    if (t < a || t > d) return 0;
    if (t < b) return F.smooth(F.prog(t, a, b));
    if (t <= c) return 1;
    return 1 - F.smooth(F.prog(t, c, d));
  };
  F.pulse = (t, at, width) => Math.exp(-Math.pow((t - at) / width, 2));
  F.TAU = Math.PI * 2;

  /** Seeded PRNG (mulberry32). */
  F.rng = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Stateless hash of an integer (and seed) to [0, 1). */
  F.hash = (i, seed = 0) => {
    let h = (Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  /** Smooth 1-D value noise in [-1, 1]. */
  F.noise = (x, seed = 0) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return F.lerp(F.hash(i, seed), F.hash(i + 1, seed), u) * 2 - 1;
  };
  F.shuffle = (arr, seed) => {
    const r = F.rng(seed);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ------------------------------------------------------------- canvas
  F.canvas = (w = W, h = H) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  F.rgba = (rgb, a = 1) => `rgba(${rgb},${a})`;

  const glowCache = new Map();
  /** A soft radial light sprite, cached per colour. */
  F.glowSprite = (rgb = '255,255,255', hard = 0.18) => {
    const key = rgb + '|' + hard;
    let c = glowCache.get(key);
    if (!c) {
      c = F.canvas(128, 128);
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, F.rgba(rgb, 1));
      grd.addColorStop(hard, F.rgba(rgb, 0.55));
      grd.addColorStop(0.45, F.rgba(rgb, 0.14));
      grd.addColorStop(1, F.rgba(rgb, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, 128, 128);
      glowCache.set(key, c);
    }
    return c;
  };
  /** Additive glow at (x, y) with radius r. Caller sets composite op. */
  F.glow = (ctx, x, y, r, rgb, alpha = 1, hard) => {
    if (alpha <= 0.003 || r <= 0.2) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(F.glowSprite(rgb, hard), x - r, y - r, r * 2, r * 2);
  };

  F.setFont = (ctx, o) => {
    const { family = 'Montserrat', size = 32, weight = 400, style = 'normal', spacing = 0 } = o;
    ctx.font = `${style} ${weight} ${size}px "${family}"`;
    ctx.letterSpacing = spacing + 'px';
  };
  /** Width of text including letter-spacing (canvas adds it after each glyph). */
  F.measure = (ctx, str, o) => {
    F.setFont(ctx, o);
    return ctx.measureText(str).width - (o.spacing || 0);
  };
  /**
   * Draw text. Options: family,size,weight,style,spacing,color,alpha,align
   * ('left'|'center'|'right'), glow (px blur), glowColor.
   */
  F.text = (ctx, str, x, y, o = {}) => {
    const alpha = o.alpha ?? 1;
    if (alpha <= 0.003 || !str) return 0;
    F.setFont(ctx, o);
    const w = ctx.measureText(str).width - (o.spacing || 0);
    let x0 = x;
    if (o.align === 'center') x0 = x - w / 2;
    else if (o.align === 'right') x0 = x - w;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    ctx.fillStyle = o.color || '#fff';
    if (o.glow) {
      ctx.shadowColor = o.glowColor || o.color || '#fff';
      ctx.shadowBlur = o.glow;
    }
    ctx.fillText(str, x0, y);
    if (o.glow && o.glowTwice) ctx.fillText(str, x0, y);
    ctx.restore();
    return w;
  };

  /** Word-wrap `str` to maxWidth with the given font; returns lines. */
  F.wrap = (ctx, str, maxWidth, o) => {
    F.setFont(ctx, o);
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  /**
   * Typewriter timing, shared by picture and sound: `times[i]` is when
   * character i appears. Human-ish rhythm from a seeded RNG.
   */
  F.typer = (text, t0, cps, seed = 1, o = {}) => {
    const r = F.rng(seed);
    const times = [];
    let t = t0;
    const pause = o.pause ?? 1;
    const jitter = o.jitter ?? 0.85;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      times.push(t);
      let dt = (1 / cps) * (1 - jitter / 2 + jitter * r());
      if (ch === ' ') dt *= 1.2;
      if (',;:'.includes(ch)) dt += 0.16 * pause;
      if ('.?!'.includes(ch)) dt += 0.32 * pause;
      t += dt;
    }
    const end = times.length ? times[times.length - 1] : t0;
    const count = (T) => {
      let lo = 0, hi = times.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= T) lo = mid + 1; else hi = mid;
      }
      return lo;
    };
    return { text, times, t0, end, count, at: (T) => text.slice(0, count(T)) };
  };
  /** Sound cues for a typer (one per visible, non-space character). */
  F.typerCues = (ty, type = 'key', extra = {}) =>
    ty.times
      .map((t, i) => ({ t, type, ch: ty.text[i], ...extra }))
      .filter((c) => c.ch !== ' ');

  /**
   * Sample points on rendered text. `items` = [{str, x, y, ...fontOpts}].
   * Returns [{x, y}] for opaque pixels on a `step` grid.
   */
  F.sampleText = (items, step = 3) => {
    const c = F.canvas(W, H);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    for (const it of items) F.text(g, it.str, it.x, it.y, { ...it, color: '#fff', alpha: 1 });
    const data = g.getImageData(0, 0, W, H).data;
    const pts = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 140) pts.push({ x, y });
      }
    }
    return pts;
  };
  /** Pick exactly n points (repeating if needed) in a seeded random order. */
  F.pickN = (pts, n, seed) => {
    const a = F.shuffle(pts.slice(), seed);
    const out = [];
    for (let i = 0; i < n; i++) out.push(a[i % a.length]);
    return out;
  };

  // ----------------------------------------------------------- captions
  /**
   * Documentary lower-third: big year, rule, uppercase title, italic sub.
   * o: {t0, t1, year, title, sub, x, y, accent, color, align}
   */
  F.caption = (ctx, t, o) => {
    const t0 = o.t0, t1 = o.t1 ?? Infinity;
    if (t < t0 - 0.01 || t > t1 + 0.8) return;
    const inP = F.prog(t, t0, t0 + 0.9);
    const out = 1 - F.smooth(F.prog(t, t1, t1 + 0.7));
    const a = F.smooth(inP) * out;
    if (a <= 0.003) return;
    const x = o.x ?? 150, y = o.y ?? 818;
    const accent = o.accent || '#d8b36a';
    const color = o.color || '#f4efe6';
    const align = o.align || 'left';
    const dir = align === 'right' ? -1 : 1;
    ctx.save();
    let yy = y;
    if (o.year) {
      const rise = (1 - F.easeOut(inP)) * 14;
      F.text(ctx, o.year, x, yy + rise, {
        family: 'Montserrat', weight: 300, size: o.yearSize || 58, spacing: 6,
        color: accent, alpha: a, align,
      });
    }
    // rule
    const ruleW = (o.ruleW || 120) * F.easeOutExpo(F.prog(t, t0 + 0.15, t0 + 1.1));
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = accent;
    const rx = align === 'right' ? x - ruleW : x;
    ctx.fillRect(rx, yy + 16, ruleW, 2);
    yy += 54;
    if (o.title) {
      // wipe-in reveal
      const reveal = F.easeOut(F.prog(t, t0 + 0.25, t0 + 1.25));
      ctx.save();
      ctx.beginPath();
      const tw = F.measure(ctx, o.title, { family: 'Montserrat', weight: 500, size: o.titleSize || 22, spacing: 5 }) + 20;
      if (dir > 0) ctx.rect(x - 10, yy - 40, tw * reveal + 10, 60);
      else ctx.rect(x - tw * reveal, yy - 40, tw * reveal + 10, 60);
      ctx.clip();
      F.text(ctx, o.title, x, yy, {
        family: 'Montserrat', weight: 500, size: o.titleSize || 22, spacing: 5,
        color, alpha: a, align,
      });
      ctx.restore();
    }
    if (o.sub) {
      const sa = a * F.smooth(F.prog(t, t0 + 0.7, t0 + 1.6));
      F.text(ctx, o.sub, x, yy + 40, {
        family: 'Cormorant Garamond', style: 'italic', weight: 400, size: o.subSize || 30,
        color, alpha: sa * 0.85, align,
      });
    }
    ctx.restore();
  };

  // ------------------------------------------------------ film textures
  let noiseTiles = null;
  const makeNoise = () => {
    noiseTiles = [];
    for (let k = 0; k < 4; k++) {
      const c = F.canvas(512, 512);
      const g = c.getContext('2d');
      const img = g.createImageData(512, 512);
      const r = F.rng(1000 + k);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (r() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      noiseTiles.push(c);
    }
  };
  /** Film grain: tiled noise at a per-frame random offset. */
  F.grain = (ctx, t, amount = 0.08, mode = 'overlay') => {
    if (!noiseTiles) makeNoise();
    const f = Math.floor(t * 24);
    const tile = noiseTiles[((f % 4) + 4) % 4];
    const ox = Math.floor(F.hash(f, 7) * 512), oy = Math.floor(F.hash(f, 9) * 512);
    ctx.save();
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = amount;
    for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) ctx.drawImage(tile, x, y);
    ctx.restore();
  };
  /** Old-film artefacts: flicker, dust specks, vertical scratches. */
  F.oldFilm = (ctx, t, amount = 1, seed = 3) => {
    const f = Math.floor(t * 24);
    ctx.save();
    // flicker
    const fl = (F.hash(f, seed) - 0.5) * 0.09 * amount;
    ctx.globalCompositeOperation = fl > 0 ? 'lighter' : 'multiply';
    ctx.fillStyle = fl > 0 ? `rgba(255,240,220,${fl})` : `rgba(${255 * (1 + fl)},${255 * (1 + fl)},${255 * (1 + fl)},1)`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    // dust
    const nd = Math.floor(F.hash(f, seed + 1) * 7 * amount);
    for (let i = 0; i < nd; i++) {
      const x = F.hash(f * 13 + i, seed + 2) * W, y = F.BAR + F.hash(f * 17 + i, seed + 3) * (H - 2 * F.BAR);
      const r = 0.8 + F.hash(f * 19 + i, seed + 4) * 2.6;
      ctx.globalAlpha = 0.35 + F.hash(f + i, seed + 5) * 0.4;
      ctx.fillStyle = F.hash(f * 23 + i, seed + 6) > 0.5 ? '#000' : '#f5ecd8';
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.6 + F.hash(i, f) * 0.8), F.hash(i, f + 1) * 3, 0, F.TAU);
      ctx.fill();
    }
    // scratches (persist a few frames)
    const sf = Math.floor(t * 6);
    const ns = F.hash(sf, seed + 7) > 0.55 ? 1 + Math.floor(F.hash(sf, seed + 8) * 2 * amount) : 0;
    for (let i = 0; i < ns; i++) {
      const x = F.hash(sf * 31 + i, seed + 9) * W + Math.sin(t * 9 + i) * 3;
      ctx.globalAlpha = 0.18 * amount;
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(x, F.BAR, 1.2, H - 2 * F.BAR);
    }
    ctx.restore();
  };
  /** Dark radial vignette. */
  let vignetteC = null;
  F.vignette = (ctx, strength = 0.6) => {
    if (!vignetteC) {
      vignetteC = F.canvas(W, H);
      const g = vignetteC.getContext('2d');
      const grd = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 1.05);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.6, 'rgba(0,0,0,0.35)');
      grd.addColorStop(1, 'rgba(0,0,0,0.95)');
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
    }
    ctx.save();
    ctx.globalAlpha = strength;
    ctx.drawImage(vignetteC, 0, 0);
    ctx.restore();
  };
  /** CRT scanlines. */
  let scanC = null;
  F.scanlines = (ctx, alpha = 0.18, y0 = 0, y1 = H) => {
    if (!scanC) {
      scanC = F.canvas(W, 4);
      const g = scanC.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,1)';
      g.fillRect(0, 0, W, 2);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = y0; y < y1; y += 4) ctx.drawImage(scanC, 0, y);
    ctx.restore();
  };
  /** Anamorphic lens flare centred at (x, y). */
  F.flare = (ctx, x, y, intensity = 1, rgb = '120,170,255', len = 1400) => {
    if (intensity <= 0.003) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // long horizontal streak
    const grd = ctx.createLinearGradient(x - len, 0, x + len, 0);
    grd.addColorStop(0, F.rgba(rgb, 0));
    grd.addColorStop(0.5, F.rgba(rgb, 0.55 * intensity));
    grd.addColorStop(1, F.rgba(rgb, 0));
    ctx.fillStyle = grd;
    ctx.globalAlpha = 1;
    ctx.fillRect(x - len, y - 2.2, len * 2, 4.4);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - len * 0.6, y - 7, len * 1.2, 14);
    // core
    F.glow(ctx, x, y, 90 * intensity + 20, '255,255,255', 0.9 * intensity);
    F.glow(ctx, x, y, 260 * intensity, rgb, 0.35 * intensity);
    // ghosts along the axis through the frame centre
    const dx = W / 2 - x, dy = H / 2 - y;
    const ghosts = [[0.5, 40, 0.12], [0.9, 18, 0.2], [1.3, 70, 0.08], [1.7, 26, 0.14]];
    for (const [k, r, a] of ghosts) F.glow(ctx, x + dx * k * 2, y + dy * k * 2, r, rgb, a * intensity, 0.5);
    ctx.restore();
  };

  /** Floating dust / embers. o: {n, seed, rgb, speed, size, alpha, rise} */
  F.motes = (ctx, t, o = {}) => {
    const n = o.n ?? 70, seed = o.seed ?? 5, rgb = o.rgb || '255,230,190';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const depth = 0.3 + F.hash(i, seed) * 0.7;
      const sp = (o.speed ?? 10) * depth;
      const x0 = F.hash(i, seed + 1) * (W + 200) - 100;
      const y0 = F.hash(i, seed + 2) * H;
      const x = ((x0 + t * sp * (o.dx ?? 1) + F.noise(t * 0.2 + i, seed) * 40) % (W + 200) + W + 200) % (W + 200) - 100;
      const y = ((y0 - t * sp * (o.rise ?? 0.6) + F.noise(t * 0.17 + i * 3, seed + 4) * 40) % H + H) % H;
      const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + F.hash(i, seed + 3) * 2) + i);
      const r = (o.size ?? 5) * depth * (0.6 + F.hash(i, seed + 5));
      F.glow(ctx, x, y, r * 2.2, rgb, (o.alpha ?? 0.5) * tw * depth);
    }
    ctx.restore();
  };

  // ------------------------------------------------------------ timeline
  F.scene = (id, def) => { F.scenes[id] = def; };

  F.buildTimeline = (story, manifest) => {
    let T = 0;
    const scenes = [];
    for (const s of story.scenes) {
      const clips = {};
      let t = s.lead || 0;
      const n = s.clips.length;
      s.clips.forEach((c, i) => {
        const m = (manifest[s.id] || {})[c.key];
        if (!m) throw new Error(`No narration for ${s.id}.${c.key} — run tools/narrate.py`);
        clips[c.key] = { key: c.key, start: t, dur: m.dur, end: t + m.dur, text: c.text, file: m.file };
        t += m.dur + (i < n - 1 ? c.gap || 0 : 0);
      });
      const dur = Math.max(s.min || 0, t + (s.tail || 0));
      const info = {
        id: s.id, start: T, dur, end: T + dur, clips,
        c: (k) => {
          if (!clips[k]) throw new Error(`scene ${s.id} has no clip ${k}`);
          return clips[k];
        },
      };
      scenes.push(info);
      T += dur;
    }
    return { scenes, duration: T, fps: story.fps || 30 };
  };

  // Stand-in for scenes that are not written yet.
  const placeholder = (id) => ({
    draw(ctx, t, S) {
      F.text(ctx, id.toUpperCase(), W / 2, H / 2, { family: 'Montserrat', size: 60, color: '#555', align: 'center' });
      let y = H / 2 + 60;
      for (const c of Object.values(S.clips)) {
        const on = t >= c.start && t <= c.end;
        F.text(ctx, c.key + ': ' + c.text.slice(0, 90), W / 2, y, { family: 'Montserrat', size: 22, color: on ? '#fff' : '#444', align: 'center' });
        y += 30;
      }
    },
  });

  F.init = async (story, manifest) => {
    F.story = story;
    F.timeline = F.buildTimeline(story, manifest);
    for (const s of F.timeline.scenes) {
      if (!F.scenes[s.id]) F.scenes[s.id] = placeholder(s.id);
      const def = F.scenes[s.id];
      if (def.init) await def.init(s);
    }
    F.main = document.getElementById('film');
    F.ctx = F.main.getContext('2d');
    F.bufA = F.canvas();
    F.bufB = F.canvas();
    F.ready = true;
  };

  F.collectCues = () => {
    const out = [];
    for (const s of F.timeline.scenes) {
      const def = F.scenes[s.id];
      if (!def.cues) continue;
      for (const c of def.cues(s)) out.push({ ...c, t: +(s.start + c.t).toFixed(4), scene: s.id });
    }
    return out.sort((a, b) => a.t - b.t);
  };

  F.timelineJSON = () => ({
    duration: F.timeline.duration,
    fps: F.timeline.fps,
    scenes: F.timeline.scenes.map((s) => ({
      id: s.id, start: s.start, dur: s.dur,
      clips: Object.values(s.clips).map((c) => ({ ...c, abs: s.start + c.start })),
    })),
    cues: F.collectCues(),
  });

  const drawScene = (ctx, s, t) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    F.scenes[s.id].draw(ctx, t, s);
    ctx.restore();
  };

  const transOf = (s) => F.scenes[s.id].transIn || { type: 'fade', dur: 1.2 };

  F.renderFrame = (T) => {
    const ctx = F.ctx;
    const sc = F.timeline.scenes;
    let i = sc.findIndex((s) => T < s.end);
    if (i < 0) i = sc.length - 1;
    const cur = sc[i];
    let pair = null;
    if (i + 1 < sc.length) {
      const nx = sc[i + 1], tr = transOf(nx);
      if (tr.dur > 0 && T >= nx.start - tr.dur / 2) pair = [cur, nx, tr, (T - (nx.start - tr.dur / 2)) / tr.dur];
    }
    if (!pair && i > 0) {
      const tr = transOf(cur);
      if (tr.dur > 0 && T < cur.start + tr.dur / 2) pair = [sc[i - 1], cur, tr, (T - (cur.start - tr.dur / 2)) / tr.dur];
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (!pair) {
      drawScene(ctx, cur, T - cur.start);
    } else {
      const [A, B, tr, p] = pair;
      const a = F.bufA.getContext('2d'), b = F.bufB.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      if (tr.type === 'fade') {
        if (p < 0.5) {
          drawScene(a, A, T - A.start);
          ctx.globalAlpha = 1 - F.smooth(p * 2);
          ctx.drawImage(F.bufA, 0, 0);
        } else {
          drawScene(b, B, T - B.start);
          ctx.globalAlpha = F.smooth(p * 2 - 1);
          ctx.drawImage(F.bufB, 0, 0);
        }
      } else {
        drawScene(a, A, T - A.start);
        drawScene(b, B, T - B.start);
        const k = F.smooth(p);
        if (tr.type === 'zoom') {
          ctx.save();
          const z = 1 + 0.25 * F.easeIn(p);
          ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
          ctx.drawImage(F.bufA, 0, 0);
          ctx.restore();
          ctx.save();
          const z2 = 0.92 + 0.08 * F.easeOut(p);
          ctx.globalAlpha = k;
          ctx.translate(W / 2, H / 2); ctx.scale(z2, z2); ctx.translate(-W / 2, -H / 2);
          ctx.drawImage(F.bufB, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(F.bufA, 0, 0);
          ctx.globalAlpha = k;
          ctx.drawImage(F.bufB, 0, 0);
        }
        if (tr.type === 'flash') {
          ctx.globalAlpha = Math.pow(Math.sin(Math.PI * F.clamp(p)), 4) * 0.55;
          ctx.fillStyle = tr.color || '#fff';
          ctx.fillRect(0, 0, W, H);
        }
      }
      ctx.globalAlpha = 1;
    }

    // global fade in / out
    const D = F.timeline.duration;
    const edge = Math.min(F.prog(T, 0, 0.6), 1 - F.prog(T, D - 1.2, D));
    if (edge < 1) {
      ctx.globalAlpha = 1 - edge;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    // letterbox
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, BAR);
    ctx.fillRect(0, H - BAR, W, BAR);
  };
})();

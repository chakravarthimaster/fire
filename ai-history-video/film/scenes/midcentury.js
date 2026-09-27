/* 1958–1989: the Perceptron, ELIZA, the AI winters, the believers. */
(function () {
  'use strict';
  const { W, H } = F;

  // ========================================================= PERCEPTRON
  const GRID = 20;
  let letters, links, paper, hlBox;
  const LETTERS = ['A', 'X', 'O', 'A', 'X', 'O', 'A', 'X'];
  const GUESS_OK = [false, false, true, true, true, true, true, true];

  function letterBitmap(ch) {
    const c = F.canvas(GRID, GRID);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.font = '700 19px "Montserrat"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, GRID / 2, GRID / 2 + 1);
    const d = g.getImageData(0, 0, GRID, GRID).data;
    const bits = [];
    for (let i = 0; i < GRID * GRID; i++) bits.push(d[i * 4 + 3] > 110 ? 1 : 0);
    return bits;
  }

  F.scene('perceptron', {
    transIn: { type: 'fade', dur: 1.2 },
    init(S) {
      letters = {};
      for (const ch of new Set(LETTERS)) letters[ch] = letterBitmap(ch);
      const r = F.rng(58);
      links = [];
      for (let a = 0; a < 12; a++) {
        for (let k = 0; k < 7; k++) links.push({ cell: Math.floor(r() * GRID * GRID), a, w0: r() * 2 - 1, w1: r() * 2 - 1 });
      }
      // newspaper
      const pw = 1240, ph = 860;
      paper = F.paperCanvas(pw, ph, 1958, (g) => {
        g.fillStyle = 'rgba(40,36,30,0.9)';
        g.fillRect(50, 60, pw - 100, 3);
        g.fillRect(50, 70, pw - 100, 1);
        F.text(g, 'TUESDAY, JULY 8, 1958', 60, 50, { family: 'Cormorant Garamond', weight: 600, size: 24, spacing: 4, color: '#2c271f' });
        F.text(g, 'SCIENCE', pw - 60, 50, { family: 'Cormorant Garamond', weight: 600, size: 24, spacing: 4, color: '#2c271f', align: 'right' });
        F.text(g, 'NEW NAVY DEVICE', pw / 2, 190, { family: 'Cormorant Garamond', weight: 600, size: 118, spacing: 1, color: '#16130e', align: 'center' });
        F.text(g, 'LEARNS BY DOING', pw / 2, 300, { family: 'Cormorant Garamond', weight: 600, size: 118, spacing: 1, color: '#16130e', align: 'center' });
        F.text(g, 'Psychologist Shows Embryo of Computer', pw / 2, 372, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 44, color: '#221e17', align: 'center' });
        F.text(g, 'Designed to Read and Grow Wiser', pw / 2, 422, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 44, color: '#221e17', align: 'center' });
        g.fillRect(50, 450, pw - 100, 2);
        const body = [
          'WASHINGTON, July 7 (UPI)—',
          'The Navy revealed the embryo',
          'of an electronic computer to-',
          'day that it expects will be able',
          'to walk, talk, see, write, re-',
          'produce itself and be conscious',
          'of its existence.',
        ];
        const bo = { family: 'Cormorant Garamond', weight: 500, size: 34, color: '#1c1813' };
        body.forEach((l, i) => F.text(g, l, 70, 510 + i * 44, bo));
        const c2 = F.canvas(10, 10).getContext('2d');
        const pre = F.measure(c2, 'to ', bo);
        hlBox = [
          [70 + pre, 510 + 4 * 44, F.measure(c2, 'walk, talk, see, write, re-', bo)],
          [70, 510 + 5 * 44, F.measure(c2, 'produce itself and be conscious', bo)],
          [70, 510 + 6 * 44, F.measure(c2, 'of its existence.', bo)],
        ];
        // filler columns
        const rr = F.rng(9);
        for (let col = 1; col < 3; col++) {
          const x0 = 70 + col * 385;
          g.fillStyle = 'rgba(40,36,30,0.5)';
          g.fillRect(x0 - 22, 480, 1, 340);
          for (let i = 0; i < 16; i++) {
            const w = i % 7 === 6 ? 150 + rr() * 80 : 330 + rr() * 20;
            g.fillStyle = `rgba(40,36,30,${0.18 + rr() * 0.1})`;
            g.fillRect(x0, 490 + i * 21, w, 9);
          }
        }
        for (let i = 7; i < 9; i++) {
          g.fillStyle = 'rgba(40,36,30,0.22)';
          g.fillRect(70, 510 + i * 44 - 22, 330, 9);
        }
      });
      this.trialT = (k) => S.c('a').start + 0.8 + k * 0.85;
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b');
      const bg = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 1100);
      bg.addColorStop(0, '#16222c');
      bg.addColorStop(1, '#05080b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // lab grid
      ctx.strokeStyle = 'rgba(120,170,200,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      const machine = 1 - 0.75 * F.smooth(F.prog(t, b.start - 0.2, b.start + 0.6));
      const cell = 22, gx = 250, gy = H / 2 - (GRID * cell) / 2;
      const ax = 1010, rx = 1420, ry = H / 2;
      // which trial is showing
      const k = Math.max(0, Math.min(LETTERS.length - 1, Math.floor((t - this.trialT(0)) / 0.85)));
      const started = t >= this.trialT(0) - 0.3;
      const bits = started ? letters[LETTERS[k]] : null;
      const learn = F.clamp((t - this.trialT(0)) / (0.85 * 3));
      ctx.save();
      ctx.globalAlpha = machine;
      // links
      ctx.lineWidth = 1.2;
      for (const L of links) {
        const cx = gx + (L.cell % GRID) * cell + cell / 2, cy = gy + Math.floor(L.cell / GRID) * cell + cell / 2;
        const ay = 300 + L.a * 44;
        const on = bits && bits[L.cell];
        const w = F.lerp(L.w0, L.w1, learn);
        ctx.strokeStyle = w > 0 ? `rgba(120,220,255,${on ? 0.55 : 0.08})` : `rgba(255,150,90,${on ? 0.5 : 0.07})`;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const ay = 300 + i * 44;
        const w = F.lerp(links[i * 7].w0, links[i * 7].w1, learn);
        ctx.strokeStyle = `rgba(200,230,255,${0.15 + Math.abs(w) * 0.5})`;
        ctx.lineWidth = 1 + Math.abs(w) * 3;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(rx - 90, ry); ctx.stroke();
      }
      // retina
      for (let j = 0; j < GRID; j++) {
        for (let i = 0; i < GRID; i++) {
          const on = bits && bits[j * GRID + i];
          ctx.fillStyle = on ? '#e9fbff' : '#1b2a33';
          ctx.beginPath();
          ctx.arc(gx + i * cell + cell / 2, gy + j * cell + cell / 2, cell * 0.36, 0, F.TAU);
          ctx.fill();
        }
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (bits) for (let q = 0; q < bits.length; q += 1) if (bits[q]) F.glow(ctx, gx + (q % GRID) * cell + cell / 2, gy + Math.floor(q / GRID) * cell + cell / 2, 16, '150,230,255', 0.35 * machine);
      ctx.restore();
      F.text(ctx, 'RETINA  ·  20 × 20 PHOTOCELLS', gx + (GRID * cell) / 2, gy - 28, { family: 'Montserrat', weight: 500, size: 18, spacing: 5, color: '#8fb4c8', align: 'center' });
      // association units
      for (let i = 0; i < 12; i++) {
        const ay = 300 + i * 44;
        ctx.fillStyle = '#20343f';
        ctx.strokeStyle = '#8fc4dc';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ax, ay, 13, 0, F.TAU); ctx.fill(); ctx.stroke();
      }
      // response unit
      const guessOk = GUESS_OK[k];
      const flash = started ? F.pulse((t - this.trialT(0)) % 0.85, 0.35, 0.12) : 0;
      ctx.fillStyle = '#10202a';
      ctx.strokeStyle = '#bfe9ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(rx, ry, 90, 0, F.TAU); ctx.fill(); ctx.stroke();
      if (started) {
        const shown = guessOk ? LETTERS[k] : LETTERS[(k + 1) % 3];
        F.text(ctx, shown, rx, ry + 32, { family: 'Montserrat', weight: 600, size: 96, color: guessOk ? '#bff7d8' : '#ffb39a', align: 'center' });
        F.text(ctx, guessOk ? 'CORRECT' : 'WRONG — ADJUST WEIGHTS', rx, ry + 150, { family: 'Montserrat', weight: 500, size: 18, spacing: 5, color: guessOk ? '#7ee0a8' : '#ff9a7a', align: 'center' });
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, rx, ry, 200, guessOk ? '120,255,180' : '255,120,80', 0.35 * flash + 0.12);
        ctx.restore();
      }
      F.text(ctx, `TRIAL ${started ? k + 1 : 0}`, rx, ry - 130, { family: 'Montserrat', weight: 500, size: 20, spacing: 6, color: '#8fb4c8', align: 'center' });
      ctx.restore();

      // ---- the newspaper spins in
      const np = F.prog(t, b.start - 0.1, b.start + 0.8);
      if (np > 0) {
        const e = F.easeOutExpo(np);
        ctx.save();
        ctx.translate(W / 2, H / 2 + 10);
        ctx.rotate(F.lerp(-Math.PI * 5, -0.045, e));
        const sc = F.lerp(0.04, 0.86, e);
        ctx.scale(sc, sc);
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 60;
        ctx.drawImage(paper, -paper.width / 2, -paper.height / 2);
        ctx.shadowBlur = 0;
        // highlighter sweep over the famous line
        const hk = F.prog(t, b.start + 1.4, b.start + 3.4);
        if (hk > 0) {
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = 'rgba(255,226,80,0.75)';
          let rem = hk * (hlBox[0][2] + hlBox[1][2] + hlBox[2][2]);
          for (const [x, y, w] of hlBox) {
            const ww = Math.min(w, rem);
            if (ww > 0) ctx.fillRect(x - paper.width / 2 - 4, y - paper.height / 2 - 30, ww + 8, 40);
            rem -= w;
          }
        }
        ctx.restore();
      }
      F.caption(ctx, t, { t0: a.start - 0.1, t1: b.start - 0.4, year: '1958', title: 'FRANK ROSENBLATT · THE PERCEPTRON', sub: 'Cornell Aeronautical Laboratory', accent: '#8fd6ff', x: 150, y: 846 });
      F.vignette(ctx, 0.65);
      F.grain(ctx, t, 0.03);
    },
    cues(S) {
      const b = S.c('b');
      const out = [{ t: 0, type: 'hum', dur: b.start + 0.5 }];
      for (let k = 0; k < LETTERS.length; k++) {
        const tt = this.trialT(k);
        if (tt > b.start - 0.2) break;
        out.push({ t: tt, type: 'relay' });
        out.push({ t: tt + 0.35, type: GUESS_OK[k] ? 'beep_ok' : 'beep_bad' });
      }
      out.push({ t: b.start - 0.1, type: 'whoosh', dur: 0.9 });
      out.push({ t: b.start + 0.75, type: 'thud' });
      out.push({ t: b.start + 1.4, type: 'marker', dur: 2.0 });
      return out;
    },
  });

  // ============================================================== ELIZA
  const CONVO = [
    { who: 'U', s: 'Men are all alike.' },
    { who: 'E', s: 'IN WHAT WAY' },
    { who: 'U', s: 'Well, my boyfriend made me come here.' },
    { who: 'E', s: 'YOUR BOYFRIEND MADE YOU COME HERE' },
    { who: 'U', s: "He says I'm depressed much of the time." },
    { who: 'E', s: 'I AM SORRY TO HEAR YOU ARE DEPRESSED' },
  ];
  let convo;
  F.scene('eliza', {
    transIn: { type: 'fade', dur: 1.2 },
    init(S) {
      let t = 0.7;
      convo = CONVO.map((l, i) => {
        const ty = F.typer(l.s, t, l.who === 'U' ? 17 : 42, 300 + i, { jitter: l.who === 'U' ? 0.9 : 0.2, pause: l.who === 'U' ? 0.8 : 0.1 });
        t = ty.end + (l.who === 'U' ? 0.45 : 0.6);
        if (i === 3) t = Math.max(t, S.c('b1').start + 1.4);
        return { ...l, ty };
      });
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b1 = S.c('b1'), b2 = S.c('b2');
      ctx.fillStyle = '#0a0806';
      ctx.fillRect(0, 0, W, H);
      const lamp = ctx.createRadialGradient(1200, 360, 0, 1200, 360, 1100);
      lamp.addColorStop(0, 'rgba(120,96,60,0.45)');
      lamp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, W, H);

      // greenbar continuous paper, scrolling as lines print
      const px = 800, pw = 900, lineH = 58;
      const scroll = F.lerp(0, lineH * 1.5, F.smooth(F.prog(t, convo[0].ty.t0, convo[convo.length - 1].ty.end + 1)));
      const zoom = 1 + 0.06 * F.smooth(F.prog(t, 0, S.dur));
      const lineY = (i) => 300 + i * lineH * 1.28;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.scale(zoom, zoom);
      ctx.rotate(-0.02);
      ctx.translate(-W / 2, -H / 2 - scroll);
      for (let i = -4; i < 24; i++) {
        const y = 200 + i * lineH * 1.5;
        ctx.fillStyle = i % 2 === 0 ? '#c3d3bf' : '#d8d4c6';
        ctx.fillRect(px, y, pw, lineH * 1.5);
      }
      for (const sx of [px - 50, px + pw]) {
        ctx.fillStyle = '#d3cfc2';
        ctx.fillRect(sx, 200 - lineH * 6, 50, lineH * 40);
        ctx.fillStyle = '#0a0806';
        for (let k = -8; k < 40; k++) {
          ctx.beginPath(); ctx.arc(sx + 25, 200 + k * 36, 8, 0, F.TAU); ctx.fill();
        }
      }
      // printed conversation
      const uo = { family: 'Courier Prime', size: 34, color: '#26262a' };
      const eo = { family: 'Courier Prime', weight: 700, size: 34, color: '#0f3319' };
      convo.forEach((l, i) => {
        if (t < l.ty.t0) return;
        F.inkText(ctx, l.ty.at(t), px + 50, lineY(i), l.who === 'U' ? uo : eo, 900 + i);
      });
      // "It understood nothing": arrows from my/me to YOUR/YOU
      const rk = F.env(t, b1.start - 0.1, b1.start + 0.6, b2.start + 3.4, b2.start + 4.0);
      if (rk > 0.01) {
        ctx.save();
        ctx.globalAlpha = rk;
        ctx.strokeStyle = 'rgba(190,30,25,0.9)';
        ctx.fillStyle = 'rgba(190,30,25,0.9)';
        ctx.lineWidth = 3;
        const x3 = (str) => px + 50 + F.measure(ctx, str, uo);
        const x4 = (str) => px + 50 + F.measure(ctx, str, eo);
        const pairs = [
          [x3('Well, '), x3('Well, my'), x4(''), x4('YOUR')],
          [x3('Well, my boyfriend made '), x3('Well, my boyfriend made me'), x4('YOUR BOYFRIEND MADE '), x4('YOUR BOYFRIEND MADE YOU')],
        ];
        const y3 = lineY(2), y4 = lineY(3);
        const draw = F.easeInOut(F.prog(t, b1.start, b1.start + 0.9));
        for (const [a0, a1, c0, c1] of pairs) {
          ctx.beginPath(); ctx.ellipse((a0 + a1) / 2, y3 - 11, (a1 - a0) / 2 + 9, 22, 0, 0, F.TAU); ctx.stroke();
          ctx.beginPath(); ctx.ellipse((c0 + c1) / 2, y4 - 11, (c1 - c0) / 2 + 9, 22, 0, 0, F.TAU); ctx.stroke();
          const sx = (a0 + a1) / 2, sy = y3 + 12, ex = (c0 + c1) / 2, ey = y4 - 34;
          const mx = F.lerp(sx, ex, draw), my = F.lerp(sy, ey, draw);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + mx) / 2 + 30, (sy + my) / 2, mx, my); ctx.stroke();
          if (draw > 0.95) {
            const ang = Math.atan2(ey - sy, ex - sx);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 14 * Math.cos(ang - 0.4), ey - 14 * Math.sin(ang - 0.4));
            ctx.lineTo(ex - 14 * Math.cos(ang + 0.4), ey - 14 * Math.sin(ang + 0.4));
            ctx.fill();
          }
        }
        ctx.restore();
      }
      // darken the paper away from the lamp
      const shade = ctx.createRadialGradient(px + pw * 0.55, 420 + scroll, 100, px + pw * 0.55, 420 + scroll, 900);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = shade;
      ctx.fillRect(px - 60, 0, pw + 120, H + scroll + 400);
      ctx.restore();
      F.caption(ctx, t, { t0: a.start - 0.2, t1: b1.start - 0.3, year: '1966', title: 'JOSEPH WEIZENBAUM · ELIZA', sub: 'MIT · A program that played a psychotherapist', accent: '#b8e0b0', x: 110, y: 820 });
      const ua = F.env(t, b1.start + 0.4, b1.start + 1.2, b2.start + 3.4, b2.start + 4.1) * 0.95;
      const uo2 = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 42, color: '#ece2cc', alpha: ua };
      F.text(ctx, 'No understanding —', 110, 560, uo2);
      F.text(ctx, 'just rules that turn', 110, 612, uo2);
      F.text(ctx, 'your words around.', 110, 664, uo2);
      F.vignette(ctx, 0.8);
      // clean digital look from here on: no film grain
    },
    cues() {
      const out = [];
      convo.forEach((l) => out.push(...F.typerCues(l.ty, l.who === 'U' ? 'key' : 'teletype', { heavy: 0 })));
      return out;
    },
  });

  // ============================================================= WINTER
  let frost, flakes;
  function makeFrost() {
    const segs = [];
    const r = F.rng(1974);
    const grow = (x, y, ang, len, depth, birth) => {
      if (depth > 4 || len < 6) return;
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      segs.push({ x0: x, y0: y, x1, y1, birth, w: Math.max(0.6, 2.4 - depth * 0.5) });
      const nb = birth + 0.03 + r() * 0.05;
      grow(x1, y1, ang + (r() - 0.5) * 0.3, len * (0.7 + r() * 0.2), depth + (r() < 0.3 ? 1 : 0), nb);
      if (r() < 0.75) grow(x1, y1, ang + Math.PI / 3 + (r() - 0.5) * 0.2, len * 0.5, depth + 1, nb);
      if (r() < 0.75) grow(x1, y1, ang - Math.PI / 3 + (r() - 0.5) * 0.2, len * 0.5, depth + 1, nb);
    };
    const top = F.TOP, bot = F.BOT;
    for (let i = 0; i < 70; i++) {
      const side = i % 4;
      const u = r();
      let x, y, ang;
      if (side === 0) { x = u * W; y = top; ang = Math.PI / 2; }
      else if (side === 1) { x = u * W; y = bot; ang = -Math.PI / 2; }
      else if (side === 2) { x = 0; y = top + u * (bot - top); ang = 0; }
      else { x = W; y = top + u * (bot - top); ang = Math.PI; }
      grow(x, y, ang + (r() - 0.5) * 0.9, 30 + r() * 50, 0, r() * 0.25);
    }
    return segs;
  }
  F.drawFrost = (ctx, level, alpha = 1) => {
    if (level <= 0.001) return;
    frost = frost || makeFrost();
    ctx.save();
    // haze from the edges
    const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1100);
    g.addColorStop(0, 'rgba(190,220,255,0)');
    g.addColorStop(1, `rgba(190,220,255,${0.35 * level * alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round';
    const L = level * 1.35;
    for (const s of frost) {
      if (s.birth > L) continue;
      const k = F.clamp((L - s.birth) / 0.05);
      ctx.strokeStyle = `rgba(225,242,255,${0.55 * alpha})`;
      ctx.lineWidth = s.w;
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(F.lerp(s.x0, s.x1, k), F.lerp(s.y0, s.y1, k));
      ctx.stroke();
    }
    ctx.restore();
  };
  F.drawSnow = (ctx, t, amount, o = {}) => {
    if (amount <= 0.01) return;
    if (!flakes) {
      const r = F.rng(66);
      flakes = Array.from({ length: 520 }, () => ({ x: r() * W, y: r() * H, d: 0.25 + r() * 0.75, ph: r() * 6 }));
    }
    const wind = o.wind ?? 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = Math.floor(flakes.length * F.clamp(amount));
    for (let i = 0; i < n; i++) {
      const f = flakes[i];
      const sp = 40 + 120 * f.d;
      const x = ((f.x + t * wind * f.d + Math.sin(t * 0.8 + f.ph) * 30) % W + W) % W;
      const y = ((f.y + t * sp) % H + H) % H;
      F.glow(ctx, x, y, 2 + 5 * f.d, '230,244,255', 0.55 * f.d);
    }
    ctx.restore();
  };

  F.scene('winter', {
    transIn: { type: 'fade', dur: 1.4 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d1 = S.c('d1'), d2 = S.c('d2');
      const thaw = F.env(t, d1.start - 0.2, d1.start + 1.2, d2.start - 0.4, d2.start + 0.6);
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, F.lerp(0, 1, thaw) > 0.5 ? '#2a1a0c' : '#0b1622');
      bg.addColorStop(1, '#03060a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      if (thaw > 0.01) {
        const warm = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1000);
        warm.addColorStop(0, `rgba(150,90,30,${0.5 * thaw})`);
        warm.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = warm;
        ctx.fillRect(0, 0, W, H);
      }

      // ---- hype chart: expectations vs reality
      const chartA = F.env(t, 0.3, 1.2, c.start - 0.6, c.start + 0.2);
      if (chartA > 0.01) {
        ctx.save();
        ctx.globalAlpha = chartA;
        const x0 = 330, x1 = 1590, yb = 800, yt = 250;
        ctx.strokeStyle = 'rgba(200,220,240,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, yt); ctx.lineTo(x0, yb); ctx.lineTo(x1, yb); ctx.stroke();
        ['1956', '1960', '1964', '1968', '1972'].forEach((y, i) => F.text(ctx, y, x0 + i * 300, yb + 40, { family: 'Montserrat', weight: 400, size: 20, spacing: 3, color: '#8ea6bb', align: 'center' }));
        const draw = F.easeInOut(F.prog(t, 0.6, a.end + 0.2));
        const crack = F.prog(t, a.end + 0.3, b.start + 1.2);
        const expY = (u) => yb - 40 - (yb - yt - 60) * Math.pow(u, 1.6);
        const realY = (u) => yb - 30 - 90 * u + Math.sin(u * 9) * 6;
        const N = 80;
        // shaded gap
        ctx.fillStyle = 'rgba(255,190,110,0.08)';
        ctx.beginPath();
        for (let i = 0; i <= N * draw; i++) { const u = i / N; ctx.lineTo(x0 + (x1 - x0) * u, expY(u)); }
        for (let i = Math.floor(N * draw); i >= 0; i--) { const u = i / N; ctx.lineTo(x0 + (x1 - x0) * u, realY(u)); }
        ctx.fill();
        const line = (fn, col, drop = 0) => {
          ctx.strokeStyle = col;
          ctx.lineWidth = 5;
          ctx.beginPath();
          for (let i = 0; i <= N * draw; i++) {
            const u = i / N;
            let y = fn(u);
            if (drop > 0 && u > 0.78) y += drop * (u - 0.78) * 2200;
            i ? ctx.lineTo(x0 + (x1 - x0) * u, y) : ctx.moveTo(x0 + (x1 - x0) * u, y);
          }
          ctx.stroke();
        };
        line(expY, '#ffc877', F.easeIn(crack) * 0.55);
        line(realY, '#7fc8ff');
        F.text(ctx, 'EXPECTATIONS', x0 + (x1 - x0) * 0.62, expY(0.62) - 26, { family: 'Montserrat', weight: 600, size: 22, spacing: 6, color: '#ffc877', alpha: draw, align: 'right' });
        F.text(ctx, 'REALITY', x0 + (x1 - x0) * 0.62, realY(0.62) + 48, { family: 'Montserrat', weight: 600, size: 22, spacing: 6, color: '#7fc8ff', alpha: draw, align: 'center' });
        ctx.restore();
      }
      // frost and snow
      const frostLevel = Math.max(F.smooth(F.prog(t, b.start - 0.4, c.start + 1.0)) * (1 - 0.8 * thaw), F.smooth(F.prog(t, d2.start - 0.2, d2.start + 1.6)));
      F.drawSnow(ctx, t, F.smooth(F.prog(t, b.start, c.start)) * (1 - 0.85 * thaw) + 0.6 * F.smooth(F.prog(t, d2.start, d2.end)), { wind: 90 });
      F.drawFrost(ctx, frostLevel);

      // captions during b
      F.caption(ctx, t, { t0: b.start + 0.1, t1: b.start + 2.3, year: '1969', title: 'MINSKY & PAPERT PUBLISH “PERCEPTRONS”', sub: 'Proving the limits of single-layer networks', accent: '#a9d8ff', x: 150, y: 250 });
      F.caption(ctx, t, { t0: b.start + 2.4, t1: c.start - 0.4, year: '1973', title: 'THE LIGHTHILL REPORT', sub: 'Britain cuts funding for AI research', accent: '#a9d8ff', x: 150, y: 250 });

      // ---- "THE FIRST AI WINTER"
      const w1 = F.env(t, c.start - 0.6, c.start + 0.3, d1.start - 0.6, d1.start + 0.2);
      if (w1 > 0.01) {
        F.text(ctx, 'THE FIRST AI WINTER', W / 2, H / 2 + 20, { family: 'Cinzel', weight: 600, size: 104, spacing: 14, color: '#e6f3ff', alpha: w1, align: 'center', glow: 30, glowColor: 'rgba(150,200,255,0.9)' });
        F.text(ctx, '1974 – 1980', W / 2, H / 2 + 100, { family: 'Montserrat', weight: 300, size: 30, spacing: 16, color: '#a9d0f0', alpha: w1, align: 'center' });
      }
      // ---- expert systems thaw
      const ex = F.env(t, d1.start - 0.1, d1.start + 0.8, d2.start + 0.2, d2.start + 1.2);
      if (ex > 0.01) this.drawRules(ctx, t, d1, d2, ex);
      // ---- second winter
      const w2 = F.env(t, d2.end + 0.1, d2.end + 0.8);
      if (w2 > 0.01) {
        F.text(ctx, 'THE SECOND AI WINTER', W / 2, H / 2 + 20, { family: 'Cinzel', weight: 600, size: 96, spacing: 14, color: '#e6f3ff', alpha: w2, align: 'center', glow: 30, glowColor: 'rgba(150,200,255,0.9)' });
        F.text(ctx, '1987 – 1993', W / 2, H / 2 + 100, { family: 'Montserrat', weight: 300, size: 30, spacing: 16, color: '#a9d0f0', alpha: w2, align: 'center' });
      }
      F.vignette(ctx, 0.8);
      F.grain(ctx, t, 0.025);
    },
    drawRules(ctx, t, d1, d2, alpha) {
      const rules = [
        ['IF', 'the infection is primary-bacteremia'],
        ['AND', 'the site of the culture is a sterile site'],
        ['AND', 'the portal of entry is the gastrointestinal tract'],
        ['THEN', 'the organism is likely bacteroides  (0.7)'],
      ];
      const freeze = F.smooth(F.prog(t, d2.start - 0.2, d2.start + 0.9));
      ctx.save();
      ctx.globalAlpha = alpha;
      const x = 420, y0 = 360;
      rules.forEach(([k, v], i) => {
        const ra = F.smooth(F.prog(t, d1.start + 0.2 + i * 0.35, d1.start + 0.7 + i * 0.35));
        const col = freeze > 0.5 ? '#9fb8cc' : '#ffcf7a';
        F.text(ctx, k, x, y0 + i * 70, { family: 'IBM Plex Mono', weight: 500, size: 40, color: col, alpha: ra, glow: 18 * (1 - freeze), glowColor: 'rgba(255,170,60,0.8)' });
        F.text(ctx, v, x + 150, y0 + i * 70, { family: 'IBM Plex Mono', weight: 400, size: 34, color: freeze > 0.5 ? '#7d93a6' : '#f3e2c0', alpha: ra });
      });
      ctx.restore();
      F.caption(ctx, t, { t0: d1.start + 0.3, t1: d2.start + 0.3, year: '1980s', title: 'THE EXPERT SYSTEMS BOOM', sub: 'Hand-written rules, like this one from the MYCIN system', accent: '#ffcf7a', x: 420, y: 740 });
    },
    cues(S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d1 = S.c('d1'), d2 = S.c('d2');
      return [
        { t: a.end + 0.3, type: 'crack' },
        { t: b.start - 0.4, type: 'wind', dur: d1.start - b.start + 0.6, level: 1 },
        { t: b.start - 0.4, type: 'frost', dur: 2.5 },
        { t: c.start - 0.55, type: 'impact', size: 0.7, cold: 1 },
        { t: d1.start - 0.1, type: 'thaw', dur: d2.start - d1.start + 0.4 },
        { t: d2.start - 0.2, type: 'frost', dur: 2.0 },
        { t: d2.end + 0.1, type: 'wind', dur: S.dur - d2.end, level: 0.8 },
        { t: d2.end + 0.1, type: 'impact', size: 0.55, cold: 1 },
      ];
    },
  });

  // ========================================================== BELIEVERS
  const LAYERS = [4, 6, 6, 2];
  let net, weights0, weights1;
  const DIGITS = {
    1: [[[0.3, 0.3], [0.55, 0.05], [0.52, 1.35]]],
    4: [[[0.62, 0.05], [0.08, 0.9], [0.9, 0.88]], [[0.64, 0.42], [0.6, 1.36]]],
    2: [[[0.1, 0.35], [0.28, 0.08], [0.6, 0.04], [0.82, 0.26], [0.72, 0.6], [0.12, 1.3], [0.92, 1.28]]],
    0: [Array.from({ length: 25 }, (_, i) => { const a = -Math.PI / 2 + (i / 24) * F.TAU * 1.04; return [0.5 + 0.4 * Math.cos(a), 0.7 + 0.62 * Math.sin(a)]; })],
  };
  const ZIP = '14201';

  F.scene('believers', {
    transIn: { type: 'fade', dur: 1.2 },
    init() {
      const r = F.rng(1986);
      net = [];
      LAYERS.forEach((n, li) => {
        for (let i = 0; i < n; i++) net.push({ li, i, x: 700 + li * 200, y: 540 + (i - (n - 1) / 2) * 90 });
      });
      weights0 = [];
      weights1 = [];
      for (const a of net) for (const b of net) if (b.li === a.li + 1) { weights0.push([a, b, r() * 2 - 1]); weights1.push(r() * 2 - 1); }
      // handwriting jitter
      const hr = F.rng(89);
      this.zip = ZIP.split('').map((ch) => DIGITS[ch].map((stroke) => stroke.map(([x, y]) => [x + (hr() - 0.5) * 0.06, y + (hr() - 0.5) * 0.06])));
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c');
      const warmth = F.smooth(F.prog(t, c.start - 1, S.dur));
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1100);
      bg.addColorStop(0, `rgb(${16 + 30 * warmth},${22 + 10 * warmth},${34 - 10 * warmth})`);
      bg.addColorStop(1, '#020305');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      F.drawSnow(ctx, t + 30, 0.7 * (1 - warmth), { wind: 40 });
      F.drawFrost(ctx, 0.75 * (1 - F.smooth(F.prog(t, 0, c.start + 2))), 0.8);

      // ---- the network
      const netA = F.env(t, 0.2, 1.8, c.start - 0.5, c.start + 0.4);
      if (netA > 0.01) {
        const push = 0.8 + 0.2 * F.easeInOut(F.prog(t, 0, b.start + 0.5));
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(push, push);
        ctx.translate(-W / 2, -H / 2);
        ctx.globalAlpha = netA;
        // iterations of backprop
        const it0 = b.start + 0.3, itLen = 1.9;
        const it = Math.floor((t - it0) / itLen);
        const u = (t - it0) / itLen - it;
        const learn = F.clamp((t - it0) / (itLen * 3));
        const fwd = t > it0 && it < 3 ? F.prog(u, 0.0, 0.42) : -1;
        const bwd = t > it0 && it < 3 ? F.prog(u, 0.5, 0.92) : -1;
        weights0.forEach(([p, q, w0], k) => {
          const w = F.lerp(w0, weights1[k], learn);
          ctx.strokeStyle = w > 0 ? `rgba(255,190,110,${0.12 + 0.45 * Math.abs(w)})` : `rgba(120,190,255,${0.12 + 0.4 * Math.abs(w)})`;
          ctx.lineWidth = 1 + 2.5 * Math.abs(w);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        });
        ctx.globalCompositeOperation = 'lighter';
        // pulses
        const pulse = (prog, dir, rgb) => {
          if (prog <= 0 || prog >= 1) return;
          const pos = dir > 0 ? prog * 3 : 3 - prog * 3; // position in layer units
          const li = Math.floor(pos), f = pos - li;
          for (const [p, q] of weights0) {
            if (p.li !== li) continue;
            F.glow(ctx, F.lerp(p.x, q.x, f), F.lerp(p.y, q.y, f), 10, rgb, 0.7);
          }
        };
        pulse(fwd, 1, '140,220,255');
        pulse(bwd, -1, '255,150,80');
        ctx.globalCompositeOperation = 'source-over';
        for (const n of net) {
          ctx.fillStyle = '#1d140c';
          ctx.strokeStyle = '#ffd9a0';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(n.x, n.y, 20, 0, F.TAU); ctx.fill(); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, W / 2, H / 2, 520, '255,160,70', 0.28 * netA);
        ctx.globalCompositeOperation = 'source-over';
        // error meter
        const errVals = [0.82, 0.43, 0.11, 0.11];
        const shownIt = Math.max(0, Math.min(3, it + (bwd >= 1 ? 1 : 0)));
        const err = t < it0 ? 0.82 : F.lerp(errVals[Math.max(0, shownIt - 1)] ?? 0.82, errVals[shownIt], F.smooth(F.prog(u, 0.5, 0.92)));
        const mx = 1440, my = 440;
        F.text(ctx, 'ERROR', mx, my, { family: 'Montserrat', weight: 500, size: 22, spacing: 8, color: '#f0c9a0', alpha: F.smooth(F.prog(t, b.start, b.start + 0.8)) });
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(mx, my + 20, 260, 14);
        ctx.fillStyle = err > 0.5 ? '#ff8a5c' : err > 0.25 ? '#ffc36b' : '#8ff0b0';
        ctx.globalAlpha = netA * F.smooth(F.prog(t, b.start, b.start + 0.8));
        ctx.fillRect(mx, my + 20, 260 * err, 14);
        F.text(ctx, err.toFixed(2), mx, my + 80, { family: 'IBM Plex Mono', weight: 500, size: 44, color: '#fff2dc' });
        ctx.restore();
      }
      F.text(ctx, 'forward', 860, 830, { family: 'Montserrat', weight: 500, size: 20, spacing: 6, color: '#8cd8ff', alpha: F.env(t, b.start + 0.2, b.start + 0.8, c.start - 0.9, c.start - 0.4) });
      F.text(ctx, '← errors flow backward', 1030, 830, { family: 'Montserrat', weight: 500, size: 20, spacing: 6, color: '#ffab70', alpha: F.env(t, b.start + 1.2, b.start + 1.8, c.start - 0.9, c.start - 0.4) });
      F.caption(ctx, t, { t0: b.start - 0.1, t1: c.start - 0.6, year: '1986', title: 'RUMELHART, HINTON & WILLIAMS', sub: 'Learning representations by back-propagating errors', accent: '#ffc68a', x: 150, y: 250 });

      // ---- LeCun: handwritten ZIP code read by a convolutional net
      const envA = F.env(t, c.start - 0.4, c.start + 0.6);
      if (envA > 0.01) this.drawEnvelope(ctx, t, c, envA);
      F.vignette(ctx, 0.75);
      F.grain(ctx, t, 0.02);
    },
    drawEnvelope(ctx, t, c, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const ex = 360, ey = 270, ew = 1200, eh = 520;
      ctx.save();
      ctx.translate(ex + ew / 2, ey + eh / 2);
      ctx.rotate(-0.025);
      ctx.translate(-(ex + ew / 2), -(ey + eh / 2));
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 50;
      ctx.fillStyle = '#efe6d0';
      ctx.fillRect(ex, ey, ew, eh);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(120,100,70,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + ew / 2, ey + eh * 0.55); ctx.lineTo(ex + ew, ey); ctx.stroke();
      // stamp
      ctx.fillStyle = '#b0453a';
      ctx.fillRect(ex + ew - 150, ey + 40, 100, 120);
      ctx.strokeStyle = '#efe6d0';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(ex + ew - 146, ey + 44, 92, 112);
      ctx.setLineDash([]);
      // handwritten ZIP
      const dw = 120, dh = 170, zx = ex + 300, zy = ey + 250;
      const write = F.prog(t, c.start + 0.1, c.start + 1.9) * ZIP.length;
      ctx.strokeStyle = '#1d2a55';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.zip.forEach((strokes, di) => {
        const vis = F.clamp(write - di);
        if (vis <= 0) return;
        const ox = zx + di * (dw + 30), oy = zy;
        let total = strokes.reduce((s, st) => s + st.length - 1, 0), drawn = total * vis;
        for (const st of strokes) {
          ctx.beginPath();
          for (let i = 0; i < st.length; i++) {
            if (i > 0 && drawn <= 0) break;
            const [px, py] = st[i];
            let x = ox + px * dw, y = oy + py * dh / 1.4;
            if (i > 0 && drawn < 1) {
              const [qx, qy] = st[i - 1];
              x = ox + F.lerp(qx, px, drawn) * dw;
              y = oy + F.lerp(qy, py, drawn) * dh / 1.4;
            }
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            if (i > 0) drawn -= 1;
          }
          ctx.stroke();
        }
      });
      // convolution window scanning each digit, then the reading
      const scan = F.prog(t, c.start + 1.8, c.start + 3.8) * ZIP.length;
      const si = Math.min(ZIP.length - 1, Math.floor(scan));
      if (scan > 0 && scan < ZIP.length) {
        const f = scan - si;
        const sx = zx + si * (dw + 30) + (f % 0.5) * 2 * (dw - 40), sy = zy + (f < 0.5 ? 10 : 70);
        ctx.strokeStyle = '#27c7ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, sy, 60, 60);
        ctx.strokeStyle = 'rgba(39,199,255,0.45)';
        ctx.lineWidth = 1;
        for (let k = 1; k < 5; k++) {
          ctx.beginPath(); ctx.moveTo(sx + k * 12, sy); ctx.lineTo(sx + k * 12, sy + 60); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sx, sy + k * 12); ctx.lineTo(sx + 60, sy + k * 12); ctx.stroke();
        }
      }
      for (let di = 0; di < ZIP.length; di++) {
        const ra = F.smooth(F.prog(scan, di + 0.7, di + 1.0));
        if (ra <= 0) continue;
        F.text(ctx, ZIP[di], zx + di * (dw + 30) + dw / 2, zy + dh + 90, { family: 'IBM Plex Mono', weight: 500, size: 64, color: '#0a8fc4', alpha: ra, align: 'center' });
      }
      ctx.restore();
      ctx.restore();
      F.caption(ctx, t, { t0: c.start + 0.3, t1: c.end + 1.2, year: '1989', title: 'YANN LeCUN · BELL LABS', sub: 'Convolutional networks read handwritten ZIP codes', accent: '#7fd8ff', x: 150, y: 846 });
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c');
      const out = [{ t: 0, type: 'wind', dur: c.start + 1, level: 0.45 }];
      for (let k = 0; k < 3; k++) {
        out.push({ t: b.start + 0.3 + k * 1.9, type: 'blip_up' });
        out.push({ t: b.start + 0.3 + k * 1.9 + 0.95, type: 'blip_down' });
      }
      out.push({ t: c.start + 0.1, type: 'pencil', dur: 1.8 });
      for (let di = 0; di < 5; di++) out.push({ t: c.start + 1.8 + (di + 0.85) * 0.4, type: 'beep_ok' });
      return out;
    },
  });
})();

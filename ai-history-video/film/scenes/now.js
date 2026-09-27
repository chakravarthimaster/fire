/* 2017–today: the Transformer, scale, ChatGPT, the present, the epilogue. */
(function () {
  'use strict';
  const { W, H } = F;

  // ========================================================= TRANSFORMER
  const TOKENS = ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired'];
  const IT = 7;
  const ATT = [0.04, 0.46, 0.03, 0.05, 0.02, 0.14, 0.04, 0.12, 0.03, 0.02, 0.05]; // attention from "it"
  let tokX, tokW;

  F.scene('transformer', {
    transIn: { type: 'fade', dur: 1.2 },
    init() {
      const c = F.canvas(10, 10).getContext('2d');
      const o = { family: 'IBM Plex Mono', weight: 500, size: 34 };
      tokW = TOKENS.map((w) => F.measure(c, w, o) + 40);
      const total = tokW.reduce((s, w) => s + w, 0) + 18 * (TOKENS.length - 1);
      let x = W / 2 - total / 2;
      tokX = tokW.map((w) => { const cx = x + w / 2; x += w + 18; return cx; });
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b1 = S.c('b1'), b2 = S.c('b2');
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1100);
      bg.addColorStop(0, '#15123a');
      bg.addColorStop(1, '#03020a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // faint dot grid
      ctx.fillStyle = 'rgba(160,170,255,0.08)';
      for (let y = F.TOP + 20; y < F.BOT; y += 40) for (let x = 20; x < W; x += 40) ctx.fillRect(x, y, 2, 2);

      // ---- the paper
      const pA = F.env(t, a.start - 0.4, a.start + 0.6, b1.start - 0.6, b1.start + 0.2);
      if (pA > 0.01) {
        const rise = (1 - F.easeOut(F.prog(t, a.start - 0.4, a.start + 1.2))) * 20;
        F.text(ctx, 'Attention Is All You Need', W / 2, 470 + rise, { family: 'Cormorant Garamond', weight: 600, size: 104, color: '#f5f0ff', alpha: pA, align: 'center', glow: 26, glowColor: 'rgba(150,140,255,0.7)' });
        const authors = 'Ashish Vaswani · Noam Shazeer · Niki Parmar · Jakob Uszkoreit · Llion Jones · Aidan N. Gomez · Łukasz Kaiser · Illia Polosukhin';
        F.text(ctx, authors, W / 2, 560, { family: 'Montserrat', weight: 400, size: 22, spacing: 1, color: '#b9b4e6', alpha: pA * F.smooth(F.prog(t, a.start + 1.2, a.start + 2.2)), align: 'center' });
        F.text(ctx, 'NIPS 2017 · LONG BEACH, CALIFORNIA', W / 2, 612, { family: 'Montserrat', weight: 500, size: 18, spacing: 8, color: '#8d87c2', alpha: pA * F.smooth(F.prog(t, a.start + 2.0, a.start + 3.0)), align: 'center' });
      }
      // ---- attention
      const tA = F.env(t, b1.start - 0.5, b1.start + 0.3);
      if (tA > 0.01) {
        const stack = F.easeInOut(F.prog(t, b2.start - 0.1, b2.start + 1.6));
        const layers = 1 + Math.floor(stack * 9);
        const y0 = F.lerp(720, 840, stack);
        const lh = 62;
        const scale = F.lerp(1, 0.62, stack);
        ctx.save();
        ctx.translate(W / 2, y0);
        ctx.scale(scale, scale);
        ctx.translate(-W / 2, -y0);
        for (let L = layers - 1; L >= 0; L--) {
          const yy = y0 - L * lh * 2.6;
          const la = L === 0 ? 1 : F.smooth(F.clamp(stack * 9 - L + 1)) * (1 - L * 0.06);
          if (la <= 0.01) continue;
          // arcs
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const allA = F.smooth(F.prog(t, b1.start + 2.4, b1.start + 3.6)) * la;
          if (allA > 0.01) {
            for (let i = 0; i < TOKENS.length; i++) for (let j = 0; j < TOKENS.length; j++) {
              if (i === j) continue;
              const x0 = tokX[i], x1 = tokX[j], h = Math.abs(x1 - x0) * 0.26 + 20;
              ctx.strokeStyle = `rgba(120,200,255,${0.07 * allA})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath(); ctx.moveTo(x0, yy - 34); ctx.bezierCurveTo(x0, yy - 34 - h, x1, yy - 34 - h, x1, yy - 34); ctx.stroke();
            }
          }
          if (L === 0) {
            const itA = F.smooth(F.prog(t, b1.start + 0.2, b1.start + 1.2)) * (1 - 0.5 * stack);
            for (let j = 0; j < TOKENS.length; j++) {
              if (j === IT) continue;
              const x0 = tokX[IT], x1 = tokX[j], h = Math.abs(x1 - x0) * 0.3 + 30;
              const wgt = ATT[j];
              const grow = F.easeOut(F.prog(t, b1.start + 0.2 + Math.abs(j - IT) * 0.06, b1.start + 1.2 + Math.abs(j - IT) * 0.06));
              ctx.strokeStyle = wgt > 0.3 ? `rgba(255,205,110,${0.95 * itA})` : `rgba(170,190,255,${(0.2 + wgt * 3) * itA})`;
              ctx.lineWidth = 1.5 + wgt * 22;
              ctx.beginPath();
              const steps = 30;
              for (let s = 0; s <= steps * grow; s++) {
                const u = s / steps;
                const bx = (1 - u) ** 3 * x0 + 3 * (1 - u) ** 2 * u * x0 + 3 * (1 - u) * u * u * x1 + u ** 3 * x1;
                const by = (1 - u) ** 3 * (yy - 34) + 3 * (1 - u) ** 2 * u * (yy - 34 - h) + 3 * (1 - u) * u * u * (yy - 34 - h) + u ** 3 * (yy - 34);
                s ? ctx.lineTo(bx, by) : ctx.moveTo(bx, by);
              }
              ctx.stroke();
            }
          }
          ctx.restore();
          // tokens
          TOKENS.forEach((w, i) => {
            const x = tokX[i], hw = tokW[i] / 2;
            const hot = L === 0 && (i === IT || i === 1) ? F.smooth(F.prog(t, b1.start + 0.4, b1.start + 1.2)) * (1 - stack) : 0;
            ctx.globalAlpha = la * tA;
            ctx.fillStyle = hot > 0.1 && i === 1 ? `rgba(90,64,20,${0.9})` : 'rgba(26,24,64,0.92)';
            ctx.strokeStyle = hot > 0.1 ? '#ffd27a' : 'rgba(150,160,255,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x - hw, yy - 30, hw * 2, 56, 10);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 1;
            F.text(ctx, w, x, yy + 10, { family: 'IBM Plex Mono', weight: 500, size: 30, color: hot > 0.1 ? '#ffe4a8' : '#e8e6ff', alpha: la * tA, align: 'center' });
          });
        }
        ctx.restore();
        F.text(ctx, 'What does “it” refer to?  Attention looks at every word at once.', W / 2, 235, {
          family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 40, color: '#e9e4ff', alpha: F.env(t, b1.start + 0.6, b1.start + 1.4, b2.start - 0.3, b2.start + 0.3), align: 'center',
        });
      }
      F.caption(ctx, t, { t0: a.start + 3.2, t1: b1.start - 0.4, year: '2017', title: 'THE TRANSFORMER · GOOGLE', sub: 'The architecture behind today’s language models', accent: '#b9a8ff', x: 150, y: 846 });
      F.vignette(ctx, 0.6);
      // clean digital look from here on: no film grain
    },
    cues(S) {
      const b1 = S.c('b1'), b2 = S.c('b2');
      return [
        { t: S.c('a').start - 0.3, type: 'swell', dur: 2.5 },
        { t: b1.start + 0.2, type: 'shimmer', dur: 2.0 },
        { t: b1.start + 2.4, type: 'datastream', dur: 2.2 },
        { t: b2.start - 0.1, type: 'riser', dur: 1.5 },
      ];
    },
  });

  // =============================================================== SCALE
  const STEPS = [
    { year: '2018', name: 'GPT-1', n: '117 MILLION', r: 70, count: 160 },
    { year: '2019', name: 'GPT-2', n: '1.5 BILLION', r: 150, count: 700 },
    { year: '2020', name: 'GPT-3', n: '175 BILLION', r: 290, count: 2400 },
  ];
  let sphere, globe;
  const fib = (n, seed) => {
    const r = F.rng(seed);
    return Array.from({ length: n }, (_, i) => {
      const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * 2.399963;
      return { x: Math.cos(th) * rad, y, z: Math.sin(th) * rad, j: r() };
    });
  };
  const RESPONSE = 'Imagine a coin spinning in the air: until it lands, it is a little bit heads and a little bit tails. A quantum bit, or qubit, works like that spinning coin, so a quantum computer can explore many possibilities at once.';

  F.scene('scale', {
    transIn: { type: 'cross', dur: 1.0 },
    init(S) {
      sphere = F.shuffle(fib(2400, 5), 55);
      globe = fib(2600, 6);
      const b = S.c('b');
      this.tyQ = F.typer('Explain quantum computing in simple terms', b.start + 1.6, 16, 501, { jitter: 0.6 });
      const words = RESPONSE.split(' ');
      this.stream = { t0: this.tyQ.end + 0.9, words, rate: 11 };
    },
    draw(ctx, t, S) {
      const a1 = S.c('a1'), a2 = S.c('a2'), b = S.c('b'), c = S.c('c');
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1000);
      bg.addColorStop(0, '#0b1830');
      bg.addColorStop(1, '#02040a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // ---- the growing sphere of parameters
      const sA = F.env(t, 0, 0.6, b.start - 0.5, b.start + 0.1);
      if (sA > 0.01) {
        const times = [a1.start + 0.2, a1.start + 1.6, a1.start + 3.0];
        let k = 0;
        for (let i = 0; i < 3; i++) if (t >= times[i]) k = i;
        const prevR = k > 0 ? STEPS[k - 1].r : 30;
        const grow = F.easeOutBack(F.prog(t, times[k], times[k] + 0.7), 1.4);
        const R = F.lerp(prevR, STEPS[k].r, grow) * (t < times[0] ? 0.5 : 1);
        const count = Math.floor(F.lerp(k > 0 ? STEPS[k - 1].count : 60, STEPS[k].count, F.clamp(grow)));
        const yaw = t * 0.35;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < count; i++) {
          const p = sphere[i];
          const x = p.x * Math.cos(yaw) - p.z * Math.sin(yaw), z = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
          const persp = 1 / (1 + z * 0.35);
          const sx = W / 2 + x * R * persp, sy = 500 + p.y * R * persp;
          const depth = 0.4 + 0.6 * (1 - (z + 1) / 2);
          F.glow(ctx, sx, sy, 3 + 3 * depth, p.j > 0.5 ? '120,200,255' : '190,150,255', sA * depth * 0.9);
        }
        F.glow(ctx, W / 2, 500, R * 1.6, '90,140,255', 0.25 * sA);
        F.glow(ctx, W / 2, 500, 500, '255,255,255', 0.4 * F.pulse(t, times[k], 0.15) * sA);
        ctx.restore();
        const st = STEPS[k];
        const la = sA * F.smooth(F.prog(t, times[0] - 0.2, times[0] + 0.4));
        F.text(ctx, `${st.year}  ·  ${st.name}`, W / 2, 858, { family: 'Montserrat', weight: 500, size: 26, spacing: 10, color: '#9fc4ff', alpha: la, align: 'center' });
        F.text(ctx, `${st.n} PARAMETERS`, W / 2, 906, { family: 'Cinzel', weight: 600, size: 40, spacing: 8, color: '#ffffff', alpha: la, align: 'center', glow: 18, glowColor: 'rgba(120,180,255,0.9)' });
        // write / translate / code cards orbiting the sphere
        const cA = F.env(t, a2.start - 0.2, a2.start + 0.4, b.start - 0.5, b.start + 0.1);
        if (cA > 0.01) {
          const cards = [
            ['WRITE', 'Once upon a time, a machine\nlearned to tell stories…', a2.start],
            ['TRANSLATE', 'Hello → Bonjour → Hola\n→ Ciao → こんにちは', a2.start + 0.9],
            ['CODE', 'def think(question):\n    return answer', a2.start + 1.8],
          ];
          cards.forEach(([title, body, t0], i) => {
            const ca = cA * F.smooth(F.prog(t, t0, t0 + 0.5));
            if (ca <= 0.01) return;
            const pos = [[170, 420], [1370, 250], [1370, 560]][i];
            const x = pos[0] + Math.sin(t * 0.6 + i) * 6, y = pos[1] + Math.cos(t * 0.5 + i * 2) * 6;
            ctx.save();
            ctx.globalAlpha = ca;
            ctx.fillStyle = 'rgba(12,20,40,0.85)';
            ctx.strokeStyle = 'rgba(140,190,255,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(x, y, 380, 150, 14); ctx.fill(); ctx.stroke();
            ctx.restore();
            F.text(ctx, title, x + 24, y + 42, { family: 'Montserrat', weight: 600, size: 20, spacing: 8, color: '#8fc0ff', alpha: ca });
            body.split('\n').forEach((l, li) => F.text(ctx, l, x + 24, y + 86 + li * 34, { family: title === 'CODE' ? 'IBM Plex Mono' : 'Cormorant Garamond', size: title === 'CODE' ? 22 : 28, color: '#eef3ff', alpha: ca }));
          });
        }
      }
      // ---- November 30, 2022: the chat window
      const chatA = F.env(t, b.start - 0.1, b.start + 0.6, c.start - 0.9, c.start - 0.1);
      const shrink = F.easeInOut(F.prog(t, c.start - 0.9, c.start + 0.1));
      if (chatA > 0.01) {
        ctx.save();
        const cx = W / 2, cy = 545;
        ctx.translate(cx, cy);
        const sc = F.lerp(1, 0.02, shrink);
        ctx.scale(sc, sc);
        ctx.translate(-cx, -cy);
        ctx.globalAlpha = chatA;
        const bx = 460, by = 230, bw = 1000, bh = 620;
        ctx.fillStyle = '#121418';
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 24); ctx.fill(); ctx.stroke();
        // user bubble
        const q = this.tyQ.at(t);
        if (t >= this.tyQ.t0 - 0.3) {
          const qw = Math.max(80, F.measure(ctx, this.tyQ.text, { family: 'Montserrat', size: 26 }) + 50);
          ctx.fillStyle = '#2b2f38';
          ctx.beginPath(); ctx.roundRect(bx + bw - 40 - qw, by + 50, qw, 64, 32); ctx.fill();
          F.text(ctx, q, bx + bw - 40 - qw + 25, by + 91, { family: 'Montserrat', size: 26, color: '#f2f3f5' });
        }
        // streamed answer
        const st = this.stream;
        const nWords = Math.max(0, Math.min(st.words.length, Math.floor((t - st.t0) * st.rate)));
        if (nWords > 0) {
          const txt = st.words.slice(0, nWords).join(' ');
          const lines = F.wrap(ctx, txt, bw - 120, { family: 'Montserrat', size: 28 });
          lines.forEach((l, i) => F.text(ctx, l, bx + 60, by + 190 + i * 46, { family: 'Montserrat', size: 28, color: '#e6e8ec' }));
          const last = lines[lines.length - 1] || '';
          if (nWords < st.words.length) {
            const cxp = bx + 60 + F.measure(ctx, last, { family: 'Montserrat', size: 28 }) + 10;
            ctx.fillStyle = '#e6e8ec';
            ctx.beginPath(); ctx.arc(cxp + 8, by + 180 + (lines.length - 1) * 46, 9, 0, F.TAU); ctx.fill();
          }
        }
        // input bar
        ctx.fillStyle = '#1d2027';
        ctx.beginPath(); ctx.roundRect(bx + 40, by + bh - 100, bw - 80, 64, 32); ctx.fill();
        F.text(ctx, 'Send a message', bx + 80, by + bh - 58, { family: 'Montserrat', size: 24, color: '#6f7480' });
        ctx.restore();
        F.text(ctx, 'NOVEMBER 30, 2022', W / 2, 200, { family: 'Montserrat', weight: 500, size: 26, spacing: 14, color: '#d8dbe2', alpha: chatA * (1 - shrink) * F.smooth(F.prog(t, b.start + 0.2, b.start + 1.0)), align: 'center' });
      }
      // ---- the world tries it
      const gA = F.smooth(F.prog(t, c.start - 0.45, c.start + 0.3));
      if (gA > 0.01) {
        const yaw = t * 0.3, R = 300;
        const lit = F.prog(t, c.start - 0.3, c.end + 0.4);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < globe.length; i++) {
          const p = globe[i];
          const x = p.x * Math.cos(yaw) - p.z * Math.sin(yaw), z = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
          if (z > 0.25) continue;
          const on = p.j < Math.pow(lit, 1.3);
          const sx = W / 2 + x * R, sy = 500 + p.y * R;
          F.glow(ctx, sx, sy, on ? 7 : 3, on ? '255,214,140' : '90,120,170', gA * (on ? 0.9 : 0.35) * (0.5 + 0.5 * -z));
        }
        F.glow(ctx, W / 2, 500, 480, '255,190,110', 0.22 * lit * gA);
        ctx.restore();
        const u1 = F.env(t, c.start + 0.3, c.start + 0.9, c.start + 1.6, c.start + 2.0);
        const u2 = F.smooth(F.prog(t, c.start + 1.8, c.start + 2.4));
        const count = Math.floor(F.lerp(1, 100, F.easeInOut(F.prog(t, c.start + 1.8, c.end + 0.2))));
        F.text(ctx, '1 MILLION USERS IN 5 DAYS', W / 2, 890, { family: 'Montserrat', weight: 500, size: 30, spacing: 10, color: '#ffe0b0', alpha: u1 * gA, align: 'center' });
        F.text(ctx, `${count} MILLION USERS IN 2 MONTHS`, W / 2, 890, { family: 'Montserrat', weight: 600, size: 34, spacing: 10, color: '#ffffff', alpha: u2 * gA, align: 'center', glow: 16, glowColor: 'rgba(255,190,110,0.9)' });
      }
      F.vignette(ctx, 0.6);
      // clean digital look from here on: no film grain
    },
    cues(S) {
      const a1 = S.c('a1'), b = S.c('b'), c = S.c('c');
      const out = [
        { t: a1.start + 0.2, type: 'boom', size: 0.35 },
        { t: a1.start + 1.6, type: 'boom', size: 0.45 },
        { t: a1.start + 3.0, type: 'boom', size: 0.55 },
        { t: b.start - 0.2, type: 'hush', dur: 1.0 },
        ...F.typerCues(this.tyQ, 'softkey'),
      ];
      const st = this.stream;
      for (let i = 0; i < st.words.length; i++) {
        const tt = st.t0 + i / st.rate;
        if (tt > c.start - 0.2) break;
        if (i % 2 === 0) out.push({ t: tt, type: 'tick_soft' });
      }
      out.push({ t: c.start - 1.25, type: 'riser', dur: 0.8 });
      out.push({ t: c.start - 0.45, type: 'impact', size: 0.75 });
      out.push({ t: c.start + 1.0, type: 'shimmer', dur: 2.5 });
      return out;
    },
  });

  // ============================================================= PRESENT
  const NAMES = ['GPT-4', 'Claude', 'Gemini', 'Llama', 'Midjourney', 'Stable Diffusion', 'Sora', 'AlphaFold 3', 'DeepSeek', 'Mistral', 'Copilot', 'Whisper', 'Qwen', 'Grok', 'DALL·E 3', 'o1', 'Veo', 'AlphaProof'];
  let protein, proteinTarget, equations;

  F.scene('present', {
    transIn: { type: 'flash', dur: 0.8 },
    init() {
      // protein: random coil -> helix bundle
      const r = F.rng(2020);
      protein = [];
      proteinTarget = [];
      let x = 0, y = 0, z = 0;
      const N = 140;
      for (let i = 0; i < N; i++) {
        x += (r() - 0.5) * 1.6; y += (r() - 0.5) * 1.6; z += (r() - 0.5) * 1.6;
        protein.push([x, y, z]);
      }
      const cx = protein.reduce((s, p) => s + p[0], 0) / N, cy = protein.reduce((s, p) => s + p[1], 0) / N, cz = protein.reduce((s, p) => s + p[2], 0) / N;
      protein = protein.map(([a, b, c]) => [(a - cx) * 0.55, (b - cy) * 0.55, (c - cz) * 0.55]);
      // four helices packed in a bundle, joined by loops
      const per = N / 4;
      for (let i = 0; i < N; i++) {
        const h = Math.floor(i / per), u = (i % per) / per;
        const hx = [-1.3, 1.3, 1.3, -1.3][h], hz = [-1.3, -1.3, 1.3, 1.3][h];
        const dir = h % 2 === 0 ? 1 : -1;
        const ang = i * 1.75;
        proteinTarget.push([hx + Math.cos(ang) * 0.75, dir * (u * 7 - 3.5), hz + Math.sin(ang) * 0.75]);
      }
      equations = [
        'a² + b² = c²', '∑ 1/n² = π²/6', 'e^{iπ} + 1 = 0', '∫₀^∞ e^{-x²} dx = √π / 2',
        'f(x+y) = f(x) + f(y)', 'p ≡ 1 (mod 4)', 'xⁿ + yⁿ ≠ zⁿ', '∀ε > 0 ∃δ > 0',
      ];
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c1 = S.c('c1'), c2 = S.c('c2'), d = S.c('d');
      ctx.fillStyle = '#04050a';
      ctx.fillRect(0, 0, W, H);
      // ---- a: hyperspace of names
      const hA = F.env(t, -0.5, 0.2, b.start - 0.3, b.start + 0.2);
      if (hA > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 160; i++) {
          const ang = F.hash(i, 3) * F.TAU, sp = 0.3 + F.hash(i, 4);
          const z = ((t * sp * 0.6 + F.hash(i, 5)) % 1);
          const rr = 60 + Math.pow(z, 2.2) * 1400;
          const x = W / 2 + Math.cos(ang) * rr, y = H / 2 + Math.sin(ang) * rr * 0.6;
          const x2 = W / 2 + Math.cos(ang) * rr * 0.9, y2 = H / 2 + Math.sin(ang) * rr * 0.6 * 0.9;
          ctx.strokeStyle = `rgba(160,200,255,${0.5 * z * hA})`;
          ctx.lineWidth = 1 + 2 * z;
          ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
        }
        ctx.restore();
        NAMES.forEach((n, i) => {
          const t0 = -0.6 + i * 0.2;
          const z = F.prog(t, t0, t0 + 1.6);
          if (z <= 0 || z >= 1) return;
          const ang = F.hash(i, 11) * F.TAU;
          const rr = 40 + Math.pow(z, 2) * 900;
          const sc = 0.4 + Math.pow(z, 2) * 2.4;
          F.text(ctx, n, W / 2 + Math.cos(ang) * rr, H / 2 + Math.sin(ang) * rr * 0.55, {
            family: 'Montserrat', weight: 500, size: 30 * sc, spacing: 3, color: '#ffffff', alpha: hA * Math.sin(Math.PI * z), align: 'center',
          });
        });
        ['2023', '2024', '2025'].forEach((y, i) => {
          const t0 = a.start - 0.4 + i * 0.8;
          const z = F.prog(t, t0, t0 + 1.1);
          if (z <= 0 || z >= 1) return;
          F.text(ctx, y, W / 2, H / 2 + 50, { family: 'Cinzel', weight: 600, size: 80 + z * 380, spacing: 10, color: '#ffe2a8', alpha: hA * Math.sin(Math.PI * z) * 0.9, align: 'center' });
        });
      }
      // ---- b: writes, paints, speaks, sees
      const qA = F.env(t, b.start - 0.2, b.start + 0.3, c1.start - 0.3, c1.start + 0.2);
      if (qA > 0.01) this.drawQuads(ctx, t, b, qA);
      // ---- c1: protein folding
      const pA = F.env(t, c1.start - 0.2, c1.start + 0.5, c2.start - 0.2, c2.start + 0.4);
      if (pA > 0.01) this.drawProtein(ctx, t, c1, pA);
      // ---- c2: Nobel prizes
      const nA = F.env(t, c2.start - 0.1, c2.start + 0.6, d.start - 0.3, d.start + 0.2);
      if (nA > 0.01) this.drawNobel(ctx, t, c2, nA);
      // ---- d: maths, software, agents
      const dA = F.env(t, d.start - 0.2, d.start + 0.3, S.dur - 0.8, S.dur + 0.5);
      if (dA > 0.01) this.drawAgents(ctx, t, d, dA);
      F.vignette(ctx, 0.55);
      // clean digital look from here on: no film grain
    },
    drawQuads(ctx, t, b, alpha) {
      const qs = [
        [0, 'WRITES'], [1, 'PAINTS'], [2, 'SPEAKS'], [3, 'SEES'],
      ];
      const pw = 800, ph = 330, gx = W / 2 - pw - 12, gy = 540 - ph - 12;
      for (const [i, label] of qs) {
        const t0 = b.start + i * 0.55;
        const k = F.smooth(F.prog(t, t0 - 0.1, t0 + 0.35)) * alpha;
        if (k <= 0.01) continue;
        const x = gx + (i % 2) * (pw + 24), y = gy + Math.floor(i / 2) * (ph + 24);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 18); ctx.clip();
        ctx.fillStyle = '#0c1020';
        ctx.fillRect(x, y, pw, ph);
        const tt = t - t0;
        if (i === 0) {
          const line = 'The light remembers what the dark forgets.';
          const n = Math.floor(F.clamp(tt / 1.6) * line.length);
          F.text(ctx, line.slice(0, n), x + 50, y + ph / 2 + 12, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 46, color: '#f5ecda' });
        } else if (i === 1) {
          // a painting resolving out of noise
          const g = ctx.createLinearGradient(0, y, 0, y + ph);
          g.addColorStop(0, '#1d2b6b'); g.addColorStop(0.55, '#e0735a'); g.addColorStop(1, '#f6c177');
          ctx.fillStyle = g;
          ctx.fillRect(x, y, pw, ph);
          ctx.fillStyle = '#ffe6b0';
          ctx.beginPath(); ctx.arc(x + pw * 0.64, y + ph * 0.58, 58, 0, F.TAU); ctx.fill();
          ctx.fillStyle = '#2a1f4a';
          ctx.beginPath(); ctx.moveTo(x, y + ph); ctx.lineTo(x + 180, y + ph * 0.55); ctx.lineTo(x + 330, y + ph * 0.75); ctx.lineTo(x + 520, y + ph * 0.45); ctx.lineTo(x + pw, y + ph * 0.8); ctx.lineTo(x + pw, y + ph); ctx.fill();
          ctx.fillStyle = '#15102a';
          ctx.beginPath(); ctx.moveTo(x, y + ph); ctx.lineTo(x + 260, y + ph * 0.8); ctx.lineTo(x + 470, y + ph * 0.9); ctx.lineTo(x + pw, y + ph * 0.7); ctx.lineTo(x + pw, y + ph); ctx.fill();
          const noise = 1 - F.smooth(F.clamp(tt / 1.8));
          if (noise > 0.01) F.grainRect(ctx, x, y, pw, ph, t, noise);
        } else if (i === 2) {
          ctx.strokeStyle = '#8fd0ff';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          for (let k2 = 0; k2 < 48; k2++) {
            const bx = x + 60 + k2 * 14.5;
            const amp = (0.2 + 0.8 * Math.abs(Math.sin(k2 * 0.7 + tt * 7) * Math.sin(k2 * 0.23 + tt * 3))) * 110 * F.clamp(tt * 2);
            ctx.beginPath(); ctx.moveTo(bx, y + ph / 2 - amp / 2); ctx.lineTo(bx, y + ph / 2 + amp / 2); ctx.stroke();
          }
        } else {
          ctx.font = '120px "Noto Color Emoji"';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐈', x + 250, y + ph / 2 + 10);
          ctx.fillText('☕', x + 560, y + ph / 2 + 30);
          const box = F.clamp(tt / 0.6);
          ctx.strokeStyle = `rgba(90,255,160,${box})`;
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 160, y + 70, 180, 190);
          ctx.strokeRect(x + 480, y + 110, 160, 160);
          F.text(ctx, 'cat 0.98', x + 162, y + 62, { family: 'IBM Plex Mono', weight: 500, size: 24, color: '#5affa0', alpha: box });
          F.text(ctx, 'coffee 0.94', x + 482, y + 102, { family: 'IBM Plex Mono', weight: 500, size: 24, color: '#5affa0', alpha: box });
        }
        ctx.restore();
        F.text(ctx, label, x + 28, y + 50, { family: 'Montserrat', weight: 600, size: 22, spacing: 10, color: '#ffffff', alpha: k * 0.85 });
      }
    },
    drawProtein(ctx, t, c1, alpha) {
      const fold = F.easeInOut(F.prog(t, c1.start + 0.3, c1.start + 3.6));
      const P = F.camera3d(t * 0.5, 0.35, 11.5, 820, W / 2, 530);
      const pts = protein.map((p, i) => {
        const q = proteinTarget[i];
        return P(F.lerp(p[0], q[0], fold), F.lerp(p[1], q[1], fold), F.lerp(p[2], q[2], fold));
      });
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < pts.length; i++) {
        const u = i / pts.length;
        const hue = 240 - u * 240;
        ctx.strokeStyle = `hsl(${hue},85%,${55 + 10 * Math.sin(i)}%)`;
        ctx.lineWidth = Math.max(3, pts[i][2] * 0.35);
        ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
      F.glow(ctx, W / 2, 520, 420, '120,160,255', 0.25 * fold * alpha);
      ctx.restore();
      F.caption(ctx, t, { t0: c1.start + 0.2, t1: c1.end + 0.3, year: '2020', title: 'DEEPMIND ALPHAFOLD', sub: 'More than 200 million protein structures predicted', accent: '#9cc3ff', x: 150, y: 846 });
    },
    drawNobel(ctx, t, c2, alpha) {
      const cards = [
        ['NOBEL PRIZE IN PHYSICS', 'John Hopfield', 'Geoffrey Hinton', 'Foundational work on artificial neural networks'],
        ['NOBEL PRIZE IN CHEMISTRY', 'Demis Hassabis · John Jumper', 'David Baker', 'Protein structure prediction and design'],
      ];
      F.text(ctx, '2024', W / 2, 240, { family: 'Cinzel', weight: 600, size: 64, spacing: 20, color: '#ffd98a', alpha, align: 'center', glow: 22, glowColor: 'rgba(255,190,90,0.8)' });
      cards.forEach(([title, l1, l2, sub], i) => {
        const k = alpha * F.smooth(F.prog(t, c2.start + 0.3 + i * 0.5, c2.start + 1.0 + i * 0.5));
        if (k <= 0.01) return;
        const x = W / 2 + (i === 0 ? -490 : 490), y = 590;
        ctx.save();
        ctx.globalAlpha = k;
        ctx.strokeStyle = 'rgba(255,210,130,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 300, 0, F.TAU); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 286, 0, F.TAU); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, x, y, 380, '255,190,100', 0.2);
        ctx.restore();
        F.text(ctx, title, x, y - 104, { family: 'Montserrat', weight: 600, size: 20, spacing: 5, color: '#ffd98a', alpha: k, align: 'center' });
        F.text(ctx, l1, x, y - 20, { family: 'Cormorant Garamond', weight: 600, size: 38, color: '#fff4dc', alpha: k, align: 'center' });
        F.text(ctx, l2, x, y + 30, { family: 'Cormorant Garamond', weight: 600, size: 38, color: '#fff4dc', alpha: k, align: 'center' });
        F.text(ctx, sub, x, y + 100, { family: 'Cormorant Garamond', style: 'italic', size: 27, color: '#e9d7b0', alpha: k * 0.9, align: 'center' });
      });
      const sw = F.prog(t, c2.start + 1.4, c2.start + 3.4);
      if (sw > 0 && sw < 1) F.flare(ctx, F.lerp(300, W - 300, F.easeInOut(sw)), 560, Math.sin(Math.PI * sw) * 0.6, '255,200,120', 900);
    },
    drawAgents(ctx, t, d, alpha) {
      const seg = d.dur / 3;
      const parts = [d.start, d.start + seg * 0.95, d.start + seg * 1.9];
      // mathematics
      const mA = alpha * F.env(t, parts[0] - 0.2, parts[0] + 0.3, parts[1] - 0.2, parts[1] + 0.2);
      if (mA > 0.01) {
        equations.forEach((e, i) => {
          const y = 250 + ((i * 90 + (t - d.start) * 60) % 640);
          F.text(ctx, e, 260 + (i % 3) * 520, y, { family: 'Cormorant Garamond', style: 'italic', size: 44, color: '#dfe6ff', alpha: mA * 0.35, align: 'center' });
        });
        F.text(ctx, 'INTERNATIONAL MATHEMATICAL OLYMPIAD', W / 2, 500, { family: 'Montserrat', weight: 500, size: 28, spacing: 10, color: '#cfd8ff', alpha: mA, align: 'center' });
        F.text(ctx, 'GOLD-MEDAL LEVEL · 2025', W / 2, 590, { family: 'Cinzel', weight: 600, size: 72, spacing: 8, color: '#ffd98a', alpha: mA, align: 'center', glow: 24, glowColor: 'rgba(255,190,90,0.85)' });
      }
      // software
      const sA = alpha * F.env(t, parts[1] - 0.2, parts[1] + 0.3, parts[2] - 0.2, parts[2] + 0.2);
      if (sA > 0.01) {
        const code = [
          ['+', 'def fold(sequence):'],
          ['+', '    structure = model.predict(sequence)'],
          ['-', '    return None  # TODO'],
          ['+', '    return refine(structure)'],
          [' ', ''],
          ['+', 'test_fold_matches_known_structure ... ok'],
          ['+', 'test_handles_long_chains ........... ok'],
        ];
        const n = Math.floor(F.prog(t, parts[1], parts[1] + seg * 0.8) * code.length);
        ctx.save();
        ctx.globalAlpha = sA;
        ctx.fillStyle = '#0d1117';
        ctx.beginPath(); ctx.roundRect(360, 230, 1200, 560, 16); ctx.fill();
        ctx.restore();
        code.slice(0, n).forEach(([sgn, l], i) => {
          const col = sgn === '+' ? '#7ee787' : sgn === '-' ? '#ff7b72' : '#c9d1d9';
          if (sgn !== ' ') {
            ctx.save();
            ctx.globalAlpha = sA * 0.18;
            ctx.fillStyle = col;
            ctx.fillRect(360, 280 + i * 62 - 38, 1200, 54);
            ctx.restore();
          }
          F.text(ctx, `${sgn} ${l}`, 400, 280 + i * 62, { family: 'IBM Plex Mono', size: 30, color: col, alpha: sA });
        });
      }
      // agents acting
      const aA = alpha * F.env(t, parts[2] - 0.2, parts[2] + 0.3);
      if (aA > 0.01) {
        const tasks = ['Read the research papers', 'Run the experiments', 'Summarize the results', 'Draft the report'];
        F.text(ctx, 'AGENT', 560, 280, { family: 'Montserrat', weight: 600, size: 22, spacing: 10, color: '#8fc0ff', alpha: aA });
        tasks.forEach((task, i) => {
          const tk = parts[2] + 0.3 + i * 0.45;
          const done = t > tk + 0.3;
          const ra = aA * F.smooth(F.prog(t, tk - 0.3, tk));
          ctx.save();
          ctx.globalAlpha = ra;
          ctx.strokeStyle = done ? '#7ee787' : '#8fa3c0';
          ctx.lineWidth = 3;
          ctx.strokeRect(560, 330 + i * 90, 44, 44);
          if (done) {
            ctx.beginPath(); ctx.moveTo(568, 352 + i * 90); ctx.lineTo(580, 366 + i * 90); ctx.lineTo(598, 338 + i * 90); ctx.stroke();
          }
          ctx.restore();
          F.text(ctx, task, 640, 364 + i * 90, { family: 'Montserrat', weight: 400, size: 34, color: done ? '#e8ffe8' : '#cfd8e6', alpha: ra });
        });
        // cursor gliding between tasks
        const ci = F.clamp(Math.floor((t - parts[2] - 0.3) / 0.45), 0, 3);
        const cxp = 582 + Math.sin(t * 3) * 4, cyp = 352 + ci * 90 + 10;
        ctx.save();
        ctx.globalAlpha = aA;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(cxp, cyp); ctx.lineTo(cxp + 22, cyp + 22); ctx.lineTo(cxp + 10, cyp + 22); ctx.lineTo(cxp + 4, cyp + 34); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },
    cues(S) {
      const b = S.c('b'), c1 = S.c('c1'), c2 = S.c('c2'), d = S.c('d');
      const seg = d.dur / 3;
      const out = [{ t: -0.3, type: 'hyperspace', dur: b.start + 0.3 }];
      for (let i = 0; i < 4; i++) out.push({ t: b.start + i * 0.55, type: 'pop', idx: i });
      out.push({ t: c1.start + 0.3, type: 'fold', dur: 3.3 });
      out.push({ t: c2.start + 0.3, type: 'boom', size: 0.3 });
      out.push({ t: c2.start + 1.4, type: 'shimmer', dur: 2.2 });
      out.push({ t: d.start, type: 'pop', idx: 1 });
      out.push({ t: d.start + seg * 0.95, type: 'pop', idx: 2 });
      out.push({ t: d.start + seg * 1.9, type: 'pop', idx: 3 });
      for (let i = 0; i < 4; i++) out.push({ t: d.start + seg * 1.9 + 0.6 + i * 0.45, type: 'beep_ok' });
      return out;
    },
  });

  /** Coloured noise over a rectangle (diffusion "denoising"). */
  let noiseTile = null;
  F.grainRect = (ctx, x, y, w, h, t, amount) => {
    if (!noiseTile) {
      noiseTile = F.canvas(256, 256);
      const g = noiseTile.getContext('2d');
      const img = g.createImageData(256, 256);
      const r = F.rng(77);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = r() * 255; img.data[i + 1] = r() * 255; img.data[i + 2] = r() * 255; img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    ctx.save();
    ctx.globalAlpha = amount;
    const f = Math.floor(t * 24);
    const ox = Math.floor(F.hash(f, 1) * 256), oy = Math.floor(F.hash(f, 2) * 256);
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let yy = y - oy; yy < y + h; yy += 256) for (let xx = x - ox; xx < x + w; xx += 256) ctx.drawImage(noiseTile, xx, yy);
    ctx.restore();
  };

  // ============================================================ EPILOGUE
  const Q1 = '“Can machines think?”';
  const Q2 = 'What will we build together?';
  const QF = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 112 };
  F.scene('epilogue', {
    transIn: { type: 'fade', dur: 2.0 },
    init(S) {
      const a = S.c('a'), c = S.c('c');
      this.ty1 = F.typer(Q1, a.start + 1.6, 7, 12, { pause: 0.6 });
      this.delT0 = c.end + 0.7;
      this.delRate = 22;
      this.delEnd = this.delT0 + Q1.length / this.delRate;
      this.ty2 = F.typer(Q2, this.delEnd + 0.7, 8, 13, { pause: 0.5 });
      const g = F.canvas(10, 10).getContext('2d');
      this.w1 = F.measure(g, Q1, QF);
      this.w2 = F.measure(g, Q2, QF);
    },
    draw(ctx, t, S) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      // the last spark of the montage becomes the cursor
      const spark = F.env(t, 0, 0.3, 1.2, 2.2);
      if (spark > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, W / 2, 560, 60 + 200 * (1 - F.prog(t, 0, 2.2)), '255,230,190', spark);
        ctx.restore();
      }
      // text: the old question, deleted, then the new one
      let str, x0;
      const done2 = t >= this.ty2.t0;
      if (!done2) {
        const typed = this.ty1.at(t);
        const del = t >= this.delT0 ? Math.min(Q1.length, Math.floor((t - this.delT0) * this.delRate)) : 0;
        str = typed.slice(0, Math.max(0, typed.length - del));
        x0 = W / 2 - this.w1 / 2;
      } else {
        str = this.ty2.at(t);
        x0 = W / 2 - this.w2 / 2;
      }
      const bloom = F.smooth(F.prog(t, this.ty2.end, this.ty2.end + 2.0));
      if (bloom > 0.01) {
        const g = ctx.createRadialGradient(W / 2, 540, 0, W / 2, 540, 900);
        g.addColorStop(0, `rgba(255,190,110,${0.28 * bloom})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        F.motes(ctx, t, { n: 70, seed: 91, alpha: 0.4 * bloom, size: 4, speed: 10, rgb: '255,220,160' });
      }
      F.text(ctx, str, x0, 580, { ...QF, color: done2 ? '#fff1d6' : '#f3ead7', glow: 18 + 20 * bloom, glowColor: `rgba(255,${done2 ? 200 : 220},${done2 ? 130 : 170},${0.35 + 0.4 * bloom})` });
      // cursor
      const typing = (t > this.ty1.t0 && t < this.ty1.end + 0.1) || (t > this.delT0 && t < this.delEnd) || (t > this.ty2.t0 && t < this.ty2.end + 0.1);
      const blink = typing || Math.floor(t * 1.9) % 2 === 0;
      const cA = F.env(t, 1.6, 2.2, S.dur - 2.5, S.dur - 1.5) * (blink ? 1 : 0);
      if (cA > 0) {
        const cx = x0 + F.measure(ctx, str, QF) + 12;
        ctx.globalAlpha = cA;
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(cx, 580 - 88, 6, 104);
        ctx.globalAlpha = 1;
      }
      const attr = F.env(t, this.ty1.end + 0.6, this.ty1.end + 1.6, this.delT0 - 0.6, this.delT0);
      F.text(ctx, '— A. M. Turing, 1950', W / 2, 660, { family: 'Montserrat', weight: 300, size: 26, spacing: 8, color: '#a99f8c', alpha: attr, align: 'center' });
      F.vignette(ctx, 0.55);
    },
    cues(S) {
      const out = [...F.typerCues(this.ty1, 'key', { heavy: 1, gain: 0.45 })];
      for (let i = 0; i < Q1.length; i++) out.push({ t: this.delT0 + i / this.delRate, type: 'backspace' });
      out.push(...F.typerCues(this.ty2, 'key', { heavy: 1, gain: 0.75 }));
      out.push({ t: this.ty1.end + 0.8, type: 'motif', variant: 'question', gain: 0.6 });
      out.push({ t: this.ty2.end + 0.3, type: 'motif', variant: 'answer' });
      out.push({ t: this.ty2.end + 0.3, type: 'swell', dur: 5 });
      return out;
    },
  });
})();

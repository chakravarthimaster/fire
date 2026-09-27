/* Part I: the three horizons, what AI absorbs, the new bottleneck, AGI, ASI. */
(function () {
  'use strict';
  const { W, H } = F;

  const sky = (ctx, top, horizon, glowRgb, glowA = 0.25, y = 640) => {
    const g = ctx.createLinearGradient(0, F.TOP, 0, F.BOT);
    g.addColorStop(0, top);
    g.addColorStop(0.7, horizon);
    g.addColorStop(1, '#030409');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (glowRgb) {
      const r = ctx.createRadialGradient(W / 2, y, 0, W / 2, y, 1000);
      r.addColorStop(0, F.rgba(glowRgb, glowA));
      r.addColorStop(1, F.rgba(glowRgb, 0));
      ctx.fillStyle = r;
      ctx.fillRect(0, 0, W, H);
    }
  };

  /** Label with a big word, a caption and a leader line to a point. */
  const horizonLabel = (ctx, word, cap, x, y, px, py, rgb, a) => {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = F.rgba(rgb, 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x - 18, y - 16); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    F.glow(ctx, px, py, 26, rgb, 0.9 * a);
    ctx.restore();
    F.text(ctx, word, x, y, { family: 'Cinzel', weight: 600, size: 54, spacing: 8, color: F.rgba(rgb, 1), alpha: a, glow: 18, glowColor: F.rgba(rgb, 0.6) });
    F.text(ctx, cap, x, y + 38, { family: 'Montserrat', weight: 500, size: 19, spacing: 3, color: '#dfe6f5', alpha: a * 0.9 });
  };

  // ============================================================ HORIZONS
  let farR, midR, nearR;
  F.scene('horizons', {
    transIn: { type: 'fade', dur: 1.6 },
    init() {
      farR = F.ridge(3, 640, 70, 0.8);
      midR = F.ridge(7, 720, 95, 1.0);
      nearR = F.ridge(11, 820, 120, 1.3);
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d = S.c('d'), e = S.c('e'), f = S.c('f');
      sky(ctx, '#050818', '#1a1c40', F.VIOLET, 0.22);
      // aurora
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        for (let i = 0; i <= 40; i++) {
          const x = (i / 40) * W;
          const y = 300 + k * 60 + Math.sin(i * 0.25 + t * 0.15 + k) * 40 + Math.sin(i * 0.07 - t * 0.1) * 30;
          F.glow(ctx, x, y, 90, k === 1 ? F.VIOLET : F.AI, 0.035);
        }
      }
      ctx.restore();
      F.stars(ctx, t, 0.9, { maxY: 700 });
      const push = 1 + 0.07 * F.smooth(F.prog(t, 3, S.dur));
      const layer = (ys, fill, depth, glowRgb, glowA) => {
        ctx.save();
        const z = 1 + (push - 1) * depth;
        ctx.translate(W / 2, H * 0.62);
        ctx.scale(z, z);
        ctx.translate(-W / 2, -H * 0.62);
        F.drawRidge(ctx, ys, fill, 1, glowRgb, glowA);
        ctx.restore();
      };
      const lb = F.env(t, b.start - 0.2, b.start + 0.8), lc = F.env(t, c.start - 0.2, c.start + 0.8), ld = F.env(t, d.start - 0.2, d.start + 0.8);
      const pulse = (x) => 0.55 + 0.45 * Math.sin(t * 2 + x);
      layer(farR, '#23254d', 0.3, F.ROSE, 0.7 * ld * pulse(1));
      // fog
      const fog = ctx.createLinearGradient(0, 600, 0, 760);
      fog.addColorStop(0, 'rgba(120,120,190,0)');
      fog.addColorStop(1, 'rgba(120,120,190,0.12)');
      ctx.fillStyle = fog;
      ctx.fillRect(0, 600, W, 160);
      layer(midR, '#141733', 0.6, F.VIOLET, 0.7 * lc * pulse(2));
      layer(nearR, '#090b18', 1.0, F.AI, 0.8 * lb * pulse(3));
      // foreground outcrop with the observer
      ctx.fillStyle = '#030409';
      ctx.beginPath();
      ctx.moveTo(-10, H); ctx.lineTo(-10, 870); ctx.quadraticCurveTo(200, 845, 420, 858); ctx.quadraticCurveTo(560, 868, 640, 900); ctx.lineTo(700, H); ctx.closePath();
      ctx.fill();
      F.human(ctx, 380, 860, 1.25, F.HUMAN, F.env(t, 1.0, 3.0));
      // labels
      horizonLabel(ctx, 'AI', 'NOW · tools that write, analyze, design and code', 1180, 700, 1050, nearR[52] + 4, F.AI, lb * (1 - 0.5 * F.env(t, e.start, e.start + 1)));
      horizonLabel(ctx, 'AGI', 'NEXT? · could match people at most mental work', 1180, 540, 950, midR[47] + 4, F.VIOLET, lc * (1 - 0.5 * F.env(t, e.start, e.start + 1)));
      horizonLabel(ctx, 'ASI', 'BEYOND? · would surpass us in nearly every field', 1180, 380, 860, farR[42] + 4, F.ROSE, ld * (1 - 0.5 * F.env(t, e.start, e.start + 1)));
      // uncertainty
      const ua = F.env(t, e.start - 0.2, e.start + 0.8, f.start + 0.4, f.start + 1.2);
      if (ua > 0.01) {
        const y = 250, x0 = 360, x1 = 1560;
        F.text(ctx, 'NO ONE KNOWS THE TIMELINE', W / 2, y - 50, { family: 'Montserrat', weight: 600, size: 22, spacing: 10, color: '#f0e8d8', alpha: ua, align: 'center' });
        ctx.save();
        ctx.globalAlpha = ua;
        ctx.strokeStyle = 'rgba(220,225,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        const u = 0.5 + 0.5 * Math.sin((t - e.start) * 1.4);
        for (let k = 0; k < 7; k++) F.glow(ctx, F.lerp(x0, x1, F.clamp(u + (k - 3) * 0.04)), y, 50, F.VIOLET, 0.12);
        ctx.restore();
        [['YEARS', 0.08], ['DECADES', 0.5], ['NEVER?', 0.92]].forEach(([l, u2], i) => {
          const la = ua * F.smooth(F.prog(t, e.start + 0.8 + i * 1.6, e.start + 1.4 + i * 1.6));
          ctx.fillStyle = `rgba(230,230,255,${la})`;
          ctx.beginPath(); ctx.arc(F.lerp(x0, x1, u2), y, 6, 0, F.TAU); ctx.fill();
          F.text(ctx, l, F.lerp(x0, x1, u2), y + 44, { family: 'Montserrat', weight: 500, size: 22, spacing: 6, color: '#dcdcff', alpha: la, align: 'center' });
        });
      }
      const fa = F.env(t, f.start - 0.1, f.start + 0.6);
      F.text(ctx, "Don't predict the future.", W / 2, 230, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 52, color: '#e8ecff', alpha: fa, align: 'center' });
      F.text(ctx, 'Prepare for all of it.', W / 2, 300, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 52, color: '#ffe2ae', alpha: F.env(t, F.phraseAt(f, "It's to prepare") - 0.1, F.phraseAt(f, "It's to prepare") + 0.6), align: 'center', glow: 16, glowColor: 'rgba(255,196,107,0.5)' });
      F.partCard(ctx, t, { t0: -0.8, t1: 3.6, num: 'PART I', title: 'THE FUTURE', sub: 'Three horizons: AI, AGI and ASI' });
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c'), d = S.c('d'), e = S.c('e');
      return [
        { t: 0.1, type: 'impact', size: 0.45 },
        { t: b.start - 0.1, type: 'shimmer', dur: 1.5 },
        { t: c.start - 0.1, type: 'shimmer', dur: 1.5 },
        { t: d.start - 0.1, type: 'shimmer', dur: 2.0 },
        { t: e.start + 0.8, type: 'pop', idx: 0 }, { t: e.start + 2.4, type: 'pop', idx: 1 }, { t: e.start + 4.0, type: 'pop', idx: 2 },
      ];
    },
  });

  // ========================================================== ABSORPTION
  const TASKS = [
    ['doc', 'Writing specs'], ['search', 'Research synthesis'], ['chart', 'Data analysis'], ['ticket', 'Tickets & stories'],
    ['report', 'Status reports'], ['chat', 'Meeting notes'], ['target', 'Competitive analysis'], ['layers', 'Roadmap decks'],
    ['grid', 'Wireframes'], ['pen', 'Release notes'], ['check', 'Test plans'], ['code', 'Prototypes'],
  ];
  F.scene('absorption', {
    transIn: { type: 'fade', dur: 1.2 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d = S.c('d'), e = S.c('e');
      sky(ctx, '#060914', '#0c1226', F.AI, 0.08);
      // ---- the week, as cards
      const gA = F.env(t, 0.2, 1.0, d.start - 0.3, d.start + 0.6);
      const cw = 320, ch = 112, gap = 28;
      const x0 = W / 2 - (4 * cw + 3 * gap) / 2, y0 = 330;
      const ta = gA * F.env(t, a.start - 0.2, a.start + 0.6);
      const flipped = F.prog(t, c.start, c.start + 1.4);
      F.text(ctx, flipped > 0.05 ? 'AI IS ABSORBING THE PRODUCTION WORK' : "A PRODUCT MANAGER'S WEEK", W / 2, 268, { family: 'Montserrat', weight: 600, size: 22, spacing: 10, color: flipped > 0.05 ? '#9fe3ff' : '#f0e8d8', alpha: ta, align: 'center' });
      TASKS.forEach(([ic, label], i) => {
        const ti = b.start + (i / TASKS.length) * b.dur * 0.9;
        const ca = gA * F.smooth(F.prog(t, ti - 0.1, ti + 0.4));
        if (ca <= 0.01) return;
        const cx = x0 + (i % 4) * (cw + gap), cy = y0 + Math.floor(i / 4) * (ch + gap);
        const tf = c.start + i * 0.11;
        const k = F.prog(t, tf, tf + 0.28);
        const sx = Math.abs(Math.cos(Math.PI * k));
        const ai = k >= 0.5;
        ctx.save();
        ctx.translate(cx + cw / 2, cy + ch / 2);
        ctx.scale(Math.max(0.02, sx), 1);
        ctx.translate(-(cx + cw / 2), -(cy + ch / 2));
        F.panel(ctx, cx, cy, cw, ch, { rgb: ai ? F.AI : '200,205,220', edge: ai ? 0.8 : 0.35, alpha: ca, glow: ai ? 0.6 : 0, fill: ai ? 'rgba(8,30,48,0.85)' : 'rgba(18,22,34,0.85)' });
        F.icon(ctx, ic, cx + 50, cy + ch / 2, 40, ai ? F.AI : '225,228,238', ca);
        F.text(ctx, label, cx + 90, cy + ch / 2 + 9, { family: 'Montserrat', weight: 500, size: 23, color: ai ? '#e3f7ff' : '#e6e8ef', alpha: ca });
        if (ai) F.text(ctx, 'AI', cx + cw - 22, cy + 30, { family: 'Montserrat', weight: 700, size: 16, spacing: 2, color: '#5fd4ff', alpha: ca, align: 'right' });
        ctx.restore();
      });
      // ---- afternoon, evening, morning
      const dA = F.env(t, d.start - 0.2, d.start + 0.6, e.start - 0.3, e.start + 0.4);
      if (dA > 0.01) {
        const t1 = d.start, t2 = F.phraseAt(d, 'put it in front'), t3 = F.phraseAt(d, 'and read the results');
        const hue = F.prog(t, t1, d.end);
        const skyTint = hue < 0.5 ? [255, 170, 90] : hue < 0.8 ? [60, 80, 180] : [255, 150, 170];
        const glow = ctx.createRadialGradient(W / 2, 700, 0, W / 2, 700, 1000);
        glow.addColorStop(0, `rgba(${skyTint},${0.14 * dA})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
        const xs = [460, 960, 1460], y = 520;
        ctx.strokeStyle = `rgba(210,220,240,${0.35 * dA})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xs[0], y); ctx.lineTo(xs[2], y); ctx.stroke();
        const stations = [['sun', 'AFTERNOON', 'Build a working prototype', t1], ['users', 'EVENING', 'Real users try it', t2], ['trend', 'NEXT MORNING', 'Read the results', t3]];
        stations.forEach(([ic, when, what, ts], i) => {
          const sa = dA * F.smooth(F.prog(t, ts - 0.2, ts + 0.5));
          ctx.save();
          ctx.globalAlpha = dA;
          ctx.fillStyle = '#0b1020';
          ctx.strokeStyle = F.rgba(i === 1 ? F.HUMAN : F.AI, 0.35 + 0.6 * sa);
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(xs[i], y, 62, 0, F.TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
          F.icon(ctx, ic, xs[i], y, 58, i === 1 ? F.HUMAN : F.AI, 0.3 * dA + 0.7 * sa, { glow: 14 * sa });
          F.text(ctx, when, xs[i], y + 120, { family: 'Montserrat', weight: 600, size: 22, spacing: 8, color: '#f2e6cf', alpha: sa, align: 'center' });
          F.text(ctx, what, xs[i], y + 164, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 36, color: '#e9edf8', alpha: sa, align: 'center' });
        });
        const u = F.clamp((t - t1) / (d.end - t1));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, F.lerp(xs[0], xs[2], F.easeInOut(u)), y, 30, '255,255,255', 0.9 * dA);
        ctx.restore();
        F.text(ctx, 'ONE PRODUCT MANAGER · ONE DAY', W / 2, 300, { family: 'Montserrat', weight: 600, size: 22, spacing: 10, color: '#f0e8d8', alpha: dA, align: 'center' });
      }
      // ---- the curves cross
      const eA = F.env(t, e.start - 0.2, e.start + 0.6);
      if (eA > 0.01) {
        const X0 = 440, X1 = 1480, Yb = 800, Yt = 300;
        const draw = F.easeInOut(F.prog(t, e.start, e.start + 2.6));
        ctx.save();
        ctx.globalAlpha = eA;
        ctx.strokeStyle = 'rgba(200,210,235,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X0, Yt); ctx.lineTo(X0, Yb); ctx.lineTo(X1, Yb); ctx.stroke();
        const curve = (fn, rgb, glow) => {
          ctx.strokeStyle = F.rgba(rgb, 1);
          ctx.lineWidth = 5;
          ctx.shadowColor = F.rgba(rgb, 0.8);
          ctx.shadowBlur = glow;
          ctx.beginPath();
          for (let i = 0; i <= 100 * draw; i++) {
            const u = i / 100;
            const x = F.lerp(X0, X1, u), y = F.lerp(Yb, Yt, fn(u));
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        };
        const gl = F.env(t, F.phraseAt(e, 'something else') - 0.2, F.phraseAt(e, 'something else') + 0.6);
        curve((u) => 0.08 + 0.85 * Math.exp(-u * 3.2), F.AI, 8);
        curve((u) => 0.08 + 0.85 / (1 + Math.exp(-(u - 0.55) * 9)), F.HUMAN, 8 + 30 * gl);
        ctx.restore();
        F.text(ctx, 'COST OF BUILDING', X0 + 30, Yt + 20, { family: 'Montserrat', weight: 600, size: 22, spacing: 6, color: '#8fdcff', alpha: eA * F.smooth(F.prog(draw, 0.1, 0.3)) });
        F.text(ctx, 'VALUE OF JUDGMENT', X1, Yt - 10, { family: 'Montserrat', weight: 600, size: 22, spacing: 6, color: '#ffd27a', alpha: eA * F.smooth(F.prog(draw, 0.8, 1)), align: 'right' });
        F.text(ctx, 'TIME →', X1, Yb + 40, { family: 'Montserrat', weight: 500, size: 16, spacing: 6, color: '#8c96b0', alpha: eA, align: 'right' });
        F.text(ctx, 'illustrative', X0, Yb + 40, { family: 'Cormorant Garamond', style: 'italic', size: 22, color: '#8c96b0', alpha: eA });
      }
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c'), d = S.c('d'), e = S.c('e');
      const out = [];
      TASKS.forEach((_, i) => out.push({ t: b.start + (i / TASKS.length) * b.dur * 0.9, type: 'tick_soft' }));
      TASKS.forEach((_, i) => out.push({ t: c.start + i * 0.11 + 0.14, type: 'flip', idx: i }));
      out.push({ t: d.start, type: 'whoosh', dur: 0.8 });
      [d.start, F.phraseAt(d, 'put it in front'), F.phraseAt(d, 'and read the results')].forEach((tt, i) => out.push({ t: tt, type: 'pop', idx: i }));
      out.push({ t: e.start, type: 'whoosh', dur: 0.7 });
      out.push({ t: F.phraseAt(e, 'something else') - 0.9, type: 'riser', dur: 0.9 });
      return out;
    },
  });

  // ========================================================== BOTTLENECK
  const NODES = [['bulb', 'IDEA', 330], ['compass', 'DECIDE', 720], ['code', 'BUILD', 1110], ['trend', 'LEARN', 1500]];
  /** Particle x-position along a pipe with a queue before `neck`. */
  const flowX = (u, neck, x0 = 250, x1 = 1640) => {
    // piecewise-linear time map: slow (x0.22 speed) for 220px before the neck
    const q0 = neck - 220, slow = 0.22;
    const L1 = q0 - x0, L2 = 220 / slow, L3 = x1 - neck, T = L1 + L2 + L3;
    let s = u * T;
    if (s < L1) return x0 + s;
    s -= L1;
    if (s < L2) return q0 + s * slow;
    return neck + (s - L2);
  };
  F.scene('bottleneck', {
    transIn: { type: 'fade', dur: 1.0 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c');
      sky(ctx, '#07080f', '#110f1c', F.HUMAN, 0.1);
      // ---- JUDGMENT
      const jA = F.env(t, 0.45, 0.8, b.start + 0.2, b.start + 0.9);
      F.text(ctx, 'HUMAN', W / 2, 430, { family: 'Montserrat', weight: 500, size: 28, spacing: 22, color: '#f0dcb8', alpha: jA * F.smooth(F.prog(t, 0.6, 1.2)), align: 'center' });
      F.text(ctx, 'JUDGMENT', W / 2, 590, { family: 'Cinzel', weight: 600, size: 150, spacing: 20, color: '#ffe2ae', alpha: jA, align: 'center', glow: 40, glowColor: 'rgba(255,190,90,0.7)' });
      // ---- the pipeline
      const pA = F.env(t, b.start + 0.1, b.start + 0.9, c.start - 0.2, c.start + 0.6);
      if (pA > 0.01) {
        const tNow = F.phraseAt(b, 'Now the hard part');
        const shift = F.easeInOut(F.prog(t, tNow - 0.2, tNow + 1.2));
        const tEval = F.phraseAt(b, 'and knowing whether');
        const y = 560;
        // pipe
        const widthAt = (x) => {
          const nb = Math.exp(-Math.pow((x - 1110) / 70, 2)), nd = Math.exp(-Math.pow((x - 720) / 70, 2));
          return 44 - 32 * nb * (1 - shift) - 32 * nd * shift;
        };
        ctx.save();
        ctx.globalAlpha = pA;
        ctx.beginPath();
        for (let x = 250; x <= 1640; x += 10) ctx.lineTo(x, y - widthAt(x));
        for (let x = 1640; x >= 250; x -= 10) ctx.lineTo(x, y + widthAt(x));
        ctx.closePath();
        ctx.fillStyle = 'rgba(20,26,44,0.8)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,175,210,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // particles: queue before the current neck
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 260; i++) {
          const ph = F.hash(i, 3), lane = F.hash(i, 5) * 2 - 1;
          const u = ((t - b.start) * 0.09 + ph) % 1;
          const xOld = flowX(u, 1110), xNew = flowX(u, 720);
          const x = F.lerp(xOld, xNew, shift);
          const yy = y + lane * (widthAt(x) - 8);
          const gold = x < 760 && shift > 0.5;
          F.glow(ctx, x, yy, 7, gold ? F.HUMAN : F.AI, 0.7);
        }
        ctx.restore();
        // nodes
        NODES.forEach(([ic, label, x], i) => {
          const isDecide = i === 1;
          const na = pA * (isDecide ? F.smooth(F.prog(shift, 0.2, 0.8)) : 1);
          if (na <= 0.01) return;
          const hot = isDecide ? shift : i === 2 ? 1 - shift : i === 3 ? F.env(t, tEval - 0.2, tEval + 0.5) : 0;
          const rgb = isDecide || i === 3 ? F.HUMAN : F.AI;
          ctx.save();
          ctx.globalAlpha = na;
          ctx.fillStyle = '#0a0e1b';
          ctx.strokeStyle = F.rgba(rgb, 0.4 + 0.6 * hot);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y, 58, 0, F.TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
          F.icon(ctx, ic, x, y, 54, rgb, na * (0.55 + 0.45 * hot), { glow: 16 * hot });
          F.text(ctx, label, x, y + 110, { family: 'Montserrat', weight: 600, size: 22, spacing: 8, color: '#eef1f8', alpha: na, align: 'center' });
        });
        F.text(ctx, 'THE BOTTLENECK', shift < 0.5 ? 1110 : 720, y - 120, { family: 'Montserrat', weight: 600, size: 18, spacing: 8, color: shift < 0.5 ? '#8fdcff' : '#ffd27a', alpha: pA * Math.abs(shift - 0.5) * 2, align: 'center' });
        F.text(ctx, 'THEN', W / 2, 290, { family: 'Montserrat', weight: 500, size: 20, spacing: 10, color: '#a9b4cc', alpha: pA * (1 - shift), align: 'center' });
        F.text(ctx, 'Building was the hard part', W / 2, 345, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 44, color: '#cfe9ff', alpha: pA * (1 - shift), align: 'center' });
        F.text(ctx, 'NOW', W / 2, 290, { family: 'Montserrat', weight: 500, size: 20, spacing: 10, color: '#ffd27a', alpha: pA * shift, align: 'center' });
        F.text(ctx, 'Deciding is the hard part', W / 2, 345, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 44, color: '#ffe2ae', alpha: pA * shift, align: 'center' });
      }
      // ---- the scarcest skill
      const cA = F.env(t, c.start - 0.1, c.start + 0.7);
      F.text(ctx, 'THE SCARCEST SKILL', W / 2, 460, { family: 'Montserrat', weight: 500, size: 26, spacing: 14, color: '#f0dcb8', alpha: cA, align: 'center' });
      F.text(ctx, "DECIDING WHAT'S WORTH BUILDING", W / 2, 560, { family: 'Cinzel', weight: 600, size: 64, spacing: 8, color: '#ffe2ae', alpha: F.env(t, F.phraseAt(c, 'deciding') - 0.1, F.phraseAt(c, 'deciding') + 0.6), align: 'center', glow: 26, glowColor: 'rgba(255,190,90,0.6)' });
      F.vignette(ctx, 0.55);
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c');
      return [
        { t: 0.45, type: 'impact', size: 0.75 },
        { t: b.start + 0.2, type: 'flow', dur: c.start - b.start },
        { t: F.phraseAt(b, 'Now the hard part') - 0.1, type: 'whoosh', dur: 1.0 },
        { t: F.phraseAt(c, 'deciding') - 0.1, type: 'shimmer', dur: 2.0 },
      ];
    },
  });

  // ================================================================ AGI
  const AGENTS = [
    ['search', 'RESEARCH', 'research the market'], ['grid', 'DESIGN', 'design the interface'], ['code', 'CODE', 'write and test'],
    ['check', 'TEST', 'test the code'], ['trend', 'ANALYTICS', 'analyze the launch'], ['chat', 'SUPPORT', null],
  ];
  F.scene('agi', {
    transIn: { type: 'fade', dur: 1.2 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d = S.c('d');
      sky(ctx, '#060818', '#141537', F.VIOLET, 0.15);
      F.stars(ctx, t, 0.5);
      // callback: the AGI horizon
      const hA = F.env(t, 0, 0.6, b.start - 0.4, b.start + 0.4);
      if (hA > 0.01) {
        const ys = F.ridge(7, 800, 95, 1.0);
        F.drawRidge(ctx, ys, '#141733', hA, F.VIOLET, 0.8 * hA);
        F.text(ctx, 'THE SECOND HORIZON', W / 2, 460, { family: 'Montserrat', weight: 600, size: 24, spacing: 14, color: '#d7d0ff', alpha: hA, align: 'center' });
        F.text(ctx, 'AGI', W / 2, 580, { family: 'Cinzel', weight: 600, size: 110, spacing: 16, color: '#c9b8ff', alpha: hA, align: 'center', glow: 30, glowColor: 'rgba(168,139,255,0.7)' });
      }
      const cx = 1090, cy = 565, rx = 350, ry = 235;
      const pos = (i) => {
        const ang = -Math.PI / 2 + (i / AGENTS.length) * F.TAU + 0.03 * Math.sin(t * 0.3);
        return [cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry];
      };
      const agentT = (i) => {
        const [, , phrase] = AGENTS[i];
        return phrase ? F.phraseAt(b, phrase) : b.end - 0.6;
      };
      const tOrch = F.phraseAt(c, 'steering a team');
      const orch = F.smooth(F.prog(t, tOrch - 0.3, tOrch + 0.8));
      const allA = F.env(t, b.start - 0.2, b.start + 0.3, d.start + 0.6, d.end + 1.4);
      // beams from you to the agents
      const youA = allA * F.smooth(F.prog(t, c.start - 0.2, c.start + 0.6));
      if (orch > 0.01) {
        ctx.save();
        for (let i = 0; i < AGENTS.length; i++) {
          const [x, y] = pos(i);
          ctx.strokeStyle = `rgba(255,210,150,${0.25 * orch * allA})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          const u1 = ((t * 0.7 + i * 0.17) % 1), u2 = ((t * 0.7 + i * 0.17 + 0.5) % 1);
          F.glow(ctx, F.lerp(cx, x, u1), F.lerp(cy, y, u1), 12, F.HUMAN, 0.9 * orch * allA);
          F.glow(ctx, F.lerp(x, cx, u2), F.lerp(y, cy, u2), 10, F.AI, 0.8 * orch * allA);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
      }
      // agents (faint empty slots first, lit as each is named)
      F.text(ctx, 'AI AGENTS THAT ACT', W / 2, 215, { family: 'Montserrat', weight: 600, size: 22, spacing: 12, color: '#9fe3ff', alpha: allA * (1 - F.smooth(F.prog(t, tOrch - 0.4, tOrch + 0.4))), align: 'center' });
      F.text(ctx, 'ORCHESTRATOR OF INTELLIGENCE', W / 2, 215, { family: 'Montserrat', weight: 600, size: 22, spacing: 12, color: '#ffd27a', alpha: allA * orch, align: 'center' });
      AGENTS.forEach(([ic, label], i) => {
        const ta = agentT(i);
        const [x, y] = pos(i);
        const slot = allA * (1 - F.smooth(F.prog(t, ta - 0.1, ta + 0.5)));
        if (slot > 0.01) F.panel(ctx, x - 62, y - 62, 124, 124, { r: 22, rgb: F.AI, edge: 0.25, alpha: slot * 0.6, fill: 'rgba(8,16,30,0.5)' });
        const aa = allA * F.smooth(F.prog(t, ta - 0.1, ta + 0.5));
        if (aa <= 0.01) return;
        F.panel(ctx, x - 62, y - 62, 124, 124, { r: 22, rgb: F.AI, edge: 0.75, glow: 0.7, alpha: aa, fill: 'rgba(8,24,40,0.9)' });
        F.icon(ctx, ic, x, y - 8, 46, F.AI, aa, { glow: 10 });
        F.icon(ctx, 'agent', x + 44, y - 44, 22, '180,230,255', aa * 0.7);
        F.text(ctx, label, x, y + 44, { family: 'Montserrat', weight: 600, size: 14, spacing: 3, color: '#dff6ff', alpha: aa, align: 'center' });
        // activity bar
        ctx.fillStyle = `rgba(95,212,255,${0.8 * aa})`;
        ctx.fillRect(x - 40, y + 70, 80 * (0.5 + 0.5 * Math.sin(t * 3 + i)), 3);
      });
      // you
      if (youA > 0.01) {
        ctx.save();
        ctx.globalAlpha = youA;
        ctx.fillStyle = '#1a1206';
        ctx.strokeStyle = F.rgba(F.HUMAN, 1);
        ctx.lineWidth = 3;
        ctx.shadowColor = F.rgba(F.HUMAN, 0.9);
        ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(cx, cy, 78, 0, F.TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
        F.icon(ctx, 'user', cx, cy - 8, 60, F.HUMAN, youA, { glow: 12 });
        F.text(ctx, 'YOU', cx, cy + 50, { family: 'Montserrat', weight: 700, size: 18, spacing: 8, color: '#ffe2ae', alpha: youA, align: 'center' });
      }
      // goal, constraints, definition of success
      const specs = [['target', 'GOAL', 'setting the goal'], ['lock', 'CONSTRAINTS', 'the constraints'], ['check', 'DEFINITION OF SUCCESS', 'the definition of success']];
      specs.forEach(([ic, label, phrase], i) => {
        const ts = F.phraseAt(c, phrase);
        const sa = allA * F.smooth(F.prog(t, ts - 0.1, ts + 0.5));
        if (sa <= 0.01) return;
        const y = 330 + i * 150;
        F.panel(ctx, 100, y - 50, 500, 100, { rgb: F.HUMAN, edge: 0.7, alpha: sa, glow: 0.5, fill: 'rgba(30,20,8,0.85)' });
        F.icon(ctx, ic, 150, y, 40, F.HUMAN, sa, { glow: 8 });
        F.text(ctx, label, 192, y + 8, { family: 'Montserrat', weight: 600, size: 21, spacing: 5, color: '#ffe8c2', alpha: sa });
      });
      // backlog -> outcomes
      const bA = F.env(t, d.start - 0.1, d.start + 0.4);
      if (bA > 0.01) {
        ctx.fillStyle = `rgba(3,5,10,${0.7 * bA})`;
        ctx.fillRect(0, 0, W, H);
        const strike = F.easeOut(F.prog(t, d.start + 0.5, d.start + 1.0));
        F.text(ctx, 'BACKLOG', W / 2, 470, { family: 'Cinzel', weight: 600, size: 72, spacing: 14, color: '#8c96b0', alpha: bA, align: 'center' });
        const w = 480;
        ctx.fillStyle = `rgba(255,120,110,${bA})`;
        ctx.fillRect(W / 2 - w / 2, 445, w * strike, 5);
        const oA = F.smooth(F.prog(t, F.phraseAt(d, "You'll manage") - 0.1, F.phraseAt(d, "You'll manage") + 0.5));
        F.text(ctx, 'OUTCOMES', W / 2, 610, { family: 'Cinzel', weight: 600, size: 96, spacing: 16, color: '#ffe2ae', alpha: oA, align: 'center', glow: 30, glowColor: 'rgba(255,190,90,0.7)' });
      }
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c'), d = S.c('d');
      const out = [{ t: 0.1, type: 'shimmer', dur: 1.8 }];
      AGENTS.forEach(([, , phrase], i) => out.push({ t: phrase ? F.phraseAt(b, phrase) : b.end - 0.6, type: 'pop', idx: i % 4 }));
      out.push({ t: c.start - 0.2, type: 'swell', dur: 0.8 });
      ['setting the goal', 'the constraints', 'the definition of success'].forEach((p) => out.push({ t: F.phraseAt(c, p), type: 'tick_soft' }));
      out.push({ t: F.phraseAt(c, 'steering a team') - 0.2, type: 'datastream', dur: 4.0 });
      out.push({ t: d.start + 0.5, type: 'strike' });
      out.push({ t: F.phraseAt(d, "You'll manage") - 0.05, type: 'boom', size: 0.45 });
      return out;
    },
  });

  // ================================================================ ASI
  F.scene('asi', {
    transIn: { type: 'fade', dur: 1.4 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d = S.c('d');
      sky(ctx, '#05040f', '#1c1030', F.ROSE, 0.12, 700);
      F.stars(ctx, t, 0.8, { maxY: 820 });
      // the colossus rising
      const rise = F.easeOut(F.prog(t, 0, b.start + 2));
      const cx = W / 2, cy = F.lerp(1000, 660, rise), R = 330;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      F.glow(ctx, cx, cy, R * 3.2, F.ROSE, 0.28);
      F.glow(ctx, cx, cy, R * 1.6, '255,230,240', 0.35);
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 9; k++) {
        const tilt = k * 0.35 + t * (0.06 + k * 0.01);
        const e = 0.18 + (k % 3) * 0.12;
        ctx.strokeStyle = `rgba(${k % 2 ? '255,190,220' : '200,190,255'},0.35)`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * (0.7 + k * 0.05), R * e * (0.7 + k * 0.05), tilt, 0, F.TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 160; i++) {
        const ang = F.hash(i, 2) * F.TAU + t * (0.1 + F.hash(i, 3) * 0.3);
        const rr = R * (0.4 + F.hash(i, 4) * 0.9);
        F.glow(ctx, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.45, 3 + F.hash(i, 5) * 4, '255,220,240', 0.6);
      }
      ctx.restore();
      // foreground ridge and the person
      const ys = F.ridge(21, 880, 60, 0.9);
      F.drawRidge(ctx, ys, '#040309', 1);
      const hum = 1 + 0.4 * F.smooth(F.prog(t, d.start, d.start + 1.5));
      F.human(ctx, 640, 870, 1.2, F.HUMAN, 1);
      if (hum > 1.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, 640, 800, 160, F.HUMAN, 0.5 * (hum - 1) / 0.4);
        ctx.restore();
      }
      // how -> what
      const bA = F.env(t, b.start - 0.1, b.start + 0.6, c.start - 0.3, c.start + 0.4);
      const tWhat = F.phraseAt(b, 'to what should exist');
      F.text(ctx, 'HOW TO BUILD', W / 2, 250, { family: 'Montserrat', weight: 600, size: 24, spacing: 12, color: '#bfb3d9', alpha: bA * (1 - F.smooth(F.prog(t, tWhat - 0.4, tWhat + 0.2))), align: 'center' });
      F.text(ctx, 'What should exist?', W / 2, 270, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 72, color: '#ffe8f2', alpha: bA * F.smooth(F.prog(t, tWhat - 0.1, tWhat + 0.6)), align: 'center', glow: 20, glowColor: 'rgba(255,143,179,0.5)' });
      // the four questions
      const qs = [['WHAT MATTERS?', 'decide what matters', 390, 330], ['WHOSE PROBLEMS COME FIRST?', 'Whose problems', 1530, 330], ['WHICH TRADE-OFFS ARE ACCEPTABLE?', 'Which trade-offs', 390, 560], ['WHO IS ACCOUNTABLE?', 'who is accountable', 1530, 560]];
      const cA = F.env(t, c.start - 0.2, c.start + 0.4, d.start - 0.4, d.start + 0.2);
      qs.forEach(([q, phrase, x, y]) => {
        const tq = F.phraseAt(c, phrase);
        const qa = cA * F.smooth(F.prog(t, tq - 0.1, tq + 0.5));
        if (qa <= 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 4; k++) F.glow(ctx, x - 140 + k * 90 + Math.sin(k * 3) * 20, y - 44 + Math.cos(k * 2) * 12, 8, '255,230,240', 0.8 * qa);
        ctx.restore();
        ctx.strokeStyle = `rgba(255,220,235,${0.25 * qa})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 4; k++) { const px = x - 140 + k * 90 + Math.sin(k * 3) * 20, py = y - 44 + Math.cos(k * 2) * 12; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        F.text(ctx, q, x, y, { family: 'Montserrat', weight: 600, size: 22, spacing: 5, color: '#ffe3ee', alpha: qa, align: 'center' });
      });
      // values, trust, responsibility
      const dA = F.env(t, d.start + 0.2, d.start + 0.9);
      F.text(ctx, 'VALUES  ·  TRUST  ·  RESPONSIBILITY', W / 2, 280, { family: 'Cinzel', weight: 600, size: 54, spacing: 10, color: '#ffe2ae', alpha: dA, align: 'center', glow: 22, glowColor: 'rgba(255,190,90,0.6)' });
      const tp = F.phraseAt(d, 'And they belong');
      F.text(ctx, 'They belong to people.', W / 2, 350, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 46, color: '#f6ead2', alpha: dA * F.smooth(F.prog(t, tp - 0.1, tp + 0.6)), align: 'center' });
      F.vignette(ctx, 0.55);
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c'), d = S.c('d');
      const out = [{ t: 0.2, type: 'swell', dur: 3.0 }];
      ['decide what matters', 'Whose problems', 'Which trade-offs', 'who is accountable'].forEach((p, i) => out.push({ t: F.phraseAt(c, p), type: 'pop', idx: i }));
      out.push({ t: F.phraseAt(b, 'to what should exist') - 0.1, type: 'shimmer', dur: 2.0 });
      out.push({ t: d.start - 0.1, type: 'shimmer', dur: 2.5 });
      return out;
    },
  });
})();

/* Part IV: the roadmap (a night climb toward sunrise), seven habits, and the doors in. */
(function () {
  'use strict';
  const { W, H } = F;

  // ============================================================ ROADMAP
  const STAGES = [
    { clip: 'b', num: 'STAGE 1', when: 'MONTHS 0–3', name: 'FOUNDATIONS', short: 'FOUNDATIONS', span: '0–3 MO', rgb: '120,190,255', at: 0.2,
      items: [['book', 'Read the classics of product management', 'Read the classics'], ['spark', 'Learn how AI models work', 'Learn how AI models work'], ['bolt', 'Use AI tools every day', 'Use AI tools every day'], ['search', 'Take apart ten AI products', 'take apart ten']] },
    { clip: 'c', num: 'STAGE 2', when: 'MONTHS 3–6', name: 'BUILD', short: 'BUILD', span: '3–6 MO', rgb: '90,225,200', at: 0.46,
      items: [['rocket', 'Ship 2–3 small AI products to real users', 'Ship two or three'], ['doc', 'Write the spec, define the metrics', 'Write the spec'], ['check', 'Design the evaluations', 'design the evaluations'], ['pen', 'Publish what you learned', 'publish what you learned']] },
    { clip: 'd', num: 'STAGE 3', when: 'MONTHS 6–12', name: 'SPECIALIZE', short: 'SPECIALIZE', span: '6–12 MO', rgb: '168,139,255', at: 0.72,
      items: [['compass', 'Choose your domain', 'Choose your domain'], ['database', 'Learn its data, workflows and rules', 'Learn its data'], ['spark', 'Get close to an AI feature at work', 'Get close to an AI feature'], ['code', '…or build one on your own', 'or build one']] },
    { clip: 'e', num: 'STAGE 4', when: 'YEARS 1–3', name: 'LEAD', short: 'LEAD', span: '1–3 YRS', rgb: '255,200,120', at: 1.0,
      items: [['target', 'Own an AI product area', 'Own an AI product area'], ['agent', 'Orchestrate people and agents', 'Orchestrate people and agents'], ['users', 'Mentor others', 'Mentor others'], ['globe', 'Share your thinking in public', 'share your thinking in public']] },
  ];

  // trail up the mountain face, in world coordinates
  const CP = [[150, 935], [430, 868], [300, 790], [575, 728], [420, 648], [660, 570], [540, 492], [735, 415], [720, 352], [818, 262]];
  const TRAIL = (() => {
    const pts = [];
    for (let i = 0; i < CP.length - 1; i++) {
      const p0 = CP[Math.max(0, i - 1)], p1 = CP[i], p2 = CP[i + 1], p3 = CP[Math.min(CP.length - 1, i + 2)];
      for (let k = 0; k < 24; k++) {
        const u = k / 24, u2 = u * u, u3 = u2 * u;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    pts.push(CP[CP.length - 1]);
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, len, total: len[len.length - 1] };
  })();
  function trailAt(f) {
    const d = F.clamp(f) * TRAIL.total;
    let i = 1;
    while (i < TRAIL.len.length - 1 && TRAIL.len[i] < d) i++;
    const a = TRAIL.pts[i - 1], b = TRAIL.pts[i];
    const u = (d - TRAIL.len[i - 1]) / Math.max(1e-6, TRAIL.len[i] - TRAIL.len[i - 1]);
    return [F.lerp(a[0], b[0], u), F.lerp(a[1], b[1], u)];
  }
  // the mountain silhouette (peak at 818,250)
  const PEAK = [818, 250];
  const MOUNT = (() => {
    const pts = [];
    for (let x = -700; x <= 1500; x += 12) {
      const dx = x - PEAK[0];
      let y = dx < 0 ? PEAK[1] - dx * 0.68 : PEAK[1] + dx * 1.45;
      const rough = Math.min(1, Math.abs(dx) / 160);
      y += (F.noise(x * 0.012, 7) * 46 + F.noise(x * 0.04, 9) * 12) * rough;
      pts.push([x, y]);
    }
    return pts;
  })();

  function stageTimes(S) {
    return STAGES.map((st) => S.c(st.clip));
  }
  function progressAt(t, S) {
    const a = S.c('a');
    let f = 0;
    STAGES.forEach((st, i) => {
      const c = S.c(st.clip);
      const from = i ? STAGES[i - 1].at : 0;
      const t0 = c.start - (i ? 0.8 : 0.6), t1 = c.start + (i === 3 ? 1.6 : 1.3);
      if (t >= t0) f = F.lerp(from, st.at, F.smooth(F.prog(t, t0, t1)));
    });
    return t < a.start ? 0 : f;
  }

  F.scene('roadmap', {
    transIn: { type: 'fade', dur: 1.4 },
    draw(ctx, t, S) {
      const a = S.c('a'), e = S.c('e');
      const cl = stageTimes(S);
      const f = progressAt(t, S);
      const dawn = F.smooth(F.clamp(f / 1.0)) * 0.75 + 0.25 * F.smooth(F.prog(t, e.start + 1.0, S.dur - 0.5));
      // ---- sky (screen space)
      const top = [F.lerp(4, 22, dawn), F.lerp(6, 24, dawn), F.lerp(16, 58, dawn)];
      const hor = [F.lerp(20, 214, dawn), F.lerp(26, 128, dawn), F.lerp(58, 96, dawn)];
      const sky = ctx.createLinearGradient(0, F.TOP, 0, 820);
      sky.addColorStop(0, `rgb(${top.map(Math.round)})`);
      sky.addColorStop(0.65, `rgb(${top.map((v, i) => Math.round(F.lerp(v, hor[i], 0.45)))})`);
      sky.addColorStop(1, `rgb(${hor.map(Math.round)})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      F.stars(ctx, t, 0.75 * (1 - dawn * 0.9), { maxY: 760 });

      // ---- camera
      const zin = F.smooth(F.prog(t, a.end - 0.4, cl[0].start + 1.4));
      const zout = F.smooth(F.prog(t, e.end - 0.3, S.dur - 0.2));
      const zb = zin * (1 - zout);
      const s = 1 + 0.2 * zb;
      const tp = trailAt(f);
      const AX = 600, AY = 600;
      const fx = AX + 0.6 * zb * (tp[0] - AX), fy = AY + 0.6 * zb * (tp[1] - AY);
      const toScreen = (x, y) => [AX + (x - fx) * s, AY + (y - fy) * s];

      // ---- sun behind the summit
      const sunW = toScreen(900, F.lerp(560, 330, dawn));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      F.glow(ctx, sunW[0], sunW[1], 900 * s, '255,150,90', 0.32 * dawn);
      F.glow(ctx, sunW[0], sunW[1], 340 * s, '255,205,140', 0.5 * dawn);
      F.glow(ctx, sunW[0], sunW[1], 90 * s, '255,240,210', 0.9 * dawn * dawn);
      ctx.restore();

      // ---- far ridges with parallax
      // far ridges drift less than the mountain; drawn wider than the frame so their ends never show
      const par = (k) => { ctx.save(); ctx.translate(W / 2 + (AX - fx) * s * k, (AY - fy) * s * k); ctx.scale(1.25, 1); ctx.translate(-W / 2, 0); };
      par(0.25);
      F.drawRidge(ctx, F.ridge(11, 700, 140, 0.8), `rgb(${Math.round(F.lerp(16, 70, dawn))},${Math.round(F.lerp(20, 50, dawn))},${Math.round(F.lerp(40, 70, dawn))})`, 1, '255,180,120', 0.25 * dawn);
      ctx.restore();
      par(0.5);
      F.drawRidge(ctx, F.ridge(23, 800, 90, 1.1), `rgb(${Math.round(F.lerp(10, 40, dawn))},${Math.round(F.lerp(12, 28, dawn))},${Math.round(F.lerp(26, 44, dawn))})`);
      ctx.restore();

      // ---- the mountain
      ctx.save();
      ctx.translate(AX - fx * s, AY - fy * s);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(MOUNT[0][0], 1600);
      MOUNT.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(MOUNT[MOUNT.length - 1][0], 1600);
      ctx.closePath();
      const mg = ctx.createLinearGradient(0, 250, 0, 1000);
      mg.addColorStop(0, `rgb(${Math.round(F.lerp(22, 60, dawn))},${Math.round(F.lerp(26, 44, dawn))},${Math.round(F.lerp(44, 58, dawn))})`);
      mg.addColorStop(1, '#05060c');
      ctx.fillStyle = mg;
      ctx.fill();
      // the sunlit face, right of the crease
      ctx.save();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(PEAK[0], PEAK[1]);
      ctx.lineTo(1000, 1000);
      ctx.lineTo(1600, 1000);
      ctx.lineTo(1600, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(255,170,110,${0.05 + 0.13 * dawn})`;
      ctx.fill();
      ctx.restore();
      // rim light along the ridge line
      ctx.beginPath();
      MOUNT.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = `rgba(255,${Math.round(F.lerp(190, 200, dawn))},${Math.round(F.lerp(200, 140, dawn))},${0.25 + 0.55 * dawn})`;
      ctx.lineWidth = 2 / s;
      ctx.shadowColor = `rgba(255,190,120,${0.3 + 0.6 * dawn})`;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---- trail: dashed full path, glowing walked part
      const draw = F.smooth(F.prog(t, a.start + 0.2, a.start + 2.8));
      if (draw > 0) {
        const n = Math.max(2, Math.floor(TRAIL.pts.length * draw));
        ctx.beginPath();
        for (let i = 0; i < n; i++) (i ? ctx.lineTo(...TRAIL.pts[i]) : ctx.moveTo(...TRAIL.pts[i]));
        ctx.setLineDash([6, 9]);
        ctx.strokeStyle = 'rgba(220,225,245,0.35)';
        ctx.lineWidth = 2 / s;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (f > 0.001) {
        const dEnd = f * TRAIL.total;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < TRAIL.pts.length && TRAIL.len[i] <= dEnd; i++) {
          if (!started) { ctx.moveTo(...TRAIL.pts[i]); started = true; } else ctx.lineTo(...TRAIL.pts[i]);
        }
        ctx.lineTo(tp[0], tp[1]);
        ctx.strokeStyle = 'rgba(255,214,150,0.95)';
        ctx.lineWidth = 3.2 / s;
        ctx.shadowColor = 'rgba(255,190,110,1)';
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // ---- camps
      STAGES.forEach((st, i) => {
        const p = trailAt(st.at);
        const pop = F.smooth(F.prog(t, a.start + 0.7 + i * 0.55, a.start + 1.1 + i * 0.55));
        if (pop <= 0) return;
        const reached = f >= st.at - 0.002;
        const lit = reached ? 1 : 0.28;
        const arrive = reached ? F.pulse(t, cl[i].start + (i === 3 ? 1.6 : 1.3), 0.5) : 0;
        ctx.save();
        ctx.globalAlpha = pop;
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, p[0], p[1], (30 + 90 * arrive) , st.rgb, 0.35 * lit + 0.6 * arrive);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = pop;
        ctx.strokeStyle = F.rgba(st.rgb, 0.5 + 0.5 * lit);
        ctx.lineWidth = 2.5 / s;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] - 46); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p[0], p[1] - 46); ctx.lineTo(p[0] + 30, p[1] - 38); ctx.lineTo(p[0], p[1] - 30); ctx.closePath();
        ctx.fillStyle = F.rgba(st.rgb, 0.25 + 0.75 * lit);
        if (reached) { ctx.shadowColor = F.rgba(st.rgb, 1); ctx.shadowBlur = 16; }
        ctx.fill();
        ctx.restore();
        F.text(ctx, String(i + 1), p[0] - 14, p[1] - 30, { family: 'Cinzel', weight: 700, size: 22, color: F.rgba(st.rgb, 1), alpha: pop * (0.45 + 0.55 * lit), align: 'right' });
      });
      // ---- the traveller
      if (t > a.end - 0.6) {
        const ta = F.smooth(F.prog(t, a.end - 0.6, a.end + 0.2));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 1; k <= 10; k++) {
          const q = trailAt(Math.max(0, f - k * 0.004));
          F.glow(ctx, q[0], q[1], 14 - k, '255,200,130', ta * 0.25 * (1 - k / 11));
        }
        F.glow(ctx, tp[0], tp[1], 42, '255,200,130', 0.55 * ta);
        F.glow(ctx, tp[0], tp[1], 12, '255,250,235', ta);
        ctx.restore();
      }
      ctx.restore(); // world

      // ---- right-hand panel (screen space)
      const back = ctx.createLinearGradient(930, 0, 1180, 0);
      back.addColorStop(0, 'rgba(4,6,12,0)');
      back.addColorStop(1, 'rgba(4,6,12,0.72)');
      ctx.fillStyle = back;
      ctx.fillRect(930, F.TOP, W - 930, F.BOT - F.TOP);
      const X = 1100;
      // intro
      const iA = F.env(t, a.start - 0.1, a.start + 0.5, cl[0].start - 0.8, cl[0].start - 0.2);
      if (iA > 0.01) {
        F.text(ctx, 'How do you actually', X, 420, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 60, color: '#f3ead7', alpha: iA });
        F.text(ctx, 'get there?', X, 490, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 60, color: '#f3ead7', alpha: iA });
        const tb = F.phraseAt(a, 'Here is');
        F.text(ctx, 'A PATH IN FOUR STAGES', X + 4, 590, { family: 'Montserrat', weight: 600, size: 24, spacing: 12, color: '#ffd27a', alpha: iA * F.smooth(F.prog(t, tb - 0.1, tb + 0.5)) });
      }
      STAGES.forEach((st, i) => {
        const c = cl[i];
        const next = i < 3 ? cl[i + 1].start : Infinity;
        const pA = F.env(t, c.start - 0.25, c.start + 0.45, next - 0.9, next - 0.3) * (1 - zout);
        if (pA <= 0.01) return;
        F.text(ctx, st.num, X, 262, { family: 'Montserrat', weight: 600, size: 22, spacing: 12, color: F.rgba(st.rgb, 1), alpha: pA });
        F.chip(ctx, st.when, X + 200, 254, { rgb: st.rgb, alpha: pA, size: 17, spacing: 4, padX: 16, edge: 0.7, color: '#f4f7ff' });
        F.text(ctx, st.name, X - 4, 356, { family: 'Cinzel', weight: 600, size: 78, spacing: 8, color: '#f7f1e6', alpha: pA, glow: 20, glowColor: F.rgba(st.rgb, 0.45) });
        ctx.fillStyle = F.rgba(st.rgb, 0.75 * pA);
        ctx.fillRect(X, 392, 660 * F.easeOut(F.prog(t, c.start, c.start + 1.0)), 2);
        st.items.forEach(([ic, label, phrase], k) => {
          const tk = F.phraseAt(c, phrase, 0.2 + k * 0.2);
          const ka = pA * F.smooth(F.prog(t, tk - 0.15, tk + 0.45));
          if (ka <= 0.01) return;
          const y = 470 + k * 88;
          F.icon(ctx, ic, X + 22, y - 10, 36, st.rgb, ka, { glow: 10 });
          F.text(ctx, label, X + 66, y, { family: 'Montserrat', weight: 500, size: 28, color: '#eef1f8', alpha: ka });
        });
      });
      // progress strip
      const stripA = F.smooth(F.prog(t, a.start + 0.7, a.start + 1.6)) * (1 - 0.6 * zout);
      if (stripA > 0.01) {
        STAGES.forEach((st, i) => {
          const x = X + i * 180;
          const pop = F.smooth(F.prog(t, a.start + 0.7 + i * 0.55, a.start + 1.1 + i * 0.55));
          const done = f >= st.at - 0.002;
          const cur = done && (i === 3 || f < STAGES[i + 1].at - 0.002);
          const aa = stripA * pop * (cur ? 1 : done ? 0.75 : 0.4);
          ctx.fillStyle = F.rgba(st.rgb, aa * (done ? 1 : 0.5));
          ctx.fillRect(x, 842, 168, cur ? 5 : 3);
          F.text(ctx, st.short, x, 878, { family: 'Montserrat', weight: 600, size: 16, spacing: 3, color: cur ? '#ffffff' : '#c9cfdf', alpha: aa });
          F.text(ctx, st.span, x, 904, { family: 'Montserrat', weight: 500, size: 14, spacing: 3, color: F.rgba(st.rgb, 1), alpha: aa * 0.9 });
        });
      }
      // summit flare
      const sum = F.pulse(t, cl[3].start + 1.6, 0.9);
      if (sum > 0.01) {
        const p = trailAt(1);
        const sp = toScreen(p[0], p[1]);
        F.flare(ctx, sp[0], sp[1], 0.6 * sum, '255,200,140', 900);
      }
      F.partCard(ctx, t, { t0: -0.8, t1: 3.6, num: 'PART IV', title: 'THE PATH', sub: 'From aspiring to indispensable' });
      F.vignette(ctx, 0.45);
    },
    cues(S) {
      const a = S.c('a');
      const out = [{ t: 0.1, type: 'impact', size: 0.45 }, { t: a.start, type: 'wind', dur: S.dur - a.start - 1 }];
      STAGES.forEach((st, i) => {
        out.push({ t: a.start + 0.7 + i * 0.55, type: 'camp', idx: i, soft: true });
        const c = S.c(st.clip);
        out.push({ t: c.start - (i ? 0.8 : 0.6), type: 'whoosh', dur: 1.6, size: 0.35 });
        out.push({ t: c.start + (i === 3 ? 1.6 : 1.3), type: 'camp', idx: i });
        st.items.forEach(([, , phrase], k) => out.push({ t: F.phraseAt(c, phrase, 0.2 + k * 0.2), type: 'tick_soft' }));
      });
      out.push({ t: S.c('e').start + 1.4, type: 'shimmer', dur: 3.5 });
      return out;
    },
  });

  // ============================================================ HABITS
  const HABITS = [
    ['bolt', 'Use AI every day', 'FLUENCY'],
    ['chat', 'Talk to a customer every week', 'EMPATHY'],
    ['rocket', 'Ship something every month', 'MOMENTUM'],
    ['pen', 'Put your thinking in writing', 'CLARITY'],
    ['book', 'Study failures, including your own', 'WISDOM'],
    ['globe', 'Learn in public', 'REPUTATION'],
    ['moon', 'Protect time to think deeply', 'DEPTH'],
  ];
  const mix = (a, b, u) => a.split(',').map((v, i) => Math.round(F.lerp(+v, +b.split(',')[i], u))).join(',');

  F.scene('habits', {
    transIn: { type: 'fade', dur: 1.0 },
    draw(ctx, t, S) {
      const a = S.c('a'), h7 = S.c('h7');
      const cx = W / 2, cy = 548, R = 250;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1000);
      bg.addColorStop(0, '#15142a');
      bg.addColorStop(1, '#04040a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      F.motes(ctx, t, { n: 50, seed: 8, alpha: 0.18, size: 3, speed: 4 });
      const on = F.smooth(F.prog(t, a.start - 0.4, a.start + 1.2));
      const done = F.smooth(F.prog(t, h7.end - 0.2, h7.end + 0.8));
      // ring
      ctx.save();
      ctx.strokeStyle = `rgba(200,205,235,${0.16 * on})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, F.TAU); ctx.stroke();
      ctx.restore();
      // lit arc following the habits
      let lastLit = -1;
      HABITS.forEach((_, i) => { if (t >= S.c('h' + (i + 1)).start - 0.1) lastLit = i; });
      const ang = (i) => -Math.PI / 2 + (i / 7) * F.TAU;
      if (lastLit >= 0) {
        const hs = S.c('h' + (lastLit + 1));
        const grow = F.smooth(F.prog(t, hs.start - 0.1, hs.start + 0.5));
        const end = lastLit === 6 ? ang(6) + (F.TAU / 7) * done : ang(Math.max(0, lastLit - 1)) + (F.TAU / 7) * (lastLit ? grow : 0);
        ctx.save();
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,220,160,0.9)';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = 'rgba(255,225,170,0.85)';
        ctx.beginPath(); ctx.arc(cx, cy, R, ang(0), Math.max(ang(0) + 0.001, end)); ctx.stroke();
        ctx.restore();
      }
      // nodes and labels
      HABITS.forEach(([ic, label, tag], i) => {
        const clip = S.c('h' + (i + 1));
        const rgb = mix(F.AI, F.HUMAN, i / 6);
        const A = ang(i), x = cx + Math.cos(A) * R, y = cy + Math.sin(A) * R;
        const lit = F.smooth(F.prog(t, clip.start - 0.1, clip.start + 0.4));
        const hot = F.pulse(t, clip.start + 0.25, 0.5) + 0.6 * F.pulse(t, h7.end + 0.3 + i * 0.08, 0.35);
        ctx.save();
        ctx.globalAlpha = on;
        ctx.fillStyle = '#0c0d18';
        ctx.strokeStyle = F.rgba(rgb, 0.3 + 0.7 * lit);
        ctx.lineWidth = 2;
        if (lit > 0.05) { ctx.shadowColor = F.rgba(rgb, 0.9); ctx.shadowBlur = 20 * lit + 20 * hot; }
        ctx.beginPath(); ctx.arc(x, y, 44, 0, F.TAU); ctx.fill(); ctx.stroke();
        ctx.restore();
        F.icon(ctx, ic, x, y, 40, rgb, on * (0.3 + 0.7 * lit), { glow: 10 * lit });
        if (lit <= 0.01) return;
        const c = Math.cos(A);
        const align = c > 0.3 ? 'left' : c < -0.3 ? 'right' : 'center';
        const lx = align === 'left' ? x + 72 : align === 'right' ? x - 72 : x;
        const ly = align === 'center' ? y - 96 : y + 4;
        F.text(ctx, tag, lx, ly - 16, { family: 'Montserrat', weight: 600, size: 16, spacing: 6, color: F.rgba(rgb, 1), alpha: lit, align });
        F.text(ctx, label, lx, ly + 20, { family: 'Montserrat', weight: 500, size: 30, color: '#f2f4fa', alpha: lit, align });
      });
      // centre
      const cA = on * (1 - done);
      F.text(ctx, '7', cx, cy + 22, { family: 'Cinzel', weight: 700, size: 110, color: '#ffe2ae', alpha: cA, align: 'center', glow: 24, glowColor: 'rgba(255,190,90,0.6)' });
      F.text(ctx, 'HABITS', cx, cy + 66, { family: 'Montserrat', weight: 600, size: 18, spacing: 10, color: '#e9e2d2', alpha: cA, align: 'center' });
      if (done > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, cx, cy, 240, '255,210,150', 0.35 * done);
        ctx.restore();
        F.text(ctx, 'RESILIENT', cx, cy + 16, { family: 'Cinzel', weight: 700, size: 52, spacing: 8, color: '#ffe8bf', alpha: done, align: 'center', glow: 22, glowColor: 'rgba(255,190,90,0.7)' });
      }
      F.vignette(ctx, 0.45);
    },
    cues(S) {
      const out = [];
      HABITS.forEach((_, i) => out.push({ t: S.c('h' + (i + 1)).start, type: 'pop', idx: i % 4 }));
      out.push({ t: S.c('h7').end - 0.2, type: 'shimmer', dur: 2.2 });
      return out;
    },
  });

  // ============================================================ BREAKING IN
  const DOORS = [
    { clip: 'b1', icon: 'book', rgb: '150,200,255', title: 'APM PROGRAMS', sub: ['Associate product manager', 'rotations and training'] },
    { clip: 'b2', icon: 'users', rgb: '185,165,255', title: 'INTERNAL MOVE', sub: ['From engineering, design,', 'data, support or sales'] },
    { clip: 'b3', icon: 'bolt', rgb: '110,230,205', title: 'EARLY-STAGE STARTUP', sub: ['Wear every hat,', 'learn at speed'] },
    { clip: 'b4', icon: 'rocket', rgb: '255,205,130', title: 'BUILD IT YOURSELF', sub: ['A real product,', 'real results'] },
  ];
  const DX = [330, 750, 1170, 1590], DW = 190, DBOT = 740, DRECT = 270;

  function doorPath(ctx, x, grow = 0) {
    const w = DW + grow, r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x - r, DBOT);
    ctx.lineTo(x - r, DBOT - DRECT);
    ctx.arc(x, DBOT - DRECT, r, Math.PI, 0);
    ctx.lineTo(x + r, DBOT);
    ctx.closePath();
  }

  F.scene('breaking_in', {
    transIn: { type: 'fade', dur: 1.0 },
    draw(ctx, t, S) {
      const a = S.c('a'), b4 = S.c('b4');
      const g = ctx.createLinearGradient(0, F.TOP, 0, F.BOT);
      g.addColorStop(0, '#06070d');
      g.addColorStop(0.72, '#0d0f1a');
      g.addColorStop(1, '#07080e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // floor
      ctx.save();
      ctx.strokeStyle = 'rgba(160,170,210,0.08)';
      ctx.lineWidth = 1;
      for (let k = -8; k <= 8; k++) {
        ctx.beginPath(); ctx.moveTo(W / 2 + k * 60, DBOT); ctx.lineTo(W / 2 + k * 300, F.BOT); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(160,170,210,0.12)';
      ctx.fillRect(0, DBOT, W, 1.5);
      ctx.restore();
      const hA = F.env(t, a.start - 0.2, a.start + 0.6, b4.start + 0.2, b4.start + 1.0);
      F.text(ctx, 'MORE THAN ONE DOOR', W / 2, 232, { family: 'Montserrat', weight: 600, size: 26, spacing: 14, color: '#efe6d4', alpha: hA, align: 'center' });
      const best = F.smooth(F.prog(t, F.phraseAt(b4, 'the most convincing') - 0.2, F.phraseAt(b4, 'the most convincing') + 1.2));
      const flood = F.smooth(F.prog(t, F.phraseAt(b4, 'let the results') - 0.3, S.dur - 0.2));
      DOORS.forEach((d, i) => {
        const x = DX[i];
        const clip = S.c(d.clip);
        const appear = F.smooth(F.prog(t, a.start + 0.3 + i * 0.35, a.start + 0.9 + i * 0.35));
        const open = F.easeInOut(F.prog(t, clip.start - 0.1, clip.start + 1.1));
        const dim = i < 3 ? 1 - 0.55 * best : 1;
        const inten = open * dim * (i === 3 ? 1 + 0.6 * best : 1);
        if (appear <= 0.01) return;
        // light spilling onto the floor
        if (inten > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const spread = 1 + (i === 3 ? 1.2 * flood : 0);
          const fl = ctx.createLinearGradient(0, DBOT, 0, F.BOT);
          fl.addColorStop(0, F.rgba(d.rgb, 0.3 * inten));
          fl.addColorStop(1, F.rgba(d.rgb, 0));
          ctx.fillStyle = fl;
          ctx.beginPath();
          ctx.moveTo(x - DW / 2 * open, DBOT);
          ctx.lineTo(x + DW / 2 * open, DBOT);
          ctx.lineTo(x + (DW / 2 + 150 * spread) * open, F.BOT);
          ctx.lineTo(x - (DW / 2 + 150 * spread) * open, F.BOT);
          ctx.closePath();
          ctx.fill();
          F.glow(ctx, x, DBOT - 180, 330 * (1 + 0.5 * best * (i === 3)), d.rgb, 0.3 * inten);
          ctx.restore();
          // bright doorway
          ctx.save();
          doorPath(ctx, x);
          ctx.clip();
          const lg = ctx.createRadialGradient(x, DBOT - 150, 10, x, DBOT - 150, 300);
          lg.addColorStop(0, `rgba(255,252,240,${inten})`);
          lg.addColorStop(0.5, F.rgba(d.rgb, 0.85 * inten));
          lg.addColorStop(1, F.rgba(d.rgb, 0.25 * inten));
          ctx.fillStyle = lg;
          ctx.fillRect(x - DW, DBOT - 500, DW * 2, 520);
          ctx.restore();
          // silhouette icon in the light
          F.icon(ctx, d.icon, x, DBOT - 190, 70, '24,18,10', F.clamp(inten * 1.2), { lw: 2.6 });
        }
        // the door leaf, swinging inward (hinged on the left)
        if (open < 0.999) {
          const w = DW * (1 - 0.88 * open);
          ctx.save();
          doorPath(ctx, x);
          ctx.clip();
          ctx.fillStyle = '#0b0c14';
          ctx.fillRect(x - DW / 2, DBOT - 500, w, 520);
          ctx.strokeStyle = 'rgba(140,150,190,0.2)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x - DW / 2 + w * 0.15, DBOT - 330, w * 0.7, 150);
          ctx.strokeRect(x - DW / 2 + w * 0.15, DBOT - 160, w * 0.7, 130);
          ctx.fillStyle = `rgba(255,210,150,${0.6 * appear})`;
          ctx.beginPath(); ctx.arc(x - DW / 2 + w * 0.85, DBOT - 190, 4, 0, F.TAU); ctx.fill();
          ctx.restore();
        }
        // frame
        ctx.save();
        doorPath(ctx, x, 16);
        ctx.strokeStyle = F.rgba(d.rgb, (0.3 + 0.6 * open) * appear * dim);
        ctx.lineWidth = 3;
        ctx.shadowColor = F.rgba(d.rgb, 0.9);
        ctx.shadowBlur = 8 + 22 * inten;
        ctx.stroke();
        ctx.restore();
        // labels
        const la = open * appear * (i < 3 ? 1 - 0.4 * best : 1);
        F.text(ctx, String(i + 1).padStart(2, '0'), x, DBOT + 52, { family: 'Cinzel', weight: 600, size: 22, color: F.rgba(d.rgb, 1), alpha: la, align: 'center' });
        F.text(ctx, d.title, x, DBOT + 92, { family: 'Montserrat', weight: 600, size: 22, spacing: 4, color: '#f6f1e6', alpha: la, align: 'center' });
        d.sub.forEach((l, k) => F.text(ctx, l, x, DBOT + 130 + k * 32, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 28, color: '#cfd3e2', alpha: la * 0.95, align: 'center' }));
      });
      if (best > 0.01) {
        F.chip(ctx, 'THE MOST CONVINCING PATH', DX[3], DBOT - DRECT - DW / 2 - 50, { align: 'center', rgb: DOORS[3].rgb, color: '#ffe2ae', alpha: best * (1 - flood), size: 18, spacing: 6, edge: 0.9, glow: 0.6 });
      }
      if (flood > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, DX[3], DBOT - 180, 500 + 1500 * flood, '255,220,170', 0.55 * flood);
        ctx.restore();
        const tl = F.phraseAt(b4, 'let the results');
        F.text(ctx, 'Let the results speak.', W / 2, 250, { family: 'Cormorant Garamond', style: 'italic', weight: 600, size: 64, color: '#fff4dc', alpha: F.smooth(F.prog(t, tl, tl + 0.8)) * (1 - F.smooth(F.prog(t, S.dur - 1.0, S.dur))), align: 'center', glow: 22, glowColor: 'rgba(255,190,90,0.6)' });
      }
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      const out = [];
      DOORS.forEach((d, i) => out.push({ t: S.c(d.clip).start - 0.1, type: 'door', idx: i }));
      const b4 = S.c('b4');
      out.push({ t: F.phraseAt(b4, 'the most convincing') - 0.2, type: 'shimmer', dur: 2.0 });
      out.push({ t: F.phraseAt(b4, 'let the results') - 0.4, type: 'swell', dur: 2.2 });
      return out;
    },
  });
})();

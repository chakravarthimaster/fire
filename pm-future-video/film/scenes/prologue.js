/* Prologue (AI doing the PM's work, the question, the title), epilogue, finale. */
(function () {
  'use strict';
  const { W, H } = F;
  const TITLE = "WHAT'S WORTH BUILDING";
  const SUB = 'THE FUTURE OF PRODUCT MANAGEMENT IN THE AGE OF AI';
  const QUESTION = 'So what is left for the product manager?';

  // ------------------------------------------------------ shared: compass
  /** A navigator's compass. `needle` in radians (0 = north), `draw` 0..1 reveal. */
  F.drawCompass = (ctx, cx, cy, R, needle, alpha = 1, draw = 1, rgb = F.HUMAN, needleAlpha = 1) => {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    // rings, drawn on
    ctx.strokeStyle = F.rgba(rgb, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + F.TAU * draw); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = F.rgba(rgb, 0.4);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.9, Math.PI / 2, Math.PI / 2 + F.TAU * draw); ctx.stroke();
    // ticks
    const nt = Math.floor(72 * draw);
    for (let k = 0; k < nt; k++) {
      const a = (k / 72) * F.TAU - Math.PI / 2;
      const major = k % 18 === 0, mid = k % 9 === 0;
      const r0 = R * (major ? 0.8 : mid ? 0.84 : 0.87), r1 = R * 0.9;
      ctx.strokeStyle = F.rgba(rgb, major ? 0.9 : 0.45);
      ctx.lineWidth = major ? 2.2 : 1;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
    }
    if (draw > 0.95) {
      const la = F.smooth((draw - 0.95) / 0.05) * needleAlpha;
      ['N', 'E', 'S', 'W'].forEach((l, i) => {
        const a = i * Math.PI / 2 - Math.PI / 2;
        F.text(ctx, l, Math.cos(a) * R * 0.7, Math.sin(a) * R * 0.7 + R * 0.035, { family: 'Cinzel', weight: 600, size: R * 0.09, color: F.rgba(rgb, 0.9), alpha: la, align: 'center' });
      });
      // needle
      ctx.rotate(needle);
      const L = R * 0.6, w = R * 0.07;
      ctx.shadowColor = F.rgba(rgb, 0.9);
      ctx.shadowBlur = 18;
      ctx.fillStyle = F.rgba('255,226,170', la);
      ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(w, 0); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = F.rgba('70,86,120', la);
      ctx.beginPath(); ctx.moveTo(0, L * 0.8); ctx.lineTo(w, 0); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = F.rgba(rgb, la);
      ctx.beginPath(); ctx.arc(0, 0, w * 0.55, 0, F.TAU); ctx.fill();
    }
    ctx.restore();
  };

  let titleSize = 88;
  F.drawTitle2 = (ctx, t, alpha, y = 560, sweep = -1) => {
    if (alpha <= 0.003) return;
    const o = { family: 'Cinzel', weight: 600, size: titleSize, spacing: 12 };
    const w = F.measure(ctx, TITLE, o);
    ctx.save();
    const grd = ctx.createLinearGradient(0, y - titleSize, 0, y + 10);
    grd.addColorStop(0, '#fffaf0');
    grd.addColorStop(0.6, '#f3d9a4');
    grd.addColorStop(1, '#b08850');
    F.text(ctx, TITLE, W / 2, y, { ...o, color: grd, alpha, align: 'center', glow: 34, glowColor: 'rgba(255,190,110,0.55)' });
    if (sweep >= 0 && sweep <= 1) {
      const fx = F.lerp(W / 2 - w / 2 - 80, W / 2 + w / 2 + 80, F.easeInOut(sweep));
      F.flare(ctx, fx, y - titleSize * 0.36, Math.sin(Math.PI * sweep) * 0.85 * alpha, '140,190,255', 1300);
    }
    ctx.restore();
  };

  // ---------------------------------------------------------- COLD OPEN
  let quotes, specLines;
  F.scene('cold_open', {
    transIn: { type: 'cut', dur: 0 },
    init(S) {
      const c = F.canvas(10, 10).getContext('2d');
      const o = { family: 'Cinzel', weight: 600, size: 88, spacing: 12 };
      titleSize = 88 * Math.min(1, 1480 / F.measure(c, TITLE, o));
      const r = F.rng(77);
      quotes = Array.from({ length: 900 }, () => ({ x: r() * W, y: F.TOP + 20 + r() * (F.BOT - F.TOP - 40), k: Math.floor(r() * 3), d: r(), w: 10 + r() * 16 }));
      specLines = [];
      const sections = ['1. Problem', '2. Users & jobs', '3. Goals & metrics', '4. Requirements', '5. Risks & open questions'];
      let y = 330;
      sections.forEach((s, i) => {
        specLines.push({ kind: 'h', text: s, y });
        y += 36;
        const n = i === 3 ? 4 : 2;
        for (let k = 0; k < n; k++) { specLines.push({ kind: 'l', w: 380 + r() * 300, y }); y += 24; }
        y += 14;
      });
      const b = S.c('b');
      this.tInsight = b.start;
      this.tCode = F.phraseAt(b, 'write the code');
      this.tDash = F.phraseAt(b, 'and build the dashboard');
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c');
      ctx.fillStyle = '#04060c';
      ctx.fillRect(0, 0, W, H);
      const machine = F.env(t, 0.2, 1.4, 12.3, 13.0);
      // cyan dot grid
      if (machine > 0.01) {
        ctx.fillStyle = F.rgba(F.AI, 0.07 * machine);
        for (let y = F.TOP + 16; y < F.BOT; y += 36) for (let x = 16; x < W; x += 36) ctx.fillRect(x, y, 2, 2);
      }
      const spin = F.easeIn(F.prog(t, 11.9, 13.1));
      const vanish = 1 - spin; // everything the machine made spirals away
      ctx.save();
      if (spin > 0) {
        ctx.translate(W / 2, H / 2);
        ctx.rotate(spin * 0.9);
        ctx.scale(1 + spin * 1.8, 1 + spin * 1.8);
        ctx.translate(-W / 2, -H / 2);
      }
      // ---- A: a spec written in seconds
      const specA = F.env(t, a.start - 0.6, a.start, this.tInsight - 0.2, this.tInsight + 0.6) * vanish;
      if (specA > 0.01) {
        const slide = F.easeInOut(F.prog(t, this.tInsight - 0.3, this.tInsight + 0.6));
        const px = F.lerp(560, 120, slide), pw = 800, sc = F.lerp(1, 0.62, slide);
        ctx.save();
        ctx.translate(px, 200);
        ctx.scale(sc, sc);
        ctx.globalAlpha *= specA;
        F.panel(ctx, 0, 0, pw, 700, { rgb: F.AI, edge: 0.55, glow: 0.8 });
        F.text(ctx, 'PRODUCT SPEC', 40, 58, { family: 'Montserrat', weight: 600, size: 20, spacing: 8, color: '#8fdcff' });
        F.text(ctx, 'Smart onboarding for new teams', 40, 104, { family: 'Cormorant Garamond', weight: 600, size: 40, color: '#f2f6ff' });
        const prog = F.clamp((t - a.start) / (a.dur * 0.95));
        const shown = Math.floor(prog * specLines.length);
        specLines.forEach((l, i) => {
          if (i > shown) return;
          const k = i === shown ? (prog * specLines.length) % 1 : 1;
          if (l.kind === 'h') F.text(ctx, l.text, 40, l.y - 200 + 40, { family: 'Montserrat', weight: 600, size: 20, color: '#dce8ff', alpha: k });
          else { ctx.fillStyle = 'rgba(170,190,220,0.35)'; ctx.fillRect(40, l.y - 200 + 30, l.w * k, 10); }
        });
        const secs = Math.min(a.dur, Math.max(0, t - a.start));
        F.text(ctx, `${secs.toFixed(1)} s`, pw - 40, 58, { family: 'IBM Plex Mono', weight: 500, size: 26, color: '#5fd4ff', align: 'right' });
        if (prog < 1 && t > a.start) {
          const cur = specLines[Math.min(shown, specLines.length - 1)];
          ctx.fillStyle = '#5fd4ff';
          ctx.fillRect(40 + (cur.kind === 'l' ? cur.w * ((prog * specLines.length) % 1) : 220), cur.y - 200 + 20, 12, 26);
        }
        ctx.restore();
      }
      // ---- B1: a thousand interviews -> three insights
      const b1 = F.env(t, this.tInsight - 0.2, this.tInsight + 0.4) * vanish;
      if (b1 > 0.01) {
        const conv = F.easeInOut(F.prog(t, this.tInsight + 0.6, this.tCode - 0.1));
        const targets = [[700, 330], [700, 540], [700, 750]];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const q of quotes) {
          const [tx, ty] = targets[q.k];
          const x = F.lerp(q.x, tx + (q.d - 0.5) * 60, conv), y = F.lerp(q.y, ty + (q.d - 0.5) * 30, conv);
          ctx.globalAlpha = b1 * (1 - 0.8 * conv) * 0.6;
          ctx.fillStyle = F.rgba(F.AI, 0.8);
          ctx.fillRect(x, y, q.w * (1 - 0.7 * conv), 3);
        }
        ctx.restore();
        F.text(ctx, '1,000 INTERVIEWS', 700, 220, { family: 'Montserrat', weight: 600, size: 22, spacing: 8, color: '#8fdcff', alpha: b1 * (1 - conv) , align: 'center' });
        const insights = ['Onboarding feels confusing', 'Pricing is unclear', 'Teams want integrations'];
        insights.forEach((s, i) => {
          const ia = b1 * F.smooth(F.prog(conv, 0.7 + i * 0.08, 0.95 + i * 0.02));
          if (ia <= 0.01) return;
          const [x, y] = targets[i];
          F.panel(ctx, x - 230, y - 42, 460, 84, { rgb: F.AI, edge: 0.7, alpha: ia, glow: 0.6 });
          F.icon(ctx, 'bulb', x - 190, y, 34, F.AI, ia);
          F.text(ctx, s, x - 160, y + 10, { family: 'Montserrat', weight: 500, size: 26, color: '#eef6ff', alpha: ia });
        });
        F.text(ctx, '3 INSIGHTS · OVERNIGHT', 700, 870, { family: 'Montserrat', weight: 600, size: 20, spacing: 8, color: '#8fdcff', alpha: b1 * F.smooth(F.prog(conv, 0.9, 1)), align: 'center' });
      }
      // ---- B2: code
      const b2 = F.env(t, this.tCode - 0.15, this.tCode + 0.3) * vanish;
      if (b2 > 0.01) {
        const x0 = 1010, y0 = 200;
        F.panel(ctx, x0, y0, 400, 330, { rgb: F.AI, edge: 0.55, alpha: b2 });
        const scroll = (t - this.tCode) * 22;
        ctx.save();
        ctx.beginPath(); ctx.rect(x0 + 10, y0 + 10, 380, 310); ctx.clip();
        const cols = ['#ff9ac1', '#8fdcff', '#c3f58f', '#ffd27a', '#b9b4ff'];
        for (let i = 0; i < 40; i++) {
          const y = y0 + 30 + i * 22 - (scroll % 22) - Math.floor(scroll / 22) * 0;
          const li = i + Math.floor(scroll / 22);
          const indent = (F.hash(li, 3) * 4 | 0) * 18;
          let x = x0 + 24 + indent;
          for (let k = 0; k < 3; k++) {
            const w = 30 + F.hash(li * 7 + k, 5) * 90;
            ctx.globalAlpha = b2 * 0.8;
            ctx.fillStyle = cols[(li + k) % cols.length];
            ctx.fillRect(x, y, w, 8);
            x += w + 10;
          }
        }
        ctx.restore();
        F.text(ctx, 'CODE', x0 + 20, y0 - 14, { family: 'Montserrat', weight: 600, size: 18, spacing: 8, color: '#8fdcff', alpha: b2 });
      }
      // ---- B3: dashboard
      const b3 = F.env(t, this.tDash - 0.15, this.tDash + 0.3) * vanish;
      if (b3 > 0.01) {
        const x0 = 1010, y0 = 580;
        F.panel(ctx, x0, y0, 780, 320, { rgb: F.AI, edge: 0.55, alpha: b3 });
        const k = F.easeOut(F.prog(t, this.tDash, this.tDash + 1.2));
        const kpis = [['Activation', '64%'], ['Retention', '41%'], ['NPS', '52']];
        kpis.forEach(([l, v], i) => {
          F.text(ctx, l.toUpperCase(), x0 + 30 + i * 150, y0 + 44, { family: 'Montserrat', weight: 600, size: 14, spacing: 3, color: '#8fdcff', alpha: b3 });
          F.text(ctx, v, x0 + 30 + i * 150, y0 + 88, { family: 'IBM Plex Mono', weight: 500, size: 34, color: '#ffffff', alpha: b3 * k });
        });
        for (let i = 0; i < 9; i++) {
          const h = (40 + F.hash(i, 9) * 120) * k;
          ctx.globalAlpha = b3;
          ctx.fillStyle = F.rgba(F.AI, 0.8);
          ctx.fillRect(x0 + 30 + i * 44, y0 + 290 - h, 28, h);
        }
        ctx.strokeStyle = F.rgba(F.HUMAN, 0.9 * b3);
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i <= 20 * k; i++) {
          const x = x0 + 480 + i * 13.5, y = y0 + 270 - Math.pow(i / 20, 1.3) * 150 - Math.sin(i * 0.9) * 10;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        F.text(ctx, 'DASHBOARD', x0 + 20, y0 - 14, { family: 'Montserrat', weight: 600, size: 18, spacing: 8, color: '#8fdcff', alpha: b3 });
      }
      ctx.restore();

      // ---- the question, in warm human light
      const qa = F.env(t, c.start - 0.5, c.start + 0.2, 16.4, 17.2);
      if (qa > 0.01) {
        const spot = ctx.createRadialGradient(W / 2, 900, 20, W / 2, 900, 700);
        spot.addColorStop(0, `rgba(255,180,90,${0.3 * qa})`);
        spot.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, W, H);
        F.human(ctx, W / 2, 930, 1.6, F.HUMAN, qa);
        const words = QUESTION.split(' ');
        const o = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 64 };
        const total = F.measure(ctx, QUESTION, o);
        let x = W / 2 - total / 2;
        words.forEach((w, i) => {
          const wt = c.start + (i / words.length) * c.dur * 0.9;
          const wa = qa * F.smooth(F.prog(t, wt - 0.05, wt + 0.35));
          F.text(ctx, w, x, 470, { ...o, color: '#f6ead2', alpha: wa, glow: 16, glowColor: 'rgba(255,190,110,0.35)' });
          x += F.measure(ctx, w + ' ', o);
        });
      }
      // ---- the title: a compass finds north
      const tc = 17.0, tSettle = 20.4;
      const compA = F.env(t, tc, tc + 0.8);
      if (compA > 0.01) {
        const draw = F.easeInOut(F.prog(t, tc, tc + 1.6));
        const tau = Math.max(0, t - (tc + 1.2));
        const needle = t < tc + 1.2 ? 0 : 2.6 * Math.PI * Math.exp(-1.35 * tau) * Math.cos(5.2 * tau);
        const R = 330 + 12 * F.smooth(F.prog(t, tc, S.dur));
        const settle = F.smooth(F.prog(t, tSettle - 0.3, tSettle + 0.8));
        F.drawCompass(ctx, W / 2, 530, R, needle, compA * (1 - 0.7 * settle), draw, F.HUMAN, 1 - 0.85 * settle);
        const ta = F.smooth(F.prog(t, tSettle - 0.25, tSettle + 0.35));
        const sw = F.prog(t, tSettle - 0.1, tSettle + 2.4);
        F.drawTitle2(ctx, t, ta, 568, sw > 0 && sw < 1 ? sw : -1);
        F.text(ctx, SUB, W / 2, 646, { family: 'Montserrat', weight: 400, size: 22, spacing: 10, color: '#cdbb8e', alpha: F.smooth(F.prog(t, tSettle + 0.9, tSettle + 2.2)), align: 'center' });
        const flash = F.pulse(t, tSettle, 0.2);
        if (flash > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          F.glow(ctx, W / 2, 540, 900, '255,210,150', 0.3 * flash, 0.3);
          ctx.restore();
        }
      }
      F.vignette(ctx, 0.55);
    },
    cues(S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c');
      const out = [
        { t: 0.3, type: 'hum', dur: 12.8 },
        { t: a.start, type: 'datastream', dur: a.dur },
        { t: this.tInsight, type: 'whoosh', dur: 0.8 },
        { t: this.tInsight + 0.6, type: 'swarm', dur: this.tCode - this.tInsight - 0.6 },
        { t: this.tCode - 0.1, type: 'whoosh', dur: 0.6 },
        { t: this.tCode, type: 'datastream', dur: this.tDash - this.tCode },
        { t: this.tDash - 0.1, type: 'whoosh', dur: 0.6 },
        { t: 11.9, type: 'riser', dur: 1.2 },
        { t: 13.1, type: 'cutoff' },
        { t: 17.0, type: 'compass', dur: 3.4 },
        { t: 20.4 - 1.6, type: 'riser', dur: 1.55 },
        { t: 20.4, type: 'impact', size: 1.0 },
      ];
      return out;
    },
  });

  // ----------------------------------------------------------- EPILOGUE
  F.scene('epilogue', {
    transIn: { type: 'fade', dur: 1.6 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c');
      ctx.fillStyle = '#04060c';
      ctx.fillRect(0, 0, W, H);
      F.stars(ctx, t, 0.5 * F.env(t, 0, 2));
      const tTitle = F.phraseAt(c, "what's worth building") + 0.1;
      const comp = F.env(t, 0.2, 2.0);
      const tl = F.smooth(F.prog(t, tTitle - 0.5, tTitle + 0.5));
      const la = F.env(t, a.start - 0.2, a.start + 0.5, c.start - 0.4, c.start + 0.3);
      const lb = F.env(t, b.start - 0.2, b.start + 0.5, c.start - 0.4, c.start + 0.3);
      const lc = F.env(t, c.start - 0.2, c.start + 0.6, tTitle - 0.6, tTitle);
      // keep the needle from striking through the words while they are on screen
      const words = Math.max(la, lb, lc);
      F.drawCompass(ctx, W / 2, 530, 360, 0.04 * Math.sin(t * 0.8), comp * (0.55 - 0.25 * tl) * (1 - 0.3 * words), 1, F.HUMAN, (1 - 0.8 * tl) * (1 - 0.8 * words));
      F.text(ctx, 'The tools will keep getting smarter.', W / 2, 470, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 58, color: '#cfefff', alpha: la, align: 'center', glow: 14, glowColor: 'rgba(95,212,255,0.45)' });
      F.text(ctx, 'Your job is to keep getting wiser.', W / 2, 560, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 58, color: '#ffe2ae', alpha: lb, align: 'center', glow: 16, glowColor: 'rgba(255,196,107,0.5)' });
      const lines = ['Because when machines can build almost anything,', 'the most valuable person in the room', 'is the one who knows…'];
      lines.forEach((l, i) => F.text(ctx, l, W / 2, 440 + i * 66, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 50, color: '#f3ead7', alpha: lc * F.smooth(F.prog(t, c.start + i * 1.6, c.start + i * 1.6 + 0.6)), align: 'center' }));
      const ta = F.smooth(F.prog(t, tTitle - 0.2, tTitle + 0.4));
      const sw = F.prog(t, tTitle, tTitle + 2.4);
      F.drawTitle2(ctx, t, ta, 568, sw > 0 && sw < 1 ? sw : -1);
      if (ta > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, W / 2, 540, 800, '255,200,130', 0.18 * ta, 0.3);
        ctx.restore();
      }
      F.motes(ctx, t, { n: 60, seed: 19, alpha: 0.35 * ta, size: 4, speed: 8, rgb: '255,220,160' });
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      const c = S.c('c');
      const tTitle = F.phraseAt(c, "what's worth building") + 0.1;
      return [
        { t: c.end + 0.45, type: 'motif', variant: 'answer', gain: 0.8 },
        { t: tTitle - 0.3, type: 'swell', dur: 1.2 },
        { t: c.end + 0.15, type: 'impact', size: 0.8, major: 1 },
      ];
    },
  });

  // ------------------------------------------------------------- FINALE
  F.scene('finale', {
    transIn: { type: 'fade', dur: 1.4 },
    draw(ctx, t, S) {
      ctx.fillStyle = '#04060c';
      ctx.fillRect(0, 0, W, H);
      F.motes(ctx, t + 30, { n: 70, seed: 8, alpha: 0.3, size: 3.5, speed: 7, rgb: '255,222,170' });
      const a1 = F.env(t, 0.3, 1.2, 5.6, 6.4);
      F.text(ctx, 'START TODAY', W / 2, 420, { family: 'Cinzel', weight: 600, size: 72, spacing: 16, color: '#ffe2ae', alpha: a1, align: 'center', glow: 22, glowColor: 'rgba(255,190,110,0.6)' });
      const acts = [['users', 'Talk to one user'], ['code', 'Build one prototype'], ['spark', 'Learn one AI concept']];
      acts.forEach(([ic, s], i) => {
        const x = W / 2 + (i - 1) * 470;
        const aa = a1 * F.smooth(F.prog(t, 1.0 + i * 0.5, 1.6 + i * 0.5));
        F.icon(ctx, ic, x, 540, 56, F.HUMAN, aa, { glow: 12 });
        F.text(ctx, s, x, 620, { family: 'Montserrat', weight: 500, size: 30, color: '#f3ead7', alpha: aa, align: 'center' });
      });
      const aC = F.env(t, 6.8, 7.8, S.dur - 1.4, S.dur - 0.2);
      const cy = 430;
      F.text(ctx, 'A FILM MADE ENTIRELY FROM CODE', W / 2, cy, { family: 'Montserrat', weight: 500, size: 22, spacing: 10, color: '#d8b36a', alpha: aC, align: 'center' });
      ['Pictures drawn frame by frame on an HTML5 canvas', 'Music and sound synthesized from raw waveforms in Python', 'Narration performed by a synthetic voice (Kokoro TTS)', 'The full written roadmap is in GUIDE.md'].forEach((l, i) =>
        F.text(ctx, l, W / 2, cy + 64 + i * 46, { family: 'Cormorant Garamond', weight: 400, size: 32, color: '#efe7d6', alpha: aC * 0.9, align: 'center' }));
      F.text(ctx, 'Made with Claude Code', W / 2, cy + 64 + 4 * 46 + 34, { family: 'Montserrat', weight: 400, size: 20, spacing: 6, color: '#a99f8c', alpha: aC * 0.9, align: 'center' });
      F.vignette(ctx, 0.5);
    },
    cues() {
      return [{ t: 1.0, type: 'pop', idx: 0 }, { t: 1.5, type: 'pop', idx: 1 }, { t: 2.0, type: 'pop', idx: 2 }];
    },
  });
})();

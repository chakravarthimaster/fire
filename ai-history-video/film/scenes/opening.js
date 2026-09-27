/* Opening: Turing's question is typed, dissolves into dust, and the dust
 * becomes the title. The finale reuses the title. */
(function () {
  'use strict';
  const { W, H } = F;

  const L1 = 'I propose to consider the question,';
  const L2 = '“Can machines think?”';
  const ATTR = '— A. M. Turing, 1950';
  const F1 = { family: 'Courier Prime', size: 38, weight: 400 };
  const F2 = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 116 };
  const F3 = { family: 'Montserrat', weight: 300, size: 26, spacing: 8 };
  const Y1 = 452, Y2 = 590, Y3 = 668;

  // Title typography (shared with the finale).
  const T_THE = { family: 'Cinzel', weight: 600, size: 46, spacing: 30 };
  const T_MAIN = { family: 'Cinzel', weight: 600, size: 120, spacing: 16 };
  const T_SUB = { family: 'Montserrat', weight: 300, size: 24, spacing: 16 };
  const TY_THE = 452, TY_MAIN = 588, TY_SUB = 668;

  const N = 3400;
  const tA0 = 12.8; // dissolve begins
  const tB0 = 15.3; // convergence begins
  const tLock = 18.3; // title locks in

  let ty1, ty2, x1, x2, parts, titleCanvas, titleWhite, titleW;

  function makeTitle() {
    const c = F.canvas(W, H);
    const g = c.getContext('2d');
    const white = F.canvas(W, H);
    const gw = white.getContext('2d');
    const grd = g.createLinearGradient(0, TY_MAIN - 110, 0, TY_MAIN + 20);
    grd.addColorStop(0, '#fffaf0');
    grd.addColorStop(0.55, '#f0d9a8');
    grd.addColorStop(1, '#a8834f');
    for (const [ctx, fill] of [[g, grd], [gw, '#fff']]) {
      ctx.save();
      F.setFont(ctx, T_THE);
      ctx.fillStyle = fill;
      const w1 = ctx.measureText('THE').width - T_THE.spacing;
      ctx.fillText('THE', W / 2 - w1 / 2, TY_THE);
      F.setFont(ctx, T_MAIN);
      const w2 = ctx.measureText('THINKING MACHINE').width - T_MAIN.spacing;
      ctx.fillText('THINKING MACHINE', W / 2 - w2 / 2, TY_MAIN);
      titleW = w2;
      ctx.restore();
    }
    return [c, white];
  }

  /** Crisp title with glow and an optional travelling light sweep. */
  F.drawTitle = (ctx, t, alpha, sweep = -1, zoom = 1) => {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.translate(W / 2, H / 2 - 20);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2 + 20);
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(255,190,110,0.55)';
    ctx.shadowBlur = 38;
    ctx.drawImage(titleCanvas, 0, 0);
    ctx.shadowBlur = 0;
    ctx.drawImage(titleCanvas, 0, 0);
    if (sweep >= 0 && sweep <= 1) {
      // specular band sliding across the letters
      const tmp = F.sweepBuf || (F.sweepBuf = F.canvas(W, H));
      const g = tmp.getContext('2d');
      g.clearRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      g.drawImage(titleWhite, 0, 0);
      g.globalCompositeOperation = 'source-in';
      const cx = F.lerp(W / 2 - titleW / 2 - 200, W / 2 + titleW / 2 + 200, sweep);
      const band = g.createLinearGradient(cx - 140, 0, cx + 140, 0);
      band.addColorStop(0, 'rgba(255,255,255,0)');
      band.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      band.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = band;
      g.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.8;
      ctx.drawImage(tmp, 0, 0);
    }
    ctx.restore();
  };

  F.scene('opening', {
    transIn: { type: 'cut', dur: 0 },
    init() {
      const c = F.canvas(10, 10).getContext('2d');
      x1 = W / 2 - F.measure(c, L1, F1) / 2;
      x2 = W / 2 - F.measure(c, L2, F2) / 2;
      ty1 = F.typer(L1, 1.6, 15, 11);
      ty2 = F.typer(L2, ty1.end + 1.0, 7.2, 12, { pause: 0.6 });
      [titleCanvas, titleWhite] = makeTitle();

      const src = F.sampleText([
        { str: L1, x: W / 2, y: Y1, align: 'center', ...F1 },
        { str: L2, x: W / 2, y: Y2, align: 'center', ...F2 },
        { str: ATTR, x: W / 2, y: Y3, align: 'center', ...F3 },
      ], 2);
      const dst = F.sampleText([
        { str: 'THE', x: W / 2, y: TY_THE, align: 'center', ...T_THE },
        { str: 'THINKING MACHINE', x: W / 2, y: TY_MAIN, align: 'center', ...T_MAIN },
      ], 2);
      const s = F.pickN(src, N, 21), d = F.pickN(dst, N, 22);
      let xmin = Infinity, xmax = -Infinity;
      for (const p of s) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); }
      const r = F.rng(33);
      parts = s.map((p, i) => ({
        x0: p.x, y0: p.y, tx: d[i].x, ty: d[i].y,
        d: 1.5 * (p.x - xmin) / (xmax - xmin) + 0.18 * r(),
        e: 0.9 * r() + 0.35 * (1 - Math.abs(d[i].x - W / 2) / 800),
        r1: r(), r2: r(), r3: r(), ph: r() * F.TAU,
        spin: (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7),
        size: 1.6 + r() * 2.4,
      }));
      this.sweepX = (t) => xmin + (xmax - xmin) * F.clamp((t - tA0) / 1.5);
    },

    draw(ctx, t) {
      // warm lamp glow behind the words
      const lamp = F.env(t, 0.5, 4, 22, 25);
      const grd = ctx.createRadialGradient(W / 2, 560, 0, W / 2, 560, 820);
      grd.addColorStop(0, `rgba(70,52,34,${0.32 * lamp})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      F.motes(ctx, t, { n: 60, seed: 4, alpha: 0.28, size: 3.5, speed: 8, rgb: '255,226,180' });

      // ---- typed quote (crisp until it dissolves)
      if (t < tA0 + 2) {
        ctx.save();
        if (t > tA0) {
          ctx.beginPath();
          ctx.rect(this.sweepX(t), 0, W, H);
          ctx.clip();
        }
        const s1 = ty1.at(t), s2 = ty2.at(t);
        F.text(ctx, s1, x1, Y1, { ...F1, color: '#c9bfa9' });
        F.text(ctx, s2, x2, Y2, { ...F2, color: '#f7efdd', glow: 18, glowColor: 'rgba(255,220,170,0.35)' });
        const aAttr = F.env(t, ty2.end + 1.0, ty2.end + 2.2);
        F.text(ctx, ATTR, W / 2, Y3, { ...F3, color: '#a99f8c', alpha: aAttr, align: 'center' });
        // cursor
        const onL2 = t >= ty1.end + 0.5;
        const cx = onL2 ? x2 + F.measure(ctx, s2, F2) + 10 : x1 + F.measure(ctx, s1, F1) + 4;
        const blink = (t > (onL2 ? ty2.t0 : ty1.t0) - 0.05 && t < (onL2 ? ty2.end : ty1.end) + 0.1) ? 1 : (Math.floor(t * 1.9) % 2 === 0 ? 1 : 0);
        const cursorA = F.env(t, 0.8, 0.9, 11.4, 11.8) * blink;
        if (cursorA > 0) {
          ctx.globalAlpha = cursorA;
          ctx.fillStyle = '#efe6d2';
          if (onL2) ctx.fillRect(cx, Y2 - 88, 6, 104);
          else ctx.fillRect(cx, Y1 - 30, 20, 38);
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }

      // ---- particles: dissolve, drift, converge
      if (t >= tA0 && t < tLock + 2.5) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const C = { x: W / 2, y: H / 2 };
        for (const p of parts) {
          const start = tA0 + p.d;
          if (t < start) continue;
          const cStart = tB0 + p.e;
          const posA = (u) => {
            const x = p.x0 + 55 * u + 20 * u * u * (0.4 + p.r1) + Math.sin(u * (0.9 + p.r3 * 1.8) + p.ph) * u * 16;
            const y = p.y0 - 10 * u - 15 * u * u * (0.3 + p.r2) + Math.cos(u * (1.1 + p.r1 * 1.5) + p.ph) * u * 14;
            return [x, y];
          };
          let x, y, a, rgb = '255,236,205';
          if (t < cStart) {
            const u = t - start;
            [x, y] = posA(u);
            a = 0.85 - 0.35 * F.clamp(u / 2.5);
          } else {
            const [ax, ay] = posA(Math.max(0, cStart - start));
            const k = F.clamp((t - cStart) / 2.1);
            const e = F.easeInOut(k);
            const bx = F.lerp(ax, p.tx, e), by = F.lerp(ay, p.ty, e);
            const ang = Math.sin(Math.PI * e) * p.spin;
            const dx = bx - C.x, dy = by - C.y;
            x = C.x + dx * Math.cos(ang) - dy * Math.sin(ang);
            y = C.y + dx * Math.sin(ang) + dy * Math.cos(ang);
            a = 0.5 + 0.5 * e;
            rgb = e > 0.6 ? '255,214,150' : rgb;
          }
          // fade out once the crisp title has taken over
          const fadeOut = 1 - F.smooth(F.prog(t, tLock + 0.1, tLock + 1.6));
          const twinkle = 0.75 + 0.25 * Math.sin(t * 7 + p.ph * 5);
          F.glow(ctx, x, y, p.size * 2.3, rgb, a * fadeOut * twinkle, 0.35);
        }
        ctx.restore();
      }

      // ---- the title
      if (t >= tLock - 0.4) {
        const a = F.smooth(F.prog(t, tLock - 0.35, tLock + 0.25));
        const zoom = 1 + 0.035 * F.smooth(F.prog(t, tLock, 25));
        const sweep = F.prog(t, tLock + 0.9, tLock + 3.2);
        F.drawTitle(ctx, t, a, sweep > 0 && sweep < 1 ? sweep : -1, zoom);
        // lock flash
        const flash = F.pulse(t, tLock + 0.05, 0.22);
        if (flash > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          F.glow(ctx, W / 2, TY_MAIN - 40, 900, '255,210,150', 0.35 * flash, 0.3);
          ctx.restore();
        }
        // anamorphic flare travelling along the title
        const fp = F.prog(t, tLock - 0.1, tLock + 2.6);
        if (fp > 0 && fp < 1) {
          const fx = F.lerp(W / 2 - titleW / 2 - 60, W / 2 + titleW / 2 + 60, F.easeInOut(fp));
          F.flare(ctx, fx, TY_MAIN - 44, Math.sin(Math.PI * fp) * 0.9, '140,180,255');
        }
        const subA = F.env(t, tLock + 1.2, tLock + 2.6);
        F.text(ctx, 'A HISTORY OF ARTIFICIAL INTELLIGENCE', W / 2, TY_SUB + 12 * (1 - subA), {
          ...T_SUB, color: '#cdbb8e', alpha: subA, align: 'center',
        });
      }
      F.vignette(ctx, 0.55);
    },

    cues(S) {
      return [
        { t: 0.0, type: 'room_tone', dur: tA0 },
        ...F.typerCues(ty1, 'key', { heavy: 0 }),
        ...F.typerCues(ty2, 'key', { heavy: 1 }),
        { t: ty2.end + 1.0, type: 'motif', variant: 'question' },
        { t: tA0, type: 'dissolve', dur: 3.0 },
        { t: tB0, type: 'riser', dur: tLock - tB0 },
        { t: tLock, type: 'impact', size: 1.0 },
        { t: tLock, type: 'shimmer', dur: 3.0 },
      ];
    },
  });

  // ------------------------------------------------------------- finale
  F.scene('finale', {
    transIn: { type: 'fade', dur: 2.0 },
    draw(ctx, t, S) {
      F.motes(ctx, t + 40, { n: 70, seed: 8, alpha: 0.3, size: 3.5, speed: 7, rgb: '255,222,170' });
      const aTitle = F.env(t, 0.6, 2.6, 8.6, 10.2);
      const sweep = F.prog(t, 2.4, 5.2);
      F.drawTitle(ctx, t, aTitle, sweep > 0 && sweep < 1 ? sweep : -1, 1.0 + 0.02 * F.prog(t, 0, 10));
      F.text(ctx, 'The story is still being written.', W / 2, 690, {
        family: 'Cormorant Garamond', style: 'italic', weight: 400, size: 44,
        color: '#e9dcc0', alpha: F.env(t, 3.4, 5.0, 8.6, 10.2), align: 'center',
      });
      const aC = F.env(t, 10.6, 11.8, S.dur - 1.6, S.dur - 0.4);
      const cy = 470;
      F.text(ctx, 'A FILM MADE ENTIRELY FROM CODE', W / 2, cy, {
        family: 'Montserrat', weight: 500, size: 22, spacing: 10, color: '#d8b36a', alpha: aC, align: 'center',
      });
      const lines = [
        'Pictures drawn frame by frame on an HTML5 canvas',
        'Music and sound synthesized from raw waveforms in Python',
        'Narration performed by a synthetic voice (Kokoro TTS)',
      ];
      lines.forEach((l, i) => F.text(ctx, l, W / 2, cy + 64 + i * 46, {
        family: 'Cormorant Garamond', weight: 400, size: 32, color: '#efe7d6', alpha: aC * 0.9, align: 'center',
      }));
      F.text(ctx, 'Made with Claude Code', W / 2, cy + 64 + 3 * 46 + 34, {
        family: 'Montserrat', weight: 400, size: 20, spacing: 6, color: '#a99f8c', alpha: aC * 0.9, align: 'center',
      });
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      return [{ t: 0.6, type: 'swell', dur: 3.0 }, { t: 2.6, type: 'shimmer', dur: 3.0 }];
    },
  });
})();

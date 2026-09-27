/*
 * Visual kit for "What's Worth Building": line icons, panels, part cards,
 * a human silhouette, ridgelines, and phrase-level timing helpers.
 * Loaded after engine.js; everything hangs off the global F.
 */
(function () {
  'use strict';
  const { W, H } = F;

  F.AI = '95,212,255';      // machine: electric cyan
  F.HUMAN = '255,196,107';  // human: warm amber
  F.ROSE = '255,143,179';
  F.VIOLET = '168,139,255';

  // ------------------------------------------------------------- timing
  /** Approximate time a phrase is spoken inside a clip (by character share). */
  F.phraseAt = (clip, phrase, fallback = 0) => {
    const i = clip.text.indexOf(phrase);
    const u = i < 0 ? fallback : i / clip.text.length;
    return clip.start + clip.dur * u;
  };

  // -------------------------------------------------------------- icons
  // 24-unit line icons, stroked with round caps.
  const P = {
    doc(g) { g.moveTo(6, 3); g.lineTo(14, 3); g.lineTo(19, 8); g.lineTo(19, 21); g.lineTo(6, 21); g.closePath(); g.moveTo(14, 3); g.lineTo(14, 8); g.lineTo(19, 8); g.moveTo(9, 12); g.lineTo(16, 12); g.moveTo(9, 15.5); g.lineTo(16, 15.5); g.moveTo(9, 19); g.lineTo(13, 19); },
    search(g) { g.moveTo(17, 10); g.arc(10.5, 10.5, 6.5, 0, F.TAU); g.moveTo(15.2, 15.2); g.lineTo(21, 21); },
    chart(g) { g.moveTo(3, 3); g.lineTo(3, 21); g.lineTo(21, 21); g.moveTo(7.5, 17); g.lineTo(7.5, 12); g.moveTo(12, 17); g.lineTo(12, 7); g.moveTo(16.5, 17); g.lineTo(16.5, 10); },
    trend(g) { g.moveTo(3, 3); g.lineTo(3, 21); g.lineTo(21, 21); g.moveTo(6, 16); g.lineTo(10, 11); g.lineTo(13.5, 14); g.lineTo(20, 6); g.moveTo(15.5, 6); g.lineTo(20, 6); g.lineTo(20, 10.5); },
    ticket(g) { g.moveTo(3, 7); g.lineTo(21, 7); g.lineTo(21, 10); g.arc(21, 12, 2, -Math.PI / 2, Math.PI / 2, true); g.lineTo(21, 17); g.lineTo(3, 17); g.lineTo(3, 14); g.arc(3, 12, 2, Math.PI / 2, -Math.PI / 2, true); g.closePath(); g.moveTo(9, 7); g.lineTo(9, 17); },
    report(g) { g.moveTo(6, 4); g.lineTo(18, 4); g.lineTo(18, 21); g.lineTo(6, 21); g.closePath(); g.moveTo(9, 3); g.lineTo(15, 3); g.lineTo(15, 5.5); g.lineTo(9, 5.5); g.closePath(); g.moveTo(9, 11); g.lineTo(15, 11); g.moveTo(9, 14.5); g.lineTo(15, 14.5); g.moveTo(9, 18); g.lineTo(12.5, 18); },
    chat(g) { g.moveTo(4, 5); g.lineTo(20, 5); g.lineTo(20, 16); g.lineTo(11, 16); g.lineTo(6.5, 20); g.lineTo(6.5, 16); g.lineTo(4, 16); g.closePath(); g.moveTo(8, 9); g.lineTo(16, 9); g.moveTo(8, 12.3); g.lineTo(13.5, 12.3); },
    code(g) { g.moveTo(8, 7); g.lineTo(3, 12); g.lineTo(8, 17); g.moveTo(16, 7); g.lineTo(21, 12); g.lineTo(16, 17); g.moveTo(13.5, 5); g.lineTo(10.5, 19); },
    grid(g) { g.rect(3, 3, 18, 18); g.moveTo(3, 9); g.lineTo(21, 9); g.moveTo(9, 9); g.lineTo(9, 21); },
    check(g) { g.moveTo(12 + 9, 12); g.arc(12, 12, 9, 0, F.TAU); g.moveTo(7.5, 12.5); g.lineTo(10.5, 15.5); g.lineTo(16.5, 9); },
    user(g) { g.moveTo(15.5, 8); g.arc(12, 8, 3.5, 0, F.TAU); g.moveTo(5, 20.5); g.bezierCurveTo(5, 15, 8, 13.5, 12, 13.5); g.bezierCurveTo(16, 13.5, 19, 15, 19, 20.5); },
    users(g) { g.moveTo(12, 8.5); g.arc(9, 8.5, 3, 0, F.TAU); g.moveTo(3, 20); g.bezierCurveTo(3, 15.5, 5.5, 14, 9, 14); g.bezierCurveTo(12.5, 14, 15, 15.5, 15, 20); g.moveTo(15.5, 6); g.arc(16, 8.5, 2.6, -1.7, 2.2); g.moveTo(17, 13.8); g.bezierCurveTo(19.5, 14.3, 21, 16, 21, 19.5); },
    bulb(g) { g.moveTo(9, 17); g.bezierCurveTo(9, 14, 6, 12.5, 6, 9); g.arc(12, 9, 6, Math.PI, 0); g.bezierCurveTo(18, 12.5, 15, 14, 15, 17); g.closePath(); g.moveTo(9.5, 20); g.lineTo(14.5, 20); },
    target(g) { g.moveTo(21, 12); g.arc(12, 12, 9, 0, F.TAU); g.moveTo(17, 12); g.arc(12, 12, 5, 0, F.TAU); g.moveTo(13.2, 12); g.arc(12, 12, 1.2, 0, F.TAU); },
    rocket(g) { g.moveTo(12, 2.5); g.bezierCurveTo(16.5, 6, 17, 11, 15.5, 16); g.lineTo(8.5, 16); g.bezierCurveTo(7, 11, 7.5, 6, 12, 2.5); g.closePath(); g.moveTo(14.2, 9.2); g.arc(12, 9.2, 2.2, 0, F.TAU); g.moveTo(8.5, 13); g.lineTo(5.5, 17.5); g.lineTo(8.8, 16.5); g.moveTo(15.5, 13); g.lineTo(18.5, 17.5); g.lineTo(15.2, 16.5); g.moveTo(10.5, 19); g.lineTo(10.5, 21.5); g.moveTo(13.5, 19); g.lineTo(13.5, 21.5); },
    spark(g) { g.moveTo(12, 2.5); g.quadraticCurveTo(13, 11, 21.5, 12); g.quadraticCurveTo(13, 13, 12, 21.5); g.quadraticCurveTo(11, 13, 2.5, 12); g.quadraticCurveTo(11, 11, 12, 2.5); g.closePath(); },
    shield(g) { g.moveTo(12, 2.5); g.lineTo(20, 5.5); g.bezierCurveTo(20, 13, 17, 18.5, 12, 21.5); g.bezierCurveTo(7, 18.5, 4, 13, 4, 5.5); g.closePath(); g.moveTo(8.5, 12); g.lineTo(11, 14.5); g.lineTo(15.5, 9.5); },
    scale(g) { g.moveTo(12, 3); g.lineTo(12, 20); g.moveTo(7, 20.5); g.lineTo(17, 20.5); g.moveTo(4, 7); g.lineTo(20, 7); g.moveTo(4, 7); g.lineTo(1.5, 13); g.lineTo(6.5, 13); g.closePath(); g.moveTo(20, 7); g.lineTo(17.5, 13); g.lineTo(22.5, 13); g.closePath(); },
    heart(g) { g.moveTo(12, 20); g.bezierCurveTo(4, 14.5, 2.5, 10, 4.5, 6.8); g.bezierCurveTo(6.5, 3.8, 10.5, 4.2, 12, 7.5); g.bezierCurveTo(13.5, 4.2, 17.5, 3.8, 19.5, 6.8); g.bezierCurveTo(21.5, 10, 20, 14.5, 12, 20); g.closePath(); },
    eye(g) { g.moveTo(2, 12); g.bezierCurveTo(6, 5.5, 18, 5.5, 22, 12); g.bezierCurveTo(18, 18.5, 6, 18.5, 2, 12); g.closePath(); g.moveTo(15, 12); g.arc(12, 12, 3, 0, F.TAU); },
    layers(g) { g.moveTo(12, 3); g.lineTo(21, 8); g.lineTo(12, 13); g.lineTo(3, 8); g.closePath(); g.moveTo(3, 12); g.lineTo(12, 17); g.lineTo(21, 12); g.moveTo(3, 16); g.lineTo(12, 21); g.lineTo(21, 16); },
    flag(g) { g.moveTo(5, 21.5); g.lineTo(5, 3); g.moveTo(5, 4); g.lineTo(18, 4); g.lineTo(15, 8.5); g.lineTo(18, 13); g.lineTo(5, 13); },
    book(g) { g.moveTo(12, 6); g.bezierCurveTo(9, 4, 5.5, 4, 3, 5); g.lineTo(3, 19); g.bezierCurveTo(5.5, 18, 9, 18, 12, 20); g.bezierCurveTo(15, 18, 18.5, 18, 21, 19); g.lineTo(21, 5); g.bezierCurveTo(18.5, 4, 15, 4, 12, 6); g.lineTo(12, 20); },
    pen(g) { g.moveTo(4, 20); g.lineTo(5, 15.5); g.lineTo(16, 4.5); g.lineTo(19.5, 8); g.lineTo(8.5, 19); g.closePath(); g.moveTo(13.5, 7); g.lineTo(17, 10.5); },
    clock(g) { g.moveTo(21, 12); g.arc(12, 12, 9, 0, F.TAU); g.moveTo(12, 6.5); g.lineTo(12, 12); g.lineTo(16, 14.5); },
    globe(g) { g.moveTo(21, 12); g.arc(12, 12, 9, 0, F.TAU); g.moveTo(3, 12); g.lineTo(21, 12); g.moveTo(12, 3); g.bezierCurveTo(16, 7, 16, 17, 12, 21); g.moveTo(12, 3); g.bezierCurveTo(8, 7, 8, 17, 12, 21); },
    database(g) { g.ellipse(12, 5.5, 7.5, 2.8, 0, 0, F.TAU); g.moveTo(4.5, 5.5); g.lineTo(4.5, 18.5); g.ellipse(12, 18.5, 7.5, 2.8, 0, Math.PI, 0, true); g.moveTo(19.5, 18.5); g.lineTo(19.5, 5.5); g.moveTo(4.5, 12); g.ellipse(12, 12, 7.5, 2.8, 0, Math.PI, 0, true); },
    lock(g) { g.rect(5, 11, 14, 10); g.moveTo(8, 11); g.lineTo(8, 7.5); g.arc(12, 7.5, 4, Math.PI, 0); g.lineTo(16, 11); g.moveTo(12, 15); g.lineTo(12, 17.5); },
    mountain(g) { g.moveTo(2, 20); g.lineTo(9, 7); g.lineTo(13, 13); g.lineTo(16, 9.5); g.lineTo(22, 20); g.closePath(); },
    door(g) { g.moveTo(5, 21); g.lineTo(5, 3); g.lineTo(19, 3); g.lineTo(19, 21); g.moveTo(2.5, 21); g.lineTo(21.5, 21); g.moveTo(15.5, 12.5); g.arc(15, 12.5, 0.6, 0, F.TAU); },
    compass(g) { g.moveTo(21, 12); g.arc(12, 12, 9, 0, F.TAU); g.moveTo(15.5, 8.5); g.lineTo(13.2, 13.2); g.lineTo(8.5, 15.5); g.lineTo(10.8, 10.8); g.closePath(); },
    sun(g) { g.moveTo(16, 12); g.arc(12, 12, 4, 0, F.TAU); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.moveTo(12 + Math.cos(a) * 6.5, 12 + Math.sin(a) * 6.5); g.lineTo(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9); } },
    moon(g) { g.moveTo(15, 4); g.bezierCurveTo(8.5, 4.5, 6, 11, 8.5, 15.5); g.bezierCurveTo(11, 20, 17, 21, 20.5, 17.5); g.bezierCurveTo(14, 18, 10.5, 10.5, 15, 4); g.closePath(); },
    dollar(g) { g.moveTo(21, 12); g.arc(12, 12, 9, 0, F.TAU); g.moveTo(15, 8.5); g.bezierCurveTo(13, 7, 9, 7.2, 9, 9.8); g.bezierCurveTo(9, 12.3, 15, 11.5, 15, 14.3); g.bezierCurveTo(15, 17, 10.8, 17, 9, 15.5); g.moveTo(12, 5.5); g.lineTo(12, 18.5); },
    bolt(g) { g.moveTo(13.5, 2.5); g.lineTo(5, 13.5); g.lineTo(11.5, 13.5); g.lineTo(10.5, 21.5); g.lineTo(19, 10.5); g.lineTo(12.5, 10.5); g.closePath(); },
    gear(g) { for (let k = 0; k < 8; k++) { const a0 = k * Math.PI / 4 - 0.22, a1 = k * Math.PI / 4 + 0.22; const r1 = 9, r0 = 6.8; g.lineTo(12 + Math.cos(a0) * r0, 12 + Math.sin(a0) * r0); g.lineTo(12 + Math.cos(a0 + 0.08) * r1, 12 + Math.sin(a0 + 0.08) * r1); g.lineTo(12 + Math.cos(a1 - 0.08) * r1, 12 + Math.sin(a1 - 0.08) * r1); g.lineTo(12 + Math.cos(a1) * r0, 12 + Math.sin(a1) * r0); } g.closePath(); g.moveTo(15, 12); g.arc(12, 12, 3, 0, F.TAU); },
    agent(g) { g.rect(5, 7, 14, 11); g.moveTo(12, 7); g.lineTo(12, 3.5); g.moveTo(13.2, 3.2); g.arc(12, 3.2, 1.2, 0, F.TAU); g.moveTo(10, 12); g.arc(9, 12, 1, 0, F.TAU); g.moveTo(16, 12); g.arc(15, 12, 1, 0, F.TAU); g.moveTo(9.5, 15.5); g.lineTo(14.5, 15.5); g.moveTo(5, 12); g.lineTo(3, 12); g.moveTo(19, 12); g.lineTo(21, 12); },
    star(g) { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 9.5; k ? g.lineTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r) : g.moveTo(12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r); } g.closePath(); },
    wave(g) { g.moveTo(3, 12); for (let x = 3; x <= 21; x += 0.5) g.lineTo(x, 12 + Math.sin((x - 3) * 0.9) * 5 * Math.sin((x - 3) / 18 * Math.PI)); },
  };
  /** Draw a line icon centred at (x, y). */
  F.icon = (ctx, name, x, y, size, rgb = '255,255,255', alpha = 1, o = {}) => {
    if (alpha <= 0.003 || !P[name]) return;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.beginPath();
    P[name](ctx);
    ctx.lineWidth = (o.lw ?? 1.7);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha;
    if (o.glow) {
      ctx.shadowColor = F.rgba(rgb, 0.9);
      ctx.shadowBlur = o.glow * 24 / size;
    }
    if (o.fill) {
      ctx.fillStyle = F.rgba(rgb, o.fill);
      ctx.fill();
    }
    ctx.strokeStyle = F.rgba(rgb, 1);
    ctx.stroke();
    ctx.restore();
  };
  F.iconNames = Object.keys(P);

  // ------------------------------------------------------------- panels
  /** Glass panel with an optional glowing edge. */
  F.panel = (ctx, x, y, w, h, o = {}) => {
    const a = o.alpha ?? 1;
    if (a <= 0.003) return;
    const r = o.r ?? 16;
    ctx.save();
    ctx.globalAlpha = a;
    if (o.glow) {
      ctx.shadowColor = F.rgba(o.rgb || F.AI, 0.55 * o.glow);
      ctx.shadowBlur = 30;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = o.fill || 'rgba(12,18,34,0.78)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = o.lw ?? 1.5;
    ctx.strokeStyle = F.rgba(o.rgb || '170,190,230', o.edge ?? 0.35);
    ctx.stroke();
    ctx.restore();
  };

  /** "PART I · THE FUTURE" interstitial. */
  F.partCard = (ctx, t, o) => {
    const a = F.env(t, o.t0, o.t0 + 0.8, o.t1 - 0.7, o.t1);
    if (a <= 0.003) return;
    ctx.save();
    ctx.fillStyle = `rgba(3,5,10,${0.92 * a})`;
    ctx.fillRect(0, 0, W, H);
    const k = F.easeOut(F.prog(t, o.t0, o.t0 + 1.4));
    const lineW = 260 * k;
    ctx.fillStyle = F.rgba(F.HUMAN, 0.85 * a);
    ctx.fillRect(W / 2 - lineW, 500, lineW * 2, 1.5);
    F.text(ctx, o.num, W / 2, 470, { family: 'Montserrat', weight: 500, size: 22, spacing: 14, color: '#ffc46b', alpha: a, align: 'center' });
    F.text(ctx, o.title, W / 2, 585 + (1 - k) * 12, { family: 'Cinzel', weight: 600, size: 76, spacing: 12, color: '#f6efe2', alpha: a, align: 'center', glow: 20, glowColor: 'rgba(255,196,107,0.45)' });
    if (o.sub) F.text(ctx, o.sub, W / 2, 640, { family: 'Cormorant Garamond', style: 'italic', size: 34, color: '#d8ccb4', alpha: a * F.smooth(F.prog(t, o.t0 + 0.6, o.t0 + 1.4)), align: 'center' });
    ctx.restore();
  };

  /** A person, seen from behind: head and shoulders with rim light. */
  F.human = (ctx, x, y, s, rgb = F.HUMAN, alpha = 1) => {
    if (alpha <= 0.003) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#05070c';
    ctx.beginPath();
    ctx.arc(0, -62, 15, 0, F.TAU);
    ctx.moveTo(-30, 10);
    ctx.bezierCurveTo(-30, -30, -20, -42, 0, -42);
    ctx.bezierCurveTo(20, -42, 30, -30, 30, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = F.rgba(rgb, 0.85);
    ctx.lineWidth = 2 / s;
    ctx.shadowColor = F.rgba(rgb, 1);
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, -62, 15, Math.PI * 1.05, Math.PI * 1.95);
    ctx.moveTo(-29, -8);
    ctx.bezierCurveTo(-28, -30, -19, -41, 0, -41);
    ctx.bezierCurveTo(19, -41, 28, -30, 29, -8);
    ctx.stroke();
    ctx.restore();
  };

  /** A ridgeline as an array of y values across the frame. */
  F.ridge = (seed, base, amp, rough = 1, n = 97) => {
    const ys = [];
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      let y = 0;
      for (let o = 0; o < 4; o++) {
        const f = Math.pow(2, o) * rough;
        y += F.noise(x * 6 * f + seed * 13.7, seed + o) * amp / Math.pow(1.9, o);
      }
      ys.push(base - Math.abs(y) - amp * 0.3 * Math.sin(x * Math.PI));
    }
    return ys;
  };
  F.drawRidge = (ctx, ys, fill, alpha = 1, glowRgb, glowA = 0) => {
    const n = ys.length;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(-10, H);
    ys.forEach((y, i) => ctx.lineTo(-10 + (i / (n - 1)) * (W + 20), y));
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (glowRgb && glowA > 0.003) {
      ctx.strokeStyle = F.rgba(glowRgb, glowA);
      ctx.lineWidth = 2;
      ctx.shadowColor = F.rgba(glowRgb, 1);
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ys.forEach((y, i) => (i ? ctx.lineTo(-10 + (i / (n - 1)) * (W + 20), y) : ctx.moveTo(-10, y)));
      ctx.stroke();
    }
    ctx.restore();
  };

  /** Twinkling star field. */
  let stars = null;
  F.stars = (ctx, t, alpha = 1, o = {}) => {
    if (alpha <= 0.003) return;
    if (!stars) {
      const r = F.rng(4242);
      stars = Array.from({ length: 700 }, () => ({ x: r() * W, y: r() * H, s: r(), p: r() * 6 }));
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const drift = o.drift ?? 4;
    for (const s of stars) {
      const x = ((s.x + t * drift * (0.2 + s.s)) % W + W) % W;
      if (o.maxY && s.y > o.maxY) continue;
      const tw = 0.55 + 0.45 * Math.sin(t * (0.7 + s.s * 2) + s.p);
      F.glow(ctx, x, s.y, 1.2 + s.s * 3, o.rgb || '215,225,255', alpha * (0.2 + 0.6 * s.s) * tw);
    }
    ctx.restore();
  };

  /** Rounded "chip" label, returns its width. */
  F.chip = (ctx, str, x, y, o = {}) => {
    const a = o.alpha ?? 1;
    const font = { family: 'Montserrat', weight: 500, size: o.size || 20, spacing: o.spacing ?? 2 };
    const w = F.measure(ctx, str, font) + (o.padX ?? 22) * 2;
    const h = (o.size || 20) + 20;
    const x0 = o.align === 'center' ? x - w / 2 : x;
    if (a > 0.003) {
      F.panel(ctx, x0, y - h / 2, w, h, { r: h / 2, alpha: a, rgb: o.rgb, edge: o.edge ?? 0.6, fill: o.fill || 'rgba(10,16,30,0.85)', glow: o.glow });
      F.text(ctx, str, x0 + w / 2, y + (o.size || 20) * 0.36, { ...font, color: o.color || '#eef3ff', alpha: a, align: 'center' });
    }
    return w;
  };
})();

/* Early history: the ancient dream, the 1943 neuron, Turing, Dartmouth. */
(function () {
  'use strict';
  const { W, H } = F;

  // ------------------------------------------------------------ helpers
  /** Pre-rendered bronze gear. */
  function gearCanvas(r, teeth, opts = {}) {
    const pad = 8, size = Math.ceil(r * 2 + pad * 2);
    const c = F.canvas(size, size);
    const g = c.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const depth = opts.depth ?? Math.max(6, r * 0.09);
    const ri = r - depth;
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * F.TAU, a1 = ((i + 0.5) / teeth) * F.TAU, step = F.TAU / teeth;
      const pts = [
        [ri, a0], [r, a0 + step * 0.12], [r, a1 - step * 0.12], [ri, a1], [ri, a0 + step],
      ];
      pts.forEach(([rr, a], k) => {
        const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
        if (i === 0 && k === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
    }
    g.closePath();
    // hub and lightening holes
    const hub = r * 0.16;
    g.moveTo(cx + hub, cy);
    g.arc(cx, cy, hub, 0, F.TAU, true);
    const holes = opts.holes ?? (r > 60 ? 5 : 0);
    for (let i = 0; i < holes; i++) {
      const a = (i / holes) * F.TAU;
      const hr = (ri - hub) * 0.3, hx = cx + Math.cos(a) * (hub + ri) * 0.5, hy = cy + Math.sin(a) * (hub + ri) * 0.5;
      g.moveTo(hx + hr, hy);
      g.arc(hx, hy, hr, 0, F.TAU, true);
    }
    const grd = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    const [c0, c1, c2] = opts.colors || ['#e3b26a', '#8a5a2b', '#3b2412'];
    grd.addColorStop(0, c0);
    grd.addColorStop(0.5, c1);
    grd.addColorStop(1, c2);
    g.fillStyle = grd;
    g.fill('evenodd');
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(255,220,160,0.35)';
    g.stroke();
    // inner rim
    g.beginPath();
    g.arc(cx, cy, ri * 0.86, 0, F.TAU);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = Math.max(2, r * 0.03);
    g.stroke();
    if (opts.blur) {
      const b = F.canvas(size, size);
      const bg = b.getContext('2d');
      bg.filter = `blur(${opts.blur}px)`;
      bg.drawImage(c, 0, 0);
      return b;
    }
    return c;
  }
  const drawRot = (ctx, img, x, y, ang, scale = 1, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  };

  /** Off-white paper with fibres, pre-rendered with its text. */
  function paperCanvas(w, h, seed, drawText) {
    const c = F.canvas(w, h);
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#efe6d2');
    grd.addColorStop(1, '#d9ccb0');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    const r = F.rng(seed);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '90,70,40' : '255,255,245'},${0.03 + r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(120,95,60,${0.03 + r() * 0.04})`;
      g.lineWidth = 0.6;
      g.beginPath();
      const x = r() * w, y = r() * h;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + r() * 30 - 15, y + r() * 30 - 15, x + r() * 60 - 30, y + r() * 60 - 30);
      g.stroke();
    }
    // age at the edges
    const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    e.addColorStop(0, 'rgba(120,90,40,0)');
    e.addColorStop(1, 'rgba(120,90,40,0.28)');
    g.fillStyle = e;
    g.fillRect(0, 0, w, h);
    if (drawText) drawText(g);
    return c;
  }
  /** Typewriter ink: slightly uneven strike per character. */
  function inkText(g, str, x, y, o, seed = 1) {
    F.setFont(g, o);
    const r = F.rng(seed);
    let cx = x;
    for (const ch of str) {
      g.globalAlpha = 0.72 + r() * 0.28;
      g.fillStyle = o.color || '#1d1812';
      g.fillText(ch, cx + (r() - 0.5) * 0.8, y + (r() - 0.5) * 1.2);
      cx += g.measureText(ch).width;
    }
    g.globalAlpha = 1;
    return cx - x;
  }
  F.inkText = inkText;
  F.paperCanvas = paperCanvas;

  // ============================================================== DREAM
  const MELODY = [ // music-box pins: [beat, midi]
    [0, 74], [1, 69], [2, 77], [3, 76], [4, 74], [5, 72], [5.5, 74], [6, 69], [7.5, 62],
  ];
  const COMB = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79, 81];
  let gears, eyeRing, quillWord;

  F.scene('dream', {
    transIn: { type: 'fade', dur: 1.6 },
    init(S) {
      const r = F.rng(77);
      gears = [];
      const specs = [
        [260, 250, 150, 30, 0], [470, 380, 95, 20, 0], [1480, 300, 170, 34, 0], [1690, 720, 120, 24, 0],
        [300, 780, 130, 26, 0], [1250, 860, 90, 18, 0], [120, 470, 70, 14, 5], [1820, 420, 80, 16, 5],
        [640, 900, 110, 22, 7], [1340, 170, 100, 20, 6],
      ];
      for (const [x, y, rad, teeth, blur] of specs) {
        gears.push({
          x, y, rad, img: gearCanvas(rad, teeth, { blur, colors: blur ? ['#6b4a2a', '#3b2616', '#1a0f07'] : undefined }),
          speed: (r() < 0.5 ? -1 : 1) * (0.9 / teeth) * 6, phase: r() * 6, depth: blur ? 1.3 : 1,
        });
      }
      eyeRing = gearCanvas(330, 90, { depth: 16, holes: 0, colors: ['#f0c27a', '#9c6a33', '#402812'] });
      const b2 = S.c('b2');
      this.pluckT0 = b2.start + 0.35;
      this.spb = 0.36;
      quillWord = 'Automaton';
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b1 = S.c('b1'), b2 = S.c('b2'), c = S.c('c');
      // background warmth
      const warm = F.env(t, 0, 3.5);
      const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 1100);
      bg.addColorStop(0, `rgba(58,36,18,${0.9 * warm})`);
      bg.addColorStop(1, 'rgba(6,4,2,1)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ---------- part 1: gears and the mechanical eye
      const p1 = 1 - F.smooth(F.prog(t, b2.start - 0.5, b2.start + 0.3));
      if (p1 > 0.01) {
        ctx.save();
        ctx.globalAlpha = p1;
        const zoom = 1.18 - 0.16 * F.easeInOut(F.prog(t, 0, b2.start));
        ctx.translate(W / 2, H / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-W / 2, -H / 2);
        const reveal = F.smooth(F.prog(t, 0.2, 3.2));
        for (const gr of gears) {
          drawRot(ctx, gr.img, gr.x + (gr.x - W / 2) * 0.04 * t / 8 * gr.depth, gr.y, gr.phase + t * gr.speed, 1, reveal * p1 * 0.95);
        }
        // eye: outer toothed ring, iris grooves, aperture, glowing pupil
        const ex = W / 2, ey = H / 2;
        const eyeA = F.smooth(F.prog(t, 0.8, 4.2)) * p1;
        drawRot(ctx, eyeRing, ex, ey, t * 0.05, 1, eyeA);
        ctx.save();
        ctx.globalAlpha = eyeA;
        // iris disc
        const iris = ctx.createRadialGradient(ex, ey, 30, ex, ey, 300);
        iris.addColorStop(0, '#2a1a0c');
        iris.addColorStop(0.7, '#5b3b1c');
        iris.addColorStop(1, '#241509');
        ctx.fillStyle = iris;
        ctx.beginPath(); ctx.arc(ex, ey, 298, 0, F.TAU); ctx.fill();
        // radial grooves
        ctx.strokeStyle = 'rgba(255,200,130,0.16)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 72; i++) {
          const an = (i / 72) * F.TAU - t * 0.08;
          ctx.beginPath();
          ctx.moveTo(ex + Math.cos(an) * 175, ey + Math.sin(an) * 175);
          ctx.lineTo(ex + Math.cos(an) * 285, ey + Math.sin(an) * 285);
          ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(ex, ey, 175, 0, F.TAU);
        ctx.strokeStyle = 'rgba(255,210,140,0.35)'; ctx.lineWidth = 3; ctx.stroke();
        // aperture blades
        const open = F.easeInOut(F.prog(t, b1.start - 0.2, b1.start + 1.6));
        const ro = 22 + 118 * open, N = 9, rot = 0.9 - 1.3 * open + t * 0.02;
        const pupil = F.smooth(F.prog(t, b1.start + 0.2, b1.start + 1.8));
        const glowP = ctx.createRadialGradient(ex, ey, 0, ex, ey, 170);
        glowP.addColorStop(0, `rgba(255,236,190,${0.95 * pupil})`);
        glowP.addColorStop(0.35, `rgba(255,170,70,${0.8 * pupil})`);
        glowP.addColorStop(1, `rgba(120,50,10,${0.4 * pupil})`);
        ctx.fillStyle = pupil > 0.01 ? glowP : '#0c0703';
        ctx.beginPath(); ctx.arc(ex, ey, 172, 0, F.TAU); ctx.fill();
        // blades: fill ring between aperture polygon and r=172
        const poly = [];
        for (let i = 0; i < N; i++) {
          const an = rot + (i / N) * F.TAU;
          poly.push([ex + Math.cos(an) * ro, ey + Math.sin(an) * ro]);
        }
        ctx.beginPath();
        ctx.arc(ex, ey, 172, 0, F.TAU);
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let i = N - 1; i >= 0; i--) ctx.lineTo(poly[i][0], poly[i][1]);
        ctx.closePath();
        const bl = ctx.createRadialGradient(ex, ey, ro, ex, ey, 172);
        bl.addColorStop(0, '#6e4a26');
        bl.addColorStop(1, '#2a190b');
        ctx.fillStyle = bl;
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(255,215,150,0.45)';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < N; i++) {
          const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % N];
          const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
          // extend the edge until it meets the r=172 circle
          const ux = dx / L, uy = dy / L;
          const fx = x0 - ex, fy = y0 - ey;
          const bq = fx * ux + fy * uy, cq = fx * fx + fy * fy - 172 * 172;
          const s = -bq + Math.sqrt(Math.max(0, bq * bq - cq));
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 + ux * s, y0 + uy * s);
          ctx.stroke();
        }
        ctx.restore();
        // light bloom from the pupil
        if (pupil > 0.01) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          F.glow(ctx, ex, ey, 420, '255,170,80', 0.45 * pupil * p1);
          F.glow(ctx, ex, ey, 120, '255,240,210', 0.6 * pupil * p1);
          ctx.restore();
        }
        ctx.restore();
      }

      // ---------- part 2: music box cylinder + writing automaton
      const p2 = F.env(t, b2.start + 0.05, b2.start + 0.85, c.start - 0.4, c.start + 0.3);
      if (p2 > 0.01) {
        ctx.save();
        ctx.globalAlpha = p2;
        this.drawMusicBox(ctx, t, p2);
        this.drawWriter(ctx, t, b2, p2);
        ctx.restore();
      }

      // ---------- part 3: Lovelace, cards and loom
      const p3 = F.env(t, c.start + 0.2, c.start + 1.2);
      if (p3 > 0.01) this.drawLoom(ctx, t, c, p3);

      F.motes(ctx, t, { n: 90, seed: 12, rgb: '255,170,80', alpha: 0.5, size: 4, speed: 22, rise: 1.4, dx: 0.3 });
      F.caption(ctx, t, { t0: b1.start, t1: b2.start - 0.2, title: 'TALOS · THE BRONZE GIANT OF GREEK MYTH', accent: '#e0a860' });
      F.caption(ctx, t, { t0: b2.start + 0.2, t1: c.start - 0.3, year: '1206 – 1770s', title: 'CLOCKWORK AUTOMATA · FROM AL-JAZARI TO JAQUET-DROZ', accent: '#e0a860' });
      F.caption(ctx, t, { t0: c.start + 0.8, t1: S.dur - 1.0, year: '1843', title: 'ADA LOVELACE', sub: 'Notes on the Analytical Engine', accent: '#e0a860', x: 1770, y: 832, align: 'right' });
      F.vignette(ctx, 0.75);
      F.grain(ctx, t, 0.03);
    },

    drawMusicBox(ctx, t, alpha) {
      const cx = 620, cy = 520, len = 560, R = 120;
      const x0 = cx - len / 2;
      // cylinder body
      const body = ctx.createLinearGradient(0, cy - R, 0, cy + R);
      body.addColorStop(0, '#2a1a0b');
      body.addColorStop(0.35, '#b98a48');
      body.addColorStop(0.5, '#f1cf8a');
      body.addColorStop(0.7, '#8c6231');
      body.addColorStop(1, '#1e1206');
      ctx.fillStyle = body;
      ctx.fillRect(x0, cy - R, len, R * 2);
      // end caps
      for (const ex of [x0, x0 + len]) {
        ctx.fillStyle = '#3a2512';
        ctx.beginPath(); ctx.ellipse(ex, cy, 18, R, 0, 0, F.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,210,140,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      }
      // pins: melody notes pass the pluck line (front, top edge) at their beat time
      const omega = 1.6; // radians per second
      const spacing = len / (COMB.length + 1);
      const pinTimes = [];
      for (let rep = 0; rep < 2; rep++) for (const [beat, midi] of MELODY) pinTimes.push([this.pluckT0 + (beat + rep * 9) * this.spb, midi]);
      for (const [tp, midi] of pinTimes) {
        const theta = (t - tp) * omega; // 0 at the pluck line
        const k = COMB.indexOf(midi);
        if (k < 0) continue;
        const px = x0 + spacing * (k + 1);
        const ang = -Math.PI / 2 + theta; // pluck line at top
        const depthCos = Math.cos(ang + Math.PI / 2);
        if (depthCos < 0.05) continue;
        const py = cy + Math.sin(ang) * R;
        ctx.fillStyle = `rgba(255,236,190,${0.4 + 0.6 * depthCos})`;
        ctx.beginPath(); ctx.arc(px, py, 4.5 * (0.6 + 0.4 * depthCos), 0, F.TAU); ctx.fill();
      }
      // comb teeth above the cylinder, vibrating after each pluck
      for (let k = 0; k < COMB.length; k++) {
        const tx = x0 + spacing * (k + 1);
        let vib = 0, lit = 0;
        for (const [tp, midi] of pinTimes) {
          if (midi !== COMB[k] || t < tp) continue;
          const dt = t - tp;
          vib += Math.sin(dt * 90) * Math.exp(-dt * 7) * 5;
          lit += Math.exp(-dt * 3);
        }
        const toothLen = 150 - k * 7;
        ctx.strokeStyle = '#d9c7a3';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tx, cy - R - toothLen - 10);
        ctx.quadraticCurveTo(tx + vib * 0.5, cy - R - toothLen / 2, tx + vib, cy - R - 4);
        ctx.stroke();
        if (lit > 0.02) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          F.glow(ctx, tx + vib, cy - R - 10, 46, '255,200,120', Math.min(1, lit) * 0.9 * alpha);
          ctx.restore();
        }
      }
      ctx.fillStyle = '#5a3d1e';
      ctx.fillRect(x0 + 10, cy - R - 180, len - 20, 26);
      ctx.strokeStyle = 'rgba(255,210,140,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 10, cy - R - 180, len - 20, 26);
    },

    drawWriter(ctx, t, b2, alpha) {
      // a card on which a mechanical quill writes a word
      const px = 1150, py = 330, pw = 620, ph = 380;
      if (!this.card) this.card = paperCanvas(pw, ph, 5);
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate(-0.04);
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 40;
      ctx.drawImage(this.card, -pw / 2, -ph / 2);
      ctx.shadowBlur = 0;
      const o = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 110 };
      const tw = F.measure(ctx, quillWord, o);
      const wx = -tw / 2, wy = 30;
      const k = F.easeInOut(F.prog(t, b2.start + 0.2, b2.start + 3.0));
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx - 20, -ph / 2, (tw + 40) * k, ph);
      ctx.clip();
      F.text(ctx, quillWord, wx, wy, { ...o, color: '#2a1a0e' });
      ctx.restore();
      // quill
      const qx = wx + (tw + 20) * k - 10, qy = wy - 20 + Math.sin(t * 22) * 10 * (k > 0 && k < 1 ? 1 : 0);
      ctx.translate(qx, qy);
      ctx.rotate(-0.7);
      const qg = ctx.createLinearGradient(0, 0, 0, -260);
      qg.addColorStop(0, '#f6efe0');
      qg.addColorStop(1, 'rgba(230,220,200,0.2)');
      ctx.fillStyle = qg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-40, -120, -8, -270);
      ctx.quadraticCurveTo(30, -140, 0, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,60,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -260); ctx.stroke();
      ctx.restore();
    },

    drawLoom(ctx, t, c, alpha) {
      const cols = 44, rows = 24, cell = 19;
      const gx = 1050 - (cols * cell) / 2, gy = 318;
      const woven = F.prog(t, c.start + 0.4, c.start + 6.4) * rows;
      const flower = (i, j) => {
        const u = (i - cols / 2 + 0.5) / (rows / 2), v = (j - rows * 0.42) / (rows / 2);
        const r = Math.hypot(u, v), th = Math.atan2(v, u);
        if (r < 0.16) return 3; // heart
        if (r < 0.2 + 0.52 * Math.abs(Math.cos(3 * th))) return v < 0.9 ? 2 : 0; // petals
        if (Math.abs(u) < 0.06 && v > 0 && v < 1.2) return 1; // stem
        const lu = u - 0.28, lv = v - 0.78; // leaf
        if (lu * lu / 0.05 + lv * lv / 0.012 < 1 && v > 0.55) return 1;
        const lu2 = u + 0.28, lv2 = v - 0.9;
        if (lu2 * lu2 / 0.05 + lv2 * lv2 / 0.012 < 1) return 1;
        return 0;
      };
      ctx.save();
      ctx.globalAlpha = alpha;
      // backing cloth
      ctx.fillStyle = '#120c08';
      ctx.fillRect(gx - 14, gy - 14, cols * cell + 28, rows * cell + 28);
      for (let j = rows - 1; j >= 0; j--) {
        const rowIdx = rows - 1 - j; // weave from the bottom up
        const vis = F.clamp(woven - rowIdx);
        if (vis <= 0) continue;
        for (let i = 0; i < cols; i++) {
          const f = flower(i, j);
          const x = gx + i * cell, y = gy + j * cell;
          const over = (i + j) % 2 === 0;
          let col;
          if (f === 3) col = [255, 214, 120];
          else if (f === 2) col = [236, 150, 90];
          else if (f === 1) col = [120, 170, 110];
          else col = over ? [52, 40, 70] : [40, 30, 55];
          const sh = over ? 1 : 0.82;
          ctx.fillStyle = `rgba(${col[0] * sh | 0},${col[1] * sh | 0},${col[2] * sh | 0},${vis})`;
          if (over) ctx.fillRect(x + 1, y + 3, cell - 2, cell - 6);
          else ctx.fillRect(x + 3, y + 1, cell - 6, cell - 2);
        }
      }
      // shuttle light on the current row
      const cur = Math.floor(woven);
      if (cur < rows) {
        const y = gy + (rows - 1 - cur) * cell + cell / 2;
        const sx = gx + (cols * cell) * ((woven % 1));
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, sx, y, 60, '255,200,120', 0.8 * alpha);
        ctx.globalCompositeOperation = 'source-over';
      }
      // bloom over the finished flower
      const done = F.smooth(F.prog(t, c.start + 6.0, c.start + 7.5));
      if (done > 0) {
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, gx + cols * cell / 2, gy + rows * 0.42 * cell, 360, '255,170,90', 0.35 * done * alpha);
        ctx.globalCompositeOperation = 'source-over';
      }
      // punched cards chain on the left
      const cardX = 190, cardW = 250, cardH = 70;
      for (let k = -1; k < 9; k++) {
        const y = gy - 40 + k * (cardH + 10) - ((t - c.start) * 60) % (cardH + 10);
        if (y < F.TOP - 80 || y > F.BOT) continue;
        ctx.fillStyle = '#d8c7a2';
        ctx.fillRect(cardX, y, cardW, cardH);
        ctx.fillStyle = '#2a1d10';
        for (let h = 0; h < 12; h++) for (let v = 0; v < 3; v++) {
          if (F.hash(h * 7 + v * 13 + (k + Math.floor((t - c.start) * 60 / (cardH + 10))) * 97, 3) > 0.45) {
            ctx.beginPath();
            ctx.arc(cardX + 16 + h * 19.5, y + 16 + v * 19, 5, 0, F.TAU);
            ctx.fill();
          }
        }
      }
      ctx.restore();
      // quote
      const qa = F.env(t, c.start + 1.2, c.start + 2.4) * alpha;
      const q1 = '“The Analytical Engine weaves algebraical patterns';
      const q2 = 'just as the Jacquard-loom weaves flowers and leaves.”';
      const qo = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 40, color: '#f3e3c3', align: 'center' };
      F.text(ctx, q1, W / 2, 215, { ...qo, alpha: qa });
      F.text(ctx, q2, W / 2, 262, { ...qo, alpha: qa });
    },

    cues(S) {
      const out = [];
      const b1 = S.c('b1'), b2 = S.c('b2'), c = S.c('c');
      out.push({ t: 0, type: 'ticking', dur: b2.start + 3.5, rate: 2.0 });
      out.push({ t: b1.start - 0.2, type: 'iris', dur: 1.8 });
      for (let rep = 0; rep < 2; rep++) {
        for (const [beat, midi] of MELODY) {
          const tt = this.pluckT0 + (beat + rep * 9) * this.spb;
          if (tt < c.start + 0.8) out.push({ t: tt, type: 'musicbox', midi });
        }
      }
      out.push({ t: c.start + 0.4, type: 'loom', dur: 6.0 });
      return out;
    },
  });

  // ============================================================= NEURON
  let dendrites, axon, terminals;
  function branch(out, x, y, ang, len, width, depth, r) {
    const pts = [[x, y]];
    let cx = x, cy = y, a = ang;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      a += (r() - 0.5) * 0.35;
      cx += Math.cos(a) * len / steps;
      cy += Math.sin(a) * len / steps;
      pts.push([cx, cy]);
    }
    out.push({ pts, width, depth });
    if (depth < 3) {
      const n = depth === 0 ? 2 + (r() < 0.5 ? 1 : 0) : 2;
      for (let k = 0; k < n; k++) {
        branch(out, cx, cy, a + (k - (n - 1) / 2) * (0.5 + r() * 0.3), len * (0.55 + r() * 0.2), width * 0.62, depth + 1, r);
      }
    }
  }
  const polyLen = (pts) => {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return L;
  };
  const polyAt = (pts, u) => {
    const L = polyLen(pts) * F.clamp(u);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (acc + d >= L) {
        const k = (L - acc) / d;
        return [F.lerp(pts[i - 1][0], pts[i][0], k), F.lerp(pts[i - 1][1], pts[i][1], k)];
      }
      acc += d;
    }
    return pts[pts.length - 1];
  };
  F.polyAt = polyAt;

  F.scene('neuron', {
    transIn: { type: 'fade', dur: 1.4 },
    init() {
      const r = F.rng(4321);
      dendrites = [];
      const sx = 760, sy = 540;
      for (let k = 0; k < 7; k++) {
        const ang = Math.PI + (k - 3) * 0.42 + (r() - 0.5) * 0.2;
        branch(dendrites, sx + Math.cos(ang) * 40, sy + Math.sin(ang) * 40, ang, 150 + r() * 60, 7, 0, r);
      }
      axon = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        axon.push([sx + 50 + u * 560, sy + Math.sin(u * 3.2) * 28 + u * 20]);
      }
      terminals = [];
      const end = axon[axon.length - 1];
      for (let k = 0; k < 5; k++) {
        const ang = (k - 2) * 0.35;
        const pts = [end];
        let [x, y] = end, a = ang;
        for (let i = 0; i < 5; i++) {
          a += (r() - 0.5) * 0.3;
          x += Math.cos(a) * 18; y += Math.sin(a) * 18;
          pts.push([x, y]);
        }
        terminals.push(pts);
      }
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b');
      const sepia = '232,220,196';
      ctx.fillStyle = '#0d0c0a';
      ctx.fillRect(0, 0, W, H);
      const bgl = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 900);
      bgl.addColorStop(0, 'rgba(70,64,54,0.55)');
      bgl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgl;
      ctx.fillRect(0, 0, W, H);

      const morph = F.smooth(F.prog(t, a.start + 4.0, a.start + 6.0));
      const bio = 1 - morph;
      const cam = 1.0 + 0.05 * F.prog(t, 0, S.dur);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(cam, cam); ctx.translate(-W / 2, -H / 2);

      // ---- biological neuron
      if (bio > 0.01) {
        ctx.save();
        ctx.globalAlpha = bio;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const grow = F.easeOut(F.prog(t, 0.2, 3.0));
        for (const d of dendrites) {
          const vis = F.clamp(grow * 4 - d.depth);
          if (vis <= 0) continue;
          const n = Math.max(2, Math.ceil(d.pts.length * vis));
          ctx.strokeStyle = `rgba(${sepia},${0.75 - d.depth * 0.1})`;
          ctx.lineWidth = d.width;
          ctx.beginPath();
          d.pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
        // axon with myelin
        const ag = F.easeOut(F.prog(t, 0.8, 3.4));
        const an = Math.max(2, Math.ceil(axon.length * ag));
        ctx.strokeStyle = `rgba(${sepia},0.7)`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        axon.slice(0, an).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        for (let i = 3; i + 3 < an; i += 5) {
          const [x0, y0] = axon[i], [x1, y1] = axon[i + 3];
          ctx.strokeStyle = `rgba(${sepia},0.55)`;
          ctx.lineWidth = 16;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        if (ag > 0.98) {
          for (const tp of terminals) {
            ctx.lineWidth = 3;
            ctx.strokeStyle = `rgba(${sepia},0.6)`;
            ctx.beginPath();
            tp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
            const e = tp[tp.length - 1];
            ctx.fillStyle = `rgba(${sepia},0.8)`;
            ctx.beginPath(); ctx.arc(e[0], e[1], 7, 0, F.TAU); ctx.fill();
          }
        }
        // soma
        const sg = ctx.createRadialGradient(760, 540, 5, 760, 540, 62);
        sg.addColorStop(0, 'rgba(250,240,220,0.95)');
        sg.addColorStop(1, 'rgba(160,150,130,0.6)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const an2 = (i / 40) * F.TAU, rr = 52 + Math.sin(an2 * 3 + 1) * 6 + Math.sin(an2 * 5) * 3;
          const x = 760 + Math.cos(an2) * rr, y = 540 + Math.sin(an2) * rr;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.fill();
        // spikes travelling in, then out along the axon
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const t0 = 2.2 + k * 1.1;
          for (let di = 0; di < dendrites.length; di += 3) {
            const d = dendrites[di];
            if (d.depth > 1) continue;
            const u = 1 - F.prog(t, t0, t0 + 0.6);
            if (u <= 0 || u >= 1) continue;
            const [x, y] = polyAt(d.pts, u);
            F.glow(ctx, x, y, 22, '255,245,220', 0.9 * bio);
          }
          const ua = F.prog(t, t0 + 0.6, t0 + 1.4);
          if (ua > 0 && ua < 1) {
            const [x, y] = polyAt(axon, ua);
            F.glow(ctx, x, y, 34, '255,245,220', bio);
          }
          F.glow(ctx, 760, 540, 150, '255,240,210', 0.5 * F.pulse(t, t0 + 0.62, 0.15) * bio);
        }
        ctx.restore();
      }

      // ---- McCulloch–Pitts unit
      if (morph > 0.01) {
        ctx.save();
        ctx.globalAlpha = morph;
        const draw = F.easeInOut(F.prog(t, a.start + 4.2, a.start + 6.6));
        const inputs = [[420, 400], [420, 540], [420, 680]];
        const ux = 860, uy = 540, ox = 1330;
        // input switch states cycle through a truth table (AND)
        const cycle = Math.floor(F.clamp(t - (a.start + 6.4), 0, 99) / 1.0);
        const table = [[1, 0, 1], [1, 1, 1], [0, 1, 1], [1, 1, 1]];
        const st = t < a.start + 6.4 ? [0, 0, 0] : table[Math.min(cycle, table.length - 1)];
        const fire = st[0] && st[1] && st[2];
        const born = F.smooth(F.prog(t, b.start - 0.1, b.start + 0.6));
        ctx.lineWidth = 3;
        inputs.forEach(([x, y], i) => {
          ctx.strokeStyle = `rgba(${sepia},0.8)`;
          ctx.beginPath();
          ctx.moveTo(x + 34, y);
          ctx.lineTo(F.lerp(x + 34, ux - 70, draw), F.lerp(y, uy + (i - 1) * 30, draw));
          ctx.stroke();
          ctx.fillStyle = st[i] ? 'rgba(255,244,220,0.95)' : 'rgba(40,36,30,1)';
          ctx.strokeStyle = `rgba(${sepia},0.9)`;
          ctx.beginPath(); ctx.arc(x, y, 34, 0, F.TAU); ctx.fill(); ctx.stroke();
          F.text(ctx, String(st[i]), x, y + 14, { family: 'Courier Prime', weight: 700, size: 40, color: st[i] ? '#1a1510' : '#e8dcc4', align: 'center' });
          F.text(ctx, `x${'₁₂₃'[i]}`, x - 80, y + 12, { family: 'Cormorant Garamond', style: 'italic', size: 40, color: '#e8dcc4', align: 'center' });
          F.text(ctx, 'w = 1', (x + ux) / 2 - 40, F.lerp(y, uy, 0.5) - 14 + (i - 1) * 10, { family: 'Courier Prime', size: 22, color: '#bfb49c', alpha: draw, align: 'center' });
        });
        // unit
        ctx.fillStyle = fire ? 'rgba(255,240,210,0.95)' : 'rgba(30,27,22,1)';
        ctx.strokeStyle = `rgba(${sepia},1)`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(ux, uy, 70, 0, F.TAU); ctx.fill(); ctx.stroke();
        F.text(ctx, 'Σ', ux, uy + 20, { family: 'Cormorant Garamond', weight: 600, size: 70, color: fire ? '#1a1510' : '#f0e6d2', align: 'center' });
        F.text(ctx, 'threshold θ = 3', ux, uy + 112, { family: 'Courier Prime', size: 24, color: '#bfb49c', alpha: draw, align: 'center' });
        // output
        ctx.strokeStyle = `rgba(${sepia},0.9)`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(ux + 70, uy); ctx.lineTo(F.lerp(ux + 70, ox - 40, draw), uy); ctx.stroke();
        ctx.fillStyle = fire ? '#fff6e0' : '#1e1b16';
        ctx.beginPath(); ctx.arc(ox, uy, 40, 0, F.TAU); ctx.fill(); ctx.stroke();
        F.text(ctx, fire ? '1' : '0', ox, uy + 15, { family: 'Courier Prime', weight: 700, size: 44, color: fire ? '#1a1510' : '#e8dcc4', align: 'center' });
        F.text(ctx, 'y', ox + 76, uy + 12, { family: 'Cormorant Garamond', style: 'italic', size: 44, color: '#e8dcc4', align: 'center' });
        F.text(ctx, 'AND', ux, uy - 110, { family: 'Montserrat', weight: 500, size: 24, spacing: 10, color: '#cfc3a8', alpha: draw, align: 'center' });
        ctx.globalCompositeOperation = 'lighter';
        if (fire) F.glow(ctx, ox, uy, 150, '255,240,210', 0.55);
        // "born": a ring of light expanding from the unit
        if (born > 0) {
          const rr = 70 + 500 * F.easeOut(F.prog(t, b.start, b.start + 1.8));
          ctx.strokeStyle = `rgba(255,240,215,${0.6 * (1 - F.prog(t, b.start, b.start + 1.8))})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(ux, uy, rr, 0, F.TAU); ctx.stroke();
          F.glow(ctx, ux, uy, 260, '255,236,200', 0.5 * born);
        }
        ctx.restore();
      }
      ctx.restore();

      F.caption(ctx, t, { t0: a.start + 0.2, t1: a.start + 5.6, year: '1943', title: 'WARREN McCULLOCH & WALTER PITTS', sub: 'A Logical Calculus of the Ideas Immanent in Nervous Activity', accent: '#d6cbb3', x: 1770, y: 238, align: 'right' });
      // black & white film look
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      F.oldFilm(ctx, t, 1, 17);
      F.vignette(ctx, 0.8);
      F.grain(ctx, t, 0.06);
    },
    cues(S) {
      const a = S.c('a'), b = S.c('b');
      const out = [{ t: 0, type: 'projector', dur: S.dur }];
      for (let k = 0; k < 3; k++) out.push({ t: 2.2 + k * 1.1 + 0.62, type: 'spike' });
      for (let k = 0; k < 4; k++) out.push({ t: a.start + 6.4 + k, type: 'relay' });
      out.push({ t: b.start, type: 'bloom' });
      return out;
    },
  });

  // ============================================================= TURING
  let turingPage;
  const PAGE_W = 1100, PAGE_H = 1500;
  F.scene('turing', {
    transIn: { type: 'fade', dur: 1.2 },
    init() {
      turingPage = paperCanvas(PAGE_W, PAGE_H, 50, (g) => {
        const mono = { family: 'Courier Prime', size: 26 };
        inkText(g, 'VOL. LIX. NO. 236.]', 90, 110, mono, 1);
        inkText(g, '[October, 1950', 760, 110, mono, 2);
        F.text(g, 'M I N D', PAGE_W / 2, 200, { family: 'Cormorant Garamond', weight: 600, size: 64, spacing: 6, color: '#1e1912', align: 'center' });
        F.text(g, 'A QUARTERLY REVIEW', PAGE_W / 2, 250, { family: 'Cormorant Garamond', weight: 400, size: 24, spacing: 6, color: '#2a241b', align: 'center' });
        F.text(g, 'OF', PAGE_W / 2, 282, { family: 'Cormorant Garamond', weight: 400, size: 18, spacing: 6, color: '#2a241b', align: 'center' });
        F.text(g, 'PSYCHOLOGY AND PHILOSOPHY', PAGE_W / 2, 314, { family: 'Cormorant Garamond', weight: 400, size: 24, spacing: 6, color: '#2a241b', align: 'center' });
        g.fillStyle = '#2a241b';
        g.fillRect(140, 350, PAGE_W - 280, 2);
        F.text(g, 'I.—COMPUTING MACHINERY AND', PAGE_W / 2, 440, { family: 'Cormorant Garamond', weight: 600, size: 44, spacing: 2, color: '#1b1610', align: 'center' });
        F.text(g, 'INTELLIGENCE', PAGE_W / 2, 494, { family: 'Cormorant Garamond', weight: 600, size: 44, spacing: 2, color: '#1b1610', align: 'center' });
        F.text(g, 'BY A. M. TURING', PAGE_W / 2, 560, { family: 'Cormorant Garamond', weight: 400, size: 28, spacing: 4, color: '#2a241b', align: 'center' });
        F.text(g, '1. The Imitation Game.', 110, 660, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 36, color: '#1b1610' });
        const body = [
          "I PROPOSE to consider the question, 'Can machines",
          "think?' This should begin with definitions of the",
          "meaning of the terms 'machine' and 'think'. The",
          'definitions might be framed so as to reflect so far',
          'as possible the normal use of the words, but this',
          'attitude is dangerous. If the meaning of the words',
          "'machine' and 'think' are to be found by examining",
          'how they are commonly used it is difficult to escape',
          'the conclusion that the meaning and the answer to',
          "the question, 'Can machines think?' is to be sought",
          'in a statistical survey such as a Gallup poll.',
        ];
        body.forEach((l, i) => F.text(g, l, 110, 730 + i * 50, { family: 'Cormorant Garamond', weight: 400, size: 34, color: '#231d15' }));
      });
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b');
      ctx.fillStyle = '#0e0b07';
      ctx.fillRect(0, 0, W, H);
      const pA = 1 - F.smooth(F.prog(t, b.start - 0.4, b.start + 0.6));
      if (pA > 0.01) {
        ctx.save();
        ctx.globalAlpha = pA;
        const lamp = ctx.createRadialGradient(W * 0.55, H * 0.45, 0, W * 0.55, H * 0.45, 1100);
        lamp.addColorStop(0, 'rgba(90,64,34,0.55)');
        lamp.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lamp;
        ctx.fillRect(0, 0, W, H);
        const k = F.easeInOut(F.prog(t, 0, b.start + 0.5));
        const scale = F.lerp(0.78, 1.05, k);
        const py = F.lerp(-80, -560, k);
        ctx.translate(W / 2 + 190, H / 2);
        ctx.rotate(-0.035 + 0.01 * k);
        ctx.scale(scale, scale);
        ctx.translate(-PAGE_W / 2, py);
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 60;
        ctx.drawImage(turingPage, 0, -300);
        ctx.shadowBlur = 0;
        // pencil underline under 'Can machines think?'
        const u = F.easeInOut(F.prog(t, a.start + 1.2, a.start + 2.4));
        if (u > 0) {
          ctx.strokeStyle = 'rgba(160,40,30,0.85)';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          ctx.beginPath();
          const y1 = 730 - 300 + 10;
          ctx.moveTo(612, y1);
          ctx.lineTo(F.lerp(612, 990, Math.min(1, u * 1.6)), y1 + 2);
          ctx.stroke();
          if (u > 0.62) {
            const y2 = 780 - 300 + 10;
            ctx.beginPath();
            ctx.moveTo(110, y2);
            ctx.lineTo(F.lerp(110, 190, (u - 0.62) / 0.38), y2 + 1);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      // ---- the imitation game
      const pB = F.smooth(F.prog(t, b.start - 0.2, b.start + 0.8));
      if (pB > 0.01) this.drawGame(ctx, t, b, pB);
      F.caption(ctx, t, { t0: a.start - 0.2, t1: b.start + 0.2, year: '1950', title: 'ALAN TURING', sub: 'Computing Machinery and Intelligence', accent: '#d9b36c' });
      F.oldFilm(ctx, t, 0.5, 29);
      F.vignette(ctx, 0.7);
      F.grain(ctx, t, 0.04);
    },
    drawGame(ctx, t, b, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      const glowBg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 900);
      glowBg.addColorStop(0, 'rgba(60,44,26,0.6)');
      glowBg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowBg;
      ctx.fillRect(0, 0, W, H);
      const panel = (x, y, w, h, label, lit) => {
        ctx.fillStyle = 'rgba(18,14,9,0.92)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = `rgba(230,200,150,${0.35 + 0.4 * lit})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        F.text(ctx, label, x + w / 2, y - 18, { family: 'Montserrat', weight: 500, size: 20, spacing: 8, color: '#d9c49a', align: 'center' });
      };
      // interrogator
      panel(170, 330, 700, 420, 'INTERROGATOR', 1);
      // A and B behind walls
      const flip = Math.floor((t - b.start) * 2.2) % 2;
      const q = F.prog(t, b.start + 2.6, b.start + 3.4);
      const labA = q > 0 ? '?' : flip ? 'HUMAN?' : 'MACHINE?';
      const labB = q > 0 ? '?' : flip ? 'MACHINE?' : 'HUMAN?';
      panel(1080, 300, 660, 200, 'A', 0.3);
      panel(1080, 580, 660, 200, 'B', 0.3);
      F.text(ctx, labA, 1410, 420, { family: 'Cinzel', weight: 600, size: 54, spacing: 6, color: '#f1dfb6', align: 'center', alpha: 0.9 });
      F.text(ctx, labB, 1410, 700, { family: 'Cinzel', weight: 600, size: 54, spacing: 6, color: '#f1dfb6', align: 'center', alpha: 0.9 });
      // wires with messages travelling
      ctx.strokeStyle = 'rgba(230,200,150,0.35)';
      ctx.setLineDash([6, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(870, 520); ctx.lineTo(1080, 400); ctx.moveTo(870, 560); ctx.lineTo(1080, 680); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const u = ((t - b.start) * 0.9 + k * 0.25) % 1;
        F.glow(ctx, F.lerp(870, 1080, u), F.lerp(520, 400, u), 16, '255,220,160', 0.8 * alpha);
        F.glow(ctx, F.lerp(1080, 870, u), F.lerp(680, 560, u), 16, '255,220,160', 0.8 * alpha);
      }
      ctx.globalCompositeOperation = 'source-over';
      // teletype dialogue (from Turing's paper)
      const mono = { family: 'Courier Prime', size: 29, color: '#efe2c4' };
      const q1 = this.tyQ || (this.tyQ = F.typer('Q: Please write me a sonnet on the subject of the Forth Bridge.', b.start + 0.4, 34, 71));
      const a1 = this.tyA || (this.tyA = F.typer('A: Count me out on this one. I never could write poetry.', q1.end + 0.5, 30, 72));
      const ql = F.wrap(ctx, q1.at(t), 630, mono), al = F.wrap(ctx, a1.at(t), 630, mono);
      ql.forEach((l, i) => F.text(ctx, l, 205, 400 + i * 42, { ...mono, color: '#efe2c4' }));
      al.forEach((l, i) => F.text(ctx, l, 205, 400 + (ql.length + 0.5 + i) * 42, { ...mono, color: '#ffd79a' }));
      ctx.restore();
    },
    cues(S) {
      const b = S.c('b');
      if (!this.tyQ) {
        this.tyQ = F.typer('Q: Please write me a sonnet on the subject of the Forth Bridge.', b.start + 0.4, 34, 71);
        this.tyA = F.typer('A: Count me out on this one. I never could write poetry.', this.tyQ.end + 0.5, 30, 72);
      }
      return [
        { t: 0, type: 'projector', dur: S.dur },
        { t: S.c('a').start + 1.2, type: 'pencil', dur: 1.2 },
        ...F.typerCues(this.tyQ, 'teletype', { gain: 0.45 }),
        ...F.typerCues(this.tyA, 'teletype', { gain: 0.45 }),
      ];
    },
  });

  // ========================================================== DARTMOUTH
  let dartPage;
  const DP_W = 1200, DP_H = 1500;
  const TITLE_Y = 330; // y of 'ON ARTIFICIAL INTELLIGENCE' within the page
  F.scene('dartmouth', {
    transIn: { type: 'fade', dur: 1.4 },
    init() {
      dartPage = paperCanvas(DP_W, DP_H, 90, (g) => {
        const T = { family: 'Courier Prime', weight: 700, size: 34 };
        const m = { family: 'Courier Prime', size: 27 };
        const center = (s, y, o, seed) => {
          F.setFont(g, o);
          const w = g.measureText(s).width;
          inkText(g, s, DP_W / 2 - w / 2, y, o, seed);
        };
        center('A PROPOSAL FOR THE', 200, T, 1);
        center('DARTMOUTH SUMMER RESEARCH PROJECT', 265, T, 2);
        center('ON ARTIFICIAL INTELLIGENCE', TITLE_Y, T, 3);
        const names = [
          'J. McCarthy, Dartmouth College',
          'M. L. Minsky, Harvard University',
          'N. Rochester, I.B.M. Corporation',
          'C. E. Shannon, Bell Telephone Laboratories',
        ];
        names.forEach((n, i) => inkText(g, n, 250, 440 + i * 44, m, 10 + i));
        inkText(g, 'August 31, 1955', 250, 660, m, 20);
        const body = [
          'We propose that a 2 month, 10 man study of',
          'artificial intelligence be carried out during the',
          'summer of 1956 at Dartmouth College in Hanover,',
          'New Hampshire. The study is to proceed on the basis',
          'of the conjecture that every aspect of learning or',
          'any other feature of intelligence can in principle',
          'be so precisely described that a machine can be',
          'made to simulate it.',
        ];
        body.forEach((l, i) => inkText(g, l, 150, 780 + i * 48, m, 30 + i));
      });
      // measure title position for the lift-off
      const c = F.canvas(10, 10).getContext('2d');
      this.titleW = F.measure(c, 'ON ARTIFICIAL INTELLIGENCE', { family: 'Courier Prime', weight: 700, size: 34 });
    },
    pageTransform(t, S) {
      const b = S.c('b');
      const k = F.easeInOut(F.prog(t, 0, b.start));
      return { scale: F.lerp(0.62, 1.0, k), px: W / 2, py: F.lerp(640, 760, k), rot: F.lerp(-0.06, -0.02, k) };
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d = S.c('d');
      // golden hour
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#2b1a0a');
      bg.addColorStop(1, '#0c0703');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const pageA = 1 - F.smooth(F.prog(t, b.start - 0.3, b.start + 0.9));
      const T = this.pageTransform(t, S);
      if (pageA > 0.01) {
        ctx.save();
        ctx.globalAlpha = pageA;
        ctx.translate(T.px, T.py);
        ctx.rotate(T.rot);
        ctx.scale(T.scale, T.scale);
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 70;
        ctx.drawImage(dartPage, -DP_W / 2, -TITLE_Y - 40);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      // light shafts through a window
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = 200 + i * 260 + Math.sin(t * 0.3 + i) * 20;
        const g = ctx.createLinearGradient(x, 0, x + 500, H);
        const aa = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 2);
        g.addColorStop(0, `rgba(255,190,110,${aa})`);
        g.addColorStop(1, 'rgba(255,190,110,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x + 90, 0); ctx.lineTo(x + 600, H); ctx.lineTo(x + 420, H);
        ctx.fill();
      }
      ctx.restore();
      F.motes(ctx, t, { n: 80, seed: 31, rgb: '255,210,150', alpha: 0.45, size: 3.2, speed: 6, rise: 0.3 });

      // ---- the name lifts off the page
      const lift = F.easeInOut(F.prog(t, b.start - 0.75, b.start + 0.9));
      const nameA = F.env(t, b.start - 0.75, b.start - 0.5, c.start - 0.6, c.start + 0.3);
      if (nameA > 0.01) {
        const sx = T.px, sy = T.py;
        const x = F.lerp(sx, W / 2, lift), y = F.lerp(sy, H / 2 + 10, lift);
        const size = F.lerp(34 * T.scale, 96, lift);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(T.rot * (1 - lift));
        const warm = F.smooth(lift);
        const fam = lift < 0.5 ? 'Courier Prime' : 'Cinzel';
        const fa = lift < 0.5 ? 1 - lift * 2 : (lift - 0.5) * 2;
        F.text(ctx, lift < 0.5 ? 'ARTIFICIAL INTELLIGENCE' : 'ARTIFICIAL INTELLIGENCE', 0, 0, {
          family: fam, weight: 700, size, spacing: lift < 0.5 ? 0 : 10 * lift,
          color: warm > 0.3 ? '#ffe2a8' : '#1d1812', alpha: nameA * (0.4 + 0.6 * fa), align: 'center',
          glow: 30 * warm, glowColor: 'rgba(255,190,90,0.8)',
        });
        ctx.restore();
        const fl = F.prog(t, b.start + 0.2, b.start + 2.2);
        if (fl > 0 && fl < 1) F.flare(ctx, F.lerp(W / 2 - 700, W / 2 + 700, F.easeInOut(fl)), H / 2 - 22, Math.sin(Math.PI * fl) * 0.8, '255,190,110', 1200);
      }
      // ---- the conjecture
      const qa = F.env(t, c.start - 0.2, c.start + 0.6, d.start - 0.5, d.start + 0.2);
      if (qa > 0.01) {
        const words = 'Every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it.'.split(' ');
        const o = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 58 };
        const lines = [];
        let line = [];
        for (const w of words) {
          line.push(w);
          if (F.measure(ctx, line.join(' '), o) > 1320) { line.pop(); lines.push(line); line = [w]; }
        }
        lines.push(line);
        let idx = 0;
        const perWord = (c.dur - 0.4) / words.length;
        lines.forEach((ln, li) => {
          const full = F.measure(ctx, ln.join(' '), o);
          let x = W / 2 - full / 2;
          for (const w of ln) {
            const wa = F.smooth(F.prog(t, c.start + idx * perWord, c.start + idx * perWord + 0.45));
            const s = (idx === 0 ? '“' : '') + w + (idx === words.length - 1 ? '”' : '');
            F.text(ctx, s, x, 430 + li * 80 + (1 - wa) * 8, { ...o, color: '#fbecc8', alpha: qa * wa });
            x += F.measure(ctx, s + ' ', o);
            idx++;
          }
        });
        F.text(ctx, '— Dartmouth proposal, 1955', W / 2, 430 + lines.length * 80 + 30, {
          family: 'Montserrat', weight: 300, size: 24, spacing: 6, color: '#c9ad7a', alpha: qa * F.smooth(F.prog(t, c.start + 2, c.start + 3)), align: 'center',
        });
      }
      // ---- "a 2 month, 10 man study"
      const da = F.env(t, d.start - 0.3, d.start + 0.5, S.dur - 0.3, S.dur + 0.6);
      if (da > 0.01) {
        const o = { family: 'Courier Prime', size: 50 };
        const ty = this.tyD || (this.tyD = F.typer('a 2 month, 10 man study', d.start - 0.1, 13, 41));
        const s = ty.at(t);
        const fullW = F.measure(ctx, ty.text, o);
        const x0 = W / 2 - fullW / 2;
        F.text(ctx, s, x0, 560, { ...o, color: '#f3e6c8', alpha: da });
        // red pencil ellipse around "2 month"
        const k = F.easeInOut(F.prog(t, ty.end + 0.2, ty.end + 1.1));
        if (k > 0) {
          const pre = F.measure(ctx, 'a ', o), mw = F.measure(ctx, '2 month', o);
          ctx.save();
          ctx.globalAlpha = da;
          ctx.strokeStyle = 'rgba(220,70,50,0.9)';
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.ellipse(x0 + pre + mw / 2, 543, mw / 2 + 26, 46, -0.05, -Math.PI * 0.6, -Math.PI * 0.6 + F.TAU * 1.08 * k);
          ctx.stroke();
          ctx.restore();
        }
        F.text(ctx, 'SUMMER 1956', W / 2, 700, { family: 'Montserrat', weight: 500, size: 22, spacing: 12, color: '#c9ad7a', alpha: da * F.smooth(F.prog(t, ty.end, ty.end + 1)), align: 'center' });
      }
      F.caption(ctx, t, { t0: a.start - 0.2, t1: b.start - 0.4, year: '1956', title: 'DARTMOUTH COLLEGE · HANOVER, NEW HAMPSHIRE', sub: 'John McCarthy · Marvin Minsky · Nathaniel Rochester · Claude Shannon', accent: '#e2b56c' });
      F.vignette(ctx, 0.7);
      F.grain(ctx, t, 0.03);
    },
    cues(S) {
      const b = S.c('b'), d = S.c('d');
      if (!this.tyD) this.tyD = F.typer('a 2 month, 10 man study', d.start - 0.1, 13, 41);
      return [
        { t: 0, type: 'summer', dur: b.start },
        { t: b.start - 1.35, type: 'riser', dur: 0.8 },
        { t: b.start - 0.55, type: 'impact', size: 0.8 },
        { t: b.start + 0.2, type: 'shimmer', dur: 2.0 },
        ...F.typerCues(this.tyD, 'key', { heavy: 0 }),
        { t: this.tyD.end + 0.2, type: 'pencil', dur: 0.9 },
      ];
    },
  });
})();

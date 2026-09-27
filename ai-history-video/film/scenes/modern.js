/* 1997–2016: Deep Blue, the deep learning revolution, AlphaGo. */
(function () {
  'use strict';
  const { W, H } = F;

  /** Minimal perspective camera: yaw around Y, pitch around X. */
  const camera = (yaw, pitch, dist, f = 1100, cx = W / 2, cy = H / 2) => (x, y, z) => {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw);
    let X = x * cyw - z * syw, Z = x * syw + z * cyw, Y = y;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const Y2 = Y * cp + Z * sp, Z2 = -Y * sp + Z * cp + dist;
    const s = f / Z2;
    return [cx + X * s, cy - Y2 * s, s, Z2];
  };
  F.camera3d = camera;

  // ============================================================ DEEP BLUE
  const PIECES = [
    // [glyph, file, rank, white]
    ['♔', 6, 0, 1], ['♕', 3, 0, 1], ['♖', 0, 0, 1], ['♖', 5, 0, 1], ['♗', 2, 3, 1], ['♘', 5, 2, 1],
    ['♙', 0, 1, 1], ['♙', 1, 1, 1], ['♙', 2, 2, 1], ['♙', 3, 3, 1], ['♙', 5, 1, 1], ['♙', 6, 1, 1], ['♙', 7, 1, 1],
    ['♚', 6, 7, 0], ['♛', 3, 7, 0], ['♜', 0, 7, 0], ['♜', 5, 7, 0], ['♝', 1, 6, 0], ['♞', 5, 5, 0],
    ['♟', 0, 6, 0], ['♟', 1, 5, 0], ['♟', 2, 4, 0], ['♟', 4, 5, 0], ['♟', 5, 6, 0], ['♟', 6, 6, 0], ['♟', 7, 6, 0],
  ];
  let tree;

  F.scene('deepblue', {
    transIn: { type: 'fade', dur: 1.2 },
    init(S) {
      // search tree rooted above the knight's destination square
      const r = F.rng(1997);
      tree = [];
      const grow = (x, y, z, depth, parentIdx, ang0, spread) => {
        if (depth > 4) return;
        const n = depth === 1 ? 9 : depth === 2 ? 6 : depth === 3 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const ang = ang0 + (i - (n - 1) / 2) * spread / n + (r() - 0.5) * 0.2;
          const len = 1.25 - depth * 0.15;
          const x1 = x + Math.cos(ang) * len * (0.8 + r() * 0.4);
          const z1 = z + Math.sin(ang) * len * (0.8 + r() * 0.4);
          const y1 = y + 0.9 + r() * 0.3;
          const idx = tree.length;
          tree.push({ x0: x, y0: y, z0: z, x1, y1, z1, depth, birth: depth - 1 + r() * 0.8 });
          grow(x1, y1, z1, depth + 1, idx, ang, spread * 0.55);
        }
      };
      grow(6 - 3.5, 0.2, 4 - 3.5, 1, -1, 0, F.TAU);
      const a = S.c('a');
      this.moveT = a.start + 2.6;
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b1 = S.c('b1'), b2 = S.c('b2');
      const bg = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, 1100);
      bg.addColorStop(0, '#0d2d6e');
      bg.addColorStop(0.55, '#061433');
      bg.addColorStop(1, '#01040c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const lonely = F.smooth(F.prog(t, b2.start - 0.2, b2.start + 1.6));
      if (lonely > 0) {
        ctx.fillStyle = `rgba(0,0,0,${0.7 * lonely})`;
        ctx.fillRect(0, 0, W, H);
      }
      const yaw = -0.5 + t * 0.045;
      const dist = F.lerp(11.5, 13.5, F.smooth(F.prog(t, b2.start - 0.5, S.dur))) - 1.2 * F.smooth(F.prog(t, 0, b1.start));
      const P = camera(yaw, 0.74, dist + 3.2, 1150, W / 2, H / 2 + 5);
      // board
      const sq = (i, j) => [P(i - 4, 0, j - 4), P(i - 3, 0, j - 4), P(i - 3, 0, j - 3), P(i - 4, 0, j - 3)];
      for (let j = 0; j < 8; j++) {
        for (let i = 0; i < 8; i++) {
          const q = sq(i, j);
          ctx.beginPath();
          q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = (i + j) % 2 === 0 ? 'rgba(20,45,110,0.9)' : 'rgba(110,160,255,0.42)';
          ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(140,200,255,0.55)';
      ctx.lineWidth = 1.2;
      for (let k = 0; k <= 8; k++) {
        const [x0, y0] = P(k - 4, 0, -4), [x1, y1] = P(k - 4, 0, 4);
        const [x2, y2] = P(-4, 0, k - 4), [x3, y3] = P(4, 0, k - 4);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.moveTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
      }
      // pieces (knight f3 -> g5 at moveT)
      const mv = F.easeInOut(F.prog(t, this.moveT, this.moveT + 0.8));
      const items = PIECES.map(([g, f, rk, white], idx) => {
        let x = f - 3.5, z = rk - 3.5, y = 0;
        if (idx === 5) {
          x = F.lerp(5 - 3.5, 6 - 3.5, mv);
          z = F.lerp(2 - 3.5, 4 - 3.5, mv);
          y = Math.sin(Math.PI * mv) * 0.9;
        }
        const p = P(x, y, z);
        return { g, white, p };
      }).sort((u, v) => v.p[3] - u.p[3]);
      for (const { g, white, p } of items) {
        const [x, y, s] = p;
        const size = s * 0.95;
        ctx.save();
        ctx.font = `${size}px "DejaVu Sans"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        // reflection
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, -0.45);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = white ? '#cfe0ff' : '#5f8fe0';
        ctx.fillText(g, 0, size * 0.12);
        ctx.restore();
        ctx.shadowColor = white ? 'rgba(170,210,255,0.9)' : 'rgba(80,150,255,0.9)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = white ? '#eef4ff' : '#0b1a3d';
        ctx.fillText(g, x, y + size * 0.1);
        if (!white) {
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(140,190,255,0.9)';
          ctx.strokeText(g, x, y + size * 0.1);
        }
        ctx.restore();
      }
      // search tree
      const tp = (t - (b1.start - 0.2)) * 2.4;
      const treeA = 1 - F.smooth(F.prog(t, b2.start - 0.3, b2.start + 0.8));
      if (tp > 0 && treeA > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const e of tree) {
          const k = F.clamp(tp - e.birth);
          if (k <= 0) continue;
          const [x0, y0] = P(e.x0, e.y0, e.z0);
          const [x1, y1] = P(F.lerp(e.x0, e.x1, k), F.lerp(e.y0, e.y1, k), F.lerp(e.z0, e.z1, k));
          ctx.strokeStyle = `rgba(120,200,255,${(0.5 - e.depth * 0.08) * treeA})`;
          ctx.lineWidth = 2.2 - e.depth * 0.35;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          if (k >= 1) F.glow(ctx, x1, y1, 7 - e.depth, '170,225,255', 0.8 * treeA);
        }
        ctx.restore();
      }
      // counter
      const cA = F.env(t, b1.start - 0.1, b1.start + 0.5, b2.start - 0.2, b2.start + 0.4);
      if (cA > 0.01) {
        const n = Math.floor(Math.max(0, t - b1.start) * 200000000);
        F.text(ctx, n.toLocaleString('en-US'), W / 2, 250, { family: 'IBM Plex Mono', weight: 500, size: 64, color: '#dff0ff', alpha: cA, align: 'center', glow: 22, glowColor: 'rgba(90,170,255,0.9)' });
        F.text(ctx, 'POSITIONS EVALUATED · 200 MILLION PER SECOND', W / 2, 296, { family: 'Montserrat', weight: 500, size: 20, spacing: 8, color: '#8fb8ec', alpha: cA, align: 'center' });
      }
      // scoreboard
      const sA = F.env(t, a.start + 4.0, a.start + 4.8, b1.start - 0.4, b1.start + 0.1);
      if (sA > 0.01) {
        F.text(ctx, 'DEEP BLUE  3½ – 2½  KASPAROV', W / 2, 262, { family: 'Cinzel', weight: 600, size: 58, spacing: 8, color: '#eaf2ff', alpha: sA, align: 'center', glow: 24, glowColor: 'rgba(90,160,255,0.9)' });
        F.text(ctx, 'MAY 11, 1997 · NEW YORK', W / 2, 306, { family: 'Montserrat', weight: 400, size: 20, spacing: 10, color: '#8fb8ec', alpha: sA, align: 'center' });
      }
      F.caption(ctx, t, { t0: a.start - 0.2, t1: a.start + 3.8, year: '1997', title: 'IBM DEEP BLUE DEFEATS GARRY KASPAROV', sub: 'The first computer to beat a reigning world champion in a match', accent: '#7fb2ff', x: 150, y: 250 });
      F.vignette(ctx, 0.75);
      // clean digital look from here on: no film grain
    },
    cues(S) {
      const b1 = S.c('b1'), b2 = S.c('b2');
      return [
        { t: this.moveT, type: 'chess_lift' },
        { t: this.moveT + 0.8, type: 'chess' },
        { t: S.c('a').start + 4.0, type: 'boom', size: 0.3 },
        { t: b1.start - 0.2, type: 'datastream', dur: b2.start - b1.start + 0.2 },
        { t: b2.start - 0.2, type: 'powerdown' },
      ];
    },
  });

  // ======================================================== DEEP LEARNING
  const EMOJI = ['🐱', '🐶', '🚗', '🌸', '🍎', '🐦', '🏠', '✈️', '🐟', '🌲', '🚲', '🍕', '🐘', '🌻', '⛵', '🐢', '🎸', '🦋', '🍌', '🐎'];
  const LABELS = ['cat', 'dog', 'car', 'flower', 'apple', 'bird', 'house', 'plane', 'fish', 'tree', 'bicycle', 'pizza', 'elephant', 'sunflower', 'boat', 'turtle', 'guitar', 'butterfly', 'banana', 'horse'];
  const ERR = [[2010, 28.2], [2011, 25.8], [2012, 15.3], [2013, 11.7], [2014, 6.7], [2015, 3.6]];
  let tiles, cloud;

  F.scene('deeplearning', {
    transIn: { type: 'fade', dur: 1.0 },
    init() {
      // emoji tiles, pre-rendered once
      tiles = EMOJI.map((e, i) => {
        const c = F.canvas(96, 112);
        const g = c.getContext('2d');
        const hue = (i * 47) % 360;
        g.fillStyle = `hsl(${hue},45%,22%)`;
        g.fillRect(0, 0, 96, 112);
        g.font = '58px "Noto Color Emoji"';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(e, 48, 46);
        g.font = '500 13px Montserrat';
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.fillText(LABELS[i], 48, 98);
        return c;
      });
      // neural cloud for the finale of the scene
      const r = F.rng(2012);
      cloud = [];
      for (let i = 0; i < 700; i++) {
        const u = r() * 2 - 1, th = r() * F.TAU, rad = Math.pow(r(), 0.5);
        const s = Math.sqrt(1 - u * u);
        cloud.push({ x: s * Math.cos(th) * rad * 5.4, y: u * rad * 2.8, z: s * Math.sin(th) * rad * 5.4, c: r() });
      }
      this.links = [];
      for (let i = 0; i < cloud.length; i++) {
        for (let k = 0; k < 2; k++) {
          const j = Math.floor(r() * cloud.length);
          const d = Math.hypot(cloud[i].x - cloud[j].x, cloud[i].y - cloud[j].y, cloud[i].z - cloud[j].z);
          if (d < 2.6) this.links.push([i, j]);
        }
      }
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b1 = S.c('b1'), b2 = S.c('b2'), b3 = S.c('b3'), c = S.c('c'), d = S.c('d');
      ctx.fillStyle = '#03040a';
      ctx.fillRect(0, 0, W, H);
      // ---- three forces
      const orbA = F.env(t, 0, 0.6, b1.start + 0.2, b1.start + 0.8);
      if (orbA > 0.01) {
        const conv = F.easeInOut(F.prog(t, a.start, a.end + 0.4));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const cols = ['90,200,255', '255,90,200', '255,200,90'];
        for (let k = 0; k < 3; k++) {
          const ang = k * F.TAU / 3 + t * 1.5;
          const rad = F.lerp(520, 20, conv);
          for (let tr = 0; tr < 14; tr++) {
            const tt = t - tr * 0.03;
            const ang2 = k * F.TAU / 3 + tt * 1.5;
            const rad2 = F.lerp(520, 20, F.easeInOut(F.prog(tt, a.start, a.end + 0.4)));
            F.glow(ctx, W / 2 + Math.cos(ang2) * rad2, H / 2 + Math.sin(ang2) * rad2 * 0.55, 30 - tr * 1.5, cols[k], orbA * 0.35);
          }
          F.glow(ctx, W / 2 + Math.cos(ang) * rad, H / 2 + Math.sin(ang) * rad * 0.55, 70, cols[k], orbA);
        }
        F.glow(ctx, W / 2, H / 2, 400, '255,255,255', 0.5 * F.pulse(t, a.end + 0.4, 0.25));
        ctx.restore();
      }
      // ---- DATA: ocean of labelled images
      const dA = F.env(t, b1.start - 0.1, b1.start + 0.5, b2.start - 0.2, b2.start + 0.3);
      if (dA > 0.01) {
        ctx.save();
        ctx.globalAlpha = dA;
        const sc = 0.9, tw = 96 * sc + 8, th = 112 * sc + 8;
        const off = (t - b1.start) * 90;
        ctx.translate(W / 2, H / 2);
        ctx.rotate(-0.12);
        const zoom = 1.15 - 0.25 * F.prog(t, b1.start, b2.start);
        ctx.scale(zoom, zoom);
        for (let j = -7; j <= 7; j++) {
          for (let i = -13; i <= 13; i++) {
            const k = Math.abs((i * 7 + j * 13 + 400) % tiles.length);
            const x = i * tw + ((off + j * 37) % tw), y = j * th;
            ctx.drawImage(tiles[k], x - tw / 2, y - th / 2, 96 * sc, 112 * sc);
          }
        }
        ctx.restore();
        this.label(ctx, 'DATA', 'Billions of images and words, shared online', dA);
      }
      // ---- COMPUTE: a GPU die
      const gA = F.env(t, b2.start - 0.1, b2.start + 0.4, b3.start - 0.2, b3.start + 0.3);
      if (gA > 0.01) {
        ctx.save();
        ctx.globalAlpha = gA;
        const gw = 900, gh = 560, gx = W / 2 - gw / 2, gy = H / 2 - gh / 2 - 10;
        ctx.fillStyle = '#0d1a14';
        ctx.fillRect(gx - 30, gy - 30, gw + 60, gh + 60);
        ctx.strokeStyle = '#3c6b54';
        ctx.lineWidth = 3;
        ctx.strokeRect(gx - 30, gy - 30, gw + 60, gh + 60);
        const cols = 48, rows = 30, cw = gw / cols, ch = gh / rows;
        const tt = t - b2.start;
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            const dx = i - cols / 2, dy = j - rows / 2;
            const wave = Math.sin(Math.hypot(dx, dy) * 0.5 - tt * 9) * 0.5 + 0.5;
            const heat = wave * F.smooth(F.prog(tt, 0, 0.8));
            ctx.fillStyle = `rgb(${30 + 225 * heat},${60 + 150 * heat * heat},${40 + 60 * heat * heat * heat})`;
            ctx.fillRect(gx + i * cw + 1, gy + j * ch + 1, cw - 2, ch - 2);
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, W / 2, H / 2, 600, '255,140,60', 0.25 * gA);
        ctx.restore();
        this.label(ctx, 'COMPUTE', 'Graphics chips: thousands of cores working at once', gA);
      }
      // ---- DEPTH: a corridor of layers
      const lA = F.env(t, b3.start - 0.1, b3.start + 0.4, c.start - 0.2, c.start + 0.3);
      if (lA > 0.01) {
        ctx.save();
        ctx.globalAlpha = lA;
        const P = camera(0.35 + (t - b3.start) * 0.05, 0.12, 9, 900);
        const layers = 22;
        const fly = (t - b3.start) * 1.6;
        for (let k = layers - 1; k >= 0; k--) {
          const z = k * 1.2 - (fly % 1.2) - 3;
          if (z < -8) continue;
          const corners = [P(-2.4, -1.5, z), P(2.4, -1.5, z), P(2.4, 1.5, z), P(-2.4, 1.5, z)];
          if (corners.some((p) => p[3] <= 0.5)) continue;
          const fade = F.clamp(1 - k / layers);
          ctx.beginPath();
          corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fillStyle = `rgba(80,140,255,${0.05 * fade})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(130,200,255,${0.6 * fade})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          // neurons on the layer
          ctx.fillStyle = `rgba(200,235,255,${0.7 * fade})`;
          for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
            const [x, y, s] = P(-2 + i * 0.8, -1.1 + j * 0.73, z);
            ctx.beginPath(); ctx.arc(x, y, Math.max(1, s * 0.05), 0, F.TAU); ctx.fill();
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 12; k++) {
          const z = ((k * 1.7 - fly * 3.5) % 26 + 26) % 26 - 3;
          const [x, y] = P(Math.sin(k * 2.1) * 1.6, Math.cos(k * 1.3) * 1.0, z);
          F.glow(ctx, x, y, 26, '160,220,255', 0.8 * lA);
        }
        ctx.restore();
        this.label(ctx, 'DEPTH', 'Networks with many layers, stacked deep', lA);
      }
      // ---- ImageNet chart
      const cA = F.env(t, c.start - 0.1, c.start + 0.6, d.end - 0.25, d.end + 0.05);
      if (cA > 0.01) this.drawChart(ctx, t, c, cA);
      // ---- revolution: neural cloud bursts out
      const nA = F.smooth(F.prog(t, d.end - 0.1, d.end + 0.4));
      if (nA > 0.01) {
        const burst = F.easeOutExpo(F.prog(t, d.end - 0.1, d.end + 1.6));
        const P = camera(t * 0.25, 0.25 + 0.1 * Math.sin(t * 0.3), F.lerp(30, 9.5, burst), 1000);
        const pts = cloud.map((p) => P(p.x * (0.3 + 0.7 * burst), p.y * (0.3 + 0.7 * burst), p.z * (0.3 + 0.7 * burst)));
        ctx.save();
        ctx.globalAlpha = nA;
        ctx.lineWidth = 1;
        for (const [i, j] of this.links) {
          const [x0, y0] = pts[i], [x1, y1] = pts[j];
          ctx.strokeStyle = cloud[i].c > 0.5 ? 'rgba(120,200,255,0.3)' : 'rgba(255,120,220,0.26)';
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.globalCompositeOperation = 'lighter';
        pts.forEach(([x, y, s], i) => {
          const tw = 0.6 + 0.4 * Math.sin(t * 5 + i);
          F.glow(ctx, x, y, s * 0.16 + 5, cloud[i].c > 0.5 ? '130,210,255' : '255,130,225', 0.95 * tw * nA);
        });
        // signals racing along links
        for (let k = 0; k < 140; k++) {
          const [i, j] = this.links[(k * 37) % this.links.length];
          const u = ((t * 1.3 + k * 0.137) % 1);
          F.glow(ctx, F.lerp(pts[i][0], pts[j][0], u), F.lerp(pts[i][1], pts[j][1], u), 12, '255,255,255', 0.9 * nA);
        }
        F.glow(ctx, W / 2, H / 2, 700, '120,140,255', 0.22 * nA);
        F.glow(ctx, W / 2, H / 2, 900, '255,255,255', 0.6 * F.pulse(t, d.end, 0.2));
        ctx.restore();
      }
      F.vignette(ctx, 0.6);
      // clean digital look from here on: no film grain
    },
    label(ctx, word, sub, alpha) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${0.55 * alpha})`;
      ctx.fillRect(0, 780, W, 162);
      ctx.restore();
      F.text(ctx, word, W / 2, 858, { family: 'Cinzel', weight: 600, size: 64, spacing: 22, color: '#ffffff', alpha, align: 'center', glow: 20, glowColor: 'rgba(120,200,255,0.9)' });
      F.text(ctx, sub, W / 2, 906, { family: 'Montserrat', weight: 400, size: 22, spacing: 4, color: '#bcd6ee', alpha: alpha * 0.9, align: 'center' });
    },
    drawChart(ctx, t, c, alpha) {
      const x0 = 480, x1 = 1440, yb = 780, yt = 300, maxE = 30;
      const Y = (e) => yb - (yb - yt) * (e / maxE);
      ctx.save();
      ctx.globalAlpha = alpha;
      F.text(ctx, 'IMAGENET CHALLENGE · TOP-5 ERROR RATE', W / 2, 238, { family: 'Montserrat', weight: 500, size: 22, spacing: 8, color: '#9fc6ea', align: 'center' });
      ctx.strokeStyle = 'rgba(160,200,240,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.stroke();
      // human level
      const hA = F.smooth(F.prog(t, c.start + 4.6, c.start + 5.4));
      ctx.setLineDash([10, 10]);
      ctx.strokeStyle = `rgba(255,220,150,${0.8 * hA})`;
      ctx.beginPath(); ctx.moveTo(x0, Y(5.1)); ctx.lineTo(x1, Y(5.1)); ctx.stroke();
      ctx.setLineDash([]);
      F.text(ctx, 'HUMAN ≈ 5%', x1 + 16, Y(5.1) + 8, { family: 'Montserrat', weight: 500, size: 18, spacing: 4, color: '#ffdca0', alpha: hA * alpha });
      const bw = 110, gap = (x1 - x0 - bw * ERR.length) / (ERR.length + 1);
      const appear = [0.3, 0.9, 2.0, 4.0, 4.4, 4.8];
      ERR.forEach(([year, e], i) => {
        const k = F.easeOutBack(F.prog(t, c.start + appear[i], c.start + appear[i] + 0.55), i === 2 ? 1.2 : 0.6);
        if (k <= 0) return;
        const x = x0 + gap + i * (bw + gap);
        const hgt = (yb - Y(e)) * k;
        const hero = i === 2;
        const g = ctx.createLinearGradient(0, yb - hgt, 0, yb);
        g.addColorStop(0, hero ? '#ffd27a' : i > 2 ? '#6fd1ff' : '#8aa0b8');
        g.addColorStop(1, hero ? '#ff7a3c' : i > 2 ? '#1f6fae' : '#3a4c60');
        ctx.fillStyle = g;
        ctx.fillRect(x, yb - hgt, bw, hgt);
        F.text(ctx, String(year), x + bw / 2, yb + 34, { family: 'Montserrat', weight: 500, size: 20, color: '#c7d9ea', align: 'center' });
        F.text(ctx, e.toFixed(1) + '%', x + bw / 2, yb - hgt - 14, { family: 'IBM Plex Mono', weight: 500, size: 24, color: '#ffffff', alpha: F.clamp(k), align: 'center' });
        if (hero) {
          F.text(ctx, 'ALEXNET', x + bw / 2, yb - hgt - 56, { family: 'Montserrat', weight: 600, size: 22, spacing: 6, color: '#ffc46b', alpha: F.clamp(k), align: 'center' });
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          F.glow(ctx, x + bw / 2, yb - hgt, 220, '255,170,80', 0.5 * F.pulse(t, c.start + appear[i] + 0.3, 0.4) + 0.12);
          ctx.restore();
        }
      });
      ctx.restore();
      F.caption(ctx, t, { t0: c.start + 1.8, t1: c.end + 0.6, year: '2012', title: 'KRIZHEVSKY, SUTSKEVER & HINTON · ALEXNET', sub: 'ImageNet: 14 million labeled images, led by Fei-Fei Li', accent: '#ffc46b', x: 150, y: 846 });
    },
    cues(S) {
      const a = S.c('a'), b1 = S.c('b1'), b2 = S.c('b2'), b3 = S.c('b3'), c = S.c('c'), d = S.c('d');
      return [
        { t: a.start, type: 'riser', dur: a.end + 0.4 - a.start },
        { t: a.end + 0.4, type: 'impact', size: 0.6 },
        { t: b1.start, type: 'whoosh', dur: 0.8 },
        { t: b2.start, type: 'whoosh', dur: 0.8 },
        { t: b2.start, type: 'gpu', dur: b3.start - b2.start },
        { t: b3.start, type: 'whoosh', dur: 0.8 },
        { t: c.start + 2.0, type: 'boom', size: 0.35 },
        { t: d.start - 0.3, type: 'riser', dur: d.end - d.start + 0.28 },
        { t: d.end + 0.05, type: 'impact', size: 1.0 },
      ];
    },
  });

  // ============================================================= ALPHAGO
  const MOVES = [
    [15, 3], [3, 15], [16, 15], [3, 3], [14, 16], [2, 5], [5, 2], [13, 2], [15, 5], [9, 3],
    [2, 10], [5, 16], [10, 15], [15, 10], [16, 12], [16, 8], [5, 5], [6, 7], [7, 4], [4, 8],
    [14, 7], [15, 8], [4, 12], [7, 13], [8, 16], [3, 13], [9, 12], [11, 11], [12, 5], [11, 3],
    [13, 13], [15, 12], [17, 13], [9, 8], [7, 10], [12, 9],
  ];
  const M37 = [14, 9];
  let woodC, starsA;

  F.scene('alphago', {
    transIn: { type: 'fade', dur: 1.2 },
    init(S) {
      const bw = 1000;
      woodC = F.canvas(bw, bw);
      const g = woodC.getContext('2d');
      const grd = g.createLinearGradient(0, 0, bw, bw);
      grd.addColorStop(0, '#e2b56e');
      grd.addColorStop(1, '#b88142');
      g.fillStyle = grd;
      g.fillRect(0, 0, bw, bw);
      const r = F.rng(19);
      for (let i = 0; i < 160; i++) {
        g.strokeStyle = `rgba(${r() < 0.5 ? '120,70,20' : '255,220,160'},${0.05 + r() * 0.08})`;
        g.lineWidth = 1 + r() * 3;
        g.beginPath();
        const y = r() * bw;
        g.moveTo(0, y);
        for (let x = 0; x <= bw; x += 50) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 8 + (r() - 0.5) * 3);
        g.stroke();
      }
      const m = 70, step = (bw - 2 * m) / 18;
      g.strokeStyle = 'rgba(40,24,8,0.85)';
      g.lineWidth = 2;
      for (let k = 0; k < 19; k++) {
        g.beginPath(); g.moveTo(m, m + k * step); g.lineTo(bw - m, m + k * step); g.stroke();
        g.beginPath(); g.moveTo(m + k * step, m); g.lineTo(m + k * step, bw - m); g.stroke();
      }
      g.fillStyle = 'rgba(40,24,8,0.95)';
      for (const i of [3, 9, 15]) for (const j of [3, 9, 15]) { g.beginPath(); g.arc(m + i * step, m + j * step, 7, 0, F.TAU); g.fill(); }
      this.m = m; this.step = step; this.bw = bw;
      const a = S.c('a');
      this.moveTimes = MOVES.map((_, i) => a.start - 0.4 + i * 0.17);
      const rs = F.rng(170);
      starsA = Array.from({ length: 900 }, () => ({ x: rs() * W, y: rs() * H, s: rs(), tw: rs() * 6 }));
    },
    boardXY(i, j) { return [this.m + i * this.step - this.bw / 2, this.m + j * this.step - this.bw / 2]; },
    stone(ctx, x, y, black, r, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(x + r * 0.12, y + r * 0.18, r, r * 0.95, 0, 0, F.TAU); ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      if (black) { g.addColorStop(0, '#6b6b6b'); g.addColorStop(0.4, '#1d1d1d'); g.addColorStop(1, '#030303'); }
      else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#e9e6de'); g.addColorStop(1, '#b8b2a6'); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, F.TAU); ctx.fill();
      ctx.restore();
    },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d1 = S.c('d1'), d2 = S.c('d2'), d3 = S.c('d3');
      ctx.fillStyle = '#070503';
      ctx.fillRect(0, 0, W, H);
      const boardA = 1 - F.env(t, b.start - 0.4, b.start + 0.6, c.start - 0.7, c.start + 0.1);
      // camera: wide during a, close-up on move 37 during c/d
      const close = F.easeInOut(F.prog(t, c.start - 0.6, c.start + 2.2));
      const [mx, my] = this.boardXY(M37[0], M37[1]);
      const zoom = F.lerp(0.62 + 0.04 * F.prog(t, 0, b.start), 1.35, close) * (1 - 0.1 * F.smooth(F.prog(t, d3.start - 0.2, d3.end + 0.5)));
      const rot = F.lerp(-0.18 + 0.03 * t, -0.08, close);
      if (boardA > 0.01) {
        ctx.save();
        ctx.globalAlpha = boardA;
        const spot = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 950);
        spot.addColorStop(0, 'rgba(255,200,130,0.22)');
        spot.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, W, H);
        ctx.translate(W / 2, H / 2 + 10);
        ctx.scale(zoom, zoom * 0.86);
        ctx.rotate(rot);
        ctx.translate(-F.lerp(0, mx + this.step * 1.2, close), -F.lerp(0, my, close));
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 80;
        ctx.drawImage(woodC, -this.bw / 2, -this.bw / 2);
        ctx.shadowBlur = 0;
        const R = this.step * 0.47;
        const dim = 1 - 0.55 * F.env(t, c.start + 0.8, c.start + 1.6, d3.start, d3.start + 1.0);
        MOVES.forEach(([i, j], k) => {
          const tt = this.moveTimes[k];
          if (t < tt) return;
          const drop = F.easeOut(F.prog(t, tt, tt + 0.12));
          const [x, y] = this.boardXY(i, j);
          this.stone(ctx, x, y - (1 - drop) * 10, k % 2 === 0, R, dim);
        });
        // move 37
        const t37 = c.start + 1.9;
        if (t >= t37 - 0.9) {
          const k = F.easeIn(F.prog(t, t37 - 0.9, t37));
          const lift = (1 - k) * 160;
          this.stone(ctx, mx, my - lift, true, R * (1 + (1 - k) * 0.6), F.smooth(F.prog(t, t37 - 0.9, t37 - 0.5)));
          if (t >= t37) {
            const u = F.prog(t, t37, t37 + 1.6);
            ctx.strokeStyle = `rgba(255,210,120,${0.9 * (1 - u)})`;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(mx, my, R + u * 260, 0, F.TAU); ctx.stroke();
            ctx.globalCompositeOperation = 'lighter';
            F.glow(ctx, mx, my, 150, '255,200,110', 0.55 + 0.25 * Math.sin(t * 3));
            ctx.globalCompositeOperation = 'source-over';
          }
          // annotation: ? then !!
          const qA = F.env(t, d1.start + 0.3, d1.start + 0.8, d2.start - 0.1, d2.start + 0.2);
          const eA = F.env(t, d2.start + 0.1, d2.start + 0.5, d3.start + 0.3, d3.start + 1.0);
          if (qA > 0.01) F.text(ctx, '?', mx + R * 1.2, my - R * 1.3, { family: 'Cinzel', weight: 700, size: 70, color: '#ff6f61', alpha: qA, glow: 16, glowColor: 'rgba(255,80,60,0.8)' });
          if (eA > 0.01) F.text(ctx, '!!', mx + R * 1.2, my - R * 1.3, { family: 'Cinzel', weight: 700, size: 70, color: '#ffd76e', alpha: eA, glow: 26, glowColor: 'rgba(255,200,80,0.95)' });
        }
        ctx.restore();
      }
      // ---- the cosmos of possibilities
      const cosA = F.env(t, b.start - 0.4, b.start + 0.6, c.start - 0.7, c.start + 0.1);
      if (cosA > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const warp = (t - b.start) * 0.08;
        for (const s of starsA) {
          const dx = s.x - W / 2, dy = s.y - H / 2;
          const k = 1 + warp * (0.5 + s.s);
          F.glow(ctx, W / 2 + dx * k, H / 2 + dy * k, 1.5 + s.s * 4, '220,230,255', cosA * (0.35 + 0.5 * s.s) * (0.6 + 0.4 * Math.sin(t * 2 + s.tw)));
        }
        ctx.restore();
        const nA = cosA * F.smooth(F.prog(t, b.start + 0.3, b.start + 1.2));
        F.text(ctx, '10', W / 2 - 440, 520, { family: 'Montserrat', weight: 300, size: 150, color: '#ffe3a8', alpha: nA, align: 'center', glow: 24, glowColor: 'rgba(255,190,90,0.8)' });
        F.text(ctx, '170', W / 2 - 300, 440, { family: 'Montserrat', weight: 300, size: 64, color: '#ffe3a8', alpha: nA, align: 'center' });
        F.text(ctx, 'POSSIBLE GO POSITIONS', W / 2 - 400, 600, { family: 'Montserrat', weight: 500, size: 22, spacing: 8, color: '#e8d2a4', alpha: nA, align: 'center' });
        const n2 = cosA * F.smooth(F.prog(t, b.start + 1.6, b.start + 2.5));
        F.text(ctx, '10', W / 2 + 390, 520, { family: 'Montserrat', weight: 300, size: 110, color: '#bcd4ff', alpha: n2, align: 'center' });
        F.text(ctx, '80', W / 2 + 490, 458, { family: 'Montserrat', weight: 300, size: 50, color: '#bcd4ff', alpha: n2, align: 'center' });
        F.text(ctx, 'ATOMS IN THE UNIVERSE', W / 2 + 410, 600, { family: 'Montserrat', weight: 500, size: 22, spacing: 8, color: '#bcd4ff', alpha: n2, align: 'center' });
        F.text(ctx, '>', W / 2, 500, { family: 'Montserrat', weight: 300, size: 110, color: '#ffffff', alpha: n2 * 0.8, align: 'center' });
      }
      // ---- labels (on dark bands, for contrast over the wood)
      const lA = F.env(t, c.start + 0.2, c.start + 0.9, d1.start - 0.2, d1.start + 0.4);
      const oA0 = F.env(t, c.start + 2.6, c.start + 3.4, d1.start + 1.5, d1.start + 2.1);
      const band = (y0, y1, a, up) => {
        if (a <= 0.01) return;
        const g = ctx.createLinearGradient(0, up ? y1 : y0, 0, up ? y0 : y1);
        g.addColorStop(0, `rgba(0,0,0,${0.75 * a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y0, W, y1 - y0);
      };
      band(F.TOP, 340, lA, false);
      band(760, F.BOT, oA0, true);
      F.text(ctx, 'GAME 2  ·  MOVE 37', W / 2, 250, { family: 'Cinzel', weight: 600, size: 54, spacing: 12, color: '#ffe2a6', alpha: lA, align: 'center', glow: 20, glowColor: 'rgba(255,190,90,0.8)' });
      const oA = F.env(t, c.start + 2.6, c.start + 3.4, d1.start + 1.5, d1.start + 2.1);
      F.text(ctx, 'Chance a human expert would play it: 1 in 10,000', W / 2, 890, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 40, color: '#f3e3c3', alpha: oA, align: 'center' });
      const sA = F.env(t, d3.start + 0.2, d3.start + 1.0);
      if (sA > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${0.55 * sA})`;
        ctx.fillRect(0, 380, W, 250);
        F.text(ctx, 'ALPHAGO  4 – 1  LEE SEDOL', W / 2, 530, { family: 'Cinzel', weight: 600, size: 76, spacing: 10, color: '#fff1d0', alpha: sA, align: 'center', glow: 26, glowColor: 'rgba(255,190,90,0.8)' });
        F.text(ctx, 'MARCH 2016 · SEOUL', W / 2, 586, { family: 'Montserrat', weight: 400, size: 22, spacing: 10, color: '#e0c89a', alpha: sA, align: 'center' });
      }
      F.caption(ctx, t, { t0: a.start - 0.3, t1: b.start - 0.5, year: '2016', title: 'DEEPMIND ALPHAGO vs. LEE SEDOL', sub: 'An ancient game, a new kind of player', accent: '#ffcf80', x: 150, y: 846 });
      F.vignette(ctx, 0.75);
      // clean digital look from here on: no film grain
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c'), d2 = S.c('d2'), d3 = S.c('d3');
      const out = this.moveTimes.map((tt) => ({ t: tt + 0.1, type: 'stone' }));
      out.push({ t: b.start - 0.3, type: 'whoosh', dur: 1.0 });
      out.push({ t: b.start, type: 'cosmos', dur: c.start - b.start });
      out.push({ t: c.start + 0.3, type: 'silence_riser', dur: 1.6 });
      out.push({ t: c.start + 1.9, type: 'stone', big: 1 });
      out.push({ t: c.start + 1.9, type: 'boom', size: 0.3 });
      out.push({ t: d2.start + 0.1, type: 'shimmer', dur: 2.0 });
      out.push({ t: d3.start + 0.2, type: 'boom', size: 0.35 });
      out.push({ t: d3.start + 0.2, type: 'shimmer', dur: 2.5 });
      return out;
    },
  });
})();

/* Part III: the seven-layer skill stack of a "super" PM, and the knowledge map. */
(function () {
  'use strict';
  const { W, H } = F;

  const LAYERS = [
    { key: 'L1', name: 'CUSTOMER OBSESSION', icon: 'users', rgb: '255,180,92',
      bullets: [['Talk to users every week', 'Talk to users'], ['Map their goals, frustrations and workarounds', 'Understand their goals'], ["Notice what they don't say", 'Only you can sit']],
      why: ['AI summarizes what people said. You notice what they didn’t.', 'notice what they', 0.3] },
    { key: 'L2', name: 'PRODUCT SENSE & TASTE', icon: 'eye', rgb: '255,211,120',
      bullets: [['Tear down great products and broken ones', 'Study great products'], ['Write down why they work, or don’t', 'write down why'], ['Ship, invite critique, repeat', 'Taste is trained']],
      why: ['Taste picks the right answer from a hundred AI options.', "It's what lets you"] },
    { key: 'L3', name: 'AI FLUENCY', icon: 'spark', rgb: '95,212,255',
      bullets: [['Context, hallucinations, retrieval, fine-tuning, agents, tools', 'Understand how models work'], ['Write evals that define good behavior', 'Learn to write evaluations'], ['Know the cost and speed of every AI feature', 'And know the cost']],
      why: ['You can’t lead what you don’t understand.', 'And know the cost', 1.2] },
    { key: 'L4', name: 'BUILDER SKILLS', icon: 'code', rgb: '90,225,200',
      bullets: [['Prototype your ideas with AI coding tools', 'Prototype your own'], ['SQL and Python to answer your own questions', 'Learn enough'], ['Enough about APIs to know what’s possible', 'and enough about']],
      why: ['Don’t just tell. Show.', 'The best product managers'] },
    { key: 'L5', name: 'DATA & EXPERIMENTATION', icon: 'trend', rgb: '120,160,255',
      bullets: [['Choose the metric that truly matters', 'Choose the metric'], ['Design clean experiments', 'Design clean'], ['Read results honestly', 'And read the results']],
      why: ['Especially when the data disagrees with you.', 'especially when'] },
    { key: 'L6', name: 'DOMAIN DEPTH', icon: 'globe', rgb: '168,139,255',
      bullets: [['Pick one industry: health, finance, education, climate…', 'Deep knowledge of an industry'], ['Learn its data, workflows and rules', 'combined with AI'], ['Go deep, then combine it with AI', 'Pick a domain']],
      why: ['General AI knowledge is common. Domain plus AI is rare.', 'is rare'] },
    { key: 'L7', name: 'LEADERSHIP, ETHICS & TRUST', icon: 'scale', rgb: '255,143,179',
      bullets: [['Align people who want different things', 'Align people'], ['Communicate with clarity', 'Communicate with clarity'], ['Catch privacy, fairness and safety risks early', 'Catch risks']],
      why: ['The people we trust to decide become priceless.', 'As machines do more'] },
  ];
  const CX = 560, BASE_Y = 800, STEP = 72, HW = 230, HD = 78, TH = 44;

  function slab(ctx, cx, cy, rgb, lit, alpha, lift = 0) {
    const y = cy - lift;
    const top = [[cx - HW, y], [cx, y - HD], [cx + HW, y], [cx, y + HD]];
    ctx.save();
    ctx.globalAlpha = alpha;
    // left and right faces
    ctx.beginPath(); ctx.moveTo(cx - HW, y); ctx.lineTo(cx, y + HD); ctx.lineTo(cx, y + HD + TH); ctx.lineTo(cx - HW, y + TH); ctx.closePath();
    ctx.fillStyle = `rgba(${rgb},${0.18 + 0.22 * lit})`;
    ctx.fill();
    ctx.fillStyle = 'rgba(8,10,20,0.55)';
    ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + HW, y); ctx.lineTo(cx, y + HD); ctx.lineTo(cx, y + HD + TH); ctx.lineTo(cx + HW, y + TH); ctx.closePath();
    ctx.fillStyle = `rgba(${rgb},${0.1 + 0.15 * lit})`;
    ctx.fill();
    ctx.fillStyle = 'rgba(4,6,14,0.7)';
    ctx.fill();
    // top face
    ctx.beginPath();
    top.forEach(([x, yy], i) => (i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)));
    ctx.closePath();
    const g = ctx.createLinearGradient(cx - HW, y - HD, cx + HW, y + HD);
    g.addColorStop(0, `rgba(${rgb},${0.28 + 0.4 * lit})`);
    g.addColorStop(1, `rgba(${rgb},${0.08 + 0.2 * lit})`);
    ctx.fillStyle = '#0b0e1a';
    ctx.fill();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${0.45 + 0.55 * lit})`;
    ctx.lineWidth = 1.5 + lit;
    if (lit > 0.05) { ctx.shadowColor = `rgba(${rgb},0.9)`; ctx.shadowBlur = 24 * lit; }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(cx - HW, y); ctx.lineTo(cx - HW, y + TH); ctx.lineTo(cx, y + HD + TH); ctx.lineTo(cx + HW, y + TH); ctx.lineTo(cx + HW, y); ctx.moveTo(cx, y + HD); ctx.lineTo(cx, y + HD + TH);
    ctx.strokeStyle = `rgba(${rgb},${0.3 + 0.4 * lit})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  F.scene('stack', {
    transIn: { type: 'fade', dur: 1.4 },
    draw(ctx, t, S) {
      const i1 = S.c('i1'), i2 = S.c('i2'), Ca = S.c('Ca'), Cb = S.c('Cb');
      const bg = ctx.createRadialGradient(CX, 520, 0, CX, 520, 1100);
      bg.addColorStop(0, '#141a30');
      bg.addColorStop(1, '#04050b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      F.stars(ctx, t, 0.35);
      // light beam behind the stack
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beam = ctx.createLinearGradient(CX - 260, 0, CX + 260, 0);
      beam.addColorStop(0, 'rgba(255,220,170,0)');
      beam.addColorStop(0.5, `rgba(255,220,170,${0.05 + 0.08 * F.smooth(F.prog(t, Ca.start, Ca.start + 2))})`);
      beam.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(CX - 260, F.TOP, 520, F.BOT - F.TOP);
      ctx.restore();

      // which layer is active
      let active = -1;
      LAYERS.forEach((L, i) => { if (t >= S.c(L.key + 'a').start - 0.3) active = i; });
      const crown = F.smooth(F.prog(t, Ca.start - 0.3, Ca.start + 1.2));
      // blueprint outline during the intro
      const bp = F.env(t, i2.start - 0.2, i2.start + 0.4, S.c('L1a').start, S.c('L1a').start + 1.0);
      for (let i = 0; i < 7; i++) {
        const flash = F.pulse(t, i2.start + 0.6 + i * 0.35, 0.25);
        if (bp * (0.35 + flash) > 0.01) {
          ctx.save();
          ctx.setLineDash([8, 8]);
          const y = BASE_Y - i * STEP;
          ctx.strokeStyle = `rgba(${LAYERS[i].rgb},${bp * (0.35 + 0.6 * flash)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(CX - HW, y); ctx.lineTo(CX, y - HD); ctx.lineTo(CX + HW, y); ctx.lineTo(CX, y + HD); ctx.closePath(); ctx.stroke();
          ctx.restore();
        }
      }
      // built layers, bottom first
      LAYERS.forEach((L, i) => {
        const ta = S.c(L.key + 'a').start;
        const build = F.easeOutBack(F.prog(t, ta - 0.3, ta + 0.5), 1.2);
        if (build <= 0) return;
        const drop = (1 - F.clamp(build)) * 120;
        const isActive = i === active && crown < 0.5;
        const lit = isActive ? 0.75 + 0.25 * Math.sin(t * 2.4) : 0.18 + 0.6 * crown;
        slab(ctx, CX, BASE_Y - i * STEP - drop, L.rgb, lit, F.clamp(build * 1.4), isActive ? 8 : 0);
        // side label
        const la = F.clamp(build) * (isActive ? 1 : 0.55 + 0.45 * crown);
        F.text(ctx, String(i + 1).padStart(2, '0'), CX - HW - 40, BASE_Y - i * STEP + 20, { family: 'Cinzel', weight: 600, size: 26, color: `rgba(${L.rgb},1)`, alpha: la, align: 'right' });
      });
      // the crown: judgment
      if (crown > 0.01) {
        const cy = BASE_Y - 7 * STEP - 50 - 10 * Math.sin(t * 1.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        F.glow(ctx, CX, cy, 260 * crown, '255,230,180', 0.45 * crown);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = crown;
        ctx.translate(CX, cy);
        const s = 60;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, 0); ctx.lineTo(0, s * 0.95); ctx.lineTo(-s * 0.62, 0); ctx.closePath();
        const gg = ctx.createLinearGradient(-s, -s, s, s);
        gg.addColorStop(0, '#fffaf0'); gg.addColorStop(0.5, '#ffd99a'); gg.addColorStop(1, '#c08a40');
        ctx.fillStyle = gg;
        ctx.shadowColor = 'rgba(255,210,140,0.95)';
        ctx.shadowBlur = 40;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-s * 0.62, 0); ctx.lineTo(s * 0.62, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s * 0.95); ctx.stroke();
        ctx.restore();
      }

      // ---- right-hand panel
      const px = 900;
      // intro
      const iA = F.env(t, i1.start - 0.2, i1.start + 0.5, S.c('L1a').start - 0.4, S.c('L1a').start + 0.2);
      if (iA > 0.01) {
        F.text(ctx, 'THE SUPER PM', px + 40, 440, { family: 'Cinzel', weight: 600, size: 84, spacing: 12, color: '#ffe2ae', alpha: iA, glow: 26, glowColor: 'rgba(255,190,90,0.6)' });
        F.text(ctx, 'Seven layers, each resting on the one below.', px + 44, 520, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 44, color: '#e8e4dc', alpha: iA * F.smooth(F.prog(t, i2.start, i2.start + 0.8)) });
      }
      if (active >= 0 && crown < 0.99) {
        const L = LAYERS[active];
        const a = S.c(L.key + 'a'), b = S.c(L.key + 'b');
        const next = active < 6 ? S.c(LAYERS[active + 1].key + 'a').start : Ca.start;
        const pA = F.env(t, a.start - 0.3, a.start + 0.4, next - 0.5, next - 0.1) * (1 - crown);
        if (pA > 0.01) {
          F.text(ctx, `LAYER ${active + 1}`, px + 40, 300, { family: 'Montserrat', weight: 600, size: 22, spacing: 12, color: `rgba(${L.rgb},1)`, alpha: pA });
          F.icon(ctx, L.icon, px + 72, 380, 64, L.rgb, pA, { glow: 14 });
          const nameSize = L.name.length > 20 ? 44 : 54;
          F.text(ctx, L.name, px + 130, 398, { family: 'Cinzel', weight: 600, size: nameSize, spacing: 4, color: '#f7f1e6', alpha: pA, glow: 16, glowColor: `rgba(${L.rgb},0.45)` });
          ctx.fillStyle = `rgba(${L.rgb},${0.7 * pA})`;
          ctx.fillRect(px + 40, 440, 760 * F.easeOut(F.prog(t, a.start, a.start + 1.0)), 2);
          L.bullets.forEach(([txt, phrase], k) => {
            const tb = F.phraseAt(b, phrase, k / 3);
            const ba = pA * F.smooth(F.prog(t, tb - 0.15, tb + 0.45));
            if (ba <= 0.01) return;
            const y = 520 + k * 84;
            F.icon(ctx, 'check', px + 60, y - 10, 32, L.rgb, ba);
            F.text(ctx, txt, px + 100, y, { family: 'Montserrat', weight: 500, size: txt.length > 44 ? 25 : 28, color: '#eef1f8', alpha: ba });
          });
          const [why, wphrase, wdelay] = L.why;
          const tw = F.phraseAt(b, wphrase, 0.9) + (wdelay || 0);
          F.text(ctx, why, px + 40, 820, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 36, color: `rgba(${L.rgb},1)`, alpha: pA * F.smooth(F.prog(t, tw - 0.1, tw + 0.6)) });
        }
      }
      // crown panel
      if (crown > 0.01) {
        const cA = crown * F.env(t, Ca.start - 0.3, Ca.start + 0.5, S.dur - 1.2, S.dur);
        F.text(ctx, 'THE CROWN', px + 40, 330, { family: 'Montserrat', weight: 600, size: 22, spacing: 12, color: '#ffd27a', alpha: cA });
        F.text(ctx, 'JUDGMENT', px + 36, 450, { family: 'Cinzel', weight: 700, size: 104, spacing: 14, color: '#ffe2ae', alpha: cA, glow: 34, glowColor: 'rgba(255,190,90,0.7)' });
        const tl = F.phraseAt(Ca, 'sharpened by');
        F.text(ctx, '×  LEARNING SPEED', px + 44, 530, { family: 'Montserrat', weight: 600, size: 34, spacing: 10, color: '#9fe3ff', alpha: cA * F.smooth(F.prog(t, tl - 0.1, tl + 0.6)) });
        const lines = ['Tools will change every few months.', 'Learning, unlearning and deciding well', 'is the moat that lasts.'];
        lines.forEach((l, k) => {
          const tk = Cb.start + k * 2.0;
          F.text(ctx, l, px + 44, 640 + k * 58, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 42, color: k === 2 ? '#ffe2ae' : '#ece6da', alpha: cA * F.smooth(F.prog(t, tk - 0.1, tk + 0.6)) });
        });
      }
      F.partCard(ctx, t, { t0: -0.8, t1: 3.6, num: 'PART III', title: 'THE SUPER PM', sub: 'Seven layers of skill for the age of AI' });
      F.vignette(ctx, 0.45);
    },
    cues(S) {
      const out = [{ t: 0.1, type: 'impact', size: 0.45 }];
      const i2 = S.c('i2');
      for (let i = 0; i < 7; i++) out.push({ t: i2.start + 0.6 + i * 0.35, type: 'tick_soft' });
      LAYERS.forEach((L, i) => {
        const a = S.c(L.key + 'a'), b = S.c(L.key + 'b');
        out.push({ t: a.start - 0.05, type: 'slab', idx: i });
        L.bullets.forEach(([, phrase], k) => out.push({ t: F.phraseAt(b, phrase, k / 3), type: 'tick_soft' }));
      });
      out.push({ t: S.c('Ca').start - 1.2, type: 'riser', dur: 1.1 });
      out.push({ t: S.c('Ca').start - 0.1, type: 'boom', size: 0.5 });
      out.push({ t: S.c('Ca').start, type: 'shimmer', dur: 3.0 });
      return out;
    },
  });
  F.STACK_LAYERS = LAYERS;

  // ============================================================ KNOWLEDGE
  const RINGS = [
    { name: 'PRODUCT CORE', rgb: F.HUMAN, rx: 290, ry: 150, clip: 'b', chips: [['Discovery', 'discovery'], ['Strategy', 'strategy'], ['Prioritization', 'prioritization'], ['Pricing & unit economics', 'pricing'], ['Go-to-market', 'go-to-market'], ['User psychology', 'psychology']] },
    { name: 'AI CORE', rgb: F.AI, rx: 500, ry: 262, clip: 'c', chips: [['Language models', 'language models'], ['Retrieval (RAG)', 'retrieval'], ['Fine-tuning', 'fine-tuning'], ['Agents & tools', 'agents'], ['Evaluation', 'evaluation'], ['Inference economics', 'economics']] },
    { name: 'RESPONSIBILITY CORE', rgb: F.ROSE, rx: 720, ry: 350, clip: 'd', chips: [['Privacy', 'privacy'], ['Security', 'security'], ['Fairness', 'fairness'], ['Safety', 'safety'], ['AI regulation · EU AI Act', 'laws taking shape']] },
  ];
  F.scene('knowledge', {
    transIn: { type: 'fade', dur: 1.2 },
    draw(ctx, t, S) {
      const cx = W / 2, cy = 545;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1000);
      bg.addColorStop(0, '#121833');
      bg.addColorStop(1, '#04050b');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      F.stars(ctx, t, 0.3);
      const a = S.c('a');
      const tA = F.env(t, a.start - 0.2, a.start + 0.5, S.c('b').start + 1.5, S.c('b').start + 2.5);
      F.text(ctx, 'THE KNOWLEDGE MAP', 110, 215, { family: 'Montserrat', weight: 600, size: 24, spacing: 14, color: '#f0e8d8', alpha: tA });
      // rings
      RINGS.forEach((R, ri) => {
        const clip = S.c(R.clip);
        const on = F.smooth(F.prog(t, a.start + ri * 0.5, a.start + ri * 0.5 + 1.0));
        const lit = F.env(t, clip.start - 0.3, clip.start + 0.4) ;
        ctx.save();
        ctx.strokeStyle = F.rgba(R.rgb, (0.18 + 0.45 * lit) * on);
        ctx.lineWidth = 1.5 + lit;
        if (lit > 0.05) { ctx.shadowColor = F.rgba(R.rgb, 0.8); ctx.shadowBlur = 16 * lit; }
        ctx.beginPath(); ctx.ellipse(cx, cy, R.rx, R.ry, 0, 0, F.TAU); ctx.stroke();
        ctx.restore();
        // orbiting dots
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const ang = t * (0.25 - ri * 0.06) * (ri % 2 ? -1 : 1) + k * 2.1;
          F.glow(ctx, cx + Math.cos(ang) * R.rx, cy + Math.sin(ang) * R.ry, 10, R.rgb, 0.8 * on);
        }
        ctx.restore();
        F.text(ctx, R.name, cx, cy - R.ry - 16, { family: 'Montserrat', weight: 600, size: 17, spacing: 8, color: F.rgba(R.rgb, 1), alpha: on * (0.5 + 0.5 * lit), align: 'center' });
        // chips
        R.chips.forEach(([label, phrase], k) => {
          const n = R.chips.length;
          const ang = -Math.PI / 2 + Math.PI / n + (k / n) * F.TAU;
          const x = cx + Math.cos(ang) * R.rx, y = cy + Math.sin(ang) * R.ry;
          const tc = F.phraseAt(clip, phrase, k / n);
          const ca = on * F.smooth(F.prog(t, tc - 0.15, tc + 0.4));
          if (ca <= 0.01) {
            ctx.fillStyle = F.rgba(R.rgb, 0.3 * on);
            ctx.beginPath(); ctx.arc(x, y, 4, 0, F.TAU); ctx.fill();
            return;
          }
          const hot = F.pulse(t, tc + 0.2, 0.5);
          F.chip(ctx, label, x, y, { align: 'center', rgb: R.rgb, alpha: ca, size: 19, spacing: 1, edge: 0.6 + 0.4 * hot, glow: 0.3 + hot, color: '#f6f8ff' });
        });
      });
      // centre
      ctx.save();
      ctx.fillStyle = '#1a1206';
      ctx.strokeStyle = F.rgba(F.HUMAN, 0.9);
      ctx.lineWidth = 2.5;
      ctx.shadowColor = F.rgba(F.HUMAN, 0.8);
      ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.arc(cx, cy, 52, 0, F.TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
      F.icon(ctx, 'user', cx, cy - 4, 44, F.HUMAN, 1, { glow: 8 });
      F.vignette(ctx, 0.45);
    },
    cues(S) {
      const out = [];
      RINGS.forEach((R) => {
        const clip = S.c(R.clip);
        out.push({ t: clip.start - 0.2, type: 'shimmer', dur: 1.2 });
        R.chips.forEach(([, phrase], k) => out.push({ t: F.phraseAt(clip, phrase, k / R.chips.length), type: 'pop', idx: k % 4 }));
      });
      return out;
    },
  });
})();

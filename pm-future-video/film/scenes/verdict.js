/* Part II: is product management still a good career? */
(function () {
  'use strict';
  const { W, H } = F;

  const OLD = [['doc', 'Writing documents'], ['users', 'Running meetings'], ['report', 'Reporting status'], ['ticket', 'Grooming backlogs']];
  const NEW = [
    ['heart', 'Understands customers deeply', 'understands customers deeply', F.HUMAN],
    ['code', 'Builds with AI', 'builds with AI', F.AI],
    ['compass', 'Decides well under uncertainty', 'makes sound decisions', F.HUMAN],
    ['bolt', 'More leverage than ever', 'with more leverage', F.AI],
  ];

  F.scene('verdict', {
    transIn: { type: 'fade', dur: 1.4 },
    draw(ctx, t, S) {
      const a = S.c('a'), b = S.c('b'), c = S.c('c'), d = S.c('d'), e = S.c('e');
      const g = ctx.createLinearGradient(0, F.TOP, 0, F.BOT);
      g.addColorStop(0, '#07080f');
      g.addColorStop(1, '#0d0f1c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      F.motes(ctx, t, { n: 40, seed: 3, alpha: 0.2, size: 3, speed: 5, rgb: '255,220,170' });

      // ---- the question
      const qA = F.env(t, a.start - 0.2, a.start + 0.4, b.start - 0.3, b.start + 0.2);
      if (qA > 0.01) {
        const l1 = 'Is product management a good career', l2 = 'for someone starting today?';
        const o = { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 66, color: '#f3ead7', align: 'center' };
        F.text(ctx, l1, W / 2, 490, { ...o, alpha: qA });
        F.text(ctx, l2, W / 2, 570, { ...o, alpha: qA * F.smooth(F.prog(t, F.phraseAt(a, 'for someone') - 0.1, F.phraseAt(a, 'for someone') + 0.5)) });
      }
      // ---- YES
      const yA = F.env(t, b.start - 0.05, b.start + 0.15, c.start - 0.4, c.start + 0.3);
      if (yA > 0.01) {
        const sc = 1 + 0.25 * (1 - F.easeOutExpo(F.prog(t, b.start - 0.05, b.start + 0.5)));
        ctx.save();
        ctx.translate(W / 2, 520);
        ctx.scale(sc, sc);
        F.text(ctx, 'YES.', 0, 0, { family: 'Cinzel', weight: 700, size: 190, spacing: 20, color: '#ffe2ae', alpha: yA, align: 'center', glow: 44, glowColor: 'rgba(255,190,90,0.75)' });
        ctx.restore();
        const tb = F.phraseAt(b, 'But not');
        F.text(ctx, '…but not the old version of the job.', W / 2, 640, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 52, color: '#f3ead7', alpha: yA * F.smooth(F.prog(t, tb - 0.1, tb + 0.5)), align: 'center' });
      }
      // ---- old versus new
      const sA = F.env(t, c.start - 0.2, c.start + 0.6, e.start - 0.2, e.start + 0.6) ;
      if (sA > 0.01) {
        // divider
        ctx.fillStyle = `rgba(200,205,225,${0.2 * sA})`;
        ctx.fillRect(W / 2, 250, 1.5, 620);
        // the old PM
        const risk = F.smooth(F.prog(t, F.phraseAt(c, 'is at real risk') - 0.2, F.phraseAt(c, 'is at real risk') + 0.6));
        F.text(ctx, 'THE OLD PM', 510, 260, { family: 'Montserrat', weight: 600, size: 26, spacing: 12, color: '#b7bfd3', alpha: sA, align: 'center' });
        OLD.forEach(([ic, label], i) => {
          const ti = c.start + 0.3 + i * 0.45;
          const ta = sA * F.smooth(F.prog(t, ti, ti + 0.4));
          if (ta <= 0.01) return;
          const y = 330 + i * 112;
          const crack = F.smooth(F.prog(t, F.phraseAt(c, 'being automated') + i * 0.25, F.phraseAt(c, 'being automated') + i * 0.25 + 0.8));
          const alpha = ta * (1 - 0.55 * crack);
          F.panel(ctx, 250, y, 520, 88, { rgb: '190,195,210', edge: 0.3, alpha, fill: 'rgba(22,24,32,0.9)' });
          F.icon(ctx, ic, 300, y + 44, 36, '200,205,220', alpha);
          F.text(ctx, label, 345, y + 54, { family: 'Montserrat', weight: 500, size: 26, color: '#d6dae6', alpha });
          if (crack > 0.01) {
            ctx.save();
            ctx.globalAlpha = ta * crack;
            ctx.strokeStyle = 'rgba(255,120,110,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(250 + 520 * 0.62, y);
            ctx.lineTo(250 + 520 * 0.58, y + 30);
            ctx.lineTo(250 + 520 * 0.66, y + 52);
            ctx.lineTo(250 + 520 * 0.6, y + 88);
            ctx.stroke();
            ctx.restore();
          }
        });
        if (risk > 0.01) {
          F.chip(ctx, 'AT RISK', 510, 800, { align: 'center', rgb: '255,120,110', color: '#ffb3a8', alpha: sA * risk, size: 20, spacing: 8, edge: 0.9 });
        }
        const eA = sA * F.smooth(F.prog(t, F.phraseAt(c, 'and entry-level') - 0.1, F.phraseAt(c, 'and entry-level') + 0.6));
        F.text(ctx, 'Entry-level roles built on this work are getting harder to find', 510, 870, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 28, color: '#c9ccd8', alpha: eA, align: 'center' });
        // the new PM
        const nA = sA * F.smooth(F.prog(t, d.start - 0.2, d.start + 0.6));
        F.text(ctx, 'THE NEW PM', 1410, 260, { family: 'Montserrat', weight: 600, size: 26, spacing: 12, color: '#ffd27a', alpha: nA, align: 'center' });
        NEW.forEach(([ic, label, phrase, rgb], i) => {
          const ti = F.phraseAt(d, phrase);
          const ta = sA * F.smooth(F.prog(t, ti - 0.15, ti + 0.45));
          if (ta <= 0.01) return;
          const y = 330 + i * 112;
          F.panel(ctx, 1130, y, 580, 88, { rgb, edge: 0.85, alpha: ta, glow: 0.8, fill: 'rgba(24,20,12,0.9)' });
          F.icon(ctx, ic, 1180, y + 44, 38, rgb, ta, { glow: 10 });
          F.text(ctx, label, 1225, y + 54, { family: 'Montserrat', weight: 500, size: 26, color: '#fff3dc', alpha: ta });
        });
        const vA = sA * F.smooth(F.prog(t, F.phraseAt(d, 'more valuable') - 0.1, F.phraseAt(d, 'more valuable') + 0.5));
        if (vA > 0.01) F.chip(ctx, 'MORE VALUABLE THAN EVER', 1410, 800, { align: 'center', rgb: F.HUMAN, color: '#ffe2ae', alpha: vA, size: 20, spacing: 8, edge: 0.9, glow: 0.6 });
      }
      // ---- the real question
      const rA = F.env(t, e.start - 0.1, e.start + 0.6);
      if (rA > 0.01) {
        ctx.fillStyle = `rgba(4,5,10,${0.75 * rA})`;
        ctx.fillRect(0, 0, W, H);
        F.text(ctx, "The question isn't whether AI will take the job.", W / 2, 470, { family: 'Cormorant Garamond', style: 'italic', weight: 500, size: 50, color: '#dfe4f2', alpha: rA, align: 'center' });
        const tw = F.phraseAt(e, "It's whether");
        F.text(ctx, "It's whether you'll grow into the new one.", W / 2, 570, { family: 'Cormorant Garamond', style: 'italic', weight: 600, size: 60, color: '#ffe2ae', alpha: rA * F.smooth(F.prog(t, tw - 0.1, tw + 0.6)), align: 'center', glow: 20, glowColor: 'rgba(255,190,90,0.55)' });
      }
      F.partCard(ctx, t, { t0: -0.8, t1: 3.6, num: 'PART II', title: 'THE VERDICT', sub: 'Is product management still a good career?' });
      F.vignette(ctx, 0.5);
    },
    cues(S) {
      const b = S.c('b'), c = S.c('c'), d = S.c('d'), e = S.c('e');
      const out = [
        { t: 0.1, type: 'impact', size: 0.45 },
        { t: b.start - 0.05, type: 'boom', size: 0.5 },
        { t: b.start, type: 'shimmer', dur: 2.0 },
      ];
      OLD.forEach((_, i) => out.push({ t: c.start + 0.3 + i * 0.45, type: 'tick_soft' }));
      OLD.forEach((_, i) => out.push({ t: F.phraseAt(c, 'being automated') + i * 0.25, type: 'crack_soft' }));
      NEW.forEach(([, , phrase], i) => out.push({ t: F.phraseAt(d, phrase), type: 'pop', idx: i }));
      out.push({ t: e.start - 0.1, type: 'swell', dur: 1.0 });
      return out;
    },
  });
})();

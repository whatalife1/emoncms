// js/23n4-analytics-render.js
// ─── Flow Extras Analytics: canvas graph rendering + hover/scrub ──────
// Auto-split from js/23n-flow-extras-analytics.js

(function () {
  'use strict';

  const FX  = window.FX = window.FX || {};
  const FXA = FX.analytics = FX.analytics || {};

  // ─── Main graph renderer ────────────────────────────────────────────
  function redrawGraph(ctx) {
    const state = ctx.state;
    const cfg   = ctx.cfg;
    const boxKey = ctx.boxKey;
    const isBattery = ctx.isBattery;
    const titleColor = ctx.titleColor;
    const dom = ctx.dom;
    const canvas = dom.canvas;
    const rate = state.cachedData ? state.cachedData.rate : 0;

    if (state.view !== 'graph' || !state.cachedData) return;
    const cache = state.cachedData;
    const isDayMode = cache.isDayMode;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const gctx = canvas.getContext('2d');
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.scale(dpr, dpr);
    gctx.clearRect(0, 0, rect.width, rect.height);

    const PL = 36, PR = 14, PT = 22, PB = 30;
    const cW = rect.width  - PL - PR;
    const cH = rect.height - PT - PB;
    if (cW <= 0 || cH <= 0) return;

    const maxPan = (cW / 2) * (state.zoom - 1);
    state.panX = Math.max(-maxPan, Math.min(maxPan, state.panX));
    const centerX = PL + cW / 2;
    const mapXCoord = function (rawX) {
      return centerX + (rawX - centerX) * state.zoom + state.panX;
    };

    // ── 1. Battery day view renderer ──
    if (isBattery && isDayMode) {
      const socBars = cache.socBars;
      const voltBars = cache.voltBars;
      const pwrBars = cache.pwrBars;
      const sessions = cache.sessions;
      const lastIdx = cache.lastIdx;
      const packKwh = cache.packKwh;
      const n = socBars.length;
      if (n < 2) return;

      const mapX = function (idx) { return mapXCoord(PL + (idx / (n - 1)) * cW); };
      const minV = 0, maxV = 110, range = 110;
      const mapY = function (v) { return PT + cH - ((v - minV) / range) * cH; };

      // Y grid
      gctx.fillStyle = '#71717a';
      gctx.font = '9px system-ui';
      gctx.textAlign = 'right';
      const ticks = [0, 22, 44, 66, 88, 110];
      ticks.forEach(function (v) {
        const y = mapY(v);
        gctx.fillText(Math.round(v) + '%', PL - 5, y + 3);
        gctx.strokeStyle = v === 100 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
        gctx.beginPath();
        if (v === 100) gctx.setLineDash([4, 4]); else gctx.setLineDash([]);
        gctx.moveTo(PL, y); gctx.lineTo(PL + cW, y); gctx.stroke();
        gctx.setLineDash([]);
      });

      gctx.save();
      gctx.beginPath();
      gctx.rect(PL, PT, cW, cH);
      gctx.clip();

      // Background gradient
      const grad = gctx.createLinearGradient(0, PT, 0, PT + cH);
      grad.addColorStop(0, titleColor + '44');
      grad.addColorStop(1, titleColor + '00');

      gctx.beginPath();
      let started = false, firstX = null, lastX = null;
      for (let i = 0; i < lastIdx; i++) {
        if (socBars[i] == null) continue;
        const x = mapX(i), y = mapY(socBars[i]);
        if (!started) { firstX = x; gctx.moveTo(x, PT + cH); gctx.lineTo(x, y); started = true; }
        else gctx.lineTo(x, y);
        lastX = x;
      }
      if (started && lastX != null) {
        gctx.lineTo(lastX, PT + cH);
        gctx.closePath();
        gctx.fillStyle = grad;
        gctx.fill();
      }

      // Base green line
      gctx.beginPath();
      started = false;
      for (let i = 0; i < lastIdx; i++) {
        if (socBars[i] == null) { started = false; continue; }
        const x = mapX(i), y = mapY(socBars[i]);
        if (!started) { gctx.moveTo(x, y); started = true; }
        else gctx.lineTo(x, y);
      }
      gctx.strokeStyle = titleColor;
      gctx.lineWidth = 2.2;
      gctx.stroke();

      // Glowing slope segments
      if (state.showSessions !== false && sessions && sessions.length) {
        sessions.forEach(function (seg) {
          const isCharge = seg.type === 'charge';
          const clr = isCharge ? '#4ade80' : '#fb923c';
          const ranges = (seg.ranges && seg.ranges.length)
            ? seg.ranges : [{ startIdx: seg.startIdx, endIdx: seg.endIdx }];

          ranges.forEach(function (rng) {
            gctx.save();
            gctx.beginPath();
            let fst = true;
            for (let k = rng.startIdx; k <= Math.min(rng.endIdx, lastIdx - 1); k++) {
              if (socBars[k] == null) continue;
              const px = mapX(k), py = mapY(socBars[k]);
              if (fst) { gctx.moveTo(px, py); fst = false; } else gctx.lineTo(px, py);
            }
            gctx.strokeStyle = clr;
            gctx.lineWidth = 3.5;
            gctx.shadowColor = clr;
            gctx.shadowBlur = 8;
            gctx.stroke();
            gctx.restore();
          });

          if (ranges.length > 1) {
            for (let r = 0; r < ranges.length - 1; r++) {
              const r1 = ranges[r];
              const r2 = ranges[r + 1];
              if (r1.endIdx >= lastIdx) continue;
              const v1 = socBars[r1.endIdx];
              const v2 = socBars[Math.min(r2.startIdx, lastIdx - 1)];
              if (v1 == null || v2 == null) continue;
              const x1 = mapX(r1.endIdx), y1 = mapY(v1);
              const x2 = mapX(r2.startIdx), y2 = mapY(v2);
              const dropY = 14;

              gctx.save();
              gctx.beginPath();
              gctx.moveTo(x1, y1); gctx.lineTo(x1, y1 + dropY);
              gctx.strokeStyle = clr; gctx.lineWidth = 2; gctx.stroke();

              gctx.beginPath();
              for (let k = r1.endIdx; k <= Math.min(r2.startIdx, lastIdx - 1); k++) {
                if (socBars[k] == null) continue;
                const px = mapX(k), py = mapY(socBars[k]) + dropY;
                if (k === r1.endIdx) gctx.moveTo(px, py); else gctx.lineTo(px, py);
              }
              gctx.setLineDash([5, 4]); gctx.strokeStyle = clr; gctx.lineWidth = 2.5; gctx.stroke();

              gctx.beginPath(); gctx.setLineDash([]);
              gctx.moveTo(x2, y2 + dropY); gctx.lineTo(x2, y2);
              gctx.strokeStyle = clr; gctx.lineWidth = 2; gctx.stroke();
              gctx.restore();
            }
          }
        });
      }

      // Voltage overlay
      if (state.includeVoltage && voltBars.length) {
        const valV = voltBars.slice(0, lastIdx).filter(function (v) { return v != null && v > 40; });
        const vMin = valV.length ? Math.floor(Math.min.apply(null, valV) - 1) : 46;
        const vMax = valV.length ? Math.ceil (Math.max.apply(null, valV) + 1) : 56;
        const vRange = Math.max(1, vMax - vMin);
        const mapVy = function (v) { return PT + cH - ((v - vMin) / vRange) * cH; };

        gctx.beginPath();
        started = false;
        for (let i = 0; i < lastIdx; i++) {
          if (voltBars[i] == null) { started = false; continue; }
          const x = mapX(i), y = mapVy(voltBars[i]);
          if (!started) { gctx.moveTo(x, y); started = true; } else gctx.lineTo(x, y);
        }
        gctx.strokeStyle = '#35c0b7'; gctx.lineWidth = 1.8; gctx.stroke();
      }

      // Power overlay
      if (state.includePower && pwrBars.length) {
        const valP = pwrBars.slice(0, lastIdx).filter(function (v) {
          return v != null && Math.abs(v) > 0;
        });
        const maxP = valP.length ? Math.max.apply(null, valP.map(Math.abs)) * 1.15 : 1000;
        const mapPy = function (p) { return PT + cH / 2 - (p / maxP) * (cH / 2); };

        gctx.beginPath();
        started = false;
        for (let i = 0; i < lastIdx; i++) {
          if (pwrBars[i] == null) { started = false; continue; }
          const x = mapX(i), y = mapPy(pwrBars[i]);
          if (!started) { gctx.moveTo(x, y); started = true; } else gctx.lineTo(x, y);
        }
        gctx.strokeStyle = '#facc15'; gctx.lineWidth = 1.6;
        gctx.setLineDash([4, 4]); gctx.stroke(); gctx.setLineDash([]);
      }

      gctx.restore();

      // Callout pills
      if (state.showSessions !== false && sessions && sessions.length) {
        const isNarrow = cW < 420;

        sessions.forEach(function (seg) {
          const isCharge = seg.type === 'charge';
          const clr = isCharge ? '#4ade80' : '#fb923c';
          const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
          const borderClr = isCharge ? '#10b981' : '#f97316';

          let targetRange = { startIdx: seg.startIdx, endIdx: seg.endIdx };
          if (seg.ranges && seg.ranges.length > 1) {
            targetRange = seg.ranges.reduce(function (best, r) {
              return (r.endIdx - r.startIdx > best.endIdx - best.startIdx ? r : best);
            }, seg.ranges[0]);
          }
          const midIdx = Math.round((targetRange.startIdx + targetRange.endIdx) / 2);
          if (midIdx >= lastIdx) return;
          const midVal = socBars[midIdx];
          if (midVal == null) return;
          const midX = mapX(midIdx), midY = mapY(midVal);
          if (midX < PL - 40 || midX > rect.width) return;

          const durH = Math.floor(seg.durMin / 60);
          const durM = Math.round(seg.durMin % 60);
          const durStr = durH > 0
            ? (durM > 0 ? (durH + 'h ' + durM + 'm') : (durH + 'h'))
            : (durM + 'm');
          const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
          const sign = isCharge ? '+' : '';
          const avgW = seg.durMin > 0 ? Math.round((kwhEst * 1000) / (seg.durMin / 60)) : 0;
          const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

          let pauseStr = '';
          if (seg.pauseMin > 0) {
            const ph = Math.floor(seg.pauseMin / 60);
            const pm = seg.pauseMin % 60;
            const pText = ph > 0 ? (pm > 0 ? (ph + 'h ' + pm + 'm') : (ph + 'h')) : (pm + 'm');
            pauseStr = ' · ' + pText + ' pause';
          }

          const text = isNarrow
            ? (isCharge ? '▲' : '▼') + ' ' + sign + Math.round(seg.delta) + '% · ' +
              durStr + ' (' + kwhEst.toFixed(1) + 'k · Ø ' + avgStr + ')'
            : (isCharge ? '▲' : '▼') + ' ' + sign + seg.delta.toFixed(1) + '% · ' +
              durStr + pauseStr + ' (' + kwhEst.toFixed(1) + 'kWh · Ø ' + avgStr + ')';

          gctx.font = 'bold ' + (isNarrow ? '9.5px' : '11px') + ' system-ui, -apple-system, sans-serif';
          const tw = gctx.measureText(text).width;
          const pw = tw + (isNarrow ? 12 : 18);
          const ph = isNarrow ? 19 : 22;

          let bx = midX - pw / 2;
          bx = Math.max(PL + 4, Math.min(rect.width - PR - pw - 4, bx));
          let by = isCharge ? (midY - ph - 10) : (midY + 10);
          by = Math.max(PT + 2, Math.min(PT + cH - ph - 2, by));

          gctx.save();
          gctx.fillStyle = bgClr;
          gctx.strokeStyle = borderClr;
          gctx.lineWidth = 1.4;
          gctx.shadowColor = 'rgba(0,0,0,0.85)';
          gctx.shadowBlur = 6;

          gctx.beginPath();
          if (typeof gctx.roundRect === 'function') gctx.roundRect(bx, by, pw, ph, 5);
          else gctx.rect(bx, by, pw, ph);
          gctx.fill();
          gctx.stroke();

          gctx.beginPath();
          gctx.moveTo(midX, by > midY ? by : by + ph);
          gctx.lineTo(midX, midY);
          gctx.strokeStyle = borderClr;
          gctx.lineWidth = 1;
          gctx.stroke();

          gctx.fillStyle = '#ffffff';
          gctx.textAlign = 'center';
          gctx.textBaseline = 'middle';
          gctx.fillText(text, bx + pw / 2, by + ph / 2 + 0.5);
          gctx.restore();
        });
      }

      // X-axis ticks
      gctx.fillStyle = '#a1a1aa';
      gctx.font = '9px system-ui';
      gctx.textAlign = 'center';
      const labelIntervals = Math.max(4, Math.floor(cW / 45));
      const step = Math.max(1, Math.ceil(n / (labelIntervals * state.zoom)));
      for (let i = 0; i < n; i += step) {
        const lx = mapX(i);
        if (lx > PL - 10 && lx < rect.width - PR) {
          const ts = cache.startMs + i * 120 * 1000;
          const pkt = (typeof getKarachiDate === 'function')
            ? getKarachiDate(ts) : { hour: 0 };
          const ampm = pkt.hour >= 12 ? 'pm' : 'am';
          const hh = pkt.hour % 12 || 12;
          gctx.fillText(hh + ampm, lx, PT + cH + 15);
        }
      }

      // Scrub cursor
      if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < lastIdx) {
        const sx = mapX(state.scrubIdx);
        const val = socBars[state.scrubIdx];
        const sy = val != null ? mapY(val) : PT + cH / 2;

        gctx.save();
        gctx.beginPath();
        gctx.setLineDash([3, 3]);
        gctx.strokeStyle = 'rgba(255,255,255,0.7)';
        gctx.lineWidth = 1;
        gctx.moveTo(sx, PT); gctx.lineTo(sx, PT + cH); gctx.stroke();

        if (val != null) {
          gctx.beginPath();
          gctx.setLineDash([]);
          gctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
          gctx.fillStyle = titleColor;
          gctx.fill();
          gctx.strokeStyle = '#fff';
          gctx.lineWidth = 2;
          gctx.stroke();
        }

        const ts = cache.startMs + state.scrubIdx * 120 * 1000;
        const timeStr = formatPktTime(ts, 'time');
        const valStr  = val != null ? (val.toFixed(1) + ' %') : '--';

        const line1 = timeStr;
        const line2 = '● Value: ' + valStr;

        gctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        const tw1 = gctx.measureText(line1).width;
        const tw2 = gctx.measureText(line2).width;
        const boxW = Math.max(tw1, tw2) + 16;
        const boxH = 34;

        let boxX = sx - boxW / 2;
        boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
        let boxY = sy - boxH - 10;
        if (boxY < PT + 4) boxY = sy + 10;

        gctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
        gctx.strokeStyle = 'var(--border, #3f3f46)';
        gctx.lineWidth = 1;
        gctx.beginPath();
        if (typeof gctx.roundRect === 'function') gctx.roundRect(boxX, boxY, boxW, boxH, 6);
        else gctx.rect(boxX, boxY, boxW, boxH);
        gctx.fill();
        gctx.stroke();

        gctx.fillStyle = 'var(--text-main, #f4f4f5)';
        gctx.textAlign = 'left';
        gctx.textBaseline = 'top';
        gctx.fillText(line1, boxX + 8, boxY + 5);

        gctx.fillStyle = '#4ade80';
        gctx.fillText(line2, boxX + 8, boxY + 18);
        gctx.restore();
      }
      return;
    }

    // ── 2. Non-battery day view ──
    const ptsData = cache.ptsData;
    const ptsAux  = cache.ptsAux;
    const ptsF1   = cache.ptsF1;
    const ptsF2   = cache.ptsF2;
    const dailyMap = cache.dailyMap || {};

    if (isDayMode) {
      if (cfg.isFridges) {
        const p1 = ptsF1 || [];
        const p2 = ptsF2 || [];
        const n = Math.max(p1.length, p2.length);
        if (n < 2) return;

        const allVals = [];
        if (state.fridgeFilter !== 'f2') allVals.push.apply(allVals, p1.map(function (p) { return p[1] || 0; }));
        if (state.fridgeFilter !== 'f1') allVals.push.apply(allVals, p2.map(function (p) { return p[1] || 0; }));
        const maxW = Math.max(200, Math.max.apply(null, allVals) * 1.2);

        const mapX = function (idx) { return mapXCoord(PL + (idx / (n - 1)) * cW); };
        const mapY = function (val) { return PT + cH - (Math.max(0, val) / maxW) * cH; };

        gctx.fillStyle = '#71717a';
        gctx.font = '9px system-ui';
        gctx.textAlign = 'right';
        for (let g = 0; g <= 4; g++) {
          const val = (g / 4) * maxW;
          const y = PT + cH - (g / 4) * cH;
          gctx.fillText(Math.round(val) + 'W', PL - 5, y + 3);
          gctx.strokeStyle = 'rgba(255,255,255,0.06)';
          gctx.beginPath(); gctx.moveTo(PL, y); gctx.lineTo(PL + cW, y); gctx.stroke();
        }

        gctx.save();
        gctx.beginPath(); gctx.rect(PL, PT, cW, cH); gctx.clip();

        if (state.fridgeFilter === 'both' || state.fridgeFilter === 'f1') {
          const grad1 = gctx.createLinearGradient(0, PT, 0, PT + cH);
          grad1.addColorStop(0, 'rgba(192, 132, 252, 0.28)');
          grad1.addColorStop(1, 'rgba(192, 132, 252, 0.0)');
          gctx.beginPath();
          gctx.moveTo(mapX(0), PT + cH);
          p1.forEach(function (p, idx) { gctx.lineTo(mapX(idx), mapY(p[1] || 0)); });
          gctx.lineTo(mapX(p1.length - 1), PT + cH);
          gctx.closePath();
          gctx.fillStyle = grad1; gctx.fill();

          gctx.beginPath();
          p1.forEach(function (p, idx) {
            if (idx === 0) gctx.moveTo(mapX(0), mapY(p[1] || 0));
            else gctx.lineTo(mapX(idx), mapY(p[1] || 0));
          });
          gctx.strokeStyle = '#c084fc'; gctx.lineWidth = 2.2; gctx.stroke();
        }

        if (state.fridgeFilter === 'both' || state.fridgeFilter === 'f2') {
          const grad2 = gctx.createLinearGradient(0, PT, 0, PT + cH);
          grad2.addColorStop(0, 'rgba(34, 211, 238, 0.24)');
          grad2.addColorStop(1, 'rgba(34, 211, 238, 0.0)');
          gctx.beginPath();
          gctx.moveTo(mapX(0), PT + cH);
          p2.forEach(function (p, idx) { gctx.lineTo(mapX(idx), mapY(p[1] || 0)); });
          gctx.lineTo(mapX(p2.length - 1), PT + cH);
          gctx.closePath();
          gctx.fillStyle = grad2; gctx.fill();

          gctx.beginPath();
          p2.forEach(function (p, idx) {
            if (idx === 0) gctx.moveTo(mapX(0), mapY(p[1] || 0));
            else gctx.lineTo(mapX(idx), mapY(p[1] || 0));
          });
          gctx.strokeStyle = '#22d3ee'; gctx.lineWidth = 2.2; gctx.stroke();
        }

        gctx.restore();

        gctx.font = 'bold 9.5px system-ui';
        gctx.textAlign = 'right';
        gctx.fillStyle = '#c084fc'; gctx.fillText('● Fridge 1', rect.width - PR - 75, 12);
        gctx.fillStyle = '#22d3ee'; gctx.fillText('● Fridge 2', rect.width - PR, 12);

        gctx.fillStyle = '#a1a1aa';
        gctx.font = '9.5px system-ui';
        gctx.textAlign = 'center';
        const labelIntervals = Math.max(4, Math.floor(cW / 45));
        const step = Math.max(1, Math.ceil(n / (labelIntervals * state.zoom)));
        for (let i = 0; i < n; i += step) {
          const p = p1[i] || p2[i];
          if (!p) continue;
          const lx = mapX(i);
          if (lx > PL - 10 && lx < rect.width - PR) {
            const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
            const pkt = (typeof getKarachiDate === 'function')
              ? getKarachiDate(ts) : { hour: 0 };
            const ampm = pkt.hour >= 12 ? 'pm' : 'am';
            const hh = pkt.hour % 12 || 12;
            gctx.fillText(hh + ampm, lx, PT + cH + 16);
          }
        }

        if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < n) {
          const sx = mapX(state.scrubIdx);
          const v1 = p1[state.scrubIdx] ? p1[state.scrubIdx][1] || 0 : 0;
          const v2 = p2[state.scrubIdx] ? p2[state.scrubIdx][1] || 0 : 0;
          const topY = Math.min(mapY(v1), mapY(v2));

          gctx.save();
          gctx.beginPath();
          gctx.setLineDash([3, 3]);
          gctx.strokeStyle = 'rgba(255,255,255,0.7)';
          gctx.lineWidth = 1;
          gctx.moveTo(sx, PT); gctx.lineTo(sx, PT + cH); gctx.stroke();

          const tsArr = (p1[state.scrubIdx] || p2[state.scrubIdx]);
          const ts = tsArr[0];
          const tsMs = ts < 2e9 ? ts * 1000 : ts;
          const timeStr = formatPktTime(tsMs, 'time');
          const line1 = timeStr;
          const line2 = 'F1: ' + Math.round(v1) + 'W · F2: ' + Math.round(v2) + 'W';

          gctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          const boxW = Math.max(gctx.measureText(line1).width,
                                gctx.measureText(line2).width) + 16;
          const boxH = 34;

          let boxX = sx - boxW / 2;
          boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
          let boxY = topY - boxH - 10;
          if (boxY < PT + 4) boxY = topY + 10;

          gctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
          gctx.strokeStyle = 'var(--border, #3f3f46)';
          gctx.lineWidth = 1;
          gctx.beginPath();
          if (typeof gctx.roundRect === 'function') gctx.roundRect(boxX, boxY, boxW, boxH, 6);
          else gctx.rect(boxX, boxY, boxW, boxH);
          gctx.fill();
          gctx.stroke();

          gctx.fillStyle = 'var(--text-main, #f4f4f5)';
          gctx.textAlign = 'left';
          gctx.textBaseline = 'top';
          gctx.fillText(line1, boxX + 8, boxY + 5);

          gctx.fillStyle = '#c084fc';
          gctx.fillText(line2, boxX + 8, boxY + 18);
          gctx.restore();
        }
      } else {
        // Standard single-line feed
        const n = ptsData.length;
        if (n < 2) return;

        const maxW = Math.max(
          cfg.unit === 'W' ? 500 : 10,
          Math.max.apply(null, ptsData.map(function (p) { return p[1] || 0; })) * 1.15
        );
        const mapX = function (idx) { return mapXCoord(PL + (idx / (n - 1)) * cW); };
        const mapY = function (val) { return PT + cH - (Math.max(0, val) / maxW) * cH; };

        gctx.fillStyle = '#71717a';
        gctx.font = '9px system-ui';
        gctx.textAlign = 'right';
        for (let g = 0; g <= 4; g++) {
          const val = (g / 4) * maxW;
          const y = PT + cH - (g / 4) * cH;
          gctx.fillText(Math.round(val) + cfg.unit, PL - 5, y + 3);
          gctx.strokeStyle = 'rgba(255,255,255,0.06)';
          gctx.beginPath(); gctx.moveTo(PL, y); gctx.lineTo(PL + cW, y); gctx.stroke();
        }

        gctx.save();
        gctx.beginPath(); gctx.rect(PL, PT, cW, cH); gctx.clip();

        if (boxKey === 'grid' && ptsAux.length > 1) {
          gctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
          for (let i = 0; i < ptsAux.length; i++) {
            if (ptsAux[i][1] != null && ptsAux[i][1] < 50) {
              const x1 = mapXCoord(PL + (i / (ptsAux.length - 1)) * cW);
              const wBand = Math.max(2, (cW / ptsAux.length) * state.zoom);
              gctx.fillRect(x1, PT, wBand, cH);
            }
          }
        }

        const grad = gctx.createLinearGradient(0, PT, 0, PT + cH);
        grad.addColorStop(0, titleColor + '55');
        grad.addColorStop(1, titleColor + '00');

        gctx.beginPath();
        gctx.moveTo(mapX(0), PT + cH);
        ptsData.forEach(function (p, idx) { gctx.lineTo(mapX(idx), mapY(p[1] || 0)); });
        gctx.lineTo(mapX(n - 1), PT + cH);
        gctx.closePath();
        gctx.fillStyle = grad;
        gctx.fill();

        gctx.beginPath();
        ptsData.forEach(function (p, idx) {
          if (idx === 0) gctx.moveTo(mapX(0), mapY(p[1] || 0));
          else gctx.lineTo(mapX(idx), mapY(p[1] || 0));
        });
        gctx.strokeStyle = titleColor;
        gctx.lineWidth = 2;
        gctx.stroke();

        gctx.restore();

        gctx.fillStyle = '#a1a1aa';
        gctx.font = '9.5px system-ui';
        gctx.textAlign = 'center';
        const labelIntervals = Math.max(4, Math.floor(cW / 45));
        const step = Math.max(1, Math.ceil(n / (labelIntervals * state.zoom)));
        for (let i = 0; i < n; i += step) {
          const lx = mapX(i);
          if (lx > PL - 10 && lx < rect.width - PR) {
            const ts = ptsData[i][0] < 2e9 ? ptsData[i][0] * 1000 : ptsData[i][0];
            const pkt = (typeof getKarachiDate === 'function')
              ? getKarachiDate(ts) : { hour: 0 };
            const ampm = pkt.hour >= 12 ? 'pm' : 'am';
            const hh = pkt.hour % 12 || 12;
            gctx.fillText(hh + ampm, lx, PT + cH + 16);
          }
        }

        if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < n) {
          const sx = mapX(state.scrubIdx);
          const val = ptsData[state.scrubIdx][1] || 0;
          const sy = mapY(val);

          gctx.save();
          gctx.beginPath();
          gctx.setLineDash([3, 3]);
          gctx.strokeStyle = 'rgba(255,255,255,0.7)';
          gctx.lineWidth = 1;
          gctx.moveTo(sx, PT); gctx.lineTo(sx, PT + cH); gctx.stroke();

          gctx.beginPath();
          gctx.setLineDash([]);
          gctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
          gctx.fillStyle = titleColor; gctx.fill();
          gctx.strokeStyle = '#fff'; gctx.lineWidth = 2; gctx.stroke();

          const ts = ptsData[state.scrubIdx][0];
          const tsMs = ts < 2e9 ? ts * 1000 : ts;
          const timeStr = formatPktTime(tsMs, 'time');
          const valStr = cfg.unit === 'W'
            ? Math.round(val).toLocaleString() + ' W'
            : val.toFixed(1) + ' ' + cfg.unit;

          const line1 = timeStr;
          const line2 = '● Value: ' + valStr;

          gctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          const boxW = Math.max(gctx.measureText(line1).width,
                                gctx.measureText(line2).width) + 16;
          const boxH = 34;

          let boxX = sx - boxW / 2;
          boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
          let boxY = sy - boxH - 10;
          if (boxY < PT + 4) boxY = sy + 10;

          gctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
          gctx.strokeStyle = 'var(--border, #3f3f46)';
          gctx.lineWidth = 1;
          gctx.beginPath();
          if (typeof gctx.roundRect === 'function') gctx.roundRect(boxX, boxY, boxW, boxH, 6);
          else gctx.rect(boxX, boxY, boxW, boxH);
          gctx.fill();
          gctx.stroke();

          gctx.fillStyle = 'var(--text-main, #f4f4f5)';
          gctx.textAlign = 'left';
          gctx.textBaseline = 'top';
          gctx.fillText(line1, boxX + 8, boxY + 5);

          gctx.fillStyle = titleColor;
          gctx.fillText(line2, boxX + 8, boxY + 18);
          gctx.restore();
        }
      }
    } else {
      // ── 3. Month / Year bar chart ──
      const entries = Object.entries(dailyMap || {});
      const count = entries.length;
      if (count === 0) return;

      const maxKwh = Math.max(2, Math.max.apply(null,
        entries.map(function (e) { return e[1].totalWh / 1000; })) * 1.15);
      const barWidth = Math.max(2, Math.min(24 * state.zoom, (cW / count) * 0.7 * state.zoom));

      gctx.fillStyle = '#71717a';
      gctx.font = '9px system-ui';
      gctx.textAlign = 'right';
      for (let g = 0; g <= 4; g++) {
        const val = (g / 4) * maxKwh;
        const y = PT + cH - (g / 4) * cH;
        gctx.fillText(val.toFixed(1) + 'k', PL - 5, y + 3);
        gctx.strokeStyle = 'rgba(255,255,255,0.06)';
        gctx.beginPath(); gctx.moveTo(PL, y); gctx.lineTo(PL + cW, y); gctx.stroke();
      }

      gctx.save();
      gctx.beginPath(); gctx.rect(PL, PT, cW, cH); gctx.clip();

      entries.forEach(function (kv, idx) {
        const d = kv[1];
        const rawCenterX = PL + ((idx + 0.5) / count) * cW;
        const cx = mapXCoord(rawCenterX);

        if (cfg.isFridges) {
          const f1K = d.f1Wh / 1000;
          const f2K = d.f2Wh / 1000;
          const totalY  = PT + cH - ((f1K + f2K) / maxKwh) * cH;
          const f1SplitY = PT + cH - (f1K / maxKwh) * cH;

          gctx.fillStyle = '#c084fc';
          gctx.fillRect(cx - barWidth / 2, f1SplitY, barWidth, (PT + cH) - f1SplitY);

          gctx.fillStyle = '#22d3ee';
          gctx.fillRect(cx - barWidth / 2, totalY, barWidth, f1SplitY - totalY);
        } else {
          const dKwh = d.dayWh / 1000;
          const nKwh = d.nightWh / 1000;
          const totalY   = PT + cH - ((dKwh + nKwh) / maxKwh) * cH;
          const daySplitY = PT + cH - (dKwh / maxKwh) * cH;

          gctx.fillStyle = titleColor;
          gctx.fillRect(cx - barWidth / 2, daySplitY, barWidth, (PT + cH) - daySplitY);

          if (!cfg.hideNight) {
            gctx.fillStyle = '#c084fc';
            gctx.fillRect(cx - barWidth / 2, totalY, barWidth, daySplitY - totalY);
          }
        }

        if (state.scrubIdx === idx) {
          gctx.strokeStyle = '#ffffff';
          gctx.lineWidth = 1.5;
          const tK = d.totalWh / 1000;
          const barTopY = PT + cH - (tK / maxKwh) * cH;
          gctx.strokeRect(cx - barWidth / 2 - 1, barTopY - 1,
                          barWidth + 2, (PT + cH) - barTopY + 1);
        }
      });

      gctx.restore();

      if (cfg.isFridges) {
        gctx.font = 'bold 9.5px system-ui';
        gctx.textAlign = 'right';
        gctx.fillStyle = '#c084fc'; gctx.fillText('■ F1', rect.width - PR - 45, 12);
        gctx.fillStyle = '#22d3ee'; gctx.fillText('■ F2', rect.width - PR, 12);
      }

      gctx.fillStyle = '#a1a1aa';
      gctx.font = '9px system-ui';
      gctx.textAlign = 'center';
      const labelStep = Math.max(1, Math.ceil(count / (10 * state.zoom)));
      entries.forEach(function (kv, idx) {
        if (idx % labelStep === 0) {
          const rawCenterX = PL + ((idx + 0.5) / count) * cW;
          const cx = mapXCoord(rawCenterX);
          if (cx > PL - 10 && cx < rect.width - PR) {
            gctx.fillText(kv[1].dLabel, cx, PT + cH + 15);
          }
        }
      });

      if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < count) {
        const entry = entries[state.scrubIdx];
        const d = entry[1];
        const rawCenterX = PL + ((state.scrubIdx + 0.5) / count) * cW;
        const sx = mapXCoord(rawCenterX);
        const tK = d.totalWh / 1000;
        const sy = PT + cH - (tK / maxKwh) * cH;

        const line1 = d.dLabel;
        const line2 = cfg.isFridges
          ? ('F1: ' + (d.f1Wh / 1000).toFixed(1) + 'k · F2: ' +
             (d.f2Wh / 1000).toFixed(1) + 'k (' + tK.toFixed(1) + 'k)')
          : ('Total: ' + tK.toFixed(1) + ' kWh (PKR ' +
             Math.round(tK * rate).toLocaleString() + ')');

        gctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        const boxW = Math.max(gctx.measureText(line1).width,
                              gctx.measureText(line2).width) + 16;
        const boxH = 34;

        let boxX = sx - boxW / 2;
        boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
        let boxY = sy - boxH - 10;
        if (boxY < PT + 4) boxY = sy + 10;

        gctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
        gctx.strokeStyle = 'var(--border, #3f3f46)';
        gctx.lineWidth = 1;
        gctx.beginPath();
        if (typeof gctx.roundRect === 'function') gctx.roundRect(boxX, boxY, boxW, boxH, 6);
        else gctx.rect(boxX, boxY, boxW, boxH);
        gctx.fill();
        gctx.stroke();

        gctx.fillStyle = 'var(--text-main, #f4f4f5)';
        gctx.textAlign = 'left';
        gctx.textBaseline = 'top';
        gctx.fillText(line1, boxX + 8, boxY + 5);

        gctx.fillStyle = titleColor;
        gctx.fillText(line2, boxX + 8, boxY + 18);
      }
    }
  }

  // ─── Hover / scrub ──────────────────────────────────────────────────
  function handleHover(ctx, clientX) {
    const state = ctx.state;
    const cfg   = ctx.cfg;
    const isBattery = ctx.isBattery;
    const dom = ctx.dom;
    if (!state.cachedData) return;
    const rect = dom.canvas.getBoundingClientRect();
    const PL = 36, PR = 14, cW = rect.width - PL - PR;
    if (cW <= 0) return;
    const mouseX = clientX - rect.left;
    const centerX = PL + cW / 2;

    if (state.cachedData.isDayMode) {
      let n = 720;
      if (isBattery) {
        n = state.cachedData.totalPoints || 720;
      } else if (cfg.isFridges) {
        n = Math.max(
          (state.cachedData.ptsF1 && state.cachedData.ptsF1.length) || 0,
          (state.cachedData.ptsF2 && state.cachedData.ptsF2.length) || 0
        );
      } else {
        n = (state.cachedData.ptsData && state.cachedData.ptsData.length) || 0;
      }

      if (n > 1) {
        const relIdx = Math.round(
          ((mouseX - state.panX - centerX) / state.zoom + centerX - PL) / (cW / (n - 1))
        );
        const maxIdx = isBattery ? (state.cachedData.lastIdx || n) : n;
        if (relIdx >= 0 && relIdx < maxIdx) {
          state.scrubIdx = relIdx;
          FXA.redrawGraph(ctx);
        }
      }
    } else {
      const entries = Object.entries(state.cachedData.dailyMap || {});
      const count = entries.length;
      if (count > 0) {
        const relIdx = Math.floor(
          ((mouseX - state.panX - centerX) / state.zoom + centerX - PL) / (cW / count)
        );
        if (relIdx >= 0 && relIdx < count) {
          state.scrubIdx = relIdx;
          FXA.redrawGraph(ctx);
        }
      }
    }
  }

  FXA.redrawGraph  = redrawGraph;
  FXA.handleHover  = handleHover;
})();

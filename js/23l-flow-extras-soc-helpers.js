// js/23l-flow-extras-soc-helpers.js
// ─── SOC 24h visualizer helpers ────────────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  function _computeSocWindow(n, zoom, panX, cW) {
      if (n <= 0) return { startIdx: 0, visibleN: 0 };
      const visibleN = Math.max(2, n / zoom);
      let startIdx = (n - visibleN) / 2 - (panX / cW) * visibleN;
      const maxStart = Math.max(0, n - visibleN);
      if (startIdx < 0) startIdx = 0;
      if (startIdx > maxStart) startIdx = maxStart;
      return { startIdx, visibleN };
    }

  function _panXFromStartIdxSoc(n, zoom, startIdx, cW) {
      const visibleN = Math.max(2, n / zoom);
      const maxStart = Math.max(0, n - visibleN);
      if (startIdx < 0) startIdx = 0;
      if (startIdx > maxStart) startIdx = maxStart;
      return ((n - visibleN) / 2 - startIdx) * cW / visibleN;
    }

  function _attachSocChartZoom(canvas, state) {
      if (canvas.__socZoomAttached) return;
      canvas.__socZoomAttached = true;

      const PL = 34, PR = 10;
      let didPinchOrPan = false;

      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const cW = rect.width - PL - PR;
        if (cW <= 0) return;
        const mx = e.clientX - rect.left;
        const frac = Math.max(0, Math.min(1, (mx - PL) / cW));
        const n = state.bars.length;
        const win0 = _computeSocWindow(n, state.zoom, state.panX, cW);
        const anchorIdx = win0.startIdx + frac * win0.visibleN;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        let nz = state.zoom * factor;
        nz = Math.max(0.4, Math.min(25, nz));
        state.zoom = nz;
        const visibleN = Math.max(2, n / nz);
        state.panX = _panXFromStartIdxSoc(n, nz, anchorIdx - frac * visibleN, cW);
        state.redraw();
      }, { passive: false });

      let mDown = false, sx = 0, sp = 0;
      canvas.addEventListener('mousedown', function (e) {
        mDown = true; sx = e.clientX; sp = state.panX;
        canvas.classList.add('grabbing'); e.preventDefault();
      });
      window.addEventListener('mousemove', function (e) {
        if (!mDown) return;
        state.panX = sp + (e.clientX - sx);
        state.redraw();
      });
      window.addEventListener('mouseup', function () {
        if (!mDown) return;
        mDown = false; canvas.classList.remove('grabbing');
      });

      let tMode = null, tX0 = 0, tPan0 = 0;
      let tDist0 = 0, tZoom0 = 1, tAnchorFrac = 0, tAnchorIdx = 0;

      function pinchInfo(e) {
        const rect = canvas.getBoundingClientRect();
        const cW = rect.width - PL - PR;
        const t0 = e.touches[0], t1 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
        const cx = (t0.clientX + t1.clientX) / 2 - rect.left;
        const frac = Math.max(0, Math.min(1, (cx - PL) / cW));
        return { dist, frac, cW };
      }

      canvas.addEventListener('touchstart', function (e) {
        if (e.touches.length === 1) {
          tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = state.panX;
          didPinchOrPan = false;
        } else if (e.touches.length === 2) {
          tMode = 'pinch';
          didPinchOrPan = true;
          const info = pinchInfo(e);
          const n = state.bars.length;
          const win = _computeSocWindow(n, state.zoom, state.panX, info.cW);
          tDist0 = info.dist; tZoom0 = state.zoom;
          tAnchorFrac = info.frac;
          tAnchorIdx = win.startIdx + info.frac * win.visibleN;
          e.preventDefault();
        }
      }, { passive: false });

      canvas.addEventListener('touchmove', function (e) {
        if (tMode === 'pan' && e.touches.length === 1) {
          const dx = e.touches[0].clientX - tX0;
          if (Math.abs(dx) > 4) didPinchOrPan = true;
          state.panX = tPan0 + dx;
          state.redraw(); e.preventDefault();
        } else if (tMode === 'pinch' && e.touches.length === 2) {
          didPinchOrPan = true;
          const info = pinchInfo(e);
          if (tDist0 <= 0) return;
          let nz = tZoom0 * (info.dist / tDist0);
          nz = Math.max(0.4, Math.min(25, nz));
          state.zoom = nz;
          const n = state.bars.length;
          const visibleN = Math.max(2, n / nz);
          state.panX = _panXFromStartIdxSoc(n, nz, tAnchorIdx - tAnchorFrac * visibleN, info.cW);
          state.redraw(); e.preventDefault();
        }
      }, { passive: false });

      canvas.addEventListener('touchend', function (e) {
        if (e.touches.length === 0) {
          tMode = null;
        } else if (e.touches.length === 1) {
          tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = state.panX;
        }
      });

      canvas.addEventListener('dblclick', function (e) { e.preventDefault(); state.reset(); });
      canvas.style.cursor = 'grab';
    }

  function _drawAnnotatedSocChart(canvas, bars, sessions, resSec, startMs, packKwh, zoom, panX) {
      zoom = zoom || 1; panX = panX || 0;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const PL = 36, PR = 12, PT = 24, PB = 34;
      const cW = rect.width - PL - PR;
      const cH = rect.height - PT - PB;
      if (cW <= 0 || cH <= 0) return;
      const n = bars.length;

      const win = _computeSocWindow(n, zoom, panX, cW);
      const startIdx = win.startIdx, visibleN = win.visibleN;
      const i0 = Math.max(0, Math.floor(startIdx));
      const i1 = Math.min(n - 1, Math.ceil(startIdx + visibleN));

      const visible = [];
      for (let i = i0; i <= i1; i++) if (bars[i] != null) visible.push(bars[i]);
      let minV = visible.length ? Math.min(...visible) : 0;
      let maxV = visible.length ? Math.max(...visible) : 100;
      if (maxV >= 96) maxV = 103; else maxV = Math.min(103, maxV + 5);
      minV = Math.max(0, minV - 4);
      const range = Math.max(10, maxV - minV);

      function mapX(i) { return PL + ((i - startIdx) / visibleN) * cW; }
      function mapY(v) { return PT + cH - ((v - minV) / range) * cH; }
      function mapCurveY(v) {
        const y = mapY(v);
        const y100 = mapY(100);
        const distFrom100 = y - y100;
        if (distFrom100 < 15 && y100 >= PT) {
          const blend = Math.max(0, 1 - distFrom100 / 15);
          return y + (3 * blend);
        }
        return y;
      }

      ctx.fillStyle = '#71717a';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      const gridTicks = [20, 40, 60, 80, 100].filter(v => v >= minV && v <= 100);
      gridTicks.forEach(val => {
        const y = mapY(val);
        ctx.fillText(Math.round(val) + '%', PL - 5, y + 3);
        ctx.strokeStyle = val === 100 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        if (val === 100) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
        ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
        ctx.setLineDash([]);
      });

      const firstVisTs = startMs + i0 * resSec * 1000;
      const lastVisTs  = startMs + Math.min(n - 1, i1) * resSec * 1000;
      const firstTimeStr = formatPktTime(firstVisTs, 'time');
      const lastTimeStr  = formatPktTime(lastVisTs, 'time');
      const visDurationHours = ((lastVisTs - firstVisTs) / 3600000).toFixed(1);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🕒 ${firstTimeStr} → ${lastTimeStr} (${visDurationHours}h)`, rect.width - PR - 2, 12);

      const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
      grad.addColorStop(0, '#10b98155');
      grad.addColorStop(1, '#10b98100');

      ctx.save();
      ctx.beginPath();
      ctx.rect(PL, PT, cW, cH);
      ctx.clip();

      ctx.beginPath();
      let started = false, firstX = null, lastX = null;
      for (let i = i0; i <= i1; i++) {
        if (bars[i] == null) continue;
        const x = mapX(i), y = mapCurveY(bars[i]);
        if (!started) { firstX = x; ctx.moveTo(x, PT + cH); ctx.lineTo(x, y); started = true; }
        else ctx.lineTo(x, y);
        lastX = x;
      }
      if (started && lastX != null) {
        ctx.lineTo(lastX, PT + cH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      started = false;
      for (let i = i0; i <= i1; i++) {
        if (bars[i] == null) { started = false; continue; }
        const x = mapX(i), y = mapCurveY(bars[i]);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      sessions.forEach(seg => {
        if (seg.endIdx < i0 || seg.startIdx > i1) return;
        const isCharge = seg.type === 'charge';
        const clr = isCharge ? '#4ade80' : '#fb923c';

        const ranges = (seg.ranges && seg.ranges.length) ? seg.ranges : [{ startIdx: seg.startIdx, endIdx: seg.endIdx }];
        ranges.forEach(rng => {
          if (rng.endIdx < i0 || rng.startIdx > i1) return;
          ctx.save();
          ctx.beginPath();
          let first = true;
          for (let k = Math.max(rng.startIdx, i0); k <= Math.min(rng.endIdx, i1); k++) {
            if (bars[k] == null) continue;
            const x = mapX(k), y = mapCurveY(bars[k]);
            if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = clr;
          ctx.lineWidth = 3;
          ctx.shadowColor = clr;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.restore();
        });

        if (ranges.length > 1) {
          for (let r = 0; r < ranges.length - 1; r++) {
            const r1 = ranges[r];
            const r2 = ranges[r + 1];
            if (r2.startIdx < i0 || r1.endIdx > i1) continue;
            const v1 = bars[r1.endIdx];
            const v2 = bars[r2.startIdx];
            if (v1 == null || v2 == null) continue;
            const x1 = mapX(r1.endIdx), y1 = mapCurveY(v1);
            const x2 = mapX(r2.startIdx), y2 = mapCurveY(v2);
            const dropY = 14;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 + dropY);
            ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();

            ctx.beginPath();
            for (let k = Math.max(r1.endIdx, i0); k <= Math.min(r2.startIdx, i1); k++) {
              if (bars[k] == null) continue;
              const px = mapX(k), py = mapCurveY(bars[k]) + dropY;
              if (k === Math.max(r1.endIdx, i0)) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.setLineDash([5, 4]); ctx.strokeStyle = clr; ctx.lineWidth = 2.5; ctx.stroke();

            ctx.beginPath(); ctx.setLineDash([]);
            ctx.moveTo(x2, y2 + dropY); ctx.lineTo(x2, y2);
            ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
          }
        }
      });

      ctx.restore();

      const isNarrow = cW < 320;
      const renderedPills = [];

      sessions.forEach(seg => {
        if (seg.endIdx < i0 || seg.startIdx > i1) return;
        const isCharge = seg.type === 'charge';
        const clr = isCharge ? '#4ade80' : '#fb923c';
        const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
        const borderClr = isCharge ? '#10b981' : '#f97316';

        let targetRange = { startIdx: seg.startIdx, endIdx: seg.endIdx };
        if (seg.ranges && seg.ranges.length > 1) {
          targetRange = seg.ranges.reduce((best, r) => (r.endIdx - r.startIdx > best.endIdx - best.startIdx ? r : best), seg.ranges[0]);
        }
        const midIdx = Math.round((targetRange.startIdx + targetRange.endIdx) / 2);
        const midVal = bars[Math.min(n - 1, Math.max(0, midIdx))];
        if (midVal == null) return;
        const midX = mapX(midIdx), midY = mapCurveY(midVal);
        if (midX < PL - 30 || midX > PL + cW + 30) return;

        const durH = Math.floor(seg.durMin / 60);
        const durM = Math.round(seg.durMin % 60);
        const durStr = durH > 0 ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`) : `${durM}m`;
        const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
        const sign = isCharge ? '+' : '-';
        const avgW = seg.durMin > 0 ? Math.round((kwhEst * 1000) / (seg.durMin / 60)) : 0;
        const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

        let text = isNarrow
          ? `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}k · Ø ${avgStr})`
          : `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}kWh · Ø ${avgStr})`;

        ctx.font = `bold ${isNarrow ? 9.5 : 10.5}px system-ui, -apple-system, sans-serif`;
        const tw = ctx.measureText(text).width;
        const pw = tw + (isNarrow ? 10 : 14);
        const ph = isNarrow ? 18 : 20;

        let bx = midX - pw / 2;
        bx = Math.max(PL + 2, Math.min(rect.width - PR - pw - 2, bx));

        let by = isCharge
          ? ((midY > PT + ph + 10) ? (midY - ph - 8) : (midY + 8))
          : ((midVal > 32 && midY < PT + cH - ph - 10) ? (midY + 8) : (midY - ph - 8));

        by = Math.max(PT + 2, Math.min(PT + cH - ph - 5, by));
        renderedPills.push({ x: bx, y: by, w: pw, h: ph });

        ctx.save();
        ctx.fillStyle = bgClr;
        ctx.strokeStyle = borderClr;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, pw, ph, 5);
        else ctx.rect(bx, by, pw, ph);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(midX, by > midY ? by : by + ph);
        ctx.lineTo(midX, midY);
        ctx.strokeStyle = borderClr;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + pw / 2, by + ph / 2 + 0.5);
        ctx.restore();
      });

      const labelY = PT + cH + 17;
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(firstTimeStr, PL, labelY);
      ctx.textAlign = 'right';
      ctx.fillText(lastTimeStr, PL + cW, labelY);

      ctx.fillStyle = '#a1a1aa';
      ctx.font = '9.5px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';

      const maxLabels = Math.max(3, Math.floor(cW / 55));
      const step = Math.max(1, Math.ceil(visibleN / maxLabels));
      const firstTick = Math.ceil(startIdx / step) * step;

      for (let i = firstTick; i < startIdx + visibleN; i += step) {
        if (i < 0 || i >= n) continue;
        const tsMs = startMs + i * resSec * 1000;
        const d = new Date(tsMs);
        const isPkt = (new Date().getTimezoneOffset() === -300);
        const h = isPkt ? d.getHours() : new Date(tsMs + 18000000).getUTCHours();
        const m = isPkt ? d.getMinutes() : new Date(tsMs + 18000000).getUTCMinutes();
        const hh = h % 12 || 12;
        const ampm = (h >= 12 ? 'pm' : 'am');
        const timeStr = (zoom > 3 && m !== 0) ? `${hh}:${String(m).padStart(2,'0')}${ampm}` : `${hh}${ampm}`;
        const x = mapX(i);
        if (x > PL + 40 && x < PL + cW - 40) {
          ctx.fillText(timeStr, x, labelY);
        }
      }
    }


  // ── Attach shared symbols to FX ──
  FX._computeSocWindow = _computeSocWindow;
  FX._panXFromStartIdxSoc = _panXFromStartIdxSoc;
  FX._attachSocChartZoom = _attachSocChartZoom;
  FX._drawAnnotatedSocChart = _drawAnnotatedSocChart;
})();

// js/19d5-graphs-render-chart.js
// ─── Main chart drawing function ────────────────────────────────────────────

function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx, multiData,
  minV, maxV, range, barsTemp = [], tempMinV = 0, tempMaxV = 100, tempRange = 100, tempUnit = '°C', tempColor = '#10b981', overlayLabel = '') {
  _attachDirectZoom(canvas);
  if (graphTab === 'day') { _showRefreshPulse(); }
  else { const pulse = document.getElementById('graph-pulse'); if (pulse) pulse.remove(); }
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const PL = 38, PR = 10, PT = 12, PB = 34;
  const cW = rect.width  - PL - PR;
  const cH = rect.height - PT - PB;
  const maxPan = (cW / 2) * (graphZoomLevel - 1);
  const minPan = -maxPan;
  graphPanOffset = Math.max(minPan, Math.min(maxPan, graphPanOffset));
  const zoom = graphZoomLevel;
  const panX = graphPanOffset;
  const centerX = PL + cW / 2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;
  const chartType = graphChartType || 'line';
  const isTemp = (unit === '°C' || graphFeedKey.startsWith('temp'));
  const isKwhView = (graphTab === 'month' || graphTab === 'year');
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.fillStyle = '#71717a';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'right';
  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    const val = minV + (i / numGridLines) * range;
    const y   = PT + cH - (i / numGridLines) * cH;
    let lbl = isKwhView ? val.toFixed(1) : (isTemp ? val.toFixed(1) + '°' : Math.round(val).toLocaleString());
    ctx.fillText(lbl, PL - 5, y + 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
  }
  if (barsTemp && barsTemp.length > 0) {
    ctx.textAlign = 'left';
    const rightX = PL + cW + 5;
    for (let i = 0; i <= numGridLines; i++) {
      const val = tempMinV + (i / numGridLines) * tempRange;
      const y = PT + cH - (i / numGridLines) * cH;
      const lbl = (tempUnit === 'kWh') ? val.toFixed(1) : Math.round(val).toLocaleString();
      ctx.fillText(lbl, rightX, y + 3);
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(PL, PT, cW, cH); ctx.clip();
  const n = (nav && nav.nBars) ? nav.nBars : (bars1.length || (multiData?.[0]?.data?.length ?? 0));
  if (n > 0) {
    if (multiData && multiData.length > 0) {
      multiData.forEach(line => {
        _renderPlot(ctx, line.data, n, line.color, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, false);
      });
    } else {
      if (isCombined || (graphFeedKey.startsWith('temp') && bars2.length)) {
        const c2 = graphFeedKey.startsWith('temp') ? '#6366f1' : color2;
        _renderPlot(ctx, bars2, n, c2, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, true);
      }
      _renderPlot(ctx, bars1, n, color1, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, false);
    }
    if (barsTemp && barsTemp.length > 0) {
      _renderPlot(ctx, barsTemp, n, tempColor, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
    }
    if (graphDataCache.barsTemp2 && graphDataCache.barsTemp2.length > 0) {
      _renderPlot(ctx, graphDataCache.barsTemp2, n, graphDataCache.tempColor2, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
    }
    if (graphDataCache.barsTemp3 && graphDataCache.barsTemp3.length > 0) {
      _renderPlot(ctx, graphDataCache.barsTemp3, n, graphDataCache.tempColor3, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
    }
  }
  ctx.restore();

  // ─── Battery Charge / Discharge Callouts (Day View) ───────────────────
  if (graphTab === 'day' && graphFeedKey === 'battery' && window.graphBatteryShowSessions !== false && typeof detectBatterySessions === 'function') {
    const resSec = (nav && nav.resSeconds) ? nav.resSeconds : 120;
    const sessions = detectBatterySessions(bars1, resSec, lastIdx, 10, 2.0);
    const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

    sessions.forEach(seg => {
      const isCharge = seg.type === 'charge';
      const clr = isCharge ? '#4ade80' : '#fb923c';
      const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
      const borderClr = isCharge ? '#10b981' : '#f97316';

      // 1. Accent glow line along slope
      ctx.save();
      ctx.beginPath();
      for (let k = seg.startIdx; k <= seg.endIdx; k++) {
        const val = (bars1[k] <= 10 && k > 0) ? bars1[k - 1] : bars1[k];
        const px = mapX(PL + (k / n) * cW);
        const py = PT + cH - ((val - minV) / range) * cH;
        if (k === seg.startIdx) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = clr;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = clr;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // 2. Badge Pill
      const midIdx = Math.round((seg.startIdx + seg.endIdx) / 2);
      const midVal = (bars1[midIdx] <= 10 && midIdx > 0) ? bars1[midIdx - 1] : bars1[midIdx];
      const midX = mapX(PL + (midIdx / n) * cW);
      const midY = PT + cH - ((midVal - minV) / range) * cH;

      if (midX < PL - 40 || midX > rect.width) return;

      let durStr = '';
      if (seg.durMin >= 60) {
        const h = Math.floor(seg.durMin / 60);
        const m = seg.durMin % 60;
        durStr = m > 0 ? (h + 'h ' + m + 'm') : (h + 'h');
      } else {
        durStr = seg.durMin + 'm';
      }

      const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
      const sign = isCharge ? '+' : '';
      const text = (isCharge ? '▲' : '▼') + ' ' + sign + seg.delta.toFixed(1) + '% · ' + durStr + ' (' + kwhEst.toFixed(1) + 'kWh)';

      ctx.save();
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      const tw = ctx.measureText(text).width;
      const pw = tw + 14;
      const ph = 20;

      let bx = midX - pw / 2;
      let by = isCharge ? (midY - ph - 12) : (midY + 12);

      bx = Math.max(PL + 4, Math.min(rect.width - PR - pw - 4, bx));
      if (by < PT + 4) by = midY + 12;
      if (by > PT + cH - ph - 4) by = midY - ph - 10;

      // Draw pill background
      ctx.fillStyle = bgClr;
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, pw, ph, 6);
      } else {
        ctx.rect(bx, by, pw, ph);
      }
      ctx.fill();
      ctx.stroke();

      // Connector tick
      ctx.beginPath();
      ctx.moveTo(midX, isCharge ? by + ph : by);
      ctx.lineTo(midX, midY);
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + pw / 2, by + ph / 2);
      ctx.restore();
    });
  }

  ctx.fillStyle = '#71717a';
  ctx.textAlign = 'center';
  ctx.font = '9px system-ui';
  const isZoomed = zoom > 2;
  const maxLabels = Math.max(3, Math.floor(cW / 45));
  const labelStep = Math.max(1, Math.ceil(n / (maxLabels * zoom)));
  const displayLabels = (isZoomed && nav && nav.fullLabels) ? nav.fullLabels : (labels || []);
  for (let i = 0; i < n; i += labelStep) {
    const lx = mapX(PL + (i / n) * cW);
    if (lx > PL - 10 && lx < rect.width - PR) {
      let label = displayLabels[i] || '';
      if (!isZoomed && label.includes(':')) {
        const match = label.match(/^(\d+):/);
        if (match) {
          const hour = parseInt(match[1]);
          const ampm = label.includes('pm') ? 'pm' : 'am';
          label = `${hour}${ampm}`;
        }
      }
      ctx.fillText(label, lx, rect.height - 12);
    }
  }
}
window._drawChart = _drawChart;

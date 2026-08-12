// js/19d6-graphs-render-plot.js
// ─── Low-level plot rendering (bars / lines) ────────────────────────────────

function _renderPlot(ctx, data, n, clr, type, mapX, PL, PT, cW, cH, min, range, lastIdx, isSecondary, isDashed = false) {
  if (type === 'bar' || type === 'hourly') {
    const barWidth = Math.max(1, (cW / n) * 0.7);
    const offset = isSecondary ? barWidth * 0.4 : 0;
    ctx.fillStyle = clr;
    ctx.globalAlpha = isSecondary ? 0.4 : 0.8;
    for (let i = 0; i < lastIdx; i++) {
      const val = data[i];
      if (val == null) continue;
      const x = mapX(PL + (i / n) * cW) - barWidth / 2 + offset;
      const y = PT + cH - ((val - min) / range) * cH;
      ctx.fillRect(x, y, barWidth * 0.9, (PT + cH) - y);
    }
    ctx.globalAlpha = 1.0;
  } else {
    ctx.beginPath();
    ctx.strokeStyle = clr;
    ctx.lineWidth = isSecondary ? 1.5 : 2.5;
    if (isDashed) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
    let started = false;
    for (let i = 0; i < lastIdx; i++) {
      const val = data[i];
      if (val == null) { started = false; continue; }
      const x = mapX(PL + (i / n) * cW);
      const y = PT + cH - ((val - min) / range) * cH;
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

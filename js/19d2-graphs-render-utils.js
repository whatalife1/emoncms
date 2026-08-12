// js/19d2-graphs-render-utils.js
// ─── Fast redraw & refresh pulse indicator ──────────────────────────────────

function _fastRedraw() {
  const canvas = document.getElementById('graph-canvas');
  if (canvas && graphDataCache) {
    const c = graphDataCache;
    _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined, c.nav, c.lastIdx, c.multiData,
      c.minV, c.maxV, c.range, c.barsTemp, c.tempMinV, c.tempMaxV, c.tempRange, c.tempUnit, c.tempColor, c.overlayLabel);
  }
}

function _showRefreshPulse() {
  const oldPulse = document.getElementById('graph-pulse');
  if (oldPulse) oldPulse.remove();
  if (graphTab !== 'day') return;
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  const pulse = document.createElement('div');
  pulse.id = 'graph-pulse';
  pulse.style.cssText = `
    position: absolute; bottom: 8px; right: 8px; width: 8px; height: 8px;
    border-radius: 50%; background: var(--accent-solar);
    box-shadow: 0 0 8px var(--accent-solar);
    animation: pulse-dot 2s infinite; pointer-events: none; z-index: 10;
  `;
  if (!document.getElementById('pulse-dot-keyframes')) {
    const style = document.createElement('style');
    style.id = 'pulse-dot-keyframes';
    style.textContent = `
      @keyframes pulse-dot {
        0% { opacity: 0.3; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.2); }
        100% { opacity: 0.3; transform: scale(0.8); }
      }
    `;
    document.head.appendChild(style);
  }
  const card = canvas.closest('.graph-chart-card');
  if (card) { card.style.position = 'relative'; card.appendChild(pulse); }
}

window._fastRedraw = _fastRedraw;
window._showRefreshPulse = _showRefreshPulse;

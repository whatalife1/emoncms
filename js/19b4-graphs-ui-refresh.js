// js/19b4-graphs-ui-refresh.js
// ─── Auto-refresh & chart type toggle ───────────────────────────────────────

function startGraphsAutoRefresh() {
  if (graphsAutoRefreshInterval) clearInterval(graphsAutoRefreshInterval);
  if (graphTab === 'day') {
    graphsAutoRefreshInterval = setInterval(() => {
      const p = document.getElementById('graphs-panel');
      if (!p || !p.classList.contains('open')) { clearInterval(graphsAutoRefreshInterval); return; }
      if (!graphIsLoading && !graphIsPanning) {
        if (typeof _loadAndDraw === 'function') _loadAndDraw();
      }
    }, 60000);
  }
}

function stopGraphsAutoRefresh() {
  if (graphsAutoRefreshInterval) clearInterval(graphsAutoRefreshInterval);
}

function _renderChartTypeToggle() {
  const existing = document.getElementById('chart-type-toggle'); if (existing) existing.remove();
  const card = document.querySelector('.graph-chart-card'); if (!card) return;
  const toggle = document.createElement('div'); toggle.id = 'chart-type-toggle';
  toggle.style.cssText = `position:absolute; top:8px; right:8px; z-index:15; display:flex; flex-direction:column; gap:4px; background: var(--bg-panel); padding: 4px; border-radius: 8px; box-shadow: -2px 2px 8px rgba(0,0,0,0.4);`;
  [{ type: 'line', label: 'Line' }, { type: 'bar', label: 'Bar' }, { type: 'hourly', label: 'Hourly' }].forEach(({ type, label }) => {
    const btn = document.createElement('button'); const active = graphChartType === type;
    btn.textContent = label;
    btn.style.cssText = `padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; width:auto; background:${active ? 'var(--bg-base)' : 'rgba(0,0,0,0.45)'}; border:1px solid ${active ? 'var(--border)' : 'transparent'}; color:var(--text-main); opacity:${active ? '1' : '0.55'}; font-weight:700;`;
    btn.addEventListener('click', () => { graphChartType = type; _renderChartTypeToggle(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
    toggle.appendChild(btn);
  });
  card.appendChild(toggle);
}
window._renderChartTypeToggle = _renderChartTypeToggle;

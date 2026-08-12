// js/19b6-graphs-ui-panel.js
// ─── Panel open/close & main render orchestrator ────────────────────────────

function openGraphsPanel() {
  const p = document.getElementById('graphs-panel'); if (!p) return;
  if (navigator.userAgent.toLowerCase().includes('windows')) p.classList.add('fullscreen');
  p.classList.add('open');
  setTimeout(() => { renderGraphsPanel(); if (graphTab === 'day') startGraphsAutoRefresh(); }, 50);
}

function closeGraphsPanel() {
  const p = document.getElementById('graphs-panel'); if (p) p.classList.remove('open');
  hideTooltip(); graphZoomLevel = 1; graphPanOffset = 0; stopGraphsAutoRefresh();
}

function renderGraphsPanel() {
  if (graphIsRendering) return; graphIsRendering = true;
  try {
    _renderGFeedTabs();
    _renderGTimeTabs();
    _renderGNavBar();
    _renderChartTypeToggle();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }
  catch(e) { console.warn('Graph render error:', e); } finally { graphIsRendering = false; }
}

window.renderGraphsPanel = renderGraphsPanel;
window.openGraphsPanel = openGraphsPanel;
window.closeGraphsPanel = closeGraphsPanel;

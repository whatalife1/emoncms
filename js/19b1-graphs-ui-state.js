// js/19b1-graphs-ui-state.js
// ─── Graphs UI state & small helpers ────────────────────────────────────────

let graphNeedsDayZoom = false;
let tooltipPinned = false;
let graphsAutoRefreshInterval = null;
let graphsLastUpdate = 0;

window.graphDayStartHour = 5;
try {
  const saved = localStorage.getItem('graphDayStartHour');
  if (saved !== null) window.graphDayStartHour = parseInt(saved) || 5;
} catch(e) {}

function hideTooltip() {
  const t = document.getElementById('graph-tooltip');
  if (t) { t.style.display = 'none'; t.classList.remove('pinned'); }
  tooltipPinned = false;
}

function updateGraphStartButton() {
  const btn = document.getElementById('graph-start-toggle');
  if (!btn) return;
  const label = window.graphDayStartHour === 5 ? '5am-5am' : '12am-12am';
  btn.textContent = label;
  btn.title = 'Toggle day start time';
}

window.updateGraphStartButton = updateGraphStartButton;
window.hideTooltip = hideTooltip;

window.toggleGraphStartHour = function() {
  window.graphDayStartHour = window.graphDayStartHour === 5 ? 0 : 5;
  localStorage.setItem('graphDayStartHour', window.graphDayStartHour);
  if (window.graphTab === 'day') {
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }
  updateGraphStartButton();
};

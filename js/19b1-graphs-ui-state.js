// js/19b1-graphs-ui-state.js
// ─── Graphs UI state & small helpers ────────────────────────────────────────

let graphNeedsDayZoom = false;
let tooltipPinned = false;
let graphsAutoRefreshInterval = null;
let graphsLastUpdate = 0;

window.graphDayStartHour = 7;
try {
  const saved = localStorage.getItem('graphDayStartHour');
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    window.graphDayStartHour = (parsed === 0 || parsed === 7) ? parsed : 7;
  } else {
    localStorage.setItem('graphDayStartHour', '7');
  }
} catch(e) { window.graphDayStartHour = 7; }

function hideTooltip() {
  const t = document.getElementById('graph-tooltip');
  if (t) { t.style.display = 'none'; t.classList.remove('pinned'); }
  tooltipPinned = false;
}

function updateGraphStartButton() {
  const btn = document.getElementById('graph-start-toggle');
  if (!btn) return;
  if (typeof graphTab !== 'undefined' && graphTab !== 'day') {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  const label = window.graphDayStartHour === 7 ? '4pm-7am' : '12am-12am';
  btn.textContent = label;
  btn.title = window.graphDayStartHour === 7 ? 'Cycle: 4pm-7am (7am start). Click for 12am-12am' : 'Cycle: 12am-12am. Click for 4pm-7am';
}

window.updateGraphStartButton = updateGraphStartButton;
window.hideTooltip = hideTooltip;

window.toggleGraphStartHour = function() {
  window.graphDayStartHour = window.graphDayStartHour === 7 ? 0 : 7;
  try {
    localStorage.setItem('graphDayStartHour', window.graphDayStartHour.toString());
  } catch(e) {}

  if (typeof fetchTodayBatteryEnergy === 'function') {
    fetchTodayBatteryEnergy().then(() => {
      if (window.lastResultsMap && typeof renderResults === 'function') {
        renderResults(Array.from(window.lastResultsMap.values()));
      }
    });
  }

  if (window.graphTab === 'day') {
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }
  updateGraphStartButton();
};

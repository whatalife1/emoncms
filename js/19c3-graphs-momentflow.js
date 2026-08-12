// js/19c3-graphs-momentflow.js
// ─── Moment Flow Inspector mode ─────────────────────────────────────────────

async function _handleMomentFlowMode(nav, stat, canvas) {
  const allInspFeeds = [
    { key: 'solar',   name: 'Solar',        id: '499380', color: '#facc15' },
    { key: 'grid',    name: 'Grid',         id: '499374', color: '#ef4444' },
    { key: 'k15',     name: 'Kenwood 1.5T', id: '499362', color: '#38bdf8' },
    { key: 'k1',      name: 'Kenwood 1T',   id: '499364', color: '#7dd3fc' },
    { key: 'haier',   name: 'Haier 1T',     id: '499367', color: '#a5f3fc' },
    { key: 'fridge1', name: 'Fridge 1',     id: '499373', color: '#c084fc' },
    { key: 'fridge2', name: 'Fridge 2',     id: '541348', color: '#22d3ee' },
    { key: 'pc',      name: 'PC',           id: '499422', color: '#4ade80' },
    { key: 'motor',   name: 'Water Motor',  id: '542850', color: '#fbbf24' },
    { key: 'wm',      name: 'Washing M/C', id: '544694', color: '#e879f9' }
  ];
  const results = await Promise.all(
    allInspFeeds.map(f => _gFetch(f.id, nav.startMs, nav.endMs, nav.interval))
  );
  const multiData = allInspFeeds.map((f, i) => ({
    key: f.key,
    label: f.name,
    color: f.color,
    data: _pointsToBars(results[i], nav, f.key),
    rawPts: results[i]
  }));
  const bars1 = multiData.find(m => m.key === 'solar')?.data || [];
  const bars2 = multiData.find(m => m.key === 'grid')?.data || [];
  let maxV = 1;
  const allVals = multiData.flatMap(m => m.data).filter(v => v > 0);
  if (allVals.length) maxV = Math.max(...allVals) * 1.1;
  graphDataCache = {
    bars1, bars2,
    labels: nav.labels,
    timeLabels: nav.timeLabels || nav.labels,
    fullLabels: nav.fullLabels || nav.labels,
    color1: '#facc15', color2: '#ef4444', unit: 'W',
    isCombined: true, isMomentFlow: true, nav,
    lastIdx: bars1.length, multiData,
    minV: 0, maxV, range: maxV
  };
  canvas.style.display = 'block';
  const reportDiv = document.getElementById('graph-report-view');
  if (reportDiv) reportDiv.style.display = 'none';
  _drawChart(canvas, bars1, bars2, nav.labels, '#facc15', '#ef4444', 'W', true, nav, bars1.length, multiData, 0, maxV, maxV);
  stat.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--accent-solar); border-radius:8px; padding:8px 12px; font-size:11px; color:var(--text-main); margin-bottom:6px;">
      <span style="color:var(--accent-solar); font-weight:800; font-size:12px;">🔍 Moment Flow Inspector Active</span><br>
      Scrub across the graph starting from <b>${window.graphDayStartHour}:00 AM</b>. The top Power Flow SVG diagram and tooltip show live Grid, Solar, Load, and Appliance Day/Night Watts & kWh.
    </div>
  `;
  _showGraphLoading(false);
  graphIsLoading = false;
}

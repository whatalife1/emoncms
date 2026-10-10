// js/23f-flow-extras-grid.js
// ─── Grid popup extras ─────────────────────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    row, getFeedVal, fetch24h, pkrRate, fmtDuration, fmtPkr,
    detectSessions, totalRuntimeMin, buildGenericApplianceDailyGrid
  } = FX;

  async function buildGridExtras() {
      const gridHtml = await buildGenericApplianceDailyGrid({
        title: '⚡ DAILY GRID UNITS',
        titleColor: '#ef4444',
        feedId: (typeof FEEDS_BASE !== 'undefined' && FEEDS_BASE.find(f => f.name === 'Breaker'))?.id || '499374',
        liveTodayName: 'Breaker Today',
        hoverId: 'fd-grid-cell-hover',
        valColor: '#f87171'
      });

      let outageHtml = '';
      try {
        const pts = await fetch24h('acvolts', 300);
        if (Array.isArray(pts) && pts.length) {
          const sessions = detectSessions(pts.map(([t, v]) => [t, v != null && v < 50 ? 1 : 0]), 0.5, 1);
          const totalOutageMin = totalRuntimeMin(sessions);
          const count = sessions.length;
          outageHtml += row('Outages (24h)', count > 0 ? `${fmtDuration(totalOutageMin)} (${count}x)` : 'None', {
            color: count > 0 ? '#ef4444' : '#4ade80'
          });
          if (sessions.length) {
            const last = sessions[sessions.length - 1];
            outageHtml += row('Last outage', `${formatPktTime(last.start, 'time')} → ${formatPktTime(last.end, 'time')}`, {
              sub: fmtDuration(last.durMin)
            });
          }
        }
        const gridTodayKwh = getFeedVal('Breaker Today') || 0;
        outageHtml += row('Cost today', fmtPkr(gridTodayKwh * pkrRate()), { color: '#f87171', sub: `${gridTodayKwh.toFixed(1)} kWh imported` });
      } catch (e) {}

      return gridHtml + outageHtml;
    }


  // ── Attach shared symbols to FX ──
  FX.buildGridExtras = buildGridExtras;
})();

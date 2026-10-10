// js/23k-flow-extras-wm-pc.js
// ─── Washing machine & PC popup extras ─────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    row, fetch24h, pkrRate, fmtDuration, fmtPkr, detectSessions,
    totalRuntimeMin, energyKwhFromSessions, buildGenericApplianceDailyGrid
  } = FX;

  async function buildWmExtras() {
      const gridHtml = await buildGenericApplianceDailyGrid({
        title: '👕 WASHING MACHINE DAILY UNITS',
        titleColor: '#e879f9',
        feedId: '544694',
        liveTodayName: 'Washing Machine Today',
        hoverId: 'fd-wm-cell-hover',
        valColor: '#e879f9'
      });

      let extraRowsHtml = '';
      try {
        const pts = await fetch24h('wm', 300);
        if (Array.isArray(pts) && pts.length) {
          const sessions = detectSessions(pts, 20, 3);
          const kwh = energyKwhFromSessions(sessions);
          extraRowsHtml += row('Loads today', `${sessions.length}`, { color: '#e879f9' });
          if (sessions.length) {
            const last = sessions[sessions.length - 1];
            extraRowsHtml += row('Last load', `${formatPktTime(last.start, 'time')} → ${formatPktTime(last.end, 'time')}`, {
              sub: fmtDuration(last.durMin)
            });
            const avgDur = sessions.reduce((a, s) => a + s.durMin, 0) / sessions.length;
            extraRowsHtml += row('Avg cycle length', fmtDuration(avgDur));
          }
          extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
        }
      } catch (e) {}

      return gridHtml + extraRowsHtml;
    }

  async function buildPcExtras() {
      const gridHtml = await buildGenericApplianceDailyGrid({
        title: '💻 PC WORKSTATION DAILY UNITS',
        titleColor: '#4ade80',
        feedId: '499422',
        liveTodayName: 'PC Today',
        hoverId: 'fd-pc-cell-hover',
        valColor: '#4ade80',
        isPc: true
      });

      let extraRowsHtml = '';
      try {
        const pts = await fetch24h('pc', 300);
        if (Array.isArray(pts) && pts.length) {
          const sessions = detectSessions(pts, 20, 2);
          const runtimeMin = totalRuntimeMin(sessions);
          const kwh = energyKwhFromSessions(sessions);
          extraRowsHtml += row('Uptime (24h)', fmtDuration(runtimeMin), { color: '#4ade80' });
          extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
        }
      } catch (e) {}

      return gridHtml + extraRowsHtml;
    }


  // ── Attach shared symbols to FX ──
  FX.buildWmExtras = buildWmExtras;
  FX.buildPcExtras = buildPcExtras;
})();

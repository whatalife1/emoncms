// js/23j-flow-extras-water-motor.js
// ─── Water tank & motor popup extras ───────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    row, getFeedVal, fetch24h, pkrRate, fmtDuration, fmtPkr,
    detectSessions, totalRuntimeMin, energyKwhFromSessions, timeAgoStr,
    buildGenericApplianceDailyGrid
  } = FX;

  async function buildWaterTankExtras() {
      const gridHtml = await buildGenericApplianceDailyGrid({
        title: '💧 WATER TANK DAILY LEVEL (%)',
        titleColor: '#0ea5e9',
        feedId: '499431',
        liveTodayName: 'Water Tank',
        hoverId: 'fd-water-cell-hover',
        valColor: '#0ea5e9',
        isPct: true,
        hideNight: true
      });

      let extraRowsHtml = '';
      try {
        const lastOn = window.lastMotorOnTime || 0;
        if (lastOn) {
          extraRowsHtml += row('Last fill', timeAgoStr(lastOn), { sub: formatPktTime(lastOn, 'time') });
        }
        const curLevel = getFeedVal('Water Tank');
        if (curLevel != null) {
          extraRowsHtml += row('Current level', `${Math.round(curLevel)}%`, {
            color: curLevel > 50 ? '#38bdf8' : curLevel > 20 ? '#f59e0b' : '#ef4444'
          });
        }
      } catch (e) {}

      return gridHtml + extraRowsHtml;
    }

  async function buildMotorExtras() {
      const gridHtml = await buildGenericApplianceDailyGrid({
        title: '🚿 WATER MOTOR DAILY UNITS',
        titleColor: '#fbbf24',
        feedId: '542850',
        liveTodayName: 'Water Motor Today',
        hoverId: 'fd-motor-cell-hover',
        valColor: '#fbbf24'
      });

      let extraRowsHtml = '';
      try {
        const pts = await fetch24h('motor', 300);
        if (Array.isArray(pts) && pts.length) {
          const sessions = detectSessions(pts, 50, 1);
          const runtimeMin = totalRuntimeMin(sessions);
          const kwh = energyKwhFromSessions(sessions);
          extraRowsHtml += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#fbbf24', sub: `${sessions.length} cycle${sessions.length === 1 ? '' : 's'}` });
          extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
        }
      } catch (e) {}

      return gridHtml + extraRowsHtml;
    }


  // ── Attach shared symbols to FX ──
  FX.buildWaterTankExtras = buildWaterTankExtras;
  FX.buildMotorExtras = buildMotorExtras;
})();

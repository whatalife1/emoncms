// js/23i-flow-extras-fridge-ac.js
// ─── Fridge & AC popup extras ──────────────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    row, fetch24h, pkrRate, fmtDuration, fmtPkr, detectSessions,
    totalRuntimeMin, energyKwhFromSessions, buildGenericApplianceDailyGrid
  } = FX;

  async function buildFridgeExtras() {
      const [grid1Html, grid2Html] = await Promise.all([
        buildGenericApplianceDailyGrid({
          title: '🧊 FRIDGE 1 DAILY UNITS',
          titleColor: '#38bdf8',
          feedId: '499373',
          liveTodayName: 'Fridge Today',
          hoverId: 'fd-fridge1-cell-hover',
          valColor: '#38bdf8'
        }),
        buildGenericApplianceDailyGrid({
          title: '🧊 FRIDGE 2 DAILY UNITS',
          titleColor: '#c084fc',
          feedId: '541348',
          liveTodayName: 'Fridge2 Today',
          hoverId: 'fd-fridge2-cell-hover',
          valColor: '#c084fc'
        })
      ]);

      let dutyHtml = '';
      try {
        const [pts1, pts2] = await Promise.all([fetch24h('fridge1', 300), fetch24h('fridge2', 300)]);
        [{ label: 'Fridge 1', pts: pts1 }, { label: 'Fridge 2', pts: pts2 }].forEach(({ label, pts }) => {
          if (!Array.isArray(pts) || !pts.length) return;
          const sessions = detectSessions(pts, 6, 1);
          const runtimeMin = totalRuntimeMin(sessions);
          const dutyPct = (runtimeMin / (24 * 60)) * 100;
          const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
          dutyHtml += row(`${label} duty cycle`, `${dutyPct.toFixed(0)}%`, {
            color: dutyPct > 70 ? '#f59e0b' : '#4ade80',
            sub: `${fmtDuration(runtimeMin)} running \u00b7 avg ${Math.round(avgW)}W while on`
          });
        });
      } catch (e) {}

      return grid1Html + grid2Html + dutyHtml;
    }

  async function buildAcExtras(feedKey) {
      const acConfigs = {
        k15:   { title: '❄️ KENWOOD 1.5T DAILY UNITS', color: '#38bdf8', feedId: '499362', live: 'Kenwood 1.5Ton Today' },
        k1:    { title: '❄️ KENWOOD 1T DAILY UNITS',   color: '#7dd3fc', feedId: '499364', live: 'Kenwood 1Ton Today' },
        haier: { title: '❄️ HAIER 1T DAILY UNITS',     color: '#a5f3fc', feedId: '499367', live: 'Haier 1Ton Today' }
      };
      const cfg = acConfigs[feedKey] || acConfigs.k15;

      const gridHtml = await buildGenericApplianceDailyGrid({
        title: cfg.title,
        titleColor: cfg.color,
        feedId: cfg.feedId,
        liveTodayName: cfg.live,
        hoverId: `fd-${feedKey}-cell-hover`,
        valColor: cfg.color
      });

      let extraRowsHtml = '';
      try {
        const pts = await fetch24h(feedKey, 300);
        if (Array.isArray(pts) && pts.length) {
          const sessions = detectSessions(pts, 100, 2);
          const runtimeMin = totalRuntimeMin(sessions);
          const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
          const kwh = energyKwhFromSessions(sessions);
          extraRowsHtml += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#38bdf8', sub: `${sessions.length} session${sessions.length === 1 ? '' : 's'}` });
          if (sessions.length) {
            extraRowsHtml += row('Avg power while running', `${Math.round(avgW)} W`);
          }
          extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { color: '#f87171', sub: `${kwh.toFixed(2)} kWh` });
        }
      } catch (e) {}

      return gridHtml + extraRowsHtml;
    }


  // ── Attach shared symbols to FX ──
  FX.buildFridgeExtras = buildFridgeExtras;
  FX.buildAcExtras = buildAcExtras;
})();

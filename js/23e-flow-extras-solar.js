// js/23e-flow-extras-solar.js
// ─── Solar popup extras ────────────────────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    row, getFeedVal, fetch24h, buildGenericApplianceDailyGrid
  } = FX;

  async function buildSolarExtras() {
      let extraRowsHtml = '';
      try {
        const pts = await fetch24h('solar');
        let peakW = 0, peakTs = null;
        if (Array.isArray(pts) && pts.length) {
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i];
            if (!Array.isArray(p)) continue;
            const ts = p[0], v = p[1];
            if (v != null && v > peakW) { peakW = v; peakTs = ts < 2e9 ? ts * 1000 : ts; }
          }
        }
        const peakTimeStr = peakTs && typeof formatPktTime === 'function' ? formatPktTime(peakTs, 'time') : '';
        const solarTodayWh = (getFeedVal('Solar Today') || (window.monthlyUnits && window.monthlyUnits.solar_t) || 0) * 1000;
        const gridTodayWh = (getFeedVal('Breaker Today') || (window.monthlyUnits && window.monthlyUnits.gridT) || 0) * 1000;
        const totalTodayWh = solarTodayWh + gridTodayWh;
        const selfConsumptionPct = totalTodayWh > 0 ? (solarTodayWh / totalTodayWh * 100) : 0;
        const co2Kg = (solarTodayWh / 1000) * 0.4;

        extraRowsHtml += row('Peak today', `${Math.round(peakW)} W`, { color: '#facc15', sub: peakTimeStr ? `at ${peakTimeStr}` : '' });
        extraRowsHtml += row('Self-consumption', `${selfConsumptionPct.toFixed(0)}%`, { color: '#4ade80', sub: 'of today’s total energy use' });
        extraRowsHtml += row('Est. CO₂ saved today', `${co2Kg.toFixed(1)} kg`, { color: '#38bdf8', sub: 'rough estimate, 0.4 kg/kWh grid factor' });
      } catch (e) {}

      let gridHtml = '';
      try {
        gridHtml = await buildGenericApplianceDailyGrid({
          title: '☀️ DAILY SOLAR GENERATION',
          titleColor: '#f59e0b',
          feedId: (typeof FEEDS_BASE !== 'undefined' && FEEDS_BASE.find(f => f.name === 'Solar'))?.id || '499380',
          liveTodayName: 'Solar Today',
          hoverId: 'fd-solar-cell-hover',
          valColor: '#f59e0b',
          hideNight: true
        });
      } catch (e) {}

      return extraRowsHtml + gridHtml;
    }


  // ── Attach shared symbols to FX ──
  FX.buildSolarExtras = buildSolarExtras;
})();

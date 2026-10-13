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

      let smartHtml = '';
      try {
        const f2FridgeT  = FX.getFeedVal('Fridge2 Fridge Temp');
        const f2FreezerT = FX.getFeedVal('Fridge2 Freezer Temp');
        const f2EnvT     = FX.getFeedVal('Fridge2 Env Temp');
        const f2Target   = FX.getFeedVal('Fridge2 Target Temp');
        const f2Eco      = FX.getFeedVal('Fridge2 Eco Mode');
        const ecoOn      = (f2Eco == 1);
        smartHtml = `
          <div style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid #22d3ee; border-radius:10px; padding:10px 12px; margin-top:10px;">
            <div style="font-size:11.5px; font-weight:800; color:#22d3ee; text-transform:uppercase; margin-bottom:6px;">🧊 Fridge 2 — Smart Sensors</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px;">
              <div><span style="color:var(--text-muted);">Fridge Temp:</span> <b style="color:#38bdf8;">${f2FridgeT  != null ? f2FridgeT  + '°C' : '--'}</b></div>
              <div><span style="color:var(--text-muted);">Freezer Temp:</span> <b style="color:#38bdf8;">${f2FreezerT != null ? f2FreezerT + '°C' : '--'}</b></div>
              <div><span style="color:var(--text-muted);">Env Temp:</span> <b style="color:#a1a1aa;">${f2EnvT != null ? f2EnvT + '°C' : '--'}</b></div>
              <div><span style="color:var(--text-muted);">Target Level:</span> <b style="color:#a1a1aa;">${f2Target != null ? f2Target : '--'}</b></div>
              <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Eco Mode:</span> <b style="color:${ecoOn ? '#4ade80' : '#a1a1aa'}">${ecoOn ? '💚 ON' : 'OFF'}</b></div>
            </div>
          </div>`;
      } catch(e) {}

      return grid1Html + grid2Html + dutyHtml + smartHtml;
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

      let smartHtml = '';
      if (feedKey === 'haier') {
        try {
          const hPower   = FX.getFeedVal('Haier Power');
          const hTarget  = FX.getFeedVal('Haier Target Temp');
          const hCurrent = FX.getFeedVal('Haier Current Temp');
          const hMode    = FX.getFeedVal('Haier Mode');
          const hFan     = FX.getFeedVal('Haier Fan Speed');
          const powerOn  = (hPower == 1);
          smartHtml = `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid #a5f3fc; border-radius:10px; padding:10px 12px; margin-top:10px;">
              <div style="font-size:11.5px; font-weight:800; color:#a5f3fc; text-transform:uppercase; margin-bottom:6px;">❄ Haier 1T — Smart Sensors</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:12px;">
                <div><span style="color:var(--text-muted);">Power:</span> <b style="color:${powerOn ? '#4ade80' : '#a1a1aa'}">${powerOn ? '⚡ ON' : 'OFF'}</b></div>
                <div><span style="color:var(--text-muted);">Mode:</span> <b>${hMode != null ? hMode : '--'}</b></div>
                <div><span style="color:var(--text-muted);">Target:</span> <b style="color:#38bdf8;">${hTarget  != null ? hTarget  + '°C' : '--'}</b></div>
                <div><span style="color:var(--text-muted);">Current:</span> <b style="color:#38bdf8;">${hCurrent != null ? hCurrent + '°C' : '--'}</b></div>
                <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">Fan Speed:</span> <b>${hFan != null ? hFan : '--'}</b></div>
              </div>
            </div>`;
        } catch(e) {}
      }

      return gridHtml + extraRowsHtml + smartHtml;
    }


  // ── Attach shared symbols to FX ──
  FX.buildFridgeExtras = buildFridgeExtras;
  FX.buildAcExtras = buildAcExtras;
})();

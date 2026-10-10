// js/23b-flow-extras-today-stats.js
// ─── Today day/night stats per feed ────────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    fmtEnergy
  } = FX;

  async function fetchTodayFeedDayNightStats(feedId, isPc = false) {
      if (!feedId || typeof _gFetch !== 'function') return null;
      const startMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart(7) : (Date.now() - 24 * 3600 * 1000);
      const nowMs = Date.now();
      if (startMs >= nowMs) return null;

      try {
        const pts = await _gFetch(feedId, startMs, nowMs, 120);
        if (!pts || !pts.length) return null;

        let peakW = 0;
        let allSum = 0, allActiveCount = 0, allCount = 0;
        let daySum = 0, dayActiveCount = 0, dayCount = 0;
        let nightSum = 0, nightActiveCount = 0, nightCount = 0;

        const dayStart = isPc ? 6 : 7;
        const dayEnd = 16;
        const stepHours = 120 / 3600;

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!p || p[1] == null || isNaN(p[1])) continue;
          const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
          const val = Math.max(0, parseFloat(p[1]));

          if (val > peakW) peakW = val;
          allSum += val;
          allCount++;
          if (val > 10) allActiveCount++;

          const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: new Date(ts + 18000000).getUTCHours() };
          const h = pkt.hour;

          if (h >= dayStart && h < dayEnd) {
            daySum += val;
            dayCount++;
            if (val > 10) dayActiveCount++;
          } else {
            nightSum += val;
            nightCount++;
            if (val > 10) nightActiveCount++;
          }
        }

        const avgW = allActiveCount > 0 ? Math.round(allSum / allActiveCount) : (allCount > 0 ? Math.round(allSum / allCount) : 0);
        const dayAvgW = dayActiveCount > 0 ? Math.round(daySum / dayActiveCount) : 0;
        const nightAvgW = nightActiveCount > 0 ? Math.round(nightSum / nightActiveCount) : 0;

        const dayKwh = (daySum * stepHours) / 1000;
        const nightKwh = (nightSum * stepHours) / 1000;
        const totalKwh = dayKwh + nightKwh;

        return {
          peakW: Math.round(peakW),
          avgW,
          dayKwh,
          dayAvgW,
          nightKwh,
          nightAvgW,
          totalKwh
        };
      } catch (e) {
        console.warn('fetchTodayFeedDayNightStats error for ' + feedId, e);
        return null;
      }
    }

  function formatTodayDayNightStatsHtml(stats, titleColor) {
      if (!stats) return '';
      const peakColor = stats.peakW > 1500 ? '#ef4444' : (titleColor || 'var(--text-main)');

      return `
        <div style="font-size:11.5px; font-weight:700; color:var(--text-muted, #71717a); line-height:1.35; margin-top:4px; padding-top:4px; border-top:1px dashed var(--border, #27272a);">
          <div>(Peak: <b style="color:${peakColor}; font-weight:800;">${stats.peakW.toLocaleString()} W</b> &bull; Avg: <b style="color:${titleColor || 'var(--text-main)'}; font-weight:800;">${stats.avgW} W</b>)</div>
          <div style="display:flex; gap:10px; margin-top:2px; flex-wrap:wrap;">
            <span style="color:var(--accent-solar, #facc15); font-weight:800;">Day: ${fmtEnergy(stats.dayKwh)} <span style="font-size:10.5px; font-weight:600; color:var(--text-muted);">(Avg: ${stats.dayAvgW} W)</span></span>
            <span style="color:#c084fc; font-weight:800;">Night: ${fmtEnergy(stats.nightKwh)} <span style="font-size:10.5px; font-weight:600; color:var(--text-muted);">(Avg: ${stats.nightAvgW} W)</span></span>
          </div>
        </div>
      `;
    }


  // ── Attach shared symbols to FX ──
  FX.fetchTodayFeedDayNightStats = fetchTodayFeedDayNightStats;
  FX.formatTodayDayNightStatsHtml = formatTodayDayNightStatsHtml;
})();

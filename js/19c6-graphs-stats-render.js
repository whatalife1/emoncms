// js/19c6-graphs-stats-render.js
// ─── Stats rendering for graph feeds ────────────────────────────────────────

function _renderFeedStats(stat, ctx) {
  const { bars1, bars2, pts1, pts2, nav, lastIdx, multiData, isGridAll, isCombined, fA, color1, color2, unit, isTemp, graphFeedKey: gfk, monthAcBreakdown } = ctx;
  const isAvgF = isTemp || gfk === 'water' || gfk === 'acvolts';

  // ── Exact Breakdown Calculator for Day View (Normalized 120s Resolution) ──
  const calcDayBreakdownFromBars = (bars, lastIndex) => {
    if (!bars || bars.length === 0) return null;
    const resSec = nav.resSeconds || 120;
    const effectiveLen = Math.min(bars.length, lastIndex || bars.length);
    const OFF_VOLT_THRESHOLD = 50;

    let totalOffSeconds = 0;
    let outageCount = 0;
    let inOutage = false;
    let outageStartTs = null;
    const events = [];

    for (let i = 0; i < effectiveLen; i++) {
      const v = bars[i];
      const ts = nav.startMs + (i * resSec * 1000);
      const isOff = (v !== null && v !== undefined && v < OFF_VOLT_THRESHOLD);

      if (isOff) {
        totalOffSeconds += resSec;
        if (!inOutage) {
          inOutage = true;
          outageCount++;
          outageStartTs = ts;
        }
      } else {
        if (inOutage) {
          inOutage = false;
          events.push({
            start: outageStartTs,
            end: ts,
            durMin: Math.max(1, Math.round((ts - outageStartTs) / 60000))
          });
          outageStartTs = null;
        }
      }
    }

    if (inOutage && outageStartTs) {
      const endTs = nav.startMs + (effectiveLen * resSec * 1000);
      events.push({
        start: outageStartTs,
        end: endTs,
        durMin: Math.max(1, Math.round((endTs - outageStartTs) / 60000)),
        ongoing: true
      });
    }

    const totalMinutes = Math.round(totalOffSeconds / 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const formattedDuration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    return {
      totalMinutes,
      formattedDuration,
      outageCount,
      events
    };
  };

  const calcDayNgt = (pts, feedKey = '') => {
    const isPc = feedKey === 'pc';
    const dayStart = isPc ? 6 : 8;
    const dayEnd = 17;
    let dayTot = 0, nightTot = 0;
    for (const [ts, v] of pts) {
      if (v != null && v > 0) {
        const pktDate = getKarachiDate(ts);
        const h = pktDate.hour;
        if (h >= dayStart && h < dayEnd) {
          dayTot += v / 1000;
        } else {
          nightTot += v / 1000;
        }
      }
    }
    const numDays = Math.max(1, nav.nBars || 1);
    return {
      dayAvg: (dayTot / numDays),
      dayTotal: dayTot,
      nightAvg: (nightTot / numDays),
      nightTotal: nightTot
    };
  };

  if (isGridAll) {
    const df = (graphTab === 'month' || graphTab === 'year') ? 1 : (nav.resSeconds / 3600) / 1000;
    stat.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">${multiData.map(m => {
      const isKwhView = (graphTab === 'month' || graphTab === 'year');
      const t = isKwhView ? m.data.reduce((a, b) => a + b, 0) : m.data.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * df;
      const pk = Math.max(...m.data, 0);
      let av = null, dAv = null, dTt = null, nAv = null, nTt = null;
      const isSolar = m.label.toLowerCase() === 'solar';
      if (graphTab === 'month' || graphTab === 'year') {
        av = m.data.length > 0 ? t / m.data.length : 0;
        const dn = calcDayNgt(m.rawPts || [], m.key);
        dAv = dn.dayAvg; dTt = dn.dayTotal;
        if (!isSolar) { nAv = dn.nightAvg; nTt = dn.nightTotal; }
      } else if (graphTab === 'day') {
        const isPc = m.key === 'pc';
        const ds = _calcStatsForRange(m.data, (isPc ? 6 : 8), 17, nav, lastIdx);
        dAv = ds.activeAvg; dTt = ds.total;
        const stats = _calcStatsForRange(m.data, (isSolar ? 5 : 0), (isSolar ? 17 : 24), nav, lastIdx);
        av = isSolar ? stats.avg : stats.activeAvg;
        if (!isSolar) {
          const ns = _calcStatsForRange(m.data, 17, (isPc ? 6 : 8), nav, lastIdx);
          nAv = ns.activeAvg; nTt = ns.total;
        }
      } else {
        av = m.data.filter(v => v > 0).length > 0 ? t / m.data.filter(v => v > 0).length : 0;
      }
      return _formatStatLine(null, m.label, t, m.color, pk, av, dAv, dTt, nAv, nTt, graphDataCache.unit, true, graphTab, true);
    }).join('')}</div>`;
  } else if (isCombined) {
    const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
    let total1, total2;
    if (isKwhView) {
      total1 = bars1.reduce((a, b) => a + b, 0);
      total2 = bars2.reduce((a, b) => a + b, 0);
    } else {
      total1 = bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
      total2 = bars2.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
    }
    const t1 = total1, t2 = total2;
    const p1 = Math.max(...bars1), p2 = Math.max(...bars2);
    let a1, a2, d1 = null, dt1 = null, d2 = null, dt2 = null, n2 = null, nt2 = null;
    if (graphTab === 'month' || graphTab === 'year') {
      a1 = bars1.length > 0 ? t1 / bars1.length : 0;
      a2 = bars2.length > 0 ? t2 / bars2.length : 0;
      const dn1 = calcDayNgt(pts1, 'solar'); d1 = dn1.dayAvg; dt1 = dn1.dayTotal;
      const dn2 = calcDayNgt(pts2, 'grid'); d2 = dn2.dayAvg; dt2 = dn2.dayTotal; n2 = dn2.nightAvg; nt2 = dn2.nightTotal;
    } else if (graphTab === 'day') {
      const sd1 = _calcStatsForRange(bars1, 8, 17, nav, lastIdx); d1 = sd1.avg; dt1 = sd1.total;
      const sd2 = _calcStatsForRange(bars2, 8, 17, nav, lastIdx); d2 = sd2.activeAvg; dt2 = sd2.total;
      a1 = _calcStatsForRange(bars1, 5, 17, nav, lastIdx).avg;
      const s2 = _calcStatsForRange(bars2, 0, 24, nav, lastIdx);
      a2 = s2.activeAvg;
      const sn2 = _calcStatsForRange(bars2, 17, 8, nav, lastIdx);
      n2 = sn2.activeAvg; nt2 = sn2.total;
    } else {
      a1 = t1 / bars1.filter(v => v > 0).length;
      a2 = t2 / bars2.filter(v => v > 0).length;
    }
    stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, d1, dt1, null, null, unit, true, graphTab) +
      _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, d2, dt2, n2, nt2, unit, true, graphTab);
  } else if (isTemp || gfk === 'water') {
    // ── Environmental Sensors: Temperature 1, 2, Inv Temp, Water Tank ──
    const validBars = (graphTab === 'day' ? bars1.slice(0, lastIdx) : bars1).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);
    const latestV = validBars.length > 0 ? validBars[validBars.length - 1] : 0;
    const pk = validBars.length > 0 ? Math.max(...validBars) : 0;
    const av = validBars.length > 0 ? (validBars.reduce((a, b) => a + b, 0) / validBars.length) : 0;

    let dAv = null, dTt = null, nAv = null, nTt = null;
    if (graphTab === 'day') {
      const ds = _calcStatsForRange(bars1, 8, 17, nav, lastIdx);
      dAv = ds.avg;
      const ns = _calcStatsForRange(bars1, 17, 8, nav, lastIdx);
      nAv = ns.avg;
    }

    const mainVal = (graphTab === 'month' || graphTab === 'year') ? av : latestV;
    const icon = gfk === 'water' ? '💧' : '🌡';
    stat.innerHTML = _formatStatLine(icon, (fA?.statLabel || fA?.label || gfk), mainVal, color1, pk, av, dAv, null, nAv, null, unit, false, graphTab);
  } else if (gfk === 'acvolts') {
    // ── AC Input Volts Stats + Outage Tracker ──
    const validBars = (graphTab === 'day' ? bars1.slice(0, lastIdx) : bars1).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);
    const activeBars = validBars.filter(v => v >= 50);

    const latestV = validBars.length > 0 ? validBars[validBars.length - 1] : 0;
    const maxV = activeBars.length > 0 ? Math.max(...activeBars) : 0;
    const avgV = activeBars.length > 0 ? (activeBars.reduce((a, b) => a + b, 0) / activeBars.length) : 0;

    let breakdownHtml = '';

    if (graphTab === 'month' || graphTab === 'year') {
      const breakdown = monthAcBreakdown;
      if (breakdown) {
        const color = breakdown.totalMinutes > 0 ? '#ef4444' : '#10b981';

        let dailyListHtml = '';
        if (breakdown.dailyBreakdown && breakdown.dailyBreakdown.length > 0) {
          const chips = breakdown.dailyBreakdown.map(d => {
            const h = Math.floor(d.offMinutes / 60);
            const m = d.offMinutes % 60;
            const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
            return `<span style="display:inline-flex; align-items:center; background:rgba(239,68,68,0.18); border:1px solid rgba(239,68,68,0.4); border-radius:6px; padding:2px 6px; font-size:10.5px; color:#fecaca;"><b>${d.dayLabel}</b>:&nbsp;${timeStr}&nbsp;<span style="color:#f87171;">(${d.count}x)</span></span>`;
          });
          dailyListHtml = `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px; max-height:90px; overflow-y:auto; padding-right:2px;">${chips.join('')}</div>`;
        }

        breakdownHtml = `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 8px 10px; margin-top: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${color}; font-weight: 800; font-size: 12px;">
                ${breakdown.totalMinutes > 0 ? '⚠️ Total Outages this Month:' : '✅ No Breakdowns this Month'}
              </span>
              <span style="color: ${color}; font-weight: 800; font-size: 13px;">
                ${breakdown.formattedDuration} (${breakdown.outageCount} times)
              </span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 3px; display: flex; justify-content: space-between;">
              <span>Affected Days: <b style="color: var(--text-main);">${breakdown.dailyBreakdown ? breakdown.dailyBreakdown.length : 0} / ${breakdown.numDays}</b></span>
              <span>Daily Avg: <b style="color: #fca5a5;">${breakdown.avgPerDayFormatted}</b></span>
            </div>
            ${dailyListHtml}
          </div>
        `;
      }
    } else if (graphTab === 'day') {
      const breakdown = calcDayBreakdownFromBars(bars1, lastIdx);
      if (breakdown) {
        const color = breakdown.totalMinutes > 0 ? '#ef4444' : '#10b981';
        let eventsDetail = '';
        if (breakdown.events.length > 0) {
          const eventStrings = breakdown.events.map(ev => {
            const startStr = formatPktTime(ev.start, 'time');
            const endStr = ev.ongoing ? 'Now' : formatPktTime(ev.end, 'time');
            return `${startStr}–${endStr} (${ev.durMin}m)`;
          });
          eventsDetail = `<div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Times: ${eventStrings.join(', ')}</div>`;
        }

        breakdownHtml = `
          <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 8px; padding: 6px 10px; margin-top: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${color}; font-weight: 800; font-size: 12px;">
                ${breakdown.totalMinutes > 0 ? '⚠️ Breakdown / Loadshedding:' : '✅ No Breakdowns Today'}
              </span>
              <span style="color: ${color}; font-weight: 800; font-size: 13px;">
                ${breakdown.formattedDuration} (${breakdown.outageCount} ${breakdown.outageCount === 1 ? 'time' : 'times'})
              </span>
            </div>
            ${eventsDetail}
          </div>
        `;
      }
    }

    const mainVal = (graphTab === 'month' || graphTab === 'year') ? avgV : latestV;
    const mainLabel = (graphTab === 'month' || graphTab === 'year') ? 'Active Avg' : 'Latest';

    stat.innerHTML = `
      <div style="margin-bottom: 4px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="color:${color1}; font-size:13px; font-weight:700;">⚡ AC Input Volts:</span>
          <span style="color:var(--text-main); font-size:15px; font-weight:900;">${Math.round(mainVal)} V</span>
          <span style="color:var(--text-muted); font-size:11px; font-weight:600;">(${mainLabel} · Peak: <b style="color:${color1}">${Math.round(maxV)}V</b> · Active Avg: <b style="color:${color1}">${Math.round(avgV)}V</b>)</span>
        </div>
        ${breakdownHtml}
      </div>
    `;
  } else {
    // ── Power / Appliance Feeds (Kenwood, Haier, Fridge, PC, Motor, WM, etc.) ──
    const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
    let total1;
    if (isKwhView) {
      total1 = bars1.reduce((a, b) => a + b, 0);
    } else {
      total1 = bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
    }
    const t1 = total1;
    const pk = Math.max(...bars1, 0);
    let av = null, dAv = null, dTt = null, nAv = null, nTt = null;
    const isPc = gfk === 'pc';
    if (graphTab === 'month' || graphTab === 'year') {
      av = bars1.length > 0 ? t1 / bars1.length : 0;
      const dn = calcDayNgt(pts1, gfk);
      dAv = dn.dayAvg; dTt = dn.dayTotal;
      if (gfk !== 'solar' && !isAvgF) {
        nAv = dn.nightAvg; nTt = dn.nightTotal;
      }
    } else if (graphTab === 'day' && !isTemp) {
      const ds = _calcStatsForRange(bars1, (isPc ? 6 : 8), 17, nav, lastIdx);
      dAv = ds.activeAvg; dTt = ds.total;
      const stats = _calcStatsForRange(bars1, (gfk === 'solar' ? 5 : 0), (gfk === 'solar' ? 17 : 24), nav, lastIdx);
      av = (gfk === 'solar') ? stats.avg : stats.activeAvg;
      if (gfk !== 'solar' && !isAvgF) {
        const ns = _calcStatsForRange(bars1, 17, (isPc ? 6 : 8), nav, lastIdx);
        nAv = ns.activeAvg; nTt = ns.total;
      }
    } else {
      av = bars1.filter(v => v > 0).length > 0 ? t1 / bars1.filter(v => v > 0).length : 0;
    }
    stat.innerHTML = _formatStatLine('', (fA?.statLabel || fA?.label || gfk), t1, color1, pk, av, dAv, dTt, nAv, nTt, unit, !isAvgF, graphTab);
  }
}

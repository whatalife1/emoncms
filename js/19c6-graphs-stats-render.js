// js/19c6-graphs-stats-render.js
// ─── Stats rendering for graph feeds ────────────────────────────────────────

function _renderFeedStats(stat, ctx) {
  const { bars1, bars2, pts1, pts2, nav, lastIdx, multiData, isGridAll, isCombined, fA, color1, color2, unit, isTemp, graphFeedKey: gfk } = ctx;
  const isAvgF = isTemp || gfk === 'water' || gfk === 'acvolts';

  // ── Breakdown / Loadshedding Calculator for AC Volts ──
  const calcAcBreakdownStats = (data, lastIndex) => {
    if (!data || data.length === 0) return null;
    const resSec = nav.resSeconds || 120;
    const OFF_VOLT_THRESHOLD = 50; // Below 50V is treated as power breakdown
    
    let totalOffSeconds = 0;
    let outageCount = 0;
    let inOutage = false;
    let outageStartTs = null;
    const events = [];

    const effectiveLen = Math.min(data.length, lastIndex || data.length);

    for (let i = 0; i < effectiveLen; i++) {
      const v = data[i];
      const ts = nav.startMs + (i * resSec * 1000);
      const isOff = v !== null && v !== undefined && v < OFF_VOLT_THRESHOLD;

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
            durMin: Math.round((ts - outageStartTs) / 60000)
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
        durMin: Math.round((endTs - outageStartTs) / 60000),
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
  const df = (graphTab === 'month' || graphTab === 'year') ? 1 : (nav.resSeconds / 3600) / 1000;

  if (isGridAll) {
    stat.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">${multiData.map(m => {
      const t = m.data.reduce((a,b,i)=>i<lastIdx?a+b:a,0) * df;
      const pk = Math.max(...m.data, 0);
      let av = null, dAv = null, dTt = null, nAv = null, nTt = null;
      const isSolar = m.label.toLowerCase() === 'solar';
      if (graphTab === 'month' || graphTab === 'year') {
        av = m.data.length > 0 ? t / m.data.length : 0;
        const dn = calcDayNgt(m.rawPts||[], m.key);
        dAv = dn.dayAvg; dTt = dn.dayTotal;
        if (!isSolar) { nAv = dn.nightAvg; nTt = dn.nightTotal; }
      } else if (graphTab === 'day') {
        const isPc = m.key === 'pc';
        const ds = _calcStatsForRange(m.data, (isPc?6:8), 17, nav, lastIdx);
        dAv = ds.activeAvg; dTt = ds.total;
        const stats = _calcStatsForRange(m.data, (isSolar?5:0), (isSolar?17:24), nav, lastIdx);
        av = isSolar ? stats.avg : stats.activeAvg;
        if (!isSolar) {
          const ns = _calcStatsForRange(m.data, 17, (isPc?6:8), nav, lastIdx);
          nAv = ns.activeAvg; nTt = ns.total;
        }
      } else {
        av = m.data.filter(v=>v>0).length > 0 ? t / m.data.filter(v=>v>0).length : 0;
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
      a1 = bars1.length > 0 ? t1/bars1.length : 0;
      a2 = bars2.length > 0 ? t2/bars2.length : 0;
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
      a1 = t1/bars1.filter(v=>v>0).length;
      a2 = t2/bars2.filter(v=>v>0).length;
    }
    stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, d1, dt1, null, null, unit, true, graphTab) +
      _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, d2, dt2, n2, nt2, unit, true, graphTab);
  } else if (gfk === 'acvolts') {
    // ── AC Input Volts Stats + Breakdown Tracker ──
    const validBars = bars1.slice(0, lastIdx).filter(v => v !== null && v !== undefined);
    const activeBars = validBars.filter(v => v >= 50); // Calculate average only when power is on
    const currentV = validBars.length > 0 ? validBars[validBars.length - 1] : 0;
    const maxV = validBars.length > 0 ? Math.max(...validBars) : 0;
    const avgV = activeBars.length > 0 ? activeBars.reduce((a, b) => a + b, 0) / activeBars.length : 0;

    let breakdownHtml = '';
    if (graphTab === 'day') {
      const breakdown = calcAcBreakdownStats(bars1, lastIdx);
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

    stat.innerHTML = `
      <div style="margin-bottom: 4px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="color:${color1}; font-size:13px; font-weight:700;">⚡ AC Input Volts:</span>
          <span style="color:var(--text-main); font-size:15px; font-weight:900;">${Math.round(currentV)} V</span>
          <span style="color:var(--text-muted); font-size:11px; font-weight:600;">(Peak: <b style="color:${color1}">${Math.round(maxV)}V</b> · Active Avg: <b style="color:${color1}">${Math.round(avgV)}V</b>)</span>
        </div>
        ${breakdownHtml}
      </div>
    `;
  } else {
    const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
    let total1;
    if (isKwhView) {
      total1 = bars1.reduce((a, b) => a + b, 0);
    } else {
      total1 = bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
    }
    const t1 = total1;
    const pk = Math.max(...bars1,0);
    let av = null, dAv = null, dTt = null, nAv = null, nTt = null;
    const isPc = gfk === 'pc';
    if (graphTab === 'month' || graphTab === 'year') {
      av = bars1.length > 0 ? t1 / bars1.length : 0;
      const dn = calcDayNgt(pts1, gfk);
      dAv = dn.dayAvg; dTt = dn.dayTotal;
      if(gfk !== 'solar' && !isAvgF) {
        nAv = dn.nightAvg; nTt = dn.nightTotal;
      }
    } else if (graphTab === 'day' && !isTemp) {
      const ds = _calcStatsForRange(bars1, (isPc?6:8), 17, nav, lastIdx);
      dAv = ds.activeAvg; dTt = ds.total;
      const stats = _calcStatsForRange(bars1, (gfk==='solar'?5:0), (gfk==='solar'?17:24), nav, lastIdx);
      av = (gfk==='solar') ? stats.avg : stats.activeAvg;
      if(gfk !== 'solar' && !isAvgF) {
        const ns = _calcStatsForRange(bars1, 17, (isPc?6:8), nav, lastIdx);
        nAv = ns.activeAvg; nTt = ns.total;
      }
    } else {
      av = bars1.filter(v=>v>0).length > 0 ? t1 / bars1.filter(v=>v>0).length : 0;
    }
    stat.innerHTML = _formatStatLine('', (fA?.statLabel || fA?.label || gfk), t1, color1, pk, av, dAv, dTt, nAv, nTt, unit, !isAvgF, graphTab);
  }
}

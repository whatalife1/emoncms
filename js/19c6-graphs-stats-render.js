// js/19c6-graphs-stats-render.js
// ─── Stats rendering for graph feeds ────────────────────────────────────────

function _renderFeedStats(stat, ctx) {
  const { bars1, bars2, pts1, pts2, nav, lastIdx, multiData, isGridAll, isCombined, fA, color1, color2, unit, isTemp, graphFeedKey: gfk } = ctx;
  const isAvgF = isTemp || gfk === 'water' || gfk === 'acvolts';
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

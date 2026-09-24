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
    const dayStart = isPc ? 6 : 7;
    const dayEnd = 16;
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
        const ds = _calcStatsForRange(m.data, (isPc ? 6 : 7), 16, nav, lastIdx);
        dAv = ds.activeAvg; dTt = ds.total;
        const stats = _calcStatsForRange(m.data, (isSolar ? 5 : 0), (isSolar ? 17 : 24), nav, lastIdx);
        av = isSolar ? stats.avg : stats.activeAvg;
        if (!isSolar) {
          const ns = _calcStatsForRange(m.data, 16, (isPc ? 6 : 7), nav, lastIdx);
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
      const sd1 = _calcStatsForRange(bars1, 7, 16, nav, lastIdx); d1 = sd1.avg; dt1 = sd1.total;
      const sd2 = _calcStatsForRange(bars2, 7, 16, nav, lastIdx); d2 = sd2.activeAvg; dt2 = sd2.total;
      a1 = _calcStatsForRange(bars1, 5, 17, nav, lastIdx).avg;
      const s2 = _calcStatsForRange(bars2, 0, 24, nav, lastIdx);
      a2 = s2.activeAvg;
      const sn2 = _calcStatsForRange(bars2, 16, 7, nav, lastIdx);
      n2 = sn2.activeAvg; nt2 = sn2.total;
    } else {
      a1 = t1 / bars1.filter(v => v > 0).length;
      a2 = t2 / bars2.filter(v => v > 0).length;
    }
    stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, d1, dt1, null, null, unit, true, graphTab) +
      _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, d2, dt2, n2, nt2, unit, true, graphTab);
  } else if (gfk === 'battery') {
    const validBars = (graphTab === 'day' ? bars1.slice(0, lastIdx) : bars1).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);
    const latestV = validBars.length > 0 ? validBars[validBars.length - 1] : 0;
    const pk = validBars.length > 0 ? Math.max(...validBars) : 0;
    const av = validBars.length > 0 ? (validBars.reduce((a, b) => a + b, 0) / validBars.length) : 0;

    let dAv = null, nAv = null;
    if (graphTab === 'day') {
      const ds = _calcStatsForRange(bars1, 7, 16, nav, lastIdx);
      dAv = ds.avg;
      const ns = _calcStatsForRange(bars1, 16, 7, nav, lastIdx);
      nAv = ns.avg;
    }

    const mainVal = (graphTab === 'month' || graphTab === 'year') ? av : latestV;
    let statHtml = _formatStatLine('🔋', 'Battery SOC', mainVal, color1, pk, av, dAv, null, nAv, null, '%', false, graphTab);

    // ── Charge & Discharge Sessions Card (Day View) ───────────────────
    if (graphTab === 'day' && window.graphBatteryShowSessions !== false && typeof detectBatterySessions === 'function') {
      const resSec = (nav && nav.resSeconds) ? nav.resSeconds : 120;
      const sessions = detectBatterySessions(bars1, resSec, lastIdx, 10, 2.0);
      const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

      if (sessions.length > 0) {
        let totalChgKwh = 0, totalDisKwh = 0;

        const chips = sessions.map(s => {
          const isChg = s.type === 'charge';
          const startTs = nav.startMs + s.startIdx * resSec * 1000;
          const endTs = nav.startMs + s.endIdx * resSec * 1000;
          const startStr = formatPktTime(startTs, 'time').replace(':00', '');
          const endStr = s.inProgress ? 'Now' : formatPktTime(endTs, 'time').replace(':00', '');
          let durStr = '';
          if (s.durMin >= 60) {
            const h = Math.floor(s.durMin / 60);
            const m = s.durMin % 60;
            durStr = m > 0 ? (h + 'h ' + m + 'm') : (h + 'h');
          } else {
            durStr = s.durMin + 'm';
          }
          const kwh = (Math.abs(s.delta) / 100) * packKwh;
          const avgW = s.durMin > 0 ? Math.round((kwh * 1000) / (s.durMin / 60)) : 0;
          const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

          if (isChg) totalChgKwh += kwh;
          else totalDisKwh += kwh;

          const bg = isChg ? 'rgba(16,185,129,0.16)' : 'rgba(249,115,22,0.16)';
          const bdr = isChg ? 'rgba(16,185,129,0.45)' : 'rgba(249,115,22,0.45)';
          const textClr = isChg ? '#4ade80' : '#fb923c';

          return '<span style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0; background:' + bg + '; border:1px solid ' + bdr + '; border-radius:6px; padding:4px 9px; font-size:12px; color:' + textClr + '; font-weight:700;">' +
            (isChg ? '▲ +' : '▼ ') + s.delta.toFixed(1) + '% (' + kwh.toFixed(1) + ' kWh · Ø ' + avgStr + ') in ' + durStr +
            ' <span style="color:var(--text-muted); font-size:10px; font-weight:600; margin-left:2px;">[' + startStr + '→' + endStr + ']</span></span>';
        });

        statHtml += '<div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:6px 10px; margin-top:4px; margin-bottom:4px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; margin-bottom:4px;">' +
          '<span style="color:#10b981;">⚡ Activity Sessions (10m+):</span>' +
          '<span style="color:var(--text-muted); font-size:10.5px;">Chg: <b style="color:#4ade80;">+' + totalChgKwh.toFixed(1) + ' kWh</b> &bull; Disch: <b style="color:#fb923c;">-' + totalDisKwh.toFixed(1) + ' kWh</b></span>' +
          '</div><div style="display:flex; flex-wrap:nowrap; overflow-x:auto; gap:6px; padding:2px 0 4px; -webkit-overflow-scrolling:touch; scrollbar-width:thin;">' + chips.join('') + '</div></div>';
      }
    }

    const vBars = ctx.voltBars || [];
    if (vBars.length > 0) {
      const validV = (graphTab === 'day' ? vBars.slice(0, lastIdx) : vBars).filter(v => v != null && v > 40);
      if (validV.length > 0) {
        const curV = validV[validV.length - 1];
        const maxV = Math.max(...validV);
        const avgV = validV.reduce((a, b) => a + b, 0) / validV.length;
        statHtml += _formatStatLine('⚡', 'Battery Voltage', curV, '#35c0b7', maxV, avgV, null, null, null, null, 'V', false, graphTab);
      }
    }

    const pBars = ctx.pwrBars || [];
    if (pBars.length > 0) {
      const validP = (graphTab === 'day' ? pBars.slice(0, lastIdx) : pBars).filter(v => v != null);
      if (validP.length > 0) {
        const curP = validP[validP.length - 1];
        const maxP = Math.max(...validP);
        const avgP = validP.reduce((a, b) => a + b, 0) / validP.length;
        statHtml += _formatStatLine('⚡', 'Net Battery Power', curP, '#facc15', maxP, avgP, null, null, null, null, 'W', false, graphTab);
      }
    }

    stat.innerHTML = statHtml;
    return;
  } else if (isTemp || gfk === 'water' || gfk === 'batv') {
    // ── Environmental Sensors: Temperature 1, 2, Inv Temp, Water Tank, Bat V ──
    const validBars = (graphTab === 'day' ? bars1.slice(0, lastIdx) : bars1).filter(v => v !== null && v !== undefined && !isNaN(v) && v > 0);
    const latestV = validBars.length > 0 ? validBars[validBars.length - 1] : 0;
    const pk = validBars.length > 0 ? Math.max(...validBars) : 0;
    const av = validBars.length > 0 ? (validBars.reduce((a, b) => a + b, 0) / validBars.length) : 0;

    let dAv = null, dTt = null, nAv = null, nTt = null;
    if (graphTab === 'day') {
      const ds = _calcStatsForRange(bars1, 7, 16, nav, lastIdx);
      dAv = ds.avg;
      const ns = _calcStatsForRange(bars1, 16, 7, nav, lastIdx);
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
      const ds = _calcStatsForRange(bars1, (isPc ? 6 : 7), 16, nav, lastIdx);
      dAv = ds.activeAvg; dTt = ds.total;
      const stats = _calcStatsForRange(bars1, (gfk === 'solar' ? 5 : 0), (gfk === 'solar' ? 17 : 24), nav, lastIdx);
      av = (gfk === 'solar') ? stats.avg : stats.activeAvg;
      if (gfk !== 'solar' && !isAvgF) {
        const ns = _calcStatsForRange(bars1, 16, (isPc ? 6 : 7), nav, lastIdx);
        nAv = ns.activeAvg; nTt = ns.total;
      }
    } else {
      av = bars1.filter(v => v > 0).length > 0 ? t1 / bars1.filter(v => v > 0).length : 0;
    }
    stat.innerHTML = _formatStatLine('', (fA?.statLabel || fA?.label || gfk), t1, color1, pk, av, dAv, dTt, nAv, nTt, unit, !isAvgF, graphTab);
  }
}

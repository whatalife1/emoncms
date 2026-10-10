// js/23n3-analytics-compute.js
// ─── Flow Extras Analytics: compute stats + build report content ──────
// Auto-split from js/23n-flow-extras-analytics.js

(function () {
  'use strict';

  const FX  = window.FX = window.FX || {};
  const FXA = FX.analytics = FX.analytics || {};

  const { fmtEnergy, fmtDuration, fmtPkr, MONTH_SHORT } = FX;

  // ─── Main analytics compute & UI update ─────────────────────────────
  function computeAndRenderBoxAnalytics(ctx) {
    const state = ctx.state;
    const cfg   = ctx.cfg;
    const boxKey = ctx.boxKey;
    const isBattery = ctx.isBattery;
    const titleColor = ctx.titleColor;
    const dom = ctx.dom;

    if (!state.cachedData) return;
    const cache = state.cachedData;
    const startMs = cache.startMs;
    const endMs   = cache.endMs;
    const periodLabel = cache.periodLabel;
    const isDayMode   = cache.isDayMode;
    const rate        = cache.rate;

    // ── Battery day view ──
    if (isBattery && isDayMode) {
      const { socBars, voltBars, pwrBars, sessions, lastIdx, packKwh } = cache;
      const validBars = socBars.slice(0, lastIdx).filter(function (v) {
        return v != null && v > 10;
      });
      const latestV = validBars.length ? validBars[validBars.length - 1] : 0;
      const peakV   = validBars.length ? Math.max.apply(null, validBars) : 0;
      const avgV    = validBars.length
        ? validBars.reduce(function (a, b) { return a + b; }, 0) / validBars.length : 0;

      let dSum = 0, dCount = 0, nSum = 0, nCount = 0;
      for (let i = 0; i < lastIdx; i++) {
        const val = socBars[i];
        if (val == null || val <= 10) continue;
        const ts  = startMs + i * 120 * 1000;
        const pkt = (typeof getKarachiDate === 'function')
          ? getKarachiDate(ts) : { hour: 0 };
        if (pkt.hour >= 7 && pkt.hour < 16) { dSum += val; dCount++; }
        else                                { nSum += val; nCount++; }
      }
      const dayAvg   = dCount > 0 ? (dSum / dCount) : 0;
      const nightAvg = nCount > 0 ? (nSum / nCount) : 0;

      let totalChgKwh = 0, totalDisKwh = 0;
      const chips = (sessions || []).map(function (s) {
        const isChg = s.type === 'charge';
        const startTs = startMs + s.startIdx * 120 * 1000;
        const endTs   = startMs + s.endIdx   * 120 * 1000;
        const startStr = formatPktTime(startTs, 'time').replace(':00', '');
        const endStr   = s.inProgress ? 'Now'
                       : formatPktTime(endTs, 'time').replace(':00', '');
        const durH = Math.floor(s.durMin / 60);
        const durM = Math.round(s.durMin % 60);
        const durStr = durH > 0
          ? (durM > 0 ? (durH + 'h ' + durM + 'm') : (durH + 'h'))
          : (durM + 'm');
        const kwh = (Math.abs(s.delta) / 100) * packKwh;
        const avgW = s.durMin > 0 ? Math.round((kwh * 1000) / (s.durMin / 60)) : 0;
        const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

        if (isChg) totalChgKwh += kwh; else totalDisKwh += kwh;

        const bg     = isChg ? 'rgba(16,185,129,0.16)' : 'rgba(249,115,22,0.16)';
        const bdr    = isChg ? 'rgba(16,185,129,0.45)' : 'rgba(249,115,22,0.45)';
        const textClr = isChg ? '#4ade80' : '#fb923c';

        let pauseStr = '';
        if (s.pauseMin > 0) {
          const ph = Math.floor(s.pauseMin / 60);
          const pm = s.pauseMin % 60;
          const pText = ph > 0
            ? (pm > 0 ? (ph + 'h ' + pm + 'm') : (ph + 'h'))
            : (pm + 'm');
          pauseStr = ' (pause ' + pText + ')';
        }

        return '<span style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0; background:' + bg + '; border:1px solid ' + bdr + '; border-radius:6px; padding:3px 8px; font-size:11.5px; color:' + textClr + '; font-weight:700;">' +
               (isChg ? '▲ +' : '▼ ') + Math.abs(s.delta).toFixed(1) + '% (' +
               kwh.toFixed(1) + ' kWh - Ø ' + avgStr + ') in ' + durStr + pauseStr +
               ' <span style="color:var(--text-muted); font-size:10px; font-weight:600; margin-left:2px;">[' +
               startStr + '–' + endStr + ']</span></span>';
      });

      const sessionsCardHtml = (sessions && sessions.length > 0)
        ? '<div style="background:var(--bg-panel); border:1px solid var(--border); border-radius:8px; padding:6px 10px; margin-top:5px;">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; margin-bottom:4px;">' +
          '<span style="color:#10b981;">⚡ Activity Sessions (10m+):</span>' +
          '<span style="color:var(--text-muted); font-size:10.5px;">Chg: <b style="color:#4ade80;">+' +
          totalChgKwh.toFixed(1) + ' kWh</b> &bull; Disch: <b style="color:#fb923c;">-' +
          totalDisKwh.toFixed(1) + ' kWh</b></span></div>' +
          '<div style="display:flex; flex-wrap:nowrap; overflow-x:auto; gap:6px; padding:2px 0 4px; -webkit-overflow-scrolling:touch; scrollbar-width:thin;">' +
          chips.join('') + '</div></div>'
        : '';

      let auxStatsHtml = '';
      if (state.includeVoltage && voltBars.length) {
        const valVolt = voltBars.slice(0, lastIdx).filter(function (v) {
          return v != null && v > 40;
        });
        if (valVolt.length) {
          const curV = valVolt[valVolt.length - 1];
          const maxV = Math.max.apply(null, valVolt);
          const avgV2 = valVolt.reduce(function (a, b) { return a + b; }, 0) / valVolt.length;
          auxStatsHtml += '<div style="font-size:11px; margin-top:3px; color:#35c0b7; font-weight:700;">' +
            '⚡ Voltage: <b style="color:var(--text-main); font-size:12px;">' + curV.toFixed(1) + ' V</b> ' +
            '<span style="color:var(--text-muted);">(Peak: ' + maxV.toFixed(1) + 'V &bull; Avg: ' +
            avgV2.toFixed(1) + 'V)</span></div>';
        }
      }
      if (state.includePower && pwrBars.length) {
        const valP = pwrBars.slice(0, lastIdx).filter(function (v) { return v != null; });
        if (valP.length) {
          const curP = valP[valP.length - 1];
          const maxP = Math.max.apply(null, valP);
          const avgP = Math.round(valP.reduce(function (a, b) { return a + b; }, 0) / valP.length);
          auxStatsHtml += '<div style="font-size:11px; margin-top:2px; color:#facc15; font-weight:700;">' +
            '⚡ Net Power: <b style="color:var(--text-main); font-size:12px;">' + curP + ' W</b> ' +
            '<span style="color:var(--text-muted);">(Peak: ' + maxP + 'W &bull; Avg: ' + avgP + 'W)</span></div>';
        }
      }

      dom.statsStrip.innerHTML =
        '<div style="margin-bottom:2px;">' +
          '<div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">' +
            '<span style="color:' + titleColor + '; font-size:13px; font-weight:800;">🔋 ' + cfg.title + ' SOC:</span>' +
            '<span style="color:var(--text-main); font-size:15px; font-weight:900;">' + latestV.toFixed(1) + ' %</span>' +
            '<span style="color:var(--text-muted); font-size:11px; font-weight:600;">(Peak: <b style="color:' + titleColor + ';">' +
            peakV.toFixed(1) + ' %</b> · Avg: <b style="color:' + titleColor + ';">' + avgV.toFixed(1) + ' %</b>)</span>' +
          '</div>' +
          '<div style="display:flex; gap:10px; margin-top:2px; flex-wrap:wrap;">' +
            '<span style="color:var(--accent-solar); font-size:11.5px; font-weight:800;">Day: (Avg: ' + dayAvg.toFixed(1) + ' %)</span>' +
            '<span style="color:#c084fc; font-size:11.5px; font-weight:800;">Night: (Avg: ' + nightAvg.toFixed(1) + ' %)</span>' +
          '</div>' +
          sessionsCardHtml + auxStatsHtml +
        '</div>';

      FXA.buildReportContent(ctx, {
        periodLabel: periodLabel,
        totalKwh: totalDisKwh, dayKwh: 0, nightKwh: 0, rate: rate,
        outageMinutes: 0, outageCount: 0,
        isDayMode: true, dailyMap: {}, ptsData: []
      });

      FXA.redrawGraph(ctx);
      if (dom.loadingEl) dom.loadingEl.style.display = 'none';
      return;
    }

    // ── Standard non-battery compute ──
    const ptsData = cache.ptsData;
    const ptsAux  = cache.ptsAux;
    const ptsF1   = cache.ptsF1;
    const ptsF2   = cache.ptsF2;
    const outageSummary = cache.outageSummary;

    let peakVal = 0, avgVal = 0, dayKwh = 0, dayAvgW = 0;
    let nightKwh = 0, nightAvgW = 0, totalKwh = 0;
    let f1Peak = 0, f1Avg = 0, f1DayKwh = 0, f1NightKwh = 0, f1TotalKwh = 0;
    let f2Peak = 0, f2Avg = 0, f2DayKwh = 0, f2NightKwh = 0, f2TotalKwh = 0;
    let outageMinutes = 0, outageCount = 0;
    const dailyMap = {};

    const isPc = !!cfg.isPc;
    const dayStart = isPc ? 6 : 7;
    const dayEnd   = 16;
    const stepHours = 120 / 3600;

    if (isDayMode) {
      let allSum = 0, allActiveCount = 0;
      let daySum = 0, dayActiveCount = 0;
      let nightSum = 0, nightActiveCount = 0;

      ptsData.forEach(function (p) {
        if (!p || p[1] == null) return;
        const v = Math.max(0, p[1]);
        const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
        if (v > peakVal) peakVal = v;
        allSum += v;
        if (v > 10) allActiveCount++;

        const pkt = (typeof getKarachiDate === 'function')
          ? getKarachiDate(ts)
          : { hour: new Date(ts + 18000000).getUTCHours() };
        const h = pkt.hour;
        if (h >= dayStart && h < dayEnd) {
          daySum += v;
          if (v > 10) dayActiveCount++;
        } else {
          nightSum += v;
          if (v > 10) nightActiveCount++;
        }
      });

      avgVal     = allActiveCount   > 0 ? Math.round(allSum   / allActiveCount)   : 0;
      dayAvgW    = dayActiveCount   > 0 ? Math.round(daySum   / dayActiveCount)   : 0;
      nightAvgW  = nightActiveCount > 0 ? Math.round(nightSum / nightActiveCount) : 0;
      dayKwh     = (daySum   * stepHours) / 1000;
      nightKwh   = (nightSum * stepHours) / 1000;
      totalKwh   = dayKwh + nightKwh;

      if (cfg.isFridges) {
        let s1 = 0, c1 = 0, ds1 = 0, ns1 = 0;
        ptsF1.forEach(function (p) {
          const v  = Math.max(0, p[1] || 0);
          const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
          if (v > f1Peak) f1Peak = v;
          s1 += v; if (v > 5) c1++;
          const h = (typeof getKarachiDate === 'function')
            ? getKarachiDate(ts).hour : 0;
          if (h >= dayStart && h < dayEnd) ds1 += v; else ns1 += v;
        });
        f1Avg = c1 > 0 ? Math.round(s1 / c1) : 0;
        f1DayKwh   = (ds1 * stepHours) / 1000;
        f1NightKwh = (ns1 * stepHours) / 1000;
        f1TotalKwh = f1DayKwh + f1NightKwh;

        let s2 = 0, c2 = 0, ds2 = 0, ns2 = 0;
        ptsF2.forEach(function (p) {
          const v  = Math.max(0, p[1] || 0);
          const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
          if (v > f2Peak) f2Peak = v;
          s2 += v; if (v > 5) c2++;
          const h = (typeof getKarachiDate === 'function')
            ? getKarachiDate(ts).hour : 0;
          if (h >= dayStart && h < dayEnd) ds2 += v; else ns2 += v;
        });
        f2Avg = c2 > 0 ? Math.round(s2 / c2) : 0;
        f2DayKwh   = (ds2 * stepHours) / 1000;
        f2NightKwh = (ns2 * stepHours) / 1000;
        f2TotalKwh = f2DayKwh + f2NightKwh;
      }

      if (boxKey === 'grid' && ptsAux.length) {
        let inOutage = false;
        ptsAux.forEach(function (p) {
          if (!p) return;
          const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
          const v = p[1] != null ? p[1] : 0;
          if (v < 50) {
            outageMinutes += 2;
            if (!inOutage) { inOutage = true; outageCount++; }
          } else if (inOutage) {
            inOutage = false;
          }
        });
      }
    } else {
      const mapF1 = new Map(ptsF1);
      const mapF2 = new Map(ptsF2);

      ptsData.forEach(function (p) {
        const ts = p[0];
        const v  = p[1];
        if (v == null || v < 0) return;
        const tsMs = ts < 2e9 ? ts * 1000 : ts;
        const pkt = (typeof getKarachiDate === 'function')
          ? getKarachiDate(tsMs)
          : {
              year: new Date(tsMs + 18000000).getUTCFullYear(),
              month: new Date(tsMs + 18000000).getUTCMonth() + 1,
              day: new Date(tsMs + 18000000).getUTCDate(),
              hour: new Date(tsMs + 18000000).getUTCHours()
            };

        let cYr = pkt.year, cMo = pkt.month, cDy = pkt.day;
        if (pkt.hour < 7) {
          const prevD = new Date(Date.UTC(cYr, cMo - 1, cDy - 1));
          cYr = prevD.getUTCFullYear();
          cMo = prevD.getUTCMonth() + 1;
          cDy = prevD.getUTCDate();
        }

        const dKey = state.tab === 'year'
          ? cYr + '-' + String(cMo).padStart(2, '0')
          : cYr + '-' + String(cMo).padStart(2, '0') + '-' + String(cDy).padStart(2, '0');

        if (!dailyMap[dKey]) dailyMap[dKey] = {
          totalWh: 0, dayWh: 0, nightWh: 0, f1Wh: 0, f2Wh: 0,
          dLabel: state.tab === 'year' ? MONTH_SHORT[cMo - 1] : (cDy + '/' + cMo)
        };
        dailyMap[dKey].totalWh += v;
        totalKwh += v / 1000;

        if (cfg.isFridges) {
          dailyMap[dKey].f1Wh += (mapF1.get(ts) || 0);
          dailyMap[dKey].f2Wh += (mapF2.get(ts) || 0);
        }

        if (pkt.hour >= dayStart && pkt.hour < dayEnd) {
          dailyMap[dKey].dayWh += v;
          dayKwh += v / 1000;
        } else {
          dailyMap[dKey].nightWh += v;
          nightKwh += v / 1000;
        }
      });

      if (outageSummary) {
        outageMinutes = outageSummary.totalMinutes || 0;
        outageCount   = outageSummary.outageCount   || 0;
      }
    }

    cache.dailyMap = dailyMap;

    // ── Stats strip ──
    let statLine1 = '';
    let statLine2 = '';

    if (cfg.isFridges) {
      statLine1 =
        '<span>' +
          '<span style="color:#c084fc; font-weight:800;">🧊 F1: Peak ' + f1Peak + 'W &bull; Avg ' + f1Avg + 'W</span> &nbsp;|&nbsp; ' +
          '<span style="color:#22d3ee; font-weight:800;">🧊 F2: Peak ' + f2Peak + 'W &bull; Avg ' + f2Avg + 'W</span>' +
        '</span>' +
        '<span style="color:#4ade80; font-weight:800;">Combined: ' + fmtEnergy(totalKwh) +
        ' (' + fmtPkr(totalKwh * rate) + ')</span>';
      statLine2 =
        '<span style="color:var(--accent-solar); font-weight:800;">☀️ Day: F1 ' +
        fmtEnergy(f1DayKwh) + ' + F2 ' + fmtEnergy(f2DayKwh) + ' = ' + fmtEnergy(dayKwh) + '</span>' +
        '<span style="color:#c084fc; font-weight:800;">🌙 Night: F1 ' +
        fmtEnergy(f1NightKwh) + ' + F2 ' + fmtEnergy(f2NightKwh) + ' = ' + fmtEnergy(nightKwh) + '</span>';
    } else if (cfg.isPower) {
      const peakColor = peakVal > 1500 ? '#ef4444' : titleColor;
      const outStr = outageCount > 0
        ? '<span style="color:#ef4444; font-weight:800;">⚡ Outages: ' +
          fmtDuration(outageMinutes) + ' (' + outageCount + 'x)</span>'
        : '';
      const dayAvgStr   = isDayMode ? '(Avg: ' + dayAvgW   + ' W)' : '';
      const nightAvgStr = isDayMode ? '(Avg: ' + nightAvgW + ' W)' : '';
      const costStr = '<span style="color:#4ade80; font-weight:800;">Cost: ' +
                      fmtPkr(totalKwh * rate) + '</span>';

      statLine1 = '<span>(Peak: <b style="color:' + peakColor + ';">' +
        (isDayMode ? peakVal.toLocaleString() + ' W' : totalKwh.toFixed(1) + ' kWh') +
        '</b> &bull; Avg: <b style="color:' + titleColor + ';">' +
        (isDayMode ? avgVal + ' W'
                   : (totalKwh / Math.max(1, Object.keys(dailyMap).length)).toFixed(1) + ' kWh/d') +
        '</b>)</span> ' + outStr;
      statLine2 =
        '<span style="color:var(--accent-solar); font-weight:800;">Day: ' + fmtEnergy(dayKwh) + ' ' + dayAvgStr + '</span>' +
        (!cfg.hideNight
          ? '<span style="color:#c084fc; font-weight:800;">Night: ' + fmtEnergy(nightKwh) + ' ' + nightAvgStr + '</span>'
          : '') +
        costStr;
    } else {
      const mainDisp = isDayMode
        ? (ptsData.length ? ptsData[ptsData.length - 1][1].toFixed(1) : '--')
        : (totalKwh / Math.max(1, Object.keys(dailyMap).length)).toFixed(1);
      statLine1 = '<span>Latest: <b style="color:' + titleColor + ';">' + mainDisp + ' ' + cfg.unit +
        '</b> &bull; Peak: <b style="color:' + titleColor + ';">' + peakVal.toFixed(1) + ' ' + cfg.unit + '</b></span>';
      statLine2 = '<span style="color:var(--text-muted);">Period: ' + periodLabel + '</span>';
    }

    dom.statsStrip.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:3px;">' +
        statLine1 +
      '</div>' +
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">' +
        statLine2 +
      '</div>';

    FXA.buildReportContent(ctx, {
      periodLabel, totalKwh, dayKwh, nightKwh, rate,
      outageMinutes, outageCount, isDayMode, dailyMap, ptsData,
      f1Peak, f1Avg, f1DayKwh, f1NightKwh, f1TotalKwh,
      f2Peak, f2Avg, f2DayKwh, f2NightKwh, f2TotalKwh,
      ptsF1, ptsF2
    });

    FXA.redrawGraph(ctx);
    if (dom.loadingEl) dom.loadingEl.style.display = 'none';
  }

  // ─── Report content builder (TXT + HTML) ────────────────────────────
  function buildReportContent(ctx, data) {
    const state = ctx.state;
    const cfg   = ctx.cfg;
    const boxKey = ctx.boxKey;
    const isBattery = ctx.isBattery;
    const titleColor = ctx.titleColor;
    const dom = ctx.dom;

    const periodLabel = data.periodLabel;
    const totalKwh    = data.totalKwh;
    const dayKwh      = data.dayKwh;
    const nightKwh    = data.nightKwh;
    const rate        = data.rate;
    const outageMinutes = data.outageMinutes;
    const outageCount   = data.outageCount;
    const isDayMode     = data.isDayMode;
    const dailyMap      = data.dailyMap;
    const ptsData       = data.ptsData;
    const ptsF1         = data.ptsF1;
    const ptsF2         = data.ptsF2;

    const nightPct = totalKwh > 0 ? ((nightKwh / totalKwh) * 100).toFixed(1) : '0.0';

    // ── TXT ──
    let txt  = '================================================================================\n';
    txt += '📄 ' + cfg.title.toUpperCase() + ' REPORT: ' + periodLabel + '\n';
    txt += 'Generated: ' + new Date().toLocaleString() + ' (PKT UTC+5)\n';
    if (cfg.isPower) txt += 'Tariff Rate: PKR ' + rate.toFixed(0) + ' / kWh\n';
    txt += '================================================================================\n\n';

    if (isBattery && isDayMode) {
      txt += 'BATTERY SUMMARY:\n';
      txt += '  • Discharged: ' + totalKwh.toFixed(2) + ' kWh\n';
      txt += '  • Savings: PKR ' + Math.round(totalKwh * rate).toLocaleString() + '\n\n';
    } else if (cfg.isFridges) {
      txt += 'SUMMARY (FRIDGES):\n';
      txt += '  • Fridge 1 Total: ' + data.f1TotalKwh.toFixed(2) +
             ' kWh (Day: ' + data.f1DayKwh.toFixed(2) + 'k, Night: ' + data.f1NightKwh.toFixed(2) + 'k)\n';
      txt += '  • Fridge 2 Total: ' + data.f2TotalKwh.toFixed(2) +
             ' kWh (Day: ' + data.f2DayKwh.toFixed(2) + 'k, Night: ' + data.f2NightKwh.toFixed(2) + 'k)\n';
      txt += '  • Combined Energy: ' + totalKwh.toFixed(2) +
             ' kWh  (PKR ' + Math.round(totalKwh * rate).toLocaleString() + ')\n\n';
    } else if (cfg.isPower) {
      txt += 'SUMMARY:\n';
      txt += '  • Total Energy  : ' + totalKwh.toFixed(2) +
             ' kWh  (PKR ' + Math.round(totalKwh * rate).toLocaleString() + ')\n';
      txt += '  • Day (Daytime) : ' + dayKwh.toFixed(2) +
             ' kWh  (PKR ' + Math.round(dayKwh * rate).toLocaleString() + ')\n';
      if (!cfg.hideNight) {
        txt += '  • Night (Overnight): ' + nightKwh.toFixed(2) + ' kWh (' + nightPct +
               '%)  (PKR ' + Math.round(nightKwh * rate).toLocaleString() + ')\n';
      }
      if (boxKey === 'grid') {
        txt += '  • Outages/Breaks : ' + fmtDuration(outageMinutes) +
               ' across ' + outageCount + ' incident(s)\n';
      }
      txt += '\n';
    }

    // ── HTML table ──
    let tableHtml = '';
    if (isDayMode) {
      if (cfg.isFridges) {
        tableHtml +=
          '<table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace; min-width:380px;">' +
            '<thead><tr style="background:var(--bg-card); border-bottom:2px solid var(--border); text-align:right;">' +
              '<th style="padding:6px; text-align:left;">Hour</th>' +
              '<th style="padding:6px; color:#c084fc;">F1 (W)</th>' +
              '<th style="padding:6px; color:#22d3ee;">F2 (W)</th>' +
              '<th style="padding:6px; color:var(--text-main);">Total (W)</th>' +
              '<th style="padding:6px; color:var(--accent-solar);">Energy</th>' +
              '<th style="padding:6px; color:#4ade80;">Cost</th>' +
            '</tr></thead><tbody>';

        const b1 = Array.from({ length: 24 }, function () { return { sum: 0, cnt: 0 }; });
        const b2 = Array.from({ length: 24 }, function () { return { sum: 0, cnt: 0 }; });
        (ptsF1 || []).forEach(function (p) {
          const h = (typeof getKarachiDate === 'function')
            ? getKarachiDate(p[0] < 2e9 ? p[0] * 1000 : p[0]).hour : 0;
          b1[h].sum += (p[1] || 0); b1[h].cnt++;
        });
        (ptsF2 || []).forEach(function (p) {
          const h = (typeof getKarachiDate === 'function')
            ? getKarachiDate(p[0] < 2e9 ? p[0] * 1000 : p[0]).hour : 0;
          b2[h].sum += (p[1] || 0); b2[h].cnt++;
        });

        for (let h = 0; h < 24; h++) {
          if (b1[h].cnt === 0 && b2[h].cnt === 0) continue;
          const w1 = b1[h].cnt > 0 ? Math.round(b1[h].sum / b1[h].cnt) : 0;
          const w2 = b2[h].cnt > 0 ? Math.round(b2[h].sum / b2[h].cnt) : 0;
          const totW = w1 + w2;
          const wh = totW;
          const cost = (wh / 1000) * rate;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hh = h % 12 || 12;
          const hStr = String(hh).padStart(2, '0') + ':00 ' + ampm;

          tableHtml +=
            '<tr style="border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">' +
              '<td style="padding:5px 6px; text-align:left; color:var(--text-muted);">' + hStr + '</td>' +
              '<td style="padding:5px 6px; font-weight:800; color:#c084fc;">' + w1 + ' W</td>' +
              '<td style="padding:5px 6px; font-weight:800; color:#22d3ee;">' + w2 + ' W</td>' +
              '<td style="padding:5px 6px; font-weight:800; color:var(--text-main);">' + totW + ' W</td>' +
              '<td style="padding:5px 6px; color:var(--accent-solar);">' + wh + ' Wh</td>' +
              '<td style="padding:5px 6px; color:#4ade80; font-weight:700;">PKR ' + cost.toFixed(1) + '</td>' +
            '</tr>';
        }
        tableHtml += '</tbody></table>';
      } else if (!isBattery) {
        tableHtml +=
          '<table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace; min-width:320px;">' +
            '<thead><tr style="background:var(--bg-card); border-bottom:2px solid var(--border); text-align:right;">' +
              '<th style="padding:6px; text-align:left;">Hour</th>' +
              '<th style="padding:6px; color:' + titleColor + ';">' + (cfg.unit === 'W' ? 'Power (W)' : cfg.unit) + '</th>' +
              '<th style="padding:6px; color:var(--text-main);">Energy</th>' +
              '<th style="padding:6px; color:#4ade80;">Cost</th>' +
            '</tr></thead><tbody>';

        const hrBuckets = Array.from({ length: 24 }, function () {
          return { sumW: 0, cnt: 0 };
        });
        ptsData.forEach(function (p) {
          if (p[1] == null) return;
          const pkt = (typeof getKarachiDate === 'function')
            ? getKarachiDate(p[0] < 2e9 ? p[0] * 1000 : p[0])
            : { hour: 0 };
          hrBuckets[pkt.hour].sumW += p[1];
          hrBuckets[pkt.hour].cnt++;
        });

        hrBuckets.forEach(function (b, h) {
          if (b.cnt === 0) return;
          const avgV = Math.round(b.sumW / b.cnt);
          const wh   = avgV;
          const cost = (wh / 1000) * rate;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const hh = h % 12 || 12;
          const hStr = String(hh).padStart(2, '0') + ':00 ' + ampm;

          tableHtml +=
            '<tr style="border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">' +
              '<td style="padding:5px 6px; text-align:left; color:var(--text-muted);">' + hStr + '</td>' +
              '<td style="padding:5px 6px; font-weight:800; color:' + titleColor + ';">' + avgV + ' ' + cfg.unit + '</td>' +
              '<td style="padding:5px 6px;">' + wh + ' Wh</td>' +
              '<td style="padding:5px 6px; color:#4ade80; font-weight:700;">PKR ' + cost.toFixed(1) + '</td>' +
            '</tr>';
        });
        tableHtml += '</tbody></table>';
      }
    }

    state.cachedRawText = txt;

    dom.reportContent.innerHTML =
      '<div style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid ' + titleColor + '; border-radius:8px; padding:10px 12px; margin-bottom:10px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">' +
          '<span style="font-size:13px; font-weight:800; color:' + titleColor + ';">📊 ' + cfg.title + ' &bull; ' + periodLabel + '</span>' +
          '<span style="font-size:12px; font-weight:800; color:#4ade80;">PKR ' + Math.round(totalKwh * rate).toLocaleString() + ' (@ ' + rate + ' PKR/u)</span>' +
        '</div>' +
        '<div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px; flex-wrap:wrap; gap:4px;">' +
          '<span>Total: <b style="color:var(--text-main);">' + totalKwh.toFixed(1) + ' kWh</b></span>' +
          (dayKwh > 0 ? '<span>Day: <b style="color:var(--accent-solar);">' + dayKwh.toFixed(1) + ' kWh</b></span>' : '') +
          (nightKwh > 0 ? '<span>Night: <b style="color:#c084fc;">' + nightKwh.toFixed(1) + ' kWh (' + nightPct + '%)</b></span>' : '') +
          (boxKey === 'grid'
            ? '<span>Outages: <b style="color:#ef4444;">' + fmtDuration(outageMinutes) + ' (' + outageCount + 'x)</b></span>'
            : '') +
        '</div>' +
      '</div>' +
      tableHtml;
  }

  FXA.computeAndRenderBoxAnalytics = computeAndRenderBoxAnalytics;
  FXA.buildReportContent            = buildReportContent;
})();

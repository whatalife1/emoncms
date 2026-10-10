// js/23h-flow-extras-battery.js
// ─── Battery popup extras ──────────────────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    pkrRate, getFeedVal, render16x2CardGrid,
    buildBatteryCellDiagnosticsHtml, buildBatteryCyclesForecastHtml
  } = FX;

  async function buildBatteryExtras() {
      let cellHtml = '';
      let cyclesForecastHtml = '';
      let dailyDischargeHtml = '';

      const [cellsRes, cyclesRes] = await Promise.all([
        buildBatteryCellDiagnosticsHtml(),
        buildBatteryCyclesForecastHtml()
      ]);
      cellHtml = cellsRes;
      cyclesForecastHtml = cyclesRes;

      const packKwh = (typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

      try {
        const cycleStartHour = (typeof window.graphDayStartHour !== 'undefined') ? window.graphDayStartHour : 7;
        const pktNow = (typeof getPktNow === 'function') ? getPktNow() : new Date();
        const isPkt = (new Date().getTimezoneOffset() === -300);
        const yr = isPkt ? pktNow.getFullYear() : pktNow.getUTCFullYear();
        const mo = (isPkt ? pktNow.getMonth() : pktNow.getUTCMonth()) + 1;
        const dy = isPkt ? pktNow.getDate() : pktNow.getUTCDate();

        const range = (typeof getPktBillingRange === 'function')
          ? getPktBillingRange(yr, dy < 26 ? mo : mo + 1)
          : { startMs: Date.UTC(yr, (dy < 26 ? mo - 2 : mo - 1), 25) - 18000000, endMs: Date.UTC(yr, (dy < 26 ? mo - 1 : mo), 26) - 18000000 };

        const nowMs = Date.now();

        let batVRaw = {};
        let batDisRaw = {};
        try {
          if (typeof fetchWithCache === 'function') {
            const res = await Promise.all([
              fetchWithCache('546013', range.startMs, nowMs),
              fetchWithCache('546025', range.startMs, nowMs)
            ]);
            batVRaw = res[0] || {};
            batDisRaw = res[1] || {};
          }
        } catch (err) {}

        const daySums = {};
        const nightSums = {};

        for (const [tsStr, dAVal] of Object.entries(batDisRaw || {})) {
          const dA = parseFloat(dAVal || 0);
          if (dA <= 0) continue;
          const v = (batVRaw && batVRaw[tsStr] > 35) ? parseFloat(batVRaw[tsStr]) : 52.0;
          const disWh = v * dA;

          const ts = parseInt(tsStr, 10);
          const tsMs = ts < 2e9 ? ts * 1000 : ts;
          const p = (typeof getKarachiDate === 'function') ? getKarachiDate(tsMs) : {
            year: new Date(tsMs + 18000000).getUTCFullYear(),
            month: new Date(tsMs + 18000000).getUTCMonth() + 1,
            day: new Date(tsMs + 18000000).getUTCDate(),
            hour: new Date(tsMs + 18000000).getUTCHours()
          };

          let cYr = p.year, cMo = p.month, cDy = p.day;
          if (cycleStartHour > 0 && p.hour < cycleStartHour) {
            const prevD = new Date(Date.UTC(cYr, cMo - 1, cDy - 1));
            cYr = prevD.getUTCFullYear(); cMo = prevD.getUTCMonth() + 1; cDy = prevD.getUTCDate();
          }

          const key = `${cYr}-${String(cMo).padStart(2, '0')}-${String(cDy).padStart(2, '0')}`;
          daySums[key] = (daySums[key] || 0) + disWh;

          const isNight = (p.hour >= 16 || p.hour < 7);
          if (isNight) {
            nightSums[key] = (nightSums[key] || 0) + disWh;
          }
        }

        const nowPkt = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: yr, month: mo, day: dy, hour: 12 };
        let todayYr = nowPkt.year, todayMo = nowPkt.month, todayDy = nowPkt.day;
        if (cycleStartHour > 0 && nowPkt.hour < cycleStartHour) {
          const prev = new Date(Date.UTC(todayYr, todayMo - 1, todayDy - 1));
          todayYr = prev.getUTCFullYear(); todayMo = prev.getUTCMonth() + 1; todayDy = prev.getUTCDate();
        }
        const todayKey = `${todayYr}-${String(todayMo).padStart(2, '0')}-${String(todayDy).padStart(2, '0')}`;

        const dayList = [];
        const totalDays = Math.max(1, Math.round((range.endMs - range.startMs) / 86400000));
        let totalDischargeKwh = 0;
        let totalNightKwh = 0;
        let elapsedDaysCount = 0;
        let todayDischargeKwh = 0;
        let todayNightKwh = 0;

        for (let dIdx = 0; dIdx < totalDays; dIdx++) {
          const curMs = range.startMs + (dIdx * 86400000) + (10 * 3600 * 1000);
          const p = (typeof getKarachiDate === 'function') ? getKarachiDate(curMs) : {
            year: new Date(curMs + 18000000).getUTCFullYear(),
            month: new Date(curMs + 18000000).getUTCMonth() + 1,
            day: new Date(curMs + 18000000).getUTCDate()
          };
          const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
          const isToday = (key === todayKey);
          const isPast = (key <= todayKey);

          let kwh = null;
          let nightKwh = null;

          if (isPast) {
            kwh = (daySums[key] || 0) / 1000;
            nightKwh = (nightSums[key] || 0) / 1000;

            if (isToday) {
              const liveDisWh = window.monthlyUnits?.batDisT || 0;
              if (liveDisWh > 0) kwh = Math.max(kwh, liveDisWh / 1000);
              todayDischargeKwh = kwh;
              todayNightKwh = nightKwh;
            }

            kwh = Math.max(0, kwh);
            totalDischargeKwh += kwh;
            totalNightKwh += (nightKwh || 0);
            elapsedDaysCount++;
          }

          dayList.push({
            dateKey: key,
            dayLabel: `${p.day}/${p.month}`,
            kwh: kwh,
            nightKwh: nightKwh,
            isToday: isToday,
            isFuture: !isPast
          });
        }

        if (dayList.length > 0) {
          const avgKwh = elapsedDaysCount > 0 ? (totalDischargeKwh / elapsedDaysCount) : 0;
          const avgNightKwh = elapsedDaysCount > 0 ? (totalNightKwh / elapsedDaysCount) : 0;
          const estMonthDischargeKwh = avgKwh * totalDays;
          const estMonthSavedPkr = estMonthDischargeKwh * pkrRate();

          const cyclesSoFar = totalDischargeKwh / packKwh;
          const avgCyclesPerDay = avgKwh / packKwh;
          const estMonthCycles = estMonthDischargeKwh / packKwh;
          const bmsTotalCycles = getFeedVal('Bat2 Cycle Count') || getFeedVal('Bat Cycle Count') || 16;

          const cycleRowHtml = `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed var(--border); flex-wrap:wrap; gap:5px;">
              <span>Cycles (Cycle): <b style="color:#10b981;">${cyclesSoFar.toFixed(1)} cyc</b> (Avg: ${avgCyclesPerDay.toFixed(2)}/d)</span>
              <span>Est. Month Cycles: <b style="color:#38bdf8;">~${estMonthCycles.toFixed(1)} cyc</b> &bull; BMS Lifetime: <b style="color:var(--text-main);">${bmsTotalCycles}</b></span>
            </div>
          `;

          dailyDischargeHtml = render16x2CardGrid({
            title: '🔋 DAILY BATTERY DISCHARGE',
            titleColor: '#10b981',
            dayList,
            totalKwh: totalDischargeKwh,
            totalNightKwh,
            avgKwh,
            avgNightKwh,
            estKwh: estMonthDischargeKwh,
            estPkr: estMonthSavedPkr,
            pkrSuffix: 'saved',
            todayUnits: todayDischargeKwh,
            todayNightUnits: todayNightKwh,
            hoverId: 'fd-battery-cell-hover',
            valColorDefault: '#f97316',
            extraHeaderRow: cycleRowHtml
          });
        }
      } catch (e) {
        console.warn('Battery daily discharge calculation error:', e);
      }

      return cellHtml + cyclesForecastHtml + dailyDischargeHtml;
    }

  async function buildBattery2Extras() {
      return buildBatteryExtras();
    }


  // ── Attach shared symbols to FX ──
  FX.buildBatteryExtras = buildBatteryExtras;
  FX.buildBattery2Extras = buildBattery2Extras;
})();

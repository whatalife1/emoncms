// js/23d-flow-extras-generic-daily.js
// ─── Generic appliance daily-grid builder ──────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    pkrRate, getFeedVal, fetchTodayFeedDayNightStats,
    formatTodayDayNightStatsHtml, render16x2CardGrid
  } = FX;

  async function buildGenericApplianceDailyGrid(opts) {
      const {
        title, titleColor, feedId, secondFeedId, liveTodayName, secondLiveName,
        hoverId, valColor, isPct, hideNight, isPc
      } = opts;

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

        const fetchPromises = [
          (typeof fetchWithCache === 'function') ? fetchWithCache(feedId, range.startMs, nowMs) : {}
        ];
        if (secondFeedId) {
          fetchPromises.push((typeof fetchWithCache === 'function') ? fetchWithCache(secondFeedId, range.startMs, nowMs) : {});
        }

        const todayStatsPromise = (!isPct && feedId) ? fetchTodayFeedDayNightStats(feedId, isPc) : Promise.resolve(null);

        const [raw1, raw2, todayStats] = await Promise.all([
          fetchPromises[0],
          secondFeedId ? fetchPromises[1] : Promise.resolve({}),
          todayStatsPromise
        ]);

        const daySums = {};
        const nightSums = {};
        const dayCounts = {};
        const nightCounts = {};

        const processFeed = (rawMap) => {
          for (const [tsStr, val] of Object.entries(rawMap || {})) {
            if (val == null || isNaN(val) || val < 0) continue;
            const ts = parseInt(tsStr, 10);
            const tsMs = ts < 2e9 ? ts * 1000 : ts;
            if (tsMs < range.startMs || tsMs > nowMs + 3600000) continue;

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
            const numVal = parseFloat(val);
            daySums[key] = (daySums[key] || 0) + numVal;
            dayCounts[key] = (dayCounts[key] || 0) + 1;

            const isNight = (p.hour >= 16 || p.hour < 7);
            if (isNight) {
              nightSums[key] = (nightSums[key] || 0) + numVal;
              nightCounts[key] = (nightCounts[key] || 0) + 1;
            }
          }
        };

        processFeed(raw1);
        if (secondFeedId) processFeed(raw2);

        const nowPkt = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: yr, month: mo, day: dy, hour: 12 };
        let todayYr = nowPkt.year, todayMo = nowPkt.month, todayDy = nowPkt.day;
        if (cycleStartHour > 0 && nowPkt.hour < cycleStartHour) {
          const prev = new Date(Date.UTC(todayYr, todayMo - 1, todayDy - 1));
          todayYr = prev.getUTCFullYear(); todayMo = prev.getUTCMonth() + 1; todayDy = prev.getUTCDate();
        }
        const todayKey = `${todayYr}-${String(todayMo).padStart(2, '0')}-${String(todayDy).padStart(2, '0')}`;

        const dayList = [];
        const totalDays = Math.max(1, Math.round((range.endMs - range.startMs) / 86400000));
        let totalCycleKwh = 0;
        let totalNightKwh = 0;
        let elapsedDaysCount = 0;
        let todayUnits = 0;
        let todayNightUnits = 0;

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
            if (isPct) {
              kwh = (daySums[key] || 0) / (dayCounts[key] || 1);
              nightKwh = (nightSums[key] || 0) / (nightCounts[key] || 1);
            } else {
              kwh = (daySums[key] || 0) / 1000;
              nightKwh = (nightSums[key] || 0) / 1000;
            }

            if (isToday) {
              let live = getFeedVal(liveTodayName);
              if (secondLiveName) live = (live || 0) + (getFeedVal(secondLiveName) || 0);
              if (live != null && (isPct || live > kwh)) kwh = live;
              if (todayStats && todayStats.totalKwh > kwh) kwh = todayStats.totalKwh;
              if (todayStats && todayStats.nightKwh > 0) nightKwh = todayStats.nightKwh;
              todayUnits = kwh;
              todayNightUnits = nightKwh || 0;
            }

            kwh = Math.max(0, kwh);
            nightKwh = Math.max(0, nightKwh);
            totalCycleKwh += kwh;
            totalNightKwh += nightKwh;
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
          const avgKwh = elapsedDaysCount > 0 ? (totalCycleKwh / elapsedDaysCount) : 0;
          const avgNightKwh = elapsedDaysCount > 0 ? (totalNightKwh / elapsedDaysCount) : 0;
          const estMonthKwh = isPct ? null : avgKwh * totalDays;
          const estMonthPkr = isPct ? null : estMonthKwh * pkrRate();
          const todayStatsHtml = formatTodayDayNightStatsHtml(todayStats, titleColor);

          return render16x2CardGrid({
            title,
            titleColor,
            dayList,
            totalKwh: isPct ? avgKwh : totalCycleKwh,
            totalNightKwh: isPct ? null : totalNightKwh,
            avgKwh: isPct ? Math.min(...dayList.filter(d=>!d.isFuture).map(d=>d.kwh||0)) : avgKwh,
            avgNightKwh: isPct ? null : avgNightKwh,
            estKwh: estMonthKwh,
            estPkr: estMonthPkr,
            pkrSuffix: '',
            todayUnits,
            todayNightUnits,
            hoverId,
            valColorDefault: valColor,
            isPct,
            hideNight,
            todayStatsHtml
          });
        }
      } catch (e) {
        console.warn(`Appliance grid error for ${title}:`, e);
      }
      return '';
    }


  // ── Attach shared symbols to FX ──
  FX.buildGenericApplianceDailyGrid = buildGenericApplianceDailyGrid;
})();

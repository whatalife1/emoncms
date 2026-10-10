// js/23n2-analytics-load.js
// ─── Flow Extras Analytics: data loading (per-tab, per-feed) ──────────
// Auto-split from js/23n-flow-extras-analytics.js

(function () {
  'use strict';

  const FX  = window.FX = window.FX || {};
  const FXA = FX.analytics = FX.analytics || {};

  const { BAT2_IDS, MONTH_SHORT, MONTH_NAMES } = FX;

  async function loadBoxPeriodData(ctx) {
    const state = ctx.state;
    const cfg   = ctx.cfg;
    const boxKey = ctx.boxKey;
    const isBattery = ctx.isBattery;
    const dom = ctx.dom;

    if (dom.loadingEl) {
      dom.loadingEl.style.display = 'block';
      dom.loadingEl.textContent = 'Loading ' + cfg.title + ' data…';
    }

    const pktNow = (typeof getPktNow === 'function') ? getPktNow() : new Date();
    const nowMs  = Date.now();
    const rate   = FX.pkrRate();
    const cycleStartHour = (typeof window.graphDayStartHour !== 'undefined')
      ? window.graphDayStartHour : 7;

    let startMs, endMs, periodLabel, periodSub;
    let isDayMode = false;

    if (state.tab === 'today') {
      startMs = (typeof getPktTodayStart === 'function')
        ? getPktTodayStart(cycleStartHour) : (nowMs - 86400000);
      endMs   = startMs + 24 * 3600 * 1000 - 1;
      periodLabel = 'Today';
      periodSub   = formatPktTime(startMs, 'date');
      isDayMode   = true;
    } else if (state.tab === 'day') {
      const base = new Date(pktNow.getTime());
      base.setDate(base.getDate() + state.dayOffset);
      const y = base.getFullYear(), m = base.getMonth() + 1, d = base.getDate();
      startMs = (typeof getPktDayStart === 'function')
        ? getPktDayStart(y, m, d) + cycleStartHour * 3600 * 1000
        : (nowMs - 86400000);
      endMs = startMs + 24 * 3600 * 1000 - 1;
      periodLabel = state.dayOffset === 0 ? 'Today'
                  : (state.dayOffset === -1 ? 'Yesterday'
                  : (d + ' ' + (MONTH_SHORT[m - 1] || '')));
      periodSub   = d + ' ' + (MONTH_NAMES[m - 1] || '') + ' ' + y;
      dom.datePicker.value =
        y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      isDayMode = true;
    } else if (state.tab === 'month') {
      const y = pktNow.getFullYear();
      const m = pktNow.getMonth() + 1 + state.monthOffset;
      const r = (typeof getPktBillingRange === 'function')
        ? getPktBillingRange(y, m)
        : { startMs: nowMs - 30 * 86400000, endMs: nowMs };
      startMs = r.startMs;
      endMs   = r.endMs;
      const d1 = new Date(startMs + 18000000);
      const d2 = new Date(endMs   + 18000000);
      periodLabel = d1.getUTCDate() + '/' + (d1.getUTCMonth() + 1) + ' → ' +
                    d2.getUTCDate() + '/' + (d2.getUTCMonth() + 1) + '/' +
                    d2.getUTCFullYear();
      periodSub   = 'Billing Cycle (25th → 26th)';
    } else { // year
      const y = pktNow.getFullYear() + state.yearOffset;
      startMs = Date.UTC(y, 0, 1) - 18000000;
      endMs   = Date.UTC(y, 11, 31, 23, 59, 59) - 18000000;
      periodLabel = '' + y;
      periodSub   = 'Calendar Year';
    }

    dom.navLabelEl.textContent = periodLabel;
    dom.navSubEl.textContent   = periodSub;

    const canGoNext = (state.tab === 'day'   && state.dayOffset   < 0) ||
                      (state.tab === 'month' && state.monthOffset < 0) ||
                      (state.tab === 'year'  && state.yearOffset  < 0);
    dom.navNextBtn.style.opacity = canGoNext ? '1' : '0.35';

    try {
      // ── Battery mode (Day-style only) ──
      if (isBattery && isDayMode) {
        const resSec = 120;
        const totalPoints = Math.ceil((24 * 3600) / resSec);
        const navObj = {
          startMs: startMs,
          endMs: endMs,
          resSeconds: resSec,
          nBars: totalPoints,
          isDayTab: true
        };

        let socPts = [], voltPts = [], pwrBars = new Array(totalPoints).fill(0);

        if (boxKey === 'battery2') {
          const tasks = [
            _gFetch(BAT2_IDS.soc,  startMs, endMs, resSec),
            _gFetch(BAT2_IDS.volt, startMs, endMs, resSec),
            _gFetch(BAT2_IDS.power, startMs, endMs, resSec)
          ];
          const [rawSoc, rawVolt, rawPwr] = await Promise.all(tasks);
          socPts  = rawSoc  || [];
          voltPts = rawVolt || [];
          const pBars = (typeof _pointsToBars === 'function')
            ? _pointsToBars(rawPwr, navObj, 'bat2power') : [];
          for (let i = 0; i < totalPoints; i++) pwrBars[i] = Math.round(pBars[i] || 0);
        } else {
          const tasks = [
            _gFetch('546019', startMs, endMs, resSec),
            _gFetch('546013', startMs, endMs, resSec),
            _gFetch('546022', startMs, endMs, resSec),
            _gFetch('546025', startMs, endMs, resSec)
          ];
          const [rawSoc, rawVolt, rawChg, rawDis] = await Promise.all(tasks);
          socPts  = rawSoc  || [];
          voltPts = rawVolt || [];
          const vBars = (typeof _pointsToBars === 'function')
            ? _pointsToBars(rawVolt, navObj, 'batv')   : [];
          const cBars = (typeof _pointsToBars === 'function')
            ? _pointsToBars(rawChg,  navObj, 'batchg') : [];
          const dBars = (typeof _pointsToBars === 'function')
            ? _pointsToBars(rawDis,  navObj, 'batdis') : [];
          for (let i = 0; i < totalPoints; i++) {
            const v = vBars[i] || 52.0;
            pwrBars[i] = Math.round(v * ((cBars[i] || 0) - (dBars[i] || 0)));
          }
        }

        let lastIdx = totalPoints;
        if (state.tab === 'today' ||
            (state.tab === 'day' && state.dayOffset === 0)) {
          lastIdx = Math.floor((nowMs - 60000 - startMs) / (resSec * 1000)) + 1;
          lastIdx = Math.max(0, Math.min(lastIdx, totalPoints));
        }

        const rawSocBars = (typeof _pointsToBars === 'function')
          ? _pointsToBars(socPts,  navObj, 'battery') : [];
        const voltBars   = (typeof _pointsToBars === 'function')
          ? _pointsToBars(voltPts, navObj, 'batv')    : [];

        const socBars = (typeof window.smoothBatterySocBars === 'function')
          ? window.smoothBatterySocBars(rawSocBars, totalPoints, state.isSmooth !== false)
          : rawSocBars;

        const packKwh = (boxKey === 'battery' &&
                         typeof solarCfg !== 'undefined' &&
                         solarCfg && solarCfg.batteryKwh > 0)
          ? solarCfg.batteryKwh : 5.12;

        let sessions = [];
        if (typeof window.detectBatterySessions === 'function') {
          try {
            sessions = window.detectBatterySessions(socBars, resSec, lastIdx, 10, 2.0) || [];
          } catch (e) {
            console.warn('detectBatterySessions error:', e);
          }
        }

        state.cachedData = {
          startMs, endMs, periodLabel, periodSub, isDayMode: true,
          resSec, totalPoints, lastIdx, packKwh,
          socBars, voltBars, pwrBars, sessions,
          ptsData: socPts, rate
        };

        FXA.renderBatteryTogglesBar(ctx);
        FXA.computeAndRenderBoxAnalytics(ctx);
        return;
      }

      // ── Standard non-battery feeds ──
      let ptsData = [], ptsAux = [], ptsF1 = [], ptsF2 = [], outageSummary = null;

      if (isDayMode) {
        const tasks = [ _gFetch(cfg.feedId, startMs, endMs, 120) ];
        if (cfg.secondFeedId)      tasks.push(_gFetch(cfg.secondFeedId, startMs, endMs, 120));
        else if (cfg.voltFeedId)   tasks.push(_gFetch(cfg.voltFeedId,   startMs, endMs, 120));
        else if (cfg.humFeedId)    tasks.push(_gFetch(cfg.humFeedId,    startMs, endMs, 120));
        else if (cfg.disFeedId)    tasks.push(_gFetch(cfg.disFeedId,    startMs, endMs, 120));

        const res = await Promise.all(tasks);
        ptsData = res[0] || [];
        ptsAux  = res[1] || [];

        if (cfg.isFridges) {
          ptsF1 = ptsData;
          ptsF2 = ptsAux;
          const map2 = new Map(ptsF2);
          ptsData = ptsF1.map(function (p) {
            return [p[0], (p[1] || 0) + (map2.get(p[0]) || 0)];
          });
        }
      } else {
        const tasks = [ fetchWithCache(cfg.feedId, startMs, endMs) ];
        if (cfg.secondFeedId) tasks.push(fetchWithCache(cfg.secondFeedId, startMs, endMs));
        if (boxKey === 'grid' && typeof fetchAcBreakdown === 'function') {
          tasks.push(fetchAcBreakdown(startMs, endMs));
        }

        const res = await Promise.all(tasks);
        const raw1 = res[0] || {};
        const raw2 = cfg.secondFeedId ? (res[1] || {}) : {};
        if (boxKey === 'grid') outageSummary = res[res.length - 1];

        const combinedMap = {};
        Object.entries(raw1).forEach(function (kv) {
          combinedMap[kv[0]] = parseFloat(kv[1]) || 0;
        });
        Object.entries(raw2).forEach(function (kv) {
          combinedMap[kv[0]] = (combinedMap[kv[0]] || 0) + (parseFloat(kv[1]) || 0);
        });

        ptsData = Object.entries(combinedMap).map(function (kv) {
          return [parseInt(kv[0], 10), kv[1]];
        });
        ptsF1 = Object.entries(raw1).map(function (kv) {
          return [parseInt(kv[0], 10), parseFloat(kv[1]) || 0];
        });
        ptsF2 = Object.entries(raw2).map(function (kv) {
          return [parseInt(kv[0], 10), parseFloat(kv[1]) || 0];
        });
      }

      ptsData.sort(function (a, b) { return a[0] - b[0]; });
      ptsAux .sort(function (a, b) { return a[0] - b[0]; });
      ptsF1  .sort(function (a, b) { return a[0] - b[0]; });
      ptsF2  .sort(function (a, b) { return a[0] - b[0]; });

      state.cachedData = {
        startMs, endMs, periodLabel, periodSub, isDayMode,
        ptsData, ptsAux, ptsF1, ptsF2, outageSummary, rate,
        dailyMap: {}
      };

      if (dom.batTogglesWrap) dom.batTogglesWrap.style.display = 'none';
      FXA.computeAndRenderBoxAnalytics(ctx);

    } catch (err) {
      console.warn('Analytics load error for ' + cfg.title + ':', err);
      if (dom.loadingEl) {
        dom.loadingEl.textContent = 'Failed to load analytics.';
        setTimeout(function () { if (dom.loadingEl) dom.loadingEl.style.display = 'none'; }, 1500);
      }
    } finally {
      if (dom.loadingEl && state.cachedData) dom.loadingEl.style.display = 'none';
    }
  }

  FXA.loadBoxPeriodData = loadBoxPeriodData;
})();

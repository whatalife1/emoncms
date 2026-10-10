// js/22i-flow-detail-night.js
// ─── Flow Detail: battery night-discharge helpers ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _pktMs(y, m, d, h) { return Date.UTC(y, m, d, h - 5, 0, 0); }

  function _currentNightCycles() {
    const isPkt = (new Date().getTimezoneOffset() === -300);
    const nowMs = Date.now();
    let pktY, pktM, pktD, pktH;
    if (isPkt) {
      const d = new Date(nowMs);
      pktY = d.getFullYear(); pktM = d.getMonth(); pktD = d.getDate(); pktH = d.getHours();
    } else {
      const d = new Date(nowMs + 18000000);
      pktY = d.getUTCFullYear(); pktM = d.getUTCMonth();
      pktD = d.getUTCDate();     pktH = d.getUTCHours();
    }
    const anchor = (pktH >= 7) ? pktD : (pktD - 1);
    const cycStart   = FD._pktMs(pktY, pktM, anchor, 7);
    const cycEnd     = FD._pktMs(pktY, pktM, anchor + 1, 7);
    const nightStart = FD._pktMs(pktY, pktM, anchor, 16);
    const nightEnd   = cycEnd;
    const prevNightStart = FD._pktMs(pktY, pktM, anchor - 1, 16);
    const prevNightEnd   = cycStart;
    return {
      curStart: nightStart, curEnd: nightEnd,
      prevStart: prevNightStart, prevEnd: prevNightEnd,
      cycleStart: cycStart, cycleEnd: cycEnd
    };
  }

  async function _fetchBatteryNightDischarge() {
    if (Date.now() - FD._batNightCache.ts < 5 * 60 * 1000 && FD._batNightCache.ts > 0) return FD._batNightCache;
    if (typeof _gFetch !== 'function') return FD._batNightCache;
    const cyc = FD._currentNightCycles();
    try {
      const results = await Promise.all([
        _gFetch('546025', cyc.prevStart - 600000, Date.now(), 600),
        _gFetch('546013', cyc.prevStart - 600000, Date.now(), 600),
        _gFetch('546019', cyc.prevStart - 600000, Date.now(), 600)
      ]);
      const ampPts = results[0] || [], voltPts = results[1] || [], socPts = results[2] || [];
      const vMap = new Map();
      voltPts.forEach(function (p) {
        if (p && p[0] != null && p[1] != null && p[1] > 35) vMap.set(p[0], p[1]);
      });
      const factor = 600 / 3600;
      let tWh = 0, yWh = 0;
      ampPts.forEach(function (p) {
        if (!p || p[0] == null || p[1] == null) return;
        const tsMs = p[0] < 2e9 ? p[0] * 1000 : p[0];
        const v = vMap.get(p[0]) || 52.8;
        const wh = Math.max(0, p[1]) * v * factor;
        if (tsMs >= cyc.curStart && tsMs < cyc.curEnd)  tWh += wh;
        else if (tsMs >= cyc.prevStart && tsMs < cyc.prevEnd) yWh += wh;
      });

      // True Battery Chemical Drain via BMS ΔSOC
      const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
      const getSocDeltaWh = function(start, end) {
        const pts = socPts.filter(p => {
          const t = p[0] < 2e9 ? p[0] * 1000 : p[0];
          return t >= start && t <= end && p[1] != null && p[1] > 10;
        });
        if (pts.length < 2) return 0;
        const maxSoc = Math.max(...pts.map(p => p[1]));
        const minSoc = Math.min(...pts.map(p => p[1]));
        const drop = Math.max(0, maxSoc - minSoc);
        return (drop / 100) * packKwh * 1000;
      };

      const tSocWh = getSocDeltaWh(cyc.curStart, cyc.curEnd);
      const ySocWh = getSocDeltaWh(cyc.prevStart, cyc.prevEnd);

      FD._batNightCache = {
        ts: Date.now(),
        T: Math.max(tWh, tSocWh),
        Y: Math.max(yWh, ySocWh)
      };
      return FD._batNightCache;
    } catch (e) {
      console.warn('[flow-detail] night discharge fetch error', e);
      return FD._batNightCache;
    }
  }

  async function _populateBatteryNight(el) {
    if (!el) return;
    if (FD._batNightCache.ts === 0) {
      el.innerHTML = '<span style="color:var(--text-muted); font-size:13px; font-weight:500;">Loading night discharge&hellip;</span>';
    } else {
      FD._renderBatteryNight(el, FD._batNightCache);
    }
    const data = await FD._fetchBatteryNightDischarge();
    if (!el || !el.parentNode) return;
    if (data && data.ts) FD._renderBatteryNight(el, data);
    else el.innerHTML = '<span style="color:var(--text-muted); font-size:13px; font-weight:500;">Night discharge unavailable</span>';
  }

  function _fmtPktShort(ms) {
    const isPkt = (new Date().getTimezoneOffset() === -300);
    const d = isPkt ? new Date(ms) : new Date(ms + 18000000);
    const M = isPkt ? d.getMonth() + 1 : d.getUTCMonth() + 1;
    const D = isPkt ? d.getDate() : d.getUTCDate();
    const h = isPkt ? d.getHours() : d.getUTCHours();
    return M + '/' + D + ' ' + String(h).padStart(2, '0') + ':00';
  }

    function _renderBatteryNight(el, data) {
    const fmt = function (wh) {
      if (wh == null || isNaN(wh) || wh <= 0) return '0 w';
      return wh >= 500 ? (wh / 1000).toFixed(1) + ' kwh' : Math.round(wh) + ' w';
    };
    const cyc = FD._currentNightCycles();
    const label = FD._fmtPktShort(cyc.curStart) + ' \u2192 ' + FD._fmtPktShort(cyc.curEnd);
    el.innerHTML =
      '<div style="color:#c084fc; font-weight:800; font-size:11px; margin-bottom:2px;">🌙 Night Disch</div>' +
      '<div style="color:#c084fc; font-weight:700; font-size:11px;">T: ' + fmt(data.T) + ' &nbsp;Y: ' + fmt(data.Y) + '</div>' +
      '<div style="font-size:9.5px; color:var(--text-muted); font-weight:600; margin-top:2px;">' + label + '</div>';
  }

  // ── Exports ──────────────────────────────────────────────
  FD._pktMs = _pktMs;
  FD._currentNightCycles = _currentNightCycles;
  FD._fetchBatteryNightDischarge = _fetchBatteryNightDischarge;
  FD._populateBatteryNight = _populateBatteryNight;
  FD._fmtPktShort = _fmtPktShort;
  FD._renderBatteryNight = _renderBatteryNight;
})();

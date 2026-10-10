// js/23a-flow-extras-core.js
// ─── Flow Extras: shared constants & helper utilities ──────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX = window.FX || {};

  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const BAT2_IDS = {
      power:      '546365',
      volt:       '546369',
      current:    '546370',
      soc:        '546371',
      soh:        '546372',
      mosfetTemp: '546373',
      bmsTemp:    '546374',
      cycleCount: '546375',
      chgLimV:    '546376',
      chgLimA:    '546377',
      disLimV:    '546378',
      disLimA:    '546379'
    };

  const BOX_ANALYTICS_CONFIG = {
      grid: {
        title: 'Grid (Breaker)',
        feedId: '499374',
        voltFeedId: '499383',
        color: '#ef4444',
        unit: 'W',
        isPower: true
      },
      solar: {
        title: 'Solar Generation',
        feedId: '499380',
        voltFeedId: '499381',
        color: '#f59e0b',
        unit: 'W',
        isPower: true,
        isSolar: true,
        hideNight: true
      },
      battery: {
        title: 'Battery',
        feedId: '546019',
        disFeedId: '546025',
        voltFeedId: '546013',
        color: '#10b981',
        unit: '%',
        isBattery: true
      },
      battery2: {
        title: 'Battery 2 (Dyness)',
        feedId: '546371',
        disFeedId: '546365',
        voltFeedId: '546369',
        color: '#a78bfa',
        unit: '%',
        isBattery: true
      },
      k15: {
        title: 'Kenwood 1.5T',
        feedId: '499362',
        color: '#38bdf8',
        unit: 'W',
        isPower: true
      },
      k1: {
        title: 'Kenwood 1T',
        feedId: '499364',
        color: '#7dd3fc',
        unit: 'W',
        isPower: true
      },
      haier: {
        title: 'Haier 1T',
        feedId: '499367',
        color: '#a5f3fc',
        unit: 'W',
        isPower: true
      },
      fridge: {
        title: 'Fridges',
        feedId: '499373',       // Fridge 1
        secondFeedId: '541348', // Fridge 2
        color: '#c084fc',       // Fridge 1 color (Purple)
        color2: '#22d3ee',      // Fridge 2 color (Cyan)
        unit: 'W',
        isPower: true,
        isFridges: true
      },
      pc: {
        title: 'PC Workstation',
        feedId: '499422',
        color: '#4ade80',
        unit: 'W',
        isPower: true,
        isPc: true
      },
      motor: {
        title: 'Water Motor',
        feedId: '542850',
        color: '#fbbf24',
        unit: 'W',
        isPower: true
      },
      wm: {
        title: 'Washing Machine',
        feedId: '544694',
        color: '#e879f9',
        unit: 'W',
        isPower: true
      },
      water: {
        title: 'Water Tank Level',
        feedId: '499431',
        color: '#0ea5e9',
        unit: '%',
        isEnv: true,
        hideNight: true
      },
      temp: {
        title: 'Temperature 1',
        feedId: '499428',
        humFeedId: '499429',
        color: '#22c55e',
        unit: '°C',
        isEnv: true
      },
      temp2: {
        title: 'Temperature 2',
        feedId: '512473',
        humFeedId: '512474',
        color: '#34d399',
        unit: '°C',
        isEnv: true
      }
    };

  function pkrRate() {
      return (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.pkrPerUnit) || 60;
    }

  function fmtEnergy(v) {
      if (v == null || isNaN(v) || v <= 0) return '0 Wh';
      const wh = v * 1000;
      return Math.abs(wh) >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh) + ' Wh';
    }

  function fmtDuration(min) {
      if (min == null || isNaN(min) || min <= 0) return '0m';
      const h = Math.floor(min / 60);
      const m = Math.round(min % 60);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

  function fmtPkr(v) {
      return 'PKR ' + Math.max(0, Math.round(v || 0)).toLocaleString('en-US');
    }

  function getFeedVal(name) {
      if (!window.lastResultsMap) return null;
      try {
        if (typeof window.lastResultsMap.get === 'function') {
          const item = window.lastResultsMap.get(name);
          return item ? item.value : null;
        }
        if (Array.isArray(window.lastResultsMap)) {
          const item = window.lastResultsMap.find(f => f && f.name === name);
          return item ? item.value : null;
        }
      } catch (e) {}
      return null;
    }

  async function fetch24h(feedKey, resOverride) {
      if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return [];
      const feed = GRAPH_FEEDS.find(f => f.key === feedKey);
      if (!feed || !feed.id) return [];
      const now = Date.now();
      const startMs = now - 24 * 3600 * 1000;
      const resolutions = resOverride ? [resOverride, 120, 300, 600, 900, 1800, 3600] : [120, 300, 600, 900, 1800, 3600];
      for (const res of resolutions) {
        try {
          const pts = await _gFetch(feed.id, startMs, now, res);
          if (pts && pts.length) return pts;
        } catch (e) {}
      }
      return [];
    }

  function detectSessions(pts, thresholdW, minDurationMin) {
      if (!pts || pts.length < 2) return [];
      const sessions = [];
      let cur = null;
      for (let i = 0; i < pts.length; i++) {
        const [ts, v] = pts[i];
        const tsMs = ts < 2e9 ? ts * 1000 : ts;
        const on = v != null && v > thresholdW;
        if (on) {
          if (!cur) cur = { start: tsMs, end: tsMs, sum: 0, n: 0, peak: 0 };
          cur.end = tsMs;
          cur.sum += v;
          cur.n++;
          if (v > cur.peak) cur.peak = v;
        } else if (cur) {
          sessions.push(cur);
          cur = null;
        }
      }
      if (cur) sessions.push(cur);
      return sessions
        .map(s => ({
          start: s.start, end: s.end,
          durMin: Math.max(1, Math.round((s.end - s.start) / 60000)),
          avgW: s.n > 0 ? s.sum / s.n : 0,
          peakW: s.peak
        }))
        .filter(s => s.durMin >= (minDurationMin || 1));
    }

  function totalRuntimeMin(sessions) {
      return sessions.reduce((a, s) => a + s.durMin, 0);
    }

  function energyKwhFromSessions(sessions) {
      return sessions.reduce((a, s) => a + (s.avgW * (s.durMin / 60)), 0) / 1000;
    }

  function timeAgoStr(tsMs) {
      if (!tsMs) return '\u2014';
      const mins = Math.round((Date.now() - tsMs) / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
    }

  function row(label, value, opts) {
      opts = opts || {};
      const color = opts.color || 'var(--text-main)';
      const sub = opts.sub ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:1px;">${opts.sub}</div>` : '';
      return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="font-size:12px;color:var(--text-muted);font-weight:600;flex-shrink:0;">${label}</span>
        <span style="text-align:right;">
          <span style="font-size:13px;font-weight:800;color:${color};">${value}</span>
          ${sub}
        </span>
      </div>`;
    }


  // ── Attach shared symbols to FX ──
  FX.pkrRate = pkrRate;
  FX.fmtEnergy = fmtEnergy;
  FX.fmtDuration = fmtDuration;
  FX.fmtPkr = fmtPkr;
  FX.getFeedVal = getFeedVal;
  FX.fetch24h = fetch24h;
  FX.detectSessions = detectSessions;
  FX.totalRuntimeMin = totalRuntimeMin;
  FX.energyKwhFromSessions = energyKwhFromSessions;
  FX.timeAgoStr = timeAgoStr;
  FX.row = row;
  FX.MONTH_SHORT = MONTH_SHORT;
  FX.MONTH_NAMES = MONTH_NAMES;
  FX.BAT2_IDS = BAT2_IDS;
  FX.BOX_ANALYTICS_CONFIG = BOX_ANALYTICS_CONFIG;
})();

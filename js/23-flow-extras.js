// js/23-flow-extras.js
// FLOW_EXTRAS_PATCH_V1
// ─────────────────────────────────────────────────────────────────────────
// Extra per-box stats shown in the flow-detail popup ("Extra Info" section).
// Computed on-demand only when a popup is opened (not on every poll), using
// a single 24h history fetch per box at the same 120s/3600s resolutions the
// rest of the app already uses. Nothing here touches the main poll loop.
// ─────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // Map each flow-detail box key -> the feed id(s) it needs for extras,
  // plus a renderer that turns raw history into HTML lines.
  const EXTRAS_REGISTRY = {
    solar:   { feeds: ['solar'],                 build: buildSolarExtras   },
    grid:    { feeds: ['grid', 'acvolts'],        build: buildGridExtras    },
    battery: { feeds: ['battery', 'batchg', 'batdis'], build: buildBatteryExtras },
    fridge:  { feeds: ['fridge1', 'fridge2'],     build: buildFridgeExtras  },
    k15:     { feeds: ['k15'],                    build: buildAcExtras.bind(null, 'k15', 'Kenwood 1.5T') },
    k1:      { feeds: ['k1'],                     build: buildAcExtras.bind(null, 'k1', 'Kenwood 1T') },
    haier:   { feeds: ['haier'],                  build: buildAcExtras.bind(null, 'haier', 'Haier 1T') },
    water:   { feeds: ['water'],                  build: buildWaterTankExtras },
    motor:   { feeds: ['motor'],                  build: buildMotorExtras   },
    wm:      { feeds: ['wm'],                     build: buildWmExtras      },
    pc:      { feeds: ['pc'],                     build: buildPcExtras      }
  };

  // ── Small helpers ────────────────────────────────────────────────────

  function pkrRate() {
    return (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.pkrPerUnit) || 60;
  }

  function fmtKwh(v) {
    if (v == null || isNaN(v)) return '0 Wh';
    const wh = v * 1000;
    return wh >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh) + ' Wh';
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

  // Fetch 24h of history for a GRAPH_FEEDS key, at 120s resolution
  // (falls back to coarser resolutions if the feed has gaps).
  async function fetch24h(feedKey) {
    if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return [];
    const feed = GRAPH_FEEDS.find(f => f.key === feedKey);
    if (!feed || !feed.id) return [];
    const now = Date.now();
    const startMs = now - 24 * 3600 * 1000;
    const resolutions = [120, 300, 900, 3600];
    for (const res of resolutions) {
      try {
        const pts = await _gFetch(feed.id, startMs, now, res);
        if (pts && pts.length) return pts;
      } catch (e) { /* try coarser */ }
    }
    return [];
  }

  // Detect ON/OFF "sessions" from a raw watt series: contiguous stretches
  // where value > threshold, each with start/end/duration/avgWatts.
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
        start: s.start,
        end: s.end,
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
    // sum(avgW * durHr) / 1000
    return sessions.reduce((a, s) => a + (s.avgW * (s.durMin / 60)), 0) / 1000;
  }

  function timeAgoStr(tsMs) {
    if (!tsMs) return '—';
    const mins = Math.round((Date.now() - tsMs) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }

  // Row HTML builder — keeps a consistent look across all boxes.
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

  // ── Per-box builders ─────────────────────────────────────────────────

  async function buildSolarExtras() {
    const pts = await fetch24h('solar');
    if (!pts.length) return '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';

    let peakW = 0, peakTs = null;
    for (const [ts, v] of pts) {
      if (v != null && v > peakW) { peakW = v; peakTs = ts < 2e9 ? ts * 1000 : ts; }
    }
    const peakTimeStr = peakTs ? formatPktTime(peakTs, 'time') : '--';

    const solarTodayWh = (window.lastResultsMap?.get('Solar Today')?.value || 0) * 1000;
    const gridTodayWh = (window.lastResultsMap?.get('Breaker Today')?.value || 0) * 1000;
    const totalTodayWh = solarTodayWh + gridTodayWh;
    const selfConsumptionPct = totalTodayWh > 0 ? (solarTodayWh / totalTodayWh * 100) : 0;

    const predictedTodayW = window.currentPredW || 0;
    let forecastPct = null;
    if (typeof _calcHourly === 'function') {
      try {
        const now = new Date();
        const { hourly } = await _calcHourly(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const fullDayForecastWh = hourly.reduce((a, h) => a + h.watt, 0);
        if (fullDayForecastWh > 0) forecastPct = (solarTodayWh / fullDayForecastWh) * 100;
      } catch (e) {}
    }

    const co2Kg = (solarTodayWh / 1000) * 0.4; // rough grid-emission-factor estimate

    let html = '';
    html += row('Peak today', `${Math.round(peakW)} W`, { color: '#facc15', sub: `at ${peakTimeStr}` });
    html += row('Self-consumption', `${selfConsumptionPct.toFixed(0)}%`, { color: '#4ade80', sub: 'of today\u2019s total energy use' });
    if (forecastPct != null) {
      html += row('On track vs forecast', `${forecastPct.toFixed(0)}%`, { color: forecastPct >= 80 ? '#4ade80' : '#f59e0b' });
    }
    html += row('Est. CO\u2082 saved today', `${co2Kg.toFixed(1)} kg`, { color: '#38bdf8', sub: 'rough estimate, 0.4 kg/kWh grid factor' });
    return html;
  }

  async function buildGridExtras() {
    const pts = await fetch24h('acvolts');
    let html = '';
    if (pts.length) {
      const sessions = detectSessions(pts.map(([t, v]) => [t, v != null && v < 50 ? 1 : 0]), 0.5, 1);
      const totalOutageMin = totalRuntimeMin(sessions);
      const count = sessions.length;
      html += row('Outages (24h)', count > 0 ? `${fmtDuration(totalOutageMin)} (${count}x)` : 'None', {
        color: count > 0 ? '#ef4444' : '#4ade80'
      });
      if (sessions.length) {
        const last = sessions[sessions.length - 1];
        html += row('Last outage', `${formatPktTime(last.start, 'time')} \u2192 ${formatPktTime(last.end, 'time')}`, {
          sub: fmtDuration(last.durMin)
        });
      }
    }
    const gridTodayKwh = window.lastResultsMap?.get('Breaker Today')?.value || 0;
    html += row('Cost today', fmtPkr(gridTodayKwh * pkrRate()), { color: '#f87171', sub: `${gridTodayKwh.toFixed(1)} kWh imported` });
    return html || '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';
  }

  async function buildBatteryExtras() {
    const chgM = window.monthlyUnits?.batChgM || 0;
    const disM = window.monthlyUnits?.batDisM || 0;
    const effPct = chgM > 0 ? Math.min(100, (disM / chgM) * 100) : null;

    const chgT = window.monthlyUnits?.batChgT || 0;
    const disT = window.monthlyUnits?.batDisT || 0;
    const netTodayWh = chgT - disT;

    let html = '';
    if (effPct != null) {
      html += row('Cycle efficiency (month)', `${effPct.toFixed(0)}%`, { color: '#10b981', sub: 'discharged \u00f7 charged' });
    }
    html += row('Net today', `${netTodayWh >= 0 ? '+' : ''}${fmtKwh(netTodayWh)}`, {
      color: netTodayWh >= 0 ? '#4ade80' : '#f59e0b',
      sub: netTodayWh >= 0 ? 'net charged' : 'net discharged'
    });

    const pts = await fetch24h('battery');
    if (pts.length) {
      let peakSoc = -1, peakTs = null;
      for (const [ts, v] of pts) {
        if (v != null && v > 10 && v > peakSoc) { peakSoc = v; peakTs = ts < 2e9 ? ts * 1000 : ts; }
      }
      if (peakSoc >= 0 && peakSoc < 99) {
        html += row('Last full charge', peakTs ? timeAgoStr(peakTs) : '\u2014', { sub: peakTs ? formatPktTime(peakTs, 'time') : '' });
      } else if (peakSoc >= 99) {
        html += row('Last full charge', 'Today', { color: '#4ade80', sub: peakTs ? formatPktTime(peakTs, 'time') : '' });
      }
    }
    return html;
  }

  async function buildFridgeExtras() {
    const [pts1, pts2] = await Promise.all([fetch24h('fridge1'), fetch24h('fridge2')]);
    let html = '';
    [{ label: 'Fridge 1', pts: pts1 }, { label: 'Fridge 2', pts: pts2 }].forEach(({ label, pts }) => {
      if (!pts.length) return;
      const sessions = detectSessions(pts, 6, 1);
      const runtimeMin = totalRuntimeMin(sessions);
      const dutyPct = (runtimeMin / (24 * 60)) * 100;
      const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
      html += row(`${label} duty cycle`, `${dutyPct.toFixed(0)}%`, {
        color: dutyPct > 70 ? '#f59e0b' : '#4ade80',
        sub: `${fmtDuration(runtimeMin)} running \u00b7 avg ${Math.round(avgW)}W while on`
      });
    });
    return html || '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';
  }

  async function buildAcExtras(feedKey, label) {
    const pts = await fetch24h(feedKey);
    if (!pts.length) return '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';
    const sessions = detectSessions(pts, 100, 2);
    const runtimeMin = totalRuntimeMin(sessions);
    const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
    const kwh = energyKwhFromSessions(sessions);
    let html = '';
    html += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#38bdf8', sub: `${sessions.length} session${sessions.length === 1 ? '' : 's'}` });
    if (sessions.length) {
      html += row('Avg power while running', `${Math.round(avgW)} W`);
    }
    html += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { color: '#f87171', sub: `${kwh.toFixed(2)} kWh` });
    return html;
  }

  async function buildWaterTankExtras() {
    let html = '';
    const lastOn = window.lastMotorOnTime || 0;
    if (lastOn) {
      html += row('Last fill', timeAgoStr(lastOn), { sub: formatPktTime(lastOn, 'time') });
    }
    const avgFlow = window.waterAvgFlowRate || 0;
    const curLevel = window.lastResultsMap?.get('Water Tank')?.value;
    if (avgFlow > 0.1 && curLevel != null) {
      // Rough estimate: assume drain rate from tank history isn't tracked separately,
      // so this is shown only when we have a meaningful current level + a known avg flow.
      html += row('Current level', `${Math.round(curLevel)}%`, {
        color: curLevel > 50 ? '#38bdf8' : curLevel > 20 ? '#f59e0b' : '#ef4444'
      });
    }
    const pts = await fetch24h('water');
    if (pts.length >= 2) {
      let fillEvents = 0;
      let litersAdded = 0;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1][1], cur = pts[i][1];
        if (prev != null && cur != null && cur - prev > 3) {
          fillEvents++;
        }
      }
      html += row('Fill events (24h)', `${fillEvents}`, { color: '#0ea5e9' });
    }
    return html || '<div style="color:var(--text-muted);font-size:12px;">No recent activity data.</div>';
  }

  async function buildMotorExtras() {
    const pts = await fetch24h('motor');
    if (!pts.length) return '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';
    const sessions = detectSessions(pts, 50, 1);
    const runtimeMin = totalRuntimeMin(sessions);
    const kwh = energyKwhFromSessions(sessions);
    const avgFlow = window.waterAvgFlowRate || 0;
    const litersEst = avgFlow > 0 ? avgFlow * runtimeMin : null;

    let html = '';
    html += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#fbbf24', sub: `${sessions.length} cycle${sessions.length === 1 ? '' : 's'}` });
    if (litersEst != null) {
      html += row('Est. water pumped', `${Math.round(litersEst)} L`, { sub: 'based on avg flow rate' });
    }
    html += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
    return html;
  }

  async function buildWmExtras() {
    const pts = await fetch24h('wm');
    if (!pts.length) return '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';
    const sessions = detectSessions(pts, 20, 3);
    const kwh = energyKwhFromSessions(sessions);
    let html = '';
    html += row('Loads today', `${sessions.length}`, { color: '#e879f9' });
    if (sessions.length) {
      const last = sessions[sessions.length - 1];
      html += row('Last load', `${formatPktTime(last.start, 'time')} \u2013 ${formatPktTime(last.end, 'time')}`, {
        sub: fmtDuration(last.durMin)
      });
      const avgDur = sessions.reduce((a, s) => a + s.durMin, 0) / sessions.length;
      html += row('Avg cycle length', fmtDuration(avgDur));
    }
    html += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
    return html;
  }

  async function buildPcExtras() {
    const pts = await fetch24h('pc');
    if (!pts.length) return '<div style="color:var(--text-muted);font-size:12px;">No 24h data available.</div>';
    const sessions = detectSessions(pts, 20, 2);
    const runtimeMin = totalRuntimeMin(sessions);
    const kwh = energyKwhFromSessions(sessions);
    let html = '';
    html += row('Uptime (24h)', fmtDuration(runtimeMin), { color: '#4ade80' });
    html += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
    return html;
  }

  // ── Public entry point ───────────────────────────────────────────────
  // Called by js/22-flow-detail.js with the box key + a container element.
  // Renders a loading state immediately, then fills in async.
  async function renderFlowExtras(boxKey, containerEl) {
    const entry = EXTRAS_REGISTRY[boxKey];
    if (!entry || !containerEl) {
      if (containerEl) containerEl.style.display = 'none';
      return;
    }
    containerEl.style.display = '';
    containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading extra info\u2026</div>';
    try {
      const html = await entry.build();
      containerEl.innerHTML = html || '<div style="color:var(--text-muted);font-size:12px;">Nothing extra to show.</div>';
    } catch (e) {
      console.warn('flow-extras error for ' + boxKey, e);
      containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Extra info unavailable.</div>';
    }
  }

  window.renderFlowExtras = renderFlowExtras;
  window.FLOW_EXTRAS_REGISTRY = EXTRAS_REGISTRY;
})();

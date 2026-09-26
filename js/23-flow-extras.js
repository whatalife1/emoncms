// js/23-flow-extras.js
// FLOW_EXTRAS_PATCH_V1
// FLOW_EXTRAS_PATCH_V2
// FLOW_EXTRAS_PATCH_V3
// ─────────────────────────────────────────────────────────────────────────
// Extra per-box stats shown in the flow-detail popup ("Extra Info" section),
// plus a dedicated session-annotated, zoom/pan-capable SOC chart for the
// Battery box (mirrors Graphs -> Day -> Battery: colored pills for each
// charge/discharge session, scroll/pinch to zoom, drag to pan).
//
// Computed on-demand only when a popup is opened (not on every poll).
// ─────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const EXTRAS_REGISTRY = {
    solar:   { build: buildSolarExtras   },
    grid:    { build: buildGridExtras    },
    battery: { build: buildBatteryExtras },
    fridge:  { build: buildFridgeExtras  },
    k15:     { build: buildAcExtras.bind(null, 'k15') },
    k1:      { build: buildAcExtras.bind(null, 'k1') },
    haier:   { build: buildAcExtras.bind(null, 'haier') },
    water:   { build: buildWaterTankExtras },
    motor:   { build: buildMotorExtras   },
    wm:      { build: buildWmExtras      },
    pc:      { build: buildPcExtras      }
  };

  // ── Small helpers ────────────────────────────────────────────────────

  function pkrRate() {
    return (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.pkrPerUnit) || 60;
  }

  // v is in kWh
  function fmtKwhVal(v) {
    if (v == null || isNaN(v)) return '0 Wh';
    const wh = v * 1000;
    return Math.abs(wh) >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh) + ' Wh';
  }

  // v is already in Wh
  function fmtWhVal(v) {
    if (v == null || isNaN(v)) return '0 Wh';
    return Math.abs(v) >= 500 ? (v / 1000).toFixed(1) + ' kWh' : Math.round(v) + ' Wh';
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

  async function fetch24h(feedKey, resOverride) {
    if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return [];
    const feed = GRAPH_FEEDS.find(f => f.key === feedKey);
    if (!feed || !feed.id) return [];
    const now = Date.now();
    const startMs = now - 24 * 3600 * 1000;
    const resolutions = resOverride ? [resOverride] : [120, 300, 900, 3600];
    for (const res of resolutions) {
      try {
        const pts = await _gFetch(feed.id, startMs, now, res);
        if (pts && pts.length) return pts;
      } catch (e) { /* try coarser */ }
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

    let forecastPct = null;
    if (typeof _calcHourly === 'function') {
      try {
        const now = new Date();
        const { hourly } = await _calcHourly(now.getFullYear(), now.getMonth() + 1, now.getDate());
        const fullDayForecastWh = hourly.reduce((a, h) => a + h.watt, 0);
        if (fullDayForecastWh > 0) forecastPct = (solarTodayWh / fullDayForecastWh) * 100;
      } catch (e) {}
    }

    const co2Kg = (solarTodayWh / 1000) * 0.4;

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

  // NOTE: batChgM / batDisM / batChgT / batDisT (from window.monthlyUnits) are
  // all stored in Wh already. Use fmtWhVal() for these, never fmtKwhVal().
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
    html += row('Net today', `${netTodayWh >= 0 ? '+' : ''}${fmtWhVal(netTodayWh)}`, {
      color: netTodayWh >= 0 ? '#4ade80' : '#f59e0b',
      sub: netTodayWh >= 0 ? 'net charged' : 'net discharged'
    });

    const pts = await fetch24h('battery');
    if (pts.length) {
      let peakSoc = -1, peakTs = null;
      for (const [ts, v] of pts) {
        if (v != null && v > 10 && v > peakSoc) { peakSoc = v; peakTs = ts < 2e9 ? ts * 1000 : ts; }
      }
      if (peakSoc >= 99) {
        html += row('Last full charge', 'Today', { color: '#4ade80', sub: peakTs ? formatPktTime(peakTs, 'time') : '' });
      } else if (peakSoc >= 0) {
        html += row('Peak SOC (24h)', `${Math.round(peakSoc)}%`, { sub: peakTs ? formatPktTime(peakTs, 'time') : '' });
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

  async function buildAcExtras(feedKey) {
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
    const curLevel = window.lastResultsMap?.get('Water Tank')?.value;
    if (curLevel != null) {
      html += row('Current level', `${Math.round(curLevel)}%`, {
        color: curLevel > 50 ? '#38bdf8' : curLevel > 20 ? '#f59e0b' : '#ef4444'
      });
    }
    const pts = await fetch24h('water');
    if (pts.length >= 2) {
      let fillEvents = 0;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1][1], cur = pts[i][1];
        if (prev != null && cur != null && cur - prev > 3) fillEvents++;
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

  // ── Battery: session-annotated, zoom/pan-capable SOC chart ──────────
  //
  // Reuses window.detectBatterySessions (js/19c1-graphs-state.js) so the
  // session-detection algorithm matches the main Graphs view exactly.
  // Zoom/pan uses the same _computeWindow-style math as the plain 24h
  // charts in js/22-flow-detail.js (scroll = zoom around cursor, drag =
  // pan, pinch = zoom on touch), reimplemented here since it needs to
  // redraw session pills (not just a plain line) on every frame.

  function _computeSocWindow(n, zoom, panX, cW) {
    if (n <= 0) return { startIdx: 0, visibleN: 0 };
    const visibleN = Math.max(2, n / zoom);
    let startIdx = (n - visibleN) / 2 - (panX / cW) * visibleN;
    const maxStart = Math.max(0, n - visibleN);
    if (startIdx < 0) startIdx = 0;
    if (startIdx > maxStart) startIdx = maxStart;
    return { startIdx, visibleN };
  }
  function _panXFromStartIdxSoc(n, zoom, startIdx, cW) {
    const visibleN = Math.max(2, n / zoom);
    const maxStart = Math.max(0, n - visibleN);
    if (startIdx < 0) startIdx = 0;
    if (startIdx > maxStart) startIdx = maxStart;
    return ((n - visibleN) / 2 - startIdx) * cW / visibleN;
  }

  async function buildBatterySocChart(canvas, loadingEl, resetBtn, smoothBtn) {
    if (!canvas) return;
    if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return;
    const feed = GRAPH_FEEDS.find(f => f.key === 'battery');
    if (!feed || !feed.id) return;

    // Fetch up to 48 hours so the user can zoom out significantly more
    const now = Date.now();
    const startFetchMs = now - 48 * 3600 * 1000;
    
    let pts = [];
    for (const res of [120, 300, 600]) {
      try {
        const raw = await _gFetch(feed.id, startFetchMs, now, res);
        if (raw && raw.length) { pts = raw; break; }
      } catch (e) {}
    }

    if (!pts.length) {
      if (loadingEl) loadingEl.textContent = 'No battery data available.';
      return;
    }

    const startMs = pts[0][0] < 2e9 ? pts[0][0] * 1000 : pts[0][0];
    const endMs = Date.now();
    const resSec = 120;
    const nBars = Math.max(2, Math.ceil((endMs - startMs) / (resSec * 1000)));
    const rawBars = new Array(nBars).fill(null);
    pts.forEach(([ts, v]) => {
      const tsMs = ts < 2e9 ? ts * 1000 : ts;
      const idx = Math.floor((tsMs - startMs) / (resSec * 1000));
      if (idx >= 0 && idx < nBars && v != null) rawBars[idx] = v;
    });

    const isSmooth = window.graphBatterySmoothGaps !== false;
    let bars = typeof window.smoothBatterySocBars === 'function'
      ? window.smoothBatterySocBars(rawBars, nBars, isSmooth)
      : rawBars;

    const lastIdx = nBars;
    let sessions = [];
    if (typeof window.detectBatterySessions === 'function') {
      try { sessions = window.detectBatterySessions(bars, resSec, lastIdx, 10, 2.0) || []; }
      catch (e) { console.warn('detectBatterySessions failed', e); }
    }

    const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

    const state = { zoom: 1, panX: 0, bars, rawBars, sessions, resSec, startMs, packKwh };
    canvas.__socState = state;

    function redraw() {
      _drawAnnotatedSocChart(canvas, state.bars, state.sessions, state.resSec, state.startMs, state.packKwh, state.zoom, state.panX);
      if (resetBtn) {
        if (Math.abs(state.zoom - 1) > 0.05 || Math.abs(state.panX) > 1) resetBtn.classList.add('visible');
        else resetBtn.classList.remove('visible');
      }
    }
    state.redraw = redraw;
    state.reset = function () { state.zoom = 1; state.panX = 0; redraw(); };

    redraw();
    if (loadingEl) loadingEl.style.display = 'none';

    _attachSocChartZoom(canvas, state);

    if (resetBtn) {
      resetBtn.onclick = function (e) { e.stopPropagation(); state.reset(); };
    }

    if (smoothBtn) {
      smoothBtn.onclick = function (e) {
        e.stopPropagation();
        window.graphBatterySmoothGaps = !window.graphBatterySmoothGaps;
        try { localStorage.setItem('graphBatterySmoothGaps', window.graphBatterySmoothGaps ? 'true' : 'false'); } catch (err) {}
        const on = window.graphBatterySmoothGaps !== false;
        smoothBtn.innerHTML = on ? '✨ Smooth: ON' : '📊 Real Graph';
        smoothBtn.style.background = on ? 'rgba(56,189,248,0.2)' : 'var(--bg-card)';
        smoothBtn.style.borderColor = on ? '#38bdf8' : 'var(--border)';
        smoothBtn.style.color = on ? '#38bdf8' : 'var(--text-muted)';

        const newBars = typeof window.smoothBatterySocBars === 'function'
          ? window.smoothBatterySocBars(state.rawBars, nBars, on)
          : state.rawBars;
        state.bars = newBars;
        if (typeof window.detectBatterySessions === 'function') {
          try { state.sessions = window.detectBatterySessions(newBars, resSec, nBars, 10, 2.0) || []; } catch(err){}
        }
        redraw();
      };
    }

    if (canvas.__socResizeHandler) window.removeEventListener('resize', canvas.__socResizeHandler);
    canvas.__socResizeHandler = redraw;
    window.addEventListener('resize', redraw);
  }

  function _attachSocChartZoom(canvas, state) {
    if (canvas.__socZoomAttached) return;
    canvas.__socZoomAttached = true;

    const PL = 34, PR = 10;
    let didPinchOrPan = false;

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cW = rect.width - PL - PR;
      if (cW <= 0) return;
      const mx = e.clientX - rect.left;
      const frac = Math.max(0, Math.min(1, (mx - PL) / cW));
      const n = state.bars.length;
      const win0 = _computeSocWindow(n, state.zoom, state.panX, cW);
      const anchorIdx = win0.startIdx + frac * win0.visibleN;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      let nz = state.zoom * factor;
      nz = Math.max(0.4, Math.min(25, nz)); // Allow zooming out to 0.4x
      state.zoom = nz;
      const visibleN = Math.max(2, n / nz);
      state.panX = _panXFromStartIdxSoc(n, nz, anchorIdx - frac * visibleN, cW);
      state.redraw();
    }, { passive: false });

    let mDown = false, sx = 0, sp = 0;
    canvas.addEventListener('mousedown', function (e) {
      mDown = true; sx = e.clientX; sp = state.panX;
      canvas.classList.add('grabbing'); e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!mDown) return;
      state.panX = sp + (e.clientX - sx);
      state.redraw();
    });
    window.addEventListener('mouseup', function () {
      if (!mDown) return;
      mDown = false; canvas.classList.remove('grabbing');
    });

    let tMode = null, tX0 = 0, tPan0 = 0;
    let tDist0 = 0, tZoom0 = 1, tAnchorFrac = 0, tAnchorIdx = 0;

    function pinchInfo(e) {
      const rect = canvas.getBoundingClientRect();
      const cW = rect.width - PL - PR;
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const frac = Math.max(0, Math.min(1, (cx - PL) / cW));
      return { dist, frac, cW };
    }

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = state.panX;
        didPinchOrPan = false;
      } else if (e.touches.length === 2) {
        tMode = 'pinch';
        didPinchOrPan = true;
        const info = pinchInfo(e);
        const n = state.bars.length;
        const win = _computeSocWindow(n, state.zoom, state.panX, info.cW);
        tDist0 = info.dist; tZoom0 = state.zoom;
        tAnchorFrac = info.frac;
        tAnchorIdx = win.startIdx + info.frac * win.visibleN;
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      if (tMode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - tX0;
        if (Math.abs(dx) > 4) didPinchOrPan = true;
        state.panX = tPan0 + dx;
        state.redraw(); e.preventDefault();
      } else if (tMode === 'pinch' && e.touches.length === 2) {
        didPinchOrPan = true;
        const info = pinchInfo(e);
        if (tDist0 <= 0) return;
        let nz = tZoom0 * (info.dist / tDist0);
        nz = Math.max(0.4, Math.min(25, nz)); // Allow zooming out to 0.4x
        state.zoom = nz;
        const n = state.bars.length;
        const visibleN = Math.max(2, n / nz);
        state.panX = _panXFromStartIdxSoc(n, nz, tAnchorIdx - tAnchorFrac * visibleN, info.cW);
        state.redraw(); e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) {
        tMode = null;
      } else if (e.touches.length === 1) {
        tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = state.panX;
      }
    });

    canvas.addEventListener('dblclick', function (e) { e.preventDefault(); state.reset(); });

    let lastTap = 0;
    canvas.addEventListener('touchend', function (e) {
      // Avoid resetting if the user was pinching or panning
      if (e.touches.length !== 0) return;
      if (didPinchOrPan) {
        lastTap = 0;
        didPinchOrPan = false;
        return;
      }
      const now = Date.now();
      if (now - lastTap < 300) {
        state.reset();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });
    canvas.style.cursor = 'grab';
  }

  function _drawAnnotatedSocChart(canvas, bars, sessions, resSec, startMs, packKwh, zoom, panX) {
    zoom = zoom || 1; panX = panX || 0;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const PL = 34, PR = 10, PT = 24, PB = 34;
    const cW = rect.width - PL - PR;
    const cH = rect.height - PT - PB;
    if (cW <= 0 || cH <= 0) return;
    const n = bars.length;

    const win = _computeSocWindow(n, zoom, panX, cW);
    const startIdx = win.startIdx, visibleN = win.visibleN;
    const i0 = Math.max(0, Math.floor(startIdx));
    const i1 = Math.min(n - 1, Math.ceil(startIdx + visibleN));

    const visible = [];
    for (let i = i0; i <= i1; i++) if (bars[i] != null) visible.push(bars[i]);
    let minV = visible.length ? Math.min(...visible) : 0;
    let maxV = visible.length ? Math.max(...visible) : 100;
    minV = Math.max(0, minV - 5);
    maxV = Math.max(108, maxV + 8);
    const range = Math.max(1, maxV - minV);

    function mapX(i) { return PL + ((i - startIdx) / visibleN) * cW; }
    function mapY(v) { return PT + cH - ((v - minV) / range) * cH; }

    // Grid lines
    ctx.fillStyle = '#71717a';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    const gridTicks = [20, 40, 60, 80, 100].filter(v => v >= minV && v <= 100);
    gridTicks.forEach(val => {
      const y = mapY(val);
      ctx.fillText(Math.round(val) + '%', PL - 5, y + 3);
      ctx.strokeStyle = val === 100 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
    });

    // ── Visible Window Time Range (Top right indicator) ──
    const firstVisTs = startMs + i0 * resSec * 1000;
    const lastVisTs  = startMs + Math.min(n - 1, i1) * resSec * 1000;
    const firstTimeStr = formatPktTime(firstVisTs, 'time');
    const lastTimeStr  = formatPktTime(lastVisTs, 'time');
    const visDurationHours = ((lastVisTs - firstVisTs) / 3600000).toFixed(1);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🕒 ${firstTimeStr} → ${lastTimeStr} (${visDurationHours}h)`, rect.width - PR - 2, PT - 8);

    // Zoom factor indicator (Top left)
    if (Math.abs(zoom - 1) > 0.05) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${zoom.toFixed(1)}×`, PL + 4, PT - 8);
    }

    // Gradient fill and main line
    const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
    grad.addColorStop(0, '#10b98155');
    grad.addColorStop(1, '#10b98100');

    ctx.save();
    ctx.beginPath();
    ctx.rect(PL, PT, cW, cH);
    ctx.clip();

    ctx.beginPath();
    let started = false, firstX = null, lastX = null;
    for (let i = i0; i <= i1; i++) {
      if (bars[i] == null) continue;
      const x = mapX(i), y = mapY(bars[i]);
      if (!started) { firstX = x; ctx.moveTo(x, PT + cH); ctx.lineTo(x, y); started = true; }
      else ctx.lineTo(x, y);
      lastX = x;
    }
    if (started && lastX != null) {
      ctx.lineTo(lastX, PT + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    started = false;
    for (let i = i0; i <= i1; i++) {
      if (bars[i] == null) { started = false; continue; }
      const x = mapX(i), y = mapY(bars[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Accent lines along session slopes
    sessions.forEach(seg => {
      if (seg.endIdx < i0 || seg.startIdx > i1) return;
      const isCharge = seg.type === 'charge';
      const clr = isCharge ? '#4ade80' : '#fb923c';

      ctx.save();
      ctx.beginPath();
      let first = true;
      for (let k = Math.max(seg.startIdx, i0); k <= Math.min(seg.endIdx, i1); k++) {
        if (bars[k] == null) continue;
        const x = mapX(k), y = mapY(bars[k]);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = clr;
      ctx.lineWidth = 3;
      ctx.shadowColor = clr;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore(); // Release clip so pills are NEVER cut off!

    // ── Session Pills (With full kWh and Average Wattage) ──
    const isNarrow = cW < 320;
    const renderedPills = [];

    sessions.forEach(seg => {
      if (seg.endIdx < i0 || seg.startIdx > i1) return;
      const isCharge = seg.type === 'charge';
      const clr = isCharge ? '#4ade80' : '#fb923c';
      const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
      const borderClr = isCharge ? '#10b981' : '#f97316';

      const midIdx = Math.round((seg.startIdx + seg.endIdx) / 2);
      const midVal = bars[Math.min(n - 1, Math.max(0, midIdx))];
      if (midVal == null) return;
      const midX = mapX(midIdx), midY = mapY(midVal);
      if (midX < PL - 30 || midX > PL + cW + 30) return;

      const durH = Math.floor(seg.durMin / 60);
      const durM = Math.round(seg.durMin % 60);
      const durStr = durH > 0 ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`) : `${durM}m`;
      const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
      const sign = isCharge ? '+' : '-';
      const avgW = seg.durMin > 0 ? Math.round((kwhEst * 1000) / (seg.durMin / 60)) : 0;
      const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

      // Full info matching graphs/day/battery:
      let text = '';
      if (isNarrow) {
        text = `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}k · Ø ${avgStr})`;
      } else {
        text = `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}kWh · Ø ${avgStr})`;
      }

      ctx.font = `bold ${isNarrow ? 9.5 : 10.5}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(text).width;
      const pw = tw + (isNarrow ? 10 : 14);
      const ph = isNarrow ? 18 : 20;

      let bx = midX - pw / 2;
      bx = Math.max(PL + 2, Math.min(rect.width - PR - pw - 2, bx));

      // Intelligent vertical placement:
      // If SOC is near the bottom (<= 32%), draw ABOVE to prevent going below chart!
      let by;
      if (isCharge) {
        by = (midY > PT + ph + 10) ? (midY - ph - 8) : (midY + 8);
      } else {
        by = (midVal > 32 && midY < PT + cH - ph - 10) ? (midY + 8) : (midY - ph - 8);
      }

      by = Math.max(PT + 2, Math.min(PT + cH - ph - 2, by));
      renderedPills.push({ x: bx, y: by, w: pw, h: ph });

      ctx.save();
      ctx.fillStyle = bgClr;
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, pw, ph, 5);
      else ctx.rect(bx, by, pw, ph);
      ctx.fill();
      ctx.stroke();

      // Connector pin
      ctx.beginPath();
      ctx.moveTo(midX, by > midY ? by : by + ph);
      ctx.lineTo(midX, midY);
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + pw / 2, by + ph / 2 + 0.5);
      ctx.restore();
    });

    // ── X-axis labels with 1st and last visible time highlighted ──
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.font = '8.5px system-ui';
    const maxLabels = Math.max(3, Math.floor(cW / 60));
    const step = Math.max(1, Math.ceil(visibleN / maxLabels));
    const firstTick = Math.ceil(startIdx / step) * step;

    for (let i = firstTick; i < startIdx + visibleN; i += step) {
      if (i < 0 || i >= n) continue;
      const tsMs = startMs + i * resSec * 1000;
      const d = new Date(tsMs);
      const isPkt = (new Date().getTimezoneOffset() === -300);
      const h = isPkt ? d.getHours() : new Date(tsMs + 18000000).getUTCHours();
      const hh = h % 12 || 12;
      const label = hh + (h >= 12 ? 'pm' : 'am');
      const x = mapX(i);
      if (x > PL + 25 && x < PL + cW - 25) {
        ctx.fillText(label, x, PT + cH + 16);
      }
    }

    // Explicit 1st and Last time labels on axis edges
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 8.5px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(firstTimeStr, PL, PT + cH + 16);
    ctx.textAlign = 'right';
    ctx.fillText(lastTimeStr, PL + cW, PT + cH + 16);
  }

  // ── Public entry points ──────────────────────────────────────────────

  async function renderFlowExtras(boxKey, containerEl) {
    const entry = EXTRAS_REGISTRY[boxKey];
    if (!entry || !containerEl) {
      if (containerEl) containerEl.style.display = 'none';
      return;
    }
    containerEl.style.display = '';
    containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading extra info…</div>';
    try {
      const html = await entry.build();
      containerEl.innerHTML = html || '<div style="color:var(--text-muted);font-size:12px;">Nothing extra to show.</div>';
    } catch (e) {
      console.warn('flow-extras error for ' + boxKey, e);
      containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Extra info unavailable.</div>';
    }
  }

  window.renderFlowExtras = renderFlowExtras;
  window.renderBatterySocChart = buildBatterySocChart;
  window.FLOW_EXTRAS_REGISTRY = EXTRAS_REGISTRY;

})();

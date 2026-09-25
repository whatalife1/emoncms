// js/23-flow-extras.js
// FLOW_EXTRAS_PATCH_V1
// FLOW_EXTRAS_PATCH_V2
// ─────────────────────────────────────────────────────────────────────────
// Extra per-box stats shown in the flow-detail popup ("Extra Info" section),
// plus a dedicated session-annotated SOC chart for the Battery box (mirrors
// Graphs -> Day -> Battery: colored pills for each charge/discharge session).
//
// Computed on-demand only when a popup is opened (not on every poll), using
// history fetches at the same 120s/3600s resolutions the rest of the app
// already uses. Nothing here touches the main poll loop.
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
  // all stored in Wh already (see js/03-visuals.js: window.monthlyUnits.batChgT = chgWh).
  // Use fmtWhVal() for these, never fmtKwhVal().
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
    const feed = (typeof GRAPH_FEEDS !== 'undefined') ? GRAPH_FEEDS.find(f => f.key === feedKey) : null;
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

  // ── Battery: session-annotated SOC chart (mirrors Graphs -> Day -> Battery) ──
  //
  // Reuses window.detectBatterySessions (defined in js/19c1-graphs-state.js)
  // so the session-detection algorithm is identical to the main Graphs view.
  // Draws a scaled-down version of the same line + colored pill annotations
  // used by _drawChart() in js/19d5-graphs-render-chart.js, but self-contained
  // so it works inside the small modal canvas without depending on graph
  // navigation state (graphTab/graphDateNav/etc).

  async function buildBatterySocChart(canvas, loadingEl) {
    if (!canvas) return;
    const pts = await fetch24h('battery', 120);
    if (!pts.length) {
      if (loadingEl) loadingEl.textContent = 'No 24h data available.';
      return;
    }

    // Clean dropouts the same way the popup line-chart does: 0%/low glitches
    // get replaced with the nearest valid neighbour, and consecutive samples
    // are aligned onto a fixed 120s grid so detectBatterySessions can use a
    // constant resSec.
    const startMs = pts[0][0] < 2e9 ? pts[0][0] * 1000 : pts[0][0];
    const endMs = Date.now();
    const resSec = 120;
    const nBars = Math.max(2, Math.ceil((endMs - startMs) / (resSec * 1000)));
    const bars = new Array(nBars).fill(null);
    pts.forEach(([ts, v]) => {
      const tsMs = ts < 2e9 ? ts * 1000 : ts;
      const idx = Math.floor((tsMs - startMs) / (resSec * 1000));
      if (idx >= 0 && idx < nBars && v != null) bars[idx] = v;
    });
    // forward-fill gaps so the line doesn't break
    let last = null;
    for (let i = 0; i < nBars; i++) {
      if (bars[i] == null) bars[i] = last;
      else last = bars[i];
    }
    const lastIdx = nBars;

    let sessions = [];
    if (typeof window.detectBatterySessions === 'function') {
      try { sessions = window.detectBatterySessions(bars, resSec, lastIdx, 10, 2.0) || []; }
      catch (e) { console.warn('detectBatterySessions failed', e); }
    }

    const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

    _drawAnnotatedSocChart(canvas, bars, sessions, resSec, startMs, packKwh);
    if (loadingEl) loadingEl.style.display = 'none';

    // Redraw on resize so it stays crisp if the modal is resized.
    const redraw = () => _drawAnnotatedSocChart(canvas, bars, sessions, resSec, startMs, packKwh);
    if (canvas.__socResizeHandler) window.removeEventListener('resize', canvas.__socResizeHandler);
    canvas.__socResizeHandler = redraw;
    window.addEventListener('resize', redraw);
  }

  function _drawAnnotatedSocChart(canvas, bars, sessions, resSec, startMs, packKwh) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const PL = 32, PR = 8, PT = 14, PB = 22;
    const cW = rect.width - PL - PR;
    const cH = rect.height - PT - PB;
    if (cW <= 0 || cH <= 0) return;
    const n = bars.length;

    const valid = bars.filter(v => v != null);
    let minV = valid.length ? Math.min(...valid) : 0;
    let maxV = valid.length ? Math.max(...valid) : 100;
    minV = Math.max(0, minV - 5);
    maxV = Math.min(100, maxV + 5);
    if (maxV - minV < 10) { minV = Math.max(0, minV - 5); maxV = Math.min(100, maxV + 5); }
    const range = Math.max(1, maxV - minV);

    // Grid + Y labels
    ctx.fillStyle = '#71717a';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    const numGrid = 4;
    for (let g = 0; g <= numGrid; g++) {
      const val = minV + (g / numGrid) * range;
      const y = PT + cH - (g / numGrid) * cH;
      ctx.fillText(Math.round(val) + '%', PL - 5, y + 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
    }

    const mapX = (i) => PL + (i / n) * cW;
    const mapY = (v) => PT + cH - ((v - minV) / range) * cH;

    // Area + line
    const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
    grad.addColorStop(0, '#10b98155');
    grad.addColorStop(1, '#10b98100');
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      if (bars[i] == null) continue;
      const x = mapX(i), y = mapY(bars[i]);
      if (!started) { ctx.moveTo(x, PT + cH); ctx.lineTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
    if (started) {
      const lastX = mapX(n - 1);
      ctx.lineTo(lastX, PT + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.beginPath();
    started = false;
    for (let i = 0; i < n; i++) {
      if (bars[i] == null) { started = false; continue; }
      const x = mapX(i), y = mapY(bars[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // X-axis time labels
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.font = '8.5px system-ui';
    const maxLabels = Math.max(3, Math.floor(cW / 55));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i += step) {
      const tsMs = startMs + i * resSec * 1000;
      const d = new Date(tsMs);
      const isPkt = (new Date().getTimezoneOffset() === -300);
      const h = isPkt ? d.getHours() : new Date(tsMs + 18000000).getUTCHours();
      const hh = h % 12 || 12;
      const label = hh + (h >= 12 ? 'pm' : 'am');
      ctx.fillText(label, mapX(i), rect.height - 6);
    }

    // Session pills (scaled-down version of the Graphs-view annotations)
    const isNarrow = cW < 300;
    const renderedPills = [];
    sessions.forEach(seg => {
      const isCharge = seg.type === 'charge';
      const clr = isCharge ? '#4ade80' : '#fb923c';
      const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
      const borderClr = isCharge ? '#10b981' : '#f97316';

      // Accent glow on the line for this session
      ctx.save();
      ctx.beginPath();
      let first = true;
      for (let k = seg.startIdx; k <= seg.endIdx && k < n; k++) {
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

      if (isNarrow && Math.abs(seg.delta) < 4.0) return; // skip tiny sessions on small canvas

      const midIdx = Math.round((seg.startIdx + seg.endIdx) / 2);
      const midVal = bars[Math.min(n - 1, midIdx)];
      if (midVal == null) return;
      const midX = mapX(midIdx), midY = mapY(midVal);

      let durStr = '';
      if (seg.durMin >= 60) {
        const h = Math.floor(seg.durMin / 60), m = seg.durMin % 60;
        durStr = m > 0 ? `${h}h ${m}m` : `${h}h`;
      } else {
        durStr = `${seg.durMin}m`;
      }
      const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
      const sign = isCharge ? '+' : '';
      const text = isNarrow
        ? `${isCharge ? '\u25B2' : '\u25BC'} ${sign}${Math.round(seg.delta)}% \u00b7 ${durStr}`
        : `${isCharge ? '\u25B2' : '\u25BC'} ${sign}${seg.delta.toFixed(1)}% (${kwhEst.toFixed(1)}kWh) \u00b7 ${durStr}`;

      ctx.save();
      ctx.font = `bold ${isNarrow ? 9 : 10}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(text).width;
      const pw = tw + (isNarrow ? 8 : 12);
      const ph = isNarrow ? 15 : 17;

      let bx = midX - pw / 2;
      bx = Math.max(PL + 2, Math.min(rect.width - PR - pw - 2, bx));
      let by = isCharge ? (midY - ph - 8) : (midY + 8);

      const collides = (ty) => renderedPills.some(p => {
        const xOverlap = !(bx + pw < p.x - 3 || bx > p.x + p.w + 3);
        const yOverlap = !(ty + ph < p.y - 2 || ty > p.y + p.h + 2);
        return xOverlap && yOverlap;
      });
      if (collides(by)) {
        const alt = isCharge ? (midY + 8) : (midY - ph - 8);
        if (!collides(alt) && alt >= PT + 1 && alt <= PT + cH - ph - 1) by = alt;
      }
      by = Math.max(PT + 1, Math.min(PT + cH - ph - 1, by));
      renderedPills.push({ x: bx, y: by, w: pw, h: ph });

      ctx.fillStyle = bgClr;
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, pw, ph, 4);
      else ctx.rect(bx, by, pw, ph);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + pw / 2, by + ph / 2 + 0.5);
      ctx.restore();
    });
  }

  // ── Public entry points ──────────────────────────────────────────────

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
  window.renderBatterySocChart = buildBatterySocChart;
  window.FLOW_EXTRAS_REGISTRY = EXTRAS_REGISTRY;
})();

// js/23m-flow-extras-soc-charts.js
// ─── Battery 1 & Battery 2 SOC 24h chart builders ──────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    BAT2_IDS, _panXFromStartIdxSoc, _attachSocChartZoom,
    _drawAnnotatedSocChart
  } = FX;

  async function buildBatterySocChart(canvas, loadingEl, resetBtn, smoothBtn) {
      if (!canvas) return;
      if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return;
      const feed = GRAPH_FEEDS.find(f => f.key === 'battery');
      if (!feed || !feed.id) return;

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
      const n24 = Math.round((24 * 3600) / resSec);
      const defaultZoom = Math.max(1, nBars / n24);
      const rect = canvas.getBoundingClientRect();
      const PL = 34, PR = 10;
      const cW = Math.max(100, (rect.width || 600) - PL - PR);
      const defaultPanX = _panXFromStartIdxSoc(nBars, defaultZoom, nBars - n24, cW);

      const state = {
        zoom: defaultZoom,
        panX: defaultPanX,
        defaultZoom: defaultZoom,
        defaultPanX: defaultPanX,
        bars, rawBars, sessions, resSec, startMs, packKwh
      };
      canvas.__socState = state;

      function redraw() {
        _drawAnnotatedSocChart(canvas, state.bars, state.sessions, state.resSec, state.startMs, state.packKwh, state.zoom, state.panX);
        if (resetBtn) {
          const isChanged = Math.abs(state.zoom - state.defaultZoom) > 0.08 ||
                            Math.abs(state.panX - state.defaultPanX) > 10;
          if (isChanged) resetBtn.classList.add('visible');
          else resetBtn.classList.remove('visible');
        }
      }
      state.redraw = redraw;
      state.reset = function () {
        const r = canvas.getBoundingClientRect();
        const curCw = Math.max(100, (r.width || 600) - PL - PR);
        state.zoom = state.defaultZoom;
        state.panX = _panXFromStartIdxSoc(state.bars.length, state.defaultZoom, state.bars.length - n24, curCw);
        redraw();
      };

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

  async function buildBattery2SocChart(canvas, loadingEl, resetBtn) {
      if (!canvas) return;
      if (typeof _gFetch !== 'function') return;

      const now = Date.now();
      const startFetchMs = now - 48 * 3600 * 1000;

      let pts = [];
      for (const res of [120, 300, 600]) {
        try {
          const raw = await _gFetch(BAT2_IDS.soc, startFetchMs, now, res);
          if (raw && raw.length) { pts = raw; break; }
        } catch (e) {}
      }

      if (!pts.length) {
        if (loadingEl) loadingEl.textContent = 'No Battery 2 SOC data available.';
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

      let bars = typeof window.smoothBatterySocBars === 'function'
        ? window.smoothBatterySocBars(rawBars, nBars, true)
        : rawBars;

      const lastIdx = nBars;
      let sessions = [];
      if (typeof window.detectBatterySessions === 'function') {
        try { sessions = window.detectBatterySessions(bars, resSec, lastIdx, 10, 2.0) || []; }
        catch (e) { console.warn('detectBatterySessions (bat2) failed', e); }
      }

      const packKwh = 5.12;
      const n24_2 = Math.round((24 * 3600) / resSec);
      const defaultZoom2 = Math.max(1, nBars / n24_2);
      const rect2 = canvas.getBoundingClientRect();
      const PL2 = 34, PR2 = 10;
      const cW2 = Math.max(100, (rect2.width || 600) - PL2 - PR2);
      const defaultPanX2 = _panXFromStartIdxSoc(nBars, defaultZoom2, nBars - n24_2, cW2);

      const state = {
        zoom: defaultZoom2,
        panX: defaultPanX2,
        defaultZoom: defaultZoom2,
        defaultPanX: defaultPanX2,
        bars, rawBars, sessions, resSec, startMs, packKwh
      };
      canvas.__soc2State = state;

      function redraw() {
        _drawAnnotatedSocChart(canvas, state.bars, state.sessions, state.resSec, state.startMs, state.packKwh, state.zoom, state.panX);
        if (resetBtn) {
          const isChanged = Math.abs(state.zoom - state.defaultZoom) > 0.08 ||
                            Math.abs(state.panX - state.defaultPanX) > 10;
          if (isChanged) resetBtn.classList.add('visible');
          else resetBtn.classList.remove('visible');
        }
      }
      state.redraw = redraw;
      state.reset = function () {
        const r = canvas.getBoundingClientRect();
        const curCw = Math.max(100, (r.width || 600) - PL2 - PR2);
        state.zoom = state.defaultZoom;
        state.panX = _panXFromStartIdxSoc(state.bars.length, state.defaultZoom, state.bars.length - n24_2, curCw);
        redraw();
      };

      redraw();
      if (loadingEl) loadingEl.style.display = 'none';

      _attachSocChartZoom(canvas, state);

      if (resetBtn) {
        resetBtn.onclick = function (e) { e.stopPropagation(); state.reset(); };
      }

      if (canvas.__soc2ResizeHandler) window.removeEventListener('resize', canvas.__soc2ResizeHandler);
      canvas.__soc2ResizeHandler = redraw;
      window.addEventListener('resize', redraw);
    }


  // ── Attach shared symbols to FX ──
  FX.buildBatterySocChart = buildBatterySocChart;
  FX.buildBattery2SocChart = buildBattery2SocChart;

  // ── Backwards-compatible window aliases ──
  window.buildBatterySocChart = buildBatterySocChart;
  window.buildBattery2SocChart = buildBattery2SocChart;
  window.renderBatterySocChart = buildBatterySocChart;
  window.renderBattery2SocChart = buildBattery2SocChart;
})();

// js/23n5-analytics-events.js
// ─── Flow Extras Analytics: events, battery toggles, TXT/PNG export ───
// Auto-split from js/23n-flow-extras-analytics.js

(function () {
  'use strict';

  const FX  = window.FX = window.FX || {};
  const FXA = FX.analytics = FX.analytics || {};

  // ─── Basic wiring (view mode, time tabs, nav, date picker) ─────────
  function wireBasicEvents(ctx) {
    const dom   = ctx.dom;
    const state = ctx.state;

    dom.viewGraphBtn.onclick  = function () { FXA.updateViewMode(ctx, 'graph');  };
    dom.viewReportBtn.onclick = function () { FXA.updateViewMode(ctx, 'report'); };

    dom.root.querySelectorAll('.fd-ba-time-tab').forEach(function (btn) {
      btn.onclick = function () {
        dom.root.querySelectorAll('.fd-ba-time-tab').forEach(function (b) {
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
        });
        btn.style.background = 'var(--bg-card)';
        btn.style.color = 'var(--text-main)';
        state.tab = btn.dataset.tab;
        state.dayOffset = 0;
        state.monthOffset = 0;
        state.yearOffset = 0;
        state.zoom = 1;
        state.panX = 0;
        state.scrubIdx = null;
        dom.datePicker.style.display = (state.tab === 'day') ? 'inline-block' : 'none';
        FXA.loadBoxPeriodData(ctx);
      };
    });

    dom.navPrevBtn.onclick = function () {
      if (state.tab === 'today')      { state.tab = 'day'; state.dayOffset = -1; FXA.syncTabButtons(ctx); }
      else if (state.tab === 'day')   state.dayOffset--;
      else if (state.tab === 'month') state.monthOffset--;
      else if (state.tab === 'year')  state.yearOffset--;
      state.zoom = 1; state.panX = 0; state.scrubIdx = null;
      FXA.loadBoxPeriodData(ctx);
    };

    dom.navNextBtn.onclick = function () {
      if (state.tab === 'day'   && state.dayOffset   < 0) state.dayOffset++;
      else if (state.tab === 'month' && state.monthOffset < 0) state.monthOffset++;
      else if (state.tab === 'year'  && state.yearOffset  < 0) state.yearOffset++;
      state.zoom = 1; state.panX = 0; state.scrubIdx = null;
      FXA.loadBoxPeriodData(ctx);
    };

    dom.datePicker.onchange = function (e) {
      if (!e.target.value) return;
      const parts = e.target.value.split('-').map(Number);
      const y = parts[0], m = parts[1], d = parts[2];
      const targetUtc = Date.UTC(y, m - 1, d);
      const nowPkt = (typeof getKarachiDate === 'function')
        ? getKarachiDate(Date.now())
        : { year: y, month: m, day: d };
      const todayUtc = Date.UTC(nowPkt.year, nowPkt.month - 1, nowPkt.day);
      state.dayOffset = Math.round((targetUtc - todayUtc) / 86400000);
      state.zoom = 1; state.panX = 0; state.scrubIdx = null;
      FXA.loadBoxPeriodData(ctx);
    };
  }

  // ─── Battery toggles bar ────────────────────────────────────────────
  function renderBatteryTogglesBar(ctx) {
    const dom = ctx.dom;
    const state = ctx.state;
    const isBattery = ctx.isBattery;
    const batTogglesWrap = dom.batTogglesWrap;
    if (!batTogglesWrap) return;
    if (!isBattery || (state.tab !== 'today' && state.tab !== 'day')) {
      batTogglesWrap.style.display = 'none';
      return;
    }
    batTogglesWrap.style.display = 'flex';

    const sessOn = state.showSessions  !== false;
    const voltOn = state.includeVoltage === true;
    const pwrOn  = state.includePower  === true;
    const smoothOn = state.isSmooth !== false;

    const sessColor = '#10b981';
    const voltColor = '#35c0b7';
    const pwrColor  = '#facc15';
    const smoothColor = '#38bdf8';

    batTogglesWrap.innerHTML =
      '<button id="fd-bt-btn-sessions" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ' + sessColor + '; background:' + (sessOn ? 'rgba(16,185,129,0.2)' : 'transparent') + '; color:' + (sessOn ? sessColor : 'var(--text-muted)') + ';">' +
        (sessOn ? '🔋 Sessions (ΔSOC): ON' : '🔋 + Sessions (ΔSOC)') +
      '</button>' +
      '<button id="fd-bt-btn-voltage" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ' + voltColor + '; background:' + (voltOn ? 'rgba(53,192,183,0.2)' : 'transparent') + '; color:' + (voltOn ? voltColor : 'var(--text-muted)') + ';">' +
        (voltOn ? '⚡ Voltage: Added' : '⚡ + Voltage (V)') +
      '</button>' +
      '<button id="fd-bt-btn-power" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ' + pwrColor + '; background:' + (pwrOn ? 'rgba(250,204,21,0.2)' : 'transparent') + '; color:' + (pwrOn ? pwrColor : 'var(--text-muted)') + ';">' +
        (pwrOn ? '⚡ Power: Added' : '⚡ + Power (W)') +
      '</button>' +
      '<button id="fd-bt-btn-smooth" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ' + (smoothOn ? smoothColor : 'var(--border)') + '; background:' + (smoothOn ? 'rgba(56,189,248,0.2)' : 'transparent') + '; color:' + (smoothOn ? smoothColor : 'var(--text-muted)') + ';">' +
        (smoothOn ? '✨ Smooth: ON' : '📊 Real Graph') +
      '</button>';

    const btnSess   = document.getElementById('fd-bt-btn-sessions');
    const btnVolt   = document.getElementById('fd-bt-btn-voltage');
    const btnPwr    = document.getElementById('fd-bt-btn-power');
    const btnSmooth = document.getElementById('fd-bt-btn-smooth');

    if (btnSess) btnSess.onclick = function () {
      state.showSessions = !state.showSessions;
      window.graphBatteryShowSessions = state.showSessions;
      try { localStorage.setItem('graphBatteryShowSessions', state.showSessions ? 'true' : 'false'); } catch (e) {}
      renderBatteryTogglesBar(ctx);
      FXA.computeAndRenderBoxAnalytics(ctx);
    };
    if (btnVolt) btnVolt.onclick = function () {
      state.includeVoltage = !state.includeVoltage;
      window.graphBatteryIncludeVoltage = state.includeVoltage;
      try { localStorage.setItem('graphBatteryIncludeVoltage', state.includeVoltage ? 'true' : 'false'); } catch (e) {}
      renderBatteryTogglesBar(ctx);
      FXA.computeAndRenderBoxAnalytics(ctx);
    };
    if (btnPwr) btnPwr.onclick = function () {
      state.includePower = !state.includePower;
      window.graphBatteryIncludePower = state.includePower;
      try { localStorage.setItem('graphBatteryIncludePower', state.includePower ? 'true' : 'false'); } catch (e) {}
      renderBatteryTogglesBar(ctx);
      FXA.computeAndRenderBoxAnalytics(ctx);
    };
    if (btnSmooth) btnSmooth.onclick = function () {
      state.isSmooth = !state.isSmooth;
      window.graphBatterySmoothGaps = state.isSmooth;
      try { localStorage.setItem('graphBatterySmoothGaps', state.isSmooth ? 'true' : 'false'); } catch (e) {}
      renderBatteryTogglesBar(ctx);
      FXA.loadBoxPeriodData(ctx);
    };
  }

  // ─── Canvas pointer / zoom / scrub events ───────────────────────────
  function setupCanvasEvents(ctx) {
    const state = ctx.state;
    const dom = ctx.dom;
    const canvas = dom.canvas;
    if (!canvas || canvas.__attachedPopupEvents) return;
    canvas.__attachedPopupEvents = true;

    let isMouseDown = false;
    let dragStartX  = 0;
    let dragStartPanX = 0;

    canvas.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      isMouseDown = true;
      dragStartX = e.clientX;
      dragStartPanX = state.panX;
      canvas.style.cursor = 'grabbing';
      FXA.handleHover(ctx, e.clientX);
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      if (isMouseDown) {
        const dx = e.clientX - dragStartX;
        const rect = canvas.getBoundingClientRect();
        const PL = 36, PR = 14, cW = rect.width - PL - PR;
        const maxPan = (cW / 2) * (state.zoom - 1);
        state.panX = Math.max(-maxPan, Math.min(maxPan, dragStartPanX + dx));
        FXA.handleHover(ctx, e.clientX);
        FXA.redrawGraph(ctx);
      } else if (e.target === canvas) {
        FXA.handleHover(ctx, e.clientX);
      }
    });

    window.addEventListener('mouseup', function () {
      if (isMouseDown) {
        isMouseDown = false;
        canvas.style.cursor = 'grab';
      }
    });

    let isTouching = false;
    let touchStartX = 0;
    let touchStartPanX = 0;
    let pinchDist0 = 0;
    let pinchZoom0 = 1;

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        isTouching = true;
        touchStartX = e.touches[0].clientX;
        touchStartPanX = state.panX;
        FXA.handleHover(ctx, e.touches[0].clientX);
      } else if (e.touches.length === 2) {
        isTouching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchDist0 = Math.hypot(dx, dy);
        pinchZoom0 = state.zoom;
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      if (!isTouching) return;
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const rect = canvas.getBoundingClientRect();
        const PL = 36, PR = 14, cW = rect.width - PL - PR;
        const maxPan = (cW / 2) * (state.zoom - 1);
        state.panX = Math.max(-maxPan, Math.min(maxPan, touchStartPanX + dx));
        FXA.handleHover(ctx, e.touches[0].clientX);
        FXA.redrawGraph(ctx);
        if (e.cancelable) e.preventDefault();
      } else if (e.touches.length === 2 && pinchDist0 > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const oldZoom = state.zoom;
        state.zoom = Math.max(1, Math.min(25, pinchZoom0 * (dist / pinchDist0)));
        state.panX *= (state.zoom / oldZoom);
        FXA.redrawGraph(ctx);
        if (e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) {
        isTouching = false;
        pinchDist0 = 0;
        state.scrubIdx = null;
        FXA.redrawGraph(ctx);
      } else if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartPanX = state.panX;
      }
    });

    canvas.addEventListener('wheel', function (e) {
      if (!state.cachedData) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.85;
      const oldZoom = state.zoom;
      const newZoom = Math.max(1, Math.min(25, state.zoom * factor));
      if (newZoom !== oldZoom) {
        state.panX *= (newZoom / oldZoom);
        state.zoom = newZoom;
        const rect = canvas.getBoundingClientRect();
        const PL = 36, PR = 14, cW = rect.width - PL - PR;
        const maxPan = (cW / 2) * (state.zoom - 1);
        state.panX = Math.max(-maxPan, Math.min(maxPan, state.panX));
        FXA.redrawGraph(ctx);
      }
    }, { passive: false });

    canvas.addEventListener('dblclick', function (e) {
      e.preventDefault();
      state.zoom = 1;
      state.panX = 0;
      state.scrubIdx = null;
      FXA.redrawGraph(ctx);
    });

    canvas.addEventListener('mouseleave', function () {
      if (!isMouseDown) {
        state.scrubIdx = null;
        FXA.redrawGraph(ctx);
      }
    });
  }

  // ─── TXT / PNG export ───────────────────────────────────────────────
  function setupExportHandlers(ctx) {
    const dom   = ctx.dom;
    const state = ctx.state;
    const cfg   = ctx.cfg;

    dom.saveTxtBtn.onclick = function () {
      if (!state.cachedRawText) { alert('No report data ready to export.'); return; }
      const cleanLbl = (state.cachedData && state.cachedData.periodLabel
        ? state.cachedData.periodLabel
        : 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = cfg.title.replace(/[^a-zA-Z0-9_-]/g, '_') + '_Report_' + cleanLbl + '.txt';
      const blob = new Blob([state.cachedRawText], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    };

    dom.savePngBtn.onclick = function () {
      const targetEl = (state.view === 'report') ? dom.reportWrap : dom.graphWrap;
      if (!targetEl) return;
      if (typeof html2canvas === 'undefined') { alert('html2canvas library not loaded.'); return; }

      const origBtn = dom.savePngBtn.textContent;
      dom.savePngBtn.disabled = true;
      dom.savePngBtn.textContent = 'Saving…';

      const clone = targetEl.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      clone.style.width = '640px';
      clone.style.background = '#141416';
      clone.style.color = '#f4f4f5';
      clone.style.padding = '14px';
      clone.style.borderRadius = '12px';
      document.body.appendChild(clone);

      html2canvas(clone, {
        backgroundColor: '#141416',
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false
      }).then(function (c) {
        const cleanLbl = (state.cachedData && state.cachedData.periodLabel
          ? state.cachedData.periodLabel
          : 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
        const a = document.createElement('a');
        a.download = cfg.title.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' +
                     (state.view === 'report' ? 'Report' : 'Graph') + '_' + cleanLbl + '.png';
        a.href = c.toDataURL('image/png');
        a.click();
        document.body.removeChild(clone);
        dom.savePngBtn.disabled = false;
        dom.savePngBtn.textContent = origBtn;
      }).catch(function (err) {
        console.error('PNG export failed', err);
        if (clone.parentNode) document.body.removeChild(clone);
        dom.savePngBtn.disabled = false;
        dom.savePngBtn.textContent = origBtn;
        alert('Failed to capture PNG: ' + err.message);
      });
    };
  }

  FXA.wireBasicEvents         = wireBasicEvents;
  FXA.renderBatteryTogglesBar = renderBatteryTogglesBar;
  FXA.setupCanvasEvents       = setupCanvasEvents;
  FXA.setupExportHandlers     = setupExportHandlers;
})();

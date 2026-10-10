// js/23n1-analytics-core.js
// ─── Flow Extras Analytics: core (namespace, HTML, ctx, entry points) ──
// Auto-split from js/23n-flow-extras-analytics.js by
// patch_23n_split_analytics.py

(function () {
  'use strict';

  const FX  = window.FX = window.FX || {};
  const FXA = FX.analytics = FX.analytics || {};
  window.FXA = FXA;

  const { BOX_ANALYTICS_CONFIG } = FX;

  // ─── View-mode switcher ─────────────────────────────────────────────
  function updateViewMode(ctx, newView) {
    ctx.state.view = newView;
    const dom = ctx.dom;
    const titleColor = ctx.titleColor;
    if (newView === 'graph') {
      dom.viewGraphBtn.style.background = 'var(--bg-card)';
      dom.viewGraphBtn.style.borderColor = titleColor;
      dom.viewGraphBtn.style.color = titleColor;
      dom.viewReportBtn.style.background = 'transparent';
      dom.viewReportBtn.style.borderColor = 'var(--border)';
      dom.viewReportBtn.style.color = 'var(--text-muted)';
      dom.graphWrap.style.display = 'flex';
      if (dom.batTogglesWrap && ctx.isBattery &&
          (ctx.state.tab === 'today' || ctx.state.tab === 'day')) {
        dom.batTogglesWrap.style.display = 'flex';
      }
      dom.reportWrap.style.display = 'none';
      FXA.redrawGraph(ctx);
    } else {
      dom.viewReportBtn.style.background = 'var(--bg-card)';
      dom.viewReportBtn.style.borderColor = '#10b981';
      dom.viewReportBtn.style.color = '#10b981';
      dom.viewGraphBtn.style.background = 'transparent';
      dom.viewGraphBtn.style.borderColor = 'var(--border)';
      dom.viewGraphBtn.style.color = 'var(--text-muted)';
      dom.graphWrap.style.display = 'none';
      if (dom.batTogglesWrap) dom.batTogglesWrap.style.display = 'none';
      dom.reportWrap.style.display = 'block';
    }
  }

  // ─── Sync tab button styling ───────────────────────────────────────
  function syncTabButtons(ctx) {
    const dom = ctx.dom;
    const state = ctx.state;
    dom.root.querySelectorAll('.fd-ba-time-tab').forEach(function (b) {
      const active = b.dataset.tab === state.tab;
      b.style.background = active ? 'var(--bg-card)'    : 'transparent';
      b.style.color      = active ? 'var(--text-main)'  : 'var(--text-muted)';
    });
    dom.datePicker.style.display = (state.tab === 'day') ? 'inline-block' : 'none';
  }

  // ─── Main entry ─────────────────────────────────────────────────────
  function renderBoxDetailAnalyticsSection(container, boxKey) {
    if (!container) return;
    const cfg = BOX_ANALYTICS_CONFIG[boxKey] || BOX_ANALYTICS_CONFIG.grid;
    const titleColor = cfg.color || '#ef4444';
    const isBattery = !!cfg.isBattery;

    container.innerHTML = `
      <div id="fd-ba-analytics-root" style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:6px 10px;">
          <div style="display:flex; gap:4px;">
            <button id="fd-ba-view-graph" class="fd-btn" style="background:var(--bg-card); border-color:${titleColor}; color:${titleColor}; font-size:11px; padding:4px 10px;">📈 Graph</button>
            <button id="fd-ba-view-report" class="fd-btn" style="background:transparent; border-color:var(--border); color:var(--text-muted); font-size:11px; padding:4px 10px;">📄 Report</button>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button id="fd-ba-btn-txt" class="fd-btn" style="background:#3b82f6; border-color:#3b82f6; color:#fff; font-size:11px; padding:4px 9px;">Save TXT</button>
            <button id="fd-ba-btn-png" class="fd-btn" style="background:#10b981; border-color:#10b981; color:#fff; font-size:11px; padding:4px 9px;">Save PNG</button>
          </div>
        </div>

        <div style="display:flex; gap:3px; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:3px;">
          <button class="fd-ba-time-tab fd-btn" data-tab="today" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:var(--bg-card); color:var(--text-main);">Today</button>
          <button class="fd-ba-time-tab fd-btn" data-tab="day" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted);">Day</button>
          <button class="fd-ba-time-tab fd-btn" data-tab="month" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted);">Month</button>
          <button class="fd-ba-time-tab fd-btn" data-tab="year" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted);">Year</button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:6px 12px;">
          <button id="fd-ba-nav-prev" class="graph-nav-btn" style="padding:4px 12px; font-size:16px;">‹</button>
          <div style="flex:1; text-align:center; padding:0 8px;">
            <div id="fd-ba-nav-label" style="font-size:13px; font-weight:800; color:var(--text-main);">Today</div>
            <div id="fd-ba-nav-sub" style="font-size:10px; color:var(--text-muted); margin-top:1px;">--</div>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="date" id="fd-ba-date-picker" style="display:none; background:var(--input-bg); border:1px solid var(--border); border-radius:6px; color:var(--text-main); font-size:11px; padding:3px 6px; width:auto; max-width:120px;">
            <button id="fd-ba-nav-next" class="graph-nav-btn" style="padding:4px 12px; font-size:16px;">›</button>
          </div>
        </div>

        <div id="fd-ba-stats-strip" style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid ${titleColor}; border-radius:8px; padding:6px 10px; font-size:11.5px;">
          Loading telemetry...
        </div>

        <div id="fd-ba-graph-wrap" style="position:relative; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:8px 8px 14px 8px; height:250px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <canvas id="fd-ba-canvas" style="width:100%; height:100%; display:block; cursor:grab; touch-action:none;"></canvas>
          <div id="fd-ba-loading" style="position:absolute; font-size:12px; color:var(--text-muted); font-weight:600; background:var(--bg-panel); padding:4px 10px; border-radius:6px; pointer-events:none; z-index:10; display:none;">Loading ${cfg.title} data…</div>
        </div>

        <div id="fd-ba-battery-toggles" style="${isBattery ? 'display:flex;' : 'display:none;'} gap:6px; align-items:center; justify-content:center; flex-wrap:wrap; margin-top:2px;"></div>

        <div id="fd-ba-report-wrap" style="display:none; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:12px; overflow-x:auto;">
          <div id="fd-ba-report-content"></div>
        </div>
      </div>
    `;

    const dom = {
      root:          document.getElementById('fd-ba-analytics-root'),
      viewGraphBtn:  document.getElementById('fd-ba-view-graph'),
      viewReportBtn: document.getElementById('fd-ba-view-report'),
      graphWrap:     document.getElementById('fd-ba-graph-wrap'),
      reportWrap:    document.getElementById('fd-ba-report-wrap'),
      reportContent: document.getElementById('fd-ba-report-content'),
      canvas:        document.getElementById('fd-ba-canvas'),
      loadingEl:     document.getElementById('fd-ba-loading'),
      navPrevBtn:    document.getElementById('fd-ba-nav-prev'),
      navNextBtn:    document.getElementById('fd-ba-nav-next'),
      navLabelEl:    document.getElementById('fd-ba-nav-label'),
      navSubEl:      document.getElementById('fd-ba-nav-sub'),
      datePicker:    document.getElementById('fd-ba-date-picker'),
      statsStrip:    document.getElementById('fd-ba-stats-strip'),
      batTogglesWrap:document.getElementById('fd-ba-battery-toggles'),
      saveTxtBtn:    document.getElementById('fd-ba-btn-txt'),
      savePngBtn:    document.getElementById('fd-ba-btn-png')
    };

    const state = {
      boxKey:          boxKey,
      cfg:             cfg,
      view:            'graph',
      tab:             'today',
      dayOffset:       0,
      monthOffset:     0,
      yearOffset:      0,
      fridgeFilter:    'both',
      showSessions:    window.graphBatteryShowSessions !== false,
      includeVoltage:  window.graphBatteryIncludeVoltage === true,
      includePower:    window.graphBatteryIncludePower === true,
      isSmooth:        window.graphBatterySmoothGaps !== false,
      zoom:            1,
      panX:            0,
      scrubIdx:        null,
      cachedData:      null,
      cachedRawText:   ''
    };

    const ctx = {
      container:  container,
      boxKey:     boxKey,
      cfg:        cfg,
      titleColor: titleColor,
      isBattery:  isBattery,
      state:      state,
      dom:        dom
    };

    // ── Wire up everything and kick off the first data load ──
    FXA.wireBasicEvents(ctx);
    FXA.syncTabButtons(ctx);
    FXA.setupCanvasEvents(ctx);
    FXA.setupExportHandlers(ctx);
    FXA.loadBoxPeriodData(ctx);
  }

  function renderGridDetailSection(container) {
    return renderBoxDetailAnalyticsSection(container, 'grid');
  }

  // ── Exports ──
  FXA.updateViewMode     = updateViewMode;
  FXA.syncTabButtons     = syncTabButtons;
  FXA.renderBoxDetailAnalyticsSection = renderBoxDetailAnalyticsSection;
  FXA.renderGridDetailSection         = renderGridDetailSection;

  window.renderBoxDetailAnalyticsSection = renderBoxDetailAnalyticsSection;
  window.renderGridDetailSection         = renderGridDetailSection;
})();

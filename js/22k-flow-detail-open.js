// js/22k-flow-detail-open.js
// ─── Flow Detail: openFlowDetail entry point ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  async function openFlowDetail(boxKey) {
    const cfg = FD.FLOW_DETAIL_CONFIG[boxKey];
    if (!cfg) return;
    FD._currentBoxKey = boxKey;
    const modal = FD._ensureModal();
    const panel    = modal.querySelector('.fd-panel');
    const titleEl  = modal.querySelector('.fd-title');
    const chartsEl = modal.querySelector('.fd-charts');
    panel.style.setProperty('--fd-color', cfg.color);
    if (boxKey === 'battery' || boxKey === 'battery2') {
      const byNameMap = window.lastResultsMap || new Map();
      const prioVal = (typeof byNameMap.get === 'function' ? byNameMap.get('Inverter Priority')?.value ?? byNameMap.get('547151')?.value : null) ?? window.lastInverterPriority;
      const prioMode = (typeof getInverterPriorityMode === 'function')
        ? getInverterPriorityMode(prioVal)
        : (Math.round(Number(prioVal)) === 1 ? 'SUB' : (Math.round(Number(prioVal)) === 2 ? 'SBU' : null));
      const prioBadge = prioMode ? ' <span class="prio-badge prio-' + prioMode.toLowerCase() + '" style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:800;letter-spacing:0.04em;background:' + (prioMode==='SUB'?'rgba(245,158,11,0.2)':'rgba(16,185,129,0.2)') + ';color:' + (prioMode==='SUB'?'#f59e0b':'#10b981') + ';border:1px solid ' + (prioMode==='SUB'?'rgba(245,158,11,0.45)':'rgba(16,185,129,0.45)') + ';vertical-align:middle;">' + prioMode + '</span>' : '';
      titleEl.innerHTML = '🔋 Dyness 5.12kWh Battery' + prioBadge;
    } else {
      titleEl.textContent = cfg.title;
    }
    modal.classList.add('open');
    FD._refreshModalBody(boxKey);
    // FLOW_EXTRAS_PATCH_V1
    (function () {
      const extrasBody = modal.querySelector('.fd-extras .fd-extras-body');
      const extrasWrap = modal.querySelector('.fd-extras');
      const extrasHdr = modal.querySelector('.fd-extras .fd-extras-header');
      if (extrasHdr) extrasHdr.style.display = '';
      if (typeof window.renderFlowExtras === 'function' && window.FLOW_EXTRAS_REGISTRY && window.FLOW_EXTRAS_REGISTRY[boxKey]) {
        if (extrasWrap) extrasWrap.style.display = '';
        window.renderFlowExtras(boxKey, extrasBody);
      } else if (extrasWrap) {
        extrasWrap.style.display = 'none';
      }
    })();
    chartsEl.innerHTML = '';

    // Universal Analytics & Report Engine for ALL popups!
    if (typeof window.renderBoxDetailAnalyticsSection === 'function') {
      chartsEl.innerHTML = '';
      chartsEl.style.display = '';
      window.renderBoxDetailAnalyticsSection(chartsEl, boxKey);

      // ── GRID POPUP: Automatically render Full System Energy Usage Report at the end ──
      if (boxKey === 'grid' && typeof renderGridFullSystemReportSection === 'function') {
        // Add quick-jump button in top toolbar if available
        const topToolbar = chartsEl.querySelector('#fd-ba-view-report')?.parentElement;
        if (topToolbar && !document.getElementById('fd-ba-view-all-report')) {
          const jumpBtn = document.createElement('button');
          jumpBtn.id = 'fd-ba-view-all-report';
          jumpBtn.className = 'fd-btn';
          jumpBtn.style.cssText = 'background:transparent; border-color:#10b981; color:#10b981; font-size:11px; padding:4px 9px; font-weight:800; cursor:pointer;';
          jumpBtn.innerHTML = '📊 All Feeds';
          jumpBtn.title = 'Scroll down to Full Energy Usage Report';
          jumpBtn.onclick = () => {
            const targetEl = document.getElementById('fd-grid-full-system-report-container');
            if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
          };
          topToolbar.appendChild(jumpBtn);
        }

        const fullReportContainer = document.createElement('div');
        fullReportContainer.id = 'fd-grid-full-system-report-container';
        fullReportContainer.style.cssText = 'margin-top: 16px; border-top: 2px dashed var(--border); padding-top: 14px; width: 100%; box-sizing: border-box;';
        chartsEl.appendChild(fullReportContainer);
        renderGridFullSystemReportSection(fullReportContainer);
      }
      return;
    }

    // FLOW_EXTRAS_PATCH_V2: Battery gets a dedicated session-annotated SOC
    // chart instead of the generic 24h line chart used by other boxes.
    if (boxKey === 'battery' && typeof window.renderBatterySocChart === 'function') {
      const section = document.createElement('div');
      section.className = 'fd-chart-section';
      section.innerHTML =
        '<div class="fd-chart-header"><span class="fd-chart-title">' +
        '<span class="fd-chart-dot" style="background:#10b981"></span>' +
        'Battery SOC — 24h (sessions)</span>' +
        '<span class="fd-chart-hint">scroll / pinch to zoom</span>' +
        '<button type="button" class="fd-chart-reset">Reset</button></div>' +
        '<div class="fd-chart-wrap"><canvas class="fd-chart"></canvas>' +
        '<div class="fd-chart-loading">Loading chart\u2026</div></div>';
      chartsEl.appendChild(section);
      chartsEl.style.display = '';
      const canvas = section.querySelector('.fd-chart');
      const loadingEl = section.querySelector('.fd-chart-loading');
      const resetBtn = section.querySelector('.fd-chart-reset');
      requestAnimationFrame(function () {
        setTimeout(function () {
          window.renderBatterySocChart(canvas, loadingEl, resetBtn);
        }, 20);
      });
      return;
    }

    // FLOW_BATTERY2_PATCH_V1: Battery 2 gets its own SOC (%) session chart
    // when available (built in js/23-flow-extras.js, mirrors Battery 1's),
    // otherwise falls through to the generic per-graph 24h charts below.
    if (boxKey === 'battery2' && typeof window.renderBattery2SocChart === 'function') {
      const section = document.createElement('div');
      section.className = 'fd-chart-section';
      section.innerHTML =
        '<div class="fd-chart-header"><span class="fd-chart-title">' +
        '<span class="fd-chart-dot" style="background:#a78bfa"></span>' +
        'Battery 2 SOC — 24h</span>' +
        '<span class="fd-chart-hint">scroll / pinch to zoom</span>' +
        '<button type="button" class="fd-chart-reset">Reset</button></div>' +
        '<div class="fd-chart-wrap"><canvas class="fd-chart"></canvas>' +
        '<div class="fd-chart-loading">Loading chart\u2026</div></div>';
      chartsEl.appendChild(section);
      chartsEl.style.display = '';
      const canvas = section.querySelector('.fd-chart');
      const loadingEl = section.querySelector('.fd-chart-loading');
      const resetBtn = section.querySelector('.fd-chart-reset');
      requestAnimationFrame(function () {
        setTimeout(function () {
          window.renderBattery2SocChart(canvas, loadingEl, resetBtn);
        }, 20);
      });
      // Also show the Power (W) 24h trend beneath it for extra context.
      const seg2 = FD._buildChartSection(chartsEl, 'bat2power', cfg.color, true);
      await new Promise(function (r) { requestAnimationFrame(r); });
      await new Promise(function (r) { setTimeout(r, 20); });
      await FD._loadChartIntoSegment(seg2);
      if (modal.__resizeHandler) window.removeEventListener('resize', modal.__resizeHandler);
      modal.__resizeHandler = function () {
        if (!modal.classList.contains('open')) return;
        if (seg2.redraw) seg2.redraw();
      };
      window.addEventListener('resize', modal.__resizeHandler);
      return;
    }

    const graphKeys = (cfg.graphs && cfg.graphs.length) ? cfg.graphs : [];
    if (!graphKeys.length || typeof _gFetch !== 'function') {
      chartsEl.style.display = 'none';
      return;
    }
    chartsEl.style.display = '';
    const showLabel = graphKeys.length > 1;
    const segments = graphKeys.map(function (gk) {
      return FD._buildChartSection(chartsEl, gk, cfg.color, showLabel);
    });
    await new Promise(function (r) { requestAnimationFrame(r); });
    await new Promise(function (r) { setTimeout(r, 20); });
    await Promise.all(segments.map(FD._loadChartIntoSegment));
    if (modal.__resizeHandler) window.removeEventListener('resize', modal.__resizeHandler);
    modal.__resizeHandler = function () {
      if (!modal.classList.contains('open')) return;
      segments.forEach(function (seg) { if (seg.redraw) seg.redraw(); });
    };
    window.addEventListener('resize', modal.__resizeHandler);
  }

  // ── Exports ──────────────────────────────────────────────
  FD.openFlowDetail = openFlowDetail;

  // ════════════════════════════════════════════════════════════════════════════
  // ── Full System Energy Usage Report Component (Graphs / Report in Grid) ────
  // ════════════════════════════════════════════════════════════════════════════
  function renderGridFullSystemReportSection(container) {
    if (!container) return;

    let repTab = 'day';
    let repDayNav = 0;
    let repMonthNav = 0;
    let repYearNav = 0;
    let repCycleHour = (window.graphDayStartHour !== undefined ? window.graphDayStartHour : 7);
    let cachedReportText = '';

    // Function to launch the detailed billing usage report slide-panel
    function openDetailedBillingReportPanel() {
      const panel = document.getElementById('usage-report-panel');
      if (panel) panel.classList.add('open');
      const now = new Date();
      const monthInput = document.getElementById('report-month-m');
      const yearInput = document.getElementById('report-month-y');
      if (monthInput) monthInput.value = now.getMonth() + 1;
      if (yearInput) yearInput.value = now.getFullYear();
      if (typeof calculateDetailedReport === 'function') {
        setTimeout(calculateDetailedReport, 80);
      }
    }

    container.innerHTML = `
      <div id="grid-full-rep-root" style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
        
        <!-- Header Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; background:var(--bg-panel); border:1px solid var(--border); border-left:3px solid #10b981; border-radius:10px; padding:8px 12px;">
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span style="font-weight:800; font-size:13px; color:#10b981;">📄 Energy Usage Report (All Feeds)</span>
            <span style="font-size:10px; font-weight:700; color:var(--text-muted); background:var(--bg-card); padding:2px 6px; border-radius:4px; border:1px solid var(--border);">Graphs / Report Engine</span>
          </div>
          <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
            <button id="grid-full-rep-open-detailed" class="fd-btn" style="background:var(--bg-card); border-color:#38bdf8; color:#38bdf8; font-size:10.5px; padding:3px 8px; font-weight:800;" title="Open detailed monthly billing panel">📊 View Detailed Report</button>
            <button id="grid-full-rep-clear-cache" class="fd-btn" style="background:#f59e0b; border-color:#f59e0b; color:#fff; font-size:10px; padding:3px 7px; font-weight:800;" title="Clear cache & refresh">↻ Clear Cache</button>
            <button id="grid-full-rep-txt" class="fd-btn" style="background:#3b82f6; border-color:#3b82f6; color:#fff; font-size:10px; padding:3px 7px; font-weight:800;">Save TXT</button>
            <button id="grid-full-rep-png" class="fd-btn" style="background:#10b981; border-color:#10b981; color:#fff; font-size:10px; padding:3px 7px; font-weight:800;">Save PNG</button>
          </div>
        </div>

        <!-- Time Tabs (Day, Month, Year, Total) -->
        <div style="display:flex; gap:3px; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:3px;">
          <button class="grid-full-rep-time-tab fd-btn" data-tab="day" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:var(--bg-card); color:var(--text-main); font-weight:700;">Day</button>
          <button class="grid-full-rep-time-tab fd-btn" data-tab="month" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted); font-weight:700;">Month</button>
          <button class="grid-full-rep-time-tab fd-btn" data-tab="year" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted); font-weight:700;">Year</button>
          <button class="grid-full-rep-time-tab fd-btn" data-tab="total" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted); font-weight:700;">Total</button>
        </div>

        <!-- Navigation Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:6px 12px; gap:6px;">
          <button id="grid-full-rep-prev" class="graph-nav-btn" style="padding:4px 12px; font-size:16px;">‹</button>
          <div style="flex:1; text-align:center; padding:0 6px;">
            <div id="grid-full-rep-label" style="font-size:13px; font-weight:800; color:var(--text-main);">Today</div>
            <div id="grid-full-rep-sub" style="font-size:10px; color:var(--text-muted); margin-top:1px;">--</div>
          </div>
          <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
            <button id="grid-full-rep-cycle-toggle" class="graph-nav-btn" style="font-size:10px; padding:3px 7px;">${repCycleHour === 7 ? '4pm-7am' : '12am-12am'}</button>
            <input type="date" id="grid-full-rep-date-picker" style="background:var(--input-bg); border:1px solid var(--border); border-radius:6px; color:var(--text-main); font-size:11px; padding:3px 6px; width:auto; max-width:125px;">
            <button id="grid-full-rep-today-btn" class="graph-nav-btn" style="font-size:10px; padding:3px 7px;">Today</button>
            <button id="grid-full-rep-next" class="graph-nav-btn" style="padding:4px 12px; font-size:16px; opacity:0.35;">›</button>
          </div>
        </div>

        <!-- Report Output Container (Auto-loads on open) -->
        <div id="grid-full-rep-out" style="background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:10px; overflow-x:auto;">
          <div id="grid-full-rep-loading" style="text-align:center; color:var(--text-muted); font-size:12px; padding:20px 0;">Loading full system energy report…</div>
        </div>

        <!-- Bottom Detailed Billing Report Button -->
        <div style="margin-top:4px; padding-top:6px;">
          <button id="grid-full-rep-open-detailed-bottom" class="btn-export" style="margin:0; width:100%; padding:10px; font-size:13px;">
            <span>📊</span> View Detailed Report (Billing Panel)
          </button>
        </div>

      </div>
    `;

    const elOut       = document.getElementById('grid-full-rep-out');
    const elLabel     = document.getElementById('grid-full-rep-label');
    const elSub       = document.getElementById('grid-full-rep-sub');
    const elPrev      = document.getElementById('grid-full-rep-prev');
    const elNext      = document.getElementById('grid-full-rep-next');
    const elCycle     = document.getElementById('grid-full-rep-cycle-toggle');
    const elPicker    = document.getElementById('grid-full-rep-date-picker');
    const elTodayBtn  = document.getElementById('grid-full-rep-today-btn');
    const elTxtBtn    = document.getElementById('grid-full-rep-txt');
    const elPngBtn    = document.getElementById('grid-full-rep-png');
    const elClearBtn  = document.getElementById('grid-full-rep-clear-cache');
    const elOpenDet   = document.getElementById('grid-full-rep-open-detailed');
    const elOpenDetB  = document.getElementById('grid-full-rep-open-detailed-bottom');

    if (elOpenDet)  elOpenDet.onclick  = openDetailedBillingReportPanel;
    if (elOpenDetB) elOpenDetB.onclick = openDetailedBillingReportPanel;

    function computeLocalNavInfo() {
      const now = (typeof getPktNow === 'function') ? getPktNow() : new Date();
      if (repTab === 'day') {
        let baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (now.getHours() < repCycleHour) {
          baseDate.setDate(baseDate.getDate() - 1);
        }
        const d = new Date(baseDate);
        d.setDate(d.getDate() + repDayNav);
        const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
        let startMs = (typeof getPktDayStart === 'function')
          ? getPktDayStart(y, m, day) + (repCycleHour * 3600 * 1000)
          : (Date.UTC(y, m - 1, day) - 18000000 + (repCycleHour * 3600 * 1000));
        const res = 120;
        const totalPoints = Math.ceil((24 * 3600) / res);

        let lbl = '';
        if (repDayNav === 0) lbl = 'Today';
        else if (repDayNav === -1) lbl = 'Yesterday';
        else if (repDayNav === 1) lbl = 'Tomorrow';
        else lbl = d.toLocaleDateString('en-PK', { weekday:'short', day:'numeric', month:'short' });

        const mNames = (typeof _MONTH_NAMES !== 'undefined') ? _MONTH_NAMES :
          ['January','February','March','April','May','June','July','August','September','October','November','December'];

        return {
          label: lbl,
          sub: `${day} ${mNames[m-1]} ${y}`,
          interval: res,
          startMs,
          endMs: startMs + 24 * 3600 * 1000 - 1,
          isDayTab: true,
          nBars: totalPoints,
          resSeconds: res,
          year: y, month: m, day
        };
      }
      if (repTab === 'month') {
        let base = new Date(now.getFullYear(), now.getMonth() + repMonthNav, 1);
        let sM = base.getMonth() - 1; let sY = base.getFullYear(); if (sM < 0) { sM = 11; sY--; }
        const start = new Date(sY, sM, 25);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
        const days = Math.ceil((end - start) / 86400000);
        return {
          label: `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`,
          sub: 'Billing Cycle (25th → 26th)',
          interval: 3600,
          isDayTab: false,
          nBars: days,
          startMs: start.getTime(),
          endMs: end.getTime(),
          month: start.getMonth(),
          year: start.getFullYear(),
          isMonthBilling: true,
          resSeconds: 3600
        };
      }
      if (repTab === 'year') {
        const y = now.getFullYear() + repYearNav;
        const start = new Date(y, 0, 1);
        const end = new Date(y, 11, 31, 23, 59, 59);
        return {
          label: `${y}`,
          sub: 'Calendar Year',
          interval: 3600,
          isYearly: true,
          nBars: 12,
          startMs: start.getTime(),
          endMs: end.getTime(),
          year: y,
          isYearBilling: true,
          resSeconds: 3600,
          isYearView: true
        };
      }
      // 'total'
      const start = new Date(2020, 0, 1);
      return {
        label: 'All Time',
        sub: 'Complete History',
        interval: 3600,
        startMs: start.getTime(),
        endMs: now.getTime(),
        resSeconds: 3600
      };
    }

    async function loadReport(forceRefresh = false) {
      const nav = computeLocalNavInfo();
      elLabel.textContent = nav.label;
      elSub.textContent   = nav.sub || '';

      const isDay = (repTab === 'day');
      elCycle.style.display    = isDay ? 'inline-block' : 'none';
      elPicker.style.display   = isDay ? 'inline-block' : 'none';
      elTodayBtn.style.display = isDay ? 'inline-block' : 'none';

      if (isDay && nav.year && nav.month && nav.day) {
        elPicker.value = `${nav.year}-${String(nav.month).padStart(2,'0')}-${String(nav.day).padStart(2,'0')}`;
      }

      const canFwd = (repTab === 'day' && repDayNav < 0) ||
                     (repTab === 'month' && repMonthNav < 0) ||
                     (repTab === 'year' && repYearNav < 0);
      elNext.style.opacity = canFwd ? '1' : '0.35';

      elOut.innerHTML = '<div style="text-align:center; color:var(--text-muted); font-size:12px; padding:24px 0;">⏳ Loading full system report…</div>';

      try {
        if (typeof window.generateGraphReport !== 'function') {
          elOut.innerHTML = '<div style="color:#ef4444; font-size:12px; padding:12px;">generateGraphReport function not found.</div>';
          return;
        }

        const rep = await window.generateGraphReport(forceRefresh, nav, repTab, repCycleHour !== 0);
        cachedReportText = rep.text || '';
        const html = rep.html || '';

        elOut.innerHTML = html + `<pre style="white-space:pre; margin:20px 0 0 0; font-family:monospace; border-top:1px dashed var(--border); padding-top:16px; color:var(--text-muted); opacity:0.85; font-size:10.5px;">${cachedReportText}</pre>`;
      } catch (err) {
        console.error('Grid Full Report error:', err);
        elOut.innerHTML = `<div style="color:#ef4444; font-size:12px; padding:16px;">Failed to generate report: ${err.message}</div>`;
      }
    }

    // Tab buttons
    container.querySelectorAll('.grid-full-rep-time-tab').forEach(b => {
      b.onclick = () => {
        container.querySelectorAll('.grid-full-rep-time-tab').forEach(x => {
          x.style.background = 'transparent';
          x.style.color = 'var(--text-muted)';
        });
        b.style.background = 'var(--bg-card)';
        b.style.color = 'var(--text-main)';
        repTab = b.dataset.tab;
        repDayNav = 0; repMonthNav = 0; repYearNav = 0;
        loadReport();
      };
    });

    elPrev.onclick = () => {
      if (repTab === 'day') repDayNav--;
      else if (repTab === 'month') repMonthNav--;
      else if (repTab === 'year') repYearNav--;
      loadReport();
    };

    elNext.onclick = () => {
      const canFwd = (repTab === 'day' && repDayNav < 0) ||
                     (repTab === 'month' && repMonthNav < 0) ||
                     (repTab === 'year' && repYearNav < 0);
      if (canFwd) {
        if (repTab === 'day') repDayNav++;
        else if (repTab === 'month') repMonthNav++;
        else if (repTab === 'year') repYearNav++;
        loadReport();
      }
    };

    elCycle.onclick = () => {
      repCycleHour = (repCycleHour === 7) ? 0 : 7;
      elCycle.textContent = (repCycleHour === 7) ? '4pm-7am' : '12am-12am';
      loadReport();
    };

    elPicker.onchange = (e) => {
      if (!e.target.value) return;
      const [y, m, d] = e.target.value.split('-').map(Number);
      const targetUtc = Date.UTC(y, m - 1, d);
      const nowPkt = (typeof getKarachiDate === 'function') ? getKarachiDate(Date.now()) : { year: y, month: m, day: d };
      const todayUtc = Date.UTC(nowPkt.year, nowPkt.month - 1, nowPkt.day);
      repDayNav = Math.round((targetUtc - todayUtc) / 86400000);
      loadReport();
    };

    elTodayBtn.onclick = () => {
      repDayNav = 0;
      loadReport();
    };

    elClearBtn.onclick = () => {
      if (typeof clearReportCache === 'function') clearReportCache();
      loadReport(true);
    };

    elTxtBtn.onclick = () => {
      if (!cachedReportText) { alert('No report generated yet.'); return; }
      const nav = computeLocalNavInfo();
      const cleanLabel = (nav.sub || nav.label || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      const blob = new Blob([cachedReportText], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.download = `All_Feeds_Energy_Report_${cleanLabel}.txt`;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    };

    elPngBtn.onclick = () => {
      const wrapper = elOut.querySelector('.report-wrapper');
      if (!wrapper) { alert('No report content to capture.'); return; }
      if (typeof html2canvas === 'undefined') { alert('html2canvas library not loaded.'); return; }

      const origText = elPngBtn.textContent;
      elPngBtn.disabled = true;
      elPngBtn.textContent = 'Saving…';

      const origTable = wrapper.querySelector('table');
      const tableWidth = origTable ? Math.max(origTable.scrollWidth, 920) : 920;
      const containerWidth = tableWidth + 40;

      const clone = wrapper.cloneNode(true);
      clone.style.width = tableWidth + 'px';
      clone.style.maxWidth = tableWidth + 'px';
      clone.style.boxSizing = 'border-box';
      clone.style.margin = '0 auto';

      const tableScroll = clone.querySelector('.table-scroll');
      if (tableScroll) {
        tableScroll.style.overflow = 'visible';
        tableScroll.style.width = '100%';
        tableScroll.style.maxWidth = 'none';
      }

      const captureWrap = document.createElement('div');
      captureWrap.style.cssText = `position:fixed; top:0; left:0; width:${containerWidth}px; background:#ffffff; padding:20px; z-index:-9999; font-family:system-ui,sans-serif; color:#18181b; box-sizing:border-box;`;
      
      const nav = computeLocalNavInfo();
      const title = document.createElement('div');
      title.style.cssText = 'font-size:18px; font-weight:bold; margin-bottom:12px; border-bottom:2px solid #ddd; padding-bottom:8px;';
      title.textContent = '📄 Energy Usage Report (All Feeds) – ' + (nav.sub || nav.label);
      captureWrap.appendChild(title);
      captureWrap.appendChild(clone);
      document.body.appendChild(captureWrap);

      html2canvas(captureWrap, {
        backgroundColor: '#ffffff',
        scale: 2.5,
        useCORS: true,
        logging: false,
        width: containerWidth,
        height: captureWrap.scrollHeight
      }).then(canvas => {
        const cleanLabel = (nav.sub || nav.label || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
        const a = document.createElement('a');
        a.download = `All_Feeds_Energy_Report_${cleanLabel}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        document.body.removeChild(captureWrap);
        elPngBtn.disabled = false;
        elPngBtn.textContent = origText;
      }).catch(err => {
        console.error('PNG error:', err);
        if (captureWrap.parentNode) document.body.removeChild(captureWrap);
        elPngBtn.disabled = false;
        elPngBtn.textContent = origText;
        alert('Failed to capture PNG: ' + err.message);
      });
    };

    // Auto-generate on open by default!
    loadReport();
  }

  window.renderGridFullSystemReportSection = renderGridFullSystemReportSection;
})();

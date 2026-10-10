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
})();

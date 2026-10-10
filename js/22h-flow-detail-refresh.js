// js/22h-flow-detail-refresh.js
// ─── Flow Detail: refreshModalBody dispatcher ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _refreshModalBody(boxKey) {
    const cfg = FD.FLOW_DETAIL_CONFIG[boxKey];
    if (!cfg) return;
    const modal = document.getElementById('flow-detail-modal');
    if (!modal) return;
    const container = modal.querySelector('.fd-lines');
    if (!container) return;
    container.classList.remove('fd-lines--kpi');

    // FLOW_BATTERY2_PATCH_V1: Battery 2 has its own dedicated renderer that
    // does not depend on scraping SVG text (its layout is denser than the
    // generic line-list format), so short-circuit before the line-scrape path.
    if (boxKey === 'battery2') {
      container.classList.remove('is-loading');
      FD._renderBattery2Grid(container);
      return;
    }

    const lines = FD._extractBoxLines(boxKey);
    if (!lines.length) {
      container.classList.add('is-loading');
      container.innerHTML = '<div class="fd-empty">Waiting for live data&hellip;</div>';
      return;
    }
    container.classList.remove('is-loading');

    if (boxKey === 'battery') {
      FD._renderBattery3Boxes(container, lines);
      return;
    }

    if (boxKey === 'solar') {
      const MODAL_DY_SCALE = 0.35;
      let minDy = 0;
      const solarLines = lines.filter(function (l) {
        return !/^(Today|Month|Pred2):/i.test(l.text.trim());
      });
      solarLines.forEach(function (_, i) {
        const ov = FD._textOv(boxKey, i);
        if (typeof ov.dy === 'number' && ov.dy < minDy) minDy = ov.dy;
      });
      const extraTop = Math.max(0, -minDy * MODAL_DY_SCALE);
      container.style.paddingTop = (16 + extraTop) + 'px';
      container.style.paddingBottom = '16px';
      container.style.gap = '8px';
      container.__fdDyScale = MODAL_DY_SCALE;

      container.innerHTML = solarLines.map(function (l, i) {
        return FD._lineHtml(l, i, cfg.color, boxKey);
      }).join('');
      return;
    }

    // All other boxes share the compact KPI-grid layout.
    FD._renderKpiGrid(container, lines, boxKey, cfg);
    return;
  }

  // ── Exports ──────────────────────────────────────────────
  FD._refreshModalBody = _refreshModalBody;
})();

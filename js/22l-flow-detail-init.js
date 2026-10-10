// js/22l-flow-detail-init.js
// ─── Flow Detail: flow click handlers + patch + init ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _attachFlowClickHandlers() {
    const wrap = document.getElementById('flow-svg-wrap');
    if (!wrap || typeof LAYOUT === 'undefined') return;
    const svg = wrap.querySelector('svg');
    if (!svg) return;
    if (svg.__flowDetailAttached) return;
    svg.__flowDetailAttached = true;
    const rects = svg.querySelectorAll(':scope > rect');
    const byPos = new Map();
    rects.forEach(function (r) {
      const x = parseFloat(r.getAttribute('x'));
      const y = parseFloat(r.getAttribute('y'));
      if (!isNaN(x) && !isNaN(y)) byPos.set(x + ',' + y, r);
    });
    Object.keys(LAYOUT).forEach(function (key) {
      if (!FD.FLOW_DETAIL_CONFIG[key]) return;
      const d = LAYOUT[key];
      const r = byPos.get(d.x + ',' + d.y);
      if (!r) return;
      r.setAttribute('data-flow-box', key);
      r.addEventListener('click', function (e) {
        e.stopPropagation();
        FD.openFlowDetail(key);
      });
    });

    svg.addEventListener('click', function (e) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgP = pt.matrixTransform(ctm.inverse());
      for (const [key, d] of Object.entries(LAYOUT)) {
        if (!FD.FLOW_DETAIL_CONFIG[key]) continue;
        if (svgP.x >= d.x && svgP.x <= d.x + d.w && svgP.y >= d.y && svgP.y <= d.y + d.h) {
          e.stopPropagation();
          FD.openFlowDetail(key);
          break;
        }
      }
    });
  }

  function _patchFlowDiagram() {
    if (typeof window.renderFlowDiagram !== 'function') return false;
    if (window.renderFlowDiagram.__flowDetailPatched) return true;
    const orig = window.renderFlowDiagram;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      try {
        FD._attachFlowClickHandlers();
        if (FD._currentBoxKey) {
          const modal = document.getElementById('flow-detail-modal');
          if (modal && modal.classList.contains('open')) FD._refreshModalBody(FD._currentBoxKey);
        }
      } catch (e) { console.warn('flow detail post-render', e); }
      return r;
    };
    wrapped.__flowDetailPatched = true;
    window.renderFlowDiagram = wrapped;
    return true;
  }

  function _init() {
    FD._patchFlowDiagram();
    setTimeout(FD._attachFlowClickHandlers, 120);
    const wrap = document.getElementById('flow-svg-wrap');
    if (wrap) {
      const obs = new MutationObserver(function () {
        try { FD._attachFlowClickHandlers(); } catch (e) {}
      });
      obs.observe(wrap, { childList: true, subtree: true });
    }
  }

  // ── Exports ──────────────────────────────────────────────
  FD._attachFlowClickHandlers = _attachFlowClickHandlers;
  FD._patchFlowDiagram = _patchFlowDiagram;
  FD._init = _init;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', FD._init);
  } else {
    FD._init();
  }

  window.openFlowDetail  = FD.openFlowDetail;
  window.closeFlowDetail = FD.closeFlowDetail;
})();

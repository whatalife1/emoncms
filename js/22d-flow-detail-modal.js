// js/22d-flow-detail-modal.js
// ─── Flow Detail: modal shell + drag / resize / persistence ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _ensureModal() {
    let modal = document.getElementById('flow-detail-modal');
    if (modal) return modal;
    FD._injectStyle();
    modal = document.createElement('div');
    modal.id = 'flow-detail-modal';
    modal.innerHTML = `
      <div class="fd-backdrop"></div>
      <div class="fd-panel">
        <div class="fd-header">
          <span class="fd-title">Detail</span>
          <span class="fd-header-actions">
            <button class="fd-btn fd-reset-pos" type="button" title="Reset size &amp; position">&#x27F2;</button>
            <button class="fd-btn fd-close" type="button" aria-label="Close">&#x2715;</button>
          </span>
        </div>
        <div class="fd-body">
          <div class="fd-lines is-loading">Loading&hellip;</div>
          <div class="fd-extras" style="display:none;"><div class="fd-extras-header">📊 Extra Info</div><div class="fd-extras-body"></div></div>
          <div class="fd-charts"></div>
        </div>
        <div class="fd-resize" title="Drag to resize"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.fd-backdrop').addEventListener('click', FD.closeFlowDetail);
    modal.querySelector('.fd-close').addEventListener('click', FD.closeFlowDetail);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) FD.closeFlowDetail();
    });
    FD._attachModalDragResize(modal);
    return modal;
  }

  function closeFlowDetail() {
    const modal = document.getElementById('flow-detail-modal');
    if (modal) modal.classList.remove('open');
    FD._currentBoxKey = null;
  }

  function _applyPrefs(panel, p) {
    if (!p) return;
    if (window.innerWidth < 640) return;
    const maxW = Math.max(320, window.innerWidth - 20);
    const maxH = Math.max(300, window.innerHeight - 20);
    const w = Math.min(p.width || 680, maxW);
    const h = Math.min(p.height || 500, maxH);
    const left = Math.max(0, Math.min(p.left || 0, window.innerWidth - w));
    const top  = Math.max(0, Math.min(p.top  || 0, window.innerHeight - h));
    panel.classList.add('fd-floating');
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
    panel.style.width = w + 'px';
    panel.style.height = h + 'px';
  }

  function _clearPrefs(panel) {
    panel.classList.remove('fd-floating');
    panel.style.left = ''; panel.style.top = '';
    panel.style.width = ''; panel.style.height = '';
  }

  function _savePrefs(panel) {
    if (!panel.classList.contains('fd-floating')) {
      try { localStorage.removeItem(FD.PREFS_KEY); } catch (e) {}
      return;
    }
    const r = panel.getBoundingClientRect();
    try {
      localStorage.setItem(FD.PREFS_KEY, JSON.stringify({
        left: r.left, top: r.top, width: r.width, height: r.height
      }));
    } catch (e) {}
  }

  function _attachModalDragResize(modal) {
    if (modal.__dragResizeAttached) return;
    modal.__dragResizeAttached = true;
    const panel  = modal.querySelector('.fd-panel');
    const header = modal.querySelector('.fd-header');
    const handle = modal.querySelector('.fd-resize');
    const reset  = modal.querySelector('.fd-reset-pos');

    try {
      const raw = localStorage.getItem(FD.PREFS_KEY);
      if (raw) FD._applyPrefs(panel, JSON.parse(raw));
    } catch (e) {}

    function ensureFloating() {
      if (panel.classList.contains('fd-floating')) return;
      const r = panel.getBoundingClientRect();
      panel.classList.add('fd-floating');
      panel.style.left = r.left + 'px';
      panel.style.top = r.top + 'px';
      panel.style.width = r.width + 'px';
      panel.style.height = r.height + 'px';
    }

    let drag = null;
    header.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      if (window.innerWidth < 640) return;
      ensureFloating();
      drag = { x: e.clientX, y: e.clientY,
               l: parseFloat(panel.style.left), t: parseFloat(panel.style.top) };
      header.classList.add('grabbing');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!drag) return;
      const w = panel.offsetWidth, h = panel.offsetHeight;
      let nl = drag.l + (e.clientX - drag.x);
      let nt = drag.t + (e.clientY - drag.y);
      nl = Math.max(0, Math.min(nl, window.innerWidth - w));
      nt = Math.max(0, Math.min(nt, window.innerHeight - h));
      panel.style.left = nl + 'px';
      panel.style.top = nt + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (!drag) return;
      drag = null;
      header.classList.remove('grabbing');
      FD._savePrefs(panel);
      if (modal.__resizeHandler) modal.__resizeHandler();
    });

    let rz = null;
    handle.addEventListener('mousedown', function (e) {
      if (window.innerWidth < 640) return;
      ensureFloating();
      rz = { x: e.clientX, y: e.clientY,
             w: panel.offsetWidth, h: panel.offsetHeight,
             l: parseFloat(panel.style.left), t: parseFloat(panel.style.top) };
      e.preventDefault(); e.stopPropagation();
    });
    window.addEventListener('mousemove', function (e) {
      if (!rz) return;
      const minW = 320, minH = 300;
      const maxW = window.innerWidth - rz.l - 4;
      const maxH = window.innerHeight - rz.t - 4;
      const nw = Math.max(minW, Math.min(rz.w + (e.clientX - rz.x), maxW));
      const nh = Math.max(minH, Math.min(rz.h + (e.clientY - rz.y), maxH));
      panel.style.width = nw + 'px';
      panel.style.height = nh + 'px';
    });
    window.addEventListener('mouseup', function () {
      if (!rz) return;
      rz = null;
      FD._savePrefs(panel);
      if (modal.__resizeHandler) setTimeout(modal.__resizeHandler, 40);
    });

    reset.addEventListener('click', function (e) {
      e.stopPropagation();
      FD._clearPrefs(panel);
      try { localStorage.removeItem(FD.PREFS_KEY); } catch (e2) {}
      if (modal.__resizeHandler) setTimeout(modal.__resizeHandler, 40);
    });
  }

  // ── Exports ──────────────────────────────────────────────
  FD._ensureModal = _ensureModal;
  FD.closeFlowDetail = closeFlowDetail;
  FD._applyPrefs = _applyPrefs;
  FD._clearPrefs = _clearPrefs;
  FD._savePrefs = _savePrefs;
  FD._attachModalDragResize = _attachModalDragResize;
})();

// js/22-flow-detail.js  (v2)
// Click a flow-diagram box -> big-screen modal that mirrors every line
// of that box (read from the live SVG snapshot) + a 24-hour trend graph.

(function () {
  'use strict';

  // ── Config: only for the modal header title/color and which graph to draw
  const FLOW_DETAIL_CONFIG = {
    weather: { title: 'Weather',         color: '#0ea5e9', graph: null },
    solar:   { title: 'Solar',           color: '#f59e0b', graph: 'solar' },
    grid:    { title: 'Grid',            color: '#ef4444', graph: 'grid' },
    battery: { title: 'Battery',         color: '#10b981', graph: 'battery' },
    haier:   { title: 'Haier 1Ton',      color: '#a5f3fc', graph: 'haier' },
    k15:     { title: 'Kenwood 1.5T',    color: '#38bdf8', graph: 'k15' },
    k1:      { title: 'Kenwood 1T',      color: '#7dd3fc', graph: 'k1' },
    pc:      { title: 'PC',              color: '#4ade80', graph: 'pc' },
    fridge:  { title: 'Fridges',         color: '#c084fc', graph: 'fridge1' },
    water:   { title: 'Water Tank',      color: '#0ea5e9', graph: 'water' },
    motor:   { title: 'Water Motor',     color: '#fbbf24', graph: 'motor' },
    wm:      { title: 'Washing Machine', color: '#e879f9', graph: 'wm' },
    temp:    { title: 'Temperature',     color: '#22c55e', graph: 'temp' },
    temp2:   { title: 'Temperature 2',   color: '#22c55e', graph: 'temp2' }
  };

  let _currentBoxKey = null;

  // ─────────────────────────────────────────────────────────────────────
  // CSS
  // ─────────────────────────────────────────────────────────────────────
  function _injectStyle() {
    if (document.getElementById('flow-detail-styles')) return;
    const s = document.createElement('style');
    s.id = 'flow-detail-styles';
    s.textContent = `
      #flow-svg-wrap rect[data-flow-box] { cursor: pointer; transition: filter .15s ease; }
      #flow-svg-wrap rect[data-flow-box]:hover {
        animation: none !important;
        filter: drop-shadow(0 0 10px rgba(255,255,255,.65)) brightness(1.2) !important;
      }
      #flow-svg-wrap rect[data-flow-box]:active {
        filter: drop-shadow(0 0 16px rgba(255,255,255,.9)) brightness(1.3) !important;
      }

      #flow-detail-modal {
        position: fixed; inset: 0; z-index: 99998;
        display: none; opacity: 0; transition: opacity .18s ease;
        pointer-events: none;
      }
      #flow-detail-modal.open {
        display: flex; align-items: flex-start; justify-content: center;
        opacity: 1; pointer-events: auto;
      }
      #flow-detail-modal .fd-backdrop {
        position: absolute; inset: 0;
        background: rgba(0,0,0,.75);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      #flow-detail-modal .fd-panel {
        position: relative; width: 100%; max-width: 680px;
        margin: 40px auto; max-height: calc(100vh - 80px);
        background: var(--bg-base); border: 1px solid var(--border);
        border-radius: 14px; overflow: hidden;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,.75);
        transform: translateY(10px) scale(.98);
        transition: transform .2s ease;
      }
      #flow-detail-modal.open .fd-panel { transform: translateY(0) scale(1); }
      @media (max-width: 640px) {
        #flow-detail-modal .fd-panel {
          margin: 0; max-height: 100vh;
          border-radius: 0; border: none;
        }
      }

      #flow-detail-modal .fd-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; flex-shrink: 0;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
        border-top: 3px solid var(--fd-color, var(--accent-solar));
      }
      #flow-detail-modal .fd-title {
        font-size: 16px; font-weight: 800; color: var(--text-main);
        letter-spacing: .02em;
      }
      #flow-detail-modal .fd-close {
        background: var(--bg-card); border: 1px solid var(--border);
        color: var(--text-main); border-radius: 8px;
        padding: 4px 11px; font-size: 14px; font-weight: 700; cursor: pointer;
      }
      #flow-detail-modal .fd-close:hover { background: var(--bg-base); }

      #flow-detail-modal .fd-body {
        flex: 1; overflow-y: auto; padding: 14px;
        display: flex; flex-direction: column; gap: 12px;
      }

      #flow-detail-modal .fd-lines {
        display: flex; flex-direction: column;
        align-items: stretch; justify-content: center;
        gap: 8px;
        padding: 22px 16px;
        background:
          radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,.035), transparent 70%),
          var(--bg-panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        min-height: 160px;
      }
      #flow-detail-modal .fd-line {
        line-height: 1.15;
        word-break: break-word;
      }
      #flow-detail-modal .fd-line.multiline > span { display: block; }
      #flow-detail-modal .fd-empty {
        text-align: center; color: var(--text-muted);
        padding: 22px; font-size: 13px; font-weight: 600;
      }

      #flow-detail-modal .fd-chart-header {
        font-size: 11px; font-weight: 800;
        text-transform: uppercase; letter-spacing: .07em;
        color: var(--text-muted); margin-top: 4px;
      }
      #flow-detail-modal .fd-chart-wrap {
        position: relative;
        background: var(--bg-panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px; height: 260px;
        display: flex; align-items: center; justify-content: center;
      }
      #flow-detail-modal canvas.fd-chart {
        width: 100%; height: 100%; display: block;
      }
      #flow-detail-modal .fd-chart-loading {
        position: absolute; font-size: 12px;
        color: var(--text-muted); font-weight: 600;
        background: var(--bg-panel); padding: 4px 10px; border-radius: 6px;
      }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Modal shell
  // ─────────────────────────────────────────────────────────────────────
  function _ensureModal() {
    let modal = document.getElementById('flow-detail-modal');
    if (modal) return modal;
    _injectStyle();
    modal = document.createElement('div');
    modal.id = 'flow-detail-modal';
    modal.innerHTML = `
      <div class="fd-backdrop"></div>
      <div class="fd-panel">
        <div class="fd-header">
          <span class="fd-title">Detail</span>
          <button class="fd-close" type="button" aria-label="Close">&#x2715;</button>
        </div>
        <div class="fd-body">
          <div class="fd-lines"></div>
          <div class="fd-chart-header">24-Hour Trend</div>
          <div class="fd-chart-wrap">
            <canvas class="fd-chart"></canvas>
            <div class="fd-chart-loading">Loading chart&hellip;</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.fd-backdrop').addEventListener('click', closeFlowDetail);
    modal.querySelector('.fd-close').addEventListener('click', closeFlowDetail);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeFlowDetail();
    });
    return modal;
  }

  function closeFlowDetail() {
    const modal = document.getElementById('flow-detail-modal');
    if (modal) modal.classList.remove('open');
    _currentBoxKey = null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // SVG text helpers
  // ─────────────────────────────────────────────────────────────────────
  function _svgTextContent(el) {
    // Handle SVG <text> with <tspan> children.
    // If any tspan has a positive `dy` we treat them as multiple visual
    // lines and join with a newline. Otherwise, use raw textContent so
    // inline colour tspans stay on one line.
    const tspans = Array.from(el.querySelectorAll('tspan'));
    if (tspans.length === 0) return (el.textContent || '').trim();

    const hasBreak = tspans.some(ts => {
      const dy = parseFloat(ts.getAttribute('dy'));
      return !isNaN(dy) && dy > 0;
    });

    if (!hasBreak) return (el.textContent || '').trim();

    const parts = tspans
      .map(ts => (ts.textContent || '').trim())
      .filter(Boolean);
    return parts.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────
  // Extract the lines of the given flow box from the current SVG
  // ─────────────────────────────────────────────────────────────────────
  function _extractBoxLines(boxKey) {
    const wrap = document.getElementById('flow-svg-wrap');
    if (!wrap || typeof LAYOUT === 'undefined') return [];
    const svg = wrap.querySelector('svg');
    const d = LAYOUT[boxKey];
    if (!svg || !d) return [];

    const x1 = d.x, y1 = d.y, x2 = d.x + d.w, y2 = d.y + d.h;
    const lines = [];

    // Text elements are direct children of <svg> in renderFlowDiagram
    svg.querySelectorAll(':scope > text').forEach(t => {
      const tx = parseFloat(t.getAttribute('x'));
      const ty = parseFloat(t.getAttribute('y'));
      if (isNaN(tx) || isNaN(ty)) return;
      if (tx < x1 || tx > x2 || ty < y1 || ty > y2) return;

      const text = _svgTextContent(t);
      if (!text) return;

      const fill = (t.getAttribute('fill') || '').trim();
      lines.push({ y: ty, text, fill });
    });

    lines.sort((a, b) => a.y - b.y);
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Line classification & HTML rendering
  // ─────────────────────────────────────────────────────────────────────
  function _classifyLine(text, isFirst) {
    if (isFirst) return 'title';

    // Standalone value lines: "39%", "48 w", "232V", "3.5 kW", "4.5 kwh"
    if (/^-?[\d.,]+\s*%$/.test(text))          return 'hero';   // 39%
    if (/^-?[\d.,]+\s*[wW]$/.test(text))       return 'hero';   // 48 w
    if (/^-?[\d.,]+\s*kW$/i.test(text))        return 'hero';   // 3.5 kW
    if (/^-?[\d.,]+\s*kWh$/i.test(text))       return 'hero';   // 4.5 kWh
    if (/^-?[\d.,]+\s*[vV]$/.test(text))       return 'hero';   // 232V
    return 'normal';
  }

  function _escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function _lineHtml(line, idx, accentColor) {
    const kind = _classifyLine(line.text, idx === 0);
    const color = (line.fill && line.fill !== 'none') ? line.fill : accentColor;

    let size, weight;
    if (kind === 'hero')      { size = 40; weight = 800; }
    else if (kind === 'title'){ size = 22; weight = 800; }
    else                      { size = 17; weight = 700; }

    const multiline = line.text.includes('\n');
    const inner = multiline
      ? line.text.split('\n').map(p => `<span>${_escape(p)}</span>`).join('')
      : _escape(line.text);

    return `<div class="fd-line${multiline ? ' multiline' : ''}"
                 style="color:${color}; font-size:${size}px; font-weight:${weight};">${inner}</div>`;
  }

  function _refreshModalBody(boxKey) {
    const cfg = FLOW_DETAIL_CONFIG[boxKey];
    if (!cfg) return;
    const modal = document.getElementById('flow-detail-modal');
    if (!modal || !modal.classList.contains('open')) return;

    const lines = _extractBoxLines(boxKey);
    const container = modal.querySelector('.fd-lines');
    if (!container) return;

    if (!lines.length) {
      container.innerHTML = '<div class="fd-empty">Waiting for live data&hellip;</div>';
      return;
    }
    container.innerHTML = lines.map((l, i) => _lineHtml(l, i, cfg.color)).join('');
  }

  // ─────────────────────────────────────────────────────────────────────
  // 24h graph
  // ─────────────────────────────────────────────────────────────────────
  async function _fetch24hGraph(graphKey) {
    if (typeof _gFetch !== 'function' || typeof GRAPH_FEEDS === 'undefined') return null;
    const feed = GRAPH_FEEDS.find(f => f.key === graphKey);
    if (!feed) return null;

    const now = Date.now();
    const startMs = now - 24 * 3600 * 1000;
    const interval = 600; // 10 min buckets
    const pts = await _gFetch(feed.id, startMs, now, interval);

    const nBars = Math.round((24 * 3600) / interval);
    const sum = new Array(nBars).fill(0);
    const cnt = new Array(nBars).fill(0);
    pts.forEach(p => {
      if (!p || p[1] == null) return;
      const idx = Math.floor((p[0] * 1000 - startMs) / (interval * 1000));
      if (idx < 0 || idx >= nBars) return;
      sum[idx] += p[1];
      cnt[idx]++;
    });
    const values = sum.map((s, i) => cnt[i] > 0 ? s / cnt[i] : null);

    const labels = [];
    const isPkt = (new Date().getTimezoneOffset() === -300);
    for (let i = 0; i < nBars; i++) {
      const ts = startMs + i * interval * 1000;
      const d = isPkt ? new Date(ts) : new Date(ts + 18000000);
      const h = isPkt ? d.getHours() : d.getUTCHours();
      const hh = h % 12 || 12;
      labels.push(hh + (h >= 12 ? 'pm' : 'am'));
    }
    return { values, labels };
  }

  function _drawModalChart(canvas, values, labels, color) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const PL = 42, PR = 12, PT = 14, PB = 26;
    const cW = rect.width - PL - PR;
    const cH = rect.height - PT - PB;
    if (cW <= 0 || cH <= 0) return;

    const valid = values.filter(v => v != null && !isNaN(v));
    let minV, maxV;
    if (valid.length) {
      minV = Math.min.apply(null, valid);
      maxV = Math.max.apply(null, valid);
      if (minV === maxV) { minV -= 1; maxV += 1; }
    } else { minV = 0; maxV = 1; }
    const pad = (maxV - minV) * 0.1;
    minV -= pad; maxV += pad;
    const range = maxV - minV || 1;

    ctx.fillStyle = '#71717a';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const numGrid = 4;
    for (let i = 0; i <= numGrid; i++) {
      const v = minV + (i / numGrid) * range;
      const y = PT + cH - (i / numGrid) * cH;
      const lbl = Math.abs(range) >= 20 ? Math.round(v) : v.toFixed(1);
      ctx.fillText(lbl, PL - 5, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
    }

    const n = values.length;
    if (n < 2) return;
    const stepX = cW / (n - 1);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const v = values[i];
      if (v == null) continue;
      const x = PL + i * stepX;
      const y = PT + cH - ((v - minV) / range) * cH;
      pts.push([x, y]);
    }
    if (pts.length < 2) return;

    const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(pts[0][0], PT + cH);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.lineTo(pts[pts.length - 1][0], PT + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else         ctx.lineTo(p[0], p[1]);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';
    ctx.stroke();

    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '9px system-ui';
    const maxLabels = Math.max(4, Math.floor(cW / 55));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i += step) {
      const x = PL + i * stepX;
      ctx.fillText(labels[i] || '', x, rect.height - 8);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Open the modal
  // ─────────────────────────────────────────────────────────────────────
  async function openFlowDetail(boxKey) {
    const cfg = FLOW_DETAIL_CONFIG[boxKey];
    if (!cfg) return;

    _currentBoxKey = boxKey;
    const modal = _ensureModal();
    const panel   = modal.querySelector('.fd-panel');
    const titleEl = modal.querySelector('.fd-title');
    const chartWrap    = modal.querySelector('.fd-chart-wrap');
    const chartLoading = modal.querySelector('.fd-chart-loading');
    const canvas       = modal.querySelector('.fd-chart');
    const chartHeader  = modal.querySelector('.fd-chart-header');

    panel.style.setProperty('--fd-color', cfg.color);
    titleEl.textContent = cfg.title;
    _refreshModalBody(boxKey);

    if (cfg.graph && typeof _gFetch === 'function') {
      chartHeader.style.display = '';
      chartWrap.style.display   = 'flex';
      chartLoading.style.display = 'block';
      chartLoading.textContent   = 'Loading chart\u2026';
      const c = canvas.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      chartHeader.style.display = 'none';
      chartWrap.style.display   = 'none';
    }

    modal.classList.add('open');

    if (cfg.graph) {
      try {
        await new Promise(r => setTimeout(r, 30));
        const data = await _fetch24hGraph(cfg.graph);
        if (data && data.values.some(v => v != null)) {
          modal.__lastGraphData = data;
          _drawModalChart(canvas, data.values, data.labels, cfg.color);
          chartLoading.style.display = 'none';
        } else {
          chartLoading.textContent = 'No data for the last 24 hours.';
        }
      } catch (err) {
        console.warn('flow detail chart error', err);
        chartLoading.textContent = 'Chart unavailable.';
      }
    }

    // Redraw chart on resize
    if (modal.__resizeHandler) window.removeEventListener('resize', modal.__resizeHandler);
    modal.__resizeHandler = function () {
      if (!modal.classList.contains('open')) return;
      if (!cfg.graph) return;
      if (modal.__lastGraphData) {
        _drawModalChart(canvas, modal.__lastGraphData.values, modal.__lastGraphData.labels, cfg.color);
      }
    };
    window.addEventListener('resize', modal.__resizeHandler);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Attach click handlers by matching LAYOUT (x, y) to the rendered rects
  // ─────────────────────────────────────────────────────────────────────
  function _attachFlowClickHandlers() {
    const wrap = document.getElementById('flow-svg-wrap');
    if (!wrap || typeof LAYOUT === 'undefined') return;
    const svg = wrap.querySelector('svg');
    if (!svg) return;
    if (svg.__flowDetailAttached) return;
    svg.__flowDetailAttached = true;

    const rects = svg.querySelectorAll(':scope > rect');
    const byPos = new Map();
    rects.forEach(r => {
      const x = parseFloat(r.getAttribute('x'));
      const y = parseFloat(r.getAttribute('y'));
      if (!isNaN(x) && !isNaN(y)) byPos.set(x + ',' + y, r);
    });

    Object.keys(LAYOUT).forEach(key => {
      if (!FLOW_DETAIL_CONFIG[key]) return;
      const d = LAYOUT[key];
      const r = byPos.get(d.x + ',' + d.y);
      if (!r) return;
      r.setAttribute('data-flow-box', key);
      r.addEventListener('click', function (e) {
        e.stopPropagation();
        openFlowDetail(key);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Patch renderFlowDiagram so we re-attach & auto-refresh the modal
  // ─────────────────────────────────────────────────────────────────────
  function _patchFlowDiagram() {
    if (typeof window.renderFlowDiagram !== 'function') return false;
    if (window.renderFlowDiagram.__flowDetailPatched) return true;
    const orig = window.renderFlowDiagram;
    const wrapped = function () {
      const r = orig.apply(this, arguments);
      try {
        _attachFlowClickHandlers();
        if (_currentBoxKey) {
          const modal = document.getElementById('flow-detail-modal');
          if (modal && modal.classList.contains('open')) {
            _refreshModalBody(_currentBoxKey);
          }
        }
      } catch (e) { console.warn('flow detail post-render', e); }
      return r;
    };
    wrapped.__flowDetailPatched = true;
    window.renderFlowDiagram = wrapped;
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Boot
  // ─────────────────────────────────────────────────────────────────────
  function _init() {
    _patchFlowDiagram();
    setTimeout(_attachFlowClickHandlers, 120);
    const wrap = document.getElementById('flow-svg-wrap');
    if (wrap) {
      const obs = new MutationObserver(function () {
        try { _attachFlowClickHandlers(); } catch (e) {}
      });
      obs.observe(wrap, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  window.openFlowDetail  = openFlowDetail;
  window.closeFlowDetail = closeFlowDetail;
})();

// js/22-flow-detail.js  (v3.0)
// FLOW_EXTRAS_PATCH_V1
// FLOW_EXTRAS_PATCH_V2
// FLOW_EXTRAS_PATCH_V3
// Cycle-aligned night discharge (7am rollover), zoomable 24h charts,
// draggable/resizable modal. Text sizes/offsets come from FLOW_DETAIL_TEXT
// (edit in editor.html and paste back into js/22a-flow-detail-text.js).

(function () {
  'use strict';

  const FLOW_DETAIL_CONFIG = {
    weather: { title: 'Weather',         color: '#0ea5e9', graphs: [] },
    solar:   { title: 'Solar',           color: '#f59e0b', graphs: ['solar'] },
    grid:    { title: 'Grid',            color: '#ef4444', graphs: ['grid'] },
    battery: { title: 'Battery',         color: '#10b981', graphs: ['battery'] },
    haier:   { title: 'Haier 1Ton',      color: '#a5f3fc', graphs: ['haier'] },
    k15:     { title: 'Kenwood 1.5T',    color: '#38bdf8', graphs: ['k15'] },
    k1:      { title: 'Kenwood 1T',      color: '#7dd3fc', graphs: ['k1'] },
    pc:      { title: 'PC',              color: '#4ade80', graphs: ['pc'] },
    fridge:  { title: 'Fridges',         color: '#c084fc', graphs: ['fridge1', 'fridge2'] },
    water:   { title: 'Water Tank',      color: '#0ea5e9', graphs: ['water'] },
    motor:   { title: 'Water Motor',     color: '#fbbf24', graphs: ['motor'] },
    wm:      { title: 'Washing Machine', color: '#e879f9', graphs: ['wm'] },
    temp:    { title: 'Temperature',     color: '#22c55e', graphs: ['temp'] },
    temp2:   { title: 'Temperature 2',   color: '#22c55e', graphs: ['temp2'] }
  };

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 20;
  const PREFS_KEY = 'flowDetailModalPrefs';

  let _currentBoxKey = null;
  let _batNightCache = { ts: 0, T: 0, Y: 0 };

  function _textOv(boxKey, idx) {
    // FLOW_DETAIL_TEXT is declared with `const` in 22a-flow-detail-text.js,
    // so it's a top-level lexical binding — NOT a property on window.
    // `typeof` on an undeclared identifier is safe (doesn't throw).
    let T = null;
    if (typeof FLOW_DETAIL_TEXT !== 'undefined') T = FLOW_DETAIL_TEXT;
    else if (typeof window !== 'undefined' && window.FLOW_DETAIL_TEXT) T = window.FLOW_DETAIL_TEXT;
    if (!T || !T[boxKey]) return {};
    return T[boxKey][idx] || {};
  }

  // ─── CSS ─────────────────────────────────────────────────────────────
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
        display: none; opacity: 0; transition: opacity .18s ease; pointer-events: none;
      }
      #flow-detail-modal.open {
        display: flex; align-items: flex-start; justify-content: center;
        opacity: 1; pointer-events: auto;
      }
      #flow-detail-modal .fd-backdrop {
        position: absolute; inset: 0; background: rgba(0,0,0,.75);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      }
      #flow-detail-modal .fd-panel {
        position: relative; width: 100%; max-width: 680px;
        margin: 40px auto; max-height: calc(100vh - 80px);
        background: var(--bg-base); border: 1px solid var(--border);
        border-radius: 14px; overflow: hidden;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,.75);
        transform: translateY(10px) scale(.98); transition: transform .2s ease;
      }
      #flow-detail-modal.open .fd-panel { transform: translateY(0) scale(1); }
      #flow-detail-modal .fd-panel.fd-floating {
        position: fixed; margin: 0; max-width: none; max-height: none;
      }
      @media (max-width: 640px) {
        #flow-detail-modal .fd-panel,
        #flow-detail-modal .fd-panel.fd-floating {
          position: relative !important;
          margin: 0 !important;
          left: 0 !important; top: 0 !important;
          width: 100% !important; height: auto !important;
          max-height: 100vh !important;
          border-radius: 0 !important; border: none !important;
        }
        #flow-detail-modal .fd-resize { display: none !important; }
        #flow-detail-modal .fd-reset-pos { display: none !important; }
      }
      #flow-detail-modal .fd-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; flex-shrink: 0;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
        border-top: 3px solid var(--fd-color, var(--accent-solar));
        cursor: grab; user-select: none; -webkit-user-select: none;
      }
      #flow-detail-modal .fd-header.grabbing { cursor: grabbing; }
      #flow-detail-modal .fd-header-actions {
        display: flex; gap: 6px; align-items: center;
      }
      #flow-detail-modal .fd-title {
        font-size: 16px; font-weight: 800; color: var(--text-main);
        letter-spacing: .02em;
      }
      #flow-detail-modal .fd-btn {
        background: var(--bg-card); border: 1px solid var(--border);
        color: var(--text-main); border-radius: 8px;
        padding: 4px 10px; font-size: 14px; font-weight: 700; cursor: pointer;
      }
      #flow-detail-modal .fd-btn:hover { background: var(--bg-base); }
      #flow-detail-modal .fd-body {
        flex: 1; overflow-y: auto; padding: 14px; padding-bottom: 34px;
        display: flex; flex-direction: column; gap: 12px;
      }
      
      #flow-detail-modal .fd-battery-grid {
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; width: 100%; box-sizing: border-box;
      }
      #flow-detail-modal .fd-bat-card {
        background: rgba(255,255,255,0.03); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px 6px; display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start; text-align: center; gap: 3px;
        font-variant-numeric: tabular-nums; box-sizing: border-box; min-height: 125px;
      }
      #flow-detail-modal .fd-bat-card.fd-bat-hero {
        background: rgba(16,185,129,0.05); border-color: rgba(16,185,129,0.35); justify-content: center;
      }
      #flow-detail-modal .fd-bat-header {
        font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 2px;
      }
      #flow-detail-modal .fd-bat-soc {
        font-size: 38px; font-weight: 900; line-height: 1; margin: 2px 0;
      }
      #flow-detail-modal .fd-bat-volt {
        font-size: 17px; font-weight: 800; color: #35c0b7;
      }
      #flow-detail-modal .fd-bat-time {
        font-size: 11px; font-weight: 700; color: #a1a1aa;
      }
      #flow-detail-modal .fd-bat-val { font-size: 13px; font-weight: 800; }
      #flow-detail-modal .fd-bat-sub { font-size: 10.5px; font-weight: 700; line-height: 1.25; }
      #flow-detail-modal .fd-bat-stat { font-size: 10.5px; font-weight: 600; line-height: 1.25; }
      #flow-detail-modal .fd-bat-divider { width: 100%; height: 1px; background: var(--border); margin: 3px 0; opacity: .7; }
      #flow-detail-modal .fd-lines {
        display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start;
        gap: 6px; padding: 16px 16px; overflow: visible;
        background:
          radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,.035), transparent 70%),
          var(--bg-panel);
        border: 1px solid var(--border); border-radius: 12px;
        text-align: center; font-variant-numeric: tabular-nums; min-height: 160px;
      
        margin-bottom: 6px;}
      #flow-detail-modal .fd-lines.is-loading { animation: fd-pulse 1.2s ease-in-out infinite; }
      @keyframes fd-pulse { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
      #flow-detail-modal .fd-line { line-height: 1.15; word-break: break-word; }
      #flow-detail-modal .fd-line.multiline > span { display: block; }
      #flow-detail-modal .fd-empty {
        text-align: center; color: var(--text-muted);
        padding: 22px; font-size: 13px; font-weight: 600;
      }
      #flow-detail-modal .fd-charts { display: flex; flex-direction: column; gap: 14px; }
      #flow-detail-modal .fd-chart-section { display: flex; flex-direction: column; gap: 6px; }
      /* FLOW_EXTRAS_PATCH_V1 */
      #flow-detail-modal .fd-extras {
        margin-top: 4px;
        display: flex; flex-direction: column; gap: 4px;
        background: var(--bg-panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px 12px;
      }
      #flow-detail-modal .fd-extras-header {
        font-size: 11px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .07em; color: var(--text-muted);
        margin-bottom: 4px;
      }
      #flow-detail-modal .fd-chart-header {
        font-size: 11px; font-weight: 800;
        text-transform: uppercase; letter-spacing: .07em;
        color: var(--text-muted);
        display: flex; align-items: center; justify-content: space-between;
      }
      #flow-detail-modal .fd-chart-title { display: flex; align-items: center; gap: 4px; }
      #flow-detail-modal .fd-chart-header .fd-chart-dot {
        display: inline-block; width: 8px; height: 8px; border-radius: 50%;
        margin-right: 6px; vertical-align: middle;
      }
      #flow-detail-modal .fd-chart-reset {
        background: var(--bg-card); border: 1px solid var(--border);
        color: var(--text-muted); border-radius: 6px;
        padding: 2px 8px; font-size: 10px; font-weight: 700;
        cursor: pointer; display: none; text-transform: none; letter-spacing: 0;
      }
      #flow-detail-modal .fd-chart-reset.visible { display: inline-block; }
      #flow-detail-modal .fd-chart-reset:hover { color: var(--text-main); }
      #flow-detail-modal .fd-chart-hint {
        font-size: 10px; color: var(--text-muted);
        font-weight: 500; letter-spacing: 0; text-transform: none;
      }
      #flow-detail-modal .fd-chart-wrap {
        position: relative; background: var(--bg-panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px; height: 240px;
        display: flex; align-items: center; justify-content: center;
      }
      #flow-detail-modal canvas.fd-chart {
        width: 100%; height: 100%; display: block;
        cursor: grab; touch-action: none;
      }
      #flow-detail-modal canvas.fd-chart.grabbing { cursor: grabbing; }
      #flow-detail-modal .fd-chart-loading {
        position: absolute; font-size: 12px; color: var(--text-muted); font-weight: 600;
        background: var(--bg-panel); padding: 4px 10px; border-radius: 6px;
      }
      #flow-detail-modal .fd-resize {
        position: absolute; right: 0; bottom: 0;
        width: 20px; height: 20px;
        cursor: nwse-resize; z-index: 20;
        background:
          linear-gradient(135deg,
            transparent 0 45%,
            var(--text-muted) 45% 50%,
            transparent 50% 60%,
            var(--text-muted) 60% 65%,
            transparent 65% 100%);
        border-bottom-right-radius: 14px;
        opacity: .55;
      }
      #flow-detail-modal .fd-resize:hover { opacity: 1; }
    `;
    document.head.appendChild(s);
  }

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
    modal.querySelector('.fd-backdrop').addEventListener('click', closeFlowDetail);
    modal.querySelector('.fd-close').addEventListener('click', closeFlowDetail);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeFlowDetail();
    });
    _attachModalDragResize(modal);
    return modal;
  }

  function closeFlowDetail() {
    const modal = document.getElementById('flow-detail-modal');
    if (modal) modal.classList.remove('open');
    _currentBoxKey = null;
  }

  // ─── Modal drag / resize / persistence ─────────────────────────────
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
      try { localStorage.removeItem(PREFS_KEY); } catch (e) {}
      return;
    }
    const r = panel.getBoundingClientRect();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
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
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) _applyPrefs(panel, JSON.parse(raw));
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
      _savePrefs(panel);
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
      _savePrefs(panel);
      if (modal.__resizeHandler) setTimeout(modal.__resizeHandler, 40);
    });

    reset.addEventListener('click', function (e) {
      e.stopPropagation();
      _clearPrefs(panel);
      try { localStorage.removeItem(PREFS_KEY); } catch (e2) {}
      if (modal.__resizeHandler) setTimeout(modal.__resizeHandler, 40);
    });
  }

  // ─── SVG text extraction ────────────────────────────────────────────
  function _svgTextContent(el) {
    const tspans = Array.from(el.querySelectorAll('tspan'));
    if (tspans.length === 0) return (el.textContent || '').trim();
    const hasBreak = tspans.some(function (ts) {
      const dy = parseFloat(ts.getAttribute('dy'));
      return !isNaN(dy) && dy > 0;
    });
    if (!hasBreak) return (el.textContent || '').trim();
    return tspans.map(function (ts) { return (ts.textContent || '').trim(); })
                 .filter(Boolean).join('\n');
  }
  function _extractBoxLines(boxKey) {
    const wrap = document.getElementById('flow-svg-wrap');
    if (!wrap || typeof LAYOUT === 'undefined') return [];
    const svg = wrap.querySelector('svg');
    const d = LAYOUT[boxKey];
    if (!svg || !d) return [];
    const x1 = d.x, y1 = d.y, x2 = d.x + d.w, y2 = d.y + d.h;
    const lines = [];
    svg.querySelectorAll(':scope > text').forEach(function (t) {
      const tx = parseFloat(t.getAttribute('x'));
      const ty = parseFloat(t.getAttribute('y'));
      if (isNaN(tx) || isNaN(ty)) return;
      if (tx < x1 || tx > x2 || ty < y1 || ty > y2) return;
      const text = _svgTextContent(t);
      if (!text) return;
      const fill = (t.getAttribute('fill') || '').trim();
      lines.push({ y: ty, text: text, fill: fill });
    });
    lines.sort(function (a, b) { return a.y - b.y; });
    return lines;
  }

  function _classifyLine(text, isFirst) {
    if (isFirst) return 'title';
    if (/^-?[\d.,]+\s*%$/.test(text))     return 'hero';
    if (/^-?[\d.,]+\s*[wW]$/.test(text))  return 'hero';
    if (/^-?[\d.,]+\s*kW$/i.test(text))   return 'hero';
    if (/^-?[\d.,]+\s*kWh$/i.test(text))  return 'hero';
    if (/^-?[\d.,]+\s*[vV]$/.test(text))  return 'hero';
    return 'normal';
  }
  function _escape(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function _lineHtml(line, idx, accentColor, boxKey) {
    const kind = _classifyLine(line.text, idx === 0);
    const color = (line.fill && line.fill !== 'none') ? line.fill : accentColor;
    let size, weight;
    if (kind === 'hero')       { size = 40; weight = 800; }
    else if (kind === 'title') { size = 22; weight = 800; }
    else                       { size = 17; weight = 700; }

    const ov = _textOv(boxKey, idx);
    if (typeof ov.fs === 'number' && ov.fs > 0) size = ov.fs;
    // FLOW_EXTRAS_PATCH_V3: scale dy for the modal's own spacing (see note
    // in _refreshModalBody) instead of using the SVG's raw pixel offset.
    const dy = (typeof ov.dy === 'number') ? ov.dy * 0.35 : 0;

    const multiline = line.text.indexOf('\n') !== -1;
    const inner = multiline
      ? line.text.split('\n').map(function (p) { return '<span>' + _escape(p) + '</span>'; }).join('')
      : _escape(line.text);

    const style = 'color:' + color + '; font-size:' + size + 'px; font-weight:' + weight + ';' +
                  (dy ? 'transform: translateY(' + dy + 'px);' : '');
    const cls = 'fd-line' + (multiline ? ' multiline' : '');
    return '<div class="' + cls + '" style="' + style + '">' + inner + '</div>';
  }

      function _renderBattery3Boxes(container, lines) {
    container.style.paddingTop = '10px';
    container.style.paddingBottom = '10px';

    // Helper to apply font size and vertical drag offset (dy) from editor.html / FLOW_DETAIL_TEXT
    function _batStyle(idx, defFs, extraCss) {
      const ov = _textOv('battery', idx);
      const fs = (typeof ov.fs === 'number' && ov.fs > 0) ? ov.fs : defFs;
      const dy = (typeof ov.dy === 'number') ? ov.dy : 0;
      let s = '';
      if (fs) s += 'font-size:' + fs + 'px;';
      if (dy) s += 'transform:translateY(' + dy + 'px);';
      if (extraCss) s += extraCss;
      return s;
    }

    let soc = '---', volt = '---', time = '--:--', action = 'Standby', watts = '';
    let rate = '', cutoff = '', chgM = '', chgTY = '', dischM = '', dischTY = '';

    lines.forEach(function (l) {
      const t = l.text.trim();
      if (/^\d+(\.\d+)?%$/.test(t)) soc = t;
      else if (/^\d+(\.\d+)?V$/i.test(t)) volt = t;
      else if (/\d+:\d+\s*(AM|PM)/i.test(t)) time = t;
      else if (/Charging|Discharging|Standby/i.test(t)) action = t;
      else if (/[+-]\d+\s*w/i.test(t)) watts = t;
      else if (/%(\/hr|\/min)/i.test(t)) rate = t;
      else if (/left|to \d+%/i.test(t)) cutoff = t;
      else if (/Chg:\s*M:/i.test(t)) chgM = t.replace(/Chg:\s*/i, '');
      else if (/Disch:\s*M:/i.test(t)) dischM = t.replace(/Disch:\s*/i, '');
      else if (/T:.*Y:/i.test(t)) {
        if (!chgTY && !dischM) chgTY = t;
        else dischTY = t;
      }
    });

    const mU = window.monthlyUnits || {};
    const fmt = function (wh) {
      if (wh == null || isNaN(wh) || wh <= 0) return '0 w';
      return wh >= 500 ? (wh / 1000).toFixed(1) + ' kwh' : Math.round(wh) + ' w';
    };
    if (!chgM && mU.batChgM) chgM = 'M: ' + fmt(mU.batChgM);
    if (!chgTY && (mU.batChgT || mU.batChgY)) chgTY = 'T: ' + fmt(mU.batChgT) + ' Y: ' + fmt(mU.batChgY);
    if (!dischM && mU.batDisM) dischM = 'M: ' + fmt(mU.batDisM);
    if (!dischTY && (mU.batDisT || mU.batDisY)) dischTY = 'T: ' + fmt(mU.batDisT) + ' Y: ' + fmt(mU.batDisY);

    const socNum = parseFloat(soc);
    const socColor = (!isNaN(socNum) && socNum <= 20) ? '#ef4444' : ((!isNaN(socNum) && socNum <= 50) ? '#facc15' : '#25f447');
    const isCharging = action.includes('Charging');

    let html = '<div class="fd-battery-grid">';

    // ── Box 1: Charge Info (Left) ──
    html += '<div class="fd-bat-card">';
    html += '<div class="fd-bat-header" style="color:#10b981;">⚡ CHARGE</div>';
    html += '<div class="fd-bat-val" style="' + _batStyle(5, 13, 'color:#4ade80;') + '">' + (watts.startsWith('+') ? watts : (isCharging ? watts : '--')) + '</div>';
    html += '<div class="fd-bat-sub" style="' + _batStyle(4, 10.5, 'color:' + (isCharging ? '#25f447' : '#a1a1aa') + ';') + '">' + action + '</div>';
    if (rate) html += '<div class="fd-bat-sub" style="' + _batStyle(6, 10.5, 'color:#4ade80;') + '">' + rate + '</div>';
    if (cutoff) html += '<div class="fd-bat-sub" style="' + _batStyle(7, 10.5, 'color:#facc15;') + '">' + cutoff + '</div>';
    html += '<div class="fd-bat-divider"></div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(9, 10.5, 'color:#10b981;') + '">' + (chgTY || 'T: 0w Y: 0w') + '</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(8, 10.5, 'color:#10b981;') + '">' + (chgM || 'M: 0w') + '</div>';
    html += '</div>';

    // ── Box 2: Hero SOC (Center) ──
    // idx 0 = Battery Title, idx 1 = SOC %, idx 2 = Voltage, idx 3 = Time
    html += '<div class="fd-bat-card fd-bat-hero">';
    html += '<div class="fd-bat-header" style="' + _batStyle(0, 11, 'color:#10b981;') + '">Battery</div>';
    html += '<div class="fd-bat-soc" style="' + _batStyle(1, 38, 'color:' + socColor + ';') + '">' + soc + '</div>';
    html += '<div class="fd-bat-volt" style="' + _batStyle(2, 17, 'color:#35c0b7;') + '">' + volt + '</div>';
    html += '<div class="fd-bat-time" style="' + _batStyle(3, 11, 'color:#a1a1aa;') + '">' + time + '</div>';
    html += '</div>';

    // ── Box 3: Discharge & Night (Right) ──
    html += '<div class="fd-bat-card">';
    html += '<div class="fd-bat-header" style="color:#f97316;">⚡ DISCHARGE</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(11, 10.5, 'color:#f97316;font-weight:700;') + '">' + (dischTY || 'T: 0w Y: 0w') + '</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(10, 10.5, 'color:#f97316;') + '">' + (dischM || 'M: 0w') + '</div>';
    html += '<div class="fd-bat-divider"></div>';
    html += '<div class="fd-battery-night" style="' + _batStyle('night', 10, 'color:#c084fc;font-weight:700;') + '">Loading night disch&hellip;</div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    const nightEl = container.querySelector('.fd-battery-night');
    if (nightEl) _populateBatteryNight(nightEl);
  }
  function _refreshModalBody(boxKey) {
    const cfg = FLOW_DETAIL_CONFIG[boxKey];
    if (!cfg) return;
    const modal = document.getElementById('flow-detail-modal');
    if (!modal) return;
    const container = modal.querySelector('.fd-lines');
    if (!container) return;
    const lines = _extractBoxLines(boxKey);
    if (!lines.length) {
      container.classList.add('is-loading');
      container.innerHTML = '<div class="fd-empty">Waiting for live data&hellip;</div>';
      return;
    }
    container.classList.remove('is-loading');

    if (boxKey === 'battery') {
      _renderBattery3Boxes(container, lines);
      return;
    }

    const MODAL_DY_SCALE = 0.35;
    let minDy = 0;
    lines.forEach(function (_, i) {
      const ov = _textOv(boxKey, i);
      if (typeof ov.dy === 'number' && ov.dy < minDy) minDy = ov.dy;
    });
    const extraTop = Math.max(0, -minDy * MODAL_DY_SCALE);
    container.style.paddingTop = (22 + extraTop + 24) + 'px';
    container.__fdDyScale = MODAL_DY_SCALE;

    container.innerHTML = lines.map(function (l, i) {
      return _lineHtml(l, i, cfg.color, boxKey);
    }).join('');
  }


  // ─── Battery night discharge (cycle-aligned to 7am) ─────────────────
  function _pktMs(y, m, d, h) { return Date.UTC(y, m, d, h - 5, 0, 0); }
  function _currentNightCycles() {
    const isPkt = (new Date().getTimezoneOffset() === -300);
    const nowMs = Date.now();
    let pktY, pktM, pktD, pktH;
    if (isPkt) {
      const d = new Date(nowMs);
      pktY = d.getFullYear(); pktM = d.getMonth(); pktD = d.getDate(); pktH = d.getHours();
    } else {
      const d = new Date(nowMs + 18000000);
      pktY = d.getUTCFullYear(); pktM = d.getUTCMonth();
      pktD = d.getUTCDate();     pktH = d.getUTCHours();
    }
    const anchor = (pktH >= 7) ? pktD : (pktD - 1);
    const cycStart   = _pktMs(pktY, pktM, anchor, 7);
    const cycEnd     = _pktMs(pktY, pktM, anchor + 1, 7);
    const nightStart = _pktMs(pktY, pktM, anchor, 16);
    const nightEnd   = cycEnd;
    const prevNightStart = _pktMs(pktY, pktM, anchor - 1, 16);
    const prevNightEnd   = cycStart;
    return {
      curStart: nightStart, curEnd: nightEnd,
      prevStart: prevNightStart, prevEnd: prevNightEnd,
      cycleStart: cycStart, cycleEnd: cycEnd
    };
  }
  async function _fetchBatteryNightDischarge() {
    if (Date.now() - _batNightCache.ts < 5 * 60 * 1000 && _batNightCache.ts > 0) return _batNightCache;
    if (typeof _gFetch !== 'function') return _batNightCache;
    const cyc = _currentNightCycles();
    try {
      const results = await Promise.all([
        _gFetch('546025', cyc.prevStart - 600000, Date.now(), 600),
        _gFetch('546013', cyc.prevStart - 600000, Date.now(), 600),
        _gFetch('546019', cyc.prevStart - 600000, Date.now(), 600)
      ]);
      const ampPts = results[0] || [], voltPts = results[1] || [], socPts = results[2] || [];
      const vMap = new Map();
      voltPts.forEach(function (p) {
        if (p && p[0] != null && p[1] != null && p[1] > 35) vMap.set(p[0], p[1]);
      });
      const factor = 600 / 3600;
      let tWh = 0, yWh = 0;
      ampPts.forEach(function (p) {
        if (!p || p[0] == null || p[1] == null) return;
        const tsMs = p[0] < 2e9 ? p[0] * 1000 : p[0];
        const v = vMap.get(p[0]) || 52.8;
        const wh = Math.max(0, p[1]) * v * factor;
        if (tsMs >= cyc.curStart && tsMs < cyc.curEnd)  tWh += wh;
        else if (tsMs >= cyc.prevStart && tsMs < cyc.prevEnd) yWh += wh;
      });

      // True Battery Chemical Drain via BMS ΔSOC
      const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
      const getSocDeltaWh = function(start, end) {
        const pts = socPts.filter(p => {
          const t = p[0] < 2e9 ? p[0] * 1000 : p[0];
          return t >= start && t <= end && p[1] != null && p[1] > 10;
        });
        if (pts.length < 2) return 0;
        const maxSoc = Math.max(...pts.map(p => p[1]));
        const minSoc = Math.min(...pts.map(p => p[1]));
        const drop = Math.max(0, maxSoc - minSoc);
        return (drop / 100) * packKwh * 1000;
      };

      const tSocWh = getSocDeltaWh(cyc.curStart, cyc.curEnd);
      const ySocWh = getSocDeltaWh(cyc.prevStart, cyc.prevEnd);

      _batNightCache = {
        ts: Date.now(),
        T: Math.max(tWh, tSocWh),
        Y: Math.max(yWh, ySocWh)
      };
      return _batNightCache;
    } catch (e) {
      console.warn('[flow-detail] night discharge fetch error', e);
      return _batNightCache;
    }
  }
  async function _populateBatteryNight(el) {
    if (!el) return;
    if (_batNightCache.ts === 0) {
      el.innerHTML = '<span style="color:var(--text-muted); font-size:13px; font-weight:500;">Loading night discharge&hellip;</span>';
    } else {
      _renderBatteryNight(el, _batNightCache);
    }
    const data = await _fetchBatteryNightDischarge();
    if (!el || !el.parentNode) return;
    if (data && data.ts) _renderBatteryNight(el, data);
    else el.innerHTML = '<span style="color:var(--text-muted); font-size:13px; font-weight:500;">Night discharge unavailable</span>';
  }
  function _fmtPktShort(ms) {
    const isPkt = (new Date().getTimezoneOffset() === -300);
    const d = isPkt ? new Date(ms) : new Date(ms + 18000000);
    const M = isPkt ? d.getMonth() + 1 : d.getUTCMonth() + 1;
    const D = isPkt ? d.getDate() : d.getUTCDate();
    const h = isPkt ? d.getHours() : d.getUTCHours();
    return M + '/' + D + ' ' + String(h).padStart(2, '0') + ':00';
  }
    function _renderBatteryNight(el, data) {
    const fmt = function (wh) {
      if (wh == null || isNaN(wh) || wh <= 0) return '0 w';
      return wh >= 500 ? (wh / 1000).toFixed(1) + ' kwh' : Math.round(wh) + ' w';
    };
    const cyc = _currentNightCycles();
    const label = _fmtPktShort(cyc.curStart) + ' \u2192 ' + _fmtPktShort(cyc.curEnd);
    el.innerHTML =
      '<div style="color:#c084fc; font-weight:800; font-size:11px; margin-bottom:2px;">🌙 Night Disch</div>' +
      '<div style="color:#c084fc; font-weight:700; font-size:11px;">T: ' + fmt(data.T) + ' &nbsp;Y: ' + fmt(data.Y) + '</div>' +
      '<div style="font-size:9.5px; color:var(--text-muted); font-weight:600; margin-top:2px;">' + label + '</div>';
  }


  // ─── 24h graph fetch ────────────────────────────────────────────────
  async function _fetch24hGraph(graphKey) {
    if (typeof _gFetch !== 'function' || typeof GRAPH_FEEDS === 'undefined') return null;
    const feed = GRAPH_FEEDS.find(function (f) { return f.key === graphKey; });
    if (!feed) return null;
    const now = Date.now(), startMs = now - 24 * 3600 * 1000;
    const intervals = [300, 900, 1800, 3600];
    let pts = [];
    for (let i = 0; i < intervals.length; i++) {
      const iv = intervals[i];
      try {
        const raw = await _gFetch(feed.id, startMs, now, iv);
        if (raw && raw.length) { pts = raw; break; }
      } catch (e) {}
    }
    if (!pts.length) return null;
    const bucket = 600;
    const nBars = Math.round((24 * 3600) / bucket);
    const sum = new Array(nBars).fill(0), cnt = new Array(nBars).fill(0);
    pts.forEach(function (p) {
      if (!p || p[1] == null) return;
      const tsMs = p[0] < 2e9 ? p[0] * 1000 : p[0];
      const idx = Math.floor((tsMs - startMs) / (bucket * 1000));
      if (idx < 0 || idx >= nBars) return;
      sum[idx] += p[1]; cnt[idx]++;
    });
    const values = sum.map(function (s, i) { return cnt[i] > 0 ? s / cnt[i] : null; });
    const labels = [];
    const isPkt = (new Date().getTimezoneOffset() === -300);
    for (let i = 0; i < nBars; i++) {
      const ts = startMs + i * bucket * 1000;
      const d = isPkt ? new Date(ts) : new Date(ts + 18000000);
      const h = isPkt ? d.getHours() : d.getUTCHours();
      const hh = h % 12 || 12;
      labels.push(hh + (h >= 12 ? 'pm' : 'am'));
    }
    return { values: values, labels: labels };
  }

  // ─── Chart drawing (zoom/pan aware) ─────────────────────────────────
  function _computeWindow(n, zoom, panX, cW) {
    if (n <= 0) return { startIdx: 0, visibleN: 0 };
    const visibleN = Math.max(2, n / zoom);
    let startIdx = (n - visibleN) / 2 - (panX / cW) * visibleN;
    const maxStart = Math.max(0, n - visibleN);
    if (startIdx < 0) startIdx = 0;
    if (startIdx > maxStart) startIdx = maxStart;
    return { startIdx: startIdx, visibleN: visibleN };
  }
  function _panXFromStartIdx(n, zoom, startIdx, cW) {
    const visibleN = Math.max(2, n / zoom);
    const maxStart = Math.max(0, n - visibleN);
    if (startIdx < 0) startIdx = 0;
    if (startIdx > maxStart) startIdx = maxStart;
    return ((n - visibleN) / 2 - startIdx) * cW / visibleN;
  }
  function _drawModalChart(canvas, values, labels, color, zoom, panX) {
    zoom = zoom || 1; panX = panX || 0;
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
    const n = values.length;
    if (n < 2) return;
    const win = _computeWindow(n, zoom, panX, cW);
    const startIdx = win.startIdx, visibleN = win.visibleN;
    const i0 = Math.max(0, Math.floor(startIdx));
    const i1 = Math.min(n - 1, Math.ceil(startIdx + visibleN));
    let minV = Infinity, maxV = -Infinity;
    for (let i = i0; i <= i1; i++) {
      const v = values[i];
      if (v == null || isNaN(v)) continue;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    if (!isFinite(minV) || !isFinite(maxV)) { minV = 0; maxV = 1; }
    if (minV === maxV) { minV -= 1; maxV += 1; }
    const pad = (maxV - minV) * 0.1;
    minV -= pad; maxV += pad;
    const range = maxV - minV || 1;
    function mapX(i) { return PL + ((i - startIdx) / visibleN) * cW; }
    ctx.fillStyle = '#71717a'; ctx.font = '10px system-ui';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const numGrid = 4;
    for (let g = 0; g <= numGrid; g++) {
      const v = minV + (g / numGrid) * range;
      const y = PT + cH - (g / numGrid) * cH;
      const lbl = Math.abs(range) >= 20 ? Math.round(v) : v.toFixed(1);
      ctx.fillText(lbl, PL - 5, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
    }
    const pts = [];
    for (let i = i0; i <= i1; i++) {
      const v = values[i];
      if (v == null || isNaN(v)) continue;
      pts.push([mapX(i), PT + cH - ((v - minV) / range) * cH]);
    }
    if (pts.length < 2) return;
    const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
    grad.addColorStop(0, color + '55'); grad.addColorStop(1, color + '00');
    ctx.beginPath();
    ctx.moveTo(pts[0][0], PT + cH);
    pts.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.lineTo(pts[pts.length - 1][0], PT + cH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath();
    pts.forEach(function (p, idx) {
      if (idx === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
    ctx.fillStyle = '#71717a'; ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic'; ctx.font = '9px system-ui';
    const maxLabels = Math.max(4, Math.floor(cW / 55));
    const step = Math.max(1, Math.ceil(visibleN / maxLabels));
    const firstTick = Math.ceil(startIdx / step) * step;
    for (let i = firstTick; i < startIdx + visibleN; i += step) {
      if (i < 0 || i >= n) continue;
      const x = mapX(i);
      if (x < PL - 10 || x > PL + cW + 10) continue;
      ctx.fillText(labels[i] || '', x, rect.height - 8);
    }
    if (zoom > 1.01) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(zoom.toFixed(1) + '\u00D7', PL + 6, PT + 4);
    }
  }
  function _attachChartZoom(seg) {
    const canvas = seg.canvas;
    function updateResetBtn() {
      if (!seg.resetBtn) return;
      if (seg.zoom > 1.01 || Math.abs(seg.panX) > 1) seg.resetBtn.classList.add('visible');
      else seg.resetBtn.classList.remove('visible');
    }
    function redraw() {
      if (!seg.lastData) return;
      _drawModalChart(seg.canvas, seg.lastData.values, seg.lastData.labels,
                      seg.color, seg.zoom, seg.panX);
      updateResetBtn();
    }
    seg.redraw = redraw;
    function reset() { seg.zoom = 1; seg.panX = 0; redraw(); }
    seg.reset = reset;
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (!seg.lastData) return;
      const rect = canvas.getBoundingClientRect();
      const PL = 42, PR = 12;
      const cW = rect.width - PL - PR;
      if (cW <= 0) return;
      const mx = e.clientX - rect.left;
      const frac = Math.max(0, Math.min(1, (mx - PL) / cW));
      const n = seg.lastData.values.length;
      const win0 = _computeWindow(n, seg.zoom, seg.panX, cW);
      const anchorIdx = win0.startIdx + frac * win0.visibleN;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      let nz = seg.zoom * factor;
      nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz));
      seg.zoom = nz;
      const visibleN = Math.max(2, n / nz);
      seg.panX = _panXFromStartIdx(n, nz, anchorIdx - frac * visibleN, cW);
      redraw();
    }, { passive: false });
    let mDown = false, sx = 0, sp = 0;
    canvas.addEventListener('mousedown', function (e) {
      mDown = true; sx = e.clientX; sp = seg.panX;
      canvas.classList.add('grabbing'); e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!mDown) return;
      seg.panX = sp + (e.clientX - sx);
      redraw();
    });
    window.addEventListener('mouseup', function () {
      if (!mDown) return;
      mDown = false; canvas.classList.remove('grabbing');
    });
    let tMode = null, tX0 = 0, tPan0 = 0;
    let tDist0 = 0, tZoom0 = 1, tAnchorFrac = 0, tAnchorIdx = 0;
    function pinchInfo(e) {
      const rect = canvas.getBoundingClientRect();
      const PL = 42, PR = 12, cW = rect.width - PL - PR;
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const frac = Math.max(0, Math.min(1, (cx - PL) / cW));
      return { dist: dist, frac: frac, cW: cW };
    }
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = seg.panX;
      } else if (e.touches.length === 2 && seg.lastData) {
        tMode = 'pinch';
        const info = pinchInfo(e);
        const n = seg.lastData.values.length;
        const win = _computeWindow(n, seg.zoom, seg.panX, info.cW);
        tDist0 = info.dist; tZoom0 = seg.zoom;
        tAnchorFrac = info.frac;
        tAnchorIdx = win.startIdx + info.frac * win.visibleN;
        e.preventDefault();
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      if (tMode === 'pan' && e.touches.length === 1) {
        seg.panX = tPan0 + (e.touches[0].clientX - tX0);
        redraw(); e.preventDefault();
      } else if (tMode === 'pinch' && e.touches.length === 2 && seg.lastData) {
        const info = pinchInfo(e);
        if (tDist0 <= 0) return;
        let nz = tZoom0 * (info.dist / tDist0);
        nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz));
        seg.zoom = nz;
        const n = seg.lastData.values.length;
        const visibleN = Math.max(2, n / nz);
        seg.panX = _panXFromStartIdx(n, nz, tAnchorIdx - tAnchorFrac * visibleN, info.cW);
        redraw(); e.preventDefault();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) tMode = null;
      else if (e.touches.length === 1) {
        tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = seg.panX;
      }
    });
    canvas.addEventListener('dblclick', function (e) { e.preventDefault(); reset(); });
    let lastTap = 0;
    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length !== 0) return;
      const now = Date.now();
      if (now - lastTap < 300) { reset(); lastTap = 0; } else { lastTap = now; }
    });
    canvas.style.cursor = 'grab';
  }
  function _buildChartSection(container, graphKey, fallbackColor, showLabel) {
    const feed = (typeof GRAPH_FEEDS !== 'undefined')
      ? GRAPH_FEEDS.find(function (f) { return f.key === graphKey; })
      : null;
    const color = feed ? feed.color : fallbackColor;
    const label = feed ? feed.name : graphKey;
    const section = document.createElement('div');
    section.className = 'fd-chart-section';
    const headerHtml = showLabel
      ? '<div class="fd-chart-header"><span class="fd-chart-title"><span class="fd-chart-dot" style="background:' + color + '"></span>' + _escape(label) + ' \u2014 24h</span><span style="display:flex; align-items:center; gap:6px;"><span class="fd-chart-hint">scroll / pinch to zoom</span><button type="button" class="fd-chart-reset">Reset</button></span></div>'
      : '<div class="fd-chart-header"><span class="fd-chart-title">24-Hour Trend</span><span style="display:flex; align-items:center; gap:6px;"><span class="fd-chart-hint">scroll / pinch to zoom</span><button type="button" class="fd-chart-reset">Reset</button></span></div>';
    section.innerHTML = headerHtml +
      '<div class="fd-chart-wrap"><canvas class="fd-chart"></canvas><div class="fd-chart-loading">Loading chart\u2026</div></div>';
    container.appendChild(section);
    const seg = {
      key: graphKey, color: color,
      canvas: section.querySelector('.fd-chart'),
      loading: section.querySelector('.fd-chart-loading'),
      resetBtn: section.querySelector('.fd-chart-reset'),
      lastData: null, zoom: 1, panX: 0
    };
    _attachChartZoom(seg);
    seg.resetBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (seg.reset) seg.reset();
    });
    return seg;
  }
  async function _loadChartIntoSegment(seg) {
    try {
      const data = await _fetch24hGraph(seg.key);
      if (data && data.values.some(function (v) { return v != null; })) {
        seg.lastData = data;
        _drawModalChart(seg.canvas, data.values, data.labels, seg.color, seg.zoom, seg.panX);
        seg.loading.style.display = 'none';
      } else {
        seg.loading.textContent = 'No data for the last 24 hours.';
      }
    } catch (err) {
      console.warn('flow detail chart error for ' + seg.key, err);
      seg.loading.textContent = 'Chart unavailable.';
    }
  }
  async function openFlowDetail(boxKey) {
    const cfg = FLOW_DETAIL_CONFIG[boxKey];
    if (!cfg) return;
    _currentBoxKey = boxKey;
    const modal = _ensureModal();
    const panel    = modal.querySelector('.fd-panel');
    const titleEl  = modal.querySelector('.fd-title');
    const chartsEl = modal.querySelector('.fd-charts');
    panel.style.setProperty('--fd-color', cfg.color);
    titleEl.textContent = cfg.title;
    modal.classList.add('open');
    _refreshModalBody(boxKey);
    // FLOW_EXTRAS_PATCH_V1
    (function () {
      const extrasBody = modal.querySelector('.fd-extras .fd-extras-body');
      const extrasWrap = modal.querySelector('.fd-extras');
      if (typeof window.renderFlowExtras === 'function' && window.FLOW_EXTRAS_REGISTRY && window.FLOW_EXTRAS_REGISTRY[boxKey]) {
        if (extrasWrap) extrasWrap.style.display = '';
        window.renderFlowExtras(boxKey, extrasBody);
      } else if (extrasWrap) {
        extrasWrap.style.display = 'none';
      }
    })();
    chartsEl.innerHTML = '';

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

    const graphKeys = (cfg.graphs && cfg.graphs.length) ? cfg.graphs : [];
    if (!graphKeys.length || typeof _gFetch !== 'function') {
      chartsEl.style.display = 'none';
      return;
    }
    chartsEl.style.display = '';
    const showLabel = graphKeys.length > 1;
    const segments = graphKeys.map(function (gk) {
      return _buildChartSection(chartsEl, gk, cfg.color, showLabel);
    });
    await new Promise(function (r) { requestAnimationFrame(r); });
    await new Promise(function (r) { setTimeout(r, 20); });
    await Promise.all(segments.map(_loadChartIntoSegment));
    if (modal.__resizeHandler) window.removeEventListener('resize', modal.__resizeHandler);
    modal.__resizeHandler = function () {
      if (!modal.classList.contains('open')) return;
      segments.forEach(function (seg) { if (seg.redraw) seg.redraw(); });
    };
    window.addEventListener('resize', modal.__resizeHandler);
  }

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
          if (modal && modal.classList.contains('open')) _refreshModalBody(_currentBoxKey);
        }
      } catch (e) { console.warn('flow detail post-render', e); }
      return r;
    };
    wrapped.__flowDetailPatched = true;
    window.renderFlowDiagram = wrapped;
    return true;
  }
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

// js/22e-flow-detail-svg.js
// ─── Flow Detail: SVG text extraction + line rendering ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _svgTextContent(el) {
    const tspans = Array.from(el.querySelectorAll('tspan'));
    if (tspans.length === 0) return (el.textContent || '').trim();
    const hasBreak = tspans.some(function (ts) {
      const dy = parseFloat(ts.getAttribute('dy'));
      return !isNaN(dy) && dy > 0;
    });
    if (!hasBreak) return (el.textContent || '').trim();
    const parts = tspans.map(function (ts) { return (ts.textContent || '').trim(); })
                        .filter(Boolean);
    // If every part is a short word, treat the tspans as a single wrapped
    // label ("Water" / "Motor") rather than a real multi-line content block.
    const allShort = parts.every(function (p) { return p.length <= 14; });
    return allShort ? parts.join(' ') : parts.join('\n');
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
      const text = FD._svgTextContent(t);
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
    const kind = FD._classifyLine(line.text, idx === 0);
    const color = (line.fill && line.fill !== 'none') ? line.fill : accentColor;
    let size, weight;
    if (boxKey === 'solar') {
      if (idx === 0) { size = 24; weight = 800; }
      else if (idx === 1) { size = 18; weight = 700; }
      else if (idx === 2) { size = 14; weight = 600; }
      else { size = 16; weight = 700; }
    } else {
      if (kind === 'hero')       { size = 40; weight = 800; }
      else if (kind === 'title') { size = 22; weight = 800; }
      else                       { size = 17; weight = 700; }
    }

    const ov = FD._textOv(boxKey, idx);
    if (typeof ov.fs === 'number' && ov.fs > 0) size = ov.fs;
    // FLOW_EXTRAS_PATCH_V3: scale dy for the modal's own spacing (see note
    // in FD._refreshModalBody) instead of using the SVG's raw pixel offset.
    const dy = (typeof ov.dy === 'number') ? ov.dy * 0.35 : 0;

    const multiline = line.text.indexOf('\n') !== -1;
    const inner = multiline
      ? line.text.split('\n').map(function (p) { return '<span>' + FD._escape(p) + '</span>'; }).join('')
      : FD._escape(line.text);

    const style = 'color:' + color + '; font-size:' + size + 'px; font-weight:' + weight + ';' +
                  (dy ? 'transform: translateY(' + dy + 'px);' : '');
    const cls = 'fd-line' + (multiline ? ' multiline' : '');
    return '<div class="' + cls + '" style="' + style + '">' + inner + '</div>';
  }

  // ── Exports ──────────────────────────────────────────────
  FD._svgTextContent = _svgTextContent;
  FD._extractBoxLines = _extractBoxLines;
  FD._classifyLine = _classifyLine;
  FD._escape = _escape;
  FD._lineHtml = _lineHtml;
})();

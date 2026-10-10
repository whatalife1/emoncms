// js/22j-flow-detail-chart.js
// ─── Flow Detail: 24h chart fetch + draw + zoom ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  // ── Ad-hoc feed IDs for Battery 2 charts ────────────────
  FD._AD_HOC_FEED_IDS = {
    bat2power: '546365',
    bat2volt:  '546369'
  };

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
    const PL = 38, PR = 10, PT = 14, PB = 32;
    const cW = rect.width - PL - PR;
    const cH = rect.height - PT - PB;
    if (cW <= 0 || cH <= 0) return;
    const n = values.length;
    if (n < 2) return;
    const win = FD._computeWindow(n, zoom, panX, cW);
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
    const pad = (maxV - minV) * 0.05;
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
    ctx.fillStyle = '#a1a1aa'; ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'; ctx.font = '10px system-ui, -apple-system, sans-serif';
    const maxLabels = Math.max(4, Math.floor(cW / 50));
    const step = Math.max(1, Math.ceil(visibleN / maxLabels));
    const firstTick = Math.ceil(startIdx / step) * step;
    const labelY = PT + cH + 15;
    for (let i = firstTick; i < startIdx + visibleN; i += step) {
      if (i < 0 || i >= n) continue;
      const x = mapX(i);
      if (x < PL - 10 || x > PL + cW + 10) continue;
      ctx.fillText(labels[i] || '', x, labelY);
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
      FD._drawModalChart(seg.canvas, seg.lastData.values, seg.lastData.labels,
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
      const win0 = FD._computeWindow(n, seg.zoom, seg.panX, cW);
      const anchorIdx = win0.startIdx + frac * win0.visibleN;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      let nz = seg.zoom * factor;
      nz = Math.max(FD.ZOOM_MIN, Math.min(FD.ZOOM_MAX, nz));
      seg.zoom = nz;
      const visibleN = Math.max(2, n / nz);
      seg.panX = FD._panXFromStartIdx(n, nz, anchorIdx - frac * visibleN, cW);
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
        const win = FD._computeWindow(n, seg.zoom, seg.panX, info.cW);
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
        nz = Math.max(FD.ZOOM_MIN, Math.min(FD.ZOOM_MAX, nz));
        seg.zoom = nz;
        const n = seg.lastData.values.length;
        const visibleN = Math.max(2, n / nz);
        seg.panX = FD._panXFromStartIdx(n, nz, tAnchorIdx - tAnchorFrac * visibleN, info.cW);
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
    const adHocLabels = { bat2power: 'Battery 2 Power', bat2volt: 'Battery 2 Voltage' };
    const color = feed ? feed.color : fallbackColor;
    const label = feed ? feed.name : (adHocLabels[graphKey] || graphKey);
    const section = document.createElement('div');
    section.className = 'fd-chart-section';
    const headerHtml = showLabel
      ? '<div class="fd-chart-header"><span class="fd-chart-title"><span class="fd-chart-dot" style="background:' + color + '"></span>' + FD._escape(label) + ' \u2014 24h</span><span style="display:flex; align-items:center; gap:6px;"><span class="fd-chart-hint">scroll / pinch to zoom</span><button type="button" class="fd-chart-reset">Reset</button></span></div>'
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
    FD._attachChartZoom(seg);
    seg.resetBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (seg.reset) seg.reset();
    });
    return seg;
  }

  async function _loadChartIntoSegment(seg) {
    try {
      const data = await FD._fetch24hGraph(seg.key);
      if (data && data.values.some(function (v) { return v != null; })) {
        seg.lastData = data;
        FD._drawModalChart(seg.canvas, data.values, data.labels, seg.color, seg.zoom, seg.panX);
        seg.loading.style.display = 'none';
      } else {
        seg.loading.textContent = 'No data for the last 24 hours.';
      }
    } catch (err) {
      console.warn('flow detail chart error for ' + seg.key, err);
      seg.loading.textContent = 'Chart unavailable.';
    }
  }

  async function _fetch24hGraph(graphKey) {
    if (typeof _gFetch !== 'function') return null;
    let feedId = null;
    if (typeof GRAPH_FEEDS !== 'undefined') {
      const feed = GRAPH_FEEDS.find(function (f) { return f.key === graphKey; });
      if (feed) feedId = feed.id;
    }
    if (!feedId && FD._AD_HOC_FEED_IDS[graphKey]) feedId = FD._AD_HOC_FEED_IDS[graphKey];
    if (!feedId) return null;
    const now = Date.now(), startMs = now - 24 * 3600 * 1000;
    const intervals = [300, 900, 1800, 3600];
    let pts = [];
    for (let i = 0; i < intervals.length; i++) {
      const iv = intervals[i];
      try {
        const raw = await _gFetch(feedId, startMs, now, iv);
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

  // ── Exports ──────────────────────────────────────────────
  FD._computeWindow = _computeWindow;
  FD._panXFromStartIdx = _panXFromStartIdx;
  FD._drawModalChart = _drawModalChart;
  FD._attachChartZoom = _attachChartZoom;
  FD._buildChartSection = _buildChartSection;
  FD._loadChartIntoSegment = _loadChartIntoSegment;
  FD._fetch24hGraph = _fetch24hGraph;
})();

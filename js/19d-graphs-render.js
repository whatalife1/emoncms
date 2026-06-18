// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

let _graphRedrawFrame = null;
let graphOverlay = null;
let graphIsDragging = false;
let graphDragLastX = 0;
let graphDragLastPanOffset = 0;
let _tooltipIndex = -1;

function _fastRedraw() {
  if (_graphRedrawFrame) return;
  _graphRedrawFrame = requestAnimationFrame(() => {
    _graphRedrawFrame = null;
    const canvas = document.getElementById('graph-canvas');
    if (canvas && graphDataCache) {
      const c = graphDataCache;
      _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined, c.nav);
    }
  });
}

function _initGraphOverlay() {
  const parent = document.querySelector('.graph-chart-card');
  if (!parent || graphOverlay) return;
  
  graphOverlay = document.createElement('canvas');
  graphOverlay.className = 'graph-overlay';
  graphOverlay.style.cssText = `position:absolute;top:0;left:0;z-index:10;cursor:crosshair;touch-action:none;pointer-events:auto;`;
  parent.appendChild(graphOverlay);

  const mainCanvas = document.getElementById('graph-canvas');
  if (mainCanvas) {
    graphOverlay.width = mainCanvas.width;
    graphOverlay.height = mainCanvas.height;
    graphOverlay.style.width = mainCanvas.style.width;
    graphOverlay.style.height = mainCanvas.style.height;
  }

  // ── Wheel zoom ──────────────────────────────────────────────────────────
  graphOverlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.2 : 0.8;
    const oldZ = graphZoomLevel;
    graphZoomLevel = Math.max(1, Math.min(graphZoomMax, graphZoomLevel * delta));
    graphPanOffset *= (graphZoomLevel / oldZ);
    const zl = document.getElementById('zoom-level');
    if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';
    _fastRedraw();
  }, { passive: false });

  // ── Mouse pan ──────────────────────────────────────────────────────────
  graphOverlay.addEventListener('mousedown', (e) => {
    graphIsDragging = true;
    graphDragLastX = e.clientX;
    graphDragLastPanOffset = graphPanOffset;
    graphOverlay.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!graphIsDragging || !graphOverlay) return;
    const dx = (e.clientX - graphDragLastX) * graphZoomLevel * 1.5;
    graphPanOffset = graphDragLastPanOffset + dx;
    _fastRedraw();
  });

  document.addEventListener('mouseup', () => {
    if (graphIsDragging && graphOverlay) {
      graphOverlay.style.cursor = 'crosshair';
      graphIsDragging = false;
    }
  });

  // ── Touch pan ──────────────────────────────────────────────────────────
  graphOverlay.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      graphDragLastX = e.touches[0].clientX;
      graphDragLastPanOffset = graphPanOffset;
      graphIsDragging = true;
      e.preventDefault();
    }
  });

  document.addEventListener('touchmove', (e) => {
    if (!graphIsDragging || !graphOverlay) return;
    const dx = (e.touches[0].clientX - graphDragLastX) * graphZoomLevel * 1.5;
    graphPanOffset = graphDragLastPanOffset + dx;
    _fastRedraw();
  });

  document.addEventListener('touchend', () => {
    graphIsDragging = false;
  });

  // ── Tooltip: mouse ──────────────────────────────────────────────────
  graphOverlay.addEventListener('mousemove', (e) => {
    _handleGraphHover(e);
  });

  graphOverlay.addEventListener('mouseleave', () => {
    hideTooltip();
    _tooltipIndex = -1;
  });

  // ── Tooltip: touch ──────────────────────────────────────────────────
  graphOverlay.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      _handleGraphHover(e.touches[0]);
    }
  });

  // ── Resize observer ──────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    _syncOverlaySize();
    _fastRedraw();
  });
}

function _syncOverlaySize() {
  const mainCanvas = document.getElementById('graph-canvas');
  if (!graphOverlay || !mainCanvas) return;
  graphOverlay.width = mainCanvas.width;
  graphOverlay.height = mainCanvas.height;
  graphOverlay.style.width = mainCanvas.style.width;
  graphOverlay.style.height = mainCanvas.style.height;
}

function _handleGraphHover(e) {
  if (!graphDataCache) return;
  const { bars1, bars2, labels, color1, color2, unit, isCombined, nav } = graphDataCache;
  const rect = graphOverlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const PL = 38, PR = 8, PT = 12, PB = 28;
  const cW = graphOverlay.width - PL - PR;
  const n = bars1.length;
  if (n === 0) return;

  const gap = cW * 0.02 / n;
  const grpW = (cW - gap * (n + 1)) / n;

  const centerX = PL + cW / 2;
  const zoom = graphZoomLevel;
  const panX = graphPanOffset;
  const mapX = (idx) => centerX + (PL + gap + idx * (grpW + gap) + grpW / 2 - centerX) * zoom + panX;

  let foundIdx = -1;
  for (let i = 0; i < n; i++) {
    const xPos = mapX(i);
    const halfWidth = (grpW * zoom) / 2;
    if (x >= xPos - halfWidth && x <= xPos + halfWidth) {
      foundIdx = i;
      break;
    }
  }
  if (foundIdx === -1) {
    hideTooltip();
    _tooltipIndex = -1;
    return;
  }

  if (_tooltipIndex === foundIdx) return;
  _tooltipIndex = foundIdx;

  const v1 = bars1[foundIdx];
  const v2 = isCombined ? bars2[foundIdx] : 0;
  const label = labels[foundIdx] || '';

  const val1 = v1 !== undefined ? (unit === 'W' ? Math.round(v1) : v1.toFixed(1)) : '--';
  const val2 = isCombined && v2 !== undefined ? (unit === 'W' ? Math.round(v2) : v2.toFixed(1)) : '--';

  showTooltip(e, label, val1 + ' ' + unit, val2 + ' ' + unit, color1, color2, isCombined);
}

function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav) {
  if (!canvas || !canvas.getContext) {
    console.error('Canvas not available');
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Could not get canvas context');
    return;
  }

  // Get valid dimensions
  let W = canvas.offsetWidth;
  let H = canvas.offsetHeight || 180;
  if (W === 0) {
    const rect = canvas.getBoundingClientRect();
    W = rect.width || 400;
  }
  if (W < 10) W = 400;
  if (H < 10) H = 180;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const zoom = graphZoomLevel;
  const PL = 38, PR = 8, PT = 12, PB = 28, cW = W - PL - PR, cH = H - PT - PB;
  if (cW < 20 || cH < 20) {
    console.warn('Canvas too small to draw');
    return;
  }
  
  const zoomedWidth = cW * zoom;
  const maxPanX = Math.max(0, (zoomedWidth - cW) / 2);
  graphPanOffset = Math.max(-maxPanX, Math.min(maxPanX, graphPanOffset));
  
  const panX = graphPanOffset;
  const centerX = PL + cW/2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;

  const allV = [...bars1, ...bars2];
  const rawMax = (allV.length ? Math.max(...allV) : 1);
  const roughStep = rawMax / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
  const rel = roughStep / mag;
  let niceMult = rel <= 1 ? 1 : rel <= 1.5 ? 1.5 : rel <= 2 ? 2 : rel <= 2.5 ? 2.5 : rel <= 5 ? 5 : 10;
  const niceStep = niceMult * mag;
  const maxV = niceStep * 4;

  // Y-Axis
  ctx.font='9px system-ui'; ctx.textAlign='right'; ctx.fillStyle='#52525b';
  for (let i=0; i<=4; i++) {
    const yv = niceStep*i, y = PT+cH-(i/4)*cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL+cW, y); ctx.stroke();
    ctx.fillText(yv >= 1000 ? (yv/1000).toFixed(1)+'k' : (yv%1===0?yv:yv.toFixed(1)), PL-4, y+3);
  }

  const n = bars1.length; if (!n) return;
  const isLine = graphChartType === 'line';
  const gap = cW * 0.02 / n, grpW = (cW - gap * (n + 1)) / n;

  // Stop line at current time for today
  let lastIdx = n - 1;
  if (graphTab === 'day' && graphDateNav === 0) {
    const now = new Date();
    const offsetMs = now.getTime() - nav.startMs;
    lastIdx = Math.floor(offsetMs / (GRAPH_DAY_RESOLUTION_MINUTES * 60000));
    lastIdx = Math.max(0, Math.min(n-1, lastIdx));
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(PL, PT, cW, cH); ctx.clip();

  const getX = (i) => mapX(PL + gap + i*(grpW+gap) + grpW/2);

  if (!isLine) {
    for (let i=0; i<n; i++) {
      const x = mapX(PL + gap + i*(grpW+gap)), bw = grpW * zoom;
      if (x+bw < PL || x > W-PR) continue;
      if (bars1[i]>0) {
        ctx.fillStyle = color1;
        _roundRect(ctx, x, PT+cH-(bars1[i]/maxV)*cH, bw, (bars1[i]/maxV)*cH, 1);
      }
    }
  } else {
    const drawLine = (data, clr, limit) => {
      ctx.beginPath(); ctx.strokeStyle = clr; ctx.lineWidth = 2.5;
      let started = false;
      for (let i=0; i <= limit; i++) {
        const x = getX(i), y = PT+cH - (data[i]/maxV)*cH;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else {
          const px = getX(i-1), py = PT+cH - (data[i-1]/maxV)*cH;
          ctx.bezierCurveTo((px+x)/2, py, (px+x)/2, y, x, y);
        }
      }
      ctx.stroke();
      if (started) {
        ctx.lineTo(getX(limit), PT+cH);
        ctx.lineTo(getX(0), PT+cH);
        ctx.fillStyle = clr + '15';
        ctx.fill();
      }
    };
    if (isCombined) drawLine(bars2, color2, lastIdx);
    drawLine(bars1, color1, lastIdx);
  }

  // Draw centre-day marker (vertical dashed line) – only if we have a centre date
  if (graphTab === 'day' && nav.centreDateMs) {
    const centreX = mapX(PL + gap + ((nav.centreDateMs - nav.startMs) / (nav.interval * 1000)) * (grpW + gap));
    if (centreX >= PL && centreX <= W - PR) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.moveTo(centreX, PT);
      ctx.lineTo(centreX, PT + cH);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();

  // X-Axis Labels
  const skip = Math.max(1, Math.ceil(n / (10 * zoom)));
  ctx.textAlign='center'; ctx.fillStyle='#52525b';
  for (let i=0; i<n; i++) {
    if (i % skip === 0) {
      const lx = getX(i);
      if (lx >= PL && lx <= W-PR) ctx.fillText(labels[i], lx, PT+cH+12);
    }
  }

  _syncOverlaySize();
}

function _roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.lineTo(x,y,r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.fill();
}

const _origOpenGraphsPanel = openGraphsPanel;
openGraphsPanel = function() {
  _origOpenGraphsPanel();
  setTimeout(() => { _initGraphOverlay(); }, 100);
};
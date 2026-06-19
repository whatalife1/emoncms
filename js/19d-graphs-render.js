// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

let _graphRedrawFrame = null;
let graphOverlay = null;
let graphIsDragging = false;
let graphDragLastX = 0;
let graphDragLastPanOffset = 0;
let _tooltipIndex = -1;
let _touchStartX = 0;
let _touchStartY = 0;
let _isTouchDrag = false;
let _pinchStartDist = 0;
let _pinchStartZoom = 1;

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
  const mainCanvas = document.getElementById('graph-canvas');
  if (!mainCanvas) return;
  
  const parent = mainCanvas.parentElement;
  
  if (graphOverlay) {
    graphOverlay.remove();
    graphOverlay = null;
  }
  
  graphOverlay = document.createElement('canvas');
  graphOverlay.className = 'graph-overlay';
  graphOverlay.style.cssText = `
    position: absolute;
    z-index: 10;
    cursor: crosshair;
    touch-action: none;
    pointer-events: auto;
  `;
  parent.appendChild(graphOverlay);

  _syncOverlaySize();

  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => _syncOverlaySize());
    ro.observe(mainCanvas);
  }

  // ── Wheel zoom (Desktop) ────────────────────────────────────────────────
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

  // ── Mouse pan (Desktop) ─────────────────────────────────────────────────
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

  // ── Touch pan & Pinch Zoom (Mobile) ─────────────────────────────────────
  graphOverlay.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault(); // Prevent standard browser zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _pinchStartDist = Math.sqrt(dx * dx + dy * dy);
      _pinchStartZoom = graphZoomLevel;
      graphIsDragging = false;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      _touchStartX = touch.clientX;
      _touchStartY = touch.clientY;
      _isTouchDrag = false;
      graphDragLastX = touch.clientX;
      graphDragLastPanOffset = graphPanOffset;
      graphIsDragging = true;
      _pinchStartDist = 0;
    }
  }, { passive: false });

  graphOverlay.addEventListener('touchmove', (e) => {
    // Handle Pinch Zoom
    if (e.touches.length === 2) {
      e.preventDefault();
      if (_pinchStartDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const ratio = dist / _pinchStartDist;
        const oldZ = graphZoomLevel;
        graphZoomLevel = Math.max(graphZoomMin, Math.min(graphZoomMax, _pinchStartZoom * ratio));
        graphPanOffset *= (graphZoomLevel / oldZ); // Keep pan proportional
        
        const zl = document.getElementById('zoom-level');
        if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';
        _fastRedraw();
      }
      return;
    }

    // Handle Pan
    if (!graphIsDragging || !graphOverlay || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - _touchStartX;
    const dy = touch.clientY - _touchStartY;
    
    // Prevent browser back/forward swipe gestures if panning horizontally
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
      if (e.cancelable) e.preventDefault();
    }

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      _isTouchDrag = true;
    }
    
    const panDx = (touch.clientX - graphDragLastX) * graphZoomLevel * 1.5;
    graphPanOffset = graphDragLastPanOffset + panDx;
    _fastRedraw();
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) _pinchStartDist = 0;
    if (e.touches.length === 0) graphIsDragging = false;
  });

  // ── Tooltip: hover (Desktop) ────────────────────────────────────────────
  graphOverlay.addEventListener('mousemove', (e) => {
    if (!tooltipPinned && !graphIsDragging) _handleGraphHover(e, false);
  });

  graphOverlay.addEventListener('mouseleave', () => {
    if (!tooltipPinned) {
      hideTooltip();
      _tooltipIndex = -1;
    }
  });

  // ── Click / tap to pin (Desktop & Mobile) ───────────────────────────────
  graphOverlay.addEventListener('click', (e) => {
    if (tooltipPinned) {
      tooltipPinned = false;
      hideTooltip();
      _tooltipIndex = -1;
      return;
    }
    _handleGraphHover(e, true);
    if (_tooltipIndex !== -1) tooltipPinned = true;
  });

  graphOverlay.addEventListener('touchend', (e) => {
    // If lifting a finger after a pinch zoom, ignore tooltip click
    if (_pinchStartDist > 0 || e.touches.length > 0) return;
    
    // Stop emulated click on mobile to prevent instant hiding
    if (e.cancelable) e.preventDefault();

    if (_isTouchDrag) {
      _isTouchDrag = false;
      return;
    }
    
    const touch = e.changedTouches[0];
    if (!touch) return;
    
    if (tooltipPinned) {
      tooltipPinned = false;
      hideTooltip();
      _tooltipIndex = -1;
      return;
    }
    
    const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY };
    _handleGraphHover(fakeEvent, true);
    if (_tooltipIndex !== -1) tooltipPinned = true;
  }, { passive: false });

  window.addEventListener('resize', () => {
    _syncOverlaySize();
    _fastRedraw();
  });
}

function _syncOverlaySize() {
  const mainCanvas = document.getElementById('graph-canvas');
  if (!graphOverlay || !mainCanvas) return;
  const rect = mainCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  graphOverlay.width = rect.width * dpr;
  graphOverlay.height = rect.height * dpr;
  graphOverlay.style.width = rect.width + 'px';
  graphOverlay.style.height = rect.height + 'px';
  graphOverlay.style.top = mainCanvas.offsetTop + 'px';
  graphOverlay.style.left = mainCanvas.offsetLeft + 'px';
}

function _handleGraphHover(e, pin = false) {
  if (!graphDataCache) return;
  const { bars1, bars2, labels, color1, color2, unit, isCombined, nav } = graphDataCache;
  const rect = graphOverlay.getBoundingClientRect();
  const x = e.clientX - rect.left;

  const PL = 38, PR = 8;
  const W = rect.width; 
  const cW = W - PL - PR;
  const n = bars1.length;
  if (n === 0 || cW <= 0) return;

  const gap = cW * 0.02 / n;
  const grpW = (cW - gap * (n + 1)) / n;

  const centerX = PL + cW / 2;
  const zoom = graphZoomLevel;
  const panX = graphPanOffset;
  const mapX = (idx) => centerX + (PL + gap + idx * (grpW + gap) + grpW / 2 - centerX) * zoom + panX;

  let foundIdx = -1;
  let minDist = Infinity;

  for (let i = 0; i < n; i++) {
    const xPos = mapX(i);
    const dist = Math.abs(x - xPos);
    if (dist < minDist) {
      minDist = dist;
      foundIdx = i;
    }
  }

  // Very generous hit radius makes it easier to tap on mobile
  const maxHitDist = Math.max((grpW * zoom) / 2, 35);
  if (minDist > maxHitDist) {
    if (!pin) {
      hideTooltip();
      _tooltipIndex = -1;
    }
    return;
  }

  if (_tooltipIndex === foundIdx && !pin) return;
  _tooltipIndex = foundIdx;

  const v1 = bars1[foundIdx];
  const v2 = isCombined ? bars2[foundIdx] : 0;
  const label = labels[foundIdx] || '';

  const nFmt = x => x.toLocaleString('en-US');

  const val1 = v1 !== undefined ? (unit === 'W' ? nFmt(Math.round(v1)) : v1.toFixed(1)) : '--';
  const val2 = isCombined && v2 !== undefined ? (unit === 'W' ? nFmt(Math.round(v2)) : v2.toFixed(1)) : '--';

  showTooltip(e, label, val1 + ' ' + unit, val2 + ' ' + unit, color1, color2, isCombined, pin);
}

function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  let W = rect.width;
  let H = rect.height || 180;
  if (W < 10) W = 400;
  if (H < 10) H = 180;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const zoom = graphZoomLevel;
  const PL = 38, PR = 8, PT = 12, PB = 34, cW = W - PL - PR, cH = H - PT - PB;
  if (cW < 20 || cH < 20) return;
  
  const zoomedWidth = cW * zoom;
  const maxPanX = Math.max(0, (zoomedWidth - cW) / 2);
  graphPanOffset = Math.max(-maxPanX, Math.min(maxPanX, graphPanOffset));
  
  const panX = graphPanOffset;
  const centerX = PL + cW/2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;

  const allV = [...bars1, ...bars2];
  const rawMax = Math.max(...allV, 1);
  // Tighter step calculation to prevent excessive empty space at top
  const roughStep = rawMax / 3.8;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
  const rel = roughStep / mag;
  let niceMult = rel <= 1 ? 1 : rel <= 1.2 ? 1.2 : rel <= 1.5 ? 1.5 : rel <= 2 ? 2 : rel <= 2.5 ? 2.5 : rel <= 3 ? 3 : rel <= 4 ? 4 : rel <= 5 ? 5 : rel <= 6 ? 6 : rel <= 8 ? 8 : 10;
  const niceStep = niceMult * mag;
  const maxV = niceStep * 4;

  ctx.font='9px system-ui'; ctx.textAlign='right'; ctx.fillStyle='#facc15';
  for (let i=0; i<=4; i++) {
    const yv = niceStep*i, y = PT+cH-(i/4)*cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL+cW, y); ctx.stroke();
    ctx.fillText(yv >= 1000 ? (yv/1000).toFixed(1)+'k' : (yv%1===0?yv:yv.toFixed(1)), PL-4, y+3);
  }

  const n = bars1.length; if (!n) return;
  const isLine = graphChartType === 'line';
  const gap = cW * 0.02 / n, grpW = (cW - gap * (n + 1)) / n;

  // Determine the cutoff index so lines don't drop to 0 for future dates
  let lastIdx = n - 1;
  const now = new Date();
  if (graphTab === 'day' && graphDateNav === 0) {
    const offsetMs = now.getTime() - nav.startMs;
    lastIdx = Math.floor(offsetMs / (nav.resMins * 60000));
  } else if (graphTab === 'month' && graphMonthNav === 0) {
    lastIdx = now.getDate() - 1;
  } else if (graphTab === 'year' && graphYearNav === 0) {
    lastIdx = now.getMonth();
  }
  lastIdx = Math.max(0, Math.min(n - 1, lastIdx));

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

  const skip = Math.max(1, Math.ceil(n / (10 * zoom)));
  ctx.textAlign='center'; ctx.fillStyle='#facc15';
  for (let i=0; i<n; i++) {
    if (i % skip === 0) {
      const lx = getX(i);
      if (lx >= PL && lx <= W-PR) ctx.fillText(labels[i], lx, PT+cH+15);
    }
  }

  if (typeof _syncOverlaySize === 'function') _syncOverlaySize();
}

function _roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.lineTo(x,y,r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.fill();
}

const _origOpenGraphsPanel = openGraphsPanel;
openGraphsPanel = function() {
  _origOpenGraphsPanel();
  setTimeout(() => { _initGraphOverlay(); }, 150);
};
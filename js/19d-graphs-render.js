// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

// Helper to instantly redraw the canvas from memory without hitting the network
let _graphRedrawFrame = null;
function _fastRedraw() {
  if (_graphRedrawFrame) return;
  _graphRedrawFrame = requestAnimationFrame(() => {
    _graphRedrawFrame = null;
    const canvas = document.getElementById('graph-canvas');
    if (canvas && typeof graphDataCache !== 'undefined' && graphDataCache) {
      const c = graphDataCache;
      _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined);
    }
  });
}

function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 320;
  const H = 180;
  canvas.width  = W * dpr; 
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const zoom = graphZoomLevel;
  const panOffset = graphPanOffset;
  
  const PL=38, PR=8, PT=12, PB=28;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  
  const zoomedCW = cW * zoom;
  const maxPanX = Math.max(0, (zoomedCW - cW) / 2);
  const panX = Math.max(-maxPanX, Math.min(maxPanX, panOffset));
  
  const centerX = PL + cW/2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;

  const allV = [...bars1, ...bars2].filter(v => v > 0);
  const maxV = allV.length ? Math.max(...allV) * 1.12 : 1;
  
  // 1. Draw Y-Axis Grid & Labels (Static, unaffected by zoom/pan)
  ctx.font='9px system-ui'; ctx.textAlign='right';
  for (let i=0; i<=4; i++) {
    const yv = (maxV/4)*i, y = PT+cH-(i/4)*cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL+cW, y); ctx.stroke();
    
    ctx.fillStyle = '#52525b';
    const lbl = yv >= 1000 ? (yv/1000).toFixed(1)+'k' : yv >= 1 ? Math.round(yv) : yv.toFixed(2);
    ctx.fillText(lbl, PL-4, y+3.5);
  }
  
  // Y-Axis Unit Label
  ctx.save(); ctx.translate(9, PT+cH/2); ctx.rotate(-Math.PI/2);
  ctx.textAlign='center'; ctx.fillStyle='#52525b'; ctx.font='8px system-ui';
  ctx.fillText(unit, 0, 0); ctx.restore();

  const n = bars1.length;
  if (!n) {
    ctx.fillStyle='#52525b'; ctx.font='11px system-ui'; ctx.textAlign='center';
    ctx.fillText('No data available', W/2, PT+cH/2+4);
    return;
  }
  
  const isLine = graphChartType === 'line';
  
  const gap  = Math.max(1, cW * 0.03 / n);
  const grpW = Math.max(1, (cW - gap * (n + 1)) / n); 
  const bW   = isCombined && !isLine ? Math.max(1, grpW/2 - 0.5) : Math.max(1, grpW);

  // 2. Draw Data (Clipped to chart area)
  ctx.save();
  ctx.beginPath();
  ctx.rect(PL, PT, cW, cH);
  ctx.clip();

  // A. BARS Rendering
  if (!isLine) {
    for (let i=0; i<n; i++) {
      const baseX = PL + gap + i*(grpW+gap);
      const x = mapX(baseX);
      const mappedBW = bW * zoom;
      
      if (x + mappedBW < PL || x > W - PR) continue; // Culling

      if (bars1[i] > 0) {
        const h1 = Math.max(2, (bars1[i]/maxV)*cH);
        const g1 = ctx.createLinearGradient(0, PT+cH-h1, 0, PT+cH);
        g1.addColorStop(0, color1); g1.addColorStop(1, color1+'44');
        ctx.fillStyle = g1;
        _roundRect(ctx, x, PT+cH-h1, mappedBW, h1, 2);
      }
      
      if (isCombined && bars2[i] > 0) {
        const h2 = Math.max(2, (bars2[i]/maxV)*cH);
        const g2 = ctx.createLinearGradient(0, PT+cH-h2, 0, PT+cH);
        g2.addColorStop(0, color2); g2.addColorStop(1, color2+'44');
        ctx.fillStyle = g2;
        _roundRect(ctx, x + mappedBW + 1*zoom, PT+cH-h2, mappedBW, h2, 2);
      }
    }
  }

  // B. LINES Rendering (Smooth Bezier)
  if (isLine) {
    const getPoints = (bars) => {
      const pts = [];
      for (let i=0; i<n; i++) {
        const baseX = PL + gap + i*(grpW+gap) + grpW/2;
        const x = mapX(baseX);
        const y = PT+cH - (bars[i]/maxV)*cH;
        pts.push({x, y, val: bars[i]});
      }
      return pts;
    };

    const pts1 = getPoints(bars1);
    const pts2 = isCombined ? getPoints(bars2) : [];

    const drawSmoothCurve = (pts, color) => {
      if (pts.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const cpX = (pts[i].x + pts[i+1].x) / 2;
        ctx.bezierCurveTo(cpX, pts[i].y, cpX, pts[i+1].y, pts[i+1].x, pts[i+1].y);
      }
      ctx.lineTo(pts[pts.length - 1].x, PT+cH);
      ctx.lineTo(pts[0].x, PT+cH);
      ctx.closePath();
      
      const grad = ctx.createLinearGradient(0, PT, 0, PT+cH);
      grad.addColorStop(0, color + '66'); 
      grad.addColorStop(1, color + '00'); 
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < pts.length - 1; i++) {
        const cpX = (pts[i].x + pts[i+1].x) / 2;
        ctx.bezierCurveTo(cpX, pts[i].y, cpX, pts[i+1].y, pts[i+1].x, pts[i+1].y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5; 
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    };

    if (isCombined) drawSmoothCurve(pts2, color2);
    drawSmoothCurve(pts1, color1);

    const drawDots = (pts, color) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#121214'; 
      ctx.lineWidth = 1.5;
      for (const p of pts) {
        if (p.val > 0 && p.x >= PL - 10 && p.x <= W - PR + 10) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2);
          ctx.fill();
          ctx.stroke();
        }
      }
    };

    if (isCombined) drawDots(pts2, color2);
    drawDots(pts1, color1);
  }

  ctx.restore(); 

  // 3. Draw X-Axis Labels (Pans with the chart)
  const labelSpacing = Math.max(1, Math.ceil(n / (12 * zoom)));
  for (let i=0; i<n; i++) {
    const show = i % labelSpacing === 0 || i === n-1;
    if (show && labels[i] !== undefined) {
      const baseX = PL + gap + i*(grpW+gap) + grpW/2;
      const lx = mapX(baseX);
      if (lx >= PL && lx <= W - PR) {
        ctx.textAlign='center'; ctx.fillStyle='#52525b'; ctx.font='8px system-ui';
        const labelText = String(labels[i]).length > 5 ? String(labels[i]).substring(0,5) : String(labels[i]);
        ctx.fillText(labelText, lx, PT+cH+12);
      }
    }
  }

  // Base Line
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(PL, PT+cH); ctx.lineTo(W-PR, PT+cH); ctx.stroke();
  
  _addTooltipOverlay(canvas, bars1, bars2, labels, color1, color2, isCombined, maxV, n, PL, PR, gap, grpW, PT, cH, zoom, panX);
}

function _addTooltipOverlay(canvas, bars1, bars2, labels, color1, color2, isCombined, maxV, n, PL, PR, gap, grpW, PT, cH, zoom, panX) {
  const oldOverlay = canvas.parentNode.querySelector('.graph-overlay');
  if (oldOverlay) oldOverlay.remove();
  
  const overlay = document.createElement('canvas');
  overlay.className = 'graph-overlay';
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  overlay.style.cssText = `position:absolute;top:0;left:0;width:${canvas.offsetWidth}px;height:${canvas.offsetHeight}px;cursor:crosshair;background:transparent;z-index:5;touch-action:pan-y;`;
  canvas.parentNode.style.position = 'relative';
  canvas.parentNode.appendChild(overlay);
  
  let tooltip = document.getElementById('graph-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'graph-tooltip';
    tooltip.style.cssText = 'position:absolute;z-index:100;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:12px;color:var(--text-main);box-shadow:0 4px 20px rgba(0,0,0,0.5);display:none;pointer-events:none;min-width:80px;max-width:250px;font-family:system-ui,-apple-system,sans-serif;line-height:1.6;';
    canvas.parentNode.appendChild(tooltip);
  }
  
  const clickData = [];
  const centerX = PL + ((canvas.offsetWidth||320) - PL - PR)/2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;
  
  for (let i=0; i<n; i++) {
    const baseX = PL + gap + i*(grpW+gap);
    const x = mapX(baseX);
    const mappedGrpW = grpW * zoom;
    const mappedGap = gap * zoom;
    const label = labels[i] || String(i);
    const val1 = bars1[i];
    const val2 = isCombined ? bars2[i] : 0;
    
    if (val1 > 0 || val2 > 0) {
      clickData.push({ i, label, val1, val2, x: x, w: mappedGrpW + mappedGap });
    }
  }

  const handleTooltip = (clientX, clientY) => {
    const rect = overlay.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const unit = graphDataCache?.unit || 'W';
    
    let found = false;
    for (const data of clickData) {
      if (x >= data.x && x <= data.x + data.w && y >= PT && y <= PT+cH) {
        found = true;
        const val1Str = data.val1 >= 1000 ? (data.val1/1000).toFixed(2) + 'k' : Math.round(data.val1);
        const val2Str = data.val2 >= 1000 ? (data.val2/1000).toFixed(2) + 'k' : Math.round(data.val2);
        showTooltip({clientX, clientY}, data.label, val1Str + ' ' + unit, val2Str + ' ' + unit, color1, color2, isCombined);
        break;
      }
    }
    if (!found) hideTooltip();
  };
  
  // Desktop Interaction
  let isDragging = false;
  let startX = 0;
  
  overlay.onmousedown = (e) => {
    isDragging = true;
    startX = e.clientX;
    overlay.style.cursor = 'grabbing';
  };
  
  overlay.onmousemove = (e) => {
    if (isDragging && graphZoomLevel > 1) {
      const deltaX = e.clientX - startX;
      graphPanOffset += deltaX;
      startX = e.clientX;
      const maxPan = (canvas.offsetWidth * (graphZoomLevel - 1)) / 2;
      graphPanOffset = Math.max(-maxPan, Math.min(maxPan, graphPanOffset));
      _fastRedraw();
    } else {
      handleTooltip(e.clientX, e.clientY);
    }
  };
  
  overlay.onmouseup = overlay.onmouseleave = () => {
    if (isDragging) {
        isDragging = false;
        overlay.style.cursor = 'crosshair';
    }
    hideTooltip();
  };

  // Mobile Touch Interaction
  let touchStartX = 0, touchStartPan = 0;
  let isTouchPanning = false;

  overlay.ontouchstart = (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartPan = graphPanOffset;
    isTouchPanning = false;
    handleTooltip(touch.clientX, touch.clientY); // Show tooltip immediately on tap
  };

  overlay.ontouchmove = (e) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    
    // If movement is larger than 5px, transition from tap to pan
    if (graphZoomLevel > 1 && Math.abs(deltaX) > 5) {
      isTouchPanning = true;
      e.preventDefault(); // Stop vertical page scroll while swiping graph
      hideTooltip();
      
      graphPanOffset = touchStartPan + deltaX;
      const maxPan = (canvas.offsetWidth * (graphZoomLevel - 1)) / 2;
      graphPanOffset = Math.max(-maxPan, Math.min(maxPan, graphPanOffset));
      _fastRedraw();
    } else if (!isTouchPanning) {
      // Still hovering/tapping
      handleTooltip(touch.clientX, touch.clientY);
    }
  };

  overlay.ontouchend = () => {
    isTouchPanning = false;
    setTimeout(() => { if (!isTouchPanning) hideTooltip(); }, 2000);
  };
}

function _roundRect(ctx,x,y,w,h,r) {
  if (typeof ctx.roundRect === 'function') { 
    ctx.beginPath(); 
    ctx.roundRect(x,y,w,h,[Math.min(r,h/2),Math.min(r,h/2),0,0]); 
    ctx.fill(); 
    return; 
  }
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); 
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); 
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.fill();
}

// Mouse wheel zoom mapped globally
document.addEventListener('wheel', (e) => {
  const panel = document.getElementById('graphs-panel');
  if (!panel || !panel.classList.contains('open')) return;
  const target = e.target.closest('#graph-canvas, .graph-overlay');
  if (!target) return;
  e.preventDefault(); // Stops page scrolling when zooming
  
  graphZoomLevel = Math.max(graphZoomMin, Math.min(graphZoomMax, 
    graphZoomLevel * (e.deltaY < 0 ? 1.15 : (1/1.15))
  ));
  
  const zoomEl = document.getElementById('zoom-level');
  if (zoomEl) zoomEl.textContent = Math.round(graphZoomLevel * 100) + '%';
  
  _fastRedraw(); // Instant redraw
}, { passive: false });
// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

function _fastRedraw() {
  const canvas = document.getElementById('graph-canvas');
  if (canvas && graphDataCache) {
    const c = graphDataCache;
    _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined, c.nav, c.lastIdx);
  }
}

function _attachDirectZoom(canvas) {
  // Guaranteed to only attach once in the page's lifetime
  if (!canvas || canvas._zoomAttached) return;
  canvas._zoomAttached = true;

  canvas.style.touchAction = 'none'; // Tells Android: "Do not scroll the page here"
  canvas.style.cursor = 'crosshair';

  // 1. DESKTOP MOUSE SCROLL
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const oldZ = graphZoomLevel;
    
    graphZoomLevel = Math.max(1, Math.min(60, graphZoomLevel * zoomFactor));
    graphPanOffset *= (graphZoomLevel / oldZ);

    const zl = document.getElementById('zoom-level');
    if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';

    _fastRedraw();
  }, { passive: false });

  // 2. MOUSE DRAGGING (PAN)
  let isMouseDown = false, startX = 0, startPan = 0;

  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    startX = e.clientX;
    startPan = graphPanOffset;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      graphPanOffset = startPan + (e.clientX - startX) * graphZoomLevel;
      _fastRedraw();
    } else if (e.target === canvas) {
      _handleGraphHover(e, false);
    }
  });

  window.addEventListener('mouseup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      canvas.style.cursor = 'crosshair';
    }
  });

  // 3. ANDROID FINGER TOUCH (PINCH + PAN)
  let tStartX = 0, tStartPan = 0, pStartDist = 0, pStartZoom = 1, isTouching = false;

  canvas.addEventListener('touchstart', (e) => {
    isTouching = true;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pStartDist = Math.hypot(dx, dy);
      pStartZoom = graphZoomLevel;
    } else if (e.touches.length === 1) {
      tStartX = e.touches[0].clientX;
      tStartPan = graphPanOffset;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (!isTouching) return;

    if (e.touches.length === 2 && pStartDist > 0) {
      if (e.cancelable) e.preventDefault(); // Lock Android viewport
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      
      const oldZ = graphZoomLevel;
      graphZoomLevel = Math.max(1, Math.min(60, pStartZoom * (dist / pStartDist)));
      graphPanOffset *= (graphZoomLevel / oldZ);

      const zl = document.getElementById('zoom-level');
      if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';
      _fastRedraw();

    } else if (e.touches.length === 1) {
      if (e.cancelable) e.preventDefault(); 
      graphPanOffset = tStartPan + (e.touches[0].clientX - tStartX) * graphZoomLevel;
      _fastRedraw();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => { isTouching = false; pStartDist = 0; });
  canvas.addEventListener('click', (e) => _handleGraphHover(e, true));
}

function _handleGraphHover(e, pin) {
  if (!graphDataCache) return;
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;

  const { bars1, bars2, labels, color1, color2, unit, isCombined, lastIdx } = graphDataCache;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.clientX || (e.touches?.[0]?.clientX ?? 0);
  const x = clientX - rect.left;
  
  const PL = 38, PR = 8, cW = rect.width - PL - PR, n = bars1.length;
  if (n === 0 || cW <= 0) return;

  const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW/2;
  const idx = Math.round(((x - panX - centerX)/zoom + centerX - PL) / (cW/n));
  
  if (idx < 0 || idx >= n || idx >= lastIdx) { 
    if(!pin) hideTooltip(); 
    return; 
  }

  const val1 = Math.round(bars1[idx]) + ' ' + unit;
  const val2 = isCombined ? Math.round(bars2[idx]) + ' ' + unit : '';

  showTooltip(e, labels[idx], val1, val2, color1, color2, isCombined, pin);
}

function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx) {
  _attachDirectZoom(canvas); // Instantly hooks the canvas the millisecond it renders

  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.scale(dpr, dpr);
  
  const PL = 38, PR = 8, PT = 12, PB = 34, cW = rect.width - PL - PR, cH = rect.height - PT - PB;
  const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW/2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;
  
  const maxV = Math.max(...bars1, ...bars2, 1) * 1.1, n = bars1.length;

  ctx.fillStyle = '#71717a'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
  for(let i=0; i<=4; i++) {
    const y = PT + cH - (i/4)*cH;
    ctx.fillText(Math.round(maxV*(i/4)).toLocaleString(), PL-5, y+3);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(PL,y); ctx.lineTo(PL+cW,y); ctx.stroke();
  }

  ctx.save(); ctx.beginPath(); ctx.rect(PL, PT, cW, cH); ctx.clip();
  if (graphChartType === 'line') {
    const drawL = (data, clr) => {
      ctx.beginPath(); ctx.strokeStyle = clr; ctx.lineWidth = 2.5;
      for(let i=0; i < lastIdx; i++) {
        const x = mapX(PL + (i/n)*cW), y = PT + cH - (data[i]/maxV)*cH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.stroke();
    };
    if(isCombined) drawL(bars2, color2);
    drawL(bars1, color1);
  } else {
    const bw = (cW/n)*zoom*0.8;
    for(let i=0; i < lastIdx; i++) {
      const x = mapX(PL + (i/n)*cW);
      if(bars1[i]>0) { ctx.fillStyle=color1; ctx.fillRect(x, PT+cH-(bars1[i]/maxV)*cH, bw, (bars1[i]/maxV)*cH); }
      if(isCombined && bars2[i]>0) { ctx.fillStyle=color2; ctx.fillRect(x+bw/2, PT+cH-(bars2[i]/maxV)*cH, bw, (bars2[i]/maxV)*cH); }
    }
  }
  ctx.restore();

  ctx.fillStyle = '#71717a'; ctx.textAlign = 'center'; ctx.font = '9px system-ui';
  const skip = Math.max(1, Math.ceil(n / (8 * zoom)));
  for(let i=0; i<n; i+=skip) {
    const lx = mapX(PL + (i/n)*cW);
    if(lx > PL-10 && lx < rect.width-PR) ctx.fillText(labels[i]||'', lx, rect.height-12);
  }
}
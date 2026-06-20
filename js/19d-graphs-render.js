// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

let _graphRedrawFrame = null;
let graphOverlay = null;
let graphIsDragging = false;
let graphDragLastX = 0;
let graphDragLastPanOffset = 0;
let _tooltipIndex = -1;
let _isTouchDrag = false;
let _pinchStartDist = 0;
let _pinchStartZoom = 1;

// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────
function _fastRedraw() {
  const canvas = document.getElementById('graph-canvas');
  if (canvas && graphDataCache) {
    const c = graphDataCache;
    _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined, c.nav, c.lastIdx);
  }
}

function _initGraphOverlay() {
  const main = document.getElementById('graph-canvas'); if (!main) return;
  if (graphOverlay) graphOverlay.remove();
  graphOverlay = document.createElement('canvas');
  graphOverlay.style.cssText = "position:absolute;z-index:10;touch-action:none;cursor:crosshair;";
  main.parentElement.appendChild(graphOverlay);
  _syncOverlaySize();

  graphOverlay.addEventListener('mousedown', (e) => { graphIsDragging = true; graphDragLastX = e.clientX; graphDragLastPanOffset = graphPanOffset; });
  document.addEventListener('mousemove', (e) => { 
    if (graphIsDragging) {
      graphPanOffset = graphDragLastPanOffset + (e.clientX - graphDragLastX) * graphZoomLevel * 1.5;
      _fastRedraw();
    } else _handleGraphHover(e, false);
  });
  document.addEventListener('mouseup', () => graphIsDragging = false);
  graphOverlay.addEventListener('click', (e) => _handleGraphHover(e, true));
}

function _syncOverlaySize() {
  const main = document.getElementById('graph-canvas'); if (!main || !graphOverlay) return;
  const rect = main.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  graphOverlay.width = rect.width * dpr; graphOverlay.height = rect.height * dpr;
  graphOverlay.style.width = rect.width + 'px'; graphOverlay.style.height = rect.height + 'px';
  graphOverlay.style.top = main.offsetTop + 'px'; graphOverlay.style.left = main.offsetLeft + 'px';
}

function _handleGraphHover(e, pin) {
  if (!graphDataCache) return;
  const { bars1, bars2, labels, color1, color2, unit, isCombined, lastIdx } = graphDataCache;
  const rect = graphOverlay.getBoundingClientRect(), x = (e.clientX || e.touches?.[0].clientX) - rect.left;
  const PL = 38, PR = 8, cW = rect.width - PL - PR, n = bars1.length;
  const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW/2;
  const idx = Math.round(((x - panX - centerX)/zoom + centerX - PL) / (cW/n));
  
  if (idx < 0 || idx >= n || idx >= lastIdx) { if(!pin) hideTooltip(); return; }

  // Math.round() added to bars1 and bars2 to remove decimals in tooltip
  const val1 = Math.round(bars1[idx]) + ' ' + unit;
  const val2 = isCombined ? Math.round(bars2[idx]) + ' ' + unit : '';

  showTooltip(e, labels[idx], val1, val2, color1, color2, isCombined, pin);
}



function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx) {
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; ctx.scale(dpr, dpr);
  const PL = 38, PR = 8, PT = 12, PB = 34, cW = rect.width - PL - PR, cH = rect.height - PT - PB;
  const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW/2;
  const mapX = (x) => centerX + (x - centerX) * zoom + panX;
  const maxV = Math.max(...bars1, ...bars2, 1) * 1.1, n = bars1.length;

  // Y-Axis
  ctx.fillStyle = '#71717a'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
  for(let i=0; i<=4; i++) {
    const y = PT + cH - (i/4)*cH; ctx.fillText(Math.round(maxV*(i/4)).toLocaleString(), PL-5, y+3);
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

  // X-Axis Labels (Time)
  ctx.fillStyle = '#71717a'; ctx.textAlign = 'center';
  const skip = Math.max(1, Math.ceil(n / (8 * zoom)));
  for(let i=0; i<n; i+=skip) {
    const lx = mapX(PL + (i/n)*cW);
    if(lx > PL-10 && lx < rect.width-PR) ctx.fillText(labels[i]||'', lx, rect.height-12);
  }
}


function _roundRect(ctx,x,y,w,h,r) { ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill(); }

const _origOpenGraphsPanel = openGraphsPanel;
openGraphsPanel = function() { _origOpenGraphsPanel(); setTimeout(_initGraphOverlay, 150); };
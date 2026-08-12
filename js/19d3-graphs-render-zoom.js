// js/19d3-graphs-render-zoom.js
// ─── Direct zoom/pan via mouse wheel, drag, and touch gestures ──────────────

function _attachDirectZoom(canvas) {
  if (!canvas || canvas._zoomAttached) return;
  canvas._zoomAttached = true;
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'crosshair';

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const oldZ = graphZoomLevel;
    graphZoomLevel = Math.max(1, Math.min(60, graphZoomLevel * zoomFactor));
    graphPanOffset *= (graphZoomLevel / oldZ);
    _fastRedraw();
  }, { passive: false });

  let isMouseDown = false, startX = 0, startPan = 0;
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true; startX = e.clientX; startPan = graphPanOffset;
    canvas.style.cursor = 'grabbing'; graphIsPanning = true;
  });
  window.addEventListener('mousemove', (e) => {
    if (isMouseDown) {
      graphPanOffset = startPan + (e.clientX - startX);
      _fastRedraw();
    } else if (e.target === canvas) {
      _handleGraphHover(e, false);
    }
  });
  window.addEventListener('mouseup', () => {
    if (isMouseDown) { isMouseDown = false; canvas.style.cursor = 'crosshair'; graphIsPanning = false; }
  });

  let tStartX = 0, tStartPan = 0, pStartDist = 0, pStartZoom = 1, isTouching = false;
  canvas.addEventListener('touchstart', (e) => {
    isTouching = true; graphIsPanning = true;
    const tooltip = document.getElementById('graph-tooltip');
    if (tooltip) tooltip.style.pointerEvents = 'none';
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pStartDist = Math.hypot(dx, dy); pStartZoom = graphZoomLevel;
    } else if (e.touches.length === 1) {
      tStartX = e.touches[0].clientX; tStartPan = graphPanOffset;
      _handleGraphHover(e.touches[0], false);
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    const tooltip = document.getElementById('graph-tooltip');
    if (tooltip) tooltip.style.pointerEvents = 'none';
    if (e.touches.length === 2 && pStartDist > 0) {
      if (e.cancelable) e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const oldZ = graphZoomLevel;
      graphZoomLevel = Math.max(1, Math.min(60, pStartZoom * (dist / pStartDist)));
      graphPanOffset *= (graphZoomLevel / oldZ);
      _fastRedraw();
    } else if (e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      _handleGraphHover(e.touches[0], false);
      graphPanOffset = tStartPan + (e.touches[0].clientX - tStartX);
      _fastRedraw();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    isTouching = false; pStartDist = 0; graphIsPanning = false;
    const tooltip = document.getElementById('graph-tooltip');
    if (tooltip && tooltip.classList.contains('pinned')) tooltip.style.pointerEvents = 'auto';
  });
  canvas.addEventListener('click', (e) => {
    if (graphFeedKey === 'momentflow') { _handleGraphHover(e, false); }
    else { _handleGraphHover(e, true); }
  });
}
window._attachDirectZoom = _attachDirectZoom;

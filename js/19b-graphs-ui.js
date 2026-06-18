// ─── Graphs Panel - UI Rendering ────────────────────────────────────────────

let graphNeedsDayZoom = false;
let tooltipPinned = false;

function _renderZoomControls() {
  const wrap = document.getElementById('graph-time-tabs');
  if (!wrap) return;
  const existing = document.getElementById('zoom-controls');
  if (existing) existing.remove();
  
  const controls = document.createElement('div');
  controls.id = 'zoom-controls';
  controls.style.cssText = 'display:flex;gap:4px;margin-top:6px;align-items:center;justify-content:center;';
  controls.innerHTML = `
    <button class="zoom-btn" id="zoom-out" style="padding:4px 10px;border-radius:6px;font-size:14px;font-weight:700;background:var(--bg-card);border:1px solid var(--border);color:var(--text-main);cursor:pointer;width:auto;">🔍−</button>
    <span id="zoom-level" style="font-size:11px;color:var(--text-muted);min-width:50px;text-align:center;">${Math.round(graphZoomLevel * 100)}%</span>
    <button class="zoom-btn" id="zoom-in" style="padding:4px 10px;border-radius:6px;font-size:14px;font-weight:700;background:var(--bg-card);border:1px solid var(--border);color:var(--text-main);cursor:pointer;width:auto;">🔍+</button>
    <button class="zoom-btn" id="zoom-reset" style="padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;width:auto;">↺ Reset</button>
  `;
  wrap.parentNode.insertBefore(controls, wrap.nextSibling);
  
  document.getElementById('zoom-in').addEventListener('click', () => {
    graphZoomLevel = Math.min(graphZoomMax, graphZoomLevel * 1.3);
    document.getElementById('zoom-level').textContent = Math.round(graphZoomLevel * 100) + '%';
    _loadAndDraw();
  });
  
  document.getElementById('zoom-out').addEventListener('click', () => {
    graphZoomLevel = Math.max(graphZoomMin, graphZoomLevel / 1.3);
    document.getElementById('zoom-level').textContent = Math.round(graphZoomLevel * 100) + '%';
    _loadAndDraw();
  });
  
  document.getElementById('zoom-reset').addEventListener('click', () => {
    graphZoomLevel = 1;
    graphPanOffset = 0;
    document.getElementById('zoom-level').textContent = '100%';
    _loadAndDraw();
  });
}

function _renderChartTypeToggle() {
  const wrap = document.getElementById('graph-time-tabs');
  if (!wrap) return;
  const existing = document.getElementById('chart-type-toggle');
  if (existing) existing.remove();
  
  const toggle = document.createElement('div');
  toggle.id = 'chart-type-toggle';
  toggle.style.cssText = 'display:flex;gap:4px;margin-top:6px;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:3px;';
  toggle.innerHTML = `
    <button class="chart-type-btn${graphChartType==='bar'?' active':''}" data-type="bar" style="flex:1;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;background:${graphChartType==='bar'?'var(--bg-card)':'transparent'};border:${graphChartType==='bar'?'1px solid var(--border)':'1px solid transparent'};color:var(--text-main);cursor:pointer;">📊 Bars</button>
    <button class="chart-type-btn${graphChartType==='line'?' active':''}" data-type="line" style="flex:1;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:700;background:${graphChartType==='line'?'var(--bg-card)':'transparent'};border:${graphChartType==='line'?'1px solid var(--border)':'1px solid transparent'};color:var(--text-main);cursor:pointer;">📈 Lines</button>
  `;
  wrap.parentNode.insertBefore(toggle, wrap.nextSibling);
  
  toggle.querySelectorAll('.chart-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      graphChartType = btn.dataset.type;
      _renderChartTypeToggle();
      _loadAndDraw();
    });
  });
}

function _renderGTimeTabs() {
  const wrap = document.getElementById('graph-time-tabs');
  if (!wrap) return;
  wrap.innerHTML = ['day','month','year','total'].map(t =>
    `<button class="gtime-tab${graphTab===t?' active':''}" data-gtab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`
  ).join('');
  
  wrap.querySelectorAll('.gtime-tab').forEach(b => {
    b.addEventListener('click', () => {
      graphTab = b.dataset.gtab;
      if (graphTab === 'day') {
        graphChartType = 'line';
        graphNeedsDayZoom = true;
      } else {
        graphChartType = 'bar';
      }
      graphDateNav = 0; graphMonthNav = 0; graphYearNav = 0;
      graphZoomLevel = 1;
      graphPanOffset = 0;
      tooltipPinned = false;
      hideTooltip();
      _renderGTimeTabs(); 
      _renderGNavBar(); 
      _renderChartTypeToggle();
      _loadAndDraw();
    });
  });
}

function _renderGFeedTabs() {
  const wrap = document.getElementById('graph-feed-tabs');
  if (!wrap) return;
  const all = [GRAPH_COMBINED, ...GRAPH_FEEDS];
  wrap.innerHTML = all.map(f =>
    `<button class="gfeed-tab${graphFeedKey===f.key?' active':''}" data-gkey="${f.key}"
      style="${graphFeedKey===f.key?`border-color:${f.color};color:${f.color}`:''}">${f.label}</button>`
  ).join('');
  
  wrap.querySelectorAll('.gfeed-tab').forEach(b => {
    b.addEventListener('click', () => {
      graphFeedKey = b.dataset.gkey;
      graphZoomLevel = 1;
      graphPanOffset = 0;
      graphNeedsDayZoom = true;
      tooltipPinned = false;
      hideTooltip();
      _renderGFeedTabs(); 
      _loadAndDraw();
    });
  });
}

function _getLocalMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function _gNavInfo() {
  const now = new Date();
  if (graphTab === 'day') {
    const d = new Date(now);
    d.setDate(d.getDate() + graphDateNav);

    const lbl = graphDateNav === 0 ? 'Today' : graphDateNav === -1 ? 'Yesterday' :
      d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    const sub = d.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const centreDayStart = _getLocalMidnight(d);
    const startMs = centreDayStart;
    const endMs = centreDayStart + 24 * 3600 * 1000 - 1;

    const totalMinutes = 24 * 60;
    const nBars = Math.ceil(totalMinutes / GRAPH_DAY_RESOLUTION_MINUTES);
    const labels = [];
    for (let i = 0; i < nBars; i++) {
      const ms = startMs + i * GRAPH_DAY_RESOLUTION_MINUTES * 60000;
      const date = new Date(ms);
      const h = date.getHours();
      const m = date.getMinutes();
      labels.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }

    return {
      label: lbl,
      sub,
      interval: GRAPH_DAY_RESOLUTION_MINUTES * 60,
      startMs,
      endMs,
      isHourly: true,
      nBars,
      labels,
      centreDateMs: centreDayStart
    };
  }
  
  if (graphTab === 'month') {
    const m = new Date(now.getFullYear(), now.getMonth()+graphMonthNav, 1);
    const days = new Date(m.getFullYear(),m.getMonth()+1,0).getDate();
    return { label: m.toLocaleDateString('en-PK',{month:'long',year:'numeric'}), sub:null,
      interval:86400, isHourly:false, nBars:days,
      startMs: new Date(m.getFullYear(),m.getMonth(),1).getTime(),
      endMs:   new Date(m.getFullYear(),m.getMonth(),days,23,59,59).getTime(),
      labels: Array.from({length:days},(_,i)=>String(i+1)),
      month: m.getMonth(), year: m.getFullYear() };
  }
  if (graphTab === 'year') {
    const y = now.getFullYear()+graphYearNav;
    return { label:String(y), sub:null, interval:86400, isYearly:true, nBars:12,
      startMs: new Date(y,0,1).getTime(), endMs: new Date(y,11,31,23,59,59).getTime(),
      labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], year:y };
  }
  return { label:'All Time', sub:null, interval:86400*7, isTotal:true, nBars:0,
    startMs: new Date(2024,0,1).getTime(), endMs: now.getTime(), labels:[] };
}

function _renderGNavBar() {
  const wrap = document.getElementById('graph-nav-bar');
  if (!wrap) return;
  if (graphTab === 'total') { wrap.innerHTML = ''; return; }
  const nav = _gNavInfo();
  const canFwd = (graphTab==='day'&&graphDateNav<0)||(graphTab==='month'&&graphMonthNav<0)||(graphTab==='year'&&graphYearNav<0);
  wrap.innerHTML = `
    <button class="graph-nav-btn" id="gnav-prev">‹</button>
    <div class="graph-nav-center">
      <div class="graph-nav-label">${nav.label}</div>
      ${nav.sub?`<div class="graph-nav-sub">${nav.sub}</div>`:''}
    </div>
    <button class="graph-nav-btn" id="gnav-next" style="opacity:${canFwd?1:0.3}">›</button>`;
    
  const prevBtn = document.getElementById('gnav-prev');
  const nextBtn = document.getElementById('gnav-next');
  
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (graphTab==='day') graphDateNav--; else if (graphTab==='month') graphMonthNav--; else graphYearNav--;
    graphZoomLevel = 1;
    graphPanOffset = 0;
    graphNeedsDayZoom = true;
    tooltipPinned = false;
    hideTooltip();
    _renderGNavBar(); 
    _loadAndDraw();
  });
  
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (!canFwd) return;
    if (graphTab==='day') graphDateNav++; else if (graphTab==='month') graphMonthNav++; else graphYearNav++;
    graphZoomLevel = 1;
    graphPanOffset = 0;
    graphNeedsDayZoom = true;
    tooltipPinned = false;
    hideTooltip();
    _renderGNavBar(); 
    _loadAndDraw();
  });
}

function hideTooltip() {
  const tooltip = document.getElementById('graph-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
    tooltip.classList.remove('pinned');
  }
  tooltipPinned = false;
}

function showTooltip(e, label, value1, value2, color1, color2, isCombined, pinned = false) {
  let tooltip = document.getElementById('graph-tooltip');
  
  // CRITICAL: Ensure tooltip is absolutely positioned inside document.body 
  // so it breaks completely out of the slide-panel Desktop bounds
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'graph-tooltip';
    document.body.appendChild(tooltip);
  } else if (tooltip.parentElement !== document.body) {
    document.body.appendChild(tooltip); 
  }
  
  let closeBtn = pinned ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';
  let html = `<div style="font-weight:700;font-size:11px;color:var(--text-muted);margin-bottom:4px">${label} ${closeBtn}</div>`;
  html += `<div style="color:${color1}">● ${isCombined ? 'Solar' : graphFeedKey}: ${value1}</div>`;
  if (isCombined) {
    html += `<div style="color:${color2}">● Grid: ${value2}</div>`;
  }
  
  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  tooltip.classList.toggle('pinned', pinned);
  
  // Directly base coordinates off raw viewport screen position
  let left = e.clientX + 15;
  let top = e.clientY - 15;
  
  const rect = tooltip.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // Prevent overflow off the right/bottom edge
  if (left + rect.width > vw - 10) left = e.clientX - rect.width - 15;
  if (top + rect.height > vh - 10) top = e.clientY - rect.height - 15;
  if (top < 10) top = 10;
  if (left < 10) left = 10;
  
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function _showGraphLoading(show) {
  const card = document.querySelector('.graph-chart-card');
  if (!card) return;
  let overlay = document.getElementById('graph-loading-overlay');
  if (show) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'graph-loading-overlay';
      overlay.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); z-index: 20;
        display: flex; align-items: center; justify-content: center;
        border-radius: 10px;
        pointer-events: none;
      `;
      overlay.innerHTML = `<div style="color:var(--text-main);font-size:14px;font-weight:700;">⏳ Loading...</div>`;
      card.style.position = 'relative';
      card.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  } else {
    if (overlay) overlay.style.display = 'none';
  }
}
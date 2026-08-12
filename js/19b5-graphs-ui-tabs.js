// js/19b5-graphs-ui-tabs.js
// ─── Time tabs, feed tabs, grid-all toggles, overlay toggles ────────────────

function _renderGTimeTabs() {
  const wrap = document.getElementById('graph-time-tabs'); if (!wrap) return;
  wrap.innerHTML = ['day','month','year','total'].map(t => `<button class="gtime-tab${graphTab===t?' active':''}" data-gtab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
  wrap.querySelectorAll('.gtime-tab').forEach(b => {
    b.addEventListener('click', () => {
      graphTab = b.dataset.gtab; graphChartType = (graphTab === 'day') ? 'line' : 'bar';
      if (graphTab === 'day') startGraphsAutoRefresh(); else stopGraphsAutoRefresh();
      graphDateNav = 0; graphMonthNav = 0; graphYearNav = 0; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
      _renderGTimeTabs(); _renderGNavBar(); updateGraphStartButton(); _renderChartTypeToggle(); if (typeof _loadAndDraw === 'function') _loadAndDraw();
    });
  });
}

function _renderGridAllToggles() {
  const existing = document.getElementById('gridall-toggles'); if (existing) existing.remove();
  if (graphFeedKey !== 'gridall') return;
  const wrap = document.createElement('div'); wrap.id = 'gridall-toggles';
  wrap.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 0 8px;flex-shrink:0;align-items:center;justify-content:center;';
  GRID_ALL_FEEDS.forEach(f => {
    const off = window.gridAllDisabled.has(f.key);
    const btn = document.createElement('button');
    btn.style.cssText = `white-space:nowrap; flex-shrink:0; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; border:1.5px solid ${f.color}; width:auto; background:${off ? 'transparent' : f.color + '33'}; color:${off ? 'var(--text-muted)' : f.color}; opacity:${off ? '0.4' : '1'};`;
    btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color};margin-right:5px;vertical-align:middle;opacity:${off?0.3:1}"></span>${f.label}`;
    btn.addEventListener('click', () => { if (window.gridAllDisabled.has(f.key)) window.gridAllDisabled.delete(f.key); else if ((GRID_ALL_FEEDS.length - window.gridAllDisabled.size) > 1) window.gridAllDisabled.add(f.key); _renderGridAllToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
    wrap.appendChild(btn);
  });
  const feedTabsWrap = document.getElementById('graph-feed-tabs');
  if (feedTabsWrap) feedTabsWrap.parentNode.insertBefore(wrap, feedTabsWrap);
}

function _renderOverlayToggles() {
  const existing = document.getElementById('temp-overlay-toggles'); if (existing) existing.remove();
  if (!['temp', 'temp2'].includes(graphFeedKey)) return;
  const container = document.createElement('div'); container.id = 'temp-overlay-toggles';
  container.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 0 8px;align-items:center;justify-content:center;';
  const acs = [{ key: 'haier', label: '+ Haier 1T', color: '#a5f3fc' }, { key: 'k15', label: '+ Kenwood 1.5T', color: '#38bdf8' }, { key: 'k1', label: '+ Kenwood 1T', color: '#7dd3fc' }];
  const clearBtn = document.createElement('button'); clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = 'padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);';
  clearBtn.addEventListener('click', () => { window.graphOverlayAc = null; _renderOverlayToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
  container.appendChild(clearBtn);
  acs.forEach(t => {
    const active = window.graphOverlayAc === t.key;
    const btn = document.createElement('button');
    btn.style.cssText = `padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer; border:1.5px solid ${t.color};background:${active ? t.color+'33' : 'transparent'}; color:${active ? t.color : 'var(--text-muted)'};opacity:${active ? '1' : '0.5'};`;
    btn.textContent = t.label;
    btn.addEventListener('click', () => { window.graphOverlayAc = t.key; _renderOverlayToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
    container.appendChild(btn);
  });
  const fTabs = document.getElementById('graph-feed-tabs'); if (fTabs) fTabs.parentNode.insertBefore(container, fTabs.nextSibling);
}

function _renderGFeedTabs() {
  const wrap = document.getElementById('graph-feed-tabs'); if (!wrap) return;
  const tabs = [GRAPH_COMBINED, GRAPH_MOMENT_FLOW, ...GRAPH_FEEDS];
  wrap.innerHTML = tabs.map(f => `<button class="gfeed-tab${graphFeedKey===f.key?' active':''}" data-gkey="${f.key}" style="${graphFeedKey===f.key?`border-color:${f.color};color:${f.color}`:''}">${f.label}</button>`).join('') + `<button class="gfeed-tab${graphFeedKey==='report'?' active':''}" data-gkey="report" style="${graphFeedKey==='report'?'border-color:#10b981;color:#10b981':''}">📄 Report</button>`;
  wrap.querySelectorAll('.gfeed-tab').forEach(b => { b.addEventListener('click', () => { graphFeedKey = b.dataset.gkey; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGFeedTabs(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); }); });
  _renderGridAllToggles(); _renderOverlayToggles(); if (typeof _renderOthersFridgeToggle === 'function') _renderOthersFridgeToggle();
}
window._renderGFeedTabs = _renderGFeedTabs;
window._renderGTimeTabs = _renderGTimeTabs;

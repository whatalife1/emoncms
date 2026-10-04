
// ─── Battery 2: 16-Cell Mode & Pill Toggles ─────────────────────────────────
function _renderBattery2CellToggles() {
  const existing = document.getElementById('bat2cells-toggles');
  if (existing) existing.remove();
  if (graphFeedKey !== 'bat2cells' && graphFeedKey !== 'batcells') return;

  const wrap = document.createElement('div');
  wrap.id = 'bat2cells-toggles';
  wrap.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:6px 0 8px; flex-shrink:0; align-items:center; justify-content:center; width:100%;';

  // Mode row: Band, All 16, Delta (+Spread toggle)
  const modeRow = document.createElement('div');
  modeRow.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; justify-content:center; align-items:center;';

  const modes = [
    { id: 'band',  label: '📊 Min/Max Band' },
    { id: 'all',   label: '📈 Show All 16' },
    { id: 'delta', label: '⚖️ Delta (±mV from Avg)' }
  ];

  modes.forEach(m => {
    const active = (window.graphBat2CellMode === m.id && window.graphBat2SoloCell === null);
    const btn = document.createElement('button');
    btn.style.cssText = `padding:3px 10px; border-radius:14px; font-size:11px; font-weight:700; cursor:pointer; width:auto; border:1px solid ${active ? '#38bdf8' : 'var(--border)'}; background:${active ? 'rgba(56,189,248,0.2)' : 'var(--bg-card)'}; color:${active ? '#38bdf8' : 'var(--text-muted)'};`;
    btn.textContent = m.label;
    btn.onclick = () => {
      window.graphBat2CellMode = m.id;
      window.graphBat2SoloCell = null;
      try { localStorage.setItem('graphBat2CellMode', m.id); } catch(e){}
      _renderBattery2CellToggles();
      if (typeof _loadAndDraw === 'function') _loadAndDraw();
    };
    modeRow.appendChild(btn);
  });

  const spreadActive = window.graphBat2ShowSpreadOverlay;
  const spreadBtn = document.createElement('button');
  spreadBtn.style.cssText = `padding:3px 10px; border-radius:14px; font-size:11px; font-weight:700; cursor:pointer; width:auto; border:1px solid ${spreadActive ? '#f59e0b' : 'var(--border)'}; background:${spreadActive ? 'rgba(245,158,11,0.2)' : 'var(--bg-card)'}; color:${spreadActive ? '#f59e0b' : 'var(--text-muted)'};`;
  spreadBtn.textContent = spreadActive ? '⚡ Spread Δ: ON' : '⚡ + Spread Δ (mV)';
  spreadBtn.onclick = () => {
    window.graphBat2ShowSpreadOverlay = !window.graphBat2ShowSpreadOverlay;
    try { localStorage.setItem('graphBat2ShowSpreadOverlay', window.graphBat2ShowSpreadOverlay ? 'true' : 'false'); } catch(e){}
    _renderBattery2CellToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  };
  modeRow.appendChild(spreadBtn);
  wrap.appendChild(modeRow);

  // Cell pills row (C1 to C16)
  const cellRow = document.createElement('div');
  cellRow.style.cssText = 'display:flex; gap:4px; flex-wrap:wrap; justify-content:center; align-items:center; max-width:680px;';

  const cellColors = window.BATTERY2_CELL_COLORS || [];
  for (let c = 1; c <= 16; c++) {
    const isSolo = (window.graphBat2SoloCell === c);
    const clr = cellColors[c - 1] || '#38bdf8';
    const cBtn = document.createElement('button');
    cBtn.style.cssText = `padding:2px 7px; border-radius:10px; font-size:10px; font-weight:800; cursor:pointer; width:auto; border:1.5px solid ${isSolo ? clr : 'var(--border)'}; background:${isSolo ? clr + '33' : 'var(--bg-card)'}; color:${isSolo ? clr : 'var(--text-muted)'};`;
    cBtn.textContent = `C${c}`;
    cBtn.title = `Isolate Cell ${c}`;
    cBtn.onclick = () => {
      if (window.graphBat2SoloCell === c) {
        window.graphBat2SoloCell = null;
      } else {
        window.graphBat2SoloCell = c;
      }
      _renderBattery2CellToggles();
      if (typeof _loadAndDraw === 'function') _loadAndDraw();
    };
    cellRow.appendChild(cBtn);
  }
  wrap.appendChild(cellRow);

  const feedTabsWrap = document.getElementById('graph-feed-tabs');
  if (feedTabsWrap) feedTabsWrap.parentNode.insertBefore(wrap, feedTabsWrap);
}
window._renderBattery2CellToggles = _renderBattery2CellToggles;


// ─── Moment Flow Toggle Pills ───────────────────────────────────────────────
function _renderMomentFlowToggles() {
  const existing = document.getElementById('momentflow-toggles');
  if (existing) existing.remove();
  if (graphFeedKey !== 'momentflow') return;

  const feeds = window.MOMENT_FLOW_FEEDS || [];
  const wrap = document.createElement('div');
  wrap.id = 'momentflow-toggles';
  wrap.style.cssText = 'display:flex; flex-direction:column; gap:6px; padding:6px 0 8px; flex-shrink:0; align-items:center; justify-content:center;';

  // Helper actions row (All, Grid + ACs, Grid Only)
  const actionRow = document.createElement('div');
  actionRow.style.cssText = 'display:flex; gap:6px; align-items:center; justify-content:center; flex-wrap:wrap; margin-bottom:2px;';

  const mkActionBtn = (text, onClick, title) => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.title = title || '';
    btn.style.cssText = 'padding:2px 9px; border-radius:12px; font-size:10.5px; font-weight:700; cursor:pointer; background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted); width:auto;';
    btn.addEventListener('click', onClick);
    return btn;
  };

  actionRow.appendChild(mkActionBtn('✓ All', () => {
    window.momentFlowDisabled.clear();
    try { localStorage.removeItem('momentFlowDisabled'); } catch(e){}
    _renderMomentFlowToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }, 'Show all feeds (Default)'));

  actionRow.appendChild(mkActionBtn('⚡ Grid + ACs', () => {
    window.momentFlowDisabled.clear();
    feeds.forEach(f => {
      if (!f.isGrid && !f.isAc) window.momentFlowDisabled.add(f.key);
    });
    try { localStorage.setItem('momentFlowDisabled', JSON.stringify([...window.momentFlowDisabled])); } catch(e){}
    _renderMomentFlowToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }, 'Show Grid with ACs only'));

  actionRow.appendChild(mkActionBtn('⚡ Grid Only', () => {
    window.momentFlowDisabled.clear();
    feeds.forEach(f => {
      if (!f.isGrid) window.momentFlowDisabled.add(f.key);
    });
    try { localStorage.setItem('momentFlowDisabled', JSON.stringify([...window.momentFlowDisabled])); } catch(e){}
    _renderMomentFlowToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }, 'Show Grid only'));

  wrap.appendChild(actionRow);

  // Feed pills row
  const pillsRow = document.createElement('div');
  pillsRow.style.cssText = 'display:flex; gap:5px; flex-wrap:wrap; align-items:center; justify-content:center;';

  feeds.forEach(f => {
    const off = window.momentFlowDisabled.has(f.key);
    const btn = document.createElement('button');
    btn.style.cssText = `white-space:nowrap; flex-shrink:0; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; border:1.5px solid ${f.color}; width:auto; background:${off ? 'transparent' : f.color + '33'}; color:${off ? 'var(--text-muted)' : f.color}; opacity:${off ? '0.35' : '1'}; transition:all 0.15s;`;
    btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color};margin-right:5px;vertical-align:middle;opacity:${off ? 0.3 : 1}"></span>${f.label}`;

    btn.addEventListener('click', () => {
      if (window.momentFlowDisabled.has(f.key)) {
        window.momentFlowDisabled.delete(f.key);
      } else {
        if ((feeds.length - window.momentFlowDisabled.size) > 1) {
          window.momentFlowDisabled.add(f.key);
        }
      }
      try { localStorage.setItem('momentFlowDisabled', JSON.stringify([...window.momentFlowDisabled])); } catch(e){}
      _renderMomentFlowToggles();
      if (typeof _loadAndDraw === 'function') _loadAndDraw();
    });
    pillsRow.appendChild(btn);
  });

  wrap.appendChild(pillsRow);

  const feedTabsWrap = document.getElementById('graph-feed-tabs');
  if (feedTabsWrap) feedTabsWrap.parentNode.insertBefore(wrap, feedTabsWrap);
}
window._renderMomentFlowToggles = _renderMomentFlowToggles;

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
  clearBtn.addEventListener('click', () => { window.graphOverlayAc = null; _renderOverlayToggles();
  if (typeof _renderMomentFlowToggles === 'function') _renderMomentFlowToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
  container.appendChild(clearBtn);
  acs.forEach(t => {
    const active = window.graphOverlayAc === t.key;
    const btn = document.createElement('button');
    btn.style.cssText = `padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer; border:1.5px solid ${t.color};background:${active ? t.color+'33' : 'transparent'}; color:${active ? t.color : 'var(--text-muted)'};opacity:${active ? '1' : '0.5'};`;
    btn.textContent = t.label;
    btn.addEventListener('click', () => { window.graphOverlayAc = t.key; _renderOverlayToggles();
  if (typeof _renderMomentFlowToggles === 'function') _renderMomentFlowToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
    container.appendChild(btn);
  });
  const fTabs = document.getElementById('graph-feed-tabs'); if (fTabs) fTabs.parentNode.insertBefore(container, fTabs.nextSibling);
}

function _renderGFeedTabs() {
  const wrap = document.getElementById('graph-feed-tabs'); if (!wrap) return;
  const batChgDis = (typeof GRAPH_BAT_CHG_DIS !== 'undefined') ? [GRAPH_BAT_CHG_DIS] : [];
  const batCycles = (typeof GRAPH_BAT_CYCLES !== 'undefined') ? [GRAPH_BAT_CYCLES] : [];
  const tabs = [GRAPH_COMBINED, ...batChgDis, ...batCycles, GRAPH_MOMENT_FLOW, ...GRAPH_FEEDS.filter(f => f.key !== 'batcycles')];
  wrap.innerHTML = tabs.map(f => `<button class="gfeed-tab${graphFeedKey===f.key?' active':''}" data-gkey="${f.key}" style="${graphFeedKey===f.key?`border-color:${f.color};color:${f.color}`:''}">${f.label}</button>`).join('') + `<button class="gfeed-tab${graphFeedKey==='report'?' active':''}" data-gkey="report" style="${graphFeedKey==='report'?'border-color:#10b981;color:#10b981':''}">📄 Report</button>`;
  wrap.querySelectorAll('.gfeed-tab').forEach(b => { b.addEventListener('click', () => { graphFeedKey = b.dataset.gkey; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGFeedTabs(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); }); });
  _renderGridAllToggles(); 
  _renderOverlayToggles();
  if (typeof _renderBattery2CellToggles === 'function') _renderBattery2CellToggles();
  if (typeof _renderMomentFlowToggles === 'function') _renderMomentFlowToggles(); 
  if (typeof _renderOthersFridgeToggle === 'function') _renderOthersFridgeToggle();
  if (typeof _renderWmToggles === 'function') _renderWmToggles();
  if (typeof _renderWaterToggles === 'function') _renderWaterToggles();
  if (typeof _renderMotorToggles === 'function') _renderMotorToggles();
  if (typeof _renderBatteryToggles === 'function') _renderBatteryToggles();
}
window._renderGFeedTabs = _renderGFeedTabs;
window._renderGTimeTabs = _renderGTimeTabs;

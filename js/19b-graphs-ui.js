// ─── Graphs Panel - UI Rendering ────────────────────────────────────────────

let graphNeedsDayZoom = false;
let tooltipPinned = false;
let graphsAutoRefreshInterval = null;
let graphsLastUpdate = 0;

// ─── Missing constants & helpers ────────────────────────────────────────────
const graphZoomMin = 1;
const graphZoomMax = 60;

function _getLocalMidnight(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// ─── Auto-refresh management ────────────────────────────────────────────────

function startGraphsAutoRefresh() {
    if (graphsAutoRefreshInterval) {
        clearInterval(graphsAutoRefreshInterval);
        graphsAutoRefreshInterval = null;
    }
    if (graphTab === 'day') {
        graphsAutoRefreshInterval = setInterval(() => {
            const panel = document.getElementById('graphs-panel');
            if (!panel || !panel.classList.contains('open')) {
                if (graphsAutoRefreshInterval) {
                    clearInterval(graphsAutoRefreshInterval);
                    graphsAutoRefreshInterval = null;
                }
                return;
            }
            if (!graphIsLoading && !graphIsPanning) {
                console.log('🔄 Auto-refreshing graph (day view)');
                _loadAndDraw();
                graphsLastUpdate = Date.now();
            }
        }, 60000);
    }
}

function stopGraphsAutoRefresh() {
    if (graphsAutoRefreshInterval) {
        clearInterval(graphsAutoRefreshInterval);
        graphsAutoRefreshInterval = null;
    }
}

function _addRefreshIndicator() {
    const stat = document.getElementById('graph-stat');
    if (!stat) return;
    const existing = document.getElementById('graph-refresh-indicator');
    if (existing) existing.remove();
    if (graphTab === 'day') {
        const indicator = document.createElement('span');
        indicator.id = 'graph-refresh-indicator';
        indicator.style.cssText = `
            display: inline-block;
            margin-left: 10px;
            font-size: 10px;
            color: var(--text-muted);
            opacity: 0.7;
            font-weight: 400;
        `;
        indicator.textContent = '🔄 Auto-refresh: 1m';
        stat.appendChild(indicator);
    }
}

function _addUpdateTimestamp() {
    const stat = document.getElementById('graph-stat');
    if (!stat) return;
    let timestamp = document.getElementById('graph-timestamp');
    if (!timestamp) {
        timestamp = document.createElement('div');
        timestamp.id = 'graph-timestamp';
        timestamp.style.cssText = `
            font-size: 9px;
            color: var(--text-muted);
            opacity: 0.5;
            margin-top: 2px;
            font-weight: 400;
        `;
        stat.appendChild(timestamp);
    }
    const now = new Date();
    timestamp.textContent = `Updated: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function _renderZoomControls() {
    const wrap = document.getElementById('graph-time-tabs');
    if (!wrap) return;
    const existing = document.getElementById('zoom-controls');
    if (existing) existing.remove();

    const isDesktop = /Win/i.test(navigator.platform) ||
                      window.matchMedia('(min-width: 1024px)').matches;
    if (isDesktop) return;

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
    const existing = document.getElementById('chart-type-toggle');
    if (existing) existing.remove();

    const card = document.querySelector('.graph-chart-card');
    if (!card) return;

    const toggle = document.createElement('div');
    toggle.id = 'chart-type-toggle';
    toggle.style.cssText = `
        position:absolute; top:8px; right:8px; z-index:15;
        display:flex; flex-direction:column; gap:4px;
        background: var(--bg-panel); padding: 4px; border-radius: 8px;
        box-shadow: -2px 2px 8px rgba(0,0,0,0.4);
    `;

    const types = [
        { type: 'line',   label: 'Line' },
        { type: 'bar',    label: 'Bar' },
        { type: 'hourly', label: 'Hourly' },
    ];

    types.forEach(({ type, label }) => {
        const btn = document.createElement('button');
        const active = graphChartType === type;
        btn.dataset.type = type;
        btn.title = label;
        btn.textContent = label;
        btn.style.cssText = `
            padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; width:auto;
            background:${active ? 'var(--bg-base)' : 'rgba(0,0,0,0.45)'};
            border:1px solid ${active ? 'var(--border)' : 'transparent'};
            color:var(--text-main); opacity:${active ? '1' : '0.55'};
            transition:opacity 0.15s;
            font-weight:700;
            letter-spacing:0.3px;
        `;
        btn.addEventListener('click', () => {
            graphChartType = type;
            _renderChartTypeToggle();
            _loadAndDraw();
        });
        toggle.appendChild(btn);
    });

    card.appendChild(toggle);
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
                startGraphsAutoRefresh();
            } else {
                graphChartType = 'bar';
                stopGraphsAutoRefresh();
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

// ─── Grid-All per-feed toggle pills ─────────────────────────────────────────
function _renderGridAllToggles() {
    const existing = document.getElementById('gridall-toggles');
    if (existing) existing.remove();

    if (graphFeedKey !== 'gridall') return;

    const wrap = document.createElement('div');
    wrap.id = 'gridall-toggles';
    wrap.style.cssText = 'display:flex;gap:5px;flex-wrap:nowrap;overflow-x:auto;padding:6px 0 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;flex-shrink:0;align-items:center;';
    
    if (!document.getElementById('gridall-scroll-style')) {
        const s = document.createElement('style');
        s.id = 'gridall-scroll-style';
        s.textContent = '#gridall-toggles::-webkit-scrollbar { display: none; }';
        document.head.appendChild(s);
    }

    GRID_ALL_FEEDS.forEach(f => {
        const off = window.gridAllDisabled.has(f.key);
        const btn = document.createElement('button');
        btn.style.cssText = `
            white-space:nowrap;
            flex-shrink:0;
            padding:4px 10px;
            border-radius:20px;
            font-size:11px;
            font-weight:700;
            cursor:pointer;
            border:1.5px solid ${f.color};
            width:auto;
            background:${off ? 'transparent' : f.color + '33'};
            color:${off ? 'var(--text-muted)' : f.color};
            opacity:${off ? '0.4' : '1'};
            transition:opacity 0.15s, background 0.15s;
        `;
        btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color};margin-right:5px;vertical-align:middle;opacity:${off ? 0.3 : 1}"></span>${f.label}`;

        btn.addEventListener('click', () => {
            if (window.gridAllDisabled.has(f.key)) {
                window.gridAllDisabled.delete(f.key);
            } else {
                const visibleCount = GRID_ALL_FEEDS.length - window.gridAllDisabled.size;
                if (visibleCount > 1) {
                    window.gridAllDisabled.add(f.key);
                }
            }
            _renderGridAllToggles();
            _loadAndDraw();
        });
        wrap.appendChild(btn);
    });

    const feedTabsWrap = document.getElementById('graph-feed-tabs');
    if (feedTabsWrap) {
        feedTabsWrap.parentNode.insertBefore(wrap, feedTabsWrap);
    }
}

function _renderOverlayToggles() {
    const existing = document.getElementById('temp-overlay-toggles');
    if (existing) existing.remove();

    const tempKeys = ['temp', 'temp2'];
    if (!tempKeys.includes(graphFeedKey)) return;

    const container = document.createElement('div');
    container.id = 'temp-overlay-toggles';
    container.style.cssText = 'display:flex;gap:5px;flex-wrap:nowrap;overflow-x:auto;padding:6px 0 8px;scrollbar-width:none;';

    const acs = [
        { key: 'haier', label: '+ Haier 1T', color: '#a5f3fc' },
        { key: 'k15', label: '+ Kenwood 1.5T', color: '#38bdf8' },
        { key: 'k1', label: '+ Kenwood 1T', color: '#7dd3fc' }
    ];

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);';
    clearBtn.addEventListener('click', () => {
        window.graphOverlayAc = null;
        _renderOverlayToggles();
        _loadAndDraw();
    });
    container.appendChild(clearBtn);

    acs.forEach(t => {
        const active = window.graphOverlayAc === t.key;
        const btn = document.createElement('button');
        btn.style.cssText = `
            padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;
            border:1.5px solid ${t.color};background:${active ? t.color+'33' : 'transparent'};
            color:${active ? t.color : 'var(--text-muted)'};opacity:${active ? '1' : '0.5'};
        `;
        btn.textContent = t.label;
        btn.addEventListener('click', () => {
            window.graphOverlayAc = t.key;
            _renderOverlayToggles();
            _loadAndDraw();
        });
        container.appendChild(btn);
    });

    const feedTabsWrap = document.getElementById('graph-feed-tabs');
    if (feedTabsWrap) {
        feedTabsWrap.parentNode.insertBefore(container, feedTabsWrap.nextSibling);
    }
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

    _renderGridAllToggles();
    _renderOverlayToggles();
}

// ─── Navigation info ────────────────────────────────────────────────────────
function _gNavInfo() {
    const now = new Date();

    const to12hr = (h, m, s) => {
        const ampm = h >= 12 ? 'pm' : 'am';
        const hh = h % 12 || 12;
        const mm = (m === 0 && s === 0) ? '' : `:${String(m).padStart(2, '0')}`;
        const ss = s === 0 ? '' : `:${String(s).padStart(2, '0')}`;
        return `${hh}${mm}${ss}${ampm}`;
    };

    if (graphTab === 'day') {
        const d = new Date(now);
        d.setDate(d.getDate() + graphDateNav);

        const lbl = graphDateNav === 0 ? 'Today' : graphDateNav === -1 ? 'Yesterday' :
            d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
        const sub = d.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const centreDayStart = _getLocalMidnight(d);
        const startMs = centreDayStart;
        const endMs = centreDayStart + 24 * 3600 * 1000 - 1;

        const isHourlyView = (graphChartType === 'hourly');
        const resSeconds = isHourlyView ? 3600 : GRAPH_DAY_RESOLUTION_SECONDS;
        const nBars = Math.ceil((24 * 3600) / resSeconds);

        const labels = [];
        for (let i = 0; i < nBars; i++) {
            const ms = startMs + i * resSeconds * 1000;
            const date = new Date(ms);
            labels.push(to12hr(date.getHours(), date.getMinutes(), date.getSeconds()));
        }

        return {
            label: lbl, sub, interval: resSeconds, startMs, endMs,
            isDayTab: true, nBars, labels, centreDateMs: centreDayStart, resSeconds
        };
    }

    // ── MONTH VIEW: billing cycle (25th → 26th) ──────────────────────────
    if (graphTab === 'month') {
        let base = new Date(now.getFullYear(), now.getMonth() + graphMonthNav, 1);
        let startMonth = base.getMonth() - 1;
        let startYear = base.getFullYear();
        if (startMonth < 0) { startMonth = 11; startYear--; }
        const start = new Date(startYear, startMonth, 25);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
        const effectiveEnd = end > now ? now : end;

        const days = Math.ceil((effectiveEnd - start) / 86400000);
        const labels = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start.getTime() + i * 86400000);
            labels.push(`${d.getDate()}/${d.getMonth()+1}`);
        }

        const rangeLabel = `${start.toLocaleDateString('en-PK', {month:'short', day:'numeric'})} – ${effectiveEnd.toLocaleDateString('en-PK', {month:'short', day:'numeric', year:'numeric'})}`;
        return {
            label: rangeLabel,
            sub: null,
            interval: 3600,
            isDayTab: false,
            nBars: days,
            startMs: start.getTime(),
            endMs: effectiveEnd.getTime(),
            labels: labels,
            month: start.getMonth(),
            year: start.getFullYear(),
            isMonthBilling: true
        };
    }

    // ── YEAR VIEW: billing cycles (Dec 25 previous year → Dec 31 current year) ──
    if (graphTab === 'year') {
        const y = now.getFullYear() + graphYearNav;
        const start = new Date(y - 1, 11, 25); // Dec 25 of previous year
        const end = new Date(y, 11, 31, 23, 59, 59);
        return {
            label: String(y),
            sub: null,
            interval: 3600,
            isYearly: true,
            nBars: 12,
            startMs: start.getTime(),
            endMs: end.getTime(),
            labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            year: y,
            isYearBilling: true
        };
    }

    // ── TOTAL ───────────────────────────────────────────────────────────────
    return {
        label: 'All Time',
        sub: null,
        interval: 86400 * 7,
        isTotal: true,
        nBars: 0,
        startMs: new Date(2024, 0, 1).getTime(),
        endMs: now.getTime(),
        labels: []
    };
}

// ─── Navigation bar ──────────────────────────────────────────────────────────
function _renderGNavBar() {
    const wrap = document.getElementById('graph-nav-bar');
    if (!wrap) return;
    if (graphTab === 'total') { wrap.innerHTML = ''; return; }
    const nav = _gNavInfo();
    const canFwd = (graphTab === 'day' && graphDateNav < 0) ||
                   (graphTab === 'month' && nav.endMs < Date.now()) ||
                   (graphTab === 'year' && graphYearNav < 0);
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
        if (graphTab === 'day') graphDateNav--;
        else if (graphTab === 'month') graphMonthNav--;
        else graphYearNav--;
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
        if (graphTab === 'day') graphDateNav++;
        else if (graphTab === 'month') graphMonthNav++;
        else graphYearNav++;
        graphZoomLevel = 1;
        graphPanOffset = 0;
        graphNeedsDayZoom = true;
        tooltipPinned = false;
        hideTooltip();
        _renderGNavBar();
        _loadAndDraw();
    });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function hideTooltip() {
    const tooltip = document.getElementById('graph-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.classList.remove('pinned');
    }
    tooltipPinned = false;
}

function showTooltip(e, label, value1, value2, color1, color2, isCombined, pinned = false, label1 = null, label2 = null, highlightIdx = 0, tempLabel = null, tempValue = null, tempColor = null) {
    let tooltip = document.getElementById('graph-tooltip');

    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'graph-tooltip';
        document.body.appendChild(tooltip);
    } else if (tooltip.parentElement !== document.body) {
        document.body.appendChild(tooltip);
    }

    const L1 = label1 || (isCombined ? 'Solar' : graphFeedKey);
    const L2 = label2 || 'Grid';

    let closeBtn = pinned ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';
    let html = `<div style="font-weight:700;font-size:11px;color:var(--text-muted);margin-bottom:4px">${label} ${closeBtn}</div>`;
    
    const style1 = highlightIdx === 1 ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';
    const style2 = highlightIdx === 2 ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';

    html += `<div style="color:${color1};${style1}">${highlightIdx === 1 ? '* ' : ''}● ${L1}: ${value1}</div>`;
    if (isCombined) {
        html += `<div style="color:${color2};${style2}">${highlightIdx === 2 ? '* ' : ''}● ${L2}: ${value2}</div>`;
    }
    if (tempValue !== null) {
        html += `<div style="color:${tempColor};margin:2px 0;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tempColor};margin-right:5px;"></span>
            <b>${tempLabel}:</b> ${tempValue}
        </div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.classList.toggle('pinned', pinned);

    let left = e.clientX + 15;
    let top = e.clientY - 15;

    const rect = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

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

// ─── Open/Close Panel Functions ─────────────────────────────────────────────

function openGraphsPanel() {
    const p = document.getElementById('graphs-panel');
    if (!p) return;
    const isWin = navigator.userAgent.toLowerCase().includes('windows') || navigator.platform.toLowerCase().includes('win');
    if (isWin) {
        p.classList.add('fullscreen');
    } else {
        p.classList.remove('fullscreen');
    }
    p.classList.add('open');
    setTimeout(() => {
        renderGraphsPanel();
        if (graphTab === 'day') {
            startGraphsAutoRefresh();
        }
    }, 50);
}

function closeGraphsPanel() {
    const p = document.getElementById('graphs-panel');
    if (p) {
        p.classList.remove('open');
        const isWin = navigator.userAgent.toLowerCase().includes('windows') || navigator.platform.toLowerCase().includes('win');
        if (!isWin) {
            p.classList.remove('fullscreen');
        }
    }
    hideTooltip();
    graphZoomLevel = 1;
    graphPanOffset = 0;
    stopGraphsAutoRefresh();
}

function renderGraphsPanel() {
    if (graphIsRendering) return;
    graphIsRendering = true;
    try {
        _renderGFeedTabs();
        _renderGTimeTabs();
        _renderGNavBar();
        _renderChartTypeToggle();
        _renderZoomControls();

        if (graphTab === 'day') {
            graphNeedsDayZoom = true;
            startGraphsAutoRefresh();
        }

        _loadAndDraw();
    } catch(e) {
        console.warn('Graph render error:', e);
    } finally {
        graphIsRendering = false;
    }
}
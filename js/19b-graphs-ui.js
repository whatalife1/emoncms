// ─── Graphs Panel - UI Rendering ────────────────────────────────────────────

let graphNeedsDayZoom = false;
let tooltipPinned = false;
let graphsAutoRefreshInterval = null;
let graphsLastUpdate = 0;

window.generateDayGraphReportText = async function() {
    if (graphTab !== 'day') {
        return { text: "Please switch to 'Day' view to generate a daily report.", html: "" };
    }
    const nav = _gNavInfo();
    const local = getKarachiDate(nav.startMs);
    const dateKey = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
    const dateDisplay = `${local.day}/${local.month}/${local.year}`;

    const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
        const data = await fetchWithCache(feed.id, nav.startMs, nav.endMs);
        return { feed, data };
    });

    const results = await Promise.all(fetchPromises);
    const sums = {};
    const hourly = {};
    
    results.forEach(r => {
        const ds = r.feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
        const de = r.feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
        sums[r.feed.id] = {
            h24: sumByDay(r.data, 0, 24),
            day: sumByDay(r.data, ds, de),
            night: sumByDay(r.data, EXPORT_NIGHT_START, EXPORT_NIGHT_END)
        };
        
        const hSum = new Array(24).fill(0);
        const hCnt = new Array(24).fill(0);
        for (const [tsStr, val] of Object.entries(r.data)) {
            const ts = parseInt(tsStr);
            const l = getKarachiDate(ts);
            if (l.year === local.year && l.month === local.month && l.day === local.day) {
                hSum[l.hour] += val;
                hCnt[l.hour]++;
            }
        }
        const hArr = new Array(24).fill(0);
        let maxW = 0;
        for(let i=0; i<24; i++) {
            hArr[i] = hCnt[i] ? hSum[i]/hCnt[i] : 0;
            if (hArr[i] > maxW) maxW = hArr[i];
        }
        hourly[r.feed.id] = { arr: hArr, max: maxW };
    });

    const getK = (id, type) => (sums[id][type][dateKey] || 0) / 1000;
    const padVal = (v) => v.toFixed(2).padStart(6);
    const toW = (kwh, h) => Math.round((kwh * 1000) / h);

    const blocks = ['_', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
    function makeSparkline(id) {
        const hData = hourly[id];
        if (!hData || hData.max === 0) return ''.padEnd(24, '_') + '] max: 0W';
        let str = '';
        for(let i=0; i<24; i++) {
            let v = hData.arr[i];
            if (v <= 0) str += '_';
            else {
                let idx = Math.ceil((v / hData.max) * 8);
                if (idx < 1) idx = 1;
                if (idx > 8) idx = 8;
                str += blocks[idx];
            }
        }
        return `${str}] max: ${Math.round(hData.max)}W`;
    }

    let txt = `Daily Energy Usage Report: ${dateDisplay}\n`;
    txt += `Generated: ${new Date().toLocaleString()}\n`;
    txt += `Hourly scale: 00:00 to 23:59 (each block = 1 hour)\n`;
    txt += `--------------------------------------------------------------------------------\n`;

    const solarF = EXPORT_FEEDS.find(f => f.isSolar);
    const breakerF = EXPORT_FEEDS.find(f => f.isBreaker);

    if (solarF) {
        const val = getK(solarF.id, 'h24');
        txt += `Solar`.padEnd(16) + `${padVal(val)} units (Avg: ${toW(val, 24)}W)\n`;
        txt += `                 [${makeSparkline(solarF.id)}\n`;
    }
    if (breakerF) {
        const total = getK(breakerF.id, 'h24');
        const day = getK(breakerF.id, 'day');
        const night = getK(breakerF.id, 'night');
        txt += `Breaker`.padEnd(16) + `${padVal(total)} units (Avg: ${toW(total, 24)}W) | Day: ${padVal(day)} | Night: ${padVal(night)} (Avg: ${toW(night, 15)}W)\n`;
        txt += `                 [${makeSparkline(breakerF.id)}\n`;
    }
    txt += `--------------------------------------------------------------------------------\n`;

    EXPORT_FEEDS.forEach(f => {
        if (f.isSolar || f.isBreaker) return;
        const total = getK(f.id, 'h24');
        const day = getK(f.id, 'day');
        const night = getK(f.id, 'night');
        const nHours = f.isPc ? 13 : 15;
        
        txt += f.name.substring(0,15).padEnd(16) + 
               `${padVal(total)} units (${toW(total, 24)}W)`.padEnd(25) + 
               `| Day: ${padVal(day)}`.padEnd(16) + 
               `| Night: ${padVal(night)} (Avg: ${toW(night, nHours)}W)\n`;
        txt += `                 [${makeSparkline(f.id)}\n`;
    });

    // --- Generate HTML Table (Original Detailed Style) ---
    let html = `<div class="report-wrapper" style="background:var(--bg-panel); color:var(--text-main); border:1px solid var(--border); border-radius:10px; padding:10px; margin-top:20px;">`;
    html += `<h4 style="margin:0 0 10px 0; font-size:14px; border-bottom:1px solid var(--border); padding-bottom:5px;">Daily Consumption Breakdown</h4>`;
    html += `<div class="table-scroll" style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace;">`;
    
    html += `<tr style="background:var(--bg-card);">
        <th style="border:1px solid var(--border); padding:6px; text-align:left;">Appliance</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">24hr (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Day (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Night (kWh)</th>
    </tr>`;

    EXPORT_FEEDS.forEach(f => {
        const val24 = getK(f.id, 'h24');
        const valDay = f.isSolar ? '-' : getK(f.id, 'day');
        const valNight = f.isSolar ? '-' : getK(f.id, 'night');
        
        html += `<tr>
            <td style="border:1px solid var(--border); padding:6px; font-weight:bold;">${f.name}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-kwh);">${val24 === 0 ? '-' : val24.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${valDay === '-' ? '-' : (valDay === 0 ? '-' : valDay.toFixed(2))}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${valNight === '-' ? '-' : (valNight === 0 ? '-' : valNight.toFixed(2))}</td>
        </tr>`;
    });
    
    html += `</table></div></div>`;

    return { text: txt, html: html };
};

window.downloadDayGraphReport = async function() {
    const btn = document.getElementById('btn-graphs-report');
    const oldTxt = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;

    try {
        const report = await window.generateDayGraphReportText();
        const txt = report.text || report;
        if (typeof txt === 'string' && txt.startsWith("Please switch")) {
            alert(txt);
            return;
        }
        const nav = _gNavInfo();
        const local = getKarachiDate(nav.startMs);
        const dateKey = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
        
        const blob = new Blob([txt], { type: 'text/plain' });
        const a = document.createElement('a');
        a.download = `Emon_Report_${dateKey}.txt`;
        a.href = URL.createObjectURL(blob);
        a.click();
    } catch (e) {
        console.error(e);
        alert("Report Error: " + e.message);
    } finally {
        btn.textContent = oldTxt;
        btn.disabled = false;
    }
};

function _getLocalMidnight(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

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

function _renderChartTypeToggle() {
    const existing = document.getElementById('chart-type-toggle');
    if (existing) existing.remove();
    const card = document.querySelector('.graph-chart-card');
    if (!card) return;
    const toggle = document.createElement('div');
    toggle.id = 'chart-type-toggle';
    toggle.style.cssText = `position:absolute; top:8px; right:8px; z-index:15; display:flex; flex-direction:column; gap:4px; background: var(--bg-panel); padding: 4px; border-radius: 8px; box-shadow: -2px 2px 8px rgba(0,0,0,0.4);`;
    const types = [{ type: 'line', label: 'Line' }, { type: 'bar', label: 'Bar' }, { type: 'hourly', label: 'Hourly' }];
    types.forEach(({ type, label }) => {
        const btn = document.createElement('button');
        const active = graphChartType === type;
        btn.dataset.type = type;
        btn.textContent = label;
        btn.style.cssText = `padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; width:auto; background:${active ? 'var(--bg-base)' : 'rgba(0,0,0,0.45)'}; border:1px solid ${active ? 'var(--border)' : 'transparent'}; color:var(--text-main); opacity:${active ? '1' : '0.55'}; font-weight:700;`;
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
    wrap.innerHTML = ['day','month','year','total'].map(t => `<button class="gtime-tab${graphTab===t?' active':''}" data-gtab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
    wrap.querySelectorAll('.gtime-tab').forEach(b => {
        b.addEventListener('click', () => {
            graphTab = b.dataset.gtab;
            if (graphTab === 'day') {
                graphChartType = 'line';
                startGraphsAutoRefresh();
            } else {
                graphChartType = 'bar';
                stopGraphsAutoRefresh();
            }
            graphDateNav = 0; graphMonthNav = 0; graphYearNav = 0;
            graphZoomLevel = 1; graphPanOffset = 0; tooltipPinned = false;
            hideTooltip();
            _renderGTimeTabs(); _renderGNavBar(); _renderChartTypeToggle();
            _loadAndDraw();
        });
    });
}

function _renderGridAllToggles() {
    const existing = document.getElementById('gridall-toggles');
    if (existing) existing.remove();
    if (graphFeedKey !== 'gridall') return;
    const wrap = document.createElement('div');
    wrap.id = 'gridall-toggles';
    wrap.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 0 8px;flex-shrink:0;align-items:center;justify-content:center;';
    GRID_ALL_FEEDS.forEach(f => {
        const off = window.gridAllDisabled.has(f.key);
        const btn = document.createElement('button');
        btn.style.cssText = `white-space:nowrap; flex-shrink:0; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; border:1.5px solid ${f.color}; width:auto; background:${off ? 'transparent' : f.color + '33'}; color:${off ? 'var(--text-muted)' : f.color}; opacity:${off ? '0.4' : '1'}; transition:opacity 0.15s, background 0.15s;`;
        btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color};margin-right:5px;vertical-align:middle;opacity:${off ? 0.3 : 1}"></span>${f.label}`;
        btn.addEventListener('click', () => {
            if (window.gridAllDisabled.has(f.key)) window.gridAllDisabled.delete(f.key);
            else { if ((GRID_ALL_FEEDS.length - window.gridAllDisabled.size) > 1) window.gridAllDisabled.add(f.key); }
            _renderGridAllToggles(); _loadAndDraw();
        });
        wrap.appendChild(btn);
    });
    const feedTabsWrap = document.getElementById('graph-feed-tabs');
    if (feedTabsWrap) feedTabsWrap.parentNode.insertBefore(wrap, feedTabsWrap);
}

function _renderOverlayToggles() {
    const existing = document.getElementById('temp-overlay-toggles');
    if (existing) existing.remove();
    const tempKeys = ['temp', 'temp2'];
    if (!tempKeys.includes(graphFeedKey)) return;
    const container = document.createElement('div');
    container.id = 'temp-overlay-toggles';
    container.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 0 8px;align-items:center;justify-content:center;';
    const acs = [{ key: 'haier', label: '+ Haier 1T', color: '#a5f3fc' }, { key: 'k15', label: '+ Kenwood 1.5T', color: '#38bdf8' }, { key: 'k1', label: '+ Kenwood 1T', color: '#7dd3fc' }];
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = 'padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);';
    clearBtn.addEventListener('click', () => { window.graphOverlayAc = null; _renderOverlayToggles(); _loadAndDraw(); });
    container.appendChild(clearBtn);
    acs.forEach(t => {
        const active = window.graphOverlayAc === t.key;
        const btn = document.createElement('button');
        btn.style.cssText = `padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer; border:1.5px solid ${t.color};background:${active ? t.color+'33' : 'transparent'}; color:${active ? t.color : 'var(--text-muted)'};opacity:${active ? '1' : '0.5'};`;
        btn.textContent = t.label;
        btn.addEventListener('click', () => { window.graphOverlayAc = t.key; _renderOverlayToggles(); _loadAndDraw(); });
        container.appendChild(btn);
    });
    const feedTabsWrap = document.getElementById('graph-feed-tabs');
    if (feedTabsWrap) feedTabsWrap.parentNode.insertBefore(container, feedTabsWrap.nextSibling);
}

function _renderGFeedTabs() {
    const wrap = document.getElementById('graph-feed-tabs');
    if (!wrap) return;
    const all = [GRAPH_COMBINED, ...GRAPH_FEEDS];
    wrap.innerHTML = all.map(f => `<button class="gfeed-tab${graphFeedKey===f.key?' active':''}" data-gkey="${f.key}" style="${graphFeedKey===f.key?`border-color:${f.color};color:${f.color}`:''}">${f.label}</button>`).join('') + `<button class="gfeed-tab${graphFeedKey==='report'?' active':''}" data-gkey="report" style="${graphFeedKey==='report'?'border-color:#10b981;color:#10b981':''}">📄 Report</button>`;
    wrap.querySelectorAll('.gfeed-tab').forEach(b => {
        b.addEventListener('click', () => {
            graphFeedKey = b.dataset.gkey; graphZoomLevel = 1; graphPanOffset = 0; tooltipPinned = false; hideTooltip(); _renderGFeedTabs(); _loadAndDraw();
        });
    });
    _renderGridAllToggles(); _renderOverlayToggles();
}

function _gNavInfo() {
    const now = new Date();
    const to12hr = (h, m, s) => { const ampm = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; const mm = (m === 0 && s === 0) ? '' : `:${String(m).padStart(2, '0')}`; return `${hh}${mm}${ampm}`; };
    if (graphTab === 'day') {
        const d = new Date(now); d.setDate(d.getDate() + graphDateNav);
        const lbl = graphDateNav === 0 ? 'Today' : graphDateNav === -1 ? 'Yesterday' : d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
        const startMs = _getLocalMidnight(d); const endMs = startMs + 24 * 3600 * 1000 - 1;
        const resSeconds = (graphChartType === 'hourly') ? 3600 : GRAPH_DAY_RESOLUTION_SECONDS;
        const nBars = Math.ceil((24 * 3600) / resSeconds);
        const labels = [];
        for (let i = 0; i < nBars; i++) { const ms = startMs + i * resSeconds * 1000; const date = new Date(ms); labels.push(to12hr(date.getHours(), date.getMinutes(), date.getSeconds())); }
        return { label: lbl, sub: d.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), interval: resSeconds, startMs, endMs, isDayTab: true, nBars, labels, resSeconds };
    }
    if (graphTab === 'month') {
        let base = new Date(now.getFullYear(), now.getMonth() + graphMonthNav, 1);
        let startMonth = base.getMonth() - 1; let startYear = base.getFullYear(); if (startMonth < 0) { startMonth = 11; startYear--; }
        const start = new Date(startYear, startMonth, 25); const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
        const days = Math.ceil((end - start) / 86400000); const labels = []; for (let i = 0; i < days; i++) { const d = new Date(start.getTime() + i * 86400000); labels.push(`${d.getDate()}/${d.getMonth()+1}`); }
        return { label: `${start.toLocaleDateString('en-PK', {month:'short', day:'numeric'})} \u2013 ${end.toLocaleDateString('en-PK', {month:'short', day:'numeric', year:'numeric'})}`, interval: 3600, isDayTab: false, nBars: days, startMs: start.getTime(), endMs: end.getTime(), labels: labels, month: start.getMonth(), year: start.getFullYear(), isMonthBilling: true, resSeconds: 3600 };
    }
    if (graphTab === 'year') {
        const y = now.getFullYear() + graphYearNav; const start = new Date(y - 1, 11, 25); const end = new Date(y, 11, 31, 23, 59, 59);
        return { label: String(y), interval: 3600, isYearly: true, nBars: 12, startMs: start.getTime(), endMs: end.getTime(), labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], year: y, isYearBilling: true, resSeconds: 3600 };
    }
    return { label:'All Time', sub:null, interval:86400*7, isTotal:true, nBars:0, startMs: new Date(2024,0,1).getTime(), endMs: now.getTime(), labels:[] };
}

function _renderGNavBar() {
    const wrap = document.getElementById('graph-nav-bar'); if (!wrap) return; if (graphTab === 'total') { wrap.innerHTML = ''; return; }
    const nav = _gNavInfo(); const canFwd = (graphTab === 'day' && graphDateNav < 0) || (graphTab === 'month' && nav.endMs < Date.now()) || (graphTab === 'year' && graphYearNav < 0);
    wrap.innerHTML = `<button class="graph-nav-btn" id="gnav-prev">\u2039</button><div class="graph-nav-center"><div class="graph-nav-label">${nav.label}</div>${nav.sub?`<div class="graph-nav-sub">${nav.sub}</div>`:''}</div><button class="graph-nav-btn" id="gnav-next" style="opacity:${canFwd?1:0.3}">\u203a</button>`;
    document.getElementById('gnav-prev').addEventListener('click', () => { if (graphTab === 'day') graphDateNav--; else if (graphTab === 'month') graphMonthNav--; else graphYearNav--; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGNavBar(); _loadAndDraw(); });
    document.getElementById('gnav-next').addEventListener('click', () => { if (!canFwd) return; if (graphTab === 'day') graphDateNav++; else if (graphTab === 'month') graphMonthNav++; else graphYearNav++; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGNavBar(); _loadAndDraw(); });
}

function hideTooltip() { const tooltip = document.getElementById('graph-tooltip'); if (tooltip) { tooltip.style.display = 'none'; tooltip.classList.remove('pinned'); } tooltipPinned = false; }

function openGraphsPanel() {
    const p = document.getElementById('graphs-panel'); if (!p) return;
    if (navigator.userAgent.toLowerCase().includes('windows')) p.classList.add('fullscreen');
    p.classList.add('open');
    setTimeout(() => { renderGraphsPanel(); if (graphTab === 'day') startGraphsAutoRefresh(); }, 50);
}

function closeGraphsPanel() {
    const p = document.getElementById('graphs-panel'); if (p) p.classList.remove('open');
    hideTooltip(); graphZoomLevel = 1; graphPanOffset = 0; stopGraphsAutoRefresh();
}

function renderGraphsPanel() {
    if (graphIsRendering) return; graphIsRendering = true;
    try { _renderGFeedTabs(); _renderGTimeTabs(); _renderGNavBar(); _renderChartTypeToggle(); _loadAndDraw(); }
    catch(e) { console.warn('Graph render error:', e); } finally { graphIsRendering = false; }
}
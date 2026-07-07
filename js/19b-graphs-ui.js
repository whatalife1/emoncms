// ─── Graphs Panel - UI Rendering ────────────────────────────────────────────

let graphNeedsDayZoom = false;
let tooltipPinned = false;
let graphsAutoRefreshInterval = null;
let graphsLastUpdate = 0;

window.generateGraphReport = async function() {
    const nav = _gNavInfo();
    const isDay = graphTab === 'day';
    const isMonth = graphTab === 'month';
    const isYear = graphTab === 'year';

    if (!isDay && !isMonth && !isYear) {
        return { text: "Report only available for Day, Month or Year view.", html: "" };
    }

    const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
        const data = await fetchWithCache(feed.id, nav.startMs, nav.endMs);
        return { feed, data };
    });

    const results = await Promise.all(fetchPromises);
    const sums = {};
    const visualData = {}; 
    
    results.forEach(r => {
        const ds = r.feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
        const de = r.feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
        sums[r.feed.id] = {
            h24: sumByDay(r.data, 0, 24),
            day: sumByDay(r.data, ds, de),
            night: sumByDay(r.data, EXPORT_NIGHT_START, EXPORT_NIGHT_END)
        };
        
        if (isDay) {
            const hSum = new Array(24).fill(0), hCnt = new Array(24).fill(0);
            const local = getKarachiDate(nav.startMs);
            for (const [tsStr, val] of Object.entries(r.data)) {
                const l = getKarachiDate(parseInt(tsStr));
                if (l.year === local.year && l.month === local.month && l.day === local.day) {
                    hSum[l.hour] += val; hCnt[l.hour]++;
                }
            }
            const hArr = hSum.map((s, i) => hCnt[i] ? s/hCnt[i] : 0);
            visualData[r.feed.id] = { arr: hArr, max: Math.max(...hArr, 0) };
        } else {
            const dates = Object.keys(sums[r.feed.id].h24).sort();
            const dArr = dates.map(d => sums[r.feed.id].h24[d]);
            visualData[r.feed.id] = { arr: dArr, max: Math.max(...dArr, 0) };
        }
    });

    const blocks = ['_', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
    function makeSparkline(id) {
        const d = visualData[id];
        if (!d || d.max === 0) return ''.padEnd(isDay ? 24 : (isYear ? 12 : 30), '_') + '] max: 0';
        let str = '';
        d.arr.forEach(v => {
            if (v <= 0) str += '_';
            else {
                let idx = Math.ceil((v / d.max) * 8);
                str += blocks[Math.max(1, Math.min(8, idx))];
            }
        });
        const unit = isDay ? 'W' : 'kWh';
        return `${str}] max: ${Math.round(isDay ? d.max : d.max/1000)}${unit}`;
    }

    const solarF = EXPORT_FEEDS.find(f => f.isSolar);
    const breakerF = EXPORT_FEEDS.find(f => f.isBreaker);
    const reportDates = Object.keys(sums[solarF.id].h24).sort();
    const nightHoursPerDay = 15; // 5 PM to 8 AM
    
    // Calculate Total consumption (excluding Solar)
    const totalKwhCombined = EXPORT_FEEDS.reduce((sum, f) => {
        if (f.isSolar) return sum;
        return sum + (Object.values(sums[f.id].h24).reduce((a,b)=>a+b,0) / 1000);
    }, 0);
    
    // Calculate Day and Night totals for percentage calculations
    const totalDayKwh = EXPORT_FEEDS.reduce((sum, f) => {
        if (f.isSolar) return sum;
        return sum + (Object.values(sums[f.id].day).reduce((a,b)=>a+b,0) / 1000);
    }, 0);
    
    const totalNightKwh = EXPORT_FEEDS.reduce((sum, f) => {
        if (f.isSolar) return sum;
        return sum + (Object.values(sums[f.id].night).reduce((a,b)=>a+b,0) / 1000);
    }, 0);

    // --- Build Text Report (Tabular + Sparkline Aligned) ---
    let txt = `📄 Energy Usage Report: ${nav.label}\n`;
    txt += `Generated: ${new Date().toLocaleString()}\n\n`;
    txt += `Consumption Breakdown\n`;
    txt += `Appliance\tTotal (kWh)\tDay (kWh)\tDay %\tNight (kWh)\tNight %\tAvg Night (W)\tAvg/Day\t% of Total\n`;

    // --- Build HTML Report ---
    let html = `<div class="report-wrapper" style="background:var(--bg-panel); color:var(--text-main); border:1px solid var(--border); border-radius:10px; padding:10px; margin-top:20px;">`;
    html += `<h4 style="margin:0 0 10px 0; font-size:14px; border-bottom:1px solid var(--border); padding-bottom:5px;">Consumption Breakdown</h4>`;
    html += `<div class="table-scroll" style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace;">`;
    html += `<tr style="background:var(--bg-card);">
        <th style="border:1px solid var(--border); padding:6px; text-align:left;">Appliance</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Total (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Day (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Day %</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Night (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Night %</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Avg Night (W)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Avg/Day</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">% of Total</th>
    </tr>`;

    EXPORT_FEEDS.forEach(f => {
        const totalWh = Object.values(sums[f.id].h24).reduce((a,b)=>a+b,0);
        const dayWh = Object.values(sums[f.id].day).reduce((a,b)=>a+b,0);
        const nightWh = Object.values(sums[f.id].night).reduce((a,b)=>a+b,0);
        
        const totalKwh = totalWh / 1000;
        const dayKwh = dayWh / 1000;
        const nightKwh = nightWh / 1000;
        const avg = totalKwh / reportDates.length;
        const avgNightW = nightWh / (reportDates.length * nightHoursPerDay);
        
        // Calculate percentages based on TOTAL consumption (excluding Solar)
        const totalPct = totalKwhCombined > 0 ? (totalKwh / totalKwhCombined * 100).toFixed(1) : 0;
        const dayPct = (f.isSolar || totalKwhCombined === 0) ? '-' : (dayKwh / totalKwhCombined * 100).toFixed(1);
        const nightPct = (f.isSolar || totalKwhCombined === 0) ? '-' : (nightKwh / totalKwhCombined * 100).toFixed(1);
        
        // Tabular part for TXT
        txt += `${f.name}\t${totalKwh.toFixed(2)}\t${f.isSolar?'-':dayKwh.toFixed(2)}\t${f.isSolar?'-':dayPct + '%'}\t${f.isSolar?'-':nightKwh.toFixed(2)}\t${f.isSolar?'-':nightPct + '%'}\t${f.isSolar?'-':Math.round(avgNightW) + ' W'}\t${avg.toFixed(2)}\t${totalPct}%\n`;

        // Populate HTML Table
        let color = "var(--text-main)";
        if (f.isSolar) color = "var(--accent-solar)";
        else if (f.isBreaker) color = "#ef4444";
        
        html += `<tr>
            <td style="border:1px solid var(--border); padding:6px; font-weight:bold;">${f.name}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:${color};">${totalKwh.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${f.isSolar?'-':dayKwh.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${f.isSolar?'-':dayPct + '%'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${f.isSolar?'-':nightKwh.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${f.isSolar?'-':nightPct + '%'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${f.isSolar?'-':Math.round(avgNightW) + ' W'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right;">${avg.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right;">${totalPct}%</td>
        </tr>`;
    });

    // Add a summary row showing totals
    html += `<tr style="background:var(--bg-card); font-weight:bold;">
        <td style="border:1px solid var(--border); padding:6px;">TOTAL</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">${totalKwhCombined.toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${totalDayKwh.toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${(totalDayKwh / totalKwhCombined * 100).toFixed(1)}%</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${totalNightKwh.toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${(totalNightKwh / totalKwhCombined * 100).toFixed(1)}%</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">-</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">${(totalKwhCombined / reportDates.length).toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">100%</td>
    </tr>`;

    html += `</table></div>`;

    if (!isDay) {
        txt += `\nDaily Log (Solar/Grid)\n`;
        txt += `Date\tSolar (kWh)\tGrid (kWh)\tTotal (kWh)\n`;

        html += `<h4 style="margin:20px 0 10px 0; font-size:14px; border-bottom:1px solid var(--border); padding-bottom:5px;">Daily Log (Solar/Grid)</h4>`;
        html += `<div class="table-scroll" style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace;">`;
        html += `<tr style="background:var(--bg-card);"><th style="border:1px solid var(--border); padding:6px; text-align:left;">Date</th><th style="border:1px solid var(--border); padding:6px; text-align:right;">Solar (kWh)</th><th style="border:1px solid var(--border); padding:6px; text-align:right;">Grid (kWh)</th><th style="border:1px solid var(--border); padding:6px; text-align:right;">Total (kWh)</th></tr>`;
        reportDates.forEach(d => {
            const sol = (sums[solarF.id].h24[d]||0)/1000, grd = (sums[breakerF.id].h24[d]||0)/1000;
            txt += `${d.split('-').reverse().join('-')}\t${sol.toFixed(2)}\t${grd.toFixed(2)}\t${(sol+grd).toFixed(2)}\n`;
            html += `<tr><td style="border:1px solid var(--border); padding:6px;">${d.split('-').reverse().join('-')}</td><td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${sol.toFixed(2)}</td><td style="border:1px solid var(--border); padding:6px; text-align:right; color:#ef4444;">${grd.toFixed(2)}</td><td style="border:1px solid var(--border); padding:6px; text-align:right; font-weight:bold;">${(sol+grd).toFixed(2)}</td></tr>`;
        });
        html += `</table></div>`;
    }

    // Aligned visual part for TXT
    txt += `\n--------------------------------------------------------------------------------\n`;
    txt += `Visual Daily Summary (Aligned)\n`;
    txt += `--------------------------------------------------------------------------------\n`;
    EXPORT_FEEDS.forEach(f => {
        const totalWh = Object.values(sums[f.id].h24).reduce((a,b)=>a+b,0);
        const dayWh = Object.values(sums[f.id].day).reduce((a,b)=>a+b,0);
        const nightWh = Object.values(sums[f.id].night).reduce((a,b)=>a+b,0);
        const totalKwh = totalWh / 1000;
        const dayKwh = dayWh / 1000;
        const nightKwh = nightWh / 1000;
        const avg = totalKwh / reportDates.length;
        const avgNightW = nightWh / (reportDates.length * nightHoursPerDay);
        const totalPct = totalKwhCombined > 0 ? (totalKwh / totalKwhCombined * 100).toFixed(1) : 0;
        const dayPct = (f.isSolar || totalKwhCombined === 0) ? '-' : (dayKwh / totalKwhCombined * 100).toFixed(1);
        const nightPct = (f.isSolar || totalKwhCombined === 0) ? '-' : (nightKwh / totalKwhCombined * 100).toFixed(1);
        
        const rowName = f.name.substring(0,15).padEnd(16);
        const rowTot  = totalKwh.toFixed(2).padStart(8);
        const rowDay  = (f.isSolar ? "-" : dayKwh.toFixed(2)).padStart(8);
        const rowDayP = (f.isSolar ? "-" : dayPct + "%").padStart(8);
        const rowNgt  = (f.isSolar ? "-" : nightKwh.toFixed(2)).padStart(8);
        const rowNgtP = (f.isSolar ? "-" : nightPct + "%").padStart(8);
        const rowAnW  = (f.isSolar ? "-" : Math.round(avgNightW)).toString().padStart(8);
        const rowAvgD = avg.toFixed(2).padStart(8);
        const rowPct  = (totalPct + "%").padStart(8);
        
        txt += `${rowName}${rowTot}${rowDay}${rowDayP}${rowNgt}${rowNgtP}${rowAnW}${rowAvgD}${rowPct}\n`;
        txt += `                 [${makeSparkline(f.id)}\n`;
    });

    html += `</div>`;
    return { text: txt, html: html };
};

window.downloadDayGraphReport = async function() {
    // Try to get feedback button, fallback to report-txt button if header button is removed
    const btn = document.getElementById('btn-graph-report-txt') || document.getElementById('btn-graphs-report');
    const oldTxt = btn ? btn.textContent : ''; 
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    
    try {
        const report = await window.generateGraphReport();
        const blob = new Blob([report.text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.download = `Emon_Report_${graphTab}_${new Date().getTime()}.txt`;
        a.href = URL.createObjectURL(blob); a.click();
    } catch (e) { alert("Error: " + e.message); } 
    finally { if (btn) { btn.textContent = oldTxt; btn.disabled = false; } }
};

function _getLocalMidnight(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(); }

function startGraphsAutoRefresh() {
    if (graphsAutoRefreshInterval) clearInterval(graphsAutoRefreshInterval);
    if (graphTab === 'day') {
        graphsAutoRefreshInterval = setInterval(() => {
            const p = document.getElementById('graphs-panel');
            if (!p || !p.classList.contains('open')) { clearInterval(graphsAutoRefreshInterval); return; }
            if (!graphIsLoading && !graphIsPanning) _loadAndDraw();
        }, 60000);
    }
}

function stopGraphsAutoRefresh() { if (graphsAutoRefreshInterval) clearInterval(graphsAutoRefreshInterval); }

function _renderChartTypeToggle() {
    const existing = document.getElementById('chart-type-toggle'); if (existing) existing.remove();
    const card = document.querySelector('.graph-chart-card'); if (!card) return;
    const toggle = document.createElement('div'); toggle.id = 'chart-type-toggle';
    toggle.style.cssText = `position:absolute; top:8px; right:8px; z-index:15; display:flex; flex-direction:column; gap:4px; background: var(--bg-panel); padding: 4px; border-radius: 8px; box-shadow: -2px 2px 8px rgba(0,0,0,0.4);`;
    [{ type: 'line', label: 'Line' }, { type: 'bar', label: 'Bar' }, { type: 'hourly', label: 'Hourly' }].forEach(({ type, label }) => {
        const btn = document.createElement('button'); const active = graphChartType === type;
        btn.textContent = label; btn.style.cssText = `padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; width:auto; background:${active ? 'var(--bg-base)' : 'rgba(0,0,0,0.45)'}; border:1px solid ${active ? 'var(--border)' : 'transparent'}; color:var(--text-main); opacity:${active ? '1' : '0.55'}; font-weight:700;`;
        btn.addEventListener('click', () => { graphChartType = type; _renderChartTypeToggle(); _loadAndDraw(); });
        toggle.appendChild(btn);
    });
    card.appendChild(toggle);
}

function _renderGTimeTabs() {
    const wrap = document.getElementById('graph-time-tabs'); if (!wrap) return;
    wrap.innerHTML = ['day','month','year','total'].map(t => `<button class="gtime-tab${graphTab===t?' active':''}" data-gtab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
    wrap.querySelectorAll('.gtime-tab').forEach(b => {
        b.addEventListener('click', () => {
            graphTab = b.dataset.gtab; graphChartType = (graphTab === 'day') ? 'line' : 'bar';
            if (graphTab === 'day') startGraphsAutoRefresh(); else stopGraphsAutoRefresh();
            graphDateNav = 0; graphMonthNav = 0; graphYearNav = 0; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
            _renderGTimeTabs(); _renderGNavBar(); _renderChartTypeToggle(); _loadAndDraw();
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
        btn.addEventListener('click', () => { if (window.gridAllDisabled.has(f.key)) window.gridAllDisabled.delete(f.key); else if ((GRID_ALL_FEEDS.length - window.gridAllDisabled.size) > 1) window.gridAllDisabled.add(f.key); _renderGridAllToggles(); _loadAndDraw(); });
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
    const clearBtn = document.createElement('button'); clearBtn.textContent = 'Clear'; clearBtn.style.cssText = 'padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);';
    clearBtn.addEventListener('click', () => { window.graphOverlayAc = null; _renderOverlayToggles(); _loadAndDraw(); });
    container.appendChild(clearBtn);
    acs.forEach(t => {
        const active = window.graphOverlayAc === t.key;
        const btn = document.createElement('button'); btn.style.cssText = `padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer; border:1.5px solid ${t.color};background:${active ? t.color+'33' : 'transparent'}; color:${active ? t.color : 'var(--text-muted)'};opacity:${active ? '1' : '0.5'};`;
        btn.textContent = t.label; btn.addEventListener('click', () => { window.graphOverlayAc = t.key; _renderOverlayToggles(); _loadAndDraw(); });
        container.appendChild(btn);
    });
    const fTabs = document.getElementById('graph-feed-tabs'); if (fTabs) fTabs.parentNode.insertBefore(container, fTabs.nextSibling);
}

function _renderGFeedTabs() {
    const wrap = document.getElementById('graph-feed-tabs'); if (!wrap) return;
    wrap.innerHTML = [GRAPH_COMBINED, ...GRAPH_FEEDS].map(f => `<button class="gfeed-tab${graphFeedKey===f.key?' active':''}" data-gkey="${f.key}" style="${graphFeedKey===f.key?`border-color:${f.color};color:${f.color}`:''}">${f.label}</button>`).join('') + `<button class="gfeed-tab${graphFeedKey==='report'?' active':''}" data-gkey="report" style="${graphFeedKey==='report'?'border-color:#10b981;color:#10b981':''}">📄 Report</button>`;
    wrap.querySelectorAll('.gfeed-tab').forEach(b => { b.addEventListener('click', () => { graphFeedKey = b.dataset.gkey; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGFeedTabs(); _loadAndDraw(); }); });
    _renderGridAllToggles(); _renderOverlayToggles();
}

function _gNavInfo() {
    const now = new Date(); const to12hr = (h, m) => { const ampm = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; const mm = String(m).padStart(2, '0'); return `${hh}:${mm}${ampm}`; };
    if (graphTab === 'day') {
        const d = new Date(now); d.setDate(d.getDate() + graphDateNav); const startMs = _getLocalMidnight(d); const res = (graphChartType === 'hourly') ? 3600 : GRAPH_DAY_RESOLUTION_SECONDS;
        const labels = []; for (let i = 0; i < Math.ceil((24*3600)/res); i++) { const date = new Date(startMs + i*res*1000); labels.push(to12hr(date.getHours(), date.getMinutes())); }
        return { label: graphDateNav === 0 ? 'Today' : d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' }), sub: d.toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), interval: res, startMs, endMs: startMs + 24*3600*1000-1, isDayTab: true, nBars: Math.ceil((24*3600)/res), labels, resSeconds: res };
    }
    if (graphTab === 'month') {
        let base = new Date(now.getFullYear(), now.getMonth() + graphMonthNav, 1);
        let sM = base.getMonth() - 1; let sY = base.getFullYear(); if (sM < 0) { sM = 11; sY--; }
        const start = new Date(sY, sM, 25); const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
        const days = Math.ceil((end - start) / 86400000); const labels = []; for (let i = 0; i < days; i++) { const d = new Date(start.getTime() + i*86400000); labels.push(`${d.getDate()}/${d.getMonth()+1}`); }
        return { label: `${start.toLocaleDateString('en-PK',{month:'short',day:'numeric'})} - ${end.toLocaleDateString('en-PK',{month:'short',day:'numeric',year:'numeric'})}`, interval: 3600, isDayTab: false, nBars: days, startMs: start.getTime(), endMs: end.getTime(), labels, month: start.getMonth(), year: start.getFullYear(), isMonthBilling: true, resSeconds: 3600 };
    }
    if (graphTab === 'year') {
        const y = now.getFullYear() + graphYearNav; const start = new Date(y - 1, 11, 25); const end = new Date(y, 11, 31, 23, 59, 59);
        return { label: String(y), interval: 3600, isYearly: true, nBars: 12, startMs: start.getTime(), endMs: end.getTime(), labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], year: y, isYearBilling: true, resSeconds: 3600 };
    }
    return { label:'All Time', startMs: new Date(2024,0,1).getTime(), endMs: now.getTime(), labels:[] };
}

function _renderGNavBar() {
    const wrap = document.getElementById('graph-nav-bar'); if (!wrap || graphTab === 'total') return;
    const nav = _gNavInfo(); const canFwd = (graphTab === 'day' && graphDateNav < 0) || (graphTab === 'month' && nav.endMs < Date.now()) || (graphTab === 'year' && graphYearNav < 0);
    wrap.innerHTML = `<button class="graph-nav-btn" id="gnav-prev">\u2039</button><div class="graph-nav-center"><div class="graph-nav-label">${nav.label}</div>${nav.sub?`<div class="graph-nav-sub">${nav.sub}</div>`:''}</div><button class="graph-nav-btn" id="gnav-next" style="opacity:${canFwd?1:0.3}">\u203a</button>`;
    document.getElementById('gnav-prev').addEventListener('click', () => { if (graphTab === 'day') graphDateNav--; else if (graphTab === 'month') graphMonthNav--; else graphYearNav--; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGNavBar(); _loadAndDraw(); });
    document.getElementById('gnav-next').addEventListener('click', () => { if (canFwd) { if (graphTab === 'day') graphDateNav++; else if (graphTab === 'month') graphMonthNav++; else graphYearNav++; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGNavBar(); _loadAndDraw(); } });
}

function hideTooltip() { const t = document.getElementById('graph-tooltip'); if (t) { t.style.display = 'none'; t.classList.remove('pinned'); } tooltipPinned = false; }

function openGraphsPanel() {
    const p = document.getElementById('graphs-panel'); if (!p) return;
    if (navigator.userAgent.toLowerCase().includes('windows')) p.classList.add('fullscreen');
    p.classList.add('open');
    setTimeout(() => { renderGraphsPanel(); if (graphTab === 'day') startGraphsAutoRefresh(); }, 50);
}

function closeGraphsPanel() { const p = document.getElementById('graphs-panel'); if (p) p.classList.remove('open'); hideTooltip(); graphZoomLevel = 1; graphPanOffset = 0; stopGraphsAutoRefresh(); }

function renderGraphsPanel() {
    if (graphIsRendering) return; graphIsRendering = true;
    try { _renderGFeedTabs(); _renderGTimeTabs(); _renderGNavBar(); _renderChartTypeToggle(); _loadAndDraw(); }
    catch(e) { console.warn('Graph render error:', e); } finally { graphIsRendering = false; }
}
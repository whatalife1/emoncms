if (typeof graphIsLoading === 'undefined') window.graphIsLoading = false;
if (typeof graphDataCache === 'undefined') window.graphDataCache = null;
if (typeof graphTab === 'undefined') window.graphTab = 'day';
if (typeof graphFeedKey === 'undefined') window.graphFeedKey = 'solar';
if (typeof graphDateNav === 'undefined') window.graphDateNav = 0;
if (typeof graphMonthNav === 'undefined') window.graphMonthNav = 0;
if (typeof graphYearNav === 'undefined') window.graphYearNav = 0;
if (typeof graphChartType === 'undefined') window.graphChartType = 'line';
if (typeof graphZoomLevel === 'undefined') window.graphZoomLevel = 1;
if (typeof graphPanOffset === 'undefined') window.graphPanOffset = 0;
if (typeof graphIsRendering === 'undefined') window.graphIsRendering = false;
if (typeof graphIsPanning === 'undefined') window.graphIsPanning = false;
if (typeof window.gridAllDisabled === 'undefined') window.gridAllDisabled = new Set();
if (typeof window.graphOverlayAc === 'undefined') window.graphOverlayAc = null;

function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, dayAvgVal, dayTotalVal, nightAvgVal, nightTotalVal, unit, isKwh, currentTab, isCompact = false) {
    if (currentTab === 'month' || currentTab === 'year') { unit = 'kWh'; isKwh = true; }
    const lblLower = (label || '').toLowerCase();
    const isSolar = lblLower.includes('solar') && !lblLower.includes('grid');
    const isTemp = lblLower.includes('temp') || lblLower.includes('°c');
    const isWater = lblLower.includes('water') || lblLower.includes('tank');
    const isDay = currentTab === 'day';
    const hideNight = isSolar || isTemp || isWater;
    const peakLabel = isDay ? "Peak" : (currentTab === 'year' ? "Max Month" : "Max Day");
    const avgLabel  = isDay ? "Avg"  : (currentTab === 'month' ? "Daily Avg" : "Monthly Avg");
    let peakColor = accentColor; if (peakVal > 1500 && isDay && !isTemp) peakColor = '#ef4444';
    const fsMain = isCompact ? '12px' : '15px'; const fsLabel = isCompact ? '11px' : '13px';
    const boldStyle = `font-size: ${isCompact ? '10px' : '12px'}; font-weight: 900;`;
    
    let avgHtml = ''; 
    if (avgVal && avgVal > 0.01) { 
        const avgDisp = isTemp ? avgVal.toFixed(1) : (isDay ? Math.round(avgVal) : avgVal.toFixed(1)); 
        avgHtml = ` <span style="color:var(--border)">·</span> <span style="color:${accentColor}; ${boldStyle}">${avgLabel}: ${avgDisp} ${unit}</span>`; 
    }

    let dayHtml = '';
    if ((dayAvgVal && dayAvgVal > 0.01) || (dayTotalVal && dayTotalVal > 0.01)) {
        const dayAvgDisp = isDay ? Math.round(dayAvgVal) : dayAvgVal.toFixed(1);
        const dKwhDisp = dayTotalVal ? dayTotalVal.toFixed(1) + ' kWh ' : '';
        const dAvgUnit = isDay ? 'W' : 'kWh/d';
        dayHtml = `<span style="color:var(--accent-solar); ${boldStyle}">Day: ${dKwhDisp}(Avg: ${dayAvgDisp} ${dAvgUnit})</span>`;
    }

    let nightHtml = ''; 
    if (!hideNight && ((nightAvgVal && nightAvgVal > 0.01) || (nightTotalVal && nightTotalVal > 0.01))) { 
        const nightAvgDisp = isDay ? Math.round(nightAvgVal) : nightAvgVal.toFixed(1); 
        const nKwhDisp = nightTotalVal ? nightTotalVal.toFixed(1) + ' kWh ' : ''; 
        const nAvgUnit = isDay ? 'W' : 'kWh/d'; 
        nightHtml = `<span style="color:#c084fc; ${boldStyle}">Night: ${nKwhDisp}(Avg: ${nightAvgDisp} ${nAvgUnit})</span>`; 
    }

    let dayNightRow = '';
    if (dayHtml || nightHtml) {
        dayNightRow = `<div style="margin-top:2px; display:flex; gap:8px;">${dayHtml}${nightHtml}</div>`;
    }

    const mainDisplay = isKwh ? `${mainVal.toFixed(1)} kWh` : `${mainVal.toFixed(1)} ${unit}`;
    const peakDisp = isTemp ? peakVal.toFixed(1) : (isDay ? Math.round(peakVal).toLocaleString() : peakVal.toFixed(1));
    return `<div style="margin-bottom: 6px; line-height:1.2;"><div style="display:flex; align-items:center; gap:6px;"><span style="color:${accentColor}; font-size:${fsLabel}; font-weight:700;">${icon?icon+' ':''}${label}:</span><span style="color:var(--text-main); font-size:${fsMain}; font-weight:900;">${mainDisplay}</span></div><div style="color:var(--text-muted); font-size:11px; font-weight:600; margin-left: 1px; margin-top: 2px;"><div>(${peakLabel}: <span style="color:${peakColor}; ${boldStyle}">${peakDisp}</span> ${unit}${avgHtml})</div>${dayNightRow}</div></div>`;
}

function _pointsToBars(pts, nav, feedKey) {
    if (!pts || !pts.length) return [];
    
    if (nav.isMonthBilling) {
        const daily = {}; 
        for (let i = 0; i < pts.length; i++) { 
            const p = pts[i];
            if (p[1] == null) continue; 
            const pktDate = getKarachiDate(p[0]);
            const key = `${pktDate.year}-${String(pktDate.month).padStart(2,'0')}-${String(pktDate.day).padStart(2,'0')}`;
            daily[key] = (daily[key] || 0) + p[1]; 
        }
        const start = new Date(nav.startMs); 
        const days = Math.ceil((nav.endMs - nav.startMs) / 86400000); 
        const bars = [], labels = [];
        for (let i = 0; i < days; i++) { 
            const d = new Date(start.getTime() + i * 86400000); 
            const pktDate = getKarachiDate(d.getTime());
            labels.push(`${pktDate.day}/${pktDate.month}`); 
            const key = `${pktDate.year}-${String(pktDate.month).padStart(2,'0')}-${String(pktDate.day).padStart(2,'0')}`;
            bars.push(daily[key] || 0); 
        }
        nav.labels = labels; 
        nav.timeLabels = labels;
        nav.fullLabels = labels;
        nav.nBars = bars.length; 
        return bars;
    }
    
    if (nav.isYearBilling) {
        const monthly = new Array(12).fill(0);
        for (let i = 0; i < pts.length; i++) { 
            const p = pts[i];
            if (p[1] == null) continue; 
            const pktDate = getKarachiDate(p[0]);
            const month = pktDate.month - 1;
            monthly[month] = (monthly[month] || 0) + (p[1] / 1000);
        }
        nav.nBars = 12;
        return monthly;
    }
    
    const isAvg = feedKey && (
        feedKey.startsWith('temp') || 
        feedKey.startsWith('humidity') || 
        feedKey === 'invtemp' || 
        feedKey === 'water' || 
        feedKey === 'acvolts' ||
        feedKey === 'solarv' ||
        feedKey === 'solv'
    );
    const bars = Array(nav.nBars || 1).fill(0), counts = Array(nav.nBars || 1).fill(0);
    const resMs = nav.resSeconds * 1000;
    
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let idx;
        if (nav.isDayTab) {
            idx = Math.floor((p[0] - nav.startMs) / resMs);
        } else {
            const pktDate = getKarachiDate(p[0]);
            idx = nav.isYearly ? (pktDate.month - 1) : (pktDate.day - 1);
        }
        if (idx >= 0 && idx < bars.length) { 
            bars[idx] += isAvg ? p[1] : (p[1] * (nav.isDayTab ? 1 : (nav.interval/3600/1000))); 
            counts[idx]++; 
        }
    }
    return isAvg ? bars.map((v, i) => counts[i] > 0 ? v / counts[i] : 0) : bars;
}

async function _gFetch(feedId, startMs, endMs, interval) {
    if (!feedId) return []; 
    const useDelta = (window.graphTab === "month") ? 1 : 0;
    const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=${useDelta}&interval=${interval}`;
    try { 
        const text = await nativeFetch(url); 
        if (!text || text.startsWith('ERROR')) return []; 
        const root = JSON.parse(text); 
        const data = root[0]?.data || root; 
        return data.filter(p => p && p[1] != null); 
    } catch (e) { return []; }
}

function _calcStatsForRange(bars, startHour, endHour, nav, lastIdx) {
    if (!bars || bars.length === 0) return { avg: 0, activeAvg: 0, total: 0 };
    const isWrapping = startHour > endHour;
    let sum = 0, count = 0, activeCount = 0;
    for (let i = 0; i < Math.min(bars.length, lastIdx || bars.length); i++) {
        const val = bars[i];
        if (val == null || val === undefined) continue;
        
        // Calculate absolute hour of the day (0-23.99) in Pakistan Time
        const ts = nav.startMs + (i * nav.resSeconds * 1000);
        const isPkt = (new Date().getTimezoneOffset() === -300);
        const d = isPkt ? new Date(ts) : new Date(ts + 18000000);
        const h = isPkt ? (d.getHours() + d.getMinutes() / 60) : (d.getUTCHours() + d.getUTCMinutes() / 60);

        if (isWrapping ? (h >= startHour || h < endHour) : (h >= startHour && h < endHour)) {
            sum += val;
            count++;
            if (val > 10) activeCount++;
        }
    }
    
    const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
    let totalKwh = 0;
    if (isKwhView) {
        totalKwh = sum;
    } else {
        totalKwh = (sum * nav.resSeconds / 3600) / 1000;
    }

    return {
        avg: count > 0 ? sum / count : 0,
        activeAvg: activeCount > 0 ? sum / activeCount : (count > 0 ? sum / count : 0),
        total: totalKwh
    };
}

// Merge multiple raw point arrays by summing values at matching timestamps.
// Used for combined/summed feeds (e.g., Fridge 1 + Fridge 2).
function _mergePointsSum(ptsArrays) {
    const byTs = new Map();

    for (const pts of ptsArrays) {
        if (!Array.isArray(pts)) continue;

        for (const p of pts) {
            if (!p || p[1] == null || isNaN(p[1])) continue;

            const ts = p[0];
            byTs.set(ts, (byTs.get(ts) || 0) + p[1]);
        }
    }

    return Array.from(byTs.entries())
        .map(([ts, v]) => [ts, v])
        .sort((a, b) => a[0] - b[0]);
}

async function _loadAndDraw() {
    if (graphIsLoading) return; graphIsLoading = true; _showGraphLoading(true);
    const stat = document.getElementById('graph-stat'), canvas = document.getElementById('graph-canvas');
    if (!canvas || !stat) { graphIsLoading = false; return; }
    stat.textContent = 'Loading…'; hideTooltip();

    if (graphFeedKey === 'momentflow') {
        const nav = _gNavInfo();
        const allInspFeeds = [
            { key: 'solar',   name: 'Solar',        id: '499380', color: '#facc15' },
            { key: 'grid',    name: 'Grid',         id: '499374', color: '#ef4444' },
            { key: 'k15',     name: 'Kenwood 1.5T', id: '499362', color: '#38bdf8' },
            { key: 'k1',      name: 'Kenwood 1T',   id: '499364', color: '#7dd3fc' },
            { key: 'haier',   name: 'Haier 1T',     id: '499367', color: '#a5f3fc' },
            { key: 'fridge1', name: 'Fridge 1',     id: '499373', color: '#c084fc' },
            { key: 'fridge2', name: 'Fridge 2',     id: '541348', color: '#22d3ee' },
            { key: 'pc',      name: 'PC',           id: '499422', color: '#4ade80' },
            { key: 'motor',   name: 'Water Motor',  id: '542850', color: '#fbbf24' }
        ];

        const results = await Promise.all(
            allInspFeeds.map(f => _gFetch(f.id, nav.startMs, nav.endMs, nav.interval))
        );

        const multiData = allInspFeeds.map((f, i) => ({
            key: f.key,
            label: f.name,
            color: f.color,
            data: _pointsToBars(results[i], nav, f.key),
            rawPts: results[i]
        }));

        const bars1 = multiData.find(m => m.key === 'solar')?.data || [];
        const bars2 = multiData.find(m => m.key === 'grid')?.data || [];

        let maxV = 1;
        const allVals = multiData.flatMap(m => m.data).filter(v => v > 0);
        if (allVals.length) maxV = Math.max(...allVals) * 1.1;

        graphDataCache = { 
            bars1, bars2, 
            labels: nav.labels, 
            timeLabels: nav.timeLabels || nav.labels,
            fullLabels: nav.fullLabels || nav.labels,
            color1: '#facc15', color2: '#ef4444', unit: 'W', 
            isCombined: true, isMomentFlow: true, nav, 
            lastIdx: bars1.length, multiData, 
            minV: 0, maxV, range: maxV 
        };

        canvas.style.display = 'block';
        const reportDiv = document.getElementById('graph-report-view'); 
        if (reportDiv) reportDiv.style.display = 'none';

        _drawChart(canvas, bars1, bars2, nav.labels, '#facc15', '#ef4444', 'W', true, nav, bars1.length, multiData, 0, maxV, maxV);

        stat.innerHTML = `
            <div style="background:var(--bg-card); border:1px solid var(--accent-solar); border-radius:8px; padding:8px 12px; font-size:11px; color:var(--text-main); margin-bottom:6px;">
                <span style="color:var(--accent-solar); font-weight:800; font-size:12px;">🔍 Moment Flow Inspector Active</span><br>
                Scrub across the graph starting from <b>${window.graphDayStartHour}:00 AM</b>. The top Power Flow SVG diagram and tooltip show live Grid, Solar, Load, and Appliance Day/Night Watts & kWh.
            </div>
        `;
        _showGraphLoading(false); 
        graphIsLoading = false; 
        return;
    }

    if (graphFeedKey === 'report') {
        canvas.style.display = 'none';
        let reportDiv = document.getElementById('graph-report-view');
        if (!reportDiv) { reportDiv = document.createElement('div'); reportDiv.id = 'graph-report-view'; canvas.parentNode.insertBefore(reportDiv, canvas.nextSibling); }
        reportDiv.style.display = 'block';
        
        const nav = _gNavInfo();
        const displayLabel = (graphTab === 'day' && nav.sub) ? nav.sub : nav.label;
        stat.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-right:4px;">
            <span style="color:#10b981;font-weight:700;font-size:13px;">📄 Energy Usage Report &nbsp; <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">${displayLabel}</span></span>
            <div style="display:flex; gap:4px;">
              <button id="btn-graph-report-txt" style="background:#3b82f6; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save TXT</button>
              <button id="btn-graph-report-png" style="background:#10b981; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save PNG</button>
            </div>
          </div>
        `;
        setTimeout(() => {
          const bTxt = document.getElementById('btn-graph-report-txt');
          if (bTxt) bTxt.onclick = () => { if(window.downloadDayGraphReport) window.downloadDayGraphReport(); };
          const bPng = document.getElementById('btn-graph-report-png');
          if (bPng) bPng.onclick = () => { if(window.downloadDayGraphReportPng) window.downloadDayGraphReportPng(); };
        }, 50);

        try {
            const report = await window.generateGraphReport();
            const txt = report.text || ""; const html = report.html || "";
            reportDiv.innerHTML = html + `<pre style="white-space:pre; margin:20px 0 0 0; font-family:monospace; border-top:1px dashed var(--border); padding-top:20px; color:var(--text-muted); opacity:0.8;">${txt}</pre>`;
        } catch(e) { reportDiv.textContent = "Error: " + e.message; }
        _showGraphLoading(false); graphIsLoading = false; return;
    } else {
        canvas.style.display = 'block'; const reportDiv = document.getElementById('graph-report-view'); if (reportDiv) reportDiv.style.display = 'none';
    }

    try {
        const nav = _gNavInfo(); const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey);
        const isCombined = graphFeedKey === 'combined', isGridAll = graphFeedKey === 'gridall';
        const color1 = fA?.color || '#facc15', color2 = '#ef4444';
        const isTemp = graphFeedKey.startsWith('temp') || graphFeedKey === 'invtemp';
        const unit = isTemp ? '°C' : (graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' ? 'V' : 'W'));
        let pts1 = [], pts2 = [], bars1 = [], bars2 = [], multiData = null;

        if (isGridAll) {
            const visible = GRID_ALL_FEEDS.filter(f => !window.gridAllDisabled.has(f.key));
            multiData = [];
            const results = await Promise.all(visible.map(f => _gFetch(f.id, nav.startMs, nav.endMs, nav.interval)));
            visible.forEach((f, i) => multiData.push({ label: f.label, color: f.color, data: _pointsToBars(results[i], nav, f.key), rawPts: results[i] }));
        } else if (isCombined) {
            pts1 = await _gFetch(GRAPH_FEEDS.find(f => f.key === 'solar').id, nav.startMs, nav.endMs, nav.interval);
            pts2 = await _gFetch(GRAPH_FEEDS.find(f => f.key === 'grid').id, nav.startMs, nav.endMs, nav.interval);
            bars1 = _pointsToBars(pts1, nav, 'solar'); bars2 = _pointsToBars(pts2, nav, 'grid');
        } else {

        // ─── Others feed: compute from Solar + Grid - sum(appliances) ───
        if (graphFeedKey === 'others') {
            const applianceKeys = ['k15', 'k1', 'haier', 'fridge1', 'fridge2', 'pc', 'motor'];
            const feedKeys = ['solar', 'grid', ...applianceKeys];
            const fetchPromises = feedKeys.map(key => {
                const feed = GRAPH_FEEDS.find(f => f.key === key);
                return _gFetch(feed.id, nav.startMs, nav.endMs, nav.interval);
            });
            const results = await Promise.all(fetchPromises);
            
            // Align all data into perfectly timed bins before doing math
            const barsArrays = results.map((res, idx) => _pointsToBars(res, nav, feedKeys[idx]));
            const solarBars = barsArrays[0];
            const gridBars = barsArrays[1];
            
            const bars = new Array(nav.nBars).fill(null);
            
            // Calculate cutoff line so we don't draw into the future at 0W
            let computedLastIdx = nav.nBars;
            if (graphTab === 'day' && graphDateNav === 0) {
                computedLastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
            }
            computedLastIdx = Math.min(Math.max(0, computedLastIdx), nav.nBars);

            for (let i = 0; i < computedLastIdx; i++) {
                const solar = solarBars[i] || 0;
                const grid = gridBars[i] || 0;
                let sumAppliances = 0;
                for (let j = 2; j < barsArrays.length; j++) {
                    sumAppliances += barsArrays[j][i] || 0;
                }
                bars[i] = Math.max(0, solar + grid - sumAppliances);
            }

            
            const feed = GRAPH_FEEDS.find(f => f.key === 'others');
            const color1 = feed.color;
            const unit = 'W';
            const isCombined = false;

            const includeFridges = !!window.graphOthersIncludeFridges;
            const fridge1Idx = feedKeys.indexOf('fridge1');
            const fridge2Idx = feedKeys.indexOf('fridge2');
            const fridge1Bars = fridge1Idx >= 0 ? (barsArrays[fridge1Idx] || []) : [];
            const fridge2Bars = fridge2Idx >= 0 ? (barsArrays[fridge2Idx] || []) : [];

            let statBars = bars;
            let othersMultiData = null;
            let maskedFridge1 = [];
            let maskedFridge2 = [];

            if (includeFridges) {
                statBars = new Array(nav.nBars || bars.length).fill(0);
                maskedFridge1 = new Array(nav.nBars || bars.length).fill(0);
                maskedFridge2 = new Array(nav.nBars || bars.length).fill(0);

                for (let i = 0; i < computedLastIdx; i++) {
                    const ts = nav.startMs + (i * nav.resSeconds * 1000);
                    const pktDate = getKarachiDate(ts);
                    const h = pktDate.hour;
                    const isNight = h >= 17 || h < 8; // Night time: 5pm to 8am

                    let f1 = fridge1Bars[i] || 0;
                    let f2 = fridge2Bars[i] || 0;
                    
                    if (isNight) {
                        maskedFridge1[i] = f1;
                        maskedFridge2[i] = f2;
                        statBars[i] = (bars[i] || 0) + f1 + f2;
                    } else {
                        maskedFridge1[i] = 0;
                        maskedFridge2[i] = 0;
                        statBars[i] = (bars[i] || 0);
                    }
                }

                othersMultiData = [
                    { key: 'others',  label: 'Others',    color: feed.color, data: bars },
                    { key: 'fridge1', label: 'Fridge 1 (Night)', color: '#c084fc', data: maskedFridge1 },
                    { key: 'fridge2', label: 'Fridge 2 (Night)', color: '#22d3ee', data: maskedFridge2 }
                ];
            }

            const validBars = statBars.slice(0, computedLastIdx).filter(v => v != null);
            let maxV = validBars.length ? Math.max(...validBars, 1) * 1.1 : 1.1;

            if (includeFridges && othersMultiData) {
                const allLineVals = othersMultiData
                    .flatMap(m => (m.data || []).slice(0, computedLastIdx))
                    .filter(v => v != null && v > 0);

                if (allLineVals.length) {
                    maxV = Math.max(...allLineVals) * 1.1;
                }
            }

            // Calculate Cumulative/Incremental kWh for Others AND Fridges
            let cumOthers = [];
            let cumF1 = [];
            let cumF2 = [];
            let runOthers = 0, runF1 = 0, runF2 = 0;
            const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
            
            for (let i = 0; i < computedLastIdx; i++) {
                let valO = bars[i] || 0;
                let valF1 = includeFridges ? (maskedFridge1[i] || 0) : 0;
                let valF2 = includeFridges ? (maskedFridge2[i] || 0) : 0;
                
                if (!isKwhView) {
                    valO = valO * (nav.resSeconds / 3600) / 1000;
                    valF1 = valF1 * (nav.resSeconds / 3600) / 1000;
                    valF2 = valF2 * (nav.resSeconds / 3600) / 1000;
                }
                
                runOthers += valO;
                cumOthers.push(runOthers);

                if (includeFridges) {
                    runF1 += valF1;
                    cumF1.push(runF1);
                    runF2 += valF2;
                    cumF2.push(runF2);
                }
            }
            
            let maxCumKwh = cumOthers.length ? Math.max(...cumOthers, 0.1) : 0.1;
            if (includeFridges) {
                maxCumKwh = Math.max(maxCumKwh, (cumF1.length ? Math.max(...cumF1) : 0), (cumF2.length ? Math.max(...cumF2) : 0));
            }

            graphDataCache = {
                bars1: statBars, bars2: [],
                labels: nav.labels,
                timeLabels: nav.timeLabels || nav.labels,
                fullLabels: nav.fullLabels || nav.labels,
                color1, color2: null, unit, isCombined, nav, lastIdx: computedLastIdx,
                multiData: othersMultiData,
                minV: 0,
                maxV: maxV,
                range: maxV,
                barsTemp: cumOthers,
                tempMinV: 0, tempMaxV: maxCumKwh * 1.1, tempRange: maxCumKwh * 1.1,
                tempUnit: 'kWh', tempColor: color1, overlayLabel: includeFridges ? 'Others Cumul.' : 'Cumul. kWh',
                isDualY: true,
                barsTemp2: includeFridges ? cumF1 : null,
                tempColor2: '#c084fc', overlayLabel2: 'Fridge 1',
                barsTemp3: includeFridges ? cumF2 : null,
                tempColor3: '#22d3ee', overlayLabel3: 'Fridge 2',
                isMomentFlow: false,
                feedKey: 'others'
            };

            // Use line mode when showing multiple lines so bars do not overlap badly.
            const savedChartType = graphChartType;
            if (includeFridges) graphChartType = 'line';

            _drawChart(
                canvas,
                statBars,
                [],
                nav.labels,
                color1,
                null,
                unit,
                false,
                nav,
                computedLastIdx,
                othersMultiData,
                0,
                graphDataCache.maxV,
                graphDataCache.range,
                graphDataCache.barsTemp,
                graphDataCache.tempMinV,
                graphDataCache.tempMaxV,
                graphDataCache.tempRange,
                graphDataCache.tempUnit,
                graphDataCache.tempColor,
                graphDataCache.overlayLabel
            );

            graphChartType = savedChartType;

            const totalKwh = validBars.reduce((a, b) => a + (b || 0), 0) * (nav.resSeconds / 3600) / 1000;
            const peak = validBars.length ? Math.max(...validBars, 0) : 0;
            const avg = validBars.length > 0 ? validBars.reduce((a, b) => a + (b || 0), 0) / validBars.length : 0;

            let dAv = null, dTt = null, nAv = null, nTt = null;

            if (graphTab === 'day') {
                const ds = _calcStatsForRange(statBars, 8, 17, nav, computedLastIdx);
                dAv = ds.activeAvg; dTt = ds.total;

                const ns = _calcStatsForRange(statBars, 17, 8, nav, computedLastIdx);
                nAv = ns.activeAvg; nTt = ns.total;
            } else if (graphTab === 'month' || graphTab === 'year') {
                let dayTot = 0, nightTot = 0;
                const length = results[0] ? results[0].length : 0;

                for (let i = 0; i < length; i++) {
                    const ts = results[0][i] ? results[0][i][0] : null;

                    if (ts !== null) {
                        const solarVal = results[0][i][1] || 0;
                        const gridVal = results[1][i] ? results[1][i][1] : 0;

                        let appSum = 0;
                        for (let j = 2; j < results.length; j++) {
                            appSum += results[j][i] ? results[j][i][1] : 0;
                        }

                        let v = Math.max(0, solarVal + gridVal - appSum);

                        const pktDate = getKarachiDate(ts);
                        const h = pktDate.hour;
                        const isNight = h >= 17 || h < 8; // 5pm to 8am

                        if (includeFridges && isNight) {
                            const f1Val = (fridge1Idx >= 0 && results[fridge1Idx] && results[fridge1Idx][i])
                                ? (results[fridge1Idx][i][1] || 0)
                                : 0;

                            const f2Val = (fridge2Idx >= 0 && results[fridge2Idx] && results[fridge2Idx][i])
                                ? (results[fridge2Idx][i][1] || 0)
                                : 0;

                            v += Math.max(0, f1Val) + Math.max(0, f2Val);
                        }

                        if (v > 0) {
                            if (h >= 8 && h < 17) dayTot += v / 1000;
                            else nightTot += v / 1000;
                        }
                    }
                }

                const numDays = Math.max(1, nav.nBars || 1);
                dAv = dayTot / numDays; dTt = dayTot;
                nAv = nightTot / numDays; nTt = nightTot;
            }

            const othersLabel = includeFridges ? 'Others + Fridges (Night)' : 'Others';
            stat.innerHTML = _formatStatLine('💡', othersLabel, totalKwh, color1, peak, avg, dAv, dTt, nAv, nTt, unit, true, graphTab);

            _showGraphLoading(false);
            graphIsLoading = false;
            return;
        }

            // ─── Sum feeds (e.g., Fridges 1+2 combined) ───
            if (fA && fA.isSum && Array.isArray(fA.sumFeeds) && fA.sumFeeds.length) {
                const componentPts = await Promise.all(
                    fA.sumFeeds.map(key => {
                        const feed = GRAPH_FEEDS.find(gf => gf.key === key);
                        return _gFetch(feed ? feed.id : null, nav.startMs, nav.endMs, nav.interval);
                    })
                );
                pts1  = _mergePointsSum(componentPts);
                bars1 = _pointsToBars(pts1, nav, graphFeedKey);
            } else {
                pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval);
                bars1 = _pointsToBars(pts1, nav, graphFeedKey);
                if (['temp','temp2'].includes(graphFeedKey)) bars2 = _pointsToBars(await _gFetch(graphFeedKey==='temp'?'499429':'512474', nav.startMs, nav.endMs, nav.interval), nav, 'humidity');
            }
        }

        let barsTemp = []; 
        let ovAc = null;
        let tUnit = 'W';
        let tColor = '#38bdf8';
        let tLabel = 'AC';

        if (['temp','temp2'].includes(graphFeedKey) && window.graphOverlayAc) {
            ovAc = GRAPH_FEEDS.find(f => f.key === window.graphOverlayAc);
            barsTemp = _pointsToBars(await _gFetch(ovAc.id, nav.startMs, nav.endMs, nav.interval), nav, window.graphOverlayAc);
            tColor = ovAc ? ovAc.color : '#38bdf8';
            tLabel = ovAc ? ovAc.label : 'AC';
        }

        let lastIdx = bars1.length || multiData?.[0]?.data?.length || 0;
        if (graphTab === 'day' && graphDateNav === 0) {
            lastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
            lastIdx = Math.max(0, Math.min(lastIdx, nav.nBars));
        }

        let barsTemp2 = [];
        let tColor2 = '#ef4444';
        let tLabel2 = 'Grid Cumul.';

        // --- Calculate Cumulative kWh for ALL standard power feeds (Supports Dual Lines for Solar+Grid) ---
        if ((!isGridAll && fA && fA.isWatts && graphFeedKey !== 'others') || isCombined) {
            let cumulativeKwhArray = [];
            let runningTotal = 0;
            const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
            
            for (let i = 0; i < lastIdx; i++) {
                let val = bars1[i] || 0;
                if (!isKwhView) {
                    val = val * (nav.resSeconds / 3600) / 1000;
                }
                runningTotal += val;
                cumulativeKwhArray.push(runningTotal);
            }
            barsTemp = cumulativeKwhArray;
            tUnit = 'kWh';
            tColor = '#facc15';
            tLabel = 'Solar Cumul.';

            if (isCombined) {
                let cumulativeKwhArray2 = [];
                let runningTotal2 = 0;
                for (let i = 0; i < lastIdx; i++) {
                    let val2 = bars2[i] || 0;
                    if (!isKwhView) {
                        val2 = val2 * (nav.resSeconds / 3600) / 1000;
                    }
                    runningTotal2 += val2;
                    cumulativeKwhArray2.push(runningTotal2);
                }
                barsTemp2 = cumulativeKwhArray2;
            }
        }

        let maxV = 1, minV = 0; const all = (multiData?multiData.flatMap(m=>m.data):[...bars1,...bars2]).filter(v=>v>0);
        if (all.length) { maxV = Math.max(...all)*1.1; if(isTemp){ minV = Math.max(0, Math.min(...all)-5); maxV = Math.max(maxV, minV+10); } }

        const maxBT = barsTemp.length > 0 ? Math.max(...barsTemp, 0.1) : 1;
        const maxBT2 = barsTemp2.length > 0 ? Math.max(...barsTemp2, 0.1) : 1;
        const combinedMaxBT = Math.max(maxBT, maxBT2);

        graphDataCache = { 
            bars1, bars2, 
            labels: nav.labels, 
            timeLabels: nav.timeLabels || nav.labels,
            fullLabels: nav.fullLabels || nav.labels,
            color1, color2, unit, isCombined, nav, lastIdx, multiData, minV, maxV, range: maxV-minV, 
            barsTemp, tempMinV: 0, tempMaxV: combinedMaxBT * 1.1, tempRange: combinedMaxBT * 1.1, 
            tempUnit: tUnit, tempColor: tColor, overlayLabel: tLabel, isDualY: barsTemp.length > 0,
            barsTemp2, tempColor2: tColor2, overlayLabel2: tLabel2
        };
        _drawChart(canvas, bars1, bars2, nav.labels, color1, color2, unit, isCombined, nav, lastIdx, multiData, minV, maxV, maxV-minV, barsTemp, graphDataCache.tempMinV, graphDataCache.tempMaxV, graphDataCache.tempRange, graphDataCache.tempUnit, graphDataCache.tempColor, graphDataCache.overlayLabel);

        const isAvgF = isTemp || graphFeedKey === 'water' || graphFeedKey === 'acvolts';
        
        const calcDayNgt = (pts, feedKey = '') => {
            const isPc = feedKey === 'pc';
            const dayStart = isPc ? 6 : 8;
            const dayEnd = 17;
            let dayTot = 0, nightTot = 0;
            let dayCnt = 0, nightCnt = 0;
            for (const [ts, v] of pts) { 
                if (v != null && v > 0) {
                    const pktDate = getKarachiDate(ts);
                    const h = pktDate.hour;
                    if (h >= dayStart && h < dayEnd) {
                        dayTot += v / 1000;
                        dayCnt++;
                    } else {
                        nightTot += v / 1000;
                        nightCnt++;
                    }
                }
            }
            const numDays = Math.max(1, nav.nBars || 1);
            return { 
                dayAvg: (dayTot / numDays), 
                dayTotal: dayTot,
                nightAvg: (nightTot / numDays), 
                nightTotal: nightTot 
            };
        };
        
        const df = (graphTab === 'month' || graphTab === 'year') ? 1 : (nav.resSeconds / 3600) / 1000;
        
        if (isGridAll) {
            stat.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">${multiData.map(m => {
                const t = m.data.reduce((a,b,i)=>i<lastIdx?a+b:a,0) * df; 
                const pk = Math.max(...m.data, 0); 
                let av = null, dAv = null, dTt = null, nAv = null, nTt = null;
                const isSolar = m.label.toLowerCase() === 'solar';
                if (graphTab === 'month' || graphTab === 'year') { 
                    av = m.data.length > 0 ? t / m.data.length : 0; 
                    const dn = calcDayNgt(m.rawPts||[], m.key); 
                    dAv = dn.dayAvg; dTt = dn.dayTotal;
                    if (!isSolar) { nAv = dn.nightAvg; nTt = dn.nightTotal; } 
                } else if (graphTab === 'day') { 
                    const isPc = m.key === 'pc';
                    const ds = _calcStatsForRange(m.data, (isPc?6:8), 17, nav, lastIdx);
                    dAv = ds.activeAvg; dTt = ds.total;
                    const stats = _calcStatsForRange(m.data, (isSolar?5:0), (isSolar?17:24), nav, lastIdx);
                    av = isSolar ? stats.avg : stats.activeAvg;
                    if (!isSolar) { 
                        const ns = _calcStatsForRange(m.data, 17, (isPc?6:8), nav, lastIdx); 
                        nAv = ns.activeAvg; nTt = ns.total; 
                    } 
                } else { 
                    av = m.data.filter(v=>v>0).length > 0 ? t / m.data.filter(v=>v>0).length : 0; 
                }
                return _formatStatLine(null, m.label, t, m.color, pk, av, dAv, dTt, nAv, nTt, graphDataCache.unit, true, graphTab, true);
            }).join('')}</div>`;
        } else if (isCombined) {
            const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
            let total1, total2;
            if (isKwhView) {
                total1 = bars1.reduce((a, b) => a + b, 0);
                total2 = bars2.reduce((a, b) => a + b, 0);
            } else {
                total1 = bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
                total2 = bars2.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
            }
            const t1 = total1, t2 = total2;
            const p1 = Math.max(...bars1), p2 = Math.max(...bars2); 
            let a1, a2, d1 = null, dt1 = null, d2 = null, dt2 = null, n2 = null, nt2 = null;
            
            if (graphTab === 'month' || graphTab === 'year') { 
                a1 = bars1.length > 0 ? t1/bars1.length : 0; 
                a2 = bars2.length > 0 ? t2/bars2.length : 0; 
                const dn1 = calcDayNgt(pts1, 'solar'); d1 = dn1.dayAvg; dt1 = dn1.dayTotal;
                const dn2 = calcDayNgt(pts2, 'grid'); d2 = dn2.dayAvg; dt2 = dn2.dayTotal; n2 = dn2.nightAvg; nt2 = dn2.nightTotal;
            } else if (graphTab === 'day') { 
                const sd1 = _calcStatsForRange(bars1, 8, 17, nav, lastIdx); d1 = sd1.avg; dt1 = sd1.total;
                const sd2 = _calcStatsForRange(bars2, 8, 17, nav, lastIdx); d2 = sd2.activeAvg; dt2 = sd2.total;
                a1 = _calcStatsForRange(bars1, 5, 17, nav, lastIdx).avg; 
                const s2 = _calcStatsForRange(bars2, 0, 24, nav, lastIdx); 
                a2 = s2.activeAvg; 
                const sn2 = _calcStatsForRange(bars2, 17, 8, nav, lastIdx); 
                n2 = sn2.activeAvg; nt2 = sn2.total; 
            } else { 
                a1 = t1/bars1.filter(v=>v>0).length; 
                a2 = t2/bars2.filter(v=>v>0).length; 
            }
            stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, d1, dt1, null, null, unit, true, graphTab) + 
                             _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, d2, dt2, n2, nt2, unit, true, graphTab);
        } else {
            const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
            let total1;
            if (isKwhView) {
                total1 = bars1.reduce((a, b) => a + b, 0);
            } else {
                total1 = bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * (nav.resSeconds / 3600) / 1000;
            }
            const t1 = total1;
            const pk = Math.max(...bars1,0); 
            let av = null, dAv = null, dTt = null, nAv = null, nTt = null;
            const isPc = graphFeedKey === 'pc';
            
            if (graphTab === 'month' || graphTab === 'year') { 
                av = bars1.length > 0 ? t1 / bars1.length : 0; 
                const dn = calcDayNgt(pts1, graphFeedKey);
                dAv = dn.dayAvg; dTt = dn.dayTotal;
                if(graphFeedKey !== 'solar' && !isAvgF) { 
                    nAv = dn.nightAvg; nTt = dn.nightTotal; 
                } 
            } else if (graphTab === 'day' && !isTemp) { 
                const ds = _calcStatsForRange(bars1, (isPc?6:8), 17, nav, lastIdx);
                dAv = ds.activeAvg; dTt = ds.total;
                const stats = _calcStatsForRange(bars1, (graphFeedKey==='solar'?5:0), (graphFeedKey==='solar'?17:24), nav, lastIdx);
                av = (graphFeedKey==='solar') ? stats.avg : stats.activeAvg;
                if(graphFeedKey !== 'solar' && !isAvgF) { 
                    const ns = _calcStatsForRange(bars1, 17, (isPc?6:8), nav, lastIdx); 
                    nAv = ns.activeAvg; nTt = ns.total; 
                } 
            } else { 
                av = bars1.filter(v=>v>0).length > 0 ? t1 / bars1.filter(v=>v>0).length : 0; 
            }
            stat.innerHTML = _formatStatLine('', fA?.label||graphFeedKey, t1, color1, pk, av, dAv, dTt, nAv, nTt, unit, !isAvgF, graphTab);
        }
    } catch (e) { 
        stat.textContent = 'Error: ' + e.message; 
        console.error('Graph error:', e);
    }
    finally { graphIsLoading = false; _showGraphLoading(false); }
}

function _showGraphLoading(s) { 
    const c = document.querySelector('.graph-chart-card'); 
    if (!c) return; 
    let o = document.getElementById('graph-loading-overlay'); 
    if (s) { 
        if (!o) { 
            o = document.createElement('div'); 
            o.id = 'graph-loading-overlay'; 
            o.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:20;display:flex;align-items:center;justify-content:center;border-radius:10px;pointer-events:none;`; 
            o.innerHTML = `<div style="color:#fff;font-size:14px;font-weight:700;">⏳ Loading...</div>`; 
            c.appendChild(o); 
        } 
        o.style.display = 'flex'; 
    } else if (o) o.style.display = 'none'; 
}

window._loadAndDraw = _loadAndDraw;
window._gFetch = _gFetch;
window._pointsToBars = _pointsToBars;

// ─── Others: optional Fridge 1 + Fridge 2 overlay ──────────────────────────
if (typeof window.graphOthersIncludeFridges === 'undefined') {
    window.graphOthersIncludeFridges = false;
}

try {
    if (localStorage.getItem('graphOthersIncludeFridges') !== null) {
        window.graphOthersIncludeFridges =
            localStorage.getItem('graphOthersIncludeFridges') === 'true';
    }
} catch (e) {}

function _renderOthersFridgeToggle() {
    const existing = document.getElementById('others-fridge-toggle');
    if (existing) existing.remove();

    const currentFeed = (typeof graphFeedKey !== 'undefined')
        ? graphFeedKey
        : window.graphFeedKey;

    if (currentFeed !== 'others') return;

    const feedTabs = document.getElementById('graph-feed-tabs');
    if (!feedTabs || !feedTabs.parentNode) return;

    const on = !!window.graphOthersIncludeFridges;

    const getFeedColor = function (key, fallback) {
        try {
            const feeds = (typeof GRAPH_FEEDS !== 'undefined')
                ? GRAPH_FEEDS
                : window.GRAPH_FEEDS;

            if (!feeds) return fallback;

            const feed = feeds.find(function (f) {
                return f.key === key;
            });

            return feed && feed.color ? feed.color : fallback;
        } catch (e) {
            return fallback;
        }
    };

    const othersColor = getFeedColor('others', '#f59e0b');
    const fridge1Color = getFeedColor('fridge1', '#c084fc');
    const fridge2Color = getFeedColor('fridge2', '#22d3ee');

    const wrap = document.createElement('div');
    wrap.id = 'others-fridge-toggle';
    wrap.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'gap:6px',
        'align-items:center',
        'padding:0 0 8px',
        'flex-shrink:0'
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = [
        'display:flex',
        'gap:8px',
        'align-items:center',
        'justify-content:center',
        'flex-wrap:wrap'
    ].join(';');

    const btn = document.createElement('button');
    btn.style.cssText = [
        'padding:5px 12px',
        'border-radius:20px',
        'font-size:11px',
        'font-weight:800',
        'cursor:pointer',
        'border:1.5px solid #c084fc',
        'background:' + (on ? 'rgba(192,132,252,0.18)' : 'transparent'),
        'color:' + (on ? '#c084fc' : 'var(--text-muted)'),
        'opacity:' + (on ? '1' : '0.75'),
        'width:auto'
    ].join(';');

    btn.textContent = on ? '🧊 Fridges: Added (Night)' : '🧊 Add Fridges (Night)';

    btn.addEventListener('click', function () {
        window.graphOthersIncludeFridges = !window.graphOthersIncludeFridges;

        try {
            localStorage.setItem(
                'graphOthersIncludeFridges',
                window.graphOthersIncludeFridges ? 'true' : 'false'
            );
        } catch (e) {}

        if (typeof _renderOthersFridgeToggle === 'function') {
            _renderOthersFridgeToggle();
        }

        if (typeof _loadAndDraw === 'function') {
            _loadAndDraw();
        }
    });

    const hint = document.createElement('span');
    hint.style.cssText = 'font-size:10px;color:var(--text-muted);';
    hint.textContent = on
        ? 'Stats show combined Others + Fridges (Night only).'
        : 'Add Fridge 1 + Fridge 2 (Night only) to the Others graph.';

    row.appendChild(btn);
    row.appendChild(hint);
    wrap.appendChild(row);

    if (on) {
        const legend = document.createElement('div');
        legend.id = 'others-fridge-legend';
        legend.style.cssText = [
            'display:flex',
            'gap:12px',
            'flex-wrap:wrap',
            'justify-content:center',
            'align-items:center',
            'font-size:10px'
        ].join(';');

        const items = [
            { label: 'Others', color: othersColor },
            { label: 'Fridge 1', color: fridge1Color },
            { label: 'Fridge 2', color: fridge2Color }
        ];

        items.forEach(function (item) {
            const chip = document.createElement('span');
            chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';

            const dot = document.createElement('span');
            dot.style.cssText = [
                'width:10px',
                'height:10px',
                'border-radius:50%',
                'display:inline-block',
                'background:' + item.color,
                'box-shadow:0 0 6px ' + item.color + '66'
            ].join(';');

            const txt = document.createElement('span');
            txt.style.cssText = 'font-weight:800;color:var(--text-main);';
            txt.textContent = item.label;

            chip.appendChild(dot);
            chip.appendChild(txt);
            legend.appendChild(chip);
        });

        wrap.appendChild(legend);
    }

    feedTabs.parentNode.insertBefore(wrap, feedTabs);
}

window._renderOthersFridgeToggle = _renderOthersFridgeToggle;


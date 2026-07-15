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

function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, nightAvgVal, nightTotalVal, unit, isKwh, currentTab, isCompact = false) {
    if (currentTab === 'month' || currentTab === 'year') { unit = 'kWh'; isKwh = true; }
    const lblLower = (label || '').toLowerCase();
    const isSolar = lblLower.includes('solar') && !lblLower.includes('grid');
    const isTemp = lblLower.includes('temp') || lblLower.includes('\u00b0c');
    const isWater = lblLower.includes('water') || lblLower.includes('tank');
    const isDay = currentTab === 'day';
    // ✅ FIX: Remove 'month' from hideNight so night info appears on Month view
    const hideNight = isSolar || isTemp || isWater;
    const peakLabel = isDay ? "Peak" : (currentTab === 'year' ? "Max Month" : "Max Day");
    const avgLabel  = isDay ? "Avg"  : (currentTab === 'month' ? "Daily Avg" : "Monthly Avg");
    let peakColor = accentColor; if (peakVal > 1500 && isDay && !isTemp) peakColor = '#ef4444';
    const fsMain = isCompact ? '12px' : '15px'; const fsLabel = isCompact ? '11px' : '13px';
    const boldStyle = `font-size: ${isCompact ? '10px' : '12px'}; font-weight: 900;`;
    let avgHtml = ''; if (avgVal && avgVal > 0.01) { const avgDisp = isTemp ? avgVal.toFixed(1) : (isDay ? Math.round(avgVal) : avgVal.toFixed(1)); avgHtml = ` <span style="color:var(--border)">\u00b7</span> <span style="color:${accentColor}; ${boldStyle}">${avgLabel}: ${avgDisp} ${unit}</span>`; }
    let nightHtml = ''; if (!hideNight && (nightAvgVal > 0.01 || (nightTotalVal && nightTotalVal > 0.01))) { 
        const nightAvgDisp = isDay ? Math.round(nightAvgVal) : nightAvgVal.toFixed(1); 
        const nKwhDisp = nightTotalVal ? nightTotalVal.toFixed(1) + ' kWh ' : ''; 
        const nAvgUnit = isDay ? 'W' : 'kWh/d'; 
        nightHtml = `<span style="color:#c084fc; ${boldStyle}">Night: ${nKwhDisp}(Avg: ${nightAvgDisp} ${nAvgUnit})</span>`; 
    }
    const mainDisplay = isKwh ? `${mainVal.toFixed(1)} kWh` : `${mainVal.toFixed(1)} ${unit}`;
    const peakDisp = isTemp ? peakVal.toFixed(1) : (isDay ? Math.round(peakVal).toLocaleString() : peakVal.toFixed(1));
    return `<div style="margin-bottom: 6px; line-height:1.2;"><div style="display:flex; align-items:center; gap:6px;"><span style="color:${accentColor}; font-size:${fsLabel}; font-weight:700;">${icon?icon+' ':''}${label}:</span><span style="color:var(--text-main); font-size:${fsMain}; font-weight:900;">${mainDisplay}</span></div><div style="color:var(--text-muted); font-size:11px; font-weight:600; margin-left: 1px; margin-top: 2px;"><div>(${peakLabel}: <span style="color:${peakColor}; ${boldStyle}">${peakDisp}</span> ${unit}${avgHtml})</div>${nightHtml?`<div style="margin-top:2px;">${nightHtml}</div>`:''}</div></div>`;
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
            daily[key] = (daily[key] || 0) + (p[1] / 1000); 
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
    
    const isAvg = feedKey && (feedKey.startsWith('temp') || feedKey === 'water' || feedKey === 'acvolts');
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
    const step = nav.resSeconds / 3600;
    for (let i = 0; i < Math.min(bars.length, lastIdx || bars.length); i++) {
        const val = bars[i];
        if (val === null || val === undefined) continue;
        const h = i * step;
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

async function _loadAndDraw() {
    if (graphIsLoading) return; graphIsLoading = true; _showGraphLoading(true);
    const stat = document.getElementById('graph-stat'), canvas = document.getElementById('graph-canvas');
    if (!canvas || !stat) { graphIsLoading = false; return; }
    stat.textContent = 'Loading\u2026'; hideTooltip();

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
            <button id="btn-graph-report-txt" style="background:#10b981; color:#000; border:none; padding:3px 10px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save TXT</button>
          </div>
        `;
        setTimeout(() => {
          const b = document.getElementById('btn-graph-report-txt');
          if (b) b.onclick = () => { if(window.downloadDayGraphReport) window.downloadDayGraphReport(); };
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
        const isTemp = graphFeedKey.startsWith('temp');
        const unit = isTemp ? '\u00b0C' : (graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' ? 'V' : 'W'));
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
            pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval);
            bars1 = _pointsToBars(pts1, nav, graphFeedKey);
            if (['temp','temp2'].includes(graphFeedKey)) bars2 = _pointsToBars(await _gFetch(graphFeedKey==='temp'?'499429':'512474', nav.startMs, nav.endMs, nav.interval), nav, 'humidity');
        }

        let barsTemp = []; 
        let ovAc = null;
        if (['temp','temp2'].includes(graphFeedKey) && window.graphOverlayAc) {
            ovAc = GRAPH_FEEDS.find(f => f.key === window.graphOverlayAc);
            barsTemp = _pointsToBars(await _gFetch(ovAc.id, nav.startMs, nav.endMs, nav.interval), nav, window.graphOverlayAc);
        }

        let lastIdx = bars1.length || multiData?.[0]?.data?.length || 0;
        if (graphTab === 'day' && graphDateNav === 0) {
            lastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
        }

        let maxV = 1, minV = 0; const all = (multiData?multiData.flatMap(m=>m.data):[...bars1,...bars2]).filter(v=>v>0);
        if (all.length) { maxV = Math.max(...all)*1.1; if(isTemp){ minV = Math.max(0, Math.min(...all)-5); maxV = Math.max(maxV, minV+10); } }

        const maxBT = barsTemp.length > 0 ? Math.max(...barsTemp, 1) : 1;
        graphDataCache = { 
            bars1, bars2, 
            labels: nav.labels, 
            timeLabels: nav.timeLabels || nav.labels,
            fullLabels: nav.fullLabels || nav.labels,
            color1, color2, unit, isCombined, nav, lastIdx, multiData, minV, maxV, range: maxV-minV, 
            barsTemp, tempMinV: 0, tempMaxV: maxBT * 1.1, tempRange: maxBT * 1.1, 
            tempUnit: 'W', tempColor: ovAc ? ovAc.color : '#38bdf8', overlayLabel: ovAc ? ovAc.label : 'AC', isDualY: barsTemp.length > 0 
        };
        _drawChart(canvas, bars1, bars2, nav.labels, color1, color2, unit, isCombined, nav, lastIdx, multiData, minV, maxV, maxV-minV, barsTemp, graphDataCache.tempMinV, graphDataCache.tempMaxV, graphDataCache.tempRange, graphDataCache.tempUnit, graphDataCache.tempColor, graphDataCache.overlayLabel);

        const isAvgF = isTemp || graphFeedKey === 'water' || graphFeedKey === 'acvolts';
        
        const calcNgt = (pts) => {
            const hrs = [17,18,19,20,21,22,23,0,1,2,3,4,5,6,7]; 
            let tot = 0;
            for (const [ts, v] of pts) { 
                if (v != null) {
                    const pktDate = getKarachiDate(ts);
                    if (hrs.includes(pktDate.hour)) {
                        tot += v / 1000;
                    }
                }
            }
            return { avg: tot / Math.max(1, nav.nBars || 1), total: tot };
        };
        
        const df = (graphTab === 'month' || graphTab === 'year') ? 1 : (nav.resSeconds / 3600) / 1000;
        
        if (isGridAll) {
            stat.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">${multiData.map(m => {
                const t = m.data.reduce((a,b,i)=>i<lastIdx?a+b:a,0) * df; 
                const pk = Math.max(...m.data, 0); 
                let av = null, nAv = null, nTt = null;
                const isSolar = m.label.toLowerCase() === 'solar';
                if (graphTab === 'month') { 
                    av = m.data.length > 0 ? t / m.data.length : 0; 
                    if (!isSolar) { 
                        const n = calcNgt(m.rawPts||[]); 
                        nAv = n.avg; 
                        nTt = n.total; 
                    } 
                } else if (graphTab === 'year') {
                    av = m.data.length > 0 ? t / m.data.length : 0;
                    if (!isSolar) { 
                        const n = calcNgt(m.rawPts||[]); 
                        nAv = n.avg; 
                        nTt = n.total; 
                    }
                } else if (graphTab === 'day') { 
                    const stats = _calcStatsForRange(m.data, (isSolar?5:0), (isSolar?17:24), nav, lastIdx);
                    av = isSolar ? stats.avg : stats.activeAvg;
                    if (!isSolar) { 
                        const n = _calcStatsForRange(m.data, 17, 8, nav, lastIdx); 
                        nAv = n.activeAvg; 
                        nTt = n.total; 
                    } 
                } else { 
                    av = m.data.filter(v=>v>0).length > 0 ? t / m.data.filter(v=>v>0).length : 0; 
                }
                return _formatStatLine(null, m.label, t, m.color, pk, av, nAv, nTt, graphDataCache.unit, true, graphTab, true);
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
            const p1 = Math.max(...bars1), p2 = Math.max(...bars2); let a1, a2, n2 = null, nt2 = null;
            if (graphTab === 'month') { 
                a1 = t1/bars1.length; 
                a2 = t2/bars2.length; 
                const n = calcNgt(pts2); 
                n2 = n.avg; 
                nt2 = n.total; 
            } else if (graphTab === 'year') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
                a2 = bars2.length > 0 ? t2 / bars2.length : 0;
                const n = calcNgt(pts2);
                n2 = n.avg;
                nt2 = n.total;
            } else if (graphTab === 'day') { 
                a1 = _calcStatsForRange(bars1, 5, 17, nav, lastIdx).avg; 
                const s2 = _calcStatsForRange(bars2, 0, 24, nav, lastIdx); 
                a2 = s2.activeAvg; 
                const sn2 = _calcStatsForRange(bars2, 17, 8, nav, lastIdx); 
                n2 = sn2.activeAvg; 
                nt2 = sn2.total; 
            } else { 
                a1 = t1/bars1.filter(v=>v>0).length; 
                a2 = t2/bars2.filter(v=>v>0).length; 
            }
            stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, null, null, unit, true, graphTab) + _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, n2, nt2, unit, true, graphTab);
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
            let av = null, nAv = null, nTt = null;
            
            if (graphTab === 'month') { 
                av = bars1.length > 0 ? t1 / bars1.length : 0; 
                if(graphFeedKey !== 'solar' && !isAvgF) { 
                    const n = calcNgt(pts1); 
                    nAv = n.avg; 
                    nTt = n.total; 
                } 
            } else if (graphTab === 'year') {
                av = bars1.length > 0 ? t1 / bars1.length : 0;
                if(graphFeedKey !== 'solar' && !isAvgF) { 
                    const n = calcNgt(pts1); 
                    nAv = n.avg; 
                    nTt = n.total; 
                } 
            } else if (graphTab === 'day' && !isTemp) { 
                const stats = _calcStatsForRange(bars1, (graphFeedKey==='solar'?5:0), (graphFeedKey==='solar'?17:24), nav, lastIdx);
                av = (graphFeedKey==='solar') ? stats.avg : stats.activeAvg;
                if(graphFeedKey !== 'solar' && !isAvgF) { 
                    const n = _calcStatsForRange(bars1,17,8,nav,lastIdx); 
                    nAv = n.activeAvg; 
                    nTt = n.total; 
                } 
            } else { 
                av = bars1.filter(v=>v>0).length > 0 ? t1 / bars1.filter(v=>v>0).length : 0; 
            }
            stat.innerHTML = _formatStatLine('', fA?.label||graphFeedKey, t1, color1, pk, av, nAv, nTt, unit, !isAvgF, graphTab);
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
            o.innerHTML = `<div style="color:#fff;font-size:14px;font-weight:700;">\u23f3 Loading...</div>`; 
            c.appendChild(o); 
        } 
        o.style.display = 'flex'; 
    } else if (o) o.style.display = 'none'; 
}
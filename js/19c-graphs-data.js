// ─── Graphs Panel - Data Layer ─────────────────────────────────────────────

// ---- Ensure all shared variables exist ----
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

// ---- Format stat line ----
function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, nightAvgVal, nightTotalVal, unit, isKwh, currentTab, isCompact = false) {
    if (currentTab === 'month' || currentTab === 'year') {
        unit = 'kWh';
        isKwh = true;
    }
    
    const lblLower = (label || '').toLowerCase();
    const isSolar = lblLower.includes('solar') && !lblLower.includes('grid');
    const isTemp = lblLower.includes('temp') || lblLower.includes('°c');
    const isWater = lblLower.includes('water') || lblLower.includes('tank');
    const isDay = currentTab === 'day';
    
    // Hide Night Avg for Solar, Temp, Water, and any view that isn't Day or Month
    const hideNight = isSolar || isTemp || isWater || (currentTab !== 'day' && currentTab !== 'month');
    
    const peakLabel = isDay ? "Peak" : "Max Day";
    const avgLabel  = isDay ? "Avg"  : (currentTab === 'month' ? "Daily Avg" : "Monthly Avg");

    let peakColor = accentColor;
    if (peakVal > 1500 && isDay && !isTemp) peakColor = '#ef4444';
    else if (peakVal > 1000 && isDay && !isTemp) peakColor = '#f97316';

    const fsMain = isCompact ? '12px' : '15px';
    const fsLabel = isCompact ? '11px' : '13px';
    const fsSub = isCompact ? '10px' : '11.5px';
    const boldStyle = `font-size: ${isCompact ? '10px' : '12px'}; font-weight: 900;`;

    let avgHtml = '';
    if (avgVal !== null && avgVal !== 0 && avgVal !== undefined && !isNaN(avgVal) && avgVal > 0.01) {
        const avgDisp = isTemp ? avgVal.toFixed(1) : (isDay ? Math.round(avgVal) : avgVal.toFixed(1));
        avgHtml = ` <span style="color:var(--border)">·</span> <span style="color:${accentColor}; ${boldStyle}">${avgLabel}: ${avgDisp} ${unit}</span>`;
    }

    let nightHtml = '';
    if (!hideNight && nightAvgVal !== null && nightAvgVal !== undefined && !isNaN(nightAvgVal) && nightAvgVal > 0.01) {
        const nightAvgDisp = isDay ? Math.round(nightAvgVal) : nightAvgVal.toFixed(1);
        const nKwhDisp = nightTotalVal ? nightTotalVal.toFixed(1) + ' kWh ' : '';
        const nAvgStr = isDay ? `(Avg: ${nightAvgDisp} W)` : `(Avg: ${nightAvgDisp} kWh/d)`;
        nightHtml = `<span style="color:#c084fc; ${boldStyle}">Night: ${nKwhDisp}${nAvgStr}</span>`;
    }

    const mainDisplay = isKwh ? `${mainVal.toFixed(1)} kWh` : `${mainVal.toFixed(1)} ${unit}`;
    const iconDisplay = icon && !icon.includes('span') ? `${icon} ` : '';

    const peakDisp = isTemp ? peakVal.toFixed(1) : (isDay ? Math.round(peakVal).toLocaleString() : peakVal.toFixed(1));

    return `<div style="margin-bottom: 6px; line-height:1.2;">
        <div style="display:flex; align-items:center; gap:6px;">
            ${icon ? `<span style="color:${accentColor}; font-size:${fsLabel}; font-weight:700;">${iconDisplay}${label}:</span>` : `<span style="color:${accentColor}; font-size:${fsLabel}; font-weight:700;">${label}:</span>`}
            <span style="color:var(--text-main); font-size:${fsMain}; font-weight:900;">${mainDisplay}</span>
        </div>
        <div style="color:var(--text-muted); font-size:${fsSub}; font-weight:600; margin-left: 1px; margin-top: 2px;">
            <div>(<span style="font-size:${fsSub}">${peakLabel}:</span> <span style="color:${peakColor}; ${boldStyle}">${peakDisp}</span> ${unit}${avgHtml})</div>
            ${nightHtml ? `<div style="margin-top: 2px;">${nightHtml}</div>` : ''}
        </div>
    </div>`;
}

// ---- Stats Range Calculation ----
function _calcStatsForRange(bars, startHour, endHour, nav, lastIdx) {
    if (!bars || bars.length === 0) return { avg: 0, total: 0 };
    const isWrapping = startHour > endHour;
    let sum = 0;
    let count = 0;
    const hourStep = nav.resSeconds / 3600;
    for (let i = 0; i < Math.min(bars.length, lastIdx || bars.length); i++) {
        const val = bars[i];
        if (val === 0 || val === null || val === undefined) continue;
        const hour = i * hourStep;
        if (isWrapping ? (hour >= startHour || hour < endHour) : (hour >= startHour && hour < endHour)) {
            sum += val;
            count++;
        }
    }
    return { avg: count > 0 ? sum / count : 0, total: (sum * nav.resSeconds / 3600) / 1000 };
}

// ---- Fetch helper ----
async function _gFetch(feedId, startMs, endMs, interval) {
    if (!feedId) return [];
    const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=0&interval=${interval}`;
    try {
        const text = await nativeFetch(url);
        if (!text || text.startsWith('ERROR')) return [];
        const root = JSON.parse(text);
        if (!Array.isArray(root) || !root.length) return [];
        const data = root[0]?.data || root;
        return data.filter(p => p && p[1] != null);
    } catch (e) { return []; }
}

// ---- Transform points to bars ----
function _pointsToBars(pts, nav, feedKey) {
    if (!pts || !pts.length) return [];

    if (nav.isMonthBilling) {
        const daily = {};
        for (const [ts, v] of pts) {
            if (v == null) continue;
            const d = new Date(ts);
            const key = d.toISOString().slice(0,10);
            daily[key] = (daily[key] || 0) + v / 1000;
        }
        const startDate = new Date(nav.startMs);
        const days = Math.ceil((nav.endMs - nav.startMs) / 86400000);
        const bars = [];
        const labels = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(startDate.getTime() + i * 86400000);
            const key = d.toISOString().slice(0,10);
            labels.push(`${d.getDate()}/${d.getMonth()+1}`);
            bars.push(daily[key] || 0);
        }
        nav.labels = labels;
        nav.nBars = bars.length;
        return bars;
    }

    if (nav.isYearly) {
        const monthlyTotals = Array(12).fill(0);
        for (const [ts, v] of pts) {
            if (v == null) continue;
            const d = new Date(ts);
            const month = d.getMonth();
            const day = d.getDate();
            let cycleMonth = month;
            if (day >= 25) {
                cycleMonth = (month + 1) % 12;
            }
            monthlyTotals[cycleMonth] += v / 1000;
        }
        const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        nav.labels = labels;
        nav.nBars = 12;
        return monthlyTotals;
    }

    const isAvgFeed = feedKey && (feedKey.startsWith('temp') || feedKey === 'water' || feedKey === 'acvolts' || feedKey === 'AC Volts');
    const bars = Array(nav.nBars || 1).fill(0);
    const counts = Array(nav.nBars || 1).fill(0);
    const now = new Date();
    const nowMs = now.getTime();

    for (const [ts, v] of pts) {
        let idx = -1;
        let factor = 1;
        if (nav.isDayTab) {
            idx = Math.floor((ts - nav.startMs) / (nav.resSeconds * 1000));
            factor = 1;
        } else {
            const d = new Date(ts);
            if (nav.isYearly) {
                idx = d.getMonth();
            } else if (nav.isTotal) {
                idx = 0;
            } else {
                if (d.getMonth() === nav.month && d.getFullYear() === nav.year) {
                    idx = d.getDate() - 1;
                }
            }
            if (!isAvgFeed) {
                const secondsInInterval = nav.interval;
                const intervalEndMs = ts + (secondsInInterval * 1000);
                let effectiveSeconds = secondsInInterval;
                if (ts < nowMs && intervalEndMs > nowMs) {
                    effectiveSeconds = (nowMs - ts) / 1000;
                }
                factor = (effectiveSeconds / 3600) / 1000;
            }
        }
        if (idx >= 0 && idx < bars.length) {
            bars[idx] += isAvgFeed ? v : (v * factor);
            counts[idx]++;
        }
    }
    const result = isAvgFeed ? bars.map((v, i) => counts[i] > 0 ? v / counts[i] : 0) : bars;

    if (!nav.isDayTab && !isAvgFeed) {
        const isTodayInView = (nav.isYearly && now.getFullYear() === nav.year) ||
            (!nav.isYearly && nav.month === now.getMonth() && nav.year === now.getFullYear());
        if (isTodayInView) {
            const todayIdx = nav.isYearly ? now.getMonth() : now.getDate() - 1;
            const todayMap = {
                'solar': 'Solar Today',
                'grid':  'Breaker Today',
                'haier': 'Haier 1Ton Today',
                'k1':    'Kenwood 1Ton Today',
                'k15':   'Kenwood 1.5Ton Today',
                'pc':    'PC Today',
                'fridge1': 'Fridge Today',
                'fridge2': 'Fridge2 Today'
            };
            const targetTodayName = todayMap[feedKey];
            if (targetTodayName && window.lastResultsMap) {
                const liveVal = window.lastResultsMap.get(targetTodayName)?.value;
                if (liveVal !== undefined && liveVal !== null) {
                    if (!nav.isYearly) result[todayIdx] = liveVal;
                }
            }
        }
    }
    return result;
}

// ---- Main load and draw ----
async function _loadAndDraw() {
    if (graphIsLoading) return;
    graphIsLoading = true;
    graphIsRendering = true;
    _showGraphLoading(true);
    const stat = document.getElementById('graph-stat');
    const canvas = document.getElementById('graph-canvas');
    if (!canvas || !stat) { graphIsLoading = false; graphIsRendering = false; return; }
    stat.textContent = 'Loading…';
    hideTooltip();

    try {
        const nav = _gNavInfo();
        const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey);
        const isCombined = graphFeedKey === 'combined';
        const isMultiLine = fA?.isMultiLine || false;
        const isGridAll = graphFeedKey === 'gridall';

        let pts1 = [];
        let pts2 = [];
        let bars1 = [];
        let bars2 = [];
        let multiData = null;

        let interval1 = nav.interval;
        let interval2 = nav.interval;
        if (graphTab === 'month' || graphTab === 'year') {
            interval1 = 3600;
            interval2 = 3600;
        }

        const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';

        if (isGridAll && isMultiLine) {
            const visibleFeeds = GRID_ALL_FEEDS.filter(f => !window.gridAllDisabled.has(f.key));
            multiData = [];
            const allPromises = visibleFeeds.map(f => _gFetch(f.id, nav.startMs, nav.endMs, interval1));
            const allResults = await Promise.all(allPromises);

            const navForBars = { ...nav };
            if (graphTab === 'month') navForBars.interval = 3600;
            if (graphTab === 'year') navForBars.isYearly = true;

            for (let i = 0; i < visibleFeeds.length; i++) {
                const feed = visibleFeeds[i];
                const pts = allResults[i] || [];
                const bars = _pointsToBars(pts, navForBars, feed.key);
                multiData.push({
                    key:    feed.key,
                    label:  feed.label,
                    color:  feed.color,
                    data:   bars,
                    rawPts: pts
                });
            }

            if (multiData.length > 0) {
                bars1 = multiData[0]?.data || [];
                pts1 = allResults[0] || [];
            }

            if (fA) fA.color = '#ff6b6b';

        } else if (isCombined) {
            const solarFeed = GRAPH_FEEDS.find(f => f.key === 'solar');
            const gridFeed  = GRAPH_FEEDS.find(f => f.key === 'grid');
            pts1 = await _gFetch(solarFeed.id, nav.startMs, nav.endMs, interval1);
            pts2 = await _gFetch(gridFeed.id,  nav.startMs, nav.endMs, interval2);
        } else if (isTempCombined) {
            const humId = graphFeedKey === 'temp' ? '499429' : '512474';
            pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, interval1);
            pts2 = await _gFetch(humId, nav.startMs, nav.endMs, interval2);
        } else {
            pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, interval1);
        }

        const navForBars = { ...nav };
        if (graphTab === 'month') navForBars.interval = 3600;
        if (graphTab === 'year') navForBars.isYearly = true;

        if (!isGridAll || !isMultiLine) {
            bars1 = _pointsToBars(pts1, navForBars, graphFeedKey);
            bars2 = (isCombined || isTempCombined) ? _pointsToBars(pts2, navForBars, isCombined ? 'grid' : 'humidity') : [];
        }

        // ---- AC overlay for Temp feeds ----
        const isTempFeed = ['temp', 'temp2'].includes(graphFeedKey);
        let barsTemp = [], tempUnit = 'W', tempMinV = 0, tempMaxV = 100, tempRange = 100, tempColor = '#38bdf8';
        let overlayLabel = 'AC';

        if (isTempFeed && window.graphOverlayAc) {
            const acKey = window.graphOverlayAc;
            const acFeed = GRAPH_FEEDS.find(f => f.key === acKey);
            const acFeedId = acFeed ? acFeed.id : '499367';
            tempColor = acFeed ? acFeed.color : '#38bdf8';
            overlayLabel = acFeed ? acFeed.name : 'AC';
            const acPts = await _gFetch(acFeedId, nav.startMs, nav.endMs, nav.interval);
            barsTemp = _pointsToBars(acPts, navForBars, acKey);

            const allAcs = barsTemp.filter(v => v !== 0 && v !== null && v !== undefined);
            if (allAcs.length > 0) {
                tempMinV = 0;
                tempMaxV = Math.max(...allAcs) * 1.1;
                tempRange = tempMaxV - tempMinV || 1;
            }
        }

        let labels = nav.labels;
        if (graphTab === 'month') labels = navForBars.labels || labels;
        if (graphTab === 'year') labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        let lastIdx = bars1.length || (multiData && multiData.length > 0 ? multiData[0].data.length : 0);
        if (graphTab === 'day' && graphDateNav === 0) {
            const expectedIdx = Math.floor((Date.now() - nav.startMs) / (nav.resSeconds * 1000)) + 1;
            let lastDataIdx = -1;
            const refData = multiData && multiData.length > 0 ? multiData[0].data : bars1;
            for (let i = refData.length - 1; i >= 0; i--) {
                if (refData[i] !== 0 && refData[i] !== null && refData[i] !== undefined) {
                    lastDataIdx = i;
                    break;
                }
            }
            if (lastDataIdx >= 0) {
                lastIdx = Math.min(expectedIdx, lastDataIdx + 1);
            } else {
                lastIdx = expectedIdx;
            }
            if (bars1.length > 0 && lastIdx > bars1.length) lastIdx = bars1.length;
            if (multiData && multiData.length > 0 && lastIdx > multiData[0].data.length) lastIdx = multiData[0].data.length;
        }

        let unit;
        const isTemp = graphFeedKey && (graphFeedKey.startsWith('temp') || graphFeedKey === 'temp' || graphFeedKey === 'temp2');
        if (graphTab === 'day') {
            unit = isTemp ? '°C' : graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') ? 'V' : 'W';
        } else {
            unit = isTemp ? '°C' : graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') ? 'V' : 'kWh';
        }

        const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15');
        const color2 = '#ef4444';

        // ---- Y-axis range ----
        let maxV, minV;
        if (multiData && multiData.length > 0) {
            let allVals = [];
            for (const line of multiData) {
                allVals = allVals.concat(line.data.filter(v => v !== 0 && v !== null && v !== undefined));
            }
            maxV = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 1;
            minV = 0;
        } else if (isTemp || graphFeedKey === 'temp' || graphFeedKey === 'temp2') {
            const allVals = [...bars1, ...bars2].filter(v => v !== 0 && v !== null && v !== undefined);
            if (allVals.length > 0) {
                const minVal = Math.min(...allVals);
                const maxVal = Math.max(...allVals);
                const rangeTmp = maxVal - minVal;
                const padding = Math.max(TEMP_RANGE_PADDING, rangeTmp * 0.1);
                minV = Math.floor(minVal - padding);
                maxV = Math.ceil(maxVal + padding);
                if (minV < 0) minV = 0;
                if (maxV > 100 && (graphFeedKey === 'temp' || graphFeedKey === 'temp2' || graphFeedKey === 'water')) maxV = 100;
                if (maxV - minV < 10) {
                    const mid = (maxV + minV) / 2;
                    minV = Math.floor(mid - 5); maxV = Math.ceil(mid + 5);
                    if (minV < 0) minV = 0;
                    if (maxV > 100) maxV = 100;
                }
            } else { minV = 0; maxV = 100; }
        } else {
            const allVals = [...bars1, ...bars2].filter(v => v !== 0 && v !== null && v !== undefined);
            maxV = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 1;
            minV = 0;
        }
        const range = maxV - minV || 1;

        graphDataCache = { 
            bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx, multiData, 
            minV, maxV, range,
            barsTemp, tempMinV, tempMaxV, tempRange, tempUnit, tempColor, overlayLabel,
            isDualY: barsTemp.length > 0
        };

        _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx, multiData, 
                   minV, maxV, range, barsTemp, tempMinV, tempMaxV, tempRange, tempUnit, tempColor, overlayLabel);

        // ---- STATS CALCULATION ----
        const isAvgFeed = isTemp || graphFeedKey === 'water' || graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts';
        let t1 = 0, t2 = 0, n1Val = null, n2Val = null, nightAvg1 = null, nightAvg2 = null;

        // Billing Cycle Night Helper
        const calcNightAvg = (pts) => {
            const nightHours = [17,18,19,20,21,22,23,0,1,2,3,4,5,6,7];
            let totalNightKwh = 0;
            for (const [ts, v] of pts) {
                if (v == null) continue;
                const d = new Date(ts);
                if (nightHours.includes(d.getHours())) {
                    totalNightKwh += v / 1000;
                }
            }
            const daysInCycle = nav.nBars || 1;
            return { avg: totalNightKwh / daysInCycle, total: totalNightKwh };
        };

        if (graphTab === 'month') {
            if (!isGridAll && !isTempFeed && graphFeedKey !== 'solar') {
                let n1Obj = calcNightAvg(pts1);
                nightAvg1 = n1Obj.avg; n1Val = n1Obj.total;
            }
            if (isCombined) {
                let n2Obj = calcNightAvg(pts2);
                nightAvg2 = n2Obj.avg; n2Val = n2Obj.total;
            }
        }

        let displayLabel = fA?.label || graphFeedKey;
        if (isGridAll) displayLabel = '⚡ All';

        if (isGridAll && multiData && multiData.length > 0) {
            const dayFactor = (nav.resSeconds / 3600) / 1000;
            let statHtml = '';
            for (const line of multiData) {
                const data = line.data || [];
                let total = 0, peak = 0, dayAvg = 0, nightAvgLine = 0, nightTot = 0;
                let dayCount = 0, nightCount = 0, validCount = 0;
                const hourStep = nav.resSeconds / 3600;
                
                for (let i = 0; i < data.length; i++) {
                    const val = data[i];
                    if (val === 0 || val === null || val === undefined) continue;
                    validCount++;
                    
                    if (graphTab === 'month' || graphTab === 'year') {
                        total += val;
                    } else if (nav.isDayTab) {
                        total += val;
                        const hour = i * hourStep;
                        if (hour >= 5 && hour < 17) {
                            dayAvg += val;
                            dayCount++;
                        } else if (hour >= 17 || hour < 8) {
                            nightAvgLine += val;
                            nightCount++;
                        }
                    } else {
                        total += val;
                    }
                    if (val > peak) peak = val;
                }
                
                let displayTotal = total, displayDayAvg = 0, displayNightAvg = 0, displayNightTotal = 0;
                let isKwh = false, displayUnit = unit;
                
                if (graphTab === 'month' || graphTab === 'year') {
                    displayUnit = 'kWh'; isKwh = true;
                    displayDayAvg = validCount > 0 ? total / validCount : 0;
                    if (graphTab === 'month' && line.rawPts && line.rawPts.length > 0) {
                        const nObj = calcNightAvg(line.rawPts);
                        displayNightTotal = nObj.total;
                        displayNightAvg = nObj.avg;
                    }
                } else if (nav.isDayTab) {
                    displayUnit = 'W'; isKwh = true;
                    displayTotal = total * dayFactor;
                    displayDayAvg = dayCount > 0 ? (dayAvg / dayCount) : 0;
                    displayNightAvg = nightCount > 0 ? (nightAvgLine / nightCount) : 0;
                    displayNightTotal = (nightAvgLine * nav.resSeconds / 3600) / 1000;
                } else {
                    displayUnit = 'kWh'; isKwh = true;
                    displayDayAvg = validCount > 0 ? total / validCount : 0;
                }
                
                statHtml += _formatStatLine(
                    `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${line.color};margin-right:2px;vertical-align:middle"></span>`,
                    line.label, displayTotal, line.color, peak, displayDayAvg, displayNightAvg, displayNightTotal, displayUnit, isKwh, graphTab, true
                );
            }
            stat.innerHTML = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 8px; max-height: 110px; overflow-y: auto; padding-right: 4px; padding-bottom: 4px;">${statHtml}</div>`;

        } else if (isCombined) {
            if (graphTab === 'month' || graphTab === 'year') {
                t1 = bars1.reduce((a, b) => a + b, 0);
                t2 = bars2.reduce((a, b) => a + b, 0);
            } else {
                const df = (nav.resSeconds / 3600) / 1000;
                t1 = bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * df;
                t2 = bars2.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * df;
            }

            const p1 = bars1.length > 0 ? Math.max(...bars1) : 0;
            const p2 = bars2.length > 0 ? Math.max(...bars2) : 0;
            let a1, a2, n2 = null;
            if (graphTab === 'month') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
                a2 = bars2.length > 0 ? t2 / bars2.length : 0;
                n2 = nightAvg2;
            } else if (graphTab === 'year') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
                a2 = bars2.length > 0 ? t2 / bars2.length : 0;
            } else {
                let a1s = nav.isDayTab ? _calcStatsForRange(bars1, 5, 17, nav, lastIdx) : {avg: (bars1.length > 0 ? t1 / bars1.filter(b => b > 0).length : 0), total:0};
                a1 = a1s.avg;
                let a2s = nav.isDayTab ? _calcStatsForRange(bars2, 0, 24, nav, lastIdx) : {avg: (bars2.length > 0 ? t2 / bars2.filter(b => b > 0).length : 0), total:0};
                a2 = a2s.avg;
                let n2s = nav.isDayTab ? _calcStatsForRange(bars2, 17, 8, nav, lastIdx) : {avg:0, total:0};
                n2 = n2s.avg; n2Val = n2s.total;
            }
            stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, null, null, unit, true, graphTab) +
                _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, n2, n2Val, unit, true, graphTab);
        } else {
            if (graphTab === 'month' || graphTab === 'year') {
                t1 = bars1.reduce((a, b) => a + b, 0);
            } else {
                const df = (nav.resSeconds / 3600) / 1000;
                t1 = isAvgFeed ? (bars1.slice(0, lastIdx).reduce((a, b) => a + b, 0) / lastIdx) : (bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * df);
            }

            const isSol = graphFeedKey === 'solar';
            const p1 = bars1.length > 0 ? Math.max(...bars1) : 0;
            let a1 = null, n1 = null;
            if (graphTab === 'month') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
                n1 = nightAvg1;
            } else if (graphTab === 'year') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
            } else {
                if (!isTemp && bars1.length > 0) {
                    if (nav.isDayTab) {
                        let a1s = _calcStatsForRange(bars1, isSol ? 5 : 0, isSol ? 17 : 24, nav, lastIdx);
                        a1 = a1s.avg;
                        if (!isSol && !isAvgFeed) {
                            let n1s = _calcStatsForRange(bars1, 17, 8, nav, lastIdx);
                            n1 = n1s.avg; n1Val = n1s.total;
                        }
                    } else {
                        a1 = t1 / bars1.filter(b => b > 0).length;
                    }
                }
            }
            stat.innerHTML = _formatStatLine('', displayLabel, t1, color1, p1, a1, n1, n1Val, unit, !isAvgFeed, graphTab);
        }
    } catch (e) {
        console.error('Graphs error:', e);
        if (stat) stat.textContent = 'Error: ' + e.message;
    } finally {
        graphIsLoading = false;
        graphIsRendering = false;
        _showGraphLoading(false);
    }
}

// ---- Expose globals ----
window._loadAndDraw = _loadAndDraw;
window._calcStatsForRange = _calcStatsForRange;
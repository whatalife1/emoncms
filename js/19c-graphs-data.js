// ─── Graphs Panel - Data Layer (Grid-All Multi-Line) ────────────────────

// ---- Ensure all shared variables exist (fallbacks) ----
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

// ---- Safety nets for missing functions ----
if (typeof _gNavInfo !== 'function') {
    window._gNavInfo = function() {
        const now = new Date();
        return {
            label: 'Today',
            sub: now.toDateString(),
            interval: 3600,
            startMs: new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(),
            endMs: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - 1,
            isDayTab: true,
            nBars: 24,
            labels: Array.from({length:24}, (_,i) => i+':00'),
            resSeconds: 3600
        };
    };
}
if (typeof _drawChart !== 'function') {
    window._drawChart = function(canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#facc15';
        ctx.font = '20px sans-serif';
        ctx.fillText('_drawChart missing', 20, 50);
    };
}
if (typeof _showGraphLoading !== 'function') {
    window._showGraphLoading = function(show) {};
}
if (typeof hideTooltip !== 'function') {
    window.hideTooltip = function() {};
}
if (typeof _calcAvgForRange !== 'function') {
    window._calcAvgForRange = function() { return null; };
}

// ---- Format stat line ----
function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, nightAvgVal, unit, isKwh, currentTab, isCompact = false) {
    // FORCE: Month view always uses kWh
    if (currentTab === 'month') {
        unit = 'kWh';
        isKwh = true;
    }
    
    const lblLower = (label || '').toLowerCase();
    const isSolar = lblLower.includes('solar') && !lblLower.includes('grid');
    const isTemp = lblLower.includes('temp') || lblLower.includes('°c');
    const isWater = lblLower.includes('water') || lblLower.includes('tank');
    const isDay = currentTab === 'day';
    // Only hide night for Solar, Temp, and Water
    const hideNight = isSolar || isTemp || isWater || !isDay;
    const peakLabel = isDay ? "Peak" : "Max Day";
    const avgLabel  = isDay ? "Avg"  : (currentTab === 'month' ? "Daily Avg" : "Monthly Avg");

    // Only show peak color highlighting for non-temp
    let peakColor = accentColor;
    if (peakVal > 1500 && isDay && !isTemp) peakColor = '#ef4444';
    else if (peakVal > 1000 && isDay && !isTemp) peakColor = '#f97316';

    const fsMain = isCompact ? '13px' : '17px';
    const fsLabel = isCompact ? '12px' : '14px';
    const fsSub = isCompact ? '11px' : '13px';
    const boldStyle = `font-size: ${isCompact ? '11px' : '15.5px'}; font-weight: 900;`;

    let avgHtml = '';
    if (avgVal !== null && avgVal !== 0 && avgVal !== undefined && !isNaN(avgVal) && avgVal > 0.01) {
        const avgDisp = isTemp ? avgVal.toFixed(1) : Math.round(avgVal);
        avgHtml = ` · <span style="color:${accentColor}; ${boldStyle}">${avgLabel}: ${avgDisp} ${unit}</span>`;
    }

    let nightHtml = '';
    if (!hideNight && nightAvgVal !== null && nightAvgVal !== 0 && nightAvgVal !== undefined && !isNaN(nightAvgVal) && nightAvgVal > 0.01) {
        const nightDisp = isTemp ? nightAvgVal.toFixed(1) : Math.round(nightAvgVal);
        nightHtml = ` · <span style="color:#bf7aff; ${boldStyle}">Night Avg: ${nightDisp} ${unit}</span>`;
    }

    const mainDisplay = isKwh ? `${mainVal.toFixed(1)} kWh` : `${mainVal.toFixed(1)} ${unit}`;

    // For Grid-All, don't show the icon as text (already have dot)
    const iconDisplay = icon && !icon.includes('span') ? `${icon} ` : '';

    const peakDisp = isTemp ? peakVal.toFixed(1) : Math.round(peakVal).toLocaleString();

    return `<div style="display:flex; align-items:center; gap:4px; font-size:${fsLabel}; font-weight:700; margin-bottom:${isCompact ? '0' : '5px'}; flex-wrap:wrap; line-height:1.2;">
        ${icon ? `<span style="color:${accentColor}">${iconDisplay}${label}:</span>` : `<span style="color:${accentColor}">${label}:</span>`}
        <span style="color:var(--text-main); font-size:${fsMain}; font-weight:900;">${mainDisplay}</span>
        <span style="color:var(--text-muted); font-size:${fsSub}; font-weight:600; margin-left:2px;">
            (<span style="font-size:${fsSub}">${peakLabel}:</span> <span style="color:${peakColor}; ${boldStyle}">${peakDisp}</span> ${unit}${avgHtml}${nightHtml})
        </span>
    </div>`;
}

// ---- Ensure GRAPH_FEEDS exists ----
if (typeof window.GRAPH_FEEDS === 'undefined') {
    window.GRAPH_FEEDS = [
        { key: 'solar',     name: 'Solar',          id: '499380', color: '#facc15', label: '☀ Solar',        isWatts: true },
        { key: 'grid',      name: 'Grid (Breaker)',  id: '499374', color: '#ef4444', label: '⚡ Grid',         isWatts: true },
        { key: 'acvolts',   name: 'AC Input Volts',  id: '499383', color: '#fb7185', label: '⚡ AC Volts',     isWatts: false },
        { key: 'temp',      name: 'Temperature',     id: '499428', color: '#10b981', label: '🌡 Temp 1',      isWatts: false, isTemp: true },
        { key: 'temp2',     name: 'Temperature 2',   id: '512473', color: '#34d399', label: '🌡 Temp 2',      isWatts: false, isTemp: true },
        { key: 'k15',       name: 'Kenwood 1.5T',    id: '499362', color: '#38bdf8', label: '❄ Kenwood 1.5T', isWatts: true },
        { key: 'k1',        name: 'Kenwood 1T',      id: '499364', color: '#7dd3fc', label: '❄ Kenwood 1T',   isWatts: true },
        { key: 'haier',     name: 'Haier 1T',        id: '499367', color: '#a5f3fc', label: '❄ Haier 1T',     isWatts: true },
        { key: 'fridge1',   name: 'Fridge 1',        id: '499373', color: '#c084fc', label: '🧊 Fridge 1',    isWatts: true },
        { key: 'fridge2',   name: 'Fridge 2',        id: '541348', color: '#e879f9', label: '🧊 Fridge 2',    isWatts: true },
        { key: 'pc',        name: 'PC',              id: '499422', color: '#4ade80', label: '💻 PC',          isWatts: true },
        { key: 'water',     name: 'Water Tank',      id: '499431', color: '#0ea5e9', label: '💧 Water',       isWatts: false },
        { key: 'gridall',   name: 'All',             id: null,     color: '#ff6b6b', label: '⚡ All',         isWatts: true, isMultiLine: true }
    ];
}
if (typeof window.GRAPH_COMBINED === 'undefined') {
    window.GRAPH_COMBINED = { key: 'combined', name: 'Solar + Grid', color: '#facc15', label: '⚡☀ Solar+Grid' };
}
if (typeof window.GRID_ALL_FEEDS === 'undefined') {
    window.GRID_ALL_FEEDS = [
        { key: 'solar',     id: '499380', color: '#facc15', label: 'Solar'        },
        { key: 'grid',      id: '499374', color: '#ef4444', label: 'Grid'         },
        { key: 'k15',       id: '499362', color: '#38bdf8', label: 'Kenwood 1.5T' },
        { key: 'k1',        id: '499364', color: '#7dd3fc', label: 'Kenwood 1T'   },
        { key: 'haier',     id: '499367', color: '#a5f3fc', label: 'Haier 1T'     },
        { key: 'fridge1',   id: '499373', color: '#c084fc', label: 'Fridge 1'     },
        { key: 'fridge2',   id: '541348', color: '#e879f9', label: 'Fridge 2'     },
        { key: 'pc',        id: '499422', color: '#4ade80', label: 'PC'           }
    ];
}
if (typeof window.TEMP_RANGE_PADDING === 'undefined') {
    window.TEMP_RANGE_PADDING = 5;
}
if (typeof window.PROXY_BASE === 'undefined') {
    window.PROXY_BASE = 'https://emon-proxy.new-life-786-786-786.workers.dev';
}
if (typeof window.GRAPH_DAY_RESOLUTION_SECONDS === 'undefined') {
    window.GRAPH_DAY_RESOLUTION_SECONDS = 120;
}

// ---- Helper: fetch ----
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

// ---- Convert points to bars ----
function _pointsToBars(pts, nav, feedKey) {
    if (!pts || !pts.length) return [];

    if (graphTab === 'month' && nav.interval === GRAPH_DAY_RESOLUTION_SECONDS) {
        const daily = {};
        for (const [ts, v] of pts) {
            if (v == null) continue;
            const dt = new Date(ts);
            const localHour = (dt.getUTCHours() + 5) % 24;
            if (localHour >= 5 && localHour < 19) {
                const dayKey = dt.toISOString().split('T')[0];
                daily[dayKey] = (daily[dayKey] || 0) + v;
            }
        }
        const intervalSeconds = GRAPH_DAY_RESOLUTION_SECONDS;
        const sortedDays = Object.keys(daily).sort();
        const bars = sortedDays.map(day => (daily[day] * intervalSeconds / 3600) / 1000);
        nav.labels = sortedDays.map(d => d.slice(5));
        nav.nBars = bars.length;
        return bars;
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

// ---- Calculate average for a specific hour range ----
function _calcAvgForRange(bars, startHour, endHour, nav, lastIdx) {
    if (!bars || bars.length === 0) return 0;
    const isWrapping = startHour > endHour;
    let total = 0;
    let count = 0;
    const hourStep = nav.resSeconds / 3600;
    
    for (let i = 0; i < Math.min(bars.length, lastIdx || bars.length); i++) {
        const val = bars[i];
        if (val === 0 || val === null || val === undefined) continue;
        const hour = i * hourStep;
        let inRange = false;
        if (isWrapping) {
            inRange = hour >= startHour || hour < endHour;
        } else {
            inRange = hour >= startHour && hour < endHour;
        }
        if (inRange) {
            total += val;
            count++;
        }
    }
    return count > 0 ? total / count : 0;
}

// ---- Main load & draw ----
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
        if (graphTab === 'month') {
            interval1 = GRAPH_DAY_RESOLUTION_SECONDS;
            interval2 = GRAPH_DAY_RESOLUTION_SECONDS;
        }

        // ---- Handle Grid-All Multi-Line ----
        // Check if this is a Temperature + Humidity request
        const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';

        if (isGridAll && isMultiLine) {
            // Only fetch feeds that are NOT disabled by the toggle
            const visibleFeeds = GRID_ALL_FEEDS.filter(
                f => !window.gridAllDisabled.has(f.key)
            );

            multiData = [];
            const allPromises = visibleFeeds.map(
                f => _gFetch(f.id, nav.startMs, nav.endMs, interval1)
            );
            const allResults = await Promise.all(allPromises);

            const navForBars = { ...nav };
            if (graphTab === 'month') navForBars.interval = GRAPH_DAY_RESOLUTION_SECONDS;

            for (let i = 0; i < visibleFeeds.length; i++) {
                const feed = visibleFeeds[i];
                const pts = allResults[i] || [];
                const bars = _pointsToBars(pts, navForBars, feed.key);
                multiData.push({
                    key:   feed.key,
                    label: feed.label,
                    color: feed.color,
                    data:  bars
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
        if (graphTab === 'month') navForBars.interval = GRAPH_DAY_RESOLUTION_SECONDS;

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

        // ---- Stop at last available data point ----
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

        // ---- Unit ----
        let unit;
        const isTemp = graphFeedKey && (graphFeedKey.startsWith('temp') || graphFeedKey === 'temp' || graphFeedKey === 'temp2');
        if (graphTab === 'day') {
            unit = isTemp ? '°C' : graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') ? 'V' : 'W';
        } else {
            unit = isTemp ? '°C' : graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') ? 'V' : 'kWh';
        }

        const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15');
        const color2 = '#ef4444';

        // Calculate Y-axis range
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

        // ---- Stats ----
        const isAvgFeed = isTemp || graphFeedKey === 'water' || graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts';
        let t1 = 0, t2 = 0;

        if (graphTab === 'month') {
            if (bars1.length > 0) t1 = bars1.reduce((a, b) => a + b, 0);
            if (isCombined && bars2.length > 0) t2 = bars2.reduce((a, b) => a + b, 0);
        } else {
            const dayFactor = (nav.resSeconds / 3600) / 1000;
            if (bars1.length > 0) {
                t1 = nav.isDayTab
                    ? (isAvgFeed ? (bars1.slice(0, lastIdx).reduce((a, b) => a + b, 0) / lastIdx) : (bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * dayFactor))
                    : (isAvgFeed ? (bars1.reduce((a, b) => a + b, 0) / bars1.filter(v => v !== 0).length) : bars1.reduce((a, b) => a + b, 0));
            }
            if (isCombined && bars2.length > 0) {
                t2 = nav.isDayTab ? (bars2.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * dayFactor) : bars2.reduce((a, b) => a + b, 0);
            }
        }

        let displayLabel = fA?.label || graphFeedKey;
        if (isGridAll) displayLabel = '⚡ All';

        // ---- Grid-All stat: one line per visible feed with Avg and Night Avg ----
        if (isGridAll && multiData && multiData.length > 0) {
            const dayFactor = (nav.resSeconds / 3600) / 1000;
            let statHtml = '';
            for (const line of multiData) {
                const data = line.data || [];
                let total = 0;
                let peak = 0;
                let dayAvg = 0;
                let nightAvg = 0;
                let dayCount = 0;
                let nightCount = 0;
                let validCount = 0;
                const hourStep = nav.resSeconds / 3600;
                
                // Calculate totals and averages
                for (let i = 0; i < data.length; i++) {
                    const val = data[i];
                    if (val === 0 || val === null || val === undefined) continue;
                    validCount++;
                    
                    if (graphTab === 'month') {
                        total += val;
                    } else if (nav.isDayTab) {
                        total += val;
                        // Day: 5am-5pm, Night: 5pm-8am
                        const hour = i * hourStep;
                        if (hour >= 5 && hour < 17) {
                            dayAvg += val;
                            dayCount++;
                        } else if (hour >= 17 || hour < 8) {
                            nightAvg += val;
                            nightCount++;
                        }
                    } else {
                        total += val;
                    }
                    if (val > peak) peak = val;
                }
                
                let displayTotal = total;
                let displayDayAvg = 0;
                let displayNightAvg = 0;
                let displayUnit = unit;
                let isKwh = false;
                
                if (graphTab === 'month') {
                    // Month view: already in kWh from _pointsToBars
                    displayUnit = 'kWh';
                    isKwh = true;
                    displayDayAvg = validCount > 0 ? total / validCount : 0;
                } else if (nav.isDayTab) {
                    // Day view: values are in Watts
                    displayUnit = 'W';
                    isKwh = true;
                    displayTotal = total * dayFactor;
                    displayDayAvg = dayCount > 0 ? (dayAvg / dayCount) : 0;
                    displayNightAvg = nightCount > 0 ? (nightAvg / nightCount) : 0;
                } else {
                    // Year/Total view: already in kWh
                    displayUnit = 'kWh';
                    isKwh = true;
                    displayDayAvg = validCount > 0 ? total / validCount : 0;
                }
                
                statHtml += _formatStatLine(
                    `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${line.color};margin-right:2px;vertical-align:middle"></span>`,
                    line.label,
                    displayTotal,
                    line.color,
                    peak,
                    displayDayAvg,
                    displayNightAvg,
                    displayUnit,
                    isKwh,
                    graphTab,
                    true
                );
            }
            stat.innerHTML = `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 8px; max-height: 110px; overflow-y: auto; padding-right: 4px; padding-bottom: 4px;">${statHtml}</div>`;

        } else if (isCombined) {
            const p1 = bars1.length > 0 ? Math.max(...bars1) : 0;
            const p2 = bars2.length > 0 ? Math.max(...bars2) : 0;
            let a1, a2, n2 = null;
            if (graphTab === 'month') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
                a2 = bars2.length > 0 ? t2 / bars2.length : 0;
            } else {
                a1 = nav.isDayTab ? _calcAvgForRange(bars1, 5, 17, nav, lastIdx) : (bars1.length > 0 ? t1 / bars1.filter(b => b > 0).length : 0);
                a2 = nav.isDayTab ? _calcAvgForRange(bars2, 0, 24, nav, lastIdx) : (bars2.length > 0 ? t2 / bars2.filter(b => b > 0).length : 0);
                n2 = nav.isDayTab ? _calcAvgForRange(bars2, 17, 8, nav, lastIdx) : null;
            }
            stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, null, unit, true, graphTab) +
                _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, n2, unit, true, graphTab);
        } else {
            const isSol = graphFeedKey === 'solar';
            const p1 = bars1.length > 0 ? Math.max(...bars1) : 0;
            let a1 = null, n1 = null;
            if (graphTab === 'month') {
                a1 = bars1.length > 0 ? t1 / bars1.length : 0;
            } else {
                if (!isTemp && bars1.length > 0) {
                    if (nav.isDayTab) {
                        a1 = _calcAvgForRange(bars1, isSol ? 5 : 0, isSol ? 17 : 24, nav, lastIdx);
                        // Only calculate night for non-solar, non-temp, non-water
                        if (!isSol && !isAvgFeed) {
                            n1 = _calcAvgForRange(bars1, 17, 8, nav, lastIdx);
                        }
                    } else {
                        a1 = t1 / bars1.filter(b => b > 0).length;
                    }
                }
            }
            stat.innerHTML = _formatStatLine('', displayLabel, t1, color1, p1, a1, n1, unit, !isAvgFeed, graphTab);
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

// ---- Expose globally ----
window._loadAndDraw = _loadAndDraw;
window._calcAvgForRange = _calcAvgForRange;
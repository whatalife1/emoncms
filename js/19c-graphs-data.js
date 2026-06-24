// ─── Graphs Panel - Data Layer (Month Fix + Unit Fix + Zero Fix) ────────

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

// ---- Format stat line (FORCED kWh for month view) ----
function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, nightAvgVal, unit, isKwh, currentTab) {
    // FORCE: Month view always uses kWh
    if (currentTab === 'month') {
        unit = 'kWh';
        isKwh = true;
    }
    
    const lblLower = label.toLowerCase();
    const isSolar = lblLower.includes('solar');
    const isTemp = lblLower.includes('temp');
    const isDay = currentTab === 'day';
    const hideNight = isSolar || isTemp || !isDay;
    const peakLabel = isDay ? "Peak" : "Max Day";
    const avgLabel  = isDay ? "Avg"  : (currentTab === 'month' ? "Daily Avg" : "Monthly Avg");

    let peakColor = accentColor;
    if (peakVal > 1500 && isDay && !isTemp) peakColor = '#ef4444';
    else if (peakVal > 1000 && isDay && !isTemp) peakColor = '#f97316';

    const boldStyle = `font-size: 15.5px; font-weight: 900;`;

    const avgHtml = (avgVal !== null && avgVal !== 0)
        ? ` · <span style="color:${accentColor}; ${boldStyle}">${avgLabel}: ${Math.round(avgVal)} ${unit}</span>`
        : '';

    const nightHtml = (!hideNight && nightAvgVal !== null && nightAvgVal !== 0)
        ? ` · <span style="color:#bf7aff; ${boldStyle}">Night: ${Math.round(nightAvgVal)} ${unit}</span>`
        : '';

    const mainDisplay = isKwh ? `${mainVal.toFixed(1)} kWh` : `${mainVal.toFixed(1)} ${unit}`;

    return `<div style="display:flex; align-items:center; gap:6px; font-size:14px; font-weight:700; margin-bottom:5px; flex-wrap:wrap;">
        <span style="color:${accentColor}">${icon} ${label}:</span>
        <span style="color:var(--text-main); font-size:17px; font-weight:900;">${mainDisplay}</span>
        <span style="color:var(--text-muted); font-size:13px; font-weight:600; margin-left:2px;">
            (<span style="font-size:13px">${peakLabel}:</span> <span style="color:${peakColor}; ${boldStyle}">${Math.round(peakVal).toLocaleString()}</span> ${unit}${avgHtml}${nightHtml})
        </span>
    </div>`;
}

// ---- Ensure GRAPH_FEEDS and GRAPH_COMBINED exist ----
if (typeof window.GRAPH_FEEDS === 'undefined') {
    window.GRAPH_FEEDS = [
        { key: 'solar',   name: 'Solar',         id: '499380', color: '#facc15', label: '☀ Solar'        },
        { key: 'grid',    name: 'Grid (Breaker)', id: '499374', color: '#ef4444', label: '⚡ Grid'         },
        { key: 'acvolts', name: 'AC Input Volts', id: '499383', color: '#fb7185', label: '⚡ AC Volts'     },
        { key: 'temp',    name: 'Temperature',   id: '499428', color: '#10b981', label: '🌡 Temp 1'       },
        { key: 'temp2',   name: 'Temperature 2', id: '512473', color: '#34d399', label: '🌡 Temp 2'       },
        { key: 'k15',     name: 'Kenwood 1.5T',  id: '499362', color: '#38bdf8', label: '❄ Kenwood 1.5T' },
        { key: 'k1',      name: 'Kenwood 1T',    id: '499364', color: '#7dd3fc', label: '❄ Kenwood 1T'   },
        { key: 'haier',   name: 'Haier 1T',      id: '499367', color: '#a5f3fc', label: '❄ Haier 1T'     },
        { key: 'fridge1', name: 'Fridge 1',      id: '499373', color: '#c084fc', label: '🧊 Fridge 1'     },
        { key: 'fridge2', name: 'Fridge 2',      id: '541348', color: '#e879f9', label: '🧊 Fridge 2'     },
        { key: 'pc',      name: 'PC',            id: '499422', color: '#4ade80', label: '💻 PC'           },
        { key: 'water',   name: 'Water Tank',    id: '499431', color: '#0ea5e9', label: '💧 Water'        },
    ];
}
if (typeof window.GRAPH_COMBINED === 'undefined') {
    window.GRAPH_COMBINED = { key: 'combined', name: 'Solar + Grid', color: '#facc15', label: '⚡☀ Solar+Grid' };
}
if (typeof window.PROXY_BASE === 'undefined') {
    window.PROXY_BASE = 'https://emon-proxy.new-life-786-786-786.workers.dev';
}
if (typeof window.GRAPH_DAY_RESOLUTION_SECONDS === 'undefined') {
    window.GRAPH_DAY_RESOLUTION_SECONDS = 120;
}

// ---- Helper: fetch with retry ----
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

    // ---- MONTH VIEW: use same resolution as day, filter solar hours ----
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

    // ---- ORIGINAL LOGIC for day/year/total ----
    const isAvgFeed = feedKey.startsWith('temp') || feedKey === 'water' || feedKey === 'acvolts' || feedKey === 'AC Volts';
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

    // Override with live Today feed for current day
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

// ---- Main load & draw ----
async function _loadAndDraw() {
    if (graphIsLoading) return;
    graphIsLoading = true;
    _showGraphLoading(true);
    const stat = document.getElementById('graph-stat');
    const canvas = document.getElementById('graph-canvas');
    if (!canvas || !stat) { graphIsLoading = false; return; }
    stat.textContent = 'Loading…';
    hideTooltip();

    try {
        const nav = _gNavInfo();
        const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey);
        const isCombined = graphFeedKey === 'combined';
        let pts1 = [], pts2 = [];

        let interval1 = nav.interval;
        let interval2 = nav.interval;
        if (graphTab === 'month') {
            interval1 = GRAPH_DAY_RESOLUTION_SECONDS;
            interval2 = GRAPH_DAY_RESOLUTION_SECONDS;
        }

        if (isCombined) {
            const solarFeed = GRAPH_FEEDS.find(f => f.key === 'solar');
            const gridFeed = GRAPH_FEEDS.find(f => f.key === 'grid');
            pts1 = await _gFetch(solarFeed.id, nav.startMs, nav.endMs, interval1);
            pts2 = await _gFetch(gridFeed.id, nav.startMs, nav.endMs, interval2);
        } else {
            pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, interval1);
        }

        const navForBars = { ...nav };
        if (graphTab === 'month') navForBars.interval = GRAPH_DAY_RESOLUTION_SECONDS;
        let bars1 = _pointsToBars(pts1, navForBars, graphFeedKey);
        let bars2 = isCombined ? _pointsToBars(pts2, navForBars, 'grid') : [];
        let labels = nav.labels;
        if (graphTab === 'month') labels = navForBars.labels || labels;

        // ---- FIX: Stop at last available data point (prevents zero drop) ----
        let lastIdx = bars1.length;
        if (graphTab === 'day' && graphDateNav === 0) {
            // Calculate expected index based on current time
            const expectedIdx = Math.floor((Date.now() - nav.startMs) / (nav.resSeconds * 1000)) + 1;
            
            // Find the last index that actually has data (non-zero or non-null)
            let lastDataIdx = -1;
            for (let i = bars1.length - 1; i >= 0; i--) {
                if (bars1[i] !== 0 && bars1[i] !== null && bars1[i] !== undefined) {
                    lastDataIdx = i;
                    break;
                }
            }
            
            // Use the minimum of expected and last data index
            // If there's no data, use expected (will show zeros)
            if (lastDataIdx >= 0) {
                lastIdx = Math.min(expectedIdx, lastDataIdx + 1);
            } else {
                lastIdx = expectedIdx;
            }
            
            // Ensure we don't show more bars than we have data for
            if (lastIdx > bars1.length) lastIdx = bars1.length;
        }

        // ---- Unit handling ----
        let unit;
        if (graphTab === 'day') {
            unit = 'W';
            if (graphFeedKey.startsWith('temp')) unit = '°C';
            else if (graphFeedKey === 'water') unit = '%';
            else if (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') unit = 'V';
        } else {
            unit = 'kWh';
            if (graphFeedKey.startsWith('temp')) unit = '°C';
            else if (graphFeedKey === 'water') unit = '%';
            else if (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') unit = 'V';
        }

        const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15');
        const color2 = '#ef4444';

        graphDataCache = { bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx };

        _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx);

        // ---- Stats ----
        const isAvgFeed = graphFeedKey.startsWith('temp') || graphFeedKey === 'water' || graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts';
        let t1, t2;

        if (graphTab === 'month') {
            t1 = bars1.reduce((a, b) => a + b, 0);
            if (isCombined) t2 = bars2.reduce((a, b) => a + b, 0);
        } else {
            const dayFactor = (nav.resSeconds / 3600) / 1000;
            t1 = nav.isDayTab
                ? (isAvgFeed ? (bars1.slice(0, lastIdx).reduce((a, b) => a + b, 0) / lastIdx) : (bars1.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * dayFactor))
                : (isAvgFeed ? (bars1.reduce((a, b) => a + b, 0) / bars1.filter(v => v !== 0).length) : bars1.reduce((a, b) => a + b, 0));
            t2 = isCombined
                ? (nav.isDayTab ? (bars2.reduce((a, b, i) => i < lastIdx ? a + b : a, 0) * dayFactor) : bars2.reduce((a, b) => a + b, 0))
                : 0;
        }

        if (isCombined) {
            const p1 = Math.max(...bars1);
            const p2 = Math.max(...bars2);
            let a1, a2, n2 = null;
            if (graphTab === 'month') {
                a1 = t1 / bars1.length;
                a2 = t2 / bars2.length;
            } else {
                a1 = nav.isDayTab ? _calcAvgForRange(bars1, 5, 17, nav, lastIdx) : (t1 / bars1.filter(b => b > 0).length);
                a2 = nav.isDayTab ? _calcAvgForRange(bars2, 0, 24, nav, lastIdx) : (t2 / bars2.filter(b => b > 0).length);
                n2 = nav.isDayTab ? _calcAvgForRange(bars2, 17, 8, nav, lastIdx) : null;
            }
            stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, null, unit, true, graphTab) +
                _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, n2, unit, true, graphTab);
        } else {
            const isSol = graphFeedKey === 'solar';
            const p1 = Math.max(...bars1);
            let a1, n1 = null;
            if (graphTab === 'month') {
                a1 = t1 / bars1.length;
            } else {
                a1 = nav.isDayTab ? _calcAvgForRange(bars1, isSol ? 5 : 0, isSol ? 17 : 24, nav, lastIdx) : (t1 / bars1.filter(b => b > 0).length);
                n1 = nav.isDayTab ? _calcAvgForRange(bars1, 17, 8, nav, lastIdx) : null;
            }
            stat.innerHTML = _formatStatLine('', fA.label, t1, color1, p1, a1, n1, unit, !isAvgFeed, graphTab);
        }
    } catch (e) {
        console.error('Graphs error:', e);
        stat.textContent = 'Error: ' + e.message;
    } finally {
        graphIsLoading = false;
        _showGraphLoading(false);
    }
}

// ---- Expose globally ----
window._loadAndDraw = _loadAndDraw;
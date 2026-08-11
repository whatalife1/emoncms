function replayFlowDiagramAtMoment(multiData, idx, timestampSec) {
    if (!multiData || typeof renderFlowDiagram !== 'function') return;

    const nav = graphDataCache?.nav || (typeof _gNavInfo === 'function' ? _gNavInfo() : { resSeconds: 120 });
    const factor = (nav.resSeconds || 120) / 3600000;

    const getVal = (key) => {
        const item = multiData.find(m => m.key === key);
        return item && item.data[idx] != null ? Math.max(0, Math.round(item.data[idx])) : 0;
    };

    const getCumKwh = (key) => {
        const item = multiData.find(m => m.key === key);
        if (!item || !item.data) return 0;
        let sum = 0;
        const maxI = Math.min(idx, item.data.length - 1);
        for (let k = 0; k <= maxI; k++) {
            if (item.data[k] != null && item.data[k] > 0) {
                sum += item.data[k];
            }
        }
        return sum * factor;
    };

    const solarW  = getVal('solar');
    const gridW   = getVal('grid');
    const k15W    = getVal('k15');
    const k1W     = getVal('k1');
    const haierW  = getVal('haier');
    const f1W     = getVal('fridge1');
    const f2W     = getVal('fridge2');
    const pcW     = getVal('pc');
    const motorW  = getVal('motor');
    const totLoad = k15W + k1W + haierW + f1W + f2W + pcW + motorW;

    const solarCumKwh = getCumKwh('solar');
    const gridCumKwh  = getCumKwh('grid');
    const k15CumKwh   = getCumKwh('k15');
    const k1CumKwh    = getCumKwh('k1');
    const haierCumKwh = getCumKwh('haier');
    const f1CumKwh    = getCumKwh('fridge1');
    const f2CumKwh    = getCumKwh('fridge2');
    const pcCumKwh    = getCumKwh('pc');
    const motorCumKwh = getCumKwh('motor');

    const mockMap = new Map();
    mockMap.set('Solar',           { value: solarW, time: timestampSec });
    mockMap.set('Solar Today',     { value: solarCumKwh, time: timestampSec });
    mockMap.set('Breaker',         { value: gridW,  time: timestampSec });
    mockMap.set('Breaker Today',   { value: gridCumKwh, time: timestampSec });
    mockMap.set('Utility Today',   { value: gridCumKwh, time: timestampSec });
    mockMap.set('Tot Load',        { value: totLoad, time: timestampSec });
    mockMap.set('AC Volts',        { value: gridW > 20 ? 230 : 0, time: timestampSec });
    mockMap.set('Solar V',         { value: solarW > 20 ? 380 : 0, time: timestampSec });
    mockMap.set('Solar Amps',      { value: solarW > 20 ? (solarW / 380) : 0, time: timestampSec });
    mockMap.set('Inverter Temp',   { value: 38, time: timestampSec });
    mockMap.set('Water Tank',      { value: 75, time: timestampSec });
    mockMap.set('Temperature',     { value: 30, time: timestampSec });
    mockMap.set('Humidity',        { value: 55, time: timestampSec });
    mockMap.set('Temperature 2',   { value: 29, time: timestampSec });
    mockMap.set('Humidity 2',      { value: 55, time: timestampSec });

    mockMap.set('Kenwood 1.5Ton',       { value: k15W, time: timestampSec });
    mockMap.set('Kenwood 1.5Ton Today', { value: k15CumKwh, time: timestampSec });
    mockMap.set('Kenwood 1Ton',         { value: k1W,  time: timestampSec });
    mockMap.set('Kenwood 1Ton Today',   { value: k1CumKwh, time: timestampSec });
    mockMap.set('Haier 1Ton',           { value: haierW, time: timestampSec });
    mockMap.set('Haier 1Ton Today',     { value: haierCumKwh, time: timestampSec });
    mockMap.set('Fridge',              { value: f1W,  time: timestampSec });
    mockMap.set('Fridge Today',         { value: f1CumKwh, time: timestampSec });
    mockMap.set('Fridge2',             { value: f2W,  time: timestampSec });
    mockMap.set('Fridge2 Today',        { value: f2CumKwh, time: timestampSec });
    mockMap.set('PC',                  { value: pcW,  time: timestampSec });
    mockMap.set('PC Today',             { value: pcCumKwh, time: timestampSec });
    mockMap.set('Water Motor',         { value: motorW, time: timestampSec });
    mockMap.set('Water Motor Today',   { value: motorCumKwh, time: timestampSec });

    renderFlowDiagram(mockMap);
}

function _fastRedraw() {
    const canvas = document.getElementById('graph-canvas');
    if (canvas && graphDataCache) {
        const c = graphDataCache;
        _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined, c.nav, c.lastIdx, c.multiData,
                   c.minV, c.maxV, c.range, c.barsTemp, c.tempMinV, c.tempMaxV, c.tempRange, c.tempUnit, c.tempColor, c.overlayLabel);
    }
}

function _showRefreshPulse() {
    const oldPulse = document.getElementById('graph-pulse');
    if (oldPulse) oldPulse.remove();
    if (graphTab !== 'day') return;
    const canvas = document.getElementById('graph-canvas');
    if (!canvas) return;
    const pulse = document.createElement('div');
    pulse.id = 'graph-pulse';
    pulse.style.cssText = `
        position: absolute;
        bottom: 8px;
        right: 8px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--accent-solar);
        box-shadow: 0 0 8px var(--accent-solar);
        animation: pulse-dot 2s infinite;
        pointer-events: none;
        z-index: 10;
    `;
    if (!document.getElementById('pulse-dot-keyframes')) {
        const style = document.createElement('style');
        style.id = 'pulse-dot-keyframes';
        style.textContent = `
            @keyframes pulse-dot {
                0% { opacity: 0.3; transform: scale(0.8); }
                50% { opacity: 1; transform: scale(1.2); }
                100% { opacity: 0.3; transform: scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }
    const card = canvas.closest('.graph-chart-card');
    if (card) {
        card.style.position = 'relative';
        card.appendChild(pulse);
    }
}

function _attachDirectZoom(canvas) {
    if (!canvas || canvas._zoomAttached) return;
    canvas._zoomAttached = true;
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'crosshair';

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const oldZ = graphZoomLevel;
        graphZoomLevel = Math.max(1, Math.min(60, graphZoomLevel * zoomFactor));
        graphPanOffset *= (graphZoomLevel / oldZ);
        _fastRedraw();
    }, { passive: false });

    let isMouseDown = false, startX = 0, startPan = 0;
    canvas.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        startX = e.clientX;
        startPan = graphPanOffset;
        canvas.style.cursor = 'grabbing';
        graphIsPanning = true;
    });
    window.addEventListener('mousemove', (e) => {
        if (isMouseDown) {
            graphPanOffset = startPan + (e.clientX - startX);
            _fastRedraw();
        } else if (e.target === canvas) {
            _handleGraphHover(e, false);
        }
    });
    window.addEventListener('mouseup', () => {
        if (isMouseDown) {
            isMouseDown = false;
            canvas.style.cursor = 'crosshair';
            graphIsPanning = false;
        }
    });

    let tStartX = 0, tStartPan = 0, pStartDist = 0, pStartZoom = 1, isTouching = false;
    canvas.addEventListener('touchstart', (e) => {
        isTouching = true;
        graphIsPanning = true;
        const tooltip = document.getElementById('graph-tooltip');
        if (tooltip) tooltip.style.pointerEvents = 'none';

        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pStartDist = Math.hypot(dx, dy);
            pStartZoom = graphZoomLevel;
        } else if (e.touches.length === 1) {
            tStartX = e.touches[0].clientX;
            tStartPan = graphPanOffset;
            _handleGraphHover(e.touches[0], false);
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        if (!isTouching) return;
        const tooltip = document.getElementById('graph-tooltip');
        if (tooltip) tooltip.style.pointerEvents = 'none';

        if (e.touches.length === 2 && pStartDist > 0) {
            if (e.cancelable) e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const oldZ = graphZoomLevel;
            graphZoomLevel = Math.max(1, Math.min(60, pStartZoom * (dist / pStartDist)));
            graphPanOffset *= (graphZoomLevel / oldZ);
            _fastRedraw();
        } else if (e.touches.length === 1) {
            if (e.cancelable) e.preventDefault();
            _handleGraphHover(e.touches[0], false);
            graphPanOffset = tStartPan + (e.touches[0].clientX - tStartX);
            _fastRedraw();
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
        isTouching = false;
        pStartDist = 0;
        graphIsPanning = false;
        const tooltip = document.getElementById('graph-tooltip');
        if (tooltip && tooltip.classList.contains('pinned')) {
            tooltip.style.pointerEvents = 'auto';
        }
    });
    canvas.addEventListener('click', (e) => {
        if (graphFeedKey === 'momentflow') {
            _handleGraphHover(e, false);
        } else {
            _handleGraphHover(e, true);
        }
    });
}

function hideTooltip() {
    const tooltip = document.getElementById('graph-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.classList.remove('pinned');
    }
    tooltipPinned = false;
}

function _handleGraphHover(e, pin) {
    if (!graphDataCache) return;
    const canvas = document.getElementById('graph-canvas');
    if (!canvas) return;

    const { bars1, bars2, labels, timeLabels, fullLabels, color1, color2, unit, isCombined, lastIdx, multiData, minV, maxV, range, 
            barsTemp, tempMinV, tempMaxV, tempRange, tempUnit, tempColor, overlayLabel, isDualY, nav } = graphDataCache;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches?.[0]?.clientX ?? 0);
    const clientY = e.clientY || (e.touches?.[0]?.clientY ?? 0);
    const x = clientX - rect.left;

    const PL = 38, PR = 8, cW = rect.width - PL - PR, n = bars1.length || (multiData?.[0]?.data?.length ?? 0);
    if (n === 0 || cW <= 0) return;

    const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW / 2;
    const idx = Math.round(((x - panX - centerX) / zoom + centerX - PL) / (cW / n));

    if (idx < 0 || idx >= n || idx >= lastIdx) {
        if (!pin) hideTooltip();
        return;
    }

    const isMonthOrYear = graphTab === 'month' || graphTab === 'year';
    const isKwhView = isMonthOrYear;

    let timeLabel = '';
    if (isMonthOrYear) {
        timeLabel = (labels && labels[idx]) ? labels[idx] : `Day ${idx + 1}`;
    } else {
        const startMs = nav.startMs || 0;
        const ts = startMs + (idx * nav.resSeconds * 1000);
        const pktDate = getKarachiDate(ts);
        const h = pktDate.hour;
        const m = Math.floor((ts / 60000)) % 60;
        const ampm = h >= 12 ? 'pm' : 'am';
        const hh = h % 12 || 12;
        const mm = String(m).padStart(2, '0');
        timeLabel = `${hh}:${mm}${ampm}`;
    }

    let tooltip = document.getElementById('graph-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'graph-tooltip';
        document.body.appendChild(tooltip);
    }

    const closeBtn = pin ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';

    if (graphDataCache.isMomentFlow && multiData) {
        const timestampSec = Math.floor((nav.startMs + (idx * nav.resSeconds * 1000)) / 1000);
        replayFlowDiagramAtMoment(multiData, idx, timestampSec);

        const factor = (nav.resSeconds || 120) / 3600000;
        const startMs = nav.startMs || 0;

        const getCumStats = (dataArr, key = '') => {
            if (!dataArr) return { totalKwh: 0, dayKwh: 0, nightKwh: 0, dayAvgW: 0, nightAvgW: 0 };
            let totalSum = 0, daySum = 0, nightSum = 0;
            let dayCount = 0, nightCount = 0;
            const maxI = Math.min(idx, dataArr.length - 1);
            
            const isPc = key === 'pc';
            const dayStart = isPc ? 6 : 8;
            const dayEnd = 17;

            for (let k = 0; k <= maxI; k++) {
                const val = dataArr[k];
                if (val != null && val > 0) {
                    totalSum += val;
                    const ts = startMs + (k * nav.resSeconds * 1000);
                    const p = getKarachiDate(ts);
                    const h = p.hour;
                    if (h >= dayStart && h < dayEnd) {
                        daySum += val;
                        dayCount++;
                    } else {
                        nightSum += val;
                        nightCount++;
                    }
                }
            }
            return {
                totalKwh: totalSum * factor,
                dayKwh: daySum * factor,
                nightKwh: nightSum * factor,
                dayAvgW: dayCount > 0 ? Math.round(daySum / dayCount) : 0,
                nightAvgW: nightCount > 0 ? Math.round(nightSum / nightCount) : 0
            };
        };

        const loads = multiData.filter(m => m.key !== 'solar' && m.key !== 'grid').map(m => {
            const watts = Math.max(0, Math.round(m.data[idx] || 0));
            const stats = getCumStats(m.data, m.key);
            return {
                key: m.key,
                label: m.label,
                color: m.color,
                watts: watts,
                stats: stats
            };
        });

        const solarItem = multiData.find(m => m.key === 'solar');
        const gridItem  = multiData.find(m => m.key === 'grid');

        const solarW     = Math.round(solarItem?.data[idx] || 0);
        const solarStats = getCumStats(solarItem?.data, 'solar');
        
        const gridW      = Math.round(gridItem?.data[idx] || 0);
        const gridStats  = getCumStats(gridItem?.data, 'grid');

        // Synthetic calculation for "Others" (ceiling fans, microwave, TVs...)
        const othersData = new Array(n).fill(0);
        for (let k = 0; k < n; k++) {
            const sW = (solarItem?.data?.[k] != null && solarItem.data[k] > 0) ? solarItem.data[k] : 0;
            const gW = (gridItem?.data?.[k] != null && gridItem.data[k] > 0) ? gridItem.data[k] : 0;
            const totSupplied = sW + gW;
            let trackedSum = 0;
            loads.forEach(l => {
                const item = multiData.find(m => m.key === l.key);
                if (item && item.data?.[k] != null && item.data[k] > 0) {
                    trackedSum += item.data[k];
                }
            });
            othersData[k] = Math.max(0, totSupplied - trackedSum);
        }

        const othersW = Math.round(othersData[idx] || 0);
        const othersStats = getCumStats(othersData, 'others');

        loads.push({
            key: 'others',
            label: 'Others (Fans, Lights...)',
            color: '#f59e0b',
            watts: othersW,
            stats: othersStats
        });

        const trackedWatts = loads.filter(l => l.key !== 'others').reduce((sum, l) => sum + l.watts, 0);
        const totLoad      = Math.max(trackedWatts, solarW + gridW);
        const totLoadKwh   = loads.reduce((sum, l) => sum + l.stats.totalKwh, 0);
        const totDayKwh    = loads.reduce((sum, l) => sum + l.stats.dayKwh, 0);
        const totNightKwh  = loads.reduce((sum, l) => sum + l.stats.nightKwh, 0);
        const totDayAvgW   = Math.round(loads.reduce((sum, l) => sum + l.stats.dayAvgW, 0));
        const totNightAvgW = Math.round(loads.reduce((sum, l) => sum + l.stats.nightAvgW, 0));

        const isMobileScreen = window.innerWidth <= 600;

        let htmlStr = `
            <div style="font-weight:800; font-size:${isMobileScreen ? '13px' : '14px'}; color:var(--text-main); border-bottom:1px solid var(--border); padding-bottom:4px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                <span>🕒 ${timeLabel}</span> ${closeBtn}
            </div>
        `;

        if (isMobileScreen) {
            htmlStr += `
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:6px; font-size:11px; background:var(--bg-card); padding:6px 8px; border-radius:8px; border:1px solid var(--border); text-align:center;">
                    <div>
                        <div style="color:#ef4444; font-weight:800;">⚡ Grid</div>
                        <div style="font-weight:800; color:var(--text-main); font-size:12px;">${gridW} W</div>
                        <div style="font-size:9.5px; color:var(--text-muted);">${gridStats.totalKwh.toFixed(2)} kWh</div>
                    </div>
                    <div style="border-left:1px solid var(--border); border-right:1px solid var(--border);">
                        <div style="color:#facc15; font-weight:800;">☀ Solar</div>
                        <div style="font-weight:800; color:var(--text-main); font-size:12px;">${solarW} W</div>
                        <div style="font-size:9.5px; color:var(--text-muted);">${solarStats.totalKwh.toFixed(2)} kWh</div>
                    </div>
                    <div>
                        <div style="color:#38bdf8; font-weight:800;">💡 Load</div>
                        <div style="font-weight:800; color:var(--text-main); font-size:12px;">${totLoad} W</div>
                        <div style="font-size:9.5px; color:var(--text-muted);">${totLoadKwh.toFixed(2)} kWh</div>
                    </div>
                </div>
                <div style="font-size:9.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; border-bottom:1px dashed var(--border); padding-bottom:2px;">
                    Appliance Breakdown at ${timeLabel}:
                </div>
            `;
        } else {
            htmlStr += `
                <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:8px; font-size:12px; background:var(--bg-card); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#ef4444; font-weight:800;">⚡ Grid: ${gridW} W</span>
                            <span style="color:#ef4444; font-weight:700;">Tot: ${gridStats.totalKwh.toFixed(2)} kWh</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;">
                            <span>☀️ Day: ${gridStats.dayKwh.toFixed(2)} kWh (${gridStats.dayAvgW} W)</span>
                            <span>🌙 Night: ${gridStats.nightKwh.toFixed(2)} kWh (${gridStats.nightAvgW} W)</span>
                        </div>
                    </div>
                    <div style="border-top:1px dashed var(--border); padding-top:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#facc15; font-weight:800;">☀ Solar: ${solarW} W</span>
                            <span style="color:#facc15; font-weight:700;">Tot: ${solarStats.totalKwh.toFixed(2)} kWh</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;">
                            <span>☀️ Day: ${solarStats.dayKwh.toFixed(2)} kWh (${solarStats.dayAvgW} W)</span>
                            <span></span>
                        </div>
                    </div>
                    <div style="border-top:1px dashed var(--border); padding-top:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:#38bdf8; font-weight:800;">💡 Load: ${totLoad} W</span>
                            <span style="color:#38bdf8; font-weight:700;">Tot: ${totLoadKwh.toFixed(2)} kWh</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;">
                            <span>☀️ Day: ${totDayKwh.toFixed(2)} kWh (${totDayAvgW} W)</span>
                            <span>🌙 Night: ${totNightKwh.toFixed(2)} kWh (${totNightAvgW} W)</span>
                        </div>
                    </div>
                </div>
                <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; border-bottom:1px dashed var(--border); padding-bottom:3px;">
                    Appliance Current & Total at ${timeLabel}:
                </div>
            `;
        }

        loads.forEach(l => {
            const isActive = l.watts > 5;
            const opacity = isActive ? '1' : '0.5';
            const fontWt  = isActive ? '800' : '600';

            if (isMobileScreen && !isActive) {
                htmlStr += `
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; margin:2px 0; opacity:${opacity};">
                        <div style="display:flex; align-items:center; gap:4px;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${l.color};"></span>
                            <span style="color:${l.color}; font-weight:700;">${l.label}</span>
                        </div>
                        <div style="font-family:monospace;">
                            <span style="color:var(--text-muted);">0 W</span>
                            <span style="font-size:9px; color:var(--accent-kwh); margin-left:3px;">(${l.stats.totalKwh.toFixed(2)} kWh)</span>
                        </div>
                    </div>
                `;
            } else {
                htmlStr += `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; font-size:${isMobileScreen ? '10.5px' : '12px'}; margin:${isMobileScreen ? '2px 0' : '4px 0'}; padding:1px 0; opacity:${opacity}; border-bottom:1px solid rgba(255,255,255,0.03);">
                        <div style="display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${l.color};"></span>
                            <span style="color:${l.color}; font-weight:700;">${l.label}</span>
                        </div>
                        <div style="text-align:right; font-family:monospace; white-space:nowrap; margin-left:8px;">
                            <span style="font-weight:${fontWt}; color:var(--text-main);">${l.watts} W</span>
                            <span style="font-size:${isMobileScreen ? '9.5px' : '11px'}; color:var(--accent-kwh); margin-left:3px;">(${l.stats.totalKwh.toFixed(2)} kWh)</span>
                            <div style="font-size:${isMobileScreen ? '9px' : '10.5px'}; color:var(--text-muted); font-weight:normal; margin-top:1px;">
                                ☀️ ${l.stats.dayKwh.toFixed(2)} kWh (${l.stats.dayAvgW}W) &bull; 🌙 ${l.stats.nightKwh.toFixed(2)} kWh (${l.stats.nightAvgW}W)
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        tooltip.innerHTML = htmlStr;
        tooltip.style.display = 'block';
        tooltip.classList.toggle('pinned', pin);

        let left = clientX + 15;
        let top  = clientY - 15;
        const tRect = tooltip.getBoundingClientRect();
        if (left + tRect.width > window.innerWidth - 10) left = clientX - tRect.width - 15;
        if (top + tRect.height > window.innerHeight - 10) top = clientY - tRect.height - 15;

        tooltip.style.left = Math.max(10, left) + 'px';
        tooltip.style.top  = Math.max(10, top) + 'px';
        return;
    }

    let html = `<div style="font-weight:700;font-size:12px;color:var(--text-main);margin-bottom:4px;border-bottom:1px solid var(--border);padding-bottom:4px;">${timeLabel} ${closeBtn}</div>`;

    const mouseY = clientY - rect.top;
    const PT = 12, cH = rect.height - 12 - 34;

    if (multiData && multiData.length > 0) {
        let minDist = 999;
        let closestLineIdx = 0;
        for (let i = 0; i < multiData.length; i++) {
            const val = multiData[i].data[idx];
            if (val === null || val === undefined) continue;
            const py = PT + cH - ((val - minV) / range) * cH;
            const dist = Math.abs(mouseY - py);
            if (dist < minDist) { minDist = dist; closestLineIdx = i + 1; }
        }

        multiData.forEach((line, i) => {
            const val = (line.data[idx] ?? 0);
            const isLineTemp = unit === '°C';
            let valStr = isKwhView ? val.toFixed(2) + ' kWh' :
                         (isLineTemp ? val.toFixed(1) + ' °C' : Math.round(val) + ' W');

            const isFocused = (closestLineIdx === i + 1);
            const focusStyle = isFocused ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';
            html += `<div style="color:${line.color};margin:2px 0;${focusStyle}">
                ${isFocused ? '*' : '&nbsp;'} <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${line.color};margin-right:5px;vertical-align:middle;"></span>
                <b>${line.label}:</b> ${valStr}
            </div>`;
        });
    } else {
        const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';
        const isTooltipTemp = unit === '°C' || isTempCombined;

        const val1Raw = bars1[idx] || 0;
        const val1 = isKwhView ? val1Raw.toFixed(2) + ' kWh' :
                     (isTooltipTemp ? val1Raw.toFixed(1) + ' °C' : Math.round(val1Raw) + ' ' + unit);

        let val2Str = '';
        if (isCombined) {
            const val2Raw = bars2[idx] || 0;
            val2Str = isKwhView ? val2Raw.toFixed(2) + ' kWh' : Math.round(val2Raw) + ' ' + unit;
        } else if (isTempCombined) {
            const val2Raw = bars2[idx] || 0;
            val2Str = Math.round(val2Raw) + ' %';
        }

        const l1 = isTempCombined ? 'Temp' : (isCombined ? 'Solar' : 'Value');
        const l2 = isTempCombined ? 'Hum' : (isCombined ? 'Grid' : '');

        html += `<div style="color:${color1};">● <b>${l1}:</b> ${val1}</div>`;
        if (val2Str) {
            const c2 = isTempCombined ? '#6366f1' : color2;
            html += `<div style="color:${c2};">● <b>${l2}:</b> ${val2Str}</div>`;
        }
    }

    if (isDualY && barsTemp && idx < barsTemp.length) {
        const tVal = barsTemp[idx] ?? 0;
        let tValStr = '';
        if (tempUnit === 'kWh') {
            tValStr = tVal.toFixed(2) + ' kWh';
        } else if (tempUnit === '°C') {
            tValStr = tVal.toFixed(1) + ' °C';
        } else {
            tValStr = isKwhView ? tVal.toFixed(2) + ' kWh' : Math.round(tVal) + ' W';
        }
        html += `<div style="color:${tempColor};margin-top:4px;border-top:1px dashed var(--border);padding-top:4px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tempColor};margin-right:5px;"></span>
            <b>${overlayLabel || 'AC'}:</b> ${tValStr}
        </div>`;
    }
if (graphDataCache.barsTemp2 && idx < graphDataCache.barsTemp2.length) {
        const tVal2 = graphDataCache.barsTemp2[idx] ?? 0;
        html += `<div style="color:${graphDataCache.tempColor2};margin-top:2px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${graphDataCache.tempColor2};margin-right:5px;"></span>
            <b>${graphDataCache.overlayLabel2}:</b> ${tVal2.toFixed(2)} kWh
        </div>`;
    }
    if (graphDataCache.barsTemp3 && idx < graphDataCache.barsTemp3.length) {
        const tVal3 = graphDataCache.barsTemp3[idx] ?? 0;
        html += `<div style="color:${graphDataCache.tempColor3};margin-top:2px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${graphDataCache.tempColor3};margin-right:5px;"></span>
            <b>${graphDataCache.overlayLabel3}:</b> ${tVal3.toFixed(2)} kWh
        </div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.classList.toggle('pinned', pin);

    let left = clientX + 15;
    let top  = clientY - 15;
    const tRect = tooltip.getBoundingClientRect();
    if (left + tRect.width > window.innerWidth - 10) left = clientX - tRect.width - 15;
    if (top + tRect.height > window.innerHeight - 10) top = window.innerHeight - tRect.height - 10;

    tooltip.style.left = Math.max(10, left) + 'px';
    tooltip.style.top  = Math.max(10, top) + 'px';
}

function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx, multiData,
                   minV, maxV, range, barsTemp = [], tempMinV = 0, tempMaxV = 100, tempRange = 100, tempUnit = '°C', tempColor = '#10b981', overlayLabel = '') {
    
    _attachDirectZoom(canvas);

    if (graphTab === 'day') {
        _showRefreshPulse();
    } else {
        const pulse = document.getElementById('graph-pulse');
        if (pulse) pulse.remove();
    }

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const PL = 38, PR = 10, PT = 12, PB = 34;
    const cW = rect.width  - PL - PR;
    const cH = rect.height - PT - PB;

    const maxPan = (cW / 2) * (graphZoomLevel - 1);
    const minPan = -maxPan;
    graphPanOffset = Math.max(minPan, Math.min(maxPan, graphPanOffset));

    const zoom = graphZoomLevel;
    const panX = graphPanOffset;
    const centerX = PL + cW / 2;
    const mapX = (x) => centerX + (x - centerX) * zoom + panX;

    const chartType = graphChartType || 'line';
    const isTemp = (unit === '°C' || graphFeedKey.startsWith('temp'));
    const isKwhView = (graphTab === 'month' || graphTab === 'year');

    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.fillStyle = '#71717a';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    const numGridLines = 5;

    for (let i = 0; i <= numGridLines; i++) {
        const val = minV + (i / numGridLines) * range;
        const y   = PT + cH - (i / numGridLines) * cH;
        
        let lbl = isKwhView ? val.toFixed(1) : 
                  (isTemp ? val.toFixed(1) + '°' : Math.round(val).toLocaleString());
        
        ctx.fillText(lbl, PL - 5, y + 3);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(PL + cW, y);
        ctx.stroke();
    }

    if (barsTemp && barsTemp.length > 0) {
        ctx.textAlign = 'left';
        const rightX = PL + cW + 5;
        for (let i = 0; i <= numGridLines; i++) {
            const val = tempMinV + (i / numGridLines) * tempRange;
            const y = PT + cH - (i / numGridLines) * cH;
            const lbl = (tempUnit === 'kWh') ? val.toFixed(1) : Math.round(val).toLocaleString();
            ctx.fillText(lbl, rightX, y + 3);
        }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(PL, PT, cW, cH);
    ctx.clip();

    const n = bars1.length || (multiData?.[0]?.data?.length ?? 0);
    if (n > 0) {
        if (multiData && multiData.length > 0) {
            multiData.forEach(line => {
                _renderPlot(ctx, line.data, n, line.color, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, false);
            });
        } else {
            if (isCombined || (graphFeedKey.startsWith('temp') && bars2.length)) {
                const c2 = graphFeedKey.startsWith('temp') ? '#6366f1' : color2;
                _renderPlot(ctx, bars2, n, c2, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, true);
            }
            _renderPlot(ctx, bars1, n, color1, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, false);
        }

        if (barsTemp && barsTemp.length > 0) {
            _renderPlot(ctx, barsTemp, n, tempColor, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
        }
        if (graphDataCache.barsTemp2 && graphDataCache.barsTemp2.length > 0) {
            _renderPlot(ctx, graphDataCache.barsTemp2, n, graphDataCache.tempColor2, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
        }
        if (graphDataCache.barsTemp3 && graphDataCache.barsTemp3.length > 0) {
            _renderPlot(ctx, graphDataCache.barsTemp3, n, graphDataCache.tempColor3, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
        }
    }
    ctx.restore();



    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.font = '9px system-ui';

    const isZoomed = zoom > 2;
    const maxLabels = Math.max(3, Math.floor(cW / 45));
    const labelStep = Math.max(1, Math.ceil(n / (maxLabels * zoom)));

    const displayLabels = (isZoomed && nav && nav.fullLabels) ? nav.fullLabels : (labels || []);

    for (let i = 0; i < n; i += labelStep) {
        const lx = mapX(PL + (i / n) * cW);
        if (lx > PL - 10 && lx < rect.width - PR) {
            let label = displayLabels[i] || '';
            if (!isZoomed && label.includes(':')) {
                const match = label.match(/^(\d+):/);
                if (match) {
                    const hour = parseInt(match[1]);
                    const ampm = label.includes('pm') ? 'pm' : 'am';
                    label = `${hour}${ampm}`;
                }
            }
            ctx.fillText(label, lx, rect.height - 12);
        }
    }
}

function _renderPlot(ctx, data, n, clr, type, mapX, PL, PT, cW, cH, min, range, lastIdx, isSecondary, isDashed = false) {
    if (type === 'bar' || type === 'hourly') {
        const barWidth = Math.max(1, (cW / n) * 0.7);
        const offset = isSecondary ? barWidth * 0.4 : 0;
        ctx.fillStyle = clr;
        ctx.globalAlpha = isSecondary ? 0.4 : 0.8;
        
        for (let i = 0; i < lastIdx; i++) {
            const val = data[i];
            if (val == null) continue;
            const x = mapX(PL + (i / n) * cW) - barWidth / 2 + offset;
            const y = PT + cH - ((val - min) / range) * cH;
            ctx.fillRect(x, y, barWidth * 0.9, (PT + cH) - y);
        }
        ctx.globalAlpha = 1.0;
    } else {
        ctx.beginPath();
        ctx.strokeStyle = clr;
        ctx.lineWidth = isSecondary ? 1.5 : 2.5;
        if (isDashed) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
        
        let started = false;
        for (let i = 0; i < lastIdx; i++) {
            const val = data[i];
            if (val == null) { started = false; continue; }
            const x = mapX(PL + (i / n) * cW);
            const y = PT + cH - ((val - min) / range) * cH;
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

window._fastRedraw         = _fastRedraw;
window._showRefreshPulse   = _showRefreshPulse;
window._attachDirectZoom   = _attachDirectZoom;
window._handleGraphHover   = _handleGraphHover;
window._drawChart          = _drawChart;
window.hideTooltip         = hideTooltip;
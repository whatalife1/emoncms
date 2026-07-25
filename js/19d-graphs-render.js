// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

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
        const zl = document.getElementById('zoom-level');
        if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';
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
            graphPanOffset = startPan + (e.clientX - startX) * graphZoomLevel;
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
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pStartDist = Math.hypot(dx, dy);
            pStartZoom = graphZoomLevel;
        } else if (e.touches.length === 1) {
            tStartX = e.touches[0].clientX;
            tStartPan = graphPanOffset;
        }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        if (!isTouching) return;
        if (e.touches.length === 2 && pStartDist > 0) {
            if (e.cancelable) e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const oldZ = graphZoomLevel;
            graphZoomLevel = Math.max(1, Math.min(60, pStartZoom * (dist / pStartDist)));
            graphPanOffset *= (graphZoomLevel / oldZ);
            const zl = document.getElementById('zoom-level');
            if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';
            _fastRedraw();
        } else if (e.touches.length === 1) {
            if (e.cancelable) e.preventDefault();
            graphPanOffset = tStartPan + (e.touches[0].clientX - tStartX) * graphZoomLevel;
            _fastRedraw();
        }
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
        isTouching = false;
        pStartDist = 0;
        graphIsPanning = false;
    });
    canvas.addEventListener('click', (e) => _handleGraphHover(e, true));
}

function hideTooltip() {
    const tooltip = document.getElementById('graph-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.classList.remove('pinned');
    }
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

    // Guard against out of bounds or drawing into the future
    if (idx < 0 || idx >= n || idx >= lastIdx) {
        if (!pin) hideTooltip();
        return;
    }

    // ---- START TIMEZONE FIX ----
    const startMs = nav.startMs || 0;
    const ts = startMs + (idx * nav.resSeconds * 1000);
    
    // Create a Date object forced to Pakistan Time (UTC + 5)
    const dObj = new Date(ts + 18000000); 
    const h = dObj.getUTCHours();
    const m = dObj.getUTCMinutes();
    
    const ampm = h >= 12 ? 'pm' : 'am';
    const hh = h % 12 || 12;
    const mm = String(m).padStart(2, '0');
    const timeLabel = `${hh}:${mm}${ampm}`;
    // ---- END TIMEZONE FIX ----

    const PT = 12, cH = rect.height - 12 - 34;
    const mouseY = clientY - rect.top;
    let closestLineIdx = 0;

    let tooltip = document.getElementById('graph-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'graph-tooltip';
        document.body.appendChild(tooltip);
    }

    const closeBtn = pin ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';
    let html = `<div style="font-weight:700;font-size:12px;color:var(--text-main);margin-bottom:4px;border-bottom:1px solid var(--border);padding-bottom:4px;">${timeLabel} ${closeBtn}</div>`;

    const isMonthOrYear = graphTab === 'month' || graphTab === 'year';
    const isDayView = graphTab === 'day';
    const isKwhView = isMonthOrYear;

    // Logic for Multi-Line (Grid-All)
    if (multiData && multiData.length > 0) {
        let minDist = 999;
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
    } 
    // Logic for Single or Combined Feeds
    else {
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

    // Logic for Secondary Axis (AC Overlay on Temp)
    if (isDualY && barsTemp && idx < barsTemp.length) {
        const tVal = barsTemp[idx] ?? 0;
        const tValStr = isKwhView ? tVal.toFixed(2) + ' kWh' : Math.round(tVal) + ' W';
        html += `<div style="color:${tempColor};margin-top:4px;border-top:1px dashed var(--border);padding-top:4px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tempColor};margin-right:5px;"></span>
            <b>${overlayLabel || 'AC'}:</b> ${tValStr}
        </div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.classList.toggle('pinned', pin);

    // Positioning
    let left = clientX + 15;
    let top  = clientY - 15;
    const tRect = tooltip.getBoundingClientRect();
    if (left + tRect.width > window.innerWidth - 10) left = clientX - tRect.width - 15;
    if (top + tRect.height > window.innerHeight - 10) top = clientY - tRect.height - 15;
    
    tooltip.style.left = Math.max(10, left) + 'px';
    tooltip.style.top  = Math.max(10, top) + 'px';
}

// ---- _drawChart with Multi-Line support + dual Y-axis for overlay ----
function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx, multiData,
                   minV, maxV, range, barsTemp = [], tempMinV = 0, tempMaxV = 100, tempRange = 100, tempUnit = '°C', tempColor = '#10b981', overlayLabel = '') {
    
    // Ensure input handlers are attached
    _attachDirectZoom(canvas);

    // Show pulse dot for today's live view
    if (graphTab === 'day') {
        _showRefreshPulse();
    } else {
        const pulse = document.getElementById('graph-pulse');
        if (pulse) pulse.remove();
    }

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Setup high-DPI canvas
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const PL = 38, PR = 10, PT = 12, PB = 34;
    const cW = rect.width  - PL - PR;
    const cH = rect.height - PT - PB;

    // Zoom & Pan Math
    const zoom = graphZoomLevel;
    const panX = graphPanOffset;
    const centerX = PL + cW / 2;
    const mapX = (x) => centerX + (x - centerX) * zoom + panX;

    const chartType = graphChartType || 'line';
    const isTemp = (unit === '°C' || graphFeedKey.startsWith('temp'));
    const isKwhView = (graphTab === 'month' || graphTab === 'year');

    ctx.clearRect(0, 0, rect.width, rect.height);

    // --- 1. DRAW Y-AXIS GRID & LABELS (LEFT) ---
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
        
        // Subtle grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(PL + cW, y);
        ctx.stroke();
    }

    // --- 2. DRAW SECONDARY Y-AXIS (RIGHT - For Temp Overlays) ---
    if (barsTemp && barsTemp.length > 0) {
        ctx.textAlign = 'left';
        const rightX = PL + cW + 5;
        for (let i = 0; i <= numGridLines; i++) {
            const val = tempMinV + (i / numGridLines) * tempRange;
            const y = PT + cH - (i / numGridLines) * cH;
            ctx.fillText(Math.round(val).toLocaleString(), rightX, y + 3);
        }
    }

    // --- 3. DRAW DATA (CLIPPED TO CHART AREA) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL, PT, cW, cH);
    ctx.clip();

    const n = bars1.length || (multiData?.[0]?.data?.length ?? 0);
    if (n > 0) {
        // Multi-line (Grid-All) logic
        if (multiData && multiData.length > 0) {
            multiData.forEach(line => {
                _renderPlot(ctx, line.data, n, line.color, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, false);
            });
        } 
        // Single/Combined feed logic
        else {
            if (isCombined || (graphFeedKey.startsWith('temp') && bars2.length)) {
                const c2 = graphFeedKey.startsWith('temp') ? '#6366f1' : color2;
                _renderPlot(ctx, bars2, n, c2, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, true);
            }
            _renderPlot(ctx, bars1, n, color1, chartType, mapX, PL, PT, cW, cH, minV, range, lastIdx, false);
        }

        // Overlay line (e.g. AC Watts over Temperature)
        if (barsTemp && barsTemp.length > 0) {
            _renderPlot(ctx, barsTemp, n, tempColor, 'line', mapX, PL, PT, cW, cH, tempMinV, tempRange, lastIdx, false, true);
        }
    }
    ctx.restore();

    // --- 4. DRAW X-AXIS LABELS (THE TIMEZONE-PROOF FIX) ---
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.font = '9px system-ui';

    const isZoomed = zoom > 2;
    // Calculate how many labels can comfortably fit (assume ~45px per label)
    const maxLabels = Math.max(3, Math.floor(cW / 45));
    const labelStep = Math.max(1, Math.ceil(n / (maxLabels * zoom)));

    // Use fullLabels when zoomed, otherwise use labels
    const displayLabels = (isZoomed && nav && nav.fullLabels) ? nav.fullLabels : (labels || []);

    for (let i = 0; i < n; i += labelStep) {
        const lx = mapX(PL + (i / n) * cW);
        if (lx > PL - 10 && lx < rect.width - PR) {
            let label = displayLabels[i] || '';
            // If zoomed out and label has minutes, truncate to hour only to save space
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

/**
 * Internal helper to draw the actual lines/bars
 */
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

// ---- Expose globally ----
window._fastRedraw         = _fastRedraw;
window._showRefreshPulse   = _showRefreshPulse;
window._attachDirectZoom   = _attachDirectZoom;
window._handleGraphHover   = _handleGraphHover;
window._drawChart          = _drawChart;
window.hideTooltip         = hideTooltip;
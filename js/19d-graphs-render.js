// ─── Graphs Panel - Rendering & Interaction ────────────────────────────────

function _fastRedraw() {
    const canvas = document.getElementById('graph-canvas');
    if (canvas && graphDataCache) {
        const c = graphDataCache;
        _drawChart(canvas, c.bars1, c.bars2, c.labels, c.color1, c.color2, c.unit, c.isCombined, c.nav, c.lastIdx, c.multiData);
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

function _handleGraphHover(e, pin) {
    if (!graphDataCache) return;
    const canvas = document.getElementById('graph-canvas');
    if (!canvas) return;
    const { bars1, bars2, labels, color1, color2, unit, isCombined, lastIdx, multiData } = graphDataCache;
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

    // ---- Multi-line tooltip: show all visible feeds ----
    if (multiData && multiData.length > 0) {
        let tooltip = document.getElementById('graph-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'graph-tooltip';
            document.body.appendChild(tooltip);
        } else if (tooltip.parentElement !== document.body) {
            document.body.appendChild(tooltip);
        }

        const closeBtn = pin ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';
        let html = `<div style="font-weight:700;font-size:11px;color:var(--text-muted);margin-bottom:4px">${labels[idx] || ''} ${closeBtn}</div>`;
        for (const line of multiData) {
            const val = (line.data[idx] ?? 0);
            const isTemp = unit === '°C';
            const valStr = graphTab === 'day' ? (isTemp ? val.toFixed(1) : Math.round(val)) + ' ' + unit : val.toFixed(2) + ' ' + unit;
            html += `<div style="color:${line.color};margin:1px 0">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${line.color};margin-right:5px;vertical-align:middle"></span>
                <b>${line.label}:</b> ${valStr}
            </div>`;
        }

        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        tooltip.classList.toggle('pinned', pin);

        let left = clientX + 15;
        let top  = clientY - 15;
        const tRect = tooltip.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        if (left + tRect.width  > vw - 10) left = clientX - tRect.width  - 15;
        if (top  + tRect.height > vh - 10) top  = clientY - tRect.height - 15;
        if (top  < 10) top  = 10;
        if (left < 10) left = 10;
        tooltip.style.left = left + 'px';
        tooltip.style.top  = top  + 'px';
        return;
    }

    // ---- Single / combined line tooltip ----
    const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';
    const isTemp = unit === '°C' || isTempCombined;
    const val1 = (isTemp ? bars1[idx].toFixed(1) : Math.round(bars1[idx])) + ' ' + (isTempCombined ? '°C' : unit);
    let val2 = '';
    let c2 = color2;
    if (isCombined) val2 = Math.round(bars2[idx]) + ' ' + unit;
    if (isTempCombined) { 
        val2 = Math.round(bars2[idx]) + ' %';
        c2 = '#6366f1';
    }
    const l1 = isTempCombined ? 'Temp' : (isCombined ? 'Solar' : null);
    const l2 = isTempCombined ? 'Hum' : (isCombined ? 'Grid' : null);
    showTooltip(e, labels[idx], val1, val2, color1, c2, (isCombined || isTempCombined), pin, l1, l2);
}

// ---- _drawChart with Multi-Line support + end-of-line name labels ----
function _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav, lastIdx, multiData) {
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

    const PL = 38, PR = 8, PT = 12, PB = 34;
    const cW = rect.width  - PL - PR;
    const cH = rect.height - PT - PB;
    const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW / 2;
    const mapX = (x) => centerX + (x - centerX) * zoom + panX;

    const isTemp = graphFeedKey && (graphFeedKey.startsWith('temp') || graphFeedKey === 'temp' || graphFeedKey === 'temp2');
    const chartType = graphChartType || 'line';

    let maxV, minV;

    if (multiData && multiData.length > 0) {
        let allVals = [];
        for (const line of multiData) {
            allVals = allVals.concat(line.data.filter(v => v !== 0 && v !== null && v !== undefined));
        }
        if (allVals.length > 0) {
            maxV = Math.max(...allVals) * 1.1;
            minV = 0;
        } else {
            maxV = 1; minV = 0;
        }
    } else if (isTemp || graphFeedKey === 'temp' || graphFeedKey === 'temp2') {
        const allVals = [...bars1, ...bars2].filter(v => v !== 0 && v !== null && v !== undefined);
        if (allVals.length > 0) {
            const minVal = Math.min(...allVals);
            const maxVal = Math.max(...allVals);
            const range  = maxVal - minVal;
            // Use 10% padding, or at least 5 units
            const padding = Math.max(TEMP_RANGE_PADDING, range * 0.1);
            minV = Math.floor(minVal - padding);
            maxV = Math.ceil(maxVal + padding);
            if (minV < 0) minV = 0;
            
            // Limit humidity graphs to 100%
            if (maxV > 100 && (graphFeedKey === 'temp' || graphFeedKey === 'temp2' || graphFeedKey === 'water')) {
                maxV = 100;
            }

            // Ensure minimum span of 10 (5 up, 5 down) if data is flat
            if (maxV - minV < 10) {
                const mid = (maxV + minV) / 2;
                minV = Math.floor(mid - 5);
                maxV = Math.ceil(mid + 5);
                if (minV < 0) minV = 0;
                if (maxV > 100) maxV = 100;
            }
        } else {
            minV = 0; maxV = 100;
        }
    } else {
        const allVals = [...bars1, ...bars2].filter(v => v !== 0 && v !== null && v !== undefined);
        maxV = allVals.length > 0 ? Math.max(...allVals) * 1.1 : 1;
        minV = 0;
    }

    const range = maxV - minV || 1;

    ctx.clearRect(0, 0, rect.width, rect.height);

    // ---- Y-axis grid ----
    ctx.fillStyle = '#71717a';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    const numGridLines = isTemp ? 5 : 4;
    for (let i = 0; i <= numGridLines; i++) {
        const val = minV + (i / numGridLines) * range;
        const y   = PT + cH - (i / numGridLines) * cH;
        const lbl = isTemp ? val.toFixed(1) + '°' : Math.round(val).toLocaleString();
        ctx.fillText(lbl, PL - 5, y + 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(PL + cW, y);
        ctx.stroke();
    }

    // ---- Clip to chart area ----
    ctx.save();
    ctx.beginPath();
    ctx.rect(PL, PT, cW, cH);
    ctx.clip();

    const n = bars1.length || (multiData?.[0]?.data?.length ?? 0);
    const isHourly = chartType === 'hourly';
    const isBar = chartType === 'bar';
    const isLine = chartType === 'line';

    if (multiData && multiData.length > 0) {
        // ---- Multi-line: draw each visible feed ----
        for (const line of multiData) {
            const data = line.data;
            
            if (isBar || isHourly) {
                // ---- Bar/Hourly mode for multi-data ----
                const barWidth = Math.max(2, (cW / n) * 0.7);
                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === 0 || val === null || val === undefined) continue;
                    const x = mapX(PL + (i / n) * cW) - barWidth / 2;
                    const y = PT + cH - ((val - minV) / range) * cH;
                    const h = PT + cH - y;
                    
                    ctx.fillStyle = line.color;
                    ctx.globalAlpha = 0.8;
                    ctx.fillRect(x, y, barWidth, h);
                    ctx.globalAlpha = 1;
                }
            } else {
                // ---- Line mode ----
                ctx.beginPath();
                ctx.strokeStyle = line.color;
                ctx.lineWidth = 2;
                let started = false;
                let lastDrawnX = null, lastDrawnY = null;

                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === 0 || val === null || val === undefined) { started = false; continue; }
                    const x = mapX(PL + (i / n) * cW);
                    const y = PT + cH - ((val - minV) / range) * cH;
                    if (!started) { ctx.moveTo(x, y); started = true; }
                    else ctx.lineTo(x, y);
                    lastDrawnX = x;
                    lastDrawnY = y;
                }
                ctx.stroke();

                // ---- End-of-line label ----
                if (lastDrawnX !== null && lastDrawnY !== null) {
                    ctx.beginPath();
                    ctx.arc(lastDrawnX, lastDrawnY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = line.color;
                    ctx.fill();

                    ctx.font = 'bold 10px system-ui';
                    ctx.textAlign = 'left';
                    ctx.fillStyle = line.color;
                    const labelX = Math.min(lastDrawnX + 6, PL + cW - 2);
                    const labelY = Math.max(PT + 8, Math.min(lastDrawnY + 4, PT + cH - 2));
                    ctx.fillText(line.label, labelX, labelY);
                }
            }
        }
    } else {
        // ---- Single / combined line ----
        const drawData = (data, clr, isSecondary = false) => {
            if (isBar || isHourly) {
                // ---- Bar/Hourly mode ----
                const barWidth = Math.max(2, (cW / n) * 0.6);
                const offset = isSecondary ? barWidth * 0.5 : 0;
                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === 0 || val === null || val === undefined) continue;
                    const x = mapX(PL + (i / n) * cW) - barWidth / 2 + offset;
                    const y = PT + cH - ((val - minV) / range) * cH;
                    const h = PT + cH - y;
                    
                    ctx.fillStyle = clr;
                    ctx.globalAlpha = isSecondary ? 0.6 : 0.8;
                    ctx.fillRect(x, y, barWidth * 0.8, h);
                    ctx.globalAlpha = 1;
                }
            } else {
                // ---- Line mode ----
                ctx.beginPath();
                ctx.strokeStyle = clr;
                ctx.lineWidth = isSecondary ? 1.5 : 2.5;
                let started = false;
                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === 0 || val === null || val === undefined) { started = false; continue; }
                    const x = mapX(PL + (i / n) * cW);
                    const y = PT + cH - ((val - minV) / range) * cH;
                    if (!started) { ctx.moveTo(x, y); started = true; }
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        };
        
        const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';
        if (isCombined || isTempCombined) {
            const c2 = isTempCombined ? '#6366f1' : color2;
            drawData(bars2, c2, true);
        }
        drawData(bars1, color1, false);
    }

    ctx.restore();

    // ---- X-axis labels ----
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.font = '9px system-ui';
    const skip = Math.max(1, Math.ceil(n / (8 * zoom)));
    for (let i = 0; i < n; i += skip) {
        const lx = mapX(PL + (i / n) * cW);
        if (lx > PL - 10 && lx < rect.width - PR) {
            ctx.fillText(labels[i] || '', lx, rect.height - 12);
        }
    }
}

// ---- Expose globally ----
window._fastRedraw         = _fastRedraw;
window._showRefreshPulse   = _showRefreshPulse;
window._attachDirectZoom   = _attachDirectZoom;
window._handleGraphHover   = _handleGraphHover;
window._drawChart          = _drawChart;
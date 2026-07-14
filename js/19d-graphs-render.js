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

    // ---- Get the exact time label for this data point ----
    let timeLabel = '--:--';
    if (nav && nav.fullLabels && nav.fullLabels[idx]) {
        timeLabel = nav.fullLabels[idx];
    } else if (nav && nav.timeLabels && nav.timeLabels[idx]) {
        timeLabel = nav.timeLabels[idx];
    } else if (nav && nav.isDayTab && nav.resSeconds) {
        const startMs = nav.startMs || 0;
        const ts = startMs + (idx * nav.resSeconds * 1000);
        const pktDate = getKarachiDate(ts);
        const h = pktDate.hour;
        const m = Math.round((ts - new Date(pktDate.year, pktDate.month - 1, pktDate.day, h, 0, 0).getTime()) / 60000);
        const ampm = h >= 12 ? 'pm' : 'am';
        const hh = h % 12 || 12;
        const mm = String(m).padStart(2, '0');
        timeLabel = `${hh}:${mm}${ampm}`;
    }

    const PT = 12, cH = rect.height - 12 - 34;
    const mouseY = clientY - rect.top;
    let closestLineIdx = 0;

    let tooltip = document.getElementById('graph-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'graph-tooltip';
        document.body.appendChild(tooltip);
    } else if (tooltip.parentElement !== document.body) {
        document.body.appendChild(tooltip);
    }

    const closeBtn = pin ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';
    let html = `<div style="font-weight:700;font-size:12px;color:var(--text-main);margin-bottom:4px;border-bottom:1px solid var(--border);padding-bottom:4px;">${timeLabel} ${closeBtn}</div>`;

    const isMonthOrYear = graphTab === 'month' || graphTab === 'year';
    const isDayView = graphTab === 'day';
    const isKwhView = isMonthOrYear;

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
            const isTemp = unit === '°C';
            let valStr;
            if (isKwhView) {
                valStr = val.toFixed(2) + ' kWh';
            } else if (isDayView) {
                valStr = isTemp ? val.toFixed(1) + ' °C' : Math.round(val) + ' W';
            } else {
                valStr = isTemp ? val.toFixed(1) + ' °C' : val.toFixed(2) + ' ' + unit;
            }
            const isFocused = (closestLineIdx === i + 1);
            const focusStyle = isFocused ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';
            html += `<div style="color:${line.color};margin:2px 0;${focusStyle}">
                ${isFocused ? '*' : '&nbsp;'} <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${line.color};margin-right:5px;vertical-align:middle;opacity:${isFocused?1:0.8}"></span>
                <b>${line.label}:</b> ${valStr}
            </div>`;
        });

        if (isDualY && barsTemp && idx < barsTemp.length) {
            const tempVal = barsTemp[idx] ?? 0;
            const isOvTemp = tempUnit === '°C';
            let tempValStr;
            if (isKwhView) {
                tempValStr = tempVal.toFixed(2) + ' kWh';
            } else if (isDayView) {
                tempValStr = isOvTemp ? tempVal.toFixed(1) + ' °C' : Math.round(tempVal) + ' W';
            } else {
                tempValStr = isOvTemp ? tempVal.toFixed(1) + ' °C' : Math.round(tempVal) + ' W';
            }
            const labelStr = overlayLabel || (isOvTemp ? 'Temp' : 'AC');
            html += `<div style="color:${tempColor};margin:2px 0;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tempColor};margin-right:5px;"></span>
                <b>${labelStr}:</b> ${tempValStr}
            </div>`;
        }
    } else {
        const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';
        const isTemp = unit === '°C' || isTempCombined;
        
        let val1;
        if (isKwhView) {
            val1 = (isTemp ? bars1[idx].toFixed(1) : bars1[idx].toFixed(2)) + ' kWh';
        } else if (isDayView) {
            val1 = (isTemp ? bars1[idx].toFixed(1) : Math.round(bars1[idx])) + ' ' + (isTempCombined ? '°C' : unit);
        } else {
            val1 = (isTemp ? bars1[idx].toFixed(1) : bars1[idx].toFixed(2)) + ' ' + (isTempCombined ? '°C' : unit);
        }
        
        let val2 = '';
        let c2 = color2;
        if (isCombined) {
            if (isKwhView) {
                val2 = bars2[idx].toFixed(2) + ' kWh';
            } else if (isDayView) {
                val2 = Math.round(bars2[idx]) + ' ' + unit;
            } else {
                val2 = bars2[idx].toFixed(2) + ' ' + unit;
            }
        }
        if (isTempCombined) { 
            if (isKwhView) {
                val2 = bars2[idx].toFixed(2) + ' kWh';
            } else if (isDayView) {
                val2 = Math.round(bars2[idx]) + ' %';
            } else {
                val2 = bars2[idx].toFixed(2) + ' %';
            }
            c2 = '#6366f1';
        }
        
        if (isCombined || isTempCombined) {
            const py1 = PT + cH - ((bars1[idx] - minV) / range) * cH;
            const py2 = PT + cH - ((bars2[idx] - minV) / range) * cH;
            closestLineIdx = Math.abs(mouseY - py1) < Math.abs(mouseY - py2) ? 1 : 2;
        } else {
            closestLineIdx = 1;
        }

        const l1 = isTempCombined ? 'Temp' : (isCombined ? 'Solar' : null);
        const l2 = isTempCombined ? 'Hum' : (isCombined ? 'Grid' : null);

        if (isDualY && barsTemp && idx < barsTemp.length) {
            const tempVal = barsTemp[idx] ?? 0;
            const isOvTemp = tempUnit === '°C';
            let tempValStr;
            if (isKwhView) {
                tempValStr = tempVal.toFixed(2) + ' kWh';
            } else if (isDayView) {
                tempValStr = isOvTemp ? tempVal.toFixed(1) + ' °C' : Math.round(tempVal) + ' W';
            } else {
                tempValStr = isOvTemp ? tempVal.toFixed(1) + ' °C' : Math.round(tempVal) + ' W';
            }
            const labelStr = overlayLabel || (isOvTemp ? 'Temp' : 'AC');
            html += `<div style="color:${tempColor};margin:2px 0;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tempColor};margin-right:5px;"></span>
                <b>${labelStr}:</b> ${tempValStr}
            </div>`;
        }

        const hl = isCombined || isTempCombined;
        if (hl) {
            const style1 = closestLineIdx === 1 ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';
            const style2 = closestLineIdx === 2 ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';
            html += `<div style="color:${color1};${style1}">${closestLineIdx === 1 ? '* ' : ''}● ${l1}: ${val1}</div>`;
            if (val2) html += `<div style="color:${c2};${style2}">${closestLineIdx === 2 ? '* ' : ''}● ${l2}: ${val2}</div>`;
        } else {
            html += `<div style="color:${color1};">● ${val1}</div>`;
        }
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
}

// ---- _drawChart with Multi-Line support + dual Y-axis for overlay ----
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

    const PL = 38, PR = 8, PT = 12, PB = 34;
    const cW = rect.width  - PL - PR;
    const cH = rect.height - PT - PB;
    const zoom = graphZoomLevel, panX = graphPanOffset, centerX = PL + cW / 2;
    const mapX = (x) => centerX + (x - centerX) * zoom + panX;

    const chartType = graphChartType || 'line';
    const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';
    const isTemp = unit === '°C' || isTempCombined;

    ctx.clearRect(0, 0, rect.width, rect.height);

    const isMonthOrYear = graphTab === 'month' || graphTab === 'year';
    const isKwhView = isMonthOrYear;
    const displayUnit = isKwhView ? 'kWh' : unit;

    ctx.fillStyle = '#71717a';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    const numGridLines = isTemp ? 5 : 4;
    for (let i = 0; i <= numGridLines; i++) {
        const val = minV + (i / numGridLines) * range;
        const y   = PT + cH - (i / numGridLines) * cH;
        let lbl;
        if (isKwhView) {
            lbl = val.toFixed(1);
        } else if (isTemp) {
            lbl = val.toFixed(1) + '°';
        } else {
            lbl = Math.round(val).toLocaleString();
        }
        ctx.fillText(lbl, PL - 5, y + 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.moveTo(PL, y);
        ctx.lineTo(PL + cW, y);
        ctx.stroke();
    }

    ctx.fillStyle = '#71717a';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'center';
    if (isKwhView) {
        ctx.fillText('kWh', 10, PT + 8);
    } else if (isTemp) {
        ctx.fillText('°C', 10, PT + 8);
    } else {
        ctx.fillText('W', 10, PT + 8);
    }

    if (barsTemp.length > 0) {
        ctx.fillStyle = '#71717a';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'left';
        const rightX = PL + cW + 4;
        const isOvTemp = tempUnit === '°C';
        for (let i = 0; i <= 4; i++) {
            const val = tempMinV + (i / 4) * tempRange;
            const y = PT + cH - (i / 4) * cH;
            let lbl;
            if (isKwhView) {
                lbl = val.toFixed(1);
            } else if (isOvTemp) {
                lbl = val.toFixed(1) + '°';
            } else {
                lbl = Math.round(val).toLocaleString();
            }
            ctx.fillText(lbl, rightX, y + 3);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        for (let i = 0; i <= 4; i++) {
            const y = PT + cH - (i / 4) * cH;
            ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
        }
        
        ctx.fillStyle = '#71717a';
        ctx.font = '8px system-ui';
        ctx.textAlign = 'center';
        if (isKwhView) {
            ctx.fillText('kWh', rect.width - 10, PT + 8);
        } else {
            ctx.fillText('W', rect.width - 10, PT + 8);
        }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(PL, PT, cW, cH);
    ctx.clip();

    const n = bars1.length || (multiData?.[0]?.data?.length ?? 0);
    const isHourly = chartType === 'hourly';
    const isBar = chartType === 'bar';

    if (multiData && multiData.length > 0) {
        for (const line of multiData) {
            const data = line.data;
            
            if (isBar || isHourly) {
                const barWidth = Math.max(2, (cW / n) * 0.7);
                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === null || val === undefined) continue;
                    const x = mapX(PL + (i / n) * cW) - barWidth / 2;
                    const y = PT + cH - ((val - minV) / range) * cH;
                    const h = PT + cH - y;
                    
                    ctx.fillStyle = line.color;
                    ctx.globalAlpha = 0.8;
                    ctx.fillRect(x, y, barWidth, h);
                    ctx.globalAlpha = 1;
                }
            } else {
                ctx.beginPath();
                ctx.strokeStyle = line.color;
                ctx.lineWidth = 2;
                let started = false;
                let lastDrawnX = null, lastDrawnY = null;

                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === null || val === undefined) { started = false; continue; }
                    const x = mapX(PL + (i / n) * cW);
                    const y = PT + cH - ((val - minV) / range) * cH;
                    if (!started) { ctx.moveTo(x, y); started = true; }
                    else ctx.lineTo(x, y);
                    lastDrawnX = x;
                    lastDrawnY = y;
                }
                ctx.stroke();

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
        const drawData = (data, clr, isSecondary = false) => {
            if (isBar || isHourly) {
                const barWidth = Math.max(2, (cW / n) * 0.6);
                const offset = isSecondary ? barWidth * 0.5 : 0;
                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === null || val === undefined) continue;
                    const x = mapX(PL + (i / n) * cW) - barWidth / 2 + offset;
                    const y = PT + cH - ((val - minV) / range) * cH;
                    const h = PT + cH - y;
                    
                    ctx.fillStyle = clr;
                    ctx.globalAlpha = isSecondary ? 0.6 : 0.8;
                    ctx.fillRect(x, y, barWidth * 0.8, h);
                    ctx.globalAlpha = 1;
                }
            } else {
                ctx.beginPath();
                ctx.strokeStyle = clr;
                ctx.lineWidth = isSecondary ? 1.5 : 2.5;
                let started = false;
                for (let i = 0; i < lastIdx; i++) {
                    if (i >= data.length) break;
                    const val = data[i];
                    if (val === null || val === undefined) { started = false; continue; }
                    const x = mapX(PL + (i / n) * cW);
                    const y = PT + cH - ((val - minV) / range) * cH;
                    if (!started) { ctx.moveTo(x, y); started = true; }
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
        };
        
        if (isCombined || isTempCombined) {
            const c2 = isTempCombined ? '#6366f1' : color2;
            drawData(bars2, c2, true);
        }
        drawData(bars1, color1, false);
    }

    if (barsTemp.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = tempColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        let started = false;
        for (let i = 0; i < lastIdx; i++) {
            if (i >= barsTemp.length) break;
            const val = barsTemp[i];
            if (val === null || val === undefined) { started = false; continue; }
            const x = mapX(PL + (i / n) * cW);
            const y = PT + cH - ((val - tempMinV) / tempRange) * cH;
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.restore();

    // ---- X-axis labels with dynamic detail based on zoom ----
    ctx.fillStyle = '#71717a';
    ctx.textAlign = 'center';
    ctx.font = '9px system-ui';

    const isZoomed = zoom > 2;
    const labelStep = isZoomed ? Math.max(1, Math.ceil(n / (20 * zoom))) : Math.max(1, Math.ceil(n / (8 * zoom)));

    // Use fullLabels when zoomed, otherwise use labels
    const displayLabels = (isZoomed && nav && nav.fullLabels) ? nav.fullLabels : (labels || []);

    for (let i = 0; i < n; i += labelStep) {
        const lx = mapX(PL + (i / n) * cW);
        if (lx > PL - 10 && lx < rect.width - PR) {
            let label = displayLabels[i] || '';
            // If zoomed out and label is too long, truncate to hour only
            if (!isZoomed && label.length > 6) {
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

// ---- Expose globally ----
window._fastRedraw         = _fastRedraw;
window._showRefreshPulse   = _showRefreshPulse;
window._attachDirectZoom   = _attachDirectZoom;
window._handleGraphHover   = _handleGraphHover;
window._drawChart          = _drawChart;
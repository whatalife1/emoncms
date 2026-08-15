// js/19d4-graphs-render-hover.js
// ─── Tooltip / hover logic for graphs ───────────────────────────────────────

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
  if (idx < 0 || idx >= n || idx >= lastIdx) { if (!pin) hideTooltip(); return; }
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
  if (!tooltip) { tooltip = document.createElement('div'); tooltip.id = 'graph-tooltip'; document.body.appendChild(tooltip); }
  const closeBtn = pin ? `<span class="close-btn" onclick="hideTooltip();">✕</span>` : '';

  // ─── Moment Flow Inspector tooltip ───
  if (graphDataCache.isMomentFlow && multiData) {
    const timestampSec = Math.floor((nav.startMs + (idx * nav.resSeconds * 1000)) / 1000);
    replayFlowDiagramAtMoment(multiData, idx, timestampSec);
    const factor = (nav.resSeconds || 120) / 3600000;
    const startMs = nav.startMs || 0;
    const getCumStats = (dataArr, key = '') => {
      if (!dataArr) return { totalKwh: 0, dayKwh: 0, nightKwh: 0, dayAvgW: 0, nightAvgW: 0 };
      let totalSum = 0, daySum = 0, nightSum = 0, dayCount = 0, nightCount = 0;
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
          if (h >= dayStart && h < dayEnd) { daySum += val; dayCount++; }
          else { nightSum += val; nightCount++; }
        }
      }
      return {
        totalKwh: totalSum * factor, dayKwh: daySum * factor, nightKwh: nightSum * factor,
        dayAvgW: dayCount > 0 ? Math.round(daySum / dayCount) : 0,
        nightAvgW: nightCount > 0 ? Math.round(nightSum / nightCount) : 0
      };
    };
    const loads = multiData.filter(m => m.key !== 'solar' && m.key !== 'grid').map(m => {
      const watts = Math.max(0, Math.round(m.data[idx] || 0));
      const stats = getCumStats(m.data, m.key);
      return { key: m.key, label: m.label, color: m.color, watts, stats };
    });
    const solarItem = multiData.find(m => m.key === 'solar');
    const gridItem  = multiData.find(m => m.key === 'grid');
    const solarW     = Math.round(solarItem?.data[idx] || 0);
    const solarStats = getCumStats(solarItem?.data, 'solar');
    const gridW      = Math.round(gridItem?.data[idx] || 0);
    const gridStats  = getCumStats(gridItem?.data, 'grid');
    const othersData = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      const sW = (solarItem?.data?.[k] != null && solarItem.data[k] > 0) ? solarItem.data[k] : 0;
      const gW = (gridItem?.data?.[k] != null && gridItem.data[k] > 0) ? gridItem.data[k] : 0;
      const totSupplied = sW + gW;
      let trackedSum = 0;
      loads.forEach(l => {
        const item = multiData.find(m => m.key === l.key);
        if (item && item.data?.[k] != null && item.data[k] > 0) trackedSum += item.data[k];
      });
      othersData[k] = Math.max(0, totSupplied - trackedSum);
    }
    const othersW = Math.round(othersData[idx] || 0);
    const othersStats = getCumStats(othersData, 'others');
    loads.push({ key: 'others', label: 'Others (Fans, Lights...)', color: '#f59e0b', watts: othersW, stats: othersStats });
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
      </div>`;
    if (isMobileScreen) {
      htmlStr += `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-bottom:6px; font-size:11px; background:var(--bg-card); padding:6px 8px; border-radius:8px; border:1px solid var(--border); text-align:center;">
        <div><div style="color:#ef4444; font-weight:800;">⚡ Grid</div><div style="font-weight:800; color:var(--text-main); font-size:12px;">${gridW} W</div><div style="font-size:9.5px; color:var(--text-muted);">${gridStats.totalKwh.toFixed(2)} kWh</div></div>
        <div style="border-left:1px solid var(--border); border-right:1px solid var(--border);"><div style="color:#facc15; font-weight:800;">☀ Solar</div><div style="font-weight:800; color:var(--text-main); font-size:12px;">${solarW} W</div><div style="font-size:9.5px; color:var(--text-muted);">${solarStats.totalKwh.toFixed(2)} kWh</div></div>
        <div><div style="color:#38bdf8; font-weight:800;">💡 Load</div><div style="font-weight:800; color:var(--text-main); font-size:12px;">${totLoad} W</div><div style="font-size:9.5px; color:var(--text-muted);">${totLoadKwh.toFixed(2)} kWh</div></div>
      </div>
      <div style="font-size:9.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; border-bottom:1px dashed var(--border); padding-bottom:2px;">Appliance Breakdown at ${timeLabel}:</div>`;
    } else {
      htmlStr += `
      <div style="display:flex; flex-direction:column; gap:5px; margin-bottom:8px; font-size:12px; background:var(--bg-card); padding:8px 10px; border-radius:8px; border:1px solid var(--border);">
        <div><div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:#ef4444; font-weight:800;">⚡ Grid: ${gridW} W</span><span style="color:#ef4444; font-weight:700;">Tot: ${gridStats.totalKwh.toFixed(2)} kWh</span></div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;"><span>☀️ Day: ${gridStats.dayKwh.toFixed(2)} kWh (${gridStats.dayAvgW} W)</span><span>🌙 Night: ${gridStats.nightKwh.toFixed(2)} kWh (${gridStats.nightAvgW} W)</span></div></div>
        <div style="border-top:1px dashed var(--border); padding-top:4px;"><div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:#facc15; font-weight:800;">☀ Solar: ${solarW} W</span><span style="color:#facc15; font-weight:700;">Tot: ${solarStats.totalKwh.toFixed(2)} kWh</span></div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;"><span>☀️ Day: ${solarStats.dayKwh.toFixed(2)} kWh (${solarStats.dayAvgW} W)</span><span></span></div></div>
        <div style="border-top:1px dashed var(--border); padding-top:4px;"><div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:#38bdf8; font-weight:800;">💡 Load: ${totLoad} W</span><span style="color:#38bdf8; font-weight:700;">Tot: ${totLoadKwh.toFixed(2)} kWh</span></div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:2px;"><span>☀️ Day: ${totDayKwh.toFixed(2)} kWh (${totDayAvgW} W)</span><span>🌙 Night: ${totNightKwh.toFixed(2)} kWh (${totNightAvgW} W)</span></div></div>
      </div>
      <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px; border-bottom:1px dashed var(--border); padding-bottom:3px;">Appliance Current & Total at ${timeLabel}:</div>`;
    }
    loads.forEach(l => {
      const isActive = l.watts > 5;
      const opacity = isActive ? '1' : '0.5';
      const fontWt  = isActive ? '800' : '600';
      if (isMobileScreen && !isActive) {
        htmlStr += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; margin:2px 0; opacity:${opacity};"><div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${l.color};"></span><span style="color:${l.color}; font-weight:700;">${l.label}</span></div><div style="font-family:monospace;"><span style="color:var(--text-muted);">0 W</span><span style="font-size:9px; color:var(--accent-kwh); margin-left:3px;">(${l.stats.totalKwh.toFixed(2)} kWh)</span></div></div>`;
      } else {
        htmlStr += `<div style="display:flex; justify-content:space-between; align-items:flex-start; font-size:${isMobileScreen ? '10.5px' : '12px'}; margin:${isMobileScreen ? '2px 0' : '4px 0'}; padding:1px 0; opacity:${opacity}; border-bottom:1px solid rgba(255,255,255,0.03);"><div style="display:flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0;"><span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${l.color};"></span><span style="color:${l.color}; font-weight:700;">${l.label}</span></div><div style="text-align:right; font-family:monospace; white-space:nowrap; margin-left:8px;"><span style="font-weight:${fontWt}; color:var(--text-main);">${l.watts} W</span><span style="font-size:${isMobileScreen ? '9.5px' : '11px'}; color:var(--accent-kwh); margin-left:3px;">(${l.stats.totalKwh.toFixed(2)} kWh)</span><div style="font-size:${isMobileScreen ? '9px' : '10.5px'}; color:var(--text-muted); font-weight:normal; margin-top:1px;">☀️ ${l.stats.dayKwh.toFixed(2)} kWh (${l.stats.dayAvgW}W) &bull; 🌙 ${l.stats.nightKwh.toFixed(2)} kWh (${l.stats.nightAvgW}W)</div></div></div>`;
      }
    });
    tooltip.innerHTML = htmlStr;
    tooltip.style.display = 'block';
    tooltip.classList.toggle('pinned', pin);
    let left = clientX + 15; let top = clientY - 15;
    const tRect = tooltip.getBoundingClientRect();
    if (left + tRect.width > window.innerWidth - 10) left = clientX - tRect.width - 15;
    if (top + tRect.height > window.innerHeight - 10) top = clientY - tRect.height - 15;
    tooltip.style.left = Math.max(10, left) + 'px';
    tooltip.style.top  = Math.max(10, top) + 'px';
    return;
  }

  // ─── Standard graph tooltip ───
  let html = `<div style="font-weight:700;font-size:12px;color:var(--text-main);margin-bottom:4px;border-bottom:1px solid var(--border);padding-bottom:4px;">${timeLabel} ${closeBtn}</div>`;
  const mouseY = clientY - rect.top;
  const PT = 12, cH = rect.height - 12 - 34;
  if (multiData && multiData.length > 0) {
    let minDist = 999; let closestLineIdx = 0;
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
      let valStr = isKwhView ? val.toFixed(2) + ' kWh' : (isLineTemp ? val.toFixed(1) + ' °C' : Math.round(val) + ' W');
      const isFocused = (closestLineIdx === i + 1);
      const focusStyle = isFocused ? 'font-weight:900;font-size:13px;filter:brightness(1.2);' : 'opacity:0.6;';
      html += `<div style="color:${line.color};margin:2px 0;${focusStyle}">${isFocused ? '*' : '&nbsp;'} <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${line.color};margin-right:5px;vertical-align:middle;"></span><b>${line.label}:</b> ${valStr}</div>`;
    });
  } else {
    const isTempCombined = graphFeedKey === 'temp' || graphFeedKey === 'temp2';
    const isTooltipTemp = unit === '°C' || isTempCombined;
    const val1Raw = bars1[idx] || 0;
    const val1 = isKwhView ? val1Raw.toFixed(2) + ' kWh' : (isTooltipTemp ? val1Raw.toFixed(1) + ' °C' : Math.round(val1Raw) + ' ' + unit);
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

  // Dual Y overlays (Secondary lines)
  const formatOverlayVal = (val, label) => {
    if (!label) label = '';
    if (label.includes('(W)')) return Math.round(val) + ' W';
    if (label.includes('%')) return Math.round(val) + ' %';
    if (label.includes('Cumul') || label.includes('kWh')) return val.toFixed(2) + ' kWh';
    if (tempUnit === '°C') return val.toFixed(1) + ' °C';
    if (tempUnit === 'V') return Math.round(val) + ' V';
    return isKwhView ? val.toFixed(2) + ' kWh' : Math.round(val) + ' W';
  };

  if (isDualY && barsTemp && idx < barsTemp.length) {
    const tVal = barsTemp[idx] ?? 0;
    const tValStr = formatOverlayVal(tVal, overlayLabel);
    html += `<div style="color:${tempColor};margin-top:4px;border-top:1px dashed var(--border);padding-top:4px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${tempColor};margin-right:5px;"></span><b>${overlayLabel || 'Overlay'}:</b> ${tValStr}</div>`;
  }
  if (graphDataCache.barsTemp2 && idx < graphDataCache.barsTemp2.length) {
    const tVal2 = graphDataCache.barsTemp2[idx] ?? 0;
    const tVal2Str = formatOverlayVal(tVal2, graphDataCache.overlayLabel2);
    html += `<div style="color:${graphDataCache.tempColor2};margin-top:2px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${graphDataCache.tempColor2};margin-right:5px;"></span><b>${graphDataCache.overlayLabel2}:</b> ${tVal2Str}</div>`;
  }
  if (graphDataCache.barsTemp3 && idx < graphDataCache.barsTemp3.length) {
    const tVal3 = graphDataCache.barsTemp3[idx] ?? 0;
    const tVal3Str = formatOverlayVal(tVal3, graphDataCache.overlayLabel3);
    html += `<div style="color:${graphDataCache.tempColor3};margin-top:2px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${graphDataCache.tempColor3};margin-right:5px;"></span><b>${graphDataCache.overlayLabel3}:</b> ${tVal3Str}</div>`;
  }

  tooltip.innerHTML = html;
  tooltip.style.display = 'block';
  tooltip.classList.toggle('pinned', pin);
  let left = clientX + 15; let top = clientY - 15;
  const tRect = tooltip.getBoundingClientRect();
  if (left + tRect.width > window.innerWidth - 10) left = clientX - tRect.width - 15;
  if (top + tRect.height > window.innerHeight - 10) top = window.innerHeight - tRect.height - 10;
  tooltip.style.left = Math.max(10, left) + 'px';
  tooltip.style.top  = Math.max(10, top) + 'px';
}
window._handleGraphHover = _handleGraphHover;

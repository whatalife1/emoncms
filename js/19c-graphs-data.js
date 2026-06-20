// ─── Replace the stat rendering section in _loadAndDraw ────────────────────
// Find this section in the _loadAndDraw function and replace it completely

// ─── STYLING THE HEADER MULTI-LINE CONTAINER DYNAMICALLY ─────────────────
stat.style.display = 'flex';
stat.style.flexDirection = 'column';
stat.style.gap = '4px';
stat.style.paddingRight = '85px';
stat.style.minHeight = '40px';
stat.style.marginBottom = '8px';

// Helper to calculate averages for specific time ranges
const calcAvgForRange = (bars, startHour, endHour, nav, resMins) => {
  if (!nav.isDayTab) return null;
  const totalHours = 24;
  const barsPerHour = nav.nBars / totalHours;
  
  // Handle wrap-around (e.g., 17-24 and 0-8)
  if (startHour > endHour) {
    // Night: 17:00-24:00 and 00:00-08:00
    const firstPart = calcAvgForRange(bars, startHour, 24, nav, resMins);
    const secondPart = calcAvgForRange(bars, 0, endHour, nav, resMins);
    if (firstPart !== null && secondPart !== null) {
      return (firstPart + secondPart) / 2;
    }
    return firstPart !== null ? firstPart : secondPart;
  }
  
  let startIdx = Math.floor(startHour * barsPerHour);
  let endIdx = Math.ceil(endHour * barsPerHour);
  
  let sum = 0;
  let count = 0;
  for (let i = startIdx; i < endIdx && i < bars.length; i++) {
    if (bars[i] > 0) {
      sum += bars[i];
      count++;
    }
  }
  return count > 0 ? sum / count : null;
};

const formatStatLine = (icon, label, kwh, accentColor, peakVal, avgVal, nightAvgVal, unit, isCombined = false) => {
  const kwhDisplay = kwh.toFixed(1);
  const peakDisplay = Math.round(peakVal).toLocaleString('en-US');
  const avgDisplay = avgVal !== null ? Math.round(avgVal).toLocaleString('en-US') : '--';
  const nightDisplay = nightAvgVal !== null ? Math.round(nightAvgVal).toLocaleString('en-US') : '--';
  
  // Determine peak color based on value
  let peakColor = accentColor;
  let peakClass = '';
  if (peakVal > 0) {
    const ratio = peakVal / Math.max(...[peakVal, 100]);
    if (ratio > 0.8) { peakColor = '#ef4444'; peakClass = 'peak-extreme'; }
    else if (ratio > 0.6) { peakColor = '#f97316'; peakClass = 'peak-high'; }
    else if (ratio > 0.4) { peakColor = '#f59e0b'; peakClass = 'peak-medium'; }
  }
  
  let nightHtml = '';
  if (nightAvgVal !== null && nightAvgVal > 0) {
    nightHtml = `· Night: <span class="night-value" style="color:#c084fc; font-weight:700;">${nightDisplay}</span> W`;
  }
  
  let avgHtml = '';
  if (avgVal !== null && avgVal > 0) {
    avgHtml = `· Avg: <span class="avg-value" style="color:${accentColor}; font-weight:700;">${avgDisplay}</span> W`;
  }
  
  return `<div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:13px; font-weight:700; line-height:1.4;">
    <span style="color:${accentColor};">${icon} ${label}:</span>
    <span style="color:var(--text-main); font-weight:800; margin-left:2px; font-size:15px;">${kwhDisplay} kWh</span>
    <span style="color:var(--text-muted); font-size:11px; font-weight:600; margin-left:4px;">
      (Peak: <span class="peak-high ${peakClass}" style="color:${peakColor}; font-weight:800;">${peakDisplay}</span> W
      ${avgHtml}
      ${nightHtml})
    </span>
  </div>`;
};

if (isCombined) {
  if (nav.isDayTab) {
    const max1 = Math.max(0, ...bars1);
    const max2 = Math.max(0, ...bars2);
    const avgSolar = _calcAvgWatts(bars1, 5, 17, nav);
    const nightAvgSolar = calcAvgForRange(bars1, 17, 8, nav, nav.resMins);
    const avgGrid = _calcAvgWatts(bars2, 0, 24, nav);
    const nightAvgGrid = calcAvgForRange(bars2, 17, 8, nav, nav.resMins);
    
    stat.innerHTML = `
      ${formatStatLine('☀', 'Solar', totalKwh1, color1, max1, avgSolar, nightAvgSolar, unit)}
      ${formatStatLine('⚡', 'Grid', totalKwh2, color2, max2, avgGrid, nightAvgGrid, unit)}
    `;
  } else {
    const avg1 = totalKwh1 / validCount;
    const avg2 = totalKwh2 / validCount;
    const avgUnit = nav.isYearly ? 'kWh/mo' : 'kWh/day';
    
    stat.innerHTML = `
      ${formatStatLine('☀', 'Solar', totalKwh1, color1, 0, null, null, unit)}
      ${formatStatLine('⚡', 'Grid', totalKwh2, color2, 0, null, null, unit)}
    `;
  }
} else {
  if (isAvg) {
    const validBars = bars1.slice(0, validCount).filter(b => b > 0);
    const val = validBars.length > 0 ? (validBars.reduce((a,b)=>a+b,0)/validBars.length) : 0;
    
    stat.innerHTML = `
      <div style="font-size:13px; font-weight:700; color:${color1}; line-height:1.4; display:flex; align-items:center;">
        <span>${fA?.label}:</span>
        <span style="color:var(--text-main); font-weight:800; margin-left:6px; font-size:15px;">${val.toFixed(1)} ${unit}</span>
      </div>
    `;
  } else {
    if (nav.isDayTab) {
      const max1 = Math.max(0, ...bars1);
      const isSolarFeed = graphFeedKey === 'solar';
      const startHour = isSolarFeed ? 5 : 0;
      const endHour = isSolarFeed ? 17 : 24;
      const avgWatts = _calcAvgWatts(bars1, startHour, endHour, nav);
      const nightAvgWatts = calcAvgForRange(bars1, 17, 8, nav, nav.resMins);
      
      stat.innerHTML = `
        ${formatStatLine(isSolarFeed ? '☀' : '🔌', fA?.label || '', totalKwh1, color1, max1, avgWatts, nightAvgWatts, unit)}
      `;
    } else {
      const max1 = Math.max(0, ...bars1.slice(0, validCount));
      const avg1 = totalKwh1 / validCount;
      const avgUnit = nav.isYearly ? 'kWh/mo' : 'kWh/day';
      
      stat.innerHTML = `
        ${formatStatLine('🔌', fA?.label || '', totalKwh1, color1, max1, avg1, null, unit)}
      `;
    }
  }
}
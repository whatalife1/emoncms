// ─── Graphs Panel - Data Layer ─────────────────────────────────────────────
let graphIsLoading = false;

async function _gFetch(feedId, startMs, endMs, interval) {
  if (!feedId) return [];
  const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=0&interval=${interval}`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return [];
    const root = JSON.parse(text);
    if (!Array.isArray(root)||!root.length) return [];
    const data = root[0]?.data || root;
    return data.filter(p => p && p[1] != null);
  } catch(e) { return []; }
}

function _pointsToBars(pts, nav, feedKey) {
  const isAvgFeed = feedKey.startsWith('temp') || feedKey === 'water' || feedKey === 'AC Volts';
  if (nav.isDayTab) {
    const bars = Array(nav.nBars).fill(0);
    for (const [ts, v] of pts) {
      const offsetMs = ts - nav.startMs;
      const idx = Math.floor(offsetMs / (nav.resMins * 60000));
      if (idx >= 0 && idx < nav.nBars) bars[idx] = v;
    }
    return bars;
  }
  const kwhFactor = (nav.interval / 3600) / 1000;
  if (nav.isYearly) {
    const bars = Array(12).fill(0), counts = Array(12).fill(0);
    for (const [ts,v] of pts) { 
      const m = new Date(ts).getMonth();
      bars[m] += isAvgFeed ? v : (v * kwhFactor); counts[m]++;
    }
    return isAvgFeed ? bars.map((v, i) => counts[i]>0 ? v/counts[i] : 0) : bars;
  }
  const bars = Array(nav.nBars || 1).fill(0);
  for (const [ts,v] of pts) { 
    const d = new Date(ts); 
    const dayIdx = d.getDate()-1;
    if (dayIdx >= 0 && dayIdx < bars.length) bars[dayIdx] += isAvgFeed ? v : (v * kwhFactor);
  }
  return bars;
}

function _calcAvgForRange(bars, startHour, endHour, nav, lastIdx) {
  if (!nav.isDayTab) return null;
  const barsPerHour = nav.nBars / 24;
  if (startHour > endHour) {
    let sum = 0, count = 0;
    for (let i = Math.floor(startHour * barsPerHour); i < Math.floor(24 * barsPerHour); i++) {
        if (bars[i] !== 0 && i < (lastIdx || bars.length)) { sum += bars[i]; count++; }
    }
    for (let i = 0; i < Math.ceil(endHour * barsPerHour); i++) {
        if (bars[i] !== 0 && i < (lastIdx || bars.length)) { sum += bars[i]; count++; }
    }
    return count > 0 ? sum / count : null;
  }
  const startIdx = Math.floor(startHour * barsPerHour);
  const endIdx = Math.min(lastIdx || bars.length, Math.ceil(endHour * barsPerHour));
  let sum = 0, count = 0;
  for (let i = startIdx; i < endIdx; i++) {
    if (bars[i] !== 0) { sum += bars[i]; count++; }
  }
  return count > 0 ? sum / count : null;
}

function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, nightAvgVal, unit, isKwh) {
  const lblLower = label.toLowerCase();
  const isSolar = lblLower.includes('solar');
  const isTemp = lblLower.includes('temp');
  const hideNight = isSolar || isTemp;

  // Peak color logic
  let peakColor = accentColor;
  if (peakVal > 1500 && !isTemp) peakColor = '#ef4444';
  else if (peakVal > 1000 && !isTemp) peakColor = '#f97316';
  
  // SHARED STYLE for Peak, Avg, and Night to ensure they are huge and identical
  const boldStyle = `font-size: 15.5px; font-weight: 900;`;

  // AVG STYLING
  const avgHtml = (avgVal !== null && avgVal !== 0) 
    ? ` · <span style="color:${accentColor}; ${boldStyle}">Avg: ${Math.round(avgVal)} ${unit}</span>` 
    : '';

  // NIGHT STYLING - Using same 15.5px and 900 weight
  const nightHtml = (!hideNight && nightAvgVal !== null && nightAvgVal !== 0) 
    ? ` · <span style="color:#bf7aff; ${boldStyle}">Night: ${Math.round(nightAvgVal)} ${unit}</span>` 
    : '';

  const mainDisplay = isKwh ? `${mainVal.toFixed(1)} kWh` : `${mainVal.toFixed(1)} ${unit}`;

  return `<div style="display:flex; align-items:center; gap:6px; font-size:14px; font-weight:700; margin-bottom:5px; flex-wrap:wrap;">
    <span style="color:${accentColor}">${icon} ${label}:</span>
    <span style="color:var(--text-main); font-size:17px; font-weight:900;">${mainDisplay}</span>
    <span style="color:var(--text-muted); font-size:13px; font-weight:600; margin-left:2px;">
      (<span style="font-size:13px">Peak:</span> <span style="color:${peakColor}; ${boldStyle}">${Math.round(peakVal).toLocaleString()}</span> ${unit}${avgHtml}${nightHtml})
    </span>
  </div>`;
}



async function _loadAndDraw() {
  if (graphIsLoading) return;
  graphIsLoading = true; _showGraphLoading(true);
  const stat = document.getElementById('graph-stat'), canvas = document.getElementById('graph-canvas');
  if (!canvas||!stat) { graphIsLoading = false; _showGraphLoading(false); return; }
  stat.textContent = 'Loading…'; hideTooltip();

  try {
    const nav = _gNavInfo();
    const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey), isCombined = graphFeedKey === 'combined';
    let pts1=[], pts2=[];
    if (isCombined) {
      pts1 = await _gFetch(GRAPH_FEEDS.find(f=>f.key==='solar').id, nav.startMs, nav.endMs, nav.interval);
      pts2 = await _gFetch(GRAPH_FEEDS.find(f=>f.key==='grid').id, nav.startMs, nav.endMs, nav.interval);
    } else { pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval); }

    const bars1 = _pointsToBars(pts1, nav, graphFeedKey);
    const bars2 = isCombined ? _pointsToBars(pts2, nav, 'grid') : [];
    
    let lastIdx = bars1.length;
    if (graphTab === 'day' && graphDateNav === 0) {
      lastIdx = Math.floor((Date.now() - nav.startMs) / (nav.resMins * 60000)) + 1;
    }

    let unit = (nav.isDayTab ? 'W' : 'kWh');
    if (graphFeedKey.startsWith('temp')) unit = '°C';
    else if (graphFeedKey === 'water') unit = '%';
    else if (graphFeedKey === 'AC Volts') unit = 'V';

    const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15'), color2 = '#ef4444';
    graphDataCache = { bars1, bars2, labels: nav.labels, color1, color2, unit, isCombined, nav, lastIdx };
    
    _drawChart(canvas, bars1, bars2, nav.labels, color1, color2, unit, isCombined, nav, lastIdx);

    const isAvgFeed = graphFeedKey.startsWith('temp') || graphFeedKey === 'water' || graphFeedKey === 'AC Volts';
    const factor = nav.isDayTab && !isAvgFeed ? (nav.resMins/60)/1000 : 1;
    
    const t1 = isAvgFeed ? (bars1.slice(0, lastIdx).reduce((a,b)=>a+b,0)/lastIdx) : (bars1.reduce((a,b,i)=>i<lastIdx?a+b:a, 0)*factor);
    const t2 = isCombined ? (bars2.reduce((a,b,i)=>i<lastIdx?a+b:a, 0)*factor) : 0;

    if (isCombined) {
      stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, Math.max(...bars1), _calcAvgForRange(bars1,5,17,nav,lastIdx), null, 'W', true) +
                       _formatStatLine('⚡', 'Grid', t2, color2, Math.max(...bars2), _calcAvgForRange(bars2,0,24,nav,lastIdx), _calcAvgForRange(bars2,17,8,nav,lastIdx), 'W', true);
    } else {
      const isSol = graphFeedKey==='solar';
      stat.innerHTML = _formatStatLine('', fA.label, t1, color1, Math.max(...bars1), _calcAvgForRange(bars1,isSol?5:0,isSol?17:24,nav,lastIdx), _calcAvgForRange(bars1,17,8,nav,lastIdx), unit, !isAvgFeed);
    }
  } catch(e) { console.error(e); stat.textContent = 'Error loading data'; }
  finally { graphIsLoading = false; _showGraphLoading(false); }
}
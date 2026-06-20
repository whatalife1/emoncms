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
  
  // Handle wrap-around for night (e.g. 17 to 8)
  if (startHour > endHour) {
    let sum = 0, count = 0;
    // Part 1: StartHour to 24
    for (let i = Math.floor(startHour * barsPerHour); i < Math.floor(24 * barsPerHour); i++) {
        if (bars[i] > 0 && i < (lastIdx || bars.length)) { sum += bars[i]; count++; }
    }
    // Part 2: 0 to EndHour
    for (let i = 0; i < Math.ceil(endHour * barsPerHour); i++) {
        if (bars[i] > 0 && i < (lastIdx || bars.length)) { sum += bars[i]; count++; }
    }
    return count > 0 ? sum / count : null;
  }

  const startIdx = Math.floor(startHour * barsPerHour);
  const endIdx = Math.min(lastIdx || bars.length, Math.ceil(endHour * barsPerHour));
  let sum = 0, count = 0;
  for (let i = startIdx; i < endIdx; i++) {
    if (bars[i] > 0) { sum += bars[i]; count++; }
  }
  return count > 0 ? sum / count : null;
}

function _formatStatLine(icon, label, kwh, accentColor, peakVal, avgVal, nightAvgVal, unit) {
  const lblLower = label.toLowerCase();
  const isSolar = lblLower.includes('solar');
  const isTemp = lblLower.includes('temp');
  const hideNight = isSolar || isTemp;

  let peakColor = accentColor;
  if (peakVal > 1500) peakColor = '#ef4444';
  else if (peakVal > 1000) peakColor = '#f97316';

  const nightHtml = (!hideNight && nightAvgVal !== null && nightAvgVal > 0) 
    ? ` · <span style="color:#a855f7">Night: ${Math.round(nightAvgVal)} W</span>` 
    : '';
  
  const avgHtml = (avgVal !== null && avgVal > 0) ? ` · Avg: ${Math.round(avgVal)} W` : '';

  return `
    <div class="stat-row">
      <div class="stat-primary" style="font-size:15px; font-weight:700;">
        <span style="color:${accentColor}">${icon} ${label}:</span>
        <span style="color:var(--text-main); font-size:17px; font-weight:800;">${kwh.toFixed(1)} kWh</span>
      </div>
      <div class="stat-meta" style="color:var(--text-muted); font-size:12px; font-weight:600;">
        (<span style="font-size:13px">Peak:</span> 
        <span style="color:${peakColor}; font-size:15px; font-weight:800">${Math.round(peakVal).toLocaleString()}</span> W${avgHtml}${nightHtml})
      </div>
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
    } else {
      pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval);
    }

    const bars1 = _pointsToBars(pts1, nav, graphFeedKey);
    const bars2 = isCombined ? _pointsToBars(pts2, nav, 'grid') : [];
    
    let lastIdx = bars1.length;
    if (graphTab === 'day' && graphDateNav === 0) {
      lastIdx = Math.floor((Date.now() - nav.startMs) / (nav.resMins * 60000)) + 1;
    }

    const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15'), color2 = '#ef4444';
    graphDataCache = { bars1, bars2, labels: nav.labels, color1, color2, unit: (nav.isDayTab?'W':'kWh'), isCombined, nav, lastIdx };
    
    _drawChart(canvas, bars1, bars2, nav.labels, color1, color2, graphDataCache.unit, isCombined, nav, lastIdx);

    const isAvg = graphFeedKey.startsWith('temp') || graphFeedKey === 'water';
    const factor = nav.isDayTab && !isAvg ? (nav.resMins/60)/1000 : 1;
    const t1 = bars1.reduce((a,b,i)=>i<lastIdx?a+b:a, 0)*factor;
    const t2 = isCombined ? bars2.reduce((a,b,i)=>i<lastIdx?a+b:a, 0)*factor : 0;

    if (isCombined) {
      stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, Math.max(...bars1), _calcAvgForRange(bars1,5,17,nav,lastIdx), _calcAvgForRange(bars1,17,8,nav,lastIdx)) +
                       _formatStatLine('⚡', 'Grid', t2, color2, Math.max(...bars2), _calcAvgForRange(bars2,0,24,nav,lastIdx), _calcAvgForRange(bars2,17,8,nav,lastIdx));
    } else if (isAvg) {
      const v = bars1.length? (bars1.reduce((a,b)=>a+b,0)/bars1.length) : 0;
      stat.innerHTML = `<div style="color:${color1};font-weight:700;font-size:15px">${fA.label}: ${v.toFixed(1)} ${graphDataCache.unit}</div>`;
    } else {
      const isSol = graphFeedKey==='solar';
      stat.innerHTML = _formatStatLine('', fA.label, t1, color1, Math.max(...bars1), _calcAvgForRange(bars1,isSol?5:0,isSol?17:24,nav,lastIdx), _calcAvgForRange(bars1,17,8,nav,lastIdx));
    }
  } catch(e) { stat.textContent = 'Error loading data'; }
  finally { graphIsLoading = false; _showGraphLoading(false); }
}
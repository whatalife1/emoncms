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
  const isAvgFeed = feedKey.startsWith('temp') || feedKey === 'water' || feedKey === 'acvolts' || feedKey === 'AC Volts';
  const bars = Array(nav.nBars || 1).fill(0);
  const counts = Array(nav.nBars || 1).fill(0);
  
  const now = new Date();
  const nowMs = now.getTime();

  for (const [ts, v] of pts) {
    let idx = -1;
    let factor = 1;

    if (nav.isDayTab) {
      // Changed to use seconds
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

function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, nightAvgVal, unit, isKwh, currentTab) {
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
      // Updated to use seconds
      lastIdx = Math.floor((Date.now() - nav.startMs) / (nav.resSeconds * 1000)) + 1;
    }

    let unit = (nav.isDayTab ? 'W' : 'kWh');
    if (graphFeedKey.startsWith('temp')) unit = '°C';
    else if (graphFeedKey === 'water') unit = '%';
    else if (graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts') unit = 'V';

    const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15'), color2 = '#ef4444';
    graphDataCache = { bars1, bars2, labels: nav.labels, color1, color2, unit, isCombined, nav, lastIdx };
    
    _drawChart(canvas, bars1, bars2, nav.labels, color1, color2, unit, isCombined, nav, lastIdx);

    const isAvgFeed = graphFeedKey.startsWith('temp') || graphFeedKey === 'water' || graphFeedKey === 'acvolts' || graphFeedKey === 'AC Volts';
    // dayFactor updated to use seconds
    const dayFactor = (nav.resSeconds / 3600) / 1000;

    const t1 = nav.isDayTab 
      ? (isAvgFeed ? (bars1.slice(0, lastIdx).reduce((a,b)=>a+b,0)/lastIdx) : (bars1.reduce((a,b,i)=>i<lastIdx?a+b:a, 0) * dayFactor))
      : (isAvgFeed ? (bars1.reduce((a,b)=>a+b,0)/bars1.filter(v=>v!==0).length) : bars1.reduce((a,b)=>a+b,0));
    
    const t2 = isCombined 
      ? (nav.isDayTab ? (bars2.reduce((a,b,i)=>i<lastIdx?a+b:a, 0) * dayFactor) : bars2.reduce((a,b)=>a+b,0))
      : 0;

    if (isCombined) {
      const p1 = Math.max(...bars1), p2 = Math.max(...bars2);
      const a1 = nav.isDayTab ? _calcAvgForRange(bars1,5,17,nav,lastIdx) : (t1 / bars1.filter(b=>b>0).length);
      const a2 = nav.isDayTab ? _calcAvgForRange(bars2,0,24,nav,lastIdx) : (t2 / bars2.filter(b=>b>0).length);
      const n2 = nav.isDayTab ? _calcAvgForRange(bars2,17,8,nav,lastIdx) : null;

      stat.innerHTML = _formatStatLine('☀', 'Solar', t1, color1, p1, a1, null, unit, true, graphTab) +
                       _formatStatLine('⚡', 'Grid', t2, color2, p2, a2, n2, unit, true, graphTab);
    } else {
      const isSol = graphFeedKey==='solar';
      const p1 = Math.max(...bars1);
      const a1 = nav.isDayTab ? _calcAvgForRange(bars1,isSol?5:0,isSol?17:24,nav,lastIdx) : (t1 / bars1.filter(b=>b>0).length);
      const n1 = nav.isDayTab ? _calcAvgForRange(bars1,17,8,nav,lastIdx) : null;
      
      stat.innerHTML = _formatStatLine('', fA.label, t1, color1, p1, a1, n1, unit, !isAvgFeed, graphTab);
    }
  } catch(e) { console.error(e); stat.textContent = 'Error loading data'; }
  finally { graphIsLoading = false; _showGraphLoading(false); }
}
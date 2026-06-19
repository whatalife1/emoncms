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
  } catch(e) { 
    console.warn('_gFetch error:', e);
    return []; 
  }
}

function _pointsToBars(pts, nav, feedKey) {
  const isAvgFeed = feedKey.startsWith('temp') || feedKey === 'water' || feedKey === 'AC Volts';

  if (nav.isDayTab) {
    const bars = Array(nav.nBars).fill(0);
    for (const [ts, v] of pts) {
      const offsetMs = ts - nav.startMs;
      if (offsetMs < 0) continue;
      const idx = Math.floor(offsetMs / (nav.resMins * 60000));
      if (idx >= 0 && idx < nav.nBars) bars[idx] = v;
    }
    return bars;
  }

  // Convert Average Interval Watts into Total Interval Energy (kWh)
  // Formula: (Average Watts * Hours) / 1000 = kWh
  const kwhFactor = (nav.interval / 3600) / 1000;

  if (nav.isYearly) {
    const bars = Array(12).fill(0), counts = Array(12).fill(0);
    for (const [ts,v] of pts) { 
      const m = new Date(ts).getMonth();
      bars[m] += isAvgFeed ? v : (v * kwhFactor); 
      counts[m]++;
    }
    return isAvgFeed ? bars.map((v, i) => counts[i]>0 ? v/counts[i] : 0) : bars;
  }

  if (nav.isTotal) {
    const by = {}, ct = {};
    for (const [ts,v] of pts) { 
      const y = new Date(ts).getFullYear(); 
      by[y] = (by[y]||0) + (isAvgFeed ? v : (v * kwhFactor)); 
      ct[y]=(ct[y]||0)+1;
    }
    const years = Object.keys(by).sort();
    const bars = years.map(y => isAvgFeed ? by[y]/ct[y] : by[y]);
    return { bars, labels: years };
  }

  const bars = Array(nav.nBars || 1).fill(0), counts = Array(nav.nBars || 1).fill(0);
  for (const [ts,v] of pts) { 
    const d = new Date(ts); 
    if(d.getMonth() === nav.month && d.getFullYear() === nav.year) {
      const dayIdx = d.getDate()-1;
      if (dayIdx >= 0 && dayIdx < bars.length) {
        bars[dayIdx] += isAvgFeed ? v : (v * kwhFactor); 
        counts[dayIdx]++;
      }
    }
  }
  return isAvgFeed ? bars.map((v, i) => counts[i]>0 ? v/counts[i] : 0) : bars;
}

function _ensureCanvasSize(canvas) {
  if (!canvas) return null;
  let W = canvas.offsetWidth;
  let H = canvas.offsetHeight;
  if (W === 0 || H === 0) {
    const rect = canvas.getBoundingClientRect();
    W = rect.width || 400;
    H = rect.height || 180;
  }
  return { W, H };
}

// ─── Helper to calculate average watts for a specific time range ───────────
function _calcAvgWatts(bars, startHour, endHour, nav) {
  if (!nav.isDayTab) return null;
  
  const totalHours = 24;
  const barsPerHour = nav.nBars / totalHours;
  
  // Calculate which indices correspond to the time range
  const startIdx = Math.floor(startHour * barsPerHour);
  const endIdx = Math.ceil(endHour * barsPerHour);
  
  let sum = 0;
  let count = 0;
  for (let i = startIdx; i < endIdx && i < bars.length; i++) {
    if (bars[i] > 0) {
      sum += bars[i];
      count++;
    }
  }
  
  return count > 0 ? sum / count : null;
}

async function _loadAndDraw() {
  if (graphIsLoading) return;
  graphIsLoading = true;
  _showGraphLoading(true);

  const stat   = document.getElementById('graph-stat');
  const canvas = document.getElementById('graph-canvas');
  if (!canvas||!stat) {
    graphIsLoading = false;
    _showGraphLoading(false);
    return;
  }
  stat.textContent = 'Loading…';
  hideTooltip();

  try {
    const nav = _gNavInfo();

    const dims = _ensureCanvasSize(canvas);
    if (!dims || dims.W < 10) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const retryDims = _ensureCanvasSize(canvas);
      if (!retryDims || retryDims.W < 10) {
        console.warn('Graph canvas still has no width, using fallback.');
        canvas.style.width = '100%';
        canvas.style.height = '180px';
        canvas.offsetHeight;
      }
    }

    if (graphTab === 'day' && graphNeedsDayZoom) {
      const barsPerDay = (24 * 60) / nav.resMins;
      graphZoomLevel = nav.nBars / barsPerDay;

      const dims2 = _ensureCanvasSize(canvas);
      const W = dims2.W || 400;
      const PL = 38, PR = 8;
      const cW = W - PL - PR;
      const nBars = nav.nBars;
      const gap = cW * 0.02 / nBars;
      const grpW = (cW - gap * (nBars + 1)) / nBars;

      const now = new Date();
      const isToday = graphDateNav === 0;
      let centerHour = 12;
      if (isToday) {
        const h = now.getHours() + now.getMinutes()/60;
        centerHour = Math.min(24, Math.max(0, h));
      }
      const centerIndex = Math.round((centerHour / 24) * nBars);
      const targetX = PL + gap + centerIndex * (grpW + gap) + grpW / 2;
      const centerX = PL + cW / 2;
      graphPanOffset = (centerX - targetX) * graphZoomLevel;

      const zl = document.getElementById('zoom-level');
      if (zl) zl.textContent = Math.round(graphZoomLevel * 100) + '%';

      graphNeedsDayZoom = false;
    }

    const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey);
    const isCombined = graphFeedKey === 'combined';
    
    let pts1=[], pts2=[];
    try {
      if (isCombined) {
        const f1 = GRAPH_FEEDS.find(f => f.key === 'solar'), f2 = GRAPH_FEEDS.find(f => f.key === 'grid');
        [pts1, pts2] = await Promise.all([
          _gFetch(f1.id, nav.startMs, nav.endMs, nav.interval),
          _gFetch(f2.id, nav.startMs, nav.endMs, nav.interval)
        ]);
      } else if (fA) {
        pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval);
      }
    } catch(e) {
      console.warn('Graph data fetch error:', e);
      stat.textContent = 'Error loading data';
      graphIsLoading = false;
      _showGraphLoading(false);
      return;
    }

    let bars1 = _pointsToBars(pts1, nav, graphFeedKey);
    let bars2 = isCombined ? _pointsToBars(pts2, nav, 'grid') : [];
    let labels = nav.labels;

    if (nav.isTotal && typeof bars1 === 'object' && bars1.bars !== undefined) {
      labels = bars1.labels;
      bars1 = bars1.bars;
      if (isCombined && typeof bars2 === 'object' && bars2.bars !== undefined) {
        labels = bars2.labels;
        bars2 = bars2.bars;
      }
    }

    let unit = nav.isDayTab ? 'W' : 'kWh';
    if (graphFeedKey.startsWith('temp')) unit = '°C';
    if (graphFeedKey === 'water') unit = '%';

    const color1 = isCombined ? '#facc15' : (fA?.color || '#facc15');
    const color2 = '#ef4444';

    graphDataCache = { bars1, bars2, labels, color1, color2, unit, isCombined, nav };
    
    // Draw
    try {
      _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined, nav);
    } catch(e) {
      console.error('Drawing error:', e);
      stat.textContent = 'Error rendering chart: ' + e.message;
      graphIsLoading = false;
      _showGraphLoading(false);
      return;
    }

    // Determine the last valid index for the current timeline to calculate accurate averages
    let lastIdx = bars1.length - 1;
    const now = new Date();
    if (graphTab === 'day' && graphDateNav === 0) {
      const offsetMs = now.getTime() - nav.startMs;
      lastIdx = Math.floor(offsetMs / (nav.resMins * 60000));
    } else if (graphTab === 'month' && graphMonthNav === 0) {
      lastIdx = now.getDate() - 1;
    } else if (graphTab === 'year' && graphYearNav === 0) {
      lastIdx = now.getMonth();
    }
    lastIdx = Math.max(0, Math.min(bars1.length - 1, lastIdx));
    const validCount = lastIdx + 1;

    // Process top stats bar (kWh integrations)
    let totalKwh1 = 0, totalKwh2 = 0;
    const isAvg = graphFeedKey.startsWith('temp') || graphFeedKey === 'water';

    if (nav.isDayTab && !isAvg) {
      const factor = (nav.resMins / 60) / 1000;
      totalKwh1 = bars1.reduce((a,b)=>a+b, 0) * factor;
      if (isCombined) totalKwh2 = bars2.reduce((a,b)=>a+b, 0) * factor;
    } else if (!isAvg) {
      totalKwh1 = bars1.reduce((a,b)=>a+b, 0);
      if (isCombined) totalKwh2 = bars2.reduce((a,b)=>a+b, 0);
    }

    const nFmt = x => Math.round(x).toLocaleString('en-US');

    // ─── Enhanced stat display with average watts ───────────────────────────
    if (isCombined) {
      if (nav.isDayTab) {
        const max1 = Math.max(0, ...bars1), max2 = Math.max(0, ...bars2);
        // For Solar: show avg from 5am-5pm
        const avgSolar = _calcAvgWatts(bars1, 5, 17, nav);
        // For Grid: show avg for 24hr
        const avgGrid = _calcAvgWatts(bars2, 0, 24, nav);
        
        let avgSolarStr = avgSolar !== null ? `Avg: ${Math.round(avgSolar)}w` : '';
        let avgGridStr = avgGrid !== null ? `Avg: ${Math.round(avgGrid)}w` : '';
        
        stat.innerHTML = `<span style="color:${color1}">☀ ${totalKwh1.toFixed(1)} kWh (Peak: ${nFmt(max1)}w${avgSolarStr ? ', ' + avgSolarStr : ''})</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span style="color:${color2}">⚡ ${totalKwh2.toFixed(1)} kWh (Peak: ${nFmt(max2)}w${avgGridStr ? ', ' + avgGridStr : ''})</span>`;
      } else {
        const avg1 = totalKwh1 / validCount, avg2 = totalKwh2 / validCount;
        stat.innerHTML = `<span style="color:${color1}">☀ ${totalKwh1.toFixed(1)} kWh (Avg: ${avg1.toFixed(1)})</span> &nbsp;&nbsp;|&nbsp;&nbsp; <span style="color:${color2}">⚡ ${totalKwh2.toFixed(1)} kWh (Avg: ${avg2.toFixed(1)})</span>`;
      }
    } else {
      if (isAvg) {
        const validBars = bars1.slice(0, validCount).filter(b => b > 0);
        const val = validBars.length > 0 ? (validBars.reduce((a,b)=>a+b,0)/validBars.length) : 0;
        stat.innerHTML = `<span style="color:${color1}">${fA?.label}: ${val.toFixed(1)} ${unit}</span>`;
      } else {
        if (nav.isDayTab) {
          const max1 = Math.max(0, ...bars1);
          // For Solar: show avg from 5am-5pm
          // For other appliances: show avg for 24hr
          const isSolarFeed = graphFeedKey === 'solar';
          const startHour = isSolarFeed ? 5 : 0;
          const endHour = isSolarFeed ? 17 : 24;
          const avgWatts = _calcAvgWatts(bars1, startHour, endHour, nav);
          const avgStr = avgWatts !== null ? `Avg: ${Math.round(avgWatts)}w` : '';
          
          stat.innerHTML = `<span style="color:${color1}">${fA?.label}: ${totalKwh1.toFixed(1)} kWh (Peak: ${nFmt(max1)}w${avgStr ? ', ' + avgStr : ''})</span>`;
        } else {
          const max1 = Math.max(0, ...bars1.slice(0, validCount));
          const avg1 = totalKwh1 / validCount;
          stat.innerHTML = `<span style="color:${color1}">${fA?.label}: ${totalKwh1.toFixed(1)} kWh (Max: ${max1.toFixed(1)}, Avg: ${avg1.toFixed(1)})</span>`;
        }
      }
    }

  } catch(e) {
    console.error('_loadAndDraw top-level error:', e);
    stat.textContent = 'Error: ' + e.message;
  } finally {
    graphIsLoading = false;
    _showGraphLoading(false);
  }
}
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

  if (nav.isYearly) {
    const bars = Array(12).fill(0), counts = Array(12).fill(0);
    for (const [ts,v] of pts) { 
      const m = new Date(ts).getMonth();
      bars[m] += isAvgFeed ? v : (v/1000); counts[m]++;
    }
    return isAvgFeed ? bars.map((v, i) => counts[i]>0 ? v/counts[i] : 0) : bars;
  }

  if (nav.isTotal) {
    const by = {}, ct = {};
    for (const [ts,v] of pts) { 
      const y = new Date(ts).getFullYear(); 
      by[y] = (by[y]||0) + (isAvgFeed?v:(v/1000)); ct[y]=(ct[y]||0)+1;
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
        bars[dayIdx] += isAvgFeed ? v : (v/1000); counts[dayIdx]++;
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

    // Ensure canvas has size before calculating layout
    const dims = _ensureCanvasSize(canvas);
    if (!dims || dims.W < 10) {
      // Wait a frame and retry
      await new Promise(resolve => requestAnimationFrame(resolve));
      const retryDims = _ensureCanvasSize(canvas);
      if (!retryDims || retryDims.W < 10) {
        console.warn('Graph canvas still has no width, using fallback.');
        canvas.style.width = '100%';
        canvas.style.height = '180px';
        canvas.offsetHeight; // force reflow
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

    if (isCombined) {
      const max1 = Math.max(0, ...bars1), max2 = Math.max(0, ...bars2);
      stat.innerHTML = `<span style="color:${color1}">Solar: ${Math.round(max1)}W</span> & <span style="color:${color2}">Grid: ${Math.round(max2)}W</span>`;
    } else {
      const val = (graphFeedKey.startsWith('temp')||graphFeedKey==='water') ? (bars1.reduce((a,b)=>a+b,0)/bars1.length) : (nav.isDayTab?Math.max(0,...bars1):bars1.reduce((a,b)=>a+b,0));
      stat.innerHTML = `<span style="color:${color1}">${fA?.label}: ${val.toFixed(unit==='W'?0:1)} ${unit}</span>`;
    }

  } catch(e) {
    console.error('_loadAndDraw top-level error:', e);
    stat.textContent = 'Error: ' + e.message;
  } finally {
    graphIsLoading = false;
    _showGraphLoading(false);
  }
}
// ─── Graphs Panel - Data Layer ─────────────────────────────────────────────

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

function _pointsToBars(pts, nav) {
  if (nav.isHourly) {
    const bars = Array(24).fill(0);
    for (const [ts,v] of pts) {
      const h = new Date(ts).getHours();
      if (h >= 0 && h < 24) bars[h] = Math.max(bars[h], v);
    }
    return bars;
  }
  if (nav.isYearly) {
    const bars = Array(12).fill(0);
    for (const [ts,v] of pts) { 
      const d=new Date(ts); 
      if(d.getFullYear()===nav.year && d.getMonth() >= 0 && d.getMonth() < 12) 
        bars[d.getMonth()]+=v/1000; 
    }
    return bars;
  }
  if (nav.isTotal) {
    const by={};
    for (const [ts,v] of pts) { 
      const y=new Date(ts).getFullYear(); 
      by[y]=(by[y]||0)+v/1000; 
    }
    const years=Object.keys(by).sort();
    nav.labels = years.length ? years : ['No Data'];
    return years.map(y=>by[y]);
  }
  // monthly (daily bars)
  const bars = Array(nav.nBars || 1).fill(0);
  if (!nav.nBars) return bars;
  for (const [ts,v] of pts) { 
    const d=new Date(ts); 
    if(d.getMonth()===nav.month && d.getFullYear()===nav.year) {
      const dayIdx = d.getDate()-1;
      if (dayIdx >= 0 && dayIdx < bars.length) bars[dayIdx]+=v/1000;
    }
  }
  return bars;
}

async function _loadAndDraw() {
  const stat   = document.getElementById('graph-stat');
  const canvas = document.getElementById('graph-canvas');
  if (!canvas||!stat) return;
  stat.textContent = 'Loading…';
  hideTooltip();

  const nav  = _gNavInfo();
  const isCombined = graphFeedKey === 'combined';
  const f1 = GRAPH_FEEDS.find(f=>f.key==='solar');
  const f2 = GRAPH_FEEDS.find(f=>f.key==='grid');
  const fA = GRAPH_FEEDS.find(f=>f.key===graphFeedKey);

  let pts1=[], pts2=[];
  try {
    if (isCombined && f1 && f2) {
      [pts1,pts2] = await Promise.all([
        _gFetch(f1.id, nav.startMs, nav.endMs, nav.interval),
        _gFetch(f2.id, nav.startMs, nav.endMs, nav.interval)
      ]);
    } else if (fA) {
      pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval);
    }
  } catch(e) {
    stat.textContent = 'Error loading data';
    console.warn('Graph fetch error:', e);
    return;
  }

  const nav1 = {...nav, labels:[...nav.labels]};
  const nav2 = {...nav, labels:[...nav.labels]};
  const bars1 = _pointsToBars(pts1, nav1);
  const bars2 = isCombined ? _pointsToBars(pts2, nav2) : [];
  const labels = nav1.labels;

  const color1 = isCombined ? f1?.color || '#facc15' : (fA?.color||'#facc15');
  const color2 = f2?.color || '#ef4444';
  const unit   = nav.isHourly ? 'W' : 'kWh';

  graphDataCache = { bars1, bars2, labels, color1, color2, unit, isCombined, nav };

  _drawChart(canvas, bars1, bars2, labels, color1, color2, unit, isCombined);

  const tot1 = bars1.reduce((s,v)=>s+v,0);
  const dispUnit = nav.isHourly ? 'W peak' : 'kWh';
  if (isCombined) {
    const tot2 = bars2.reduce((s,v)=>s+v,0);
    const max1 = Math.max(0, ...bars1);
    const max2 = Math.max(0, ...bars2);
    stat.innerHTML = `<span style="color:${color1}">☀ Solar: ${nav.isHourly?Math.round(max1):tot1.toFixed(1)} ${dispUnit}</span>&nbsp;&nbsp;`+
                     `<span style="color:${color2}">⚡ Grid: ${nav.isHourly?Math.round(max2):tot2.toFixed(1)} ${dispUnit}</span>`;
  } else {
    const val = nav.isHourly ? Math.round(Math.max(0,...bars1)) : tot1.toFixed(1);
    stat.innerHTML = `<span style="color:${color1}">${fA?.label||'Feed'}: ${val} ${dispUnit}</span>`;
  }
}
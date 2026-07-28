// Solar render helpers for today actuals and heatmap
async function _fetchTodayActuals(y, mo, d) {
  const solarFeed = userOrderedFeeds.find(f => f.name === 'Solar');
  const solarId   = solarFeed ? solarFeed.id : '499380';

  const startOfDay = new Date(y, mo-1, d, 0, 0, 0).getTime();
  const endOfDay   = new Date(y, mo-1, d, 23, 59, 59).getTime();
  const url        = `${PROXY_BASE}/feed/data.json?ids=${solarId}&start=${startOfDay}&end=${endOfDay}&skipmissing=0&average=1&delta=0&interval=3600`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return null;
    
    let arr;
    try { arr = JSON.parse(text); } catch(e) { return null; }
    
    if (!arr || arr.length === 0) return null;
    const data   = arr[0]?.data || [];
    const result = {};
    for (const pt of data) {
      if (pt[1] === null || pt[1] === undefined) continue;
      const h = new Date(pt[0]).getHours();
      result[h] = pt[1];
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch(e) { return null; }
}

async function _fetchDayBreakerKwh(y, mo, d) {
  const breakerTodayFeed = userOrderedFeeds.find(f => f.name === 'Breaker Today');
  const feedId = breakerTodayFeed ? breakerTodayFeed.id : '499413';
  
  const startOfDay = new Date(y, mo-1, d, 0, 0, 0).getTime();
  const endOfDay   = new Date(y, mo-1, d, 23, 59, 59).getTime();
  const url        = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startOfDay}&end=${endOfDay}&skipmissing=0&average=1&delta=0&interval=3600`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return null;
    
    let arr;
    try { arr = JSON.parse(text); } catch(e) { return null; }
    
    if (!arr || arr.length === 0) return null;
    const data = arr[0]?.data || [];
    const values = data.map(pt => pt[1]).filter(v => v !== null && v !== undefined);
    if (values.length === 0) return null;
    return Math.max(...values);
  } catch(e) { return null; }
}

async function _getBreakerKwh(y, mo, d, isToday) {
  try {
    const breakerTodayFeed = userOrderedFeeds.find(f => f.name === 'Breaker Today');
    const feedId = breakerTodayFeed ? breakerTodayFeed.id : '499413';
    if (isToday) {
      return await fetchEmon(feedId);
    } else {
      return await _fetchDayBreakerKwh(y, mo, d);
    }
  } catch(e) { return null; }
}

function _renderHeatmap(daily, container) {
  if (!container || !daily || daily.length === 0) return;
  const maxKwh = Math.max(...daily.map(d => d.kwh), 0.1);
  const DOW = ['M','T','W','T','F','S','S'];
  const headers = DOW.map(d => `<div class="sol-heatmap-label">${d}</div>`).join('');

  const firstDate = daily[0].date || new Date(daily[0].y, daily[0].mo - 1, daily[0].d || 1);
  const startDow  = ((firstDate.getDay() + 6) % 7);
  const blanks    = Array(startDow).fill(`<div></div>`).join('');

  const cells = daily.map(({ kwh, d, date }) => {
    const ratio = kwh / maxKwh;
    const bg = kwh < 0.01
      ? '#1c1c1f'
      : `hsl(${120 - ratio * 100}, 70%, ${15 + ratio * 25}%)`;
    const label = d ?? (date ? date.getDate() : '');
    return `<div class="sol-heatmap-day" style="background:${bg}" title="${kwh.toFixed(2)} kWh">
      <span style="color:rgba(255,255,255,${ratio > 0.3 ? 0.9 : 0.4});font-size:9px">${label}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="sol-heatmap-legend">
      <span style="font-size:10px;color:var(--text-muted)">Yield:</span>
      <div class="sol-heatmap-legend-track">
        ${[0,0.25,0.5,0.75,1].map(r => `<div class="sol-heatmap-legend-sq" style="background:hsl(${120 - r*100},70%,${15+r*25}%)"></div>`).join('')}
      </div>
      <span style="font-size:10px;color:var(--text-muted)">Low → High</span>
    </div>
    <div class="sol-heatmap" style="grid-template-columns:repeat(7,1fr)">
      ${headers}${blanks}${cells}
    </div>`;
}


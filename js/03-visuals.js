function renderWaterTank(pct) {
  if (pct == null) return '';
  const p = Math.max(0, Math.min(100, pct));
  const tankH = 52, tankW = 28, x0 = 4, y0 = 4;
  const fillH = (p / 100) * tankH;
  const fillY = y0 + tankH - fillH;
  const waterColor = p > 60 ? '#38bdf8' : p > 30 ? '#f59e0b' : '#f87171';
  const pctColor   = p > 60 ? '#38bdf8' : p > 30 ? '#f59e0b' : '#f87171';
  return `<svg width="36" height="68" viewBox="0 0 36 68" xmlns="http://www.w3.org/2000/svg" class="tank-svg-container">
    <rect x="${x0}" y="${y0}" width="${tankW}" height="${tankH}" rx="5" fill="#1c1c1f" stroke="#27272a" stroke-width="1.5"/>
    ${fillH > 0 ? `<rect x="${x0+1}" y="${fillY}" width="${tankW-2}" height="${fillH}" rx="3" fill="${waterColor}" opacity="0.8"/>` : ''}
    <line x1="${x0+tankW-4}" y1="${y0 + tankH * 0.25}" x2="${x0+tankW}" y2="${y0 + tankH * 0.25}" stroke="#3f3f46" stroke-width="0.8"/>
    <line x1="${x0+tankW-4}" y1="${y0 + tankH * 0.5}" x2="${x0+tankW}" y2="${y0 + tankH * 0.5}" stroke="#3f3f46" stroke-width="0.8"/>
    <line x1="${x0+tankW-4}" y1="${y0 + tankH * 0.75}" x2="${x0+tankW}" y2="${y0 + tankH * 0.75}" stroke="#3f3f46" stroke-width="0.8"/>
    <rect x="${x0+8}" y="1" width="${tankW-16}" height="5" rx="2" fill="#27272a"/>
    <rect x="${x0+10}" y="${y0+tankH}" width="${tankW-20}" height="6" rx="2" fill="#27272a"/>
    <text x="${x0 + tankW/2}" y="${y0 + tankH/2 + 5}" text-anchor="middle" font-size="9" font-weight="800" fill="${pctColor}" font-family="monospace">${Math.round(p)}%</text>
  </svg>`;
}

async function fetchMonthlyUnits() {
  const pktNow = getPktNow();
  const yr = IS_PKT_ZONE ? pktNow.getFullYear() : pktNow.getUTCFullYear();
  const mo = (IS_PKT_ZONE ? pktNow.getMonth() : pktNow.getUTCMonth()) + 1;
  const dy = IS_PKT_ZONE ? pktNow.getDate() : pktNow.getUTCDate();

  const range = getPktBillingRange(yr, dy < 26 ? mo : mo + 1);
  const nowMs = Date.now();

  const feeds = [
    { key: 'haier', id: '499409' }, { key: 'k1', id: '499407' }, 
    { key: 'k15', id: '499405' }, { key: 'pc', id: '499424' }, 
    { key: 'f1', id: '499411' }, { key: 'f2', id: '541350' },
    { key: 'solar', id: '499415' }, { key: 'grid', id: '499413' },
    { key: 'motor', id: '542853' }
  ];

  const results = { haier:0, k1:0, k15:0, pc:0, f1:0, f2:0, solar:0, grid:0, motor:0 };

  try {
    const promises = feeds.map(f => {
      const url = `${PROXY_BASE}/feed/data.json?id=${f.id}&start=${range.startMs}&end=${nowMs}&interval=daily&delta=0`;
      return nativeFetch(url).then(text => ({ key: f.key, text })).catch(() => ({ key: f.key, text: "[]" }));
    });

    const responses = await Promise.all(promises);

    responses.forEach(res => {
      try {
        if (res.text && !res.text.startsWith('ERROR')) {
          const data = JSON.parse(res.text);
          if (Array.isArray(data)) {
            results[res.key] = data.reduce((acc, curr) => acc + (parseFloat(curr[1]) || 0), 0);
          }
        }
      } catch(e) { console.warn("Monthly parse failed", res.key); }
    });
  } catch (e) { console.error("Monthly fetch failed", e); }

  window.monthlyUnits = {
    haier: results.haier,
    k1:    results.k1,
    k15:   results.k15,
    pc:    results.pc,
    fridge: results.f1 + results.f2,
    f1: results.f1,
    f2: results.f2,
    motor: results.motor,
    solar: results.solar,
    grid:  results.grid
  };
}

function updateCostCard(byName) {
  const pkrRate = solarCfg?.pkrPerUnit ?? 60;
  window.pkrRate = pkrRate;
}

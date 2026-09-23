// Restore cached yesterday battery values immediately on boot
try {
  const savedY = localStorage.getItem('bat_energy_yesterday');
  if (savedY) {
    const parsedY = JSON.parse(savedY);
    if (parsedY && parsedY.date === getPktTodayStart()) {
      window.monthlyUnits = window.monthlyUnits || {};
      window.monthlyUnits.batChgY = parsedY.chgY;
      window.monthlyUnits.batDisY = parsedY.disY;
    }
  }
} catch (e) {}

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

async function fetchTodayBatteryEnergy() {
  const todayStartMs = getPktTodayStart();
  const nowMs = Date.now();
  if (todayStartMs >= nowMs) return { chgWh: 0, disWh: 0 };
  const resSec = 120;

  try {
    const [chgText, disText, vText] = await Promise.all([
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546022&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`),
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546025&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`),
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546013&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`)
    ]);

    const parsePts = (txt) => {
      if (!txt || typeof txt !== 'string' || txt.startsWith('ERROR')) return [];
      try {
        const root = JSON.parse(txt);
        const data = root[0]?.data || (Array.isArray(root) ? root : []);
        return Array.isArray(data) ? data : [];
      } catch (e) { return []; }
    };

    const chgPts = parsePts(chgText);
    const disPts = parsePts(disText);
    const vPts = parsePts(vText);

    const vMap = new Map();
    vPts.forEach(p => {
      if (p && p[0] != null && p[1] != null && p[1] > 35) {
        const tMs = p[0] < 10000000000 ? p[0] * 1000 : p[0];
        vMap.set(tMs, parseFloat(p[1]));
      }
    });

    const defaultV = window.lastResultsMap?.get('Bat V')?.value || 52.8;
    const factor = resSec / 3600;
    let chgWh = 0;
    let disWh = 0;

    let lastV = defaultV;
    chgPts.forEach(p => {
      if (p && p[0] != null && p[1] != null) {
        const ptMs = p[0] < 10000000000 ? p[0] * 1000 : p[0];
        if (ptMs < todayStartMs) return; // Discard readings before 5 AM reset
        const val = Math.max(0, parseFloat(p[1]) || 0);
        if (val > 0) {
          const v = vMap.get(ptMs) || lastV;
          if (v > 35) lastV = v;
          chgWh += (val * v) * factor;
        }
      }
    });

    lastV = defaultV;
    disPts.forEach(p => {
      if (p && p[0] != null && p[1] != null) {
        const ptMs = p[0] < 10000000000 ? p[0] * 1000 : p[0];
        if (ptMs < todayStartMs) return; // Discard readings before 5 AM reset
        const val = Math.max(0, parseFloat(p[1]) || 0);
        if (val > 0) {
          const v = vMap.get(ptMs) || lastV;
          if (v > 35) lastV = v;
          disWh += (val * v) * factor;
        }
      }
    });

    if (!window.monthlyUnits) {
      window.monthlyUnits = {};
    }
    window.monthlyUnits.batChgT = chgWh;
    window.monthlyUnits.batDisT = disWh;
    if (window.monthlyUnits.batPastChgM != null) {
      window.monthlyUnits.batChgM = window.monthlyUnits.batPastChgM + chgWh;
    }
    if (window.monthlyUnits.batPastDisM != null) {
      window.monthlyUnits.batDisM = window.monthlyUnits.batPastDisM + disWh;
    }
    return { chgWh, disWh };
  } catch (e) {
    console.warn("fetchTodayBatteryEnergy failed", e);
    return null;
  }
}
window.fetchTodayBatteryEnergy = fetchTodayBatteryEnergy;

async function fetchMonthlyUnits() {
  const pktNow = getPktNow();
  const yr = IS_PKT_ZONE ? pktNow.getFullYear() : pktNow.getUTCFullYear();
  const mo = (IS_PKT_ZONE ? pktNow.getMonth() : pktNow.getUTCMonth()) + 1;
  const dy = IS_PKT_ZONE ? pktNow.getDate() : pktNow.getUTCDate();

  const range = getPktBillingRange(yr, dy < 26 ? mo : mo + 1);
  const nowMs = Date.now();
  const todayStartMs = getPktTodayStart();
  const yesterdayStartMs = todayStartMs - (24 * 3600 * 1000);
  const batFetchStartMs = Math.min(range.startMs, yesterdayStartMs);

  const feeds = [
    { key: 'haier', id: '499409' }, { key: 'k1', id: '499407' }, 
    { key: 'k15', id: '499405' }, { key: 'pc', id: '499424' }, 
    { key: 'f1', id: '499411' }, { key: 'f2', id: '541350' },
    { key: 'solar', id: '499415' }, { key: 'grid', id: '499413' },
    { key: 'motor', id: '542853' },
    { key: 'wm', id: '544696' }
  ];

  const results = { haier:0, k1:0, k15:0, pc:0, f1:0, f2:0, solar:0, grid:0, motor:0, wm:0 };
  let batChgMonthWh = 0;
  let batDisMonthWh = 0;
  let batChgYestWh = 0;
  let batDisYestWh = 0;

  try {
    const promises = feeds.map(f => {
      const url = `${PROXY_BASE}/feed/data.json?id=${f.id}&start=${range.startMs}&end=${nowMs}&interval=daily&delta=0`;
      return nativeFetch(url).then(text => ({ key: f.key, text })).catch(() => ({ key: f.key, text: "[]" }));
    });

    const batVPromise = nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546013&start=${batFetchStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=3600`);
    const batChgPromise = nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546022&start=${batFetchStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=3600`);
    const batDisPromise = nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546025&start=${batFetchStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=3600`);

    const [responses, resBatV, resBatChg, resBatDis] = await Promise.all([
      Promise.all(promises),
      batVPromise,
      batChgPromise,
      batDisPromise
    ]);

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

    try {
      const parsePoints = (txt) => {
        if (!txt || txt.startsWith('ERROR')) return {};
        const root = JSON.parse(txt);
        const data = root[0]?.data || (Array.isArray(root) ? root : []);
        const map = {};
        data.forEach(p => { 
          if (p && p[0] != null && p[1] != null) {
            const tMs = p[0] < 10000000000 ? p[0] * 1000 : p[0];
            map[tMs] = parseFloat(p[1]);
          }
        });
        return map;
      };

      const mapV = parsePoints(resBatV);
      const mapChg = parsePoints(resBatChg);
      const mapDis = parsePoints(resBatDis);

      const allTs = new Set([...Object.keys(mapChg), ...Object.keys(mapDis)]);
      let pastChgWh = 0;
      let pastDisWh = 0;
      let yestChgWh = 0;
      let yestDisWh = 0;

      for (const tsStr of allTs) {
        const tsMs = parseInt(tsStr, 10);
        const v = (mapV[tsMs] && mapV[tsMs] > 35) ? mapV[tsMs] : 52.8;
        const cA = mapChg[tsMs] || 0;
        const dA = mapDis[tsMs] || 0;
        const cWh = Math.max(0, v * cA);
        const dWh = Math.max(0, v * dA);

        // Include hours up to 5:00 AM today in the historical cycle
        if (tsMs >= range.startMs && tsMs < todayStartMs) {
          pastChgWh += cWh;
          pastDisWh += dWh;
        }

        // Include 24 hours of yesterday [yesterdayStartMs, todayStartMs)
        if (tsMs >= yesterdayStartMs && tsMs < todayStartMs) {
          yestChgWh += cWh;
          yestDisWh += dWh;
        }
      }
      batChgMonthWh = pastChgWh;
      batDisMonthWh = pastDisWh;
      batChgYestWh = yestChgWh;
      batDisYestWh = yestDisWh;

      try {
        localStorage.setItem('bat_energy_yesterday', JSON.stringify({
          date: todayStartMs,
          chgY: yestChgWh,
          disY: yestDisWh
        }));
      } catch (e) {}
    } catch(err) {
      console.warn("Battery monthly parse warning:", err);
    }
  } catch (e) { 
    console.error("Monthly fetch failed", e); 
  }

  let todayChgWh = (window.monthlyUnits && window.monthlyUnits.batChgT != null) ? window.monthlyUnits.batChgT : 0;
  let todayDisWh = (window.monthlyUnits && window.monthlyUnits.batDisT != null) ? window.monthlyUnits.batDisT : 0;

  try {
    const todayRes = await fetchTodayBatteryEnergy();
    if (todayRes) {
      todayChgWh = todayRes.chgWh;
      todayDisWh = todayRes.disWh;
    }
  } catch (err) {}

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
    grid:  results.grid,
    wm:    results.wm,
    batPastChgM: batChgMonthWh,
    batPastDisM: batDisMonthWh,
    batChgY: batChgYestWh,
    batDisY: batDisYestWh,
    batChgT: todayChgWh,
    batChgM: batChgMonthWh + todayChgWh,
    batDisT: todayDisWh,
    batDisM: batDisMonthWh + todayDisWh
  };
}

function updateCostCard(byName) {
  const pkrRate = solarCfg?.pkrPerUnit ?? 60;
  window.pkrRate = pkrRate;
}

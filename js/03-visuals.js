// Restore full monthly units cache immediately on boot (prevents 0 M and 0 Y on reload)
try {
  const cachedMonthly = localStorage.getItem('monthly_units_cache');
  if (cachedMonthly) {
    const parsed = JSON.parse(cachedMonthly);
    if (parsed && parsed.data) {
      window.monthlyUnits = parsed.data;
    }
  }
} catch (e) {}

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

// Restore cached yesterday grid breaker value immediately on boot
try {
  const savedGridY = localStorage.getItem('grid_energy_yesterday');
  if (savedGridY) {
    const parsedGridY = JSON.parse(savedGridY);
    if (parsedGridY && parsedGridY.date === getPktTodayStart()) {
      window.monthlyUnits = window.monthlyUnits || {};
      window.monthlyUnits.gridY = parsedGridY.gridY;
    }
  }
} catch (e) {}

// Restore cached yesterday grid breaker value immediately on boot
try {
  const savedGridY = localStorage.getItem('grid_energy_yesterday');
  if (savedGridY) {
    const parsedGridY = JSON.parse(savedGridY);
    if (parsedGridY && parsedGridY.date === getPktTodayStart()) {
      window.monthlyUnits = window.monthlyUnits || {};
      window.monthlyUnits.gridY = parsedGridY.gridY;
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
    const [chgText, disText, vText, socText] = await Promise.all([
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546022&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`),
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546025&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`),
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546013&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`),
      nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546019&start=${todayStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=${resSec}`)
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

    // Reconcile discharge energy with true BMS ΔSOC drop
    const socPts = parsePts(socText);
    const validSoc = socPts.filter(p => p && p[1] != null && p[1] > 10).map(p => p[1]);
    let socDisWh = 0;
    if (validSoc.length >= 2) {
      const maxSoc = Math.max(...validSoc);
      const minSoc = Math.min(...validSoc);
      const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
      socDisWh = ((maxSoc - minSoc) / 100) * packKwh * 1000;
    }
    const finalDisWh = Math.max(disWh, socDisWh);

    if (!window.monthlyUnits) {
      window.monthlyUnits = {};
    }
    window.monthlyUnits.batChgT = chgWh;
    window.monthlyUnits.batDisT = finalDisWh;
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

  const feedDefs = [
    { key: 'haier', id: '499367' },
    { key: 'k1',    id: '499364' },
    { key: 'k15',   id: '499362' },
    { key: 'pc',    id: '499422' },
    { key: 'f1',    id: '499373' },
    { key: 'f2',    id: '541348' },
    { key: 'solar', id: '499380' },
    { key: 'grid',  id: '499374' },
    { key: 'motor', id: '542850' },
    { key: 'wm',    id: '544694' }
  ];

  const results = {};
  const todayUnits = {};
  const yestUnits = {};

  const fetchFn = (typeof fetchWithCache === 'function') 
    ? fetchWithCache 
    : (id, s, e) => (typeof fetchHourly === 'function' ? fetchHourly(id, s, e) : {});

  const prms = feedDefs.map(async f => {
    try {
      const data = await fetchFn(f.id, range.startMs, nowMs);
      const sums = (typeof sumByDay === 'function') 
        ? sumByDay(data, 0, 24) 
        : {};

      const pktToday = getKarachiDate(todayStartMs + 3600000 * 2);
      const todayKey = `${pktToday.year}-${String(pktToday.month).padStart(2,'0')}-${String(pktToday.day).padStart(2,'0')}`;

      const pktYest = getKarachiDate(yesterdayStartMs + 3600000 * 2);
      const yestKey = `${pktYest.year}-${String(pktYest.month).padStart(2,'0')}-${String(pktYest.day).padStart(2,'0')}`;

      const tWh = sums[todayKey] || 0;
      const yWh = sums[yestKey] || 0;
      const mWh = Object.values(sums).reduce((a, b) => a + (parseFloat(b) || 0), 0);

      todayUnits[f.key] = tWh / 1000;
      yestUnits[f.key]  = yWh / 1000;
      results[f.key]    = mWh / 1000;
    } catch(err) {
      console.warn("Feed cycle fetch error:", f.key, err);
      results[f.key] = 0;
      todayUnits[f.key] = 0;
      yestUnits[f.key] = 0;
    }
  });

  const batVPromise   = nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546013&start=${batFetchStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=3600`);
  const batChgPromise = nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546022&start=${batFetchStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=3600`);
  const batDisPromise = nativeFetch(`${PROXY_BASE}/feed/data.json?ids=546025&start=${batFetchStartMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=3600`);

  let batChgMonthWh = 0, batDisMonthWh = 0, batChgYestWh = 0, batDisYestWh = 0;

  try {
    const [, resBatV, resBatChg, resBatDis] = await Promise.all([
      Promise.all(prms),
      batVPromise,
      batChgPromise,
      batDisPromise
    ]);

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

    const mapV   = parsePoints(resBatV);
    const mapChg = parsePoints(resBatChg);
    const mapDis = parsePoints(resBatDis);

    const allTs = new Set([...Object.keys(mapChg), ...Object.keys(mapDis)]);
    let pastChgWh = 0, pastDisWh = 0, yestChgWh = 0, yestDisWh = 0;

    for (const tsStr of allTs) {
      const tsMs = parseInt(tsStr, 10);
      const v = (mapV[tsMs] && mapV[tsMs] > 35) ? mapV[tsMs] : 52.8;
      const cA = mapChg[tsMs] || 0;
      const dA = mapDis[tsMs] || 0;
      const cWh = Math.max(0, v * cA);
      const dWh = Math.max(0, v * dA);

      if (tsMs >= range.startMs && tsMs < todayStartMs) {
        pastChgWh += cWh;
        pastDisWh += dWh;
      }
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
  } catch(e) {
    console.warn("Battery monthly parse warning:", e);
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
    haier:   results.haier || 0,
    haier_t: todayUnits.haier || 0,
    haier_y: yestUnits.haier || 0,
    k1:      results.k1 || 0,
    k1_t:    todayUnits.k1 || 0,
    k1_y:    yestUnits.k1 || 0,
    k15:     results.k15 || 0,
    k15_t:   todayUnits.k15 || 0,
    k15_y:   yestUnits.k15 || 0,
    pc:      results.pc || 0,
    pc_t:    todayUnits.pc || 0,
    pc_y:    yestUnits.pc || 0,
    fridge:  (results.f1 || 0) + (results.f2 || 0),
    f1:      results.f1 || 0,
    f1_t:    todayUnits.f1 || 0,
    f1_y:    yestUnits.f1 || 0,
    f2:      results.f2 || 0,
    f2_t:    todayUnits.f2 || 0,
    f2_y:    yestUnits.f2 || 0,
    motor:   results.motor || 0,
    motor_t: todayUnits.motor || 0,
    motor_y: yestUnits.motor || 0,
    solar:   results.solar || 0,
    solar_t: todayUnits.solar || 0,
    solar_y: yestUnits.solar || 0,
    grid:    results.grid || 0,
    gridT:   todayUnits.grid || 0,
    gridY:   yestUnits.grid || 0,
    wm:      results.wm || 0,
    wm_t:    todayUnits.wm || 0,
    wm_y:    yestUnits.wm || 0,
    batPastChgM: batChgMonthWh,
    batPastDisM: batDisMonthWh,
    batChgY: batChgYestWh,
    batDisY: batDisYestWh,
    batChgT: todayChgWh,
    batChgM: batChgMonthWh + todayChgWh,
    batDisT: todayDisWh,
    batDisM: batDisMonthWh + todayDisWh
  };

  try {
    localStorage.setItem('monthly_units_cache', JSON.stringify({
      date: todayStartMs,
      data: window.monthlyUnits
    }));
  } catch (e) {}
}

function updateCostCard(byName) {
  const pkrRate = solarCfg?.pkrPerUnit ?? 60;
  window.pkrRate = pkrRate;
}

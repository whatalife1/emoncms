if (typeof window.graphOthersNightOnly === 'undefined') {
  window.graphOthersNightOnly = false;
}
try {
  if (localStorage.getItem('graphOthersNightOnly') !== null) {
    window.graphOthersNightOnly = localStorage.getItem('graphOthersNightOnly') === 'true';
  }
} catch (e) {}
// js/19c4-graphs-others.js
// ─── "Others" feed computation + Separate Overlay Toggles ───────────────────

async function _handleOthersFeed(nav, stat, canvas) {
  const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
  const applianceKeys = ['k15', 'k1', 'haier', 'fridge1', 'fridge2', 'pc', 'motor', 'wm'];
  const feedKeys = ['solar', 'grid', ...applianceKeys];
  const fetchPromises = feedKeys.map(key => {
    const feed = GRAPH_FEEDS.find(f => f.key === key);
    return _gFetch(feed.id, nav.startMs, nav.endMs, nav.interval);
  });
  const results = await Promise.all(fetchPromises);
  const barsArrays = results.map((res, idx) => _pointsToBars(res, nav, feedKeys[idx]));
  const solarBars = barsArrays[0];
  const gridBars = barsArrays[1];
  const bars = new Array(nav.nBars).fill(null);
  let computedLastIdx = nav.nBars;
  if (graphTab === 'day' && graphDateNav === 0) {
    computedLastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
  }
  computedLastIdx = Math.min(Math.max(0, computedLastIdx), nav.nBars);
  const [ampChgPts, ampDisPts, voltPts] = await Promise.all([
    _gFetch('546022', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546025', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546013', nav.startMs, nav.endMs, nav.interval)
  ]);
  const chgBars = _pointsToBars(ampChgPts, nav, 'batchg');
  const disBars = _pointsToBars(ampDisPts, nav, 'batdis');
  const vBars   = _pointsToBars(voltPts, nav, 'batv');
  const isNightOnly = !!window.graphOthersNightOnly;

  for (let i = 0; i < computedLastIdx; i++) {
    const ts = nav.startMs + (i * nav.resSeconds * 1000);
    const pktDate = getKarachiDate(ts);
    const isNight = (pktDate.hour >= 16 || pktDate.hour < 7);

    if (isNightOnly && !isNight) {
      bars[i] = 0;
      continue;
    }

    const solar = solarBars[i] || 0;
    const grid = gridBars[i] || 0;
    const v = (vBars && vBars[i] > 35) ? vBars[i] : 52.0;
    const chgW = (chgBars && chgBars[i] ? chgBars[i] : 0) * (isKwhView ? 1 : v);
    const disW = (disBars && disBars[i] ? disBars[i] : 0) * (isKwhView ? 1 : v);
    const netSupply = Math.max(0, solar + grid + disW - chgW);

    let sumAppliances = 0;
    for (let j = 2; j < barsArrays.length; j++) {
      sumAppliances += barsArrays[j][i] || 0;
    }
    bars[i] = Math.max(0, netSupply - sumAppliances);
  }
  const feed = GRAPH_FEEDS.find(f => f.key === 'others');
  const color1 = feed.color;
  const unit = 'W';
  const isCombined = false;
  const includeFridges = !!window.graphOthersIncludeFridges;
  const fridge1Idx = feedKeys.indexOf('fridge1');
  const fridge2Idx = feedKeys.indexOf('fridge2');
  const fridge1Bars = fridge1Idx >= 0 ? (barsArrays[fridge1Idx] || []) : [];
  const fridge2Bars = fridge2Idx >= 0 ? (barsArrays[fridge2Idx] || []) : [];
  let statBars = bars;
  let othersMultiData = null;
  let maskedFridge1 = [];
  let maskedFridge2 = [];
  if (includeFridges) {
    statBars = new Array(nav.nBars || bars.length).fill(0);
    maskedFridge1 = new Array(nav.nBars || bars.length).fill(0);
    maskedFridge2 = new Array(nav.nBars || bars.length).fill(0);
    for (let i = 0; i < computedLastIdx; i++) {
      const ts = nav.startMs + (i * nav.resSeconds * 1000);
      const pktDate = getKarachiDate(ts);
      const h = pktDate.hour;
      const isNight = h >= 16 || h < 7;
      let f1 = fridge1Bars[i] || 0;
      let f2 = fridge2Bars[i] || 0;
      if (isNight) {
        maskedFridge1[i] = f1;
        maskedFridge2[i] = f2;
        statBars[i] = (bars[i] || 0) + f1 + f2;
      } else {
        maskedFridge1[i] = 0;
        maskedFridge2[i] = 0;
        statBars[i] = (bars[i] || 0);
      }
    }
    othersMultiData = [
      { key: 'others',  label: 'Others',    color: feed.color, data: bars },
      { key: 'fridge1', label: 'Fridge 1 (Night)', color: '#c084fc', data: maskedFridge1 },
      { key: 'fridge2', label: 'Fridge 2 (Night)', color: '#22d3ee', data: maskedFridge2 }
    ];
  }
  const validBars = statBars.slice(0, computedLastIdx).filter(v => v != null);
  let maxV = validBars.length ? Math.max(...validBars, 1) * 1.1 : 1.1;
  if (includeFridges && othersMultiData) {
    const allLineVals = othersMultiData
      .flatMap(m => (m.data || []).slice(0, computedLastIdx))
      .filter(v => v != null && v > 0);
    if (allLineVals.length) {
      maxV = Math.max(...allLineVals) * 1.1;
    }
  }
  let cumOthers = [];
  let cumF1 = [];
  let cumF2 = [];
  let runOthers = 0, runF1 = 0, runF2 = 0;
  for (let i = 0; i < computedLastIdx; i++) {
    let valO = bars[i] || 0;
    let valF1 = includeFridges ? (maskedFridge1[i] || 0) : 0;
    let valF2 = includeFridges ? (maskedFridge2[i] || 0) : 0;
    if (!isKwhView) {
      valO = valO * (nav.resSeconds / 3600) / 1000;
      valF1 = valF1 * (nav.resSeconds / 3600) / 1000;
      valF2 = valF2 * (nav.resSeconds / 3600) / 1000;
    }
    runOthers += valO;
    cumOthers.push(runOthers);
    if (includeFridges) {
      runF1 += valF1;
      cumF1.push(runF1);
      runF2 += valF2;
      cumF2.push(runF2);
    }
  }
  let maxCumKwh = cumOthers.length ? Math.max(...cumOthers, 0.1) : 0.1;
  if (includeFridges) {
    maxCumKwh = Math.max(maxCumKwh, (cumF1.length ? Math.max(...cumF1) : 0), (cumF2.length ? Math.max(...cumF2) : 0));
  }
  graphDataCache = {
    bars1: statBars, bars2: [],
    labels: nav.labels,
    timeLabels: nav.timeLabels || nav.labels,
    fullLabels: nav.fullLabels || nav.labels,
    color1, color2: null, unit, isCombined, nav, lastIdx: computedLastIdx,
    multiData: othersMultiData,
    minV: 0,
    maxV: maxV,
    range: maxV,
    barsTemp: cumOthers,
    tempMinV: 0, tempMaxV: maxCumKwh * 1.1, tempRange: maxCumKwh * 1.1,
    tempUnit: 'kWh', tempColor: color1, overlayLabel: includeFridges ? 'Others Cumul.' : 'Cumul. kWh',
    isDualY: true,
    barsTemp2: includeFridges ? cumF1 : null,
    tempColor2: '#c084fc', overlayLabel2: 'Fridge 1',
    barsTemp3: includeFridges ? cumF2 : null,
    tempColor3: '#22d3ee', overlayLabel3: 'Fridge 2',
    isMomentFlow: false,
    feedKey: 'others'
  };
  const savedChartType = graphChartType;
  if (includeFridges) graphChartType = 'line';
  _drawChart(
    canvas, statBars, [], nav.labels, color1, null, unit, false, nav,
    computedLastIdx, othersMultiData, 0, graphDataCache.maxV, graphDataCache.range,
    graphDataCache.barsTemp, graphDataCache.tempMinV, graphDataCache.tempMaxV,
    graphDataCache.tempRange, graphDataCache.tempUnit, graphDataCache.tempColor,
    graphDataCache.overlayLabel
  );
  graphChartType = savedChartType;
  const totalKwh = validBars.reduce((a, b) => a + (b || 0), 0) * (nav.resSeconds / 3600) / 1000;
  const peak = validBars.length ? Math.max(...validBars, 0) : 0;
  const avg = validBars.length > 0 ? validBars.reduce((a, b) => a + (b || 0), 0) / validBars.length : 0;
  let dAv = null, dTt = null, nAv = null, nTt = null;
  if (graphTab === 'day') {
    const ds = _calcStatsForRange(statBars, 7, 16, nav, computedLastIdx);
    dAv = ds.activeAvg; dTt = ds.total;
    const ns = _calcStatsForRange(statBars, 16, 7, nav, computedLastIdx);
    nAv = ns.activeAvg; nTt = ns.total;
  } else if (graphTab === 'month' || graphTab === 'year') {
    let dayTot = 0, nightTot = 0;
    const length = results[0] ? results[0].length : 0;
    for (let i = 0; i < length; i++) {
      const ts = results[0][i] ? results[0][i][0] : null;
      if (ts !== null) {
        const solarVal = results[0][i][1] || 0;
        const gridVal = results[1][i] ? results[1][i][1] : 0;
        let appSum = 0;
        for (let j = 2; j < results.length; j++) {
          appSum += results[j][i] ? results[j][i][1] : 0;
        }
        let v = Math.max(0, solarVal + gridVal - appSum);
        const pktDate = getKarachiDate(ts);
        const h = pktDate.hour;
        const isNight = h >= 16 || h < 7;
        if (includeFridges && isNight) {
          const f1Val = (fridge1Idx >= 0 && results[fridge1Idx] && results[fridge1Idx][i])
            ? (results[fridge1Idx][i][1] || 0) : 0;
          const f2Val = (fridge2Idx >= 0 && results[fridge2Idx] && results[fridge2Idx][i])
            ? (results[fridge2Idx][i][1] || 0) : 0;
          v += Math.max(0, f1Val) + Math.max(0, f2Val);
        }
        if (v > 0) {
          if (h >= 7 && h < 16) dayTot += v / 1000;
          else nightTot += v / 1000;
        }
      }
    }
    const numDays = Math.max(1, nav.nBars || 1);
    dAv = dayTot / numDays; dTt = dayTot;
    nAv = nightTot / numDays; nTt = nightTot;
  }
  const isNightOnlyActive = !!window.graphOthersNightOnly;
  const othersLabel = isNightOnlyActive ? (includeFridges ? 'Others + Fridges (Night Only)' : 'Others (Night Only)') : (includeFridges ? 'Others + Fridges (Night)' : 'Others');
  stat.innerHTML = _formatStatLine('💡', othersLabel, totalKwh, color1, peak, avg, dAv, dTt, nAv, nTt, unit, true, graphTab);
  _showGraphLoading(false);
  graphIsLoading = false;
}

// ─── Others: Fridge Toggle UI ───────────────────────────────────────────────
function _renderOthersFridgeToggle() {
  const existing = document.getElementById('others-fridge-toggle');
  if (existing) existing.remove();
  const currentFeed = (typeof graphFeedKey !== 'undefined') ? graphFeedKey : window.graphFeedKey;
  if (currentFeed !== 'others') return;
  const feedTabs = document.getElementById('graph-feed-tabs');
  if (!feedTabs || !feedTabs.parentNode) return;

  const on = !!window.graphOthersIncludeFridges;
  const othersColor = '#f59e0b', fridge1Color = '#c084fc', fridge2Color = '#22d3ee';
  const wrap = document.createElement('div');
  wrap.id = 'others-fridge-toggle';
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;padding:0 0 8px;flex-shrink:0;';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;';

  const btn = document.createElement('button');
  btn.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid #c084fc;background:${on ? 'rgba(192,132,252,0.18)' : 'transparent'};color:${on ? '#c084fc' : 'var(--text-muted)'};opacity:${on ? '1' : '0.75'};width:auto;`;
  btn.textContent = on ? '🧊 Fridges: Added (Night)' : '🧊 Add Fridges (Night)';
  btn.addEventListener('click', function () {
    window.graphOthersIncludeFridges = !window.graphOthersIncludeFridges;
    try { localStorage.setItem('graphOthersIncludeFridges', window.graphOthersIncludeFridges ? 'true' : 'false'); } catch (e) {}
    _renderOthersFridgeToggle();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });
  row.appendChild(btn);
  const nightOn = !!window.graphOthersNightOnly;
  const btnNight = document.createElement('button');
  btnNight.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid #f59e0b;background:${nightOn ? 'rgba(245,158,11,0.22)' : 'transparent'};color:${nightOn ? '#f59e0b' : 'var(--text-muted)'};opacity:${nightOn ? '1' : '0.75'};width:auto;`;
  btnNight.textContent = nightOn ? '🌙 Night Only: ON' : '🌙 Night Only';
  btnNight.addEventListener('click', function () {
    window.graphOthersNightOnly = !window.graphOthersNightOnly;
    try { localStorage.setItem('graphOthersNightOnly', window.graphOthersNightOnly ? 'true' : 'false'); } catch (e) {}
    _renderOthersFridgeToggle();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });
  row.appendChild(btnNight);
  wrap.appendChild(row);

  feedTabs.parentNode.insertBefore(wrap, feedTabs);
}
window._renderOthersFridgeToggle = _renderOthersFridgeToggle;

// ─── W/M tab: Separate Toggles for Water Motor & Water Tank ──────────────────
function _renderWmToggles() {
  const existing = document.getElementById('wm-overlay-toggles');
  if (existing) existing.remove();
  const currentFeed = (typeof graphFeedKey !== 'undefined') ? graphFeedKey : window.graphFeedKey;
  if (currentFeed !== 'wm') return;
  const feedTabs = document.getElementById('graph-feed-tabs');
  if (!feedTabs || !feedTabs.parentNode) return;

  const motorOn = !!window.graphWmIncludeMotor;
  const waterOn = !!window.graphWmIncludeWater;
  const motorColor = '#fbbf24', waterColor = '#0ea5e9';

  const wrap = document.createElement('div');
  wrap.id = 'wm-overlay-toggles';
  wrap.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:0 0 8px;flex-shrink:0;';

  // Button 1: Water Motor
  const btnMotor = document.createElement('button');
  btnMotor.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ${motorColor};background:${motorOn ? 'rgba(251,191,36,0.18)' : 'transparent'};color:${motorOn ? motorColor : 'var(--text-muted)'};opacity:${motorOn ? '1' : '0.75'};width:auto;`;
  btnMotor.textContent = motorOn ? '🚿 Water Motor: Added' : '🚿 + Water Motor';
  btnMotor.addEventListener('click', function () {
    window.graphWmIncludeMotor = !window.graphWmIncludeMotor;
    try { localStorage.setItem('graphWmIncludeMotor', window.graphWmIncludeMotor ? 'true' : 'false'); } catch (e) {}
    _renderWmToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  // Button 2: Water Tank
  const btnWater = document.createElement('button');
  btnWater.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ${waterColor};background:${waterOn ? 'rgba(14,165,233,0.18)' : 'transparent'};color:${waterOn ? waterColor : 'var(--text-muted)'};opacity:${waterOn ? '1' : '0.75'};width:auto;`;
  btnWater.textContent = waterOn ? '💧 Water Tank: Added' : '💧 + Water Tank';
  btnWater.addEventListener('click', function () {
    window.graphWmIncludeWater = !window.graphWmIncludeWater;
    try { localStorage.setItem('graphWmIncludeWater', window.graphWmIncludeWater ? 'true' : 'false'); } catch (e) {}
    _renderWmToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  wrap.appendChild(btnMotor);
  wrap.appendChild(btnWater);
  feedTabs.parentNode.insertBefore(wrap, feedTabs);
}
window._renderWmToggles = _renderWmToggles;

// ─── Water Tank tab: Separate Toggles for Water Motor & W/M ─────────────────
function _renderWaterToggles() {
  const existing = document.getElementById('water-overlay-toggles');
  if (existing) existing.remove();
  const currentFeed = (typeof graphFeedKey !== 'undefined') ? graphFeedKey : window.graphFeedKey;
  if (currentFeed !== 'water') return;
  const feedTabs = document.getElementById('graph-feed-tabs');
  if (!feedTabs || !feedTabs.parentNode) return;

  const motorOn = !!window.graphWaterIncludeMotor;
  const wmOn = !!window.graphWaterIncludeWm;
  const motorColor = '#fbbf24', wmColor = '#e879f9';

  const wrap = document.createElement('div');
  wrap.id = 'water-overlay-toggles';
  wrap.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:0 0 8px;flex-shrink:0;';

  // Button 1: Water Motor
  const btnMotor = document.createElement('button');
  btnMotor.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ${motorColor};background:${motorOn ? 'rgba(251,191,36,0.18)' : 'transparent'};color:${motorOn ? motorColor : 'var(--text-muted)'};opacity:${motorOn ? '1' : '0.75'};width:auto;`;
  btnMotor.textContent = motorOn ? '🚿 Water Motor: Added' : '🚿 + Water Motor';
  btnMotor.addEventListener('click', function () {
    window.graphWaterIncludeMotor = !window.graphWaterIncludeMotor;
    try { localStorage.setItem('graphWaterIncludeMotor', window.graphWaterIncludeMotor ? 'true' : 'false'); } catch (e) {}
    _renderWaterToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  // Button 2: W/M
  const btnWm = document.createElement('button');
  btnWm.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ${wmColor};background:${wmOn ? 'rgba(232,121,249,0.18)' : 'transparent'};color:${wmOn ? wmColor : 'var(--text-muted)'};opacity:${wmOn ? '1' : '0.75'};width:auto;`;
  btnWm.textContent = wmOn ? '👕 W/M: Added' : '👕 + W/M';
  btnWm.addEventListener('click', function () {
    window.graphWaterIncludeWm = !window.graphWaterIncludeWm;
    try { localStorage.setItem('graphWaterIncludeWm', window.graphWaterIncludeWm ? 'true' : 'false'); } catch (e) {}
    _renderWaterToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  wrap.appendChild(btnMotor);
  wrap.appendChild(btnWm);
  feedTabs.parentNode.insertBefore(wrap, feedTabs);
}
window._renderWaterToggles = _renderWaterToggles;

// ─── Motor tab: Separate Toggles for Water Tank & W/M ───────────────────────
function _renderMotorToggles() {
  const existing = document.getElementById('motor-overlay-toggles');
  if (existing) existing.remove();
  const currentFeed = (typeof graphFeedKey !== 'undefined') ? graphFeedKey : window.graphFeedKey;
  if (currentFeed !== 'motor') return;
  const feedTabs = document.getElementById('graph-feed-tabs');
  if (!feedTabs || !feedTabs.parentNode) return;

  const waterOn = !!window.graphMotorIncludeWater;
  const wmOn = !!window.graphMotorIncludeWm;
  const waterColor = '#0ea5e9', wmColor = '#e879f9';

  const wrap = document.createElement('div');
  wrap.id = 'motor-overlay-toggles';
  wrap.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:0 0 8px;flex-shrink:0;';

  // Button 1: Water Tank
  const btnWater = document.createElement('button');
  btnWater.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ${waterColor};background:${waterOn ? 'rgba(14,165,233,0.18)' : 'transparent'};color:${waterOn ? waterColor : 'var(--text-muted)'};opacity:${waterOn ? '1' : '0.75'};width:auto;`;
  btnWater.textContent = waterOn ? '💧 Water Tank: Added' : '💧 + Water Tank';
  btnWater.addEventListener('click', function () {
    window.graphMotorIncludeWater = !window.graphMotorIncludeWater;
    try { localStorage.setItem('graphMotorIncludeWater', window.graphMotorIncludeWater ? 'true' : 'false'); } catch (e) {}
    _renderMotorToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  // Button 2: W/M
  const btnWm = document.createElement('button');
  btnWm.style.cssText = `padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ${wmColor};background:${wmOn ? 'rgba(232,121,249,0.18)' : 'transparent'};color:${wmOn ? wmColor : 'var(--text-muted)'};opacity:${wmOn ? '1' : '0.75'};width:auto;`;
  btnWm.textContent = wmOn ? '👕 W/M: Added' : '👕 + W/M';
  btnWm.addEventListener('click', function () {
    window.graphMotorIncludeWm = !window.graphMotorIncludeWm;
    try { localStorage.setItem('graphMotorIncludeWm', window.graphMotorIncludeWm ? 'true' : 'false'); } catch (e) {}
    _renderMotorToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  wrap.appendChild(btnWater);
  wrap.appendChild(btnWm);
  feedTabs.parentNode.insertBefore(wrap, feedTabs);
}
window._renderMotorToggles = _renderMotorToggles;

// ─── Battery tab: Separate Toggles for Voltage, Net Power & Sessions ────────
function _renderBatteryToggles() {
  const existing = document.getElementById('battery-overlay-toggles');
  if (existing) existing.remove();
  const currentFeed = (typeof graphFeedKey !== 'undefined') ? graphFeedKey : window.graphFeedKey;
  if (currentFeed !== 'battery') return;
  const feedTabs = document.getElementById('graph-feed-tabs');
  if (!feedTabs || !feedTabs.parentNode) return;

  const voltOn = !!window.graphBatteryIncludeVoltage;
  const pwrOn = !!window.graphBatteryIncludePower;
  const sessOn = window.graphBatteryShowSessions !== false;
  const voltColor = '#35c0b7', pwrColor = '#facc15', sessColor = '#10b981';

  const wrap = document.createElement('div');
  wrap.id = 'battery-overlay-toggles';
  wrap.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:0 0 8px;flex-shrink:0;';

  // Button 1: Sessions (ΔSOC)
  const btnSess = document.createElement('button');
  btnSess.style.cssText = 'padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ' + sessColor + ';background:' + (sessOn ? 'rgba(16,185,129,0.2)' : 'transparent') + ';color:' + (sessOn ? sessColor : 'var(--text-muted)') + ';opacity:' + (sessOn ? '1' : '0.75') + ';width:auto;';
  btnSess.textContent = sessOn ? '🔋 Sessions (ΔSOC): ON' : '🔋 + Sessions (ΔSOC)';
  btnSess.addEventListener('click', function () {
    window.graphBatteryShowSessions = !window.graphBatteryShowSessions;
    try { localStorage.setItem('graphBatteryShowSessions', window.graphBatteryShowSessions ? 'true' : 'false'); } catch (e) {}
    _renderBatteryToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  // Button 2: Voltage
  const btnVolt = document.createElement('button');
  btnVolt.style.cssText = 'padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ' + voltColor + ';background:' + (voltOn ? 'rgba(53,192,183,0.18)' : 'transparent') + ';color:' + (voltOn ? voltColor : 'var(--text-muted)') + ';opacity:' + (voltOn ? '1' : '0.75') + ';width:auto;';
  btnVolt.textContent = voltOn ? '⚡ Voltage: Added' : '⚡ + Voltage (V)';
  btnVolt.addEventListener('click', function () {
    window.graphBatteryIncludeVoltage = !window.graphBatteryIncludeVoltage;
    try { localStorage.setItem('graphBatteryIncludeVoltage', window.graphBatteryIncludeVoltage ? 'true' : 'false'); } catch (e) {}
    _renderBatteryToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  // Button 3: Net Power
  const btnPwr = document.createElement('button');
  btnPwr.style.cssText = 'padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ' + pwrColor + ';background:' + (pwrOn ? 'rgba(250,204,21,0.18)' : 'transparent') + ';color:' + (pwrOn ? pwrColor : 'var(--text-muted)') + ';opacity:' + (pwrOn ? '1' : '0.75') + ';width:auto;';
  btnPwr.textContent = pwrOn ? '⚡ Power: Added' : '⚡ + Power (W)';
  btnPwr.addEventListener('click', function () {
    window.graphBatteryIncludePower = !window.graphBatteryIncludePower;
    try { localStorage.setItem('graphBatteryIncludePower', window.graphBatteryIncludePower ? 'true' : 'false'); } catch (e) {}
    _renderBatteryToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  // Button 4: Smooth Gaps / Real Graph
  const smoothOn = window.graphBatterySmoothGaps !== false;
  const smoothColor = '#38bdf8';
  const btnSmooth = document.createElement('button');
  btnSmooth.style.cssText = 'padding:5px 12px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid ' + (smoothOn ? smoothColor : 'var(--border)') + ';background:' + (smoothOn ? 'rgba(56,189,248,0.2)' : 'transparent') + ';color:' + (smoothOn ? smoothColor : 'var(--text-muted)') + ';opacity:' + (smoothOn ? '1' : '0.85') + ';width:auto;';
  btnSmooth.textContent = smoothOn ? '✨ Smooth: ON' : '📊 Real Graph';
  btnSmooth.title = smoothOn
    ? 'Interpolating 10-20m disconnection gaps. Click to show Real Graph.'
    : 'Showing raw recorded data with gap plateaus. Click to enable Smooth Gaps.';
  btnSmooth.addEventListener('click', function () {
    window.graphBatterySmoothGaps = !smoothOn;
    try { localStorage.setItem('graphBatterySmoothGaps', window.graphBatterySmoothGaps ? 'true' : 'false'); } catch (e) {}
    _renderBatteryToggles();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });

  wrap.appendChild(btnSess);
  wrap.appendChild(btnVolt);
  wrap.appendChild(btnPwr);
  wrap.appendChild(btnSmooth);
  feedTabs.parentNode.insertBefore(wrap, feedTabs);
}
window._renderBatteryToggles = _renderBatteryToggles;

// ─── Battery Cycles & 8,000-Cycle Lifespan Forecast Mode ─────────────────────
async function _handleBatteryCyclesMode(nav, stat, canvas, forceRefresh = false) {
  const packKwh = (typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
  const packWh = packKwh * 1000;
  const TARGET_CYCLES = 8000;
  const pkrRate = (typeof solarCfg !== 'undefined' && solarCfg?.pkrPerUnit > 0) ? solarCfg.pkrPerUnit : 60;
  const BATTERY_PRICE_PKR = 227500; // Capital purchase price of battery pack

  const totalLifetimeKwh = Math.round(TARGET_CYCLES * packKwh); // 40,960 kWh
  const totalLifetimePkr = Math.round(totalLifetimeKwh * pkrRate); // 2,457,600 PKR
  const pkrFormatted = totalLifetimePkr >= 1000000
    ? `PKR ${(totalLifetimePkr / 1000000).toFixed(2)}M`
    : `PKR ${totalLifetimePkr.toLocaleString()}`;

  // Capital wear cost per unit & per full cycle
  const batCostPerKwh = BATTERY_PRICE_PKR / totalLifetimeKwh; // ~5.5547 PKR/unit
  const batCostPerCycle = BATTERY_PRICE_PKR / TARGET_CYCLES;   // ~28.4375 PKR/cycle
  const netLifetimeSavingsPkr = totalLifetimePkr - BATTERY_PRICE_PKR; // ~2,230,100 PKR
  const netFormatted = netLifetimeSavingsPkr >= 1000000
    ? `PKR ${(netLifetimeSavingsPkr / 1000000).toFixed(2)}M`
    : `PKR ${netLifetimeSavingsPkr.toLocaleString()}`;

  const nowMs = Date.now();
  const ninetyDaysMs = nowMs - (90 * 86400 * 1000);

  // Parallel fetch: current nav range + 90-day history for period metrics
  const [cyclePts, disPts, voltPts, bat2PowerPts, sohPts, histCyclePts] = await Promise.all([
    _gFetch('546375', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546025', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546013', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546365', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546372', nav.startMs, nav.endMs, nav.interval),
    _gFetch('546375', ninetyDaysMs, nowMs, 3600)
  ]);

  const vMap = new Map();
  voltPts.forEach(p => { if (p && p[0] != null && p[1] > 35) vMap.set(p[0], p[1]); });
  const defaultV = 52.0;

  const powerMap = new Map();
  bat2PowerPts.forEach(p => {
    if (p && p[0] != null && p[1] < -10) powerMap.set(p[0], Math.abs(p[1]));
  });

  const mergedDisPts = disPts.map(p => {
    const ts = p[0];
    const v = vMap.get(ts) || defaultV;
    const fromAmps = Math.max(0, (p[1] || 0) * v);
    const fromPwr = powerMap.get(ts) || 0;
    return [ts, Math.max(fromAmps, fromPwr)];
  });

  const isMonthOrYear = (graphTab === 'month' || graphTab === 'year');
  const kwhBars = _pointsToBars(mergedDisPts, nav, 'batdis');
  const n = nav.nBars || kwhBars.length || 720;

  let lastIdx = n;
  if (graphTab === 'day' && graphDateNav === 0) {
    lastIdx = Math.floor((nowMs - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
    lastIdx = Math.max(0, Math.min(lastIdx, n));
  }

  let cycleBars = new Array(n).fill(0);
  let cumCycleBars = new Array(n).fill(0);
  let runningCum = 0;

  if (isMonthOrYear) {
    for (let i = 0; i < n; i++) {
      const kwh = kwhBars[i] || 0;
      const cyc = kwh / packKwh;
      cycleBars[i] = cyc;
      if (i < lastIdx) {
        runningCum += cyc;
        cumCycleBars[i] = runningCum;
      }
    }
  } else {
    for (let i = 0; i < lastIdx; i++) {
      const w = kwhBars[i] || 0;
      const wh = w * (nav.resSeconds / 3600);
      const cyc = wh / packWh;
      runningCum += cyc;
      cycleBars[i] = (graphChartType === 'hourly' || graphChartType === 'bar') ? cyc : runningCum;
      cumCycleBars[i] = runningCum;
    }
  }

  // --- Historical Analysis for Cycle Gains & Rates ---
  const validHist = (histCyclePts || []).filter(p => p && p[1] != null && !isNaN(p[1]) && p[1] > 0);
  validHist.sort((a, b) => a[0] - b[0]);

  let bmsCount = window.lastResultsMap?.get('Bat2 Cycle Count')?.value;
  if (bmsCount == null || isNaN(bmsCount) || bmsCount <= 0) {
    if (validHist.length) bmsCount = validHist[validHist.length - 1][1];
  }
  if (bmsCount == null || isNaN(bmsCount)) bmsCount = 11;

  let sohVal = window.lastResultsMap?.get('Bat2 SOH')?.value;
  if (sohVal == null && sohPts && sohPts.length) {
    const validSoh = sohPts.filter(p => p && p[1] != null && p[1] > 0);
    if (validSoh.length) sohVal = validSoh[validSoh.length - 1][1];
  }
  if (sohVal == null || isNaN(sohVal)) sohVal = 100;

  const currentCycles = Math.max(0, bmsCount);
  const remainingCycles = Math.max(0, TARGET_CYCLES - currentCycles);
  const pctUsed = Math.min(100, (currentCycles / TARGET_CYCLES) * 100);
  const pctRemaining = Math.max(0, 100 - pctUsed);

  // Used energy and used cost according to battery purchase price
  const usedKwh = currentCycles * packKwh; // e.g. 11 * 5.12 = 56.32 kWh
  const usedBatCost = usedKwh * batCostPerKwh; // e.g. 56.32 * 5.5547 = ~312.8 PKR
  const remainingBatValue = BATTERY_PRICE_PKR - usedBatCost; // remaining asset value
  const remainingKwh = remainingCycles * packKwh;

  function getCycleAt(targetMs) {
    if (!validHist.length) return null;
    let closest = null;
    for (let i = 0; i < validHist.length; i++) {
      const ts = validHist[i][0] < 2e9 ? validHist[i][0] * 1000 : validHist[i][0];
      if (ts <= targetMs) closest = validHist[i][1];
      else break;
    }
    return closest;
  }

  const todayStartMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart() : (nowMs - 86400000);
  const pktDate = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() };
  
  let monthStartMs = nowMs - (30 * 86400000);
  if (typeof getPktBillingRange === 'function') {
    const range = getPktBillingRange(pktDate.year, pktDate.day < 26 ? pktDate.month : pktDate.month + 1);
    monthStartMs = range.startMs;
  }

  const cycTodayStart = getCycleAt(todayStartMs);
  const todayGainVal = cycTodayStart != null ? Math.max(0, currentCycles - cycTodayStart) : (cumCycleBars[lastIdx - 1] || 0.4);

  const cycMonthStart = getCycleAt(monthStartMs);
  const thisMonthGainVal = cycMonthStart != null ? Math.max(0, currentCycles - cycMonthStart) : 2.0;

  let historyDays = 8;
  let historySamplesCount = validHist.length || 168;
  let historyStartDateStr = '2026-09-26';
  let allGainVal = 5.0;

  if (validHist.length > 1) {
    const firstTs = validHist[0][0] < 2e9 ? validHist[0][0] * 1000 : validHist[0][0];
    historyDays = Math.max(1, Math.round((nowMs - firstTs) / 86400000));
    allGainVal = Math.max(0, currentCycles - validHist[0][1]);
    const dObj = new Date(firstTs + 18000000);
    historyStartDateStr = `${dObj.getUTCFullYear()}-${String(dObj.getUTCMonth()+1).padStart(2,'0')}-${String(dObj.getUTCDate()).padStart(2,'0')}`;
  }

  // Realistic daily cycle rate (default to accurate long-term empirical rate ~0.659 cyc/day)
  let dailyCycleRate = historyDays > 0 ? (allGainVal / historyDays) : 0.659;
  if (dailyCycleRate <= 0.05 || isNaN(dailyCycleRate)) dailyCycleRate = 0.659;
  dailyCycleRate = Math.max(0.15, Math.min(2.5, dailyCycleRate));

  const annualCycles = dailyCycleRate * 365.25;
  const daysRemaining = remainingCycles / dailyCycleRate;
  const yearsRemaining = daysRemaining / 365.25;

  const targetDate = new Date(nowMs + daysRemaining * 86400000);
  const targetMonthYear = targetDate.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });

  // Expected This Month calculation
  const totalDaysInMonth = (graphTab === 'month' && nav.nBars) ? nav.nBars : 30;
  const expMonthCyclesVal = dailyCycleRate * totalDaysInMonth;

  // Dynamic Column 1 (TODAY / THIS MONTH / THIS YEAR)
  let col1Label = 'TODAY';
  let col1Value = `${todayGainVal.toFixed(2)} Cycles`;
  let col1Sub = `${(todayGainVal * packKwh).toFixed(2)} kWh discharged today`;

  if (graphTab === 'month') {
    col1Label = 'THIS MONTH';
    const monthSum = cycleBars.slice(0, lastIdx).reduce((a, b) => a + (b || 0), 0);
    col1Value = `${monthSum.toFixed(2)} Cycles`;
    col1Sub = `${(monthSum * packKwh).toFixed(1)} kWh this billing cycle`;
  } else if (graphTab === 'year') {
    col1Label = 'THIS YEAR';
    const yearSum = cycleBars.reduce((a, b) => a + (b || 0), 0);
    col1Value = `${yearSum.toFixed(1)} Cycles`;
    col1Sub = `Monthly avg: ${(yearSum / 12).toFixed(1)} cyc/mo`;
  }

  // Axis ranges
  const activeValues = (graphTab === 'day' ? cycleBars.slice(0, lastIdx) : cycleBars).filter(v => v != null);
  let maxV = activeValues.length ? Math.max(...activeValues, 0.5) * 1.25 : 1.2;
  if (graphTab === 'day') maxV = Math.max(1.1, maxV);
  const maxCum = cumCycleBars.length ? Math.max(...cumCycleBars.slice(0, lastIdx), 1) * 1.15 : 10;

  graphDataCache = {
    bars1: cycleBars,
    bars2: [],
    labels: nav.labels,
    timeLabels: nav.timeLabels || nav.labels,
    fullLabels: nav.fullLabels || nav.labels,
    color1: '#10b981',
    color2: null,
    unit: 'Cycles',
    isCombined: false,
    nav,
    lastIdx,
    multiData: null,
    minV: 0,
    maxV,
    range: maxV,
    barsTemp: isMonthOrYear ? cumCycleBars : [],
    tempMinV: 0,
    tempMaxV: maxCum,
    tempRange: maxCum,
    tempUnit: 'Cycles',
    tempColor: '#38bdf8',
    overlayLabel: 'Cumul. Cycles',
    isDualY: isMonthOrYear
  };

  canvas.style.display = 'block';

  _drawChart(
    canvas, cycleBars, [], nav.labels, '#10b981', null, 'Cycles', false, nav, lastIdx, null,
    0, maxV, maxV,
    isMonthOrYear ? cumCycleBars : [], 0, maxCum, maxCum, 'Cycles', '#38bdf8', 'Cumul. Cycles'
  );

  // Exact Old-Style UI with Used kWh & Used Battery Wear Cost
  stat.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid #10b981; border-radius:10px; padding:10px 14px; margin-bottom:8px; font-family:system-ui, -apple-system, sans-serif; box-sizing:border-box; width:100%;">
      
      <!-- Top Row: Title + Rating + SOH + BMS Count -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:14px; font-weight:800; color:#10b981;">🔄 Battery Cycles &amp; Lifespan Forecast</span>
          <span style="font-size:10px; font-weight:800; background:rgba(16,185,129,0.15); color:#4ade80; border:1px solid rgba(16,185,129,0.35); border-radius:6px; padding:1px 6px;">8,000 Cycle Rating</span>
        </div>
        <div style="font-size:11px; font-weight:700; color:var(--text-muted);">
          SOH: <b style="color:#10b981;">${Math.round(sohVal)}%</b> &bull; BMS Count: <b style="color:var(--text-main); font-size:13px;">${currentCycles}</b> / 8,000
        </div>
      </div>

      <!-- Progress Bar Row with Used kWh & Used Battery Cost -->
      <div style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); font-weight:700; margin-bottom:3px; flex-wrap:wrap; gap:4px;">
          <span>Used: <b style="color:#10b981;">${currentCycles} cycles</b> (${usedKwh.toFixed(1)} kWh &bull; <b style="color:#f59e0b;">PKR ${Math.round(usedBatCost).toLocaleString()}</b> wear &bull; ${pctUsed.toFixed(2)}%)</span>
          <span>Remaining: <b style="color:#38bdf8;">${remainingCycles.toLocaleString()} cycles</b> (${remainingKwh.toFixed(0)} kWh &bull; PKR ${Math.round(remainingBatValue).toLocaleString()} val &bull; ${pctRemaining.toFixed(2)}%)</span>
        </div>
        <div style="width:100%; height:7px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
          <div style="width:${Math.max(0.6, pctUsed).toFixed(2)}%; height:100%; background:linear-gradient(90deg, #10b981, #38bdf8); border-radius:4px;"></div>
        </div>
      </div>

      <!-- 5 Metric Columns Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; font-size:11px;">
        
        <div>
          <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">${col1Label}</div>
          <div style="font-size:17px; font-weight:900; color:#10b981; margin-top:2px; font-variant-numeric:tabular-nums;">${col1Value}</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${col1Sub}</div>
        </div>

        <div>
          <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">EXPECTED THIS MONTH</div>
          <div style="font-size:17px; font-weight:900; color:#38bdf8; margin-top:2px; font-variant-numeric:tabular-nums;">~${expMonthCyclesVal.toFixed(1)} Cycles</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">~${thisMonthGainVal.toFixed(1)} cyc recorded so far</div>
        </div>

        <div>
          <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">DAILY BURN RATE</div>
          <div style="font-size:17px; font-weight:900; color:#facc15; margin-top:2px; font-variant-numeric:tabular-nums;">~${dailyCycleRate.toFixed(2)} cyc/day</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">~${Math.round(annualCycles)} cycles / year</div>
        </div>

        <div>
          <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">LIFESPAN REMAINING</div>
          <div style="font-size:17px; font-weight:900; color:#38bdf8; margin-top:2px; font-variant-numeric:tabular-nums;">~${yearsRemaining.toFixed(1)} Years</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${Math.round(daysRemaining).toLocaleString()} days remaining</div>
        </div>

        <div>
          <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">EXPECTED 8,000 EOL</div>
          <div style="font-size:17px; font-weight:900; color:#a78bfa; margin-top:2px; font-variant-numeric:tabular-nums;">${targetMonthYear}</div>
          <div style="font-size:10px; color:var(--text-muted); margin-top:1px;" title="${totalLifetimeKwh.toLocaleString()} kWh lifetime throughput = PKR ${totalLifetimePkr.toLocaleString()} at ${pkrRate} PKR/unit">${totalLifetimeKwh.toLocaleString()} kWh &bull; <b style="color:#4ade80;">${pkrFormatted}</b> (@ ${pkrRate} PKR/u)</div>
          <div style="font-size:9.5px; color:var(--text-muted); margin-top:1px;" title="Battery cost PKR ${BATTERY_PRICE_PKR.toLocaleString()} over ${totalLifetimeKwh.toLocaleString()} kWh = ${batCostPerKwh.toFixed(2)} PKR/unit wear cost. Net lifetime savings = PKR ${netLifetimeSavingsPkr.toLocaleString()}">Pack: PKR ${(BATTERY_PRICE_PKR/1000).toFixed(1)}k (<b style="color:#38bdf8;">~${batCostPerKwh.toFixed(2)}</b>/u wear &bull; Net: <b style="color:#4ade80;">${netFormatted}</b>)</div>
        </div>

      </div>

      <!-- Compact Period Gains & Economics Strip -->
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); font-size:11px;">
        <span style="color:var(--text-muted); font-weight:600;">Gains: Today <b style="color:#4ade80;">+${todayGainVal.toFixed(1)}</b> &bull; Month <b style="color:#4ade80;">+${thisMonthGainVal.toFixed(1)}</b> &bull; Exp. Month <b style="color:#38bdf8;">~${expMonthCyclesVal.toFixed(1)}</b> &bull; All (${historyDays}d) <b style="color:#4ade80;">+${allGainVal.toFixed(1)}</b></span>
        <span style="color:var(--text-muted); font-size:10px;">Cost/cyc: <b style="color:#facc15;">PKR ${batCostPerCycle.toFixed(2)}</b> (~${batCostPerKwh.toFixed(2)}/u) &bull; Value: <b style="color:#4ade80;">${pkrFormatted}</b> (${totalLifetimeKwh.toLocaleString()} kWh @ ${pkrRate} PKR/u) &bull; ${historySamplesCount} samples</span>
      </div>

    </div>
  `;

  _showGraphLoading(false);
  graphIsLoading = false;
}
window._handleBatteryCyclesMode = _handleBatteryCyclesMode;

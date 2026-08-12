// js/19c4-graphs-others.js
// ─── "Others" feed computation + Fridge toggle ──────────────────────────────

async function _handleOthersFeed(nav, stat, canvas) {
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
  for (let i = 0; i < computedLastIdx; i++) {
    const solar = solarBars[i] || 0;
    const grid = gridBars[i] || 0;
    let sumAppliances = 0;
    for (let j = 2; j < barsArrays.length; j++) {
      sumAppliances += barsArrays[j][i] || 0;
    }
    bars[i] = Math.max(0, solar + grid - sumAppliances);
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
      const isNight = h >= 17 || h < 8;
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
  const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
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
    const ds = _calcStatsForRange(statBars, 8, 17, nav, computedLastIdx);
    dAv = ds.activeAvg; dTt = ds.total;
    const ns = _calcStatsForRange(statBars, 17, 8, nav, computedLastIdx);
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
        const isNight = h >= 17 || h < 8;
        if (includeFridges && isNight) {
          const f1Val = (fridge1Idx >= 0 && results[fridge1Idx] && results[fridge1Idx][i])
            ? (results[fridge1Idx][i][1] || 0) : 0;
          const f2Val = (fridge2Idx >= 0 && results[fridge2Idx] && results[fridge2Idx][i])
            ? (results[fridge2Idx][i][1] || 0) : 0;
          v += Math.max(0, f1Val) + Math.max(0, f2Val);
        }
        if (v > 0) {
          if (h >= 8 && h < 17) dayTot += v / 1000;
          else nightTot += v / 1000;
        }
      }
    }
    const numDays = Math.max(1, nav.nBars || 1);
    dAv = dayTot / numDays; dTt = dayTot;
    nAv = nightTot / numDays; nTt = nightTot;
  }
  const othersLabel = includeFridges ? 'Others + Fridges (Night)' : 'Others';
  stat.innerHTML = _formatStatLine('💡', othersLabel, totalKwh, color1, peak, avg, dAv, dTt, nAv, nTt, unit, true, graphTab);
  _showGraphLoading(false);
  graphIsLoading = false;
}

// ─── Others Fridge Toggle UI ────────────────────────────────────────────────
function _renderOthersFridgeToggle() {
  const existing = document.getElementById('others-fridge-toggle');
  if (existing) existing.remove();
  const currentFeed = (typeof graphFeedKey !== 'undefined')
    ? graphFeedKey
    : window.graphFeedKey;
  if (currentFeed !== 'others') return;
  const feedTabs = document.getElementById('graph-feed-tabs');
  if (!feedTabs || !feedTabs.parentNode) return;
  const on = !!window.graphOthersIncludeFridges;
  const getFeedColor = function (key, fallback) {
    try {
      const feeds = (typeof GRAPH_FEEDS !== 'undefined')
        ? GRAPH_FEEDS
        : window.GRAPH_FEEDS;
      if (!feeds) return fallback;
      const feed = feeds.find(function (f) {
        return f.key === key;
      });
      return feed && feed.color ? feed.color : fallback;
    } catch (e) {
      return fallback;
    }
  };
  const othersColor = getFeedColor('others', '#f59e0b');
  const fridge1Color = getFeedColor('fridge1', '#c084fc');
  const fridge2Color = getFeedColor('fridge2', '#22d3ee');
  const wrap = document.createElement('div');
  wrap.id = 'others-fridge-toggle';
  wrap.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'gap:6px',
    'align-items:center',
    'padding:0 0 8px',
    'flex-shrink:0'
  ].join(';');
  const row = document.createElement('div');
  row.style.cssText = [
    'display:flex',
    'gap:8px',
    'align-items:center',
    'justify-content:center',
    'flex-wrap:wrap'
  ].join(';');
  const btn = document.createElement('button');
  btn.style.cssText = [
    'padding:5px 12px',
    'border-radius:20px',
    'font-size:11px',
    'font-weight:800',
    'cursor:pointer',
    'border:1.5px solid #c084fc',
    'background:' + (on ? 'rgba(192,132,252,0.18)' : 'transparent'),
    'color:' + (on ? '#c084fc' : 'var(--text-muted)'),
    'opacity:' + (on ? '1' : '0.75'),
    'width:auto'
  ].join(';');
  btn.textContent = on ? '🧊 Fridges: Added (Night)' : '🧊 Add Fridges (Night)';
  btn.addEventListener('click', function () {
    window.graphOthersIncludeFridges = !window.graphOthersIncludeFridges;
    try {
      localStorage.setItem(
        'graphOthersIncludeFridges',
        window.graphOthersIncludeFridges ? 'true' : 'false'
      );
    } catch (e) {}
    if (typeof _renderOthersFridgeToggle === 'function') {
      _renderOthersFridgeToggle();
    }
    if (typeof _loadAndDraw === 'function') {
      _loadAndDraw();
    }
  });
  const hint = document.createElement('span');
  hint.style.cssText = 'font-size:10px;color:var(--text-muted);';
  hint.textContent = on
    ? 'Stats show combined Others + Fridges (Night only).'
    : 'Add Fridge 1 + Fridge 2 (Night only) to the Others graph.';
  row.appendChild(btn);
  row.appendChild(hint);
  wrap.appendChild(row);
  if (on) {
    const legend = document.createElement('div');
    legend.id = 'others-fridge-legend';
    legend.style.cssText = [
      'display:flex',
      'gap:12px',
      'flex-wrap:wrap',
      'justify-content:center',
      'align-items:center',
      'font-size:10px'
    ].join(';');
    const items = [
      { label: 'Others', color: othersColor },
      { label: 'Fridge 1', color: fridge1Color },
      { label: 'Fridge 2', color: fridge2Color }
    ];
    items.forEach(function (item) {
      const chip = document.createElement('span');
      chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;';
      const dot = document.createElement('span');
      dot.style.cssText = [
        'width:10px',
        'height:10px',
        'border-radius:50%',
        'display:inline-block',
        'background:' + item.color,
        'box-shadow:0 0 6px ' + item.color + '66'
      ].join(';');
      const txt = document.createElement('span');
      txt.style.cssText = 'font-weight:800;color:var(--text-main);';
      txt.textContent = item.label;
      chip.appendChild(dot);
      chip.appendChild(txt);
      legend.appendChild(chip);
    });
    wrap.appendChild(legend);
  }
  feedTabs.parentNode.insertBefore(wrap, feedTabs);
}
window._renderOthersFridgeToggle = _renderOthersFridgeToggle;

// js/19c5-graphs-load-draw.js
// ─── Main _loadAndDraw orchestrator + loading overlay ───────────────────────

async function _fetchMonthAcBreakdown(nav) {
  if (typeof fetchAcBreakdown === 'function') {
    return await fetchAcBreakdown(nav.startMs, nav.endMs);
  }
  return null;
}

function _showGraphLoading(s) {
  const c = document.querySelector('.graph-chart-card');
  if (!c) return;
  let o = document.getElementById('graph-loading-overlay');
  if (s) {
    if (!o) {
      o = document.createElement('div');
      o.id = 'graph-loading-overlay';
      o.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:20;display:flex;align-items:center;justify-content:center;border-radius:10px;pointer-events:none;`;
      o.innerHTML = `<div style="color:#fff;font-size:14px;font-weight:700;">⏳ Loading...</div>`;
      c.appendChild(o);
    }
    o.style.display = 'flex';
  } else if (o) o.style.display = 'none';
}

async function _loadAndDraw(forceRefresh = false) {
  if (graphIsLoading) return; graphIsLoading = true; _showGraphLoading(true);
  const stat = document.getElementById('graph-stat'), canvas = document.getElementById('graph-canvas');
  if (!canvas || !stat) { graphIsLoading = false; return; }
  stat.textContent = 'Loading…'; hideTooltip();

  // ─── Moment Flow Inspector ───
  if (graphFeedKey === 'momentflow') {
    const nav = _gNavInfo();
    await _handleMomentFlowMode(nav, stat, canvas);
    return;
  }

  // ─── Report Mode ───
  if (graphFeedKey === 'report') {
    canvas.style.display = 'none';
    let reportDiv = document.getElementById('graph-report-view');
    if (!reportDiv) { reportDiv = document.createElement('div'); reportDiv.id = 'graph-report-view'; canvas.parentNode.insertBefore(reportDiv, canvas.nextSibling); }
    reportDiv.style.display = 'block';
    const nav = _gNavInfo();
    const displayLabel = (graphTab === 'day' && nav.sub) ? nav.sub : nav.label;
    stat.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-right:4px; flex-wrap:wrap; gap:6px;">
        <span style="color:#10b981;font-weight:700;font-size:13px;">📄 Energy Usage Report &nbsp; <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">${displayLabel}</span></span>
        <div style="display:flex; gap:4px; align-items:center;">
          <button id="btn-graph-report-clear-cache" style="background:#f59e0b; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" title="Clear local cache and re-fetch entire period">↻ Clear Cache</button>
          <button id="btn-graph-report-txt" style="background:#3b82f6; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save TXT</button>
          <button id="btn-graph-report-png" style="background:#10b981; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save PNG</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      const bClear = document.getElementById('btn-graph-report-clear-cache');
      if (bClear) {
        bClear.onclick = () => {
          if (typeof clearReportCache === 'function') clearReportCache();
          _loadAndDraw(true);
        };
      }
      const bTxt = document.getElementById('btn-graph-report-txt');
      if (bTxt) bTxt.onclick = () => { if(window.downloadDayGraphReport) window.downloadDayGraphReport(); };
      const bPng = document.getElementById('btn-graph-report-png');
      if (bPng) bPng.onclick = () => { if(window.downloadDayGraphReportPng) window.downloadDayGraphReportPng(); };
    }, 50);
    try {
      const report = await window.generateGraphReport(forceRefresh);
      const txt = report.text || ""; const html = report.html || "";
      reportDiv.innerHTML = html + `<pre style="white-space:pre; margin:20px 0 0 0; font-family:monospace; border-top:1px dashed var(--border); padding-top:20px; color:var(--text-muted); opacity:0.8;">${txt}</pre>`;
    } catch(e) { reportDiv.textContent = "Error: " + e.message; }
    _showGraphLoading(false); graphIsLoading = false; return;
  } else {
    canvas.style.display = 'block'; const reportDiv = document.getElementById('graph-report-view'); if (reportDiv) reportDiv.style.display = 'none';
  }

  // ─── Others Feed ───
  if (graphFeedKey === 'others') {
    const nav = _gNavInfo();
    await _handleOthersFeed(nav, stat, canvas);
    return;
  }

  // ─── Standard Feeds (combined / gridall / single / overlaid) ───
  try {
    const nav = _gNavInfo(); const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey);
    const isCombined = graphFeedKey === 'combined', isGridAll = graphFeedKey === 'gridall';
    const color1 = fA?.color || '#facc15', color2 = '#ef4444';
    const isTemp = graphFeedKey.startsWith('temp') || graphFeedKey === 'invtemp';
    const unit = isTemp ? '°C' : (graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' ? 'V' : 'W'));
    let pts1 = [], pts2 = [], bars1 = [], bars2 = [], multiData = null;
    let monthAcBreakdown = null;

    // ── Special Case: W/M tab with Water Motor and/or Water Tank overlay ──
    if (graphFeedKey === 'wm' && (window.graphWmIncludeMotor || window.graphWmIncludeWater)) {
      const feedMotor = GRAPH_FEEDS.find(f => f.key === 'motor');
      const feedWater = GRAPH_FEEDS.find(f => f.key === 'water');
      const promises = [_gFetch(fA.id, nav.startMs, nav.endMs, nav.interval)];
      if (window.graphWmIncludeMotor) promises.push(_gFetch(feedMotor.id, nav.startMs, nav.endMs, nav.interval));
      if (window.graphWmIncludeWater) promises.push(_gFetch(feedWater.id, nav.startMs, nav.endMs, nav.interval));

      const res = await Promise.all(promises);
      const resWm = res[0] || [];
      const resMotor = window.graphWmIncludeMotor ? (res[1] || []) : null;
      const resWater = window.graphWmIncludeWater ? (window.graphWmIncludeMotor ? (res[2] || []) : (res[1] || [])) : null;

      bars1 = _pointsToBars(resWm, nav, 'wm');
      const motorBars = resMotor ? _pointsToBars(resMotor, nav, 'motor') : [];
      const waterBars = resWater ? _pointsToBars(resWater, nav, 'water') : [];

      multiData = [{ key: 'wm', label: 'W/M', color: fA.color, data: bars1, rawPts: resWm }];
      if (window.graphWmIncludeMotor) multiData.push({ key: 'motor', label: 'Water Motor', color: feedMotor.color, data: motorBars, rawPts: resMotor });

      let lastIdx = nav.nBars || bars1.length || 720;
      if (graphTab === 'day' && graphDateNav === 0) {
        lastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
        lastIdx = Math.max(0, Math.min(lastIdx, nav.nBars));
      }

      let cumWm = [], cumMotor = [], rWm = 0, rMot = 0;
      const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
      for (let i = 0; i < lastIdx; i++) {
        let vWm = (bars1[i] || 0) * (isKwhView ? 1 : (nav.resSeconds / 3600) / 1000);
        rWm += vWm; cumWm.push(rWm);
        if (window.graphWmIncludeMotor) {
          let vMot = (motorBars[i] || 0) * (isKwhView ? 1 : (nav.resSeconds / 3600) / 1000);
          rMot += vMot; cumMotor.push(rMot);
        }
      }

      const allPower = [...(bars1.length ? bars1 : []), ...(motorBars.length ? motorBars : [])].filter(v => v > 0);
      const maxV = allPower.length ? Math.max(...allPower) * 1.1 : 100;
      let maxCum = Math.max(...(cumWm.length ? cumWm : [0]), ...(cumMotor.length ? cumMotor : [0]), 0.1);
      const rightMax = window.graphWmIncludeWater ? Math.max(maxCum * 1.1, 100) : maxCum * 1.1;

      graphDataCache = {
        bars1, bars2: motorBars,
        labels: nav.labels, timeLabels: nav.timeLabels || nav.labels, fullLabels: nav.fullLabels || nav.labels,
        color1: fA.color, color2: feedMotor.color, unit: 'W', isCombined: false, nav, lastIdx,
        multiData, minV: 0, maxV, range: maxV,
        barsTemp: cumWm, tempMinV: 0, tempMaxV: rightMax, tempRange: rightMax,
        tempUnit: 'kWh', tempColor: fA.color, overlayLabel: 'W/M Cumul.', isDualY: true,
        barsTemp2: window.graphWmIncludeMotor ? cumMotor : (window.graphWmIncludeWater ? waterBars : null),
        tempColor2: window.graphWmIncludeMotor ? feedMotor.color : feedWater.color,
        overlayLabel2: window.graphWmIncludeMotor ? 'Motor Cumul.' : 'Water Tank %',
        barsTemp3: (window.graphWmIncludeMotor && window.graphWmIncludeWater) ? waterBars : null,
        tempColor3: feedWater.color, overlayLabel3: 'Water Tank %'
      };

      _drawChart(canvas, bars1, motorBars, nav.labels, fA.color, feedMotor.color, 'W', false, nav, lastIdx, multiData, 0, maxV, maxV,
        cumWm, 0, rightMax, rightMax, 'kWh', fA.color, 'W/M Cumul.');

      let statHtml = _formatStatLine('👕', 'Washing Machine', (cumWm[lastIdx-1] || 0), fA.color, Math.max(...(bars1.length ? bars1 : [0]), 0), (bars1.length ? (bars1.reduce((a,b)=>a+b,0)/bars1.length) : 0), null, null, null, null, 'W', true, graphTab);
      if (window.graphWmIncludeMotor) {
        statHtml += _formatStatLine('🚿', 'Water Motor', (cumMotor[lastIdx-1] || 0), feedMotor.color, Math.max(...(motorBars.length ? motorBars : [0]), 0), (motorBars.length ? (motorBars.reduce((a,b)=>a+b,0)/motorBars.length) : 0), null, null, null, null, 'W', true, graphTab);
      }
      if (window.graphWmIncludeWater) {
        const lastWater = waterBars.length ? (waterBars[lastIdx-1] || 0) : 0;
        statHtml += _formatStatLine('💧', 'Water Tank Level', lastWater, feedWater.color, Math.max(...(waterBars.length ? waterBars : [0]), 0), (waterBars.length ? (waterBars.reduce((a,b)=>a+b,0)/waterBars.length) : 0), null, null, null, null, '%', false, graphTab);
      }
      stat.innerHTML = statHtml;
      _showGraphLoading(false); graphIsLoading = false; return;
    }

    // ── Special Case: Water Tank tab with Water Motor and/or W/M overlay ──
    if (graphFeedKey === 'water' && (window.graphWaterIncludeMotor || window.graphWaterIncludeWm)) {
      const feedMotor = GRAPH_FEEDS.find(f => f.key === 'motor');
      const feedWm = GRAPH_FEEDS.find(f => f.key === 'wm');
      const promises = [_gFetch(fA.id, nav.startMs, nav.endMs, nav.interval)];
      if (window.graphWaterIncludeMotor) promises.push(_gFetch(feedMotor.id, nav.startMs, nav.endMs, nav.interval));
      if (window.graphWaterIncludeWm) promises.push(_gFetch(feedWm.id, nav.startMs, nav.endMs, nav.interval));

      const res = await Promise.all(promises);
      const resWater = res[0] || [];
      const resMotor = window.graphWaterIncludeMotor ? (res[1] || []) : null;
      const resWm = window.graphWaterIncludeWm ? (window.graphWaterIncludeMotor ? (res[2] || []) : (res[1] || [])) : null;

      bars1 = _pointsToBars(resWater, nav, 'water');
      const motorBars = resMotor ? _pointsToBars(resMotor, nav, 'motor') : [];
      const wmBars = resWm ? _pointsToBars(resWm, nav, 'wm') : [];

      let lastIdx = nav.nBars || bars1.length || 720;
      if (graphTab === 'day' && graphDateNav === 0) {
        lastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
        lastIdx = Math.max(0, Math.min(lastIdx, nav.nBars));
      }

      const allWatts = [...motorBars, ...wmBars].filter(v => v > 0);
      const maxW = allWatts.length ? Math.max(...allWatts) * 1.1 : 1000;

      graphDataCache = {
        bars1, bars2: [],
        labels: nav.labels, timeLabels: nav.timeLabels || nav.labels, fullLabels: nav.fullLabels || nav.labels,
        color1: fA.color, color2: null, unit: '%', isCombined: false, nav, lastIdx,
        multiData: null, minV: 0, maxV: 100, range: 100,
        barsTemp: window.graphWaterIncludeMotor ? motorBars : wmBars, tempMinV: 0, tempMaxV: maxW, tempRange: maxW,
        tempUnit: 'W', tempColor: window.graphWaterIncludeMotor ? feedMotor.color : feedWm.color,
        overlayLabel: window.graphWaterIncludeMotor ? 'Motor (W)' : 'W/M (W)', isDualY: true,
        barsTemp2: (window.graphWaterIncludeMotor && window.graphWaterIncludeWm) ? wmBars : null,
        tempColor2: feedWm.color, overlayLabel2: 'W/M (W)'
      };

      _drawChart(canvas, bars1, [], nav.labels, fA.color, null, '%', false, nav, lastIdx, null, 0, 100, 100,
        graphDataCache.barsTemp, 0, maxW, maxW, 'W', graphDataCache.tempColor, graphDataCache.overlayLabel);

      let statHtml = _formatStatLine('💧', 'Water Tank Level', (bars1[lastIdx - 1] || 0), fA.color, Math.max(...(bars1.length ? bars1 : [0]), 0), (bars1.length ? (bars1.reduce((a,b)=>a+b,0)/bars1.length) : 0), null, null, null, null, '%', false, graphTab);
      if (window.graphWaterIncludeMotor) {
        const motKwh = motorBars.slice(0, lastIdx).reduce((a,b)=>a+b,0) * (nav.resSeconds / 3600) / 1000;
        statHtml += _formatStatLine('🚿', 'Water Motor', motKwh, feedMotor.color, Math.max(...(motorBars.length ? motorBars : [0]), 0), (motorBars.length ? (motorBars.reduce((a,b)=>a+b,0)/motorBars.length) : 0), null, null, null, null, 'W', true, graphTab);
      }
      if (window.graphWaterIncludeWm) {
        const wmKwh = wmBars.slice(0, lastIdx).reduce((a,b)=>a+b,0) * (nav.resSeconds / 3600) / 1000;
        statHtml += _formatStatLine('👕', 'Washing Machine', wmKwh, feedWm.color, Math.max(...(wmBars.length ? wmBars : [0]), 0), (wmBars.length ? (wmBars.reduce((a,b)=>a+b,0)/wmBars.length) : 0), null, null, null, null, 'W', true, graphTab);
      }
      stat.innerHTML = statHtml;
      _showGraphLoading(false); graphIsLoading = false; return;
    }

    // ── Special Case: Water Motor tab with Water Tank and/or W/M overlay ──
    if (graphFeedKey === 'motor' && (window.graphMotorIncludeWater || window.graphMotorIncludeWm)) {
      const feedWater = GRAPH_FEEDS.find(f => f.key === 'water');
      const feedWm = GRAPH_FEEDS.find(f => f.key === 'wm');
      const promises = [_gFetch(fA.id, nav.startMs, nav.endMs, nav.interval)];
      if (window.graphMotorIncludeWater) promises.push(_gFetch(feedWater.id, nav.startMs, nav.endMs, nav.interval));
      if (window.graphMotorIncludeWm) promises.push(_gFetch(feedWm.id, nav.startMs, nav.endMs, nav.interval));

      const res = await Promise.all(promises);
      const resMotor = res[0] || [];
      const resWater = window.graphMotorIncludeWater ? (res[1] || []) : null;
      const resWm = window.graphMotorIncludeWm ? (window.graphMotorIncludeWater ? (res[2] || []) : (res[1] || [])) : null;

      bars1 = _pointsToBars(resMotor, nav, 'motor');
      const waterBars = resWater ? _pointsToBars(resWater, nav, 'water') : [];
      const wmBars = resWm ? _pointsToBars(resWm, nav, 'wm') : [];

      multiData = [{ key: 'motor', label: 'Water Motor', color: fA.color, data: bars1, rawPts: resMotor }];
      if (window.graphMotorIncludeWm) multiData.push({ key: 'wm', label: 'W/M', color: feedWm.color, data: wmBars, rawPts: resWm });

      let lastIdx = nav.nBars || bars1.length || 720;
      if (graphTab === 'day' && graphDateNav === 0) {
        lastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
        lastIdx = Math.max(0, Math.min(lastIdx, nav.nBars));
      }

      let cumMotor = [], cumWm = [], rMot = 0, rWm = 0;
      const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
      for (let i = 0; i < lastIdx; i++) {
        let vMot = (bars1[i] || 0) * (isKwhView ? 1 : (nav.resSeconds / 3600) / 1000);
        rMot += vMot; cumMotor.push(rMot);
        if (window.graphMotorIncludeWm) {
          let vWm = (wmBars[i] || 0) * (isKwhView ? 1 : (nav.resSeconds / 3600) / 1000);
          rWm += vWm; cumWm.push(rWm);
        }
      }

      const allPower = [...(bars1.length ? bars1 : []), ...(wmBars.length ? wmBars : [])].filter(v => v > 0);
      const maxV = allPower.length ? Math.max(...allPower) * 1.1 : 100;
      let maxCum = Math.max(...(cumMotor.length ? cumMotor : [0]), ...(cumWm.length ? cumWm : [0]), 0.1);
      const rightMax = window.graphMotorIncludeWater ? Math.max(maxCum * 1.1, 100) : maxCum * 1.1;

      graphDataCache = {
        bars1, bars2: wmBars,
        labels: nav.labels, timeLabels: nav.timeLabels || nav.labels, fullLabels: nav.fullLabels || nav.labels,
        color1: fA.color, color2: feedWm.color, unit: 'W', isCombined: false, nav, lastIdx,
        multiData, minV: 0, maxV, range: maxV,
        barsTemp: cumMotor, tempMinV: 0, tempMaxV: rightMax, tempRange: rightMax,
        tempUnit: 'kWh', tempColor: fA.color, overlayLabel: 'Motor Cumul.', isDualY: true,
        barsTemp2: window.graphMotorIncludeWm ? cumWm : (window.graphMotorIncludeWater ? waterBars : null),
        tempColor2: window.graphMotorIncludeWm ? feedWm.color : feedWater.color,
        overlayLabel2: window.graphMotorIncludeWm ? 'W/M Cumul.' : 'Water Tank %',
        barsTemp3: (window.graphMotorIncludeWm && window.graphMotorIncludeWater) ? waterBars : null,
        tempColor3: feedWater.color, overlayLabel3: 'Water Tank %'
      };

      _drawChart(canvas, bars1, wmBars, nav.labels, fA.color, feedWm.color, 'W', false, nav, lastIdx, multiData, 0, maxV, maxV,
        cumMotor, 0, rightMax, rightMax, 'kWh', fA.color, 'Motor Cumul.');

      let statHtml = _formatStatLine('🚿', 'Water Motor', (cumMotor[lastIdx-1] || 0), fA.color, Math.max(...(bars1.length ? bars1 : [0]), 0), (bars1.length ? (bars1.reduce((a,b)=>a+b,0)/bars1.length) : 0), null, null, null, null, 'W', true, graphTab);
      if (window.graphMotorIncludeWater) {
        const lastWater = waterBars.length ? (waterBars[lastIdx-1] || 0) : 0;
        statHtml += _formatStatLine('💧', 'Water Tank Level', lastWater, feedWater.color, Math.max(...(waterBars.length ? waterBars : [0]), 0), (waterBars.length ? (waterBars.reduce((a,b)=>a+b,0)/waterBars.length) : 0), null, null, null, null, '%', false, graphTab);
      }
      if (window.graphMotorIncludeWm) {
        statHtml += _formatStatLine('👕', 'Washing Machine', (cumWm[lastIdx-1] || 0), feedWm.color, Math.max(...(wmBars.length ? wmBars : [0]), 0), (wmBars.length ? (wmBars.reduce((a,b)=>a+b,0)/wmBars.length) : 0), null, null, null, null, 'W', true, graphTab);
      }
      stat.innerHTML = statHtml;
      _showGraphLoading(false); graphIsLoading = false; return;
    }

    if (isGridAll) {
      const visible = GRID_ALL_FEEDS.filter(f => !window.gridAllDisabled.has(f.key));
      multiData = [];
      const results = await Promise.all(visible.map(f => _gFetch(f.id, nav.startMs, nav.endMs, nav.interval)));
      visible.forEach((f, i) => multiData.push({ label: f.label, color: f.color, data: _pointsToBars(results[i], nav, f.key), rawPts: results[i] }));
    } else if (isCombined) {
      pts1 = await _gFetch(GRAPH_FEEDS.find(f => f.key === 'solar').id, nav.startMs, nav.endMs, nav.interval);
      pts2 = await _gFetch(GRAPH_FEEDS.find(f => f.key === 'grid').id, nav.startMs, nav.endMs, nav.interval);
      bars1 = _pointsToBars(pts1, nav, 'solar'); bars2 = _pointsToBars(pts2, nav, 'grid');
    } else {
      if (fA && fA.isSum && Array.isArray(fA.sumFeeds) && fA.sumFeeds.length) {
        const componentPts = await Promise.all(
          fA.sumFeeds.map(key => {
            const feed = GRAPH_FEEDS.find(gf => gf.key === key);
            return _gFetch(feed ? feed.id : null, nav.startMs, nav.endMs, nav.interval);
          })
        );
        pts1  = _mergePointsSum(componentPts);
        bars1 = _pointsToBars(pts1, nav, graphFeedKey);
      } else {
        pts1 = await _gFetch(fA.id, nav.startMs, nav.endMs, nav.interval);
        bars1 = _pointsToBars(pts1, nav, graphFeedKey);
        if (['temp','temp2'].includes(graphFeedKey)) bars2 = _pointsToBars(await _gFetch(graphFeedKey==='temp'?'499429':'512474', nav.startMs, nav.endMs, nav.interval), nav, 'humidity');
        
        if (graphFeedKey === 'acvolts' && (graphTab === 'month' || graphTab === 'year')) {
          monthAcBreakdown = await _fetchMonthAcBreakdown(nav);
        }
      }
    }

    // ─── AC Overlay for temp feeds ───
    let barsTemp = [];
    let ovAc = null;
    let tUnit = 'W';
    let tColor = '#38bdf8';
    let tLabel = 'AC';
    if (['temp','temp2'].includes(graphFeedKey) && window.graphOverlayAc) {
      ovAc = GRAPH_FEEDS.find(f => f.key === window.graphOverlayAc);
      barsTemp = _pointsToBars(await _gFetch(ovAc.id, nav.startMs, nav.endMs, nav.interval), nav, window.graphOverlayAc);
      tColor = ovAc ? ovAc.color : '#38bdf8';
      tLabel = ovAc ? ovAc.label : 'AC';
    }

    let lastIdx = nav.nBars || bars1.length || multiData?.[0]?.data?.length || 720;
    if (graphTab === 'day' && graphDateNav === 0) {
      lastIdx = Math.floor((Date.now() - 60000 - nav.startMs) / (nav.resSeconds * 1000)) + 1;
      lastIdx = Math.max(0, Math.min(lastIdx, nav.nBars));
    }

    // ─── Cumulative kWh for power feeds ───
    let barsTemp2 = [];
    let tColor2 = '#ef4444';
    let tLabel2 = 'Grid Cumul.';
    if ((!isGridAll && fA && fA.isWatts && graphFeedKey !== 'others') || isCombined) {
      let cumulativeKwhArray = [];
      let runningTotal = 0;
      const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
      for (let i = 0; i < lastIdx; i++) {
        let val = bars1[i] || 0;
        if (!isKwhView) {
          val = val * (nav.resSeconds / 3600) / 1000;
        }
        runningTotal += val;
        cumulativeKwhArray.push(runningTotal);
      }
      barsTemp = cumulativeKwhArray;
      tUnit = 'kWh';
      if (isCombined) {
        tColor = '#facc15';
        tLabel = 'Solar Cumul.';
      } else {
        tColor = fA.color || '#facc15';
        tLabel = `${fA.statLabel || fA.label || fA.name} Cumul.`;
      }
      if (isCombined) {
        let cumulativeKwhArray2 = [];
        let runningTotal2 = 0;
        for (let i = 0; i < lastIdx; i++) {
          let val2 = bars2[i] || 0;
          if (!isKwhView) {
            val2 = val2 * (nav.resSeconds / 3600) / 1000;
          }
          runningTotal2 += val2;
          cumulativeKwhArray2.push(runningTotal2);
        }
        barsTemp2 = cumulativeKwhArray2;
      }
    }

    let maxV = 1, minV = 0; const all = (multiData?multiData.flatMap(m=>m.data):[...bars1,...bars2]).filter(v=>v>0);
    if (all.length) { maxV = Math.max(...all)*1.1; if(isTemp){ minV = Math.max(0, Math.min(...all)-5); maxV = Math.max(maxV, minV+10); } }
    const maxBT = barsTemp.length > 0 ? Math.max(...barsTemp, 0.1) : 1;
    const maxBT2 = barsTemp2.length > 0 ? Math.max(...barsTemp2, 0.1) : 1;
    const combinedMaxBT = Math.max(maxBT, maxBT2);
    graphDataCache = {
      bars1, bars2,
      labels: nav.labels,
      timeLabels: nav.timeLabels || nav.labels,
      fullLabels: nav.fullLabels || nav.labels,
      color1, color2, unit, isCombined, nav, lastIdx, multiData, minV, maxV, range: maxV-minV,
      barsTemp, tempMinV: 0, tempMaxV: combinedMaxBT * 1.1, tempRange: combinedMaxBT * 1.1,
      tempUnit: tUnit, tempColor: tColor, overlayLabel: tLabel, isDualY: barsTemp.length > 0,
      barsTemp2, tempColor2: tColor2, overlayLabel2: tLabel2
    };
    _drawChart(canvas, bars1, bars2, nav.labels, color1, color2, unit, isCombined, nav, lastIdx, multiData, minV, maxV, maxV-minV, barsTemp, graphDataCache.tempMinV, graphDataCache.tempMaxV, graphDataCache.tempRange, graphDataCache.tempUnit, graphDataCache.tempColor, graphDataCache.overlayLabel);

    // ─── Render Stats ───
    _renderFeedStats(stat, { bars1, bars2, pts1, pts2, nav, lastIdx, multiData, isGridAll, isCombined, fA, color1, color2, unit, isTemp, graphFeedKey, monthAcBreakdown });

  } catch (e) {
    stat.textContent = 'Error: ' + e.message;
    console.error('Graph error:', e);
  }
  finally { graphIsLoading = false; _showGraphLoading(false); }
}

window._loadAndDraw = _loadAndDraw;

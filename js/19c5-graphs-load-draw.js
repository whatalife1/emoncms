// js/19c5-graphs-load-draw.js
// ─── Main _loadAndDraw orchestrator + loading overlay ───────────────────────

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

async function _loadAndDraw() {
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
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding-right:4px;">
        <span style="color:#10b981;font-weight:700;font-size:13px;">📄 Energy Usage Report &nbsp; <span style="color:var(--text-muted); font-weight:normal; font-size:11px;">${displayLabel}</span></span>
        <div style="display:flex; gap:4px;">
          <button id="btn-graph-report-txt" style="background:#3b82f6; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save TXT</button>
          <button id="btn-graph-report-png" style="background:#10b981; color:#fff; border:none; padding:3px 8px; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">Save PNG</button>
        </div>
      </div>
    `;
    setTimeout(() => {
      const bTxt = document.getElementById('btn-graph-report-txt');
      if (bTxt) bTxt.onclick = () => { if(window.downloadDayGraphReport) window.downloadDayGraphReport(); };
      const bPng = document.getElementById('btn-graph-report-png');
      if (bPng) bPng.onclick = () => { if(window.downloadDayGraphReportPng) window.downloadDayGraphReportPng(); };
    }, 50);
    try {
      const report = await window.generateGraphReport();
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

  // ─── Standard Feeds (combined / gridall / single) ───
  try {
    const nav = _gNavInfo(); const fA = GRAPH_FEEDS.find(f => f.key === graphFeedKey);
    const isCombined = graphFeedKey === 'combined', isGridAll = graphFeedKey === 'gridall';
    const color1 = fA?.color || '#facc15', color2 = '#ef4444';
    const isTemp = graphFeedKey.startsWith('temp') || graphFeedKey === 'invtemp';
    const unit = isTemp ? '°C' : (graphFeedKey === 'water' ? '%' : (graphFeedKey === 'acvolts' ? 'V' : 'W'));
    let pts1 = [], pts2 = [], bars1 = [], bars2 = [], multiData = null;

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
      // ─── Sum feeds (e.g., Fridges 1+2 combined) ───
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

    let lastIdx = bars1.length || multiData?.[0]?.data?.length || 0;
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
        // Single feed: name & color the cumulative line after the feed itself
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
    _renderFeedStats(stat, { bars1, bars2, pts1, pts2, nav, lastIdx, multiData, isGridAll, isCombined, fA, color1, color2, unit, isTemp, graphFeedKey });

  } catch (e) {
    stat.textContent = 'Error: ' + e.message;
    console.error('Graph error:', e);
  }
  finally { graphIsLoading = false; _showGraphLoading(false); }
}

window._loadAndDraw = _loadAndDraw;
window._gFetch = _gFetch;
window._pointsToBars = _pointsToBars;

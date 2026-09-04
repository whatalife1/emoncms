let _lastPollSuccess = Date.now();
let countdownVal = autoRefreshSec;
let countdownTimer, refreshTimer;

async function fetchFeedTime(feedId) {
    const now = Date.now();
    const start = now - 24 * 3600 * 1000;
    const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${start}&end=${now}&skipmissing=1&average=0&interval=0`;
    try {
        const text = await nativeFetch(url);
        if (text && !text.startsWith('ERROR')) {
            const data = JSON.parse(text);
            if (data && data[0] && data[0].data) {
                const points = data[0].data;
                if (points.length > 0) {
                    const last = points[points.length - 1];
                    if (last && last[0] && last[1] !== null) {
                        return parseInt(last[0]);
                    }
                }
            }
        }
    } catch (e) {}
    return null;
}

window.addDebugLog = function(msg) {
  const dbg = document.getElementById('debug-info');
  const debugOn = document.getElementById('debug-toggle')?.checked;
  if (dbg && debugOn) {
    if (dbg.textContent.includes('Waiting for refresh')) dbg.innerHTML = '';
    const time = formatPktTime(Date.now(), 'time');
    dbg.innerHTML = `<div style="margin-bottom:4px; border-bottom:1px solid var(--border); padding-bottom:4px;"><span style="color:var(--text-muted);font-size:10px;">[${time}]</span> <span style="word-break:break-word;">${msg}</span></div>` + dbg.innerHTML.substring(0, 3000);
  }
};

window.isFetchingMonthly = false;

window.backgroundFetchMonthly = async function() {
  if (window.isFetchingMonthly) return;
  window.isFetchingMonthly = true;
  try {
    if (typeof fetchMonthlyUnits === 'function') {
      await fetchMonthlyUnits();
      if (window.lastResultsMap && typeof renderFlowDiagram === 'function') {
        renderFlowDiagram(window.lastResultsMap);
      }
    }
  } catch (e) {
    console.warn("Background fetch failed:", e);
  } finally {
    window.isFetchingMonthly = false;
  }
};

// ─── Water tank leak detection ─────────────────────────────────────────────
const TANK_HISTORY_HOURS = 5;
const TANK_HISTORY_MS = TANK_HISTORY_HOURS * 3600 * 1000;
const GLITCH_FLOOR = 5.0; // Ultrasonic sensor dropout threshold (< 5% is treated as disconnected/halted)

async function checkWaterTankWastage(curTank, nowSec) {
  if (!window.tankHistory) {
    try {
      const saved = localStorage.getItem('water_tank_history');
      window.tankHistory = saved ? JSON.parse(saved) : [];
    } catch(e) {
      window.tankHistory = [];
    }
  }

  const nowMs = nowSec * 1000;
  const isSimulation = Math.abs(nowMs - Date.now()) > 120000;

  if (isSimulation) {
    try {
      const startMs = nowMs - TANK_HISTORY_MS;
      const url = `${PROXY_BASE}/feed/data.json?ids=499431&start=${startMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=120`;
      const text = await nativeFetch(url);
      if (text && !text.startsWith('ERROR')) {
        const parsed = JSON.parse(text);
        const dataPts = parsed[0]?.data || (Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(dataPts) && dataPts.length > 0) {
          const fetchedHistory = [];
          dataPts.forEach(pt => {
            if (pt && pt[0] && pt[1] !== null && !isNaN(pt[1])) {
              const tMs = pt[0] < 2000000000 ? pt[0] * 1000 : pt[0];
              const val = parseFloat(pt[1]);
              if (val >= GLITCH_FLOOR) {
                fetchedHistory.push({ t: tMs, v: val });
              }
            }
          });
          if (fetchedHistory.length > 0) {
            window.tankHistory = fetchedHistory.sort((a, b) => a.t - b.t);
          }
        }
      }
    } catch(e) {
      console.warn("Water tank simulation history fetch warning:", e);
    }
  } else {
    // Live Mode: Only push valid, non-zero sensor readings
    if (curTank != null && !isNaN(curTank) && curTank >= GLITCH_FLOOR) {
      if (window.tankHistory.length === 0 || (nowMs - window.tankHistory[window.tankHistory.length - 1].t) > 10000) {
        window.tankHistory.push({ t: nowMs, v: curTank });
      }
    }

    // Fetch background history if history is empty or short
    const oldest = window.tankHistory[0];
    if (!oldest || (nowMs - oldest.t) < TANK_HISTORY_MS - (20 * 60 * 1000) || window.tankHistory.length < 5) {
      try {
        const startMs = nowMs - TANK_HISTORY_MS;
        const url = `${PROXY_BASE}/feed/data.json?ids=499431&start=${startMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=120`;
        const text = await nativeFetch(url);
        if (text && !text.startsWith('ERROR')) {
          const parsed = JSON.parse(text);
          const dataPts = parsed[0]?.data || (Array.isArray(parsed) ? parsed : []);
          if (Array.isArray(dataPts) && dataPts.length > 0) {
            const fetchedHistory = [];
            dataPts.forEach(pt => {
              if (pt && pt[0] && pt[1] !== null && !isNaN(pt[1])) {
                const tMs = pt[0] < 2000000000 ? pt[0] * 1000 : pt[0];
                const val = parseFloat(pt[1]);
                if (val >= GLITCH_FLOOR) {
                  fetchedHistory.push({ t: tMs, v: val });
                }
              }
            });
            if (fetchedHistory.length > 0) {
              const merged = [...fetchedHistory, ...window.tankHistory];
              const uniqueMap = new Map();
              merged.forEach(item => uniqueMap.set(item.t, item.v));
              window.tankHistory = Array.from(uniqueMap.entries())
                .map(([t, v]) => ({ t, v }))
                .sort((a, b) => a.t - b.t)
                .filter(pt => (nowMs - pt.t) <= TANK_HISTORY_MS && pt.v >= GLITCH_FLOOR);
            }
          }
        }
      } catch(e) {
        console.warn("Water tank live history fetch warning:", e);
      }
    }
  }

  // Filter to keep last TANK_HISTORY_HOURS and valid readings only
  window.tankHistory = window.tankHistory.filter(pt => (nowMs - pt.t) <= TANK_HISTORY_MS && pt.v >= GLITCH_FLOOR);

  try {
    localStorage.setItem('water_tank_history', JSON.stringify(window.tankHistory));
  } catch(e) {}

  // ─── TRANSIENT V-SHAPE DIP & OUTLIER FILTER ─────────────────────────────
  // Detect readings that temporarily drop and rebound within <= 15 minutes
  // without the motor running. These are transient echo bounce/condensation glitches.
  const rawPts = window.tankHistory;
  const isTransientGlitch = new Set();

  for (let i = 0; i < rawPts.length; i++) {
    const pt = rawPts[i];
    
    // Find pre-dip stable reference reading
    let preVal = null;
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      if ((pt.t - rawPts[j].t) <= 15 * 60 * 1000) {
        preVal = rawPts[j].v;
        break;
      }
    }

    if (preVal !== null && pt.v < preVal - 7.0) {
      // Look ahead up to 15 min for rebound back to pre-dip level
      for (let k = i + 1; k < Math.min(rawPts.length, i + 10); k++) {
        if ((rawPts[k].t - pt.t) <= 15 * 60 * 1000) {
          if (rawPts[k].v >= preVal - 4.0) {
            // Rebounded back without pump running -> mark all points in the trough as transient glitches
            for (let g = i; g < k; g++) {
              if (rawPts[g].v < preVal - 5.0) {
                isTransientGlitch.add(rawPts[g].t);
              }
            }
            break;
          }
        } else {
          break;
        }
      }
    }
  }

  // Clean history: valid values only, transient dip artifacts removed
  const cleanHistory = rawPts.filter(p => !isTransientGlitch.has(p.t));

  const MIN_MEDIAN_SAMPLES = 3;
  const getMedian = (startMs, endMs) => {
    const pts = cleanHistory.filter(p => p.t >= startMs && p.t <= endMs);
    if (pts.length < MIN_MEDIAN_SAMPLES) return null;
    const vals = pts.map(p => p.v).sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  };

  const getSpread = (startMs, endMs) => {
    const pts = cleanHistory.filter(p => p.t >= startMs && p.t <= endMs);
    if (pts.length < MIN_MEDIAN_SAMPLES) return 999;
    const vals = pts.map(p => p.v);
    return Math.max(...vals) - Math.min(...vals);
  };

  let isWasting = false;
  let wastageMsg = "";
  let dropRateHr = 0;
  let droppedPct = 0;
  let timeSpanMin = 0;
  let startTStr = "";
  let endTStr = "";

  const CURRENT_WINDOW_MIN = 10;

  if (cleanHistory.length >= 5) {
    const motorW = window.lastResultsMap?.get('Water Motor')?.value || 0;

    // Only detect depletion if water motor is NOT running
    if (motorW <= 20) {
      const currentMedian = getMedian(nowMs - CURRENT_WINDOW_MIN * 60 * 1000, nowMs);
      const currentSpread = getSpread(nowMs - CURRENT_WINDOW_MIN * 60 * 1000, nowMs);

      // Require stable readings in current window (spread < 8%)
      if (currentMedian !== null && currentSpread < 8.0) {
        const recentPts = cleanHistory.filter(p => p.t >= nowMs - 8 * 60 * 1000);
        const isSustained = recentPts.length >= 3;

        if (isSustained) {
          const checkWindows = [
            { span: 15,  minDrop: 3.5,  maxRate: 35.0 },
            { span: 20,  minDrop: 4.0,  maxRate: 35.0 },
            { span: 30,  minDrop: 5.0,  maxRate: 30.0 },
            { span: 45,  minDrop: 6.0,  maxRate: 25.0 },
            { span: 60,  minDrop: 7.0,  maxRate: 20.0 },
            { span: 90,  minDrop: 8.5,  maxRate: 18.0 },
            { span: 120, minDrop: 10.0, maxRate: 15.0 },
            { span: 180, minDrop: 12.0, maxRate: 12.0 },
            { span: 240, minDrop: 14.0, maxRate: 10.0 }
          ];

          for (const win of checkWindows) {
            const targetMs = nowMs - (win.span * 60 * 1000);
            const pastMedian = getMedian(targetMs - 6 * 60 * 1000, targetMs + 6 * 60 * 1000);
            const pastSpread = getSpread(targetMs - 6 * 60 * 1000, targetMs + 6 * 60 * 1000);

            if (pastMedian !== null && pastSpread < 8.0) {
              const drop = pastMedian - currentMedian;
              const rateHr = drop / (win.span / 60);

              if (drop >= win.minDrop && rateHr <= win.maxRate) {
                // Recovery check: ensure tank isn't currently rising/rebounding
                const halfWindowMs = 15 * 60 * 1000;
                const olderHalfMedian = getMedian(nowMs - 2 * halfWindowMs, nowMs - halfWindowMs);
                const newerHalfMedian = getMedian(nowMs - halfWindowMs, nowMs);
                if (olderHalfMedian !== null && newerHalfMedian !== null) {
                  if (newerHalfMedian > olderHalfMedian + 4.0) {
                    continue; // Tank is recovering
                  }
                }

                isWasting = true;
                droppedPct = drop;
                timeSpanMin = win.span;
                dropRateHr = rateHr;

                startTStr = formatPktTime(targetMs, 'time');
                endTStr = formatPktTime(nowMs, 'time');
                wastageMsg = `🚨 WATER WASTAGE / VALVE OPEN ALERT! Tank dropped ${drop.toFixed(1)}% in ~${timeSpanMin}m (between ${startTStr} and ${endTStr}). Rate: -${dropRateHr.toFixed(1)}%/hr. Check for open valves or leaks!`;

                break;
              }
            }
          }
        }
      }
    }
  }

  if (isWasting) {
    window.waterWasteDetected = {
      active: true,
      ratePerHour: dropRateHr,
      droppedPct: droppedPct,
      timeSpanMin: timeSpanMin,
      startTimeStr: startTStr,
      endTimeStr: endTStr,
      msg: wastageMsg
    };

    const lastNotified = window._lastWaterWasteNotified || 0;
    if (nowMs - lastNotified > 10 * 60 * 1000) {
      window._lastWaterWasteNotified = nowMs;
      if (typeof showToast === 'function') {
        showToast(wastageMsg, 'alert');
      }
      if (window.Android && window.Android.showNotification) {
        window.Android.showNotification("🚨 WATER WASTAGE / VALVE OPEN!", wastageMsg);
      } else if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
        try {
          new Notification("🚨 WATER WASTAGE / VALVE OPEN!", { body: wastageMsg });
        } catch(e) {}
      }
    }
  } else {
    // Reset immediately when level normalizes
    window.waterWasteDetected = { active: false };
  }

  return window.waterWasteDetected;
}

async function poll() {
  const btn = document.getElementById('btn-refresh');
  const footer = document.getElementById('footer');
  
  const pktTodayStart = getPktTodayStart();
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spin">↻</span>';
  }
  if (footer) footer.textContent = 'Fetching...';

  let fetchStart = Date.now();

  try {
    if (!window.monthlyUnits) {
       window.backgroundFetchMonthly(); 
    }

    const bulkData = await fetchEmonBulk();
    if (!bulkData) throw new Error("No data received");

    if (window.lastFlowRate === undefined) {
      window.lastFlowRate = parseFloat(localStorage.getItem('water_last_flow_rate')) || 0;
    }
    if (window.lastMotorOnTime === undefined) {
      window.lastMotorOnTime = parseInt(localStorage.getItem('water_last_motor_on_time')) || 0;
    }
    if (window.waterFlowRate === undefined) {
      window.waterFlowRate = 0;
    }
    if (window.fillSessionStartLevel === undefined) {
      const savedLvl = localStorage.getItem('water_session_start_level');
      window.fillSessionStartLevel = savedLvl ? parseFloat(savedLvl) : null;
    }
    if (window.fillSessionStartTime === undefined) {
      const savedTime = localStorage.getItem('water_session_start_time');
      window.fillSessionStartTime = savedTime ? parseInt(savedTime) : null;
    }
    if (window.waterAvgFlowRate === undefined) {
      const savedAvg = localStorage.getItem('water_session_avg_flow');
      window.waterAvgFlowRate = savedAvg ? parseFloat(savedAvg) : 0;
    }

    const tankEntry = bulkData.get("499431");
    const curTankVal = tankEntry ? tankEntry.v : null;
    const nowSec = Math.floor(Date.now() / 1000);
    
    // Execute water tank depletion check with noise filtering
    await checkWaterTankWastage(curTankVal, nowSec);
    
    // Process flow rate only on valid readings (>= 5%) to avoid phantom flow spikes
    if (tankEntry && tankEntry.v != null && tankEntry.v >= GLITCH_FLOOR) {
      const curTank = tankEntry.v;
      const now = Date.now();
      
      if (window.prevTankLevel === undefined || window.prevTankTime === undefined || window.prevTankLevel < GLITCH_FLOOR) {
        window.prevTankLevel = curTank;
        window.prevTankTime = now;
        window.waterFlowRate = 0;
      } else {
        const pctDiff = curTank - window.prevTankLevel;
        const timeDiffMin = (now - window.prevTankTime) / 60000;
        
        // Reject step-jumps (> 25% in under 1 minute) from echo bounce glitches
        if (pctDiff > 0 && pctDiff < 25 && timeDiffMin > 0.1) {
          const calculatedFlow = (pctDiff * 10) / timeDiffMin;
          if (calculatedFlow > 0.5 && calculatedFlow < 150) {
            window.waterFlowRate = calculatedFlow;
            window.lastFlowRate = calculatedFlow;
            window.lastMotorOnTime = now;
            localStorage.setItem('water_last_flow_rate', calculatedFlow.toString());
            localStorage.setItem('water_last_motor_on_time', now.toString());
            
            if (window.fillSessionStartTime === null || window.fillSessionStartLevel === null) {
              window.fillSessionStartTime = window.prevTankTime;
              window.fillSessionStartLevel = window.prevTankLevel;
              localStorage.setItem('water_session_start_time', window.fillSessionStartTime.toString());
              localStorage.setItem('water_session_start_level', window.fillSessionStartLevel.toString());
            }
            
            const totalElapsedMin = (now - window.fillSessionStartTime) / 60000;
            if (totalElapsedMin > 0.1) {
              const totalPctDiff = curTank - window.fillSessionStartLevel;
              if (totalPctDiff > 0) {
                const avgFlow = (totalPctDiff * 10) / totalElapsedMin;
                if (avgFlow > 0.5 && avgFlow < 150) {
                  window.waterAvgFlowRate = avgFlow;
                  localStorage.setItem('water_session_avg_flow', avgFlow.toString());
                }
              }
            }
          }
        } else if (pctDiff < 0) {
          window.waterFlowRate = 0;
        } else {
          if (now - window.prevTankTime > 15 * 60 * 1000) {
            window.waterFlowRate = 0;
            window.fillSessionStartTime = null;
            window.fillSessionStartLevel = null;
            window.waterAvgFlowRate = 0;
            localStorage.removeItem('water_session_start_time');
            localStorage.removeItem('water_session_start_level');
            localStorage.removeItem('water_session_avg_flow');
          }
        }
        window.prevTankLevel = curTank;
        window.prevTankTime = now;
      }
    } else {
      window.waterFlowRate = 0;
    }

    const fetchTime = Date.now() - fetchStart;
    if (window.addDebugLog) {
      const missing = FEEDS_BASE.filter(f => !bulkData.has(String(f.id)));
      if (missing.length > 0) {
        const names = missing.map(f => `${f.name} (${f.id})`).join(', ');
        window.addDebugLog(`<b style="color:#ef4444">Proxy Bulk:</b> ${fetchTime}ms, ${bulkData.size} feeds returned, but MISSING: ${names}`);
      } else {
        window.addDebugLog(`<b>Proxy Bulk:</b> OK (${fetchTime}ms, ${bulkData.size}/${FEEDS_BASE.length} expected feeds present)`);
      }
    }

    const results = await Promise.all(userOrderedFeeds.filter(f => f.enabled).map(async f => {
      const entry = bulkData.get(String(f.id));
      let val = entry ? entry.v : null;
      let time = entry ? entry.t : null;

      if (val === null) {
        try { val = await fetchEmon(f.id); } catch(err) {}
      }

      if (f.name.toLowerCase().includes('today') && val !== null) {
        if (time) {
          const timestampMs = time < 2000000000 ? time * 1000 : time;
          if (timestampMs < pktTodayStart) {
            if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Stale:</b> ${f.name} (recorded ${formatPktTime(timestampMs, 'time')} PKT)`);
            val = 0;
            if (window.addDebugLog) window.addDebugLog(`<b style="color:var(--accent-solar)">Reset:</b> ${f.name} (stale value from yesterday PKT)`);
          }
        } else if (!entry && val === null) {
          val = 0;
        }
      }

      // --- Staleness Logic ---
      if (val !== null && time) {
        const tsMs = time < 2000000000 ? time * 1000 : time;
        const age = Date.now() - tsMs;
        const isAccumulator = f.name.toLowerCase().includes('today') || f.name.toLowerCase().includes('total');
        
        if (!isAccumulator) {
          if (STALE_EXEMPT.has(f.name)) {
            const TEN_MINS_MS = 10 * 60 * 1000;
            if (age > TEN_MINS_MS) {
              if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Sensor Timeout:</b> ${f.name} (no update in ${Math.round(age/60000)}m) set to 0`);
              val = 0;
            }
          } else {
            if (age > STALE_MS) {
              if (window.addDebugLog) window.addDebugLog(`<b style="color:#f59e0b">Power Stale:</b> ${f.name} (no update in ${Math.round(age/60000)}m) set to 0`);
              val = 0;
            }
          }
        }
      }

      return { ...f, value: val ?? null, time: time ?? null };
    }));

    const timeFixIds = [
        { name: 'Water Motor', id: '542850' },
        { name: 'Fridge2', id: '541348' },
        { name: 'Washing Machine', id: '544694' }
    ];
    for (const feed of timeFixIds) {
        const result = results.find(r => r.name === feed.name);
        if (result && (result.time === null || result.time === undefined || isNaN(result.time))) {
            const ts = await fetchFeedTime(feed.id);
            if (ts !== null) {
                result.time = Math.floor(ts / 1000);
            }
        }
    }

    localStorage.setItem('last_known_results', JSON.stringify(results));

    const bm = new Map(results.map(r => [r.name, r]));
    window.lastResultsMap = bm;
    window.lastSolarActual = bm.get('Solar')?.value || 0;

    // Detect offline/0W appliances BEFORE rendering
    if (typeof checkApplianceOffline === 'function') await checkApplianceOffline(nowSec, bm);

    renderResults(results);

    if (typeof checkAlerts === 'function') checkAlerts(bm);
    if (typeof updateMainPredicted === 'function') updateMainPredicted();
    if (typeof updateOfflineWarningBanner === 'function') updateOfflineWarningBanner(bm);
    
    if (footer) {
      const localTime = formatPktTime(Date.now(), 'time');
      footer.textContent = 'Updated ' + localTime;
    }
    _lastPollSuccess = Date.now();
  } catch (e) {
    console.error("Poll error:", e);
    if (footer) footer.textContent = 'Error: ' + e.message.substring(0, 20);
    if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Poll Error:</b> ${e.message}`);
  } finally {
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Refresh';
    }
    resetCountdown();
  }
}

setInterval(() => {
  const stale = Date.now() - _lastPollSuccess > 5 * 60 * 1000;
  const ind = document.getElementById('stale-indicator');
  if (ind) ind.style.display = stale ? 'inline' : 'none';
}, 30000);

function resetCountdown() {
  clearInterval(countdownTimer);
  clearTimeout(refreshTimer);
  countdownVal = autoRefreshSec;
  updateCountdownUI();
  countdownTimer = setInterval(() => {
    countdownVal--;
    updateCountdownUI();
    if (countdownVal <= 0) clearInterval(countdownTimer);
  }, 1000);
  refreshTimer = setTimeout(poll, autoRefreshSec * 1000);
}

function updateCountdownUI() {
  const el = document.getElementById('countdown');
  const pb = document.getElementById('progress-bar');
  const ratio = Math.max(0, countdownVal / autoRefreshSec);
  if (el) el.textContent = countdownVal > 0 ? `Next in ${countdownVal}s` : 'Updating...';
  if (pb) pb.style.width = (ratio * 100).toFixed(1) + '%';
}

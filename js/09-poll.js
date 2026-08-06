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
// TANK_HISTORY_HOURS must be >= the longest span in checkWindows below,
// or the longer windows will never find data to compare against.
const TANK_HISTORY_HOURS = 5;
const TANK_HISTORY_MS = TANK_HISTORY_HOURS * 3600 * 1000;

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
  // Detect if we are running in Simulator Mode (i.e. nowSec is a historical simulated time)
  const isSimulation = Math.abs(nowMs - Date.now()) > 120000;

  if (isSimulation) {
    // In Simulation Mode: ALWAYS fetch historical data for [nowMs - TANK_HISTORY_MS, nowMs]
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
              fetchedHistory.push({ t: tMs, v: parseFloat(pt[1]) });
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
    // Live Real-Time Mode: Push curTank if valid
    if (curTank != null && !isNaN(curTank)) {
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
                fetchedHistory.push({ t: tMs, v: parseFloat(pt[1]) });
              }
            });
            if (fetchedHistory.length > 0) {
              const merged = [...fetchedHistory, ...window.tankHistory];
              const uniqueMap = new Map();
              merged.forEach(item => uniqueMap.set(item.t, item.v));
              window.tankHistory = Array.from(uniqueMap.entries())
                .map(([t, v]) => ({ t, v }))
                .sort((a, b) => a.t - b.t)
                .filter(pt => (nowMs - pt.t) <= TANK_HISTORY_MS);
            }
          }
        }
      } catch(e) {
        console.warn("Water tank live history fetch warning:", e);
      }
    }
  }

  // Filter to keep last TANK_HISTORY_HOURS relative to nowMs
  window.tankHistory = window.tankHistory.filter(pt => (nowMs - pt.t) <= TANK_HISTORY_MS);

  try {
    localStorage.setItem('water_tank_history', JSON.stringify(window.tankHistory));
  } catch(e) {}

  let isWasting = false;
  let wastageMsg = "";
  let dropRateHr = 0;
  let droppedPct = 0;
  let timeSpanMin = 0;
  let startTStr = "";
  let endTStr = "";

  // ─── SENSOR GLITCH DETECTION ────────────────────────────────────────────
  // The ultrasonic sensor sometimes halts and reports 0% until restarted.
  // A glitch signature = a point at/near 0, OR a point within a short
  // window of a near-zero point (the up-ramp as it snaps back after
  // restart). These must be excluded from BOTH the "current level" and
  // the "recovery check" — otherwise a restart's snap-back looks exactly
  // like a real refill and hides genuine leaks.
  const GLITCH_FLOOR = 5.0;      // values below this = sensor halted
  const GLITCH_GUARD_MIN = 6;    // minutes around a glitch point to also exclude (the up/down ramp)

  const glitchTimes = window.tankHistory
    .filter(p => p.v < GLITCH_FLOOR)
    .map(p => p.t);

  const isNearGlitch = (t) => glitchTimes.some(gt => Math.abs(t - gt) <= GLITCH_GUARD_MIN * 60 * 1000);

  // Clean history: real sensor readings only, glitch points and their
  // recovery ramps removed entirely.
  const cleanHistory = window.tankHistory.filter(p => p.v >= GLITCH_FLOOR && !isNearGlitch(p.t));

  // --- NOISE-TOLERANT MEDIAN FILTER (using cleaned, glitch-free data) ---
  // MIN_MEDIAN_SAMPLES: with readings this noisy (single points can swing
  // +/-15% in 2 minutes), a 2-3 point median is not trustworthy - it can
  // land squarely on a noise trough/peak. Require at least 4 real samples.
  const MIN_MEDIAN_SAMPLES = 4;
  const getMedian = (startMs, endMs) => {
    const pts = cleanHistory.filter(p => p.t >= startMs && p.t <= endMs);
    if (pts.length < MIN_MEDIAN_SAMPLES) return null;
    const vals = pts.map(p => p.v).sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)];
  };

  // CURRENT_WINDOW_MIN: window used to establish "now". If the sensor was
  // offline (glitch) for part or all of this window, cleanHistory will be
  // sparse or empty here - getMedian's sample-count guard above already
  // returns null in that case, so detection is safely skipped for this
  // cycle rather than risking a comparison against a stale/contaminated
  // reading pulled in from just outside the outage.
  const CURRENT_WINDOW_MIN = 10;

  if (cleanHistory.length >= 5) {
    const motorW = window.lastResultsMap?.get('Water Motor')?.value || 0;

    // Only detect depletion if motor is NOT running
    if (motorW <= 20) {

      // Current level is median of the last CURRENT_WINDOW_MIN minutes
      // (glitch-free).
      const currentMedian = getMedian(nowMs - CURRENT_WINDOW_MIN * 60 * 1000, nowMs);

      if (currentMedian !== null) {

        const checkWindows = [
          { span: 15,  minDrop: 2.5 },
          { span: 20,  minDrop: 3.0 },
          { span: 30,  minDrop: 3.5 },
          { span: 45,  minDrop: 5.0 },
          { span: 60,  minDrop: 6.0 },
          { span: 90,  minDrop: 8.0 },
          { span: 120, minDrop: 8.0 },
          { span: 180, minDrop: 10.0 },
          { span: 240, minDrop: 10.0 },
          { span: 300, minDrop: 12.0 }
        ];

        for (const win of checkWindows) {
          const targetMs = nowMs - (win.span * 60 * 1000);

          // Past level is median of a wider (+/-6 min) window around target,
          // glitch-free. Widened from +/-3 min because a tight window often
          // sampled only 2-3 points - not enough to reject noise swinging
          // +/-15% between consecutive readings.
          const pastMedian = getMedian(targetMs - 6 * 60 * 1000, targetMs + 6 * 60 * 1000);

          if (pastMedian !== null) {
            const drop = pastMedian - currentMedian;
            const rateHr = drop / (win.span / 60);

            // Rate check: real leaks are steady (<45%/hr). Extreme rates
            // combined with a near-zero current reading indicate a sensor
            // cutout, not a real leak — skip those explicitly.
            if (currentMedian < 3.0 && rateHr > 20.0) {
              continue;
            }

            if (drop >= win.minDrop && rateHr <= 45.0) {

              // Recovery check: distinguish a REAL refill (sustained rise
              // over many samples) from ordinary noise producing one low
              // point in the last 30 minutes. Comparing against a single
              // min-point was too aggressive - normal jitter riding on a
              // still-declining trend can dip below "current" for one
              // sample and wrongly veto every window. Instead, compare the
              // median of the OLDER half of the last 30 min against the
              // median of the NEWER half: only a real, sustained climb
              // counts as recovery.
              const halfWindowMs = 15 * 60 * 1000;
              const olderHalfMedian = getMedian(nowMs - 2 * halfWindowMs, nowMs - halfWindowMs);
              const newerHalfMedian = getMedian(nowMs - halfWindowMs, nowMs);
              if (olderHalfMedian !== null && newerHalfMedian !== null) {
                if (newerHalfMedian > olderHalfMedian + 6.0) {
                  continue; // Tank is genuinely recovering (sustained rise, not a noise blip)
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

    // System Notification & Toast (throttled to once every 10 mins)
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
    
    // Execute water tank depletion check
    await checkWaterTankWastage(curTankVal, nowSec);
    
    if (tankEntry && tankEntry.v != null) {
      const curTank = tankEntry.v;
      const now = Date.now();
      
      if (window.prevTankLevel === undefined || window.prevTankTime === undefined) {
        window.prevTankLevel = curTank;
        window.prevTankTime = now;
        window.waterFlowRate = 0;
      } else {
        const pctDiff = curTank - window.prevTankLevel;
        
        if (pctDiff > 0) {
          const timeDiffMin = (now - window.prevTankTime) / 60000;
          if (timeDiffMin > 0.1) {
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
        // Always update tank variables to prevent state machine lockup
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

      if (!STALE_EXEMPT.has(f.name) && val !== null && time) {
        const tsMs = time < 2000000000 ? time * 1000 : time;
        const age = Date.now() - tsMs;
        const isAccumulator = f.name.toLowerCase().includes('today') || f.name.toLowerCase().includes('total');
        if (age > STALE_MS && !isAccumulator) {
          if (window.addDebugLog) {
            window.addDebugLog(`<b style="color:#f59e0b">Stale→0:</b> ${f.name} (no update in ${Math.round(age/60000)}m)`);
          }
          val = 0;
        }
      }

      return { ...f, value: val ?? null, time: time ?? null };
    }));

    const timeFixIds = [
        { name: 'Water Motor', id: '542850' },
        { name: 'Fridge2', id: '541348' }
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

  // Run offline detection (does not block UI)
  try {
    const offline = await checkApplianceOffline(Math.floor(Date.now() / 1000));
    window.applianceOfflineDetected = offline || [];
  } catch (e) {
    console.warn('Offline detection error:', e);
    window.applianceOfflineDetected = [];
  }
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

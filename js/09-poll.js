let _lastPollSuccess = Date.now();
let countdownVal = autoRefreshSec;
let countdownTimer, refreshTimer;

window.addDebugLog = function(msg) {
  const dbg = document.getElementById('debug-info');
  const debugOn = document.getElementById('debug-toggle')?.checked;
  if (dbg && debugOn) {
    if (dbg.textContent.includes('Waiting for refresh')) dbg.innerHTML = '';
    const time = new Date().toLocaleTimeString([], { hour12: false });
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

async function poll() {
  const btn = document.getElementById('btn-refresh');
  const footer = document.getElementById('footer');
  const dbg = document.getElementById('debug-info');
  const startOfToday = new Date().setHours(0,0,0,0) / 1000;
  
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

    // --- Water Flow Rate Calculation ---
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
            // Filter out extreme noise / telemetry glitches
            if (calculatedFlow > 0.5 && calculatedFlow < 150) {
              window.waterFlowRate = calculatedFlow;
              window.lastFlowRate = calculatedFlow;
              window.lastMotorOnTime = now;
              localStorage.setItem('water_last_flow_rate', calculatedFlow.toString());
              localStorage.setItem('water_last_motor_on_time', now.toString());
              
              // Start of session check
              if (window.fillSessionStartTime === null || window.fillSessionStartLevel === null) {
                window.fillSessionStartTime = window.prevTankTime;
                window.fillSessionStartLevel = window.prevTankLevel;
                localStorage.setItem('water_session_start_time', window.fillSessionStartTime.toString());
                localStorage.setItem('water_session_start_level', window.fillSessionStartLevel.toString());
              }
              
              // Calculate Session Average Flow
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

              window.prevTankLevel = curTank;
              window.prevTankTime = now;
            }
          }
        } else if (pctDiff < 0) {
          // Drop in level (noise or usage), reset baseline to avoid carrying over negative diff
          window.waterFlowRate = 0;
          window.prevTankLevel = curTank;
          window.prevTankTime = now;
        } else {
          // pctDiff === 0: level hasn't changed yet. Do NOT reset baseline or flow rate!
          // If no increase has been detected for > 15 mins, assume filling has stopped.
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
      }
    } else {
      window.waterFlowRate = 0;
    }

    const fetchTime = Date.now() - fetchStart;
    if (window.addDebugLog) {
        window.addDebugLog(`<b>Proxy Bulk:</b> OK (${fetchTime}ms, ${bulkData.size} feeds)`);
    }

    // Added Fallback: If bulkData misses a feed, fetch it directly
    const results = await Promise.all(userOrderedFeeds.filter(f => f.enabled).map(async f => {
      const entry = bulkData.get(String(f.id));
      let val = entry ? entry.v : null;
      let time = entry ? entry.t : null;

      if (val === null) {
        try { val = await fetchEmon(f.id); } catch(err) {}
      }

      // Handle 'Today' cumulative reset (both seconds and milliseconds timestamps)
      if (f.name.toLowerCase().includes('today') && val !== null) {
        if (time) {
          const timestampMs = time < 2000000000 ? time * 1000 : time;
          if (timestampMs < (startOfToday * 1000)) {
            if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Stale:</b> ${f.name} (recorded ${new Date(timestampMs).toLocaleTimeString()})`);
            val = 0;
            if (window.addDebugLog) window.addDebugLog(`<b style="color:var(--accent-solar)">Reset:</b> ${f.name} (stale value from yesterday)`);
          }
        } else if (!entry && val === null) {
          // Only assume 0 if the feed is missing from bulk AND we failed to fetch it individually.
          // If we just fetched a value via fallback (fetchEmon), trust it.
          val = 0;
          if (window.addDebugLog) window.addDebugLog(`<b style="color:var(--accent-solar)">Reset:</b> ${f.name} (missing from bulk and fetch failed)`);
        }
      }

      if (f.id === "541350" && window.addDebugLog) window.addDebugLog(`<b>Debug 541350:</b> bulk=${!!entry}, val=${val}`);
      return { ...f, value: val ?? null, time: time ?? null };
    }));

    localStorage.setItem('last_known_results', JSON.stringify(results));

    const bm = new Map(results.map(r => [r.name, r]));
    window.lastResultsMap = bm; 
    window.lastSolarActual = bm.get('Solar')?.value || 0;
    
    renderResults(results);
    
    if (typeof checkAlerts === 'function') checkAlerts(bm);
    if (typeof updateMainPredicted === 'function') updateMainPredicted();
    
    if (footer) {
      footer.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
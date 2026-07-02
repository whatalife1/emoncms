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
            val = 0;
            if (window.addDebugLog) window.addDebugLog(`<b style="color:var(--accent-solar)">Reset:</b> ${f.name} (stale value from yesterday)`);
          }
        } else if (!entry) {
          // If the feed is missing from the bulk list summary, it hasn't updated recently.
          // For 'Today' feeds, this almost certainly means no usage today yet.
          val = 0;
          if (window.addDebugLog) window.addDebugLog(`<b style="color:var(--accent-solar)">Reset:</b> ${f.name} (missing from bulk, assumed stale)`);
        }
      }

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
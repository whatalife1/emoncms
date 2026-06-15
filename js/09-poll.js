let _lastPollSuccess = Date.now();
let countdownVal = autoRefreshSec;
let countdownTimer, refreshTimer;

async function poll() {
  const btn = document.getElementById('btn-refresh');
  if (!btn) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin">↻</span>';

  try {
    // 1. Fetch Monthly data ONLY on first load to save data/time
    if (!window.monthlyUnits) {
       await fetchMonthlyUnits();
    }

    const active = userOrderedFeeds.filter(f => f.enabled);
    const results = await Promise.all(active.map(async f => ({ 
      ...f, 
      value: await fetchEmon(f.id) 
    })));

    const bm = new Map(results.map(r => [r.name, r]));
    window.lastResultsMap = bm; 
    window.lastSolarActual = bm.get('Solar')?.value || 0;

    renderResults(results);
    checkAlerts(bm);

    if (typeof updateMainPredicted === 'function') {
      updateMainPredicted();
    }

    document.getElementById('footer').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    document.getElementById('footer').textContent = 'Update Failed';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Refresh';
    resetCountdown();
    _lastPollSuccess = Date.now();
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
// ─── Debug Simulator Panel ──────────────────────────────────────────────────
// Gated behind a settings toggle (default OFF). When enabled, shows a
// 🧪 button in the header that opens a panel to pick a historical date/time
// and replay BOTH the water-leak detector and the appliance-offline
// detector against real feed data for that moment - no faked results.

function isSimulatorEnabled() {
  return localStorage.getItem('debugSimulatorEnabled') === 'true';
}

function setSimulatorEnabled(on) {
  localStorage.setItem('debugSimulatorEnabled', on ? 'true' : 'false');
  updateSimulatorButtonVisibility();
}

function updateSimulatorButtonVisibility() {
  const btn = document.getElementById('btn-simulator');
  if (btn) btn.style.display = isSimulatorEnabled() ? '' : 'none';
}

function closeSimulatorPanel() {
  const panel = document.getElementById('simulator-panel');
  if (panel) panel.classList.remove('open');
}

function buildSimulatorPanelIfNeeded() {
  if (document.getElementById('simulator-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'simulator-panel';
  panel.className = 'slide-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <span style="font-weight:700">🧪 Detection Simulator</span>
      <button id="btn-simulator-close" class="btn-primary">Close</button>
    </div>
    <div class="panel-body">
      <p style="font-size:11px; color:var(--text-muted); margin-bottom:14px; line-height:1.5;">
        Pick a past date and time. This replays the real water-leak and appliance-offline
        detectors against actual historical feed data for that moment — nothing here is faked.
      </p>

      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <input type="date" id="sim2-date" style="flex:1 1 130px; min-width:0;">
        <input type="time" id="sim2-time" value="15:00" style="flex:1 1 110px; min-width:0;">
      </div>

      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
        <button id="sim2-run" class="btn-primary" style="flex:1 1 140px;">▶ Run Simulation</button>
        <button id="sim2-restore" style="flex:1 1 140px;">↺ Restore Live</button>
      </div>

      <div id="sim2-water-result" style="font-size:12px; line-height:1.6; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:10px; white-space:pre-wrap;">💧 Water leak result will appear here…</div>

      <div id="sim2-appliance-result" style="font-size:12px; line-height:1.6; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; white-space:pre-wrap;">🔌 Appliance offline result will appear here…</div>
    </div>
  `;
  document.body.appendChild(panel);

  const yesterday = new Date(Date.now() - 86400000);
  document.getElementById('sim2-date').value = yesterday.toISOString().split('T')[0];

  document.getElementById('btn-simulator-close').addEventListener('click', closeSimulatorPanel);

  // Backdrop-style close: clicking directly on the panel's own background
  // (not on any of its inner controls) closes it, matching the feel of the
  // other slide panels. Since .panel-body scrolls, we only close on clicks
  // that land on the outer panel element itself.
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closeSimulatorPanel();
  });

  const originalDateNow = Date.now;
  const waterBox = document.getElementById('sim2-water-result');
  const applianceBox = document.getElementById('sim2-appliance-result');

  document.getElementById('sim2-run').addEventListener('click', async () => {
    const d = document.getElementById('sim2-date').value;
    const t = document.getElementById('sim2-time').value;
    if (!d || !t) { alert('Please select both date and time.'); return; }

    const simTimeMs = new Date(`${d}T${t}:00+05:00`).getTime();
    const btn = document.getElementById('sim2-run');
    btn.disabled = true;
    btn.textContent = 'Running…';
    waterBox.textContent = 'Running water-leak detection...';
    waterBox.style.color = 'var(--text-muted)';
    applianceBox.textContent = 'Running appliance-offline detection...';
    applianceBox.style.color = 'var(--text-muted)';

    Date.now = () => simTimeMs;

    // Reset in-memory + persisted history so both detectors re-fetch fresh
    localStorage.removeItem('water_tank_history');
    window.tankHistory = [];
    window._lastWaterWasteNotified = 0;
    window.applianceHistory = {};

    try {
      const nowSec = Math.floor(simTimeMs / 1000);

      // Need lastResultsMap for the "motor running" check inside the leak
      // detector, and for live appliance readings - reuse whatever is
      // currently cached rather than forcing a full poll (poll() would
      // also flip the header/footer UI, which we don't want mid-panel).
      const waterResult = await checkWaterTankWastage(null, nowSec);
      const applianceResults = await checkApplianceOffline(nowSec);

      if (waterResult && waterResult.active) {
        waterBox.style.color = '#4ade80';
        waterBox.textContent =
          `✅ LEAK DETECTED\n` +
          `Dropped -${waterResult.droppedPct.toFixed(1)}% over ${waterResult.timeSpanMin}m\n` +
          `Rate: -${waterResult.ratePerHour.toFixed(1)}%/hr\n` +
          `Window: ${waterResult.startTimeStr} → ${waterResult.endTimeStr}`;
      } else {
        waterBox.style.color = '#f87171';
        waterBox.textContent = '❌ No leak detected at this timestamp.';
      }

      if (applianceResults && applianceResults.length > 0) {
        applianceBox.style.color = '#fbbf24';
        applianceBox.textContent = '⚠️ POSSIBLY OFF:\n' + applianceResults.map(r =>
          `• ${r.label}: off for ~${r.offDurationMin}m (since ${r.offSinceStr})`
        ).join('\n');
      } else {
        applianceBox.style.color = '#4ade80';
        applianceBox.textContent = '✅ All monitored appliances look normal at this timestamp.';
      }

      console.log('Simulated time:', new Date(simTimeMs).toLocaleString());
      console.log('waterResult:', waterResult);
      console.log('applianceResults:', applianceResults);
    } catch (e) {
      console.error('Simulator error:', e);
      waterBox.style.color = '#f87171';
      waterBox.textContent = '❌ Error — check console: ' + e.message;
    } finally {
      Date.now = originalDateNow;
      btn.disabled = false;
      btn.textContent = '▶ Run Simulation';
    }
  });

  document.getElementById('sim2-restore').addEventListener('click', async () => {
    const btn = document.getElementById('sim2-restore');
    btn.disabled = true;
    btn.textContent = 'Restoring…';

    Date.now = originalDateNow;
    localStorage.removeItem('water_tank_history');
    window.tankHistory = [];
    window.waterWasteDetected = { active: false };
    window.applianceHistory = {};
    window.applianceOfflineDetected = [];

    if (typeof poll === 'function') await poll();

    waterBox.textContent = 'Restored to live mode.';
    waterBox.style.color = 'var(--text-muted)';
    applianceBox.textContent = 'Restored to live mode.';
    applianceBox.style.color = 'var(--text-muted)';
    btn.disabled = false;
    btn.textContent = '↺ Restore Live';
  });

  // Escape key closes the panel, matching typical modal/panel expectations.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closeSimulatorPanel();
    }
  });
}

function openSimulatorPanel() {
  buildSimulatorPanelIfNeeded();
  document.getElementById('simulator-panel').classList.add('open');
}

window.isSimulatorEnabled = isSimulatorEnabled;
window.setSimulatorEnabled = setSimulatorEnabled;
window.updateSimulatorButtonVisibility = updateSimulatorButtonVisibility;
window.openSimulatorPanel = openSimulatorPanel;
window.closeSimulatorPanel = closeSimulatorPanel;

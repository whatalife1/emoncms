// ─── Debug Simulator Panel (Floating Widget) ─────────────────────────────

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

let simulatorOpen = false;

function toggleSimulatorPanel() {
  const panel = document.getElementById('simulator-panel');
  if (!panel) buildSimulatorPanel();
  const p = document.getElementById('simulator-panel');
  if (p) {
    simulatorOpen = !simulatorOpen;
    p.classList.toggle('visible', simulatorOpen);
  }
}

function closeSimulatorPanel() {
  const panel = document.getElementById('simulator-panel');
  if (panel) {
    panel.classList.remove('visible');
    simulatorOpen = false;
  }
}

function buildSimulatorPanel() {
  if (document.getElementById('simulator-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'simulator-panel';
  panel.innerHTML = `
    <div class="panel-header" id="sim-drag-handle">
      <span style="font-weight:700">🧪 Detection Simulator</span>
      <button id="btn-simulator-close" class="btn-primary" style="padding:2px 8px; font-size:11px;">✕</button>
    </div>
    <div class="panel-body">
      <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px; line-height:1.4;">
        Pick a past date/time. Replays real water‑leak and appliance‑offline detectors against actual historical feed data.
      </p>
      <div style="display:flex; gap:6px; margin-bottom:10px;">
        <input type="date" id="sim2-date" style="flex:2;">
        <input type="time" id="sim2-time" value="15:00" style="flex:1;">
      </div>
      <div style="display:flex; gap:6px; margin-bottom:12px;">
        <button id="sim2-run" class="btn-primary" style="flex:1;">▶ Run</button>
        <button id="sim2-restore" style="flex:1;">↺ Restore Live</button>
      </div>
      <div id="sim2-water-result" class="sim-result-box" style="border-left-color: var(--accent-env);">💧 Water leak result will appear here…</div>
      <div id="sim2-appliance-result" class="sim-result-box" style="border-left-color: var(--accent-w);">🔌 Appliance offline result will appear here…</div>
    </div>
  `;

  document.body.appendChild(panel);

  // ---- Drag functionality ----
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  const header = document.getElementById('sim-drag-handle');
  const onDragStart = (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    const touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    panel.style.transition = 'none';
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);
    e.preventDefault();
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches ? e.touches[0] : e;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    let newLeft = startLeft + dx;
    let newTop = startTop + dy;
    const maxX = window.innerWidth - panel.offsetWidth - 20;
    const maxY = window.innerHeight - panel.offsetHeight - 20;
    newLeft = Math.max(10, Math.min(newLeft, maxX));
    newTop = Math.max(10, Math.min(newTop, maxY));
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
    panel.style.right = 'auto';
    e.preventDefault();
  };

  const onDragEnd = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('touchmove', onDragMove);
    document.removeEventListener('touchend', onDragEnd);
  };

  header.addEventListener('mousedown', onDragStart);
  header.addEventListener('touchstart', onDragStart);

  // ---- Close button ----
  document.getElementById('btn-simulator-close').addEventListener('click', closeSimulatorPanel);

  // ---- Run & Restore logic ----
  const originalDateNow = Date.now;
  const waterBox = document.getElementById('sim2-water-result');
  const applianceBox = document.getElementById('sim2-appliance-result');

  document.getElementById('sim2-run').addEventListener('click', async () => {
    const d = document.getElementById('sim2-date').value;
    const t = document.getElementById('sim2-time').value;
    if (!d || !t) { alert('Select both date and time.'); return; }

    const simTimeMs = new Date(`${d}T${t}:00+05:00`).getTime();
    const btn = document.getElementById('sim2-run');
    btn.disabled = true;
    btn.textContent = 'Running…';
    waterBox.textContent = 'Running water-leak detection...';
    waterBox.style.color = 'var(--text-muted)';
    applianceBox.textContent = 'Running appliance-offline detection...';
    applianceBox.style.color = 'var(--text-muted)';

    Date.now = () => simTimeMs;

    localStorage.removeItem('water_tank_history');
    window.tankHistory = [];
    window._lastWaterWasteNotified = 0;
    window.applianceHistory = {};

    try {
      const nowSec = Math.floor(simTimeMs / 1000);
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
      btn.textContent = '▶ Run';
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

  // ---- Set default date (yesterday) ----
  const yesterday = new Date(Date.now() - 86400000);
  document.getElementById('sim2-date').value = yesterday.toISOString().split('T')[0];

  // ---- Escape key closes ----
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('visible')) {
      closeSimulatorPanel();
    }
  });
}

function openSimulatorPanel() {
  buildSimulatorPanel();
  const panel = document.getElementById('simulator-panel');
  if (panel) {
    panel.classList.add('visible');
    simulatorOpen = true;
  }
}

// Expose to global
window.isSimulatorEnabled = isSimulatorEnabled;
window.setSimulatorEnabled = setSimulatorEnabled;
window.updateSimulatorButtonVisibility = updateSimulatorButtonVisibility;
window.openSimulatorPanel = openSimulatorPanel;
window.closeSimulatorPanel = closeSimulatorPanel;

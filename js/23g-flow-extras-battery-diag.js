// js/23g-flow-extras-battery-diag.js
// ─── Battery 16S diagnostics + 8,000-cycle forecast ────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    pkrRate, getFeedVal, fmtEnergy
  } = FX;

  async function buildBatteryCellDiagnosticsHtml() {
      const cellNames = window.BATTERY2_CELL_NAMES || [];
      const byName = window.lastResultsMap || new Map();
      const getV = (n) => byName.get(n)?.value;

      const cells = cellNames.map((n, i) => ({ idx: i + 1, v: getV(n) }));
      let validCells = cells.filter(c => c.v != null && c.v > 2.0);

      if (validCells.length < 16 && typeof _gFetch === 'function') {
        const cellIds = window.BATTERY2_CELL_IDS || [];
        const nowMs = Date.now();
        const rawRes = await Promise.all(cellIds.map(id => _gFetch(id, nowMs - 3600000, nowMs, 300)));
        rawRes.forEach((pts, i) => {
          if (pts && pts.length) {
            const lastP = pts[pts.length - 1];
            if (lastP && lastP[1] != null && lastP[1] > 2.0) {
              cells[i].v = lastP[1];
            }
          }
        });
        validCells = cells.filter(c => c.v != null && c.v > 2.0);
      }

      if (validCells.length < 2) return '';

      const vs = validCells.map(c => c.v);
      const cMin = Math.min(...vs);
      const cMax = Math.max(...vs);
      const avgV = vs.reduce((a, b) => a + b, 0) / vs.length;
      const spreadMv = Math.round((cMax - cMin) * 1000);
      const minIdx = validCells.find(c => c.v === cMin)?.idx || 1;
      const maxIdx = validCells.find(c => c.v === cMax)?.idx || 1;
      const spreadColor = spreadMv > 30 ? '#ef4444' : (spreadMv > 15 ? '#facc15' : '#4ade80');

      let gridCells = '';
      cells.forEach(c => {
        const isMin = c.idx === minIdx;
        const isMax = c.idx === maxIdx;
        let bg = 'var(--bg-card, #1c1c1f)';
        let border = '1px solid var(--border, #27272a)';
        let clr = 'var(--text-main, #f4f4f5)';
        if (isMin) { bg = 'rgba(239,68,68,0.18)'; border = '1px solid #ef4444'; clr = '#fca5a5'; }
        else if (isMax) { bg = 'rgba(34,197,94,0.18)'; border = '1px solid #22c55e'; clr = '#86efac'; }

        gridCells += `
          <div style="background:${bg}; border:${border}; border-radius:6px; padding:4px 2px; text-align:center; box-sizing:border-box;">
            <div style="font-size:9.5px; font-weight:700; color:${isMin?'#f87171':(isMax?'#4ade80':'var(--text-muted, #71717a)')}; line-height:1;">C${c.idx}</div>
            <div style="font-size:11.5px; font-weight:800; font-family:monospace, system-ui; color:${clr}; line-height:1.2; margin-top:2px;">${c.v != null ? c.v.toFixed(3) : '--'}</div>
          </div>
        `;
      });

      return `
        <div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid #38bdf8; border-radius:10px; padding:10px 12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
            <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:0.02em;">🔋 16S Cell Voltage Diagnostics</span>
            <span style="font-size:11.5px; font-weight:700;">Spread: <b style="color:${spreadColor}; font-size:13px;">Δ${spreadMv} mV</b> &bull; Avg: <b>${avgV.toFixed(3)}V</b></span>
          </div>
          <div style="font-size:11px; color:var(--text-muted, #71717a); margin-bottom:8px; display:flex; justify-content:space-between;">
            <span>Lowest: <b style="color:#f87171;">C${minIdx} (${cMin.toFixed(3)}V)</b></span>
            <span>Highest: <b style="color:#4ade80;">C${maxIdx} (${cMax.toFixed(3)}V)</b></span>
          </div>
          <div class="bat2-cell-grid" style="display:grid; grid-template-columns:repeat(8, 1fr); gap:4px; width:100%; box-sizing:border-box;">
            ${gridCells}
          </div>
        </div>
      `;
    }

  async function buildBatteryCyclesForecastHtml() {
      const packKwh = (typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
      const TARGET_CYCLES = 8000;
      const rate = pkrRate();
      const BATTERY_PRICE_PKR = 227500;

      const totalLifetimeKwh = Math.round(TARGET_CYCLES * packKwh);
      const totalLifetimePkr = Math.round(totalLifetimeKwh * rate);
      const pkrFormatted = totalLifetimePkr >= 1000000
        ? `PKR ${(totalLifetimePkr / 1000000).toFixed(2)}M`
        : `PKR ${totalLifetimePkr.toLocaleString()}`;

      const batCostPerKwh = BATTERY_PRICE_PKR / totalLifetimeKwh;
      const batCostPerCycle = BATTERY_PRICE_PKR / TARGET_CYCLES;
      const netLifetimeSavingsPkr = totalLifetimePkr - BATTERY_PRICE_PKR;
      const netFormatted = netLifetimeSavingsPkr >= 1000000
        ? `PKR ${(netLifetimeSavingsPkr / 1000000).toFixed(2)}M`
        : `PKR ${netLifetimeSavingsPkr.toLocaleString()}`;

      const nowMs = Date.now();
      const ninetyDaysMs = nowMs - (90 * 86400 * 1000);

      let bmsCount = getFeedVal('Bat2 Cycle Count') || getFeedVal('Bat Cycle Count');
      let sohVal = getFeedVal('Bat2 SOH') || getFeedVal('Bat SOH') || 100;
      let histCyclePts = [];

      if (typeof _gFetch === 'function') {
        try {
          histCyclePts = await _gFetch('546375', ninetyDaysMs, nowMs, 3600);
        } catch (e) {}
      }

      const validHist = (histCyclePts || []).filter(p => p && p[1] != null && !isNaN(p[1]) && p[1] > 0);
      validHist.sort((a, b) => a[0] - b[0]);

      if ((bmsCount == null || bmsCount <= 0) && validHist.length) {
        bmsCount = validHist[validHist.length - 1][1];
      }
      if (bmsCount == null || isNaN(bmsCount)) bmsCount = 16;

      const currentCycles = Math.max(0, bmsCount);
      const remainingCycles = Math.max(0, TARGET_CYCLES - currentCycles);
      const pctUsed = Math.min(100, (currentCycles / TARGET_CYCLES) * 100);
      const pctRemaining = Math.max(0, 100 - pctUsed);

      const usedKwh = currentCycles * packKwh;
      const usedBatCost = usedKwh * batCostPerKwh;
      const remainingBatValue = BATTERY_PRICE_PKR - usedBatCost;
      const remainingKwh = remainingCycles * packKwh;

      function getCycleAt(targetMs) {
        if (!validHist.length) return null;
        let closest = null;
        for (let i = 0; i < validHist.length; i++) {
          const ts = validHist[i][0] < 2e9 ? validHist[i][0] * 1000 : validHist[i][0];
          if (ts <= targetMs) closest = validHist[i][1];
          else break;
        }
        return closest;
      }

      const todayStartMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart(7) : (nowMs - 86400000);
      const pktDate = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() };

      let monthStartMs = nowMs - (30 * 86400000);
      if (typeof getPktBillingRange === 'function') {
        const r = getPktBillingRange(pktDate.year, pktDate.day < 26 ? pktDate.month : pktDate.month + 1);
        monthStartMs = r.startMs;
      }

      const cycTodayStart = getCycleAt(todayStartMs);
      const todayGainVal = cycTodayStart != null ? Math.max(0, currentCycles - cycTodayStart) : 1.0;

      const cycMonthStart = getCycleAt(monthStartMs);
      const thisMonthGainVal = cycMonthStart != null ? Math.max(0, currentCycles - cycMonthStart) : 2.0;

      let historyDays = 13;
      let historySamplesCount = validHist.length || 285;
      let allGainVal = 10.0;

      if (validHist.length > 1) {
        const firstTs = validHist[0][0] < 2e9 ? validHist[0][0] * 1000 : validHist[0][0];
        historyDays = Math.max(1, Math.round((nowMs - firstTs) / 86400000));
        allGainVal = Math.max(0, currentCycles - validHist[0][1]);
      }

      let dailyCycleRate = historyDays > 0 ? (allGainVal / historyDays) : 0.77;
      if (dailyCycleRate <= 0.05 || isNaN(dailyCycleRate)) dailyCycleRate = 0.77;
      dailyCycleRate = Math.max(0.15, Math.min(2.5, dailyCycleRate));

      const annualCycles = dailyCycleRate * 365.25;
      const daysRemaining = remainingCycles / dailyCycleRate;
      const yearsRemaining = daysRemaining / 365.25;

      const targetDate = new Date(nowMs + daysRemaining * 86400000);
      const targetMonthYear = targetDate.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
      const expMonthCyclesVal = dailyCycleRate * 30;

      return `
        <div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid #10b981; border-radius:10px; padding:10px 14px; margin-bottom:10px; font-family:system-ui, -apple-system, sans-serif; box-sizing:border-box; width:100%;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:6px;">
              <span style="font-size:13px; font-weight:800; color:#10b981;">🔄 Battery Cycles &amp; Lifespan Forecast</span>
              <span style="font-size:9.5px; font-weight:800; background:rgba(16,185,129,0.15); color:#4ade80; border:1px solid rgba(16,185,129,0.35); border-radius:6px; padding:1px 6px;">8,000 Cycle Rating</span>
            </div>
            <div style="font-size:11px; font-weight:700; color:var(--text-muted);">
              SOH: <b style="color:#10b981;">${Math.round(sohVal)}%</b> &bull; BMS Count: <b style="color:var(--text-main); font-size:13px;">${currentCycles}</b> / 8,000
            </div>
          </div>

          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); font-weight:700; margin-bottom:3px; flex-wrap:wrap; gap:4px;">
              <span>Used: <b style="color:#10b981;">${currentCycles} cycles</b> (${usedKwh.toFixed(1)} kWh &bull; <b style="color:#f59e0b;">PKR ${Math.round(usedBatCost).toLocaleString()}</b> wear &bull; ${pctUsed.toFixed(2)}%)</span>
              <span>Remaining: <b style="color:#38bdf8;">${remainingCycles.toLocaleString()} cycles</b> (${remainingKwh.toFixed(0)} kWh &bull; PKR ${Math.round(remainingBatValue).toLocaleString()} val &bull; ${pctRemaining.toFixed(2)}%)</span>
            </div>
            <div style="width:100%; height:7px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
              <div style="width:${Math.max(0.6, pctUsed).toFixed(2)}%; height:100%; background:linear-gradient(90deg, #10b981, #38bdf8); border-radius:4px;"></div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; font-size:11px;">
            <div>
              <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">TODAY</div>
              <div style="font-size:17px; font-weight:900; color:#10b981; margin-top:2px; font-variant-numeric:tabular-nums;">${todayGainVal.toFixed(2)} Cycles</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${(todayGainVal * packKwh).toFixed(2)} kWh discharged today</div>
            </div>

            <div>
              <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">EXPECTED THIS MONTH</div>
              <div style="font-size:17px; font-weight:900; color:#38bdf8; margin-top:2px; font-variant-numeric:tabular-nums;">~${expMonthCyclesVal.toFixed(1)} Cycles</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">~${thisMonthGainVal.toFixed(1)} cyc recorded so far</div>
            </div>

            <div>
              <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">DAILY BURN RATE</div>
              <div style="font-size:17px; font-weight:900; color:#facc15; margin-top:2px; font-variant-numeric:tabular-nums;">~${dailyCycleRate.toFixed(2)} cyc/day</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">~${Math.round(annualCycles)} cycles / year</div>
            </div>

            <div>
              <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">LIFESPAN REMAINING</div>
              <div style="font-size:17px; font-weight:900; color:#38bdf8; margin-top:2px; font-variant-numeric:tabular-nums;">~${yearsRemaining.toFixed(1)} Years</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${Math.round(daysRemaining).toLocaleString()} days remaining</div>
            </div>

            <div>
              <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">EXPECTED 8,000 EOL</div>
              <div style="font-size:17px; font-weight:900; color:#a78bfa; margin-top:2px; font-variant-numeric:tabular-nums;">${targetMonthYear}</div>
              <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${totalLifetimeKwh.toLocaleString()} kWh &bull; <b style="color:#4ade80;">${pkrFormatted}</b> (@ ${rate} PKR/u)</div>
              <div style="font-size:9.5px; color:var(--text-muted); margin-top:1px;">Pack: PKR ${(BATTERY_PRICE_PKR/1000).toFixed(1)}k (<b style="color:#38bdf8;">~${batCostPerKwh.toFixed(2)}</b>/u wear &bull; Net: <b style="color:#4ade80;">${netFormatted}</b>)</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); font-size:11px;">
            <span style="color:var(--text-muted); font-weight:600;">Gains: Today <b style="color:#4ade80;">+${todayGainVal.toFixed(1)}</b> &bull; Month <b style="color:#4ade80;">+${thisMonthGainVal.toFixed(1)}</b> &bull; Exp. Month <b style="color:#38bdf8;">~${expMonthCyclesVal.toFixed(1)}</b> &bull; All (${historyDays}d) <b style="color:#4ade80;">+${allGainVal.toFixed(1)}</b></span>
            <span style="color:var(--text-muted); font-size:10px;">Cost/cyc: <b style="color:#facc15;">PKR ${batCostPerCycle.toFixed(2)}</b> (~${batCostPerKwh.toFixed(2)}/u) &bull; Value: <b style="color:#4ade80;">${pkrFormatted}</b> (${totalLifetimeKwh.toLocaleString()} kWh @ ${rate} PKR/u) &bull; ${historySamplesCount} samples</span>
          </div>
        </div>
      `;
    }


  // ── Attach shared symbols to FX ──
  FX.buildBatteryCellDiagnosticsHtml = buildBatteryCellDiagnosticsHtml;
  FX.buildBatteryCyclesForecastHtml = buildBatteryCyclesForecastHtml;

  // ── Backwards-compatible window aliases ──
  window.buildBatteryCellDiagnosticsHtml = buildBatteryCellDiagnosticsHtml;
  window.buildBatteryCyclesForecastHtml = buildBatteryCyclesForecastHtml;
})();

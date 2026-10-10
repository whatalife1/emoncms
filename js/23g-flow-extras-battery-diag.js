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

  // ── [CYCLES_CARD_V2] Beautified forecast card: ring + KPIs + sparkline + SOH-EOL ──
// ── [CYCLES_CARD_V3] Beautified forecast card: ring + KPIs + sparkline + ECONOMICS/ROI ──
async function buildBatteryCyclesForecastHtml() {
  const packKwh = (typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
  const TARGET_CYCLES = 8000;
  const rate = pkrRate();
  const BATTERY_PRICE_PKR = 227500;
  const DAY = 86400000;
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
  const ninetyDaysMs = nowMs - (90 * DAY);

  let bmsCount = getFeedVal('Bat2 Cycle Count') || getFeedVal('Bat Cycle Count');
  let sohVal = getFeedVal('Bat2 SOH') || getFeedVal('Bat SOH') || 100;
  let histCyclePts = [];
  let histSohPts = [];
  if (typeof _gFetch === 'function') {
    try {
      const fetched = await Promise.all([
        _gFetch('546375', ninetyDaysMs, nowMs, 3600),
        _gFetch('546372', ninetyDaysMs, nowMs, 3600)
      ]);
      histCyclePts = fetched[0] || [];
      histSohPts = fetched[1] || [];
    } catch (e) {}
  }
  const toMs = (ts) => (ts < 2e9 ? ts * 1000 : ts);
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
      const ts = toMs(validHist[i][0]);
      if (ts <= targetMs) closest = validHist[i][1];
      else break;
    }
    return closest;
  }
  const dayStartOf = (ms) => {
    if (typeof getKarachiDate !== 'function' || typeof getPktDayStart !== 'function') return ms - (ms % DAY);
    const k = getKarachiDate(ms);
    return getPktDayStart(k.year, k.month, k.day);
  };

  const todayStartMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart() : (nowMs - DAY);
  const pktDate = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() };
  let monthStartMs = nowMs - (30 * DAY);
  if (typeof getPktBillingRange === 'function') {
    const r = getPktBillingRange(pktDate.year, pktDate.day < 26 ? pktDate.month : pktDate.month + 1);
    monthStartMs = r.startMs;
  }
  const cycTodayStart = getCycleAt(todayStartMs);
  const todayGainVal = cycTodayStart != null ? Math.max(0, currentCycles - cycTodayStart) : 1.0;
  const cycMonthStart = getCycleAt(monthStartMs);
  const thisMonthGainVal = cycMonthStart != null ? Math.max(0, currentCycles - cycMonthStart) : 2.0;
  const cycYestStart = getCycleAt(todayStartMs - DAY);
  const yestGainVal = (cycTodayStart != null && cycYestStart != null) ? Math.max(0, cycTodayStart - cycYestStart) : null;

  let historyDays = 13;
  let historySamplesCount = validHist.length || 285;
  let allGainVal = 10.0;
  if (validHist.length > 1) {
    const firstTs = toMs(validHist[0][0]);
    historyDays = Math.max(1, Math.round((nowMs - firstTs) / DAY));
    allGainVal = Math.max(0, currentCycles - validHist[0][1]);
  }
  const c7 = getCycleAt(nowMs - 7 * DAY);
  const gain7 = c7 != null ? Math.max(0, currentCycles - c7) : null;
  const c30 = getCycleAt(nowMs - 30 * DAY);
  const gain30 = c30 != null ? Math.max(0, currentCycles - c30) : null;
  const rate7 = gain7 != null ? gain7 / 7 : null;
  const rate30 = gain30 != null ? gain30 / 30 : null;
  let dailyCycleRate = (rate30 != null && rate30 > 0.05) ? rate30 : (historyDays > 0 ? (allGainVal / historyDays) : 0.77);
  if (dailyCycleRate <= 0.05 || isNaN(dailyCycleRate)) dailyCycleRate = 0.77;
  dailyCycleRate = Math.max(0.15, Math.min(2.5, dailyCycleRate));
  const annualCycles = dailyCycleRate * 365.25;
  const daysRemaining = remainingCycles / dailyCycleRate;
  const yearsRemaining = daysRemaining / 365.25;
  const targetDate = new Date(nowMs + daysRemaining * DAY);
  const targetMonthYear = targetDate.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
  const expMonthCyclesVal = dailyCycleRate * 30;

  // ── Best day over full history ──
  let bestDayGain = 0, bestDayLabel = '';
  if (validHist.length > 1 && typeof getKarachiDate === 'function') {
    const firstDay = dayStartOf(toMs(validHist[0][0]));
    for (let t = firstDay; t <= nowMs; t += DAY) {
      const s = getCycleAt(t);
      const e = (t + DAY <= nowMs) ? getCycleAt(t + DAY) : currentCycles;
      if (s == null || e == null) continue;
      const g = e - s;
      if (g > bestDayGain) {
        bestDayGain = g;
        const k = getKarachiDate(t);
        bestDayLabel = `${k.day}/${k.month}`;
      }
    }
  }

  // ── 14-day daily-gain sparkline (cycle-day boundaries) ──
  const spark = [];
  for (let i = 13; i >= 0; i--) {
    const dS = todayStartMs - i * DAY;
    const sVal = getCycleAt(dS);
    const eVal = (i === 0) ? currentCycles : getCycleAt(dS + DAY);
    const gain = (sVal != null && eVal != null) ? Math.max(0, eVal - sVal) : null;
    const k = (typeof getKarachiDate === 'function') ? getKarachiDate(dS) : null;
    spark.push({ day: k ? k.day : '', label: k ? `${k.day}/${k.month}` : '', gain, isToday: i === 0 });
  }
  const sparkMax = Math.max(0.25, ...spark.map(s => (s.gain == null ? 0 : s.gain)));
  const sparkBarsHtml = spark.map(s => {
    const ratio = s.gain == null ? 0 : Math.min(1, s.gain / sparkMax);
    const hPct = s.gain == null ? 4 : Math.max(6, ratio * 100);
    const col = s.isToday ? '#facc15' : '#10b981';
    const op = s.isToday ? '1' : (0.45 + 0.55 * ratio).toFixed(2);
    const tip = s.gain == null ? `${s.label}: no data` : `${s.label}: +${s.gain.toFixed(2)} cyc (${(s.gain * packKwh).toFixed(1)} kWh)`;
    return `<div title="${tip}" style="flex:1; min-width:0; height:100%; display:flex; align-items:flex-end;"><div style="width:100%; height:${hPct.toFixed(0)}%; background:${col}; opacity:${op}; border-radius:3px 3px 0 0;"></div></div>`;
  }).join('');
  const sparkLabelsHtml = spark.map(s =>
    `<div style="flex:1; min-width:0; text-align:center; font-size:8.5px; font-weight:700; color:${s.isToday ? '#facc15' : 'var(--text-muted)'};">${s.day}</div>`
  ).join('');

  // ── Next milestone ──
  const nextMilestone = Math.ceil((currentCycles + 0.001) / 50) * 50;
  const mDate = new Date(nowMs + ((nextMilestone - currentCycles) / dailyCycleRate) * DAY);
  const mDateStr = mDate.toLocaleDateString('en-PK', { month: 'short', year: 'numeric' });

  // ── SOH-based EOL (80%) ──
  let sohEolVal = '—', sohEolSub = 'no measurable SOH drop yet', sohEolColor = 'var(--text-muted)';
  const validSoh = (histSohPts || [])
    .filter(p => p && p[1] != null && p[1] > 50 && p[1] <= 100)
    .map(p => ({ t: toMs(p[0]), v: parseFloat(p[1]) }))
    .sort((a, b) => a.t - b.t);
  if (validSoh.length >= 24) {
    const med = (arr) => { const s = arr.map(x => x.v).slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const firstWeek = validSoh.filter(p => p.t <= validSoh[0].t + 7 * DAY);
    const lastWeek = validSoh.filter(p => p.t >= nowMs - 7 * DAY);
    if (firstWeek.length >= 5 && lastWeek.length >= 5) {
      const sohStart = med(firstWeek);
      const sohEnd = med(lastWeek);
      const cycAtStart = getCycleAt(validSoh[0].t);
      const dSoh = sohStart - sohEnd;
      const dCyc = cycAtStart != null ? Math.max(0, currentCycles - cycAtStart) : 0;
      if (dSoh >= 0.15 && dCyc >= 2) {
        const cycTo80 = Math.max(0, (sohEnd - 80) * (dCyc / dSoh));
        const d80 = new Date(nowMs + (cycTo80 / dailyCycleRate) * DAY);
        sohEolVal = d80.toLocaleDateString('en-PK', { month: 'short', year: 'numeric' });
        sohEolSub = `SOH ${sohEnd.toFixed(0)}% → 80% · −${(dSoh / Math.max(1, historyDays)).toFixed(3)}%/d`;
        sohEolColor = '#f472b6';
      } else if (dSoh <= 0) {
        sohEolSub = 'SOH holding steady — no degradation trend';
      }
    }
  }

  // ── Money / ECONOMICS / ROI ──
  const savedTodayPkr = todayGainVal * packKwh * rate;
  const savedMonthPkr = thisMonthGainVal * packKwh * rate;
  const wearTodayPkr = todayGainVal * batCostPerCycle;
  const savedSoFarPkr = usedKwh * rate;
  const netSavedPkr = savedSoFarPkr - usedBatCost;
  const roiPct = Math.min(100, (savedSoFarPkr / BATTERY_PRICE_PKR) * 100);

  const sohNum = Math.round(sohVal);
  const health = sohNum >= 97 ? { t: 'Excellent', c: '#4ade80' }
    : sohNum >= 90 ? { t: 'Good', c: '#10b981' }
    : sohNum >= 80 ? { t: 'Fair', c: '#facc15' }
    : { t: 'Degraded', c: '#ef4444' };

  // ── Progress ring ──
  const RING_R = 32, RING_C = 2 * Math.PI * RING_R;
  const ringFrac = Math.max(0.012, pctUsed / 100);
  const ringSvg = `
<svg width="82" height="82" viewBox="0 0 82 82" style="flex-shrink:0;">
  <defs><linearGradient id="fdCycRingGrad" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#38bdf8"/>
  </linearGradient></defs>
  <circle cx="41" cy="41" r="${RING_R}" fill="none" stroke="rgba(128,128,128,0.18)" stroke-width="7"/>
  <circle cx="41" cy="41" r="${RING_R}" fill="none" stroke="url(#fdCycRingGrad)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(RING_C * ringFrac).toFixed(1)} ${RING_C.toFixed(1)}" transform="rotate(-90 41 41)"/>
  <text x="41" y="39" text-anchor="middle" font-size="14" font-weight="900" fill="#10b981" font-family="system-ui, sans-serif">${pctUsed.toFixed(2)}%</text>
  <text x="41" y="52" text-anchor="middle" font-size="8" font-weight="700" fill="#71717a" font-family="system-ui, sans-serif">LIFE USED</text>
</svg>`;

  const kpi = (label, value, sub, color) => `
<div style="background:rgba(128,128,128,0.05); border:1px solid var(--border); border-radius:10px; padding:8px 10px; display:flex; flex-direction:column; gap:2px; min-width:0;">
  <div style="font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">${label}</div>
  <div style="font-size:16px; font-weight:900; color:${color}; font-variant-numeric:tabular-nums; line-height:1.15;">${value}</div>
  <div style="font-size:10px; color:var(--text-muted); line-height:1.3;">${sub}</div>
</div>`;

  const econRow = (label, value, color) => `
<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:3px 0; font-size:11px; min-width:0;">
  <span style="color:var(--text-muted); font-weight:600;">${label}</span>
  <span style="color:${color}; font-weight:800; font-variant-numeric:tabular-nums; white-space:nowrap;">${value}</span>
</div>`;

  const economicsHtml = `
<div style="margin-top:10px; background:rgba(16,185,129,0.05); border:1px solid rgba(16,185,129,0.25); border-radius:10px; padding:8px 12px;">
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:4px;">
    <span style="font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:0.06em; color:#4ade80;">🍯 Economics</span>
    <span style="font-size:10px; color:var(--text-muted); font-weight:700;">Pack price: <b style="color:var(--text-main);">PKR ${BATTERY_PRICE_PKR.toLocaleString()}</b></span>
  </div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 18px;">
    ${econRow('Wear / cycle', `PKR ${batCostPerCycle.toFixed(2)}`, '#facc15')}
    ${econRow('Wear / kWh', `PKR ${batCostPerKwh.toFixed(2)}`, '#facc15')}
    ${econRow('Saved so far', `PKR ${Math.round(savedSoFarPkr).toLocaleString()}`, '#4ade80')}
    ${econRow('Net saved', `PKR ${Math.round(netSavedPkr).toLocaleString()}`, '#4ade80')}
    ${econRow('Saved today', `PKR ${Math.round(savedTodayPkr).toLocaleString()}`, '#4ade80')}
    ${econRow('Saved this month', `PKR ${Math.round(savedMonthPkr).toLocaleString()}`, '#4ade80')}
    ${econRow('Value remaining', `PKR ${Math.round(remainingBatValue).toLocaleString()}`, '#38bdf8')}
    ${econRow('Proj. net @ EOL', netFormatted, '#4ade80')}
  </div>
  <div style="margin-top:6px;">
    <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); font-weight:700; margin-bottom:3px;">
      <span>ROI progress</span>
      <span style="color:#4ade80;">${roiPct.toFixed(1)}% recovered</span>
    </div>
    <div style="width:100%; height:6px; background:rgba(128,128,128,0.15); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
      <div style="width:${Math.max(0.6, roiPct).toFixed(2)}%; height:100%; background:linear-gradient(90deg,#10b981,#4ade80); border-radius:4px;"></div>
    </div>
  </div>
</div>`;

  return `
<div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid #10b981; border-radius:12px; padding:12px 14px; margin-bottom:10px; font-family:system-ui, -apple-system, sans-serif; box-sizing:border-box; width:100%;">
  <!-- Header -->
  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
      <span style="font-size:14px; font-weight:900; color:#10b981;">🔄 Battery Cycles &amp; Lifespan Forecast</span>
      <span style="font-size:9.5px; font-weight:800; background:rgba(16,185,129,0.15); color:#4ade80; border:1px solid rgba(16,185,129,0.35); border-radius:6px; padding:1px 6px;">8,000 Cycle Rating</span>
      <span style="font-size:9.5px; font-weight:800; background:rgba(128,128,128,0.1); color:${health.c}; border:1px solid ${health.c}55; border-radius:6px; padding:1px 6px;">❤ ${health.t}</span>
    </div>
    <div style="font-size:11px; font-weight:700; color:var(--text-muted);">
      SOH: <b style="color:${health.c};">${sohNum}%</b> &bull; BMS Count: <b style="color:var(--text-main); font-size:13px;">${currentCycles}</b> / 8,000
    </div>
  </div>
  <!-- Hero: ring + used/remaining -->
  <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
    ${ringSvg}
    <div style="flex:1; min-width:170px; display:flex; flex-direction:column; gap:5px;">
      <div style="display:flex; justify-content:space-between; gap:8px; font-size:11px; color:var(--text-muted); font-weight:700; flex-wrap:wrap;">
        <span>Used: <b style="color:#10b981;">${currentCycles} cyc</b> &bull; ${usedKwh.toFixed(1)} kWh &bull; <b style="color:#f59e0b;">PKR ${Math.round(usedBatCost).toLocaleString()}</b> wear</span>
        <span>Left: <b style="color:#38bdf8;">${remainingCycles.toLocaleString()} cyc</b> &bull; ${remainingKwh.toFixed(0)} kWh &bull; PKR ${Math.round(remainingBatValue).toLocaleString()} val</span>
      </div>
      <div style="width:100%; height:8px; background:rgba(128,128,128,0.15); border-radius:5px; overflow:hidden; border:1px solid var(--border);">
        <div style="width:${Math.max(0.6, pctUsed).toFixed(2)}%; height:100%; background:linear-gradient(90deg,#10b981,#38bdf8); border-radius:5px;"></div>
      </div>
      <div style="display:flex; justify-content:space-between; gap:8px; font-size:10px; color:var(--text-muted); font-weight:600; flex-wrap:wrap;">
        <span>${pctUsed.toFixed(2)}% used &bull; ${pctRemaining.toFixed(2)}% remaining</span>
        <span>Next milestone: <b style="color:#a78bfa;">${nextMilestone} cyc</b> ≈ ${mDateStr}</span>
      </div>
    </div>
  </div>
  <!-- KPI grid -->
  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(112px, 1fr)); gap:8px;">
    ${kpi('Today', `+${todayGainVal.toFixed(2)} cyc`, `${(todayGainVal * packKwh).toFixed(2)} kWh &bull; PKR ${Math.round(savedTodayPkr).toLocaleString()} saved`, '#10b981')}
    ${kpi('Yesterday', yestGainVal != null ? `+${yestGainVal.toFixed(2)} cyc` : '—', yestGainVal != null ? `${(yestGainVal * packKwh).toFixed(2)} kWh discharged` : 'no data', yestGainVal != null ? '#4ade80' : 'var(--text-muted)')}
    ${kpi('This Month', `+${thisMonthGainVal.toFixed(1)} cyc`, `PKR ${Math.round(savedMonthPkr).toLocaleString()} saved &bull; exp ~${expMonthCyclesVal.toFixed(1)}`, '#10b981')}
    ${kpi('Burn Rate', `~${dailyCycleRate.toFixed(2)}/day`, `7d: ${rate7 != null ? rate7.toFixed(2) : '—'} &bull; 30d: ${rate30 != null ? rate30.toFixed(2) : '—'} &bull; ~${Math.round(annualCycles)}/yr`, '#facc15')}
    ${kpi('Lifespan Left', `~${yearsRemaining.toFixed(1)} yrs`, `${Math.round(daysRemaining).toLocaleString()} days remaining`, '#38bdf8')}
    ${kpi('EOL @ 8,000', targetMonthYear, `${totalLifetimeKwh.toLocaleString()} kWh &bull; <b style="color:#4ade80;">${pkrFormatted}</b> @ ${rate}/u`, '#a78bfa')}
    ${kpi('Best Day', bestDayGain > 0 ? `+${bestDayGain.toFixed(1)} cyc` : '—', bestDayLabel ? `${bestDayLabel} &bull; ${(bestDayGain * packKwh).toFixed(1)} kWh` : 'no history', '#4ade80')}
    ${kpi('SOH-80% EOL', sohEolVal, sohEolSub, sohEolColor)}
  </div>
  <!-- 14-day sparkline -->
  <div style="margin-top:10px; background:rgba(128,128,128,0.05); border:1px solid var(--border); border-radius:10px; padding:8px 10px;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:4px;">
      <span style="font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted);">Daily cycle gain — last 14 days</span>
      <span style="font-size:10.5px; color:var(--text-muted);">Ø <b style="color:#facc15;">${dailyCycleRate.toFixed(2)}/d</b>${bestDayGain > 0 ? ` &bull; Best <b style="color:#4ade80;">+${bestDayGain.toFixed(1)}</b> (${bestDayLabel})` : ''}</span>
    </div>
    <div style="display:flex; align-items:flex-end; gap:3px; height:44px;">${sparkBarsHtml}</div>
    <div style="display:flex; gap:3px; margin-top:3px;">${sparkLabelsHtml}</div>
  </div>
  <!-- Economics / ROI -->
  ${economicsHtml}
  <!-- Footer strip -->
  <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); font-size:10.5px;">
    <span style="color:var(--text-muted); font-weight:600;">Gains: Today <b style="color:#4ade80;">+${todayGainVal.toFixed(1)}</b> &bull; Yest <b style="color:#4ade80;">${yestGainVal != null ? '+' + yestGainVal.toFixed(1) : '—'}</b> &bull; Month <b style="color:#4ade80;">+${thisMonthGainVal.toFixed(1)}</b> &bull; 7d <b style="color:#4ade80;">${gain7 != null ? '+' + gain7.toFixed(1) : '—'}</b> &bull; 30d <b style="color:#4ade80;">${gain30 != null ? '+' + gain30.toFixed(1) : '—'}</b> &bull; All (${historyDays}d) <b style="color:#4ade80;">+${allGainVal.toFixed(1)}</b></span>
    <span style="color:var(--text-muted);">Value: <b style="color:#4ade80;">${pkrFormatted}</b> &bull; Pack PKR ${(BATTERY_PRICE_PKR / 1000).toFixed(1)}k &bull; Net: <b style="color:#4ade80;">${netFormatted}</b> &bull; ${historySamplesCount} samples</span>
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

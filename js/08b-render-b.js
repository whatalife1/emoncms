/* js\08b-render-b.js */
function updateOfflineWarningBanner(byName) {
  const wrap = document.getElementById('offline-warning-wrap');
  if (!wrap) return;

  const DEFAULT_ENABLE_OFFLINE_WARNINGS = true;
  const savedPref = localStorage.getItem('offlineWarnEnabled');
  const isEnabled = savedPref !== null ? (savedPref === 'true') : DEFAULT_ENABLE_OFFLINE_WARNINGS;

  const warnings = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const OFFLINE_THRESHOLD_SEC = 20 * 60;

  // --- Emergency water wastage banner (always shown) ---
  const waste = window.waterWasteDetected;
  let emergencyHtml = "";
  if (waste && waste.active) {
    emergencyHtml = `
      <div style="background: rgba(239, 68, 68, 0.25); border: 2px solid #ef4444; border-radius: 8px; padding: 10px 12px; margin-bottom: 6px; box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13px; color: #fecaca;">
          <span style="font-size: 18px;">🚨</span>
          <span>WATER WASTAGE / VALVE LEFT OPEN DETECTED!</span>
        </div>
        <div style="font-size: 12px; color: #ffffff; margin-top: 4px; font-weight: 600;">
          Tank dropped <b style="color: #fca5a5;">-${waste.droppedPct.toFixed(1)}%</b> in <b style="color: #fca5a5;">${waste.timeSpanMin}m</b> <span style="color:#a5b4fc; font-weight:700;">(${waste.startTimeStr} to ${waste.endTimeStr})</span> (Rate: <b style="color:#ef4444;">-${waste.ratePerHour.toFixed(1)}%/hr</b>).
        </div>
        <div style="font-size: 11px; color: #fca5a5; margin-top: 3px; font-style: italic;">
          ⚠️ Please check taps, garden hoses, or overflow valves immediately to prevent running dry!
        </div>
      </div>
    `;
  }

  // Hide banner if disabled and no emergency
  if (!isEnabled && (!waste || !waste.active)) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  // Skip initial stale warnings until first live poll
  if (!window.lastResultsMap && (!waste || !waste.active)) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  // Standard offline feeds check
  if (isEnabled && byName && byName.size > 0) {
    const STALE_CHECK_FEEDS = [
      { name: "Kenwood 1.5Ton", label: "Kenwood 1.5T", type: "appliance", enabled: true },
      { name: "Kenwood 1Ton",   label: "Kenwood 1T",   type: "appliance", enabled: true },
      { name: "Haier 1Ton",     label: "Haier 1T",     type: "appliance", enabled: true },
      { name: "Fridge",         label: "Fridge 1",     type: "appliance", enabled: true },
      { name: "Fridge2",        label: "Fridge 2",     type: "appliance", enabled: true },
      { name: "Water Motor",    label: "Water Motor",  type: "appliance", enabled: true },
      { name: "PC",             label: "PC",           type: "appliance", enabled: true },
            { name: "Washing Machine", label: "W/M",         type: "appliance", enabled: true },
      { name: "Water Tank",     label: "Water Tank",   type: "env",       enabled: true },
      { name: "AC Volts",       label: "AC Volts",     type: "env",       enabled: true },
      { name: "Breaker",        label: "Grid Power",   type: "watts",     enabled: true, threshold: 20 * 60, offMsg: "OFF" },
      { name: "Solar",          label: "Solar",        type: "watts",     enabled: true }
    ];

    const formatAge = (sec) => {
      if (sec < 3600) return `${Math.max(1, Math.floor(sec / 60))}m`;
      const hrs = Math.floor(sec / 3600);
      const mins = Math.floor((sec % 3600) / 60);
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    };

    STALE_CHECK_FEEDS.forEach(item => {
      if (item.enabled === false) return;
      if (typeof userOrderedFeeds !== 'undefined' && userOrderedFeeds.length > 0) {
        const userSetting = userOrderedFeeds.find(f => f.name === item.name);
        if (userSetting && userSetting.enabled === false) return;
      }

      const feed = byName.get(item.name);
      const timeSec = (feed && feed.time && typeof feed.time === 'number' && feed.time > 0) ? feed.time : null;
      const ageSec = timeSec ? (nowSec - timeSec) : null;
      const msgPrefix = item.offMsg || "Off";
      const ageText = ageSec && ageSec > 60 ? ` (${msgPrefix} for ${formatAge(ageSec)})` : '';

      if (!feed || feed.value === null || feed.value === undefined) {
        const detailStr = ageSec && ageSec > 60 ? `No Data (${msgPrefix} for ${formatAge(ageSec)})` : 'No Data';
        warnings.push({ label: item.label, detail: detailStr });
        return;
      }

      if (item.type === 'temp' && feed.value <= 0) {
        const detailStr = `${feed.value ?? 0}°C${ageText || ` (${item.offMsg || "Offline"})`}`;
        warnings.push({ label: item.label, detail: detailStr });
        return;
      }

      const threshold = item.threshold || OFFLINE_THRESHOLD_SEC;
      if (ageSec && ageSec > threshold) {
        warnings.push({ label: item.label, detail: `${msgPrefix} for ${formatAge(ageSec)}` });
      }
    });

    // ── Zero-W / unexpectedly-off warnings (from appliance monitor) ──
    // Only feeds where continuous operation is expected should raise a
    // "0W" banner pill (fridges must stay on; grid should have power).
    // ACs / PC / Water Motor are allowed to be off intentionally.
    const zeroWBannerFeeds = ['Fridge', 'Fridge2', 'Breaker'];

    (window.applianceOfflineDetected || []).forEach(a => {
        if (a.type !== 'zeroW') return;
        if (!zeroWBannerFeeds.includes(a.name)) return;

        if (typeof userOrderedFeeds !== 'undefined' &&
            userOrderedFeeds.some(f => f.name === a.name && f.enabled === false)) {
            return;
        }

        if (warnings.find(w => w.label === a.label)) return;

        // Get current wattage from byName
        const feedVal = byName.get(a.name)?.value;
        const currentW = feedVal !== undefined ? Math.round(feedVal) : 0;

        warnings.push({
            label: a.label,
            detail: `${currentW}W for ${formatAge(a.offDurationMin * 60)}`
        });
    });
  }

  // Render the banner
  if (warnings.length === 0 && (!waste || !waste.active)) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
  } else {
    wrap.style.display = 'flex';
    let offlineListHtml = "";
    if (warnings.length > 0) {
      offlineListHtml = `
        <div class="offline-warning-header">
          <span>⚠️ Feeds Not Updating / Offline (${warnings.length}):</span>
        </div>
        <div class="offline-warning-list">
          ${warnings.map(w => `
            <div class="offline-pill">
              <span class="pill-label">${w.label}</span>
              <span>&bull;</span>
              <span class="pill-detail">${w.detail}</span>
            </div>
          `).join('')}
        </div>
      `;
    }
    wrap.innerHTML = emergencyHtml + offlineListHtml;
  }
}


// ── Battery 2 (Dyness DL5.0F) Card Renderer below UI ───────────────────
window._bat2CellsExpanded = window._bat2CellsExpanded !== undefined ? window._bat2CellsExpanded : true;

function renderBattery2Card(byName) {
  const cellNames = window.BATTERY2_CELL_NAMES || [];
  const cells = cellNames.map((n, i) => ({ idx: i + 1, v: byName.get(n)?.value }));
  const hasAnyBat2Data = byName.get('Bat2 SOC') || byName.get('Bat2 Voltage') || byName.get('Bat2 Power');
  if (!hasAnyBat2Data) return '';

  const soc     = byName.get('Bat2 SOC')?.value;
  const soh     = byName.get('Bat2 SOH')?.value;
  const volt    = byName.get('Bat2 Voltage')?.value;
  const amps    = byName.get('Bat2 Current')?.value;
  const watt    = byName.get('Bat2 Power')?.value ?? ((volt != null && amps != null) ? volt * amps : null);
  const cyc     = byName.get('Bat2 Cycle Count')?.value;
  const mosT    = byName.get('Bat2 Mosfet Temp')?.value;
  const bmsT    = byName.get('Bat2 BMS Temp')?.value;
  const chgLimV = byName.get('Bat2 Chg Limit V')?.value;
  const chgLimA = byName.get('Bat2 Chg Limit A')?.value;
  const disLimV = byName.get('Bat2 Dis Limit V')?.value;
  const disLimA = byName.get('Bat2 Dis Limit A')?.value;

  const isCharging = (amps != null && amps > 0.3) || (watt != null && watt > 15);
  const isDischarging = (amps != null && amps < -0.3) || (watt != null && watt < -15);
  const statusText = isCharging ? 'Charging' : (isDischarging ? 'Discharging' : 'Standby');
  const statusColor = isCharging ? '#4ade80' : (isDischarging ? '#f59e0b' : 'var(--text-muted)');
  const socColor = (soc != null && soc <= 20) ? '#ef4444' : (soc != null && soc <= 50) ? '#facc15' : '#4ade80';

  const prioVal = byName.get('Inverter Priority')?.value ?? byName.get('547151')?.value ?? window.lastInverterPriority;
  const prioMode = (typeof getInverterPriorityMode === 'function')
    ? getInverterPriorityMode(prioVal)
    : (Math.round(Number(prioVal)) === 1 ? 'SUB' : (Math.round(Number(prioVal)) === 2 ? 'SBU' : null));
  const prioBadge = prioMode ? `<span class="prio-badge prio-${prioMode.toLowerCase()}" style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:0.04em;background:${prioMode==='SUB'?'rgba(245,158,11,0.2)':'rgba(16,185,129,0.2)'};color:${prioMode==='SUB'?'#f59e0b':'#10b981'};border:1px solid ${prioMode==='SUB'?'rgba(245,158,11,0.45)':'rgba(16,185,129,0.45)'};margin-left:5px;vertical-align:middle;">${prioMode}</span>` : '';

  const validCells = cells.filter(c => c.v != null && c.v > 0);
  let cellGridHtml = '';
  let spreadHtml = '';
  if (validCells.length > 0) {
    const cMin = Math.min(...validCells.map(c => c.v));
    const cMax = Math.max(...validCells.map(c => c.v));
    const spreadMv = Math.round((cMax - cMin) * 1000);
    const minIdx = validCells.find(c => c.v === cMin)?.idx;
    const maxIdx = validCells.find(c => c.v === cMax)?.idx;

    spreadHtml = `<div class="linked-value" style="grid-column: 1 / -1; border-top:1px dashed var(--border); padding-top:4px; margin-top:2px;">
      <span>Cell Spread</span>
      <span class="linked-reading" style="color:${spreadMv > 30 ? '#ef4444' : spreadMv > 15 ? '#facc15' : '#4ade80'}; font-weight:800;">${cMin.toFixed(3)}V – ${cMax.toFixed(3)}V &nbsp;(Δ${spreadMv}mV)</span>
    </div>`;

    cellGridHtml = `<div class="bat2-cell-grid" id="bat2-cell-grid" style="${window._bat2CellsExpanded ? '' : 'display:none;'}">
      ${cells.map(c => {
        if (c.v == null) return `<div class="bat2-cell-item"><span class="bat2-cell-idx">C${c.idx}</span><span class="bat2-cell-v">--</span></div>`;
        const cls = c.idx === maxIdx ? 'bat2-cell-max' : (c.idx === minIdx ? 'bat2-cell-min' : '');
        return `<div class="bat2-cell-item ${cls}"><span class="bat2-cell-idx">C${c.idx}</span><span class="bat2-cell-v">${c.v.toFixed(3)}</span></div>`;
      }).join('')}
    </div>
    <div class="bat2-cell-toggle" onclick="window._bat2CellsExpanded = !window._bat2CellsExpanded; const g = document.getElementById('bat2-cell-grid'); if (g) g.style.display = window._bat2CellsExpanded ? 'grid' : 'none'; this.textContent = window._bat2CellsExpanded ? '▲ Hide 16 cell voltages' : '▼ Show 16 cell voltages';">
      ${window._bat2CellsExpanded ? '▲ Hide 16 cell voltages' : '▼ Show 16 cell voltages'}
    </div>`;
  }

  const fmtLimits = (v, u) => (v != null ? v.toFixed(1) + u : '--');

  const prioVal = byName.get('Inverter Priority')?.value ?? byName.get('547151')?.value ?? window.lastInverterPriority;
  const prioMode = (typeof getInverterPriorityMode === 'function')
    ? getInverterPriorityMode(prioVal)
    : (window.lastInverterPriority || 'SBU');
  const prioBadge = `<span class="prio-badge prio-${prioMode.toLowerCase()}" style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:900;letter-spacing:0.04em;background:${prioMode==='SUB'?'rgba(245,158,11,0.22)':'rgba(16,185,129,0.22)'};color:${prioMode==='SUB'?'#f59e0b':'#10b981'};border:1.5px solid ${prioMode==='SUB'?'#f59e0b':'#10b981'};box-shadow:0 0 8px ${prioMode==='SUB'?'rgba(245,158,11,0.3)':'rgba(16,185,129,0.3)'};">${prioMode}</span>`;

  return `<div class="card card-battery2"><div class="hero-header" style="display:flex; align-items:center; justify-content:space-between;">
    <div style="flex:1.1;"><span class="card-name">🔋 Battery SOC</span><span class="hero-val" style="color:${socColor}">${soc != null ? Math.round(soc) : '--'}%</span></div>
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 6px; flex-shrink:0;"><span style="font-size:9.5px; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:2px;">MODE</span>${prioBadge}</div>
    <div style="flex:1;text-align:center"><span class="card-name">Voltage</span><span class="hero-val" style="color:var(--accent-kwh)">${volt != null ? volt.toFixed(2) : '--'}V</span></div>
    <div style="flex:1;text-align:right"><span class="card-name">Power</span><span class="hero-val" style="color:${watt > 0 ? '#4ade80' : (watt < 0 ? '#f59e0b' : 'var(--text-muted)')}">${watt != null ? (watt > 0 ? '+' : '') + Math.round(watt) : '--'}W</span></div>
  </div><div class="linked-values linked-values-pair">
    <div class="linked-value"><span>Status</span><span class="linked-reading" style="color:${statusColor}">${statusText}${amps != null ? ' (' + Math.abs(amps).toFixed(1) + 'A)' : ''}${prioBadge}</span></div>
    <div class="linked-value"><span>SOH / Cycles</span><span class="linked-reading">${soh != null ? Math.round(soh) + '%' : '--'} &bull; ${cyc != null ? Math.round(cyc) : '--'}</span></div>
  </div><div class="linked-values linked-values-pair" style="border-top:1px dashed var(--border); padding-top:4px; margin-top:4px;">
    <div class="linked-value"><span>Mosfet / BMS Temp</span><span class="linked-reading">${fmtLimits(mosT, '°C')} &bull; ${fmtLimits(bmsT, '°C')}</span></div>
    <div class="linked-value"><span>Chg / Dis Limits</span><span class="linked-reading" style="font-size:10px;">Chg ${fmtLimits(chgLimV,'V')}/${fmtLimits(chgLimA,'A')} &bull; Dis ${fmtLimits(disLimV,'V')}/${fmtLimits(disLimA,'A')}</span></div>
    ${spreadHtml}
  </div>
  ${cellGridHtml}
  </div>`;
}

function renderResults(results) {
  const byName = new Map(results.map(r => [r.name, r]));
  const used   = new Set();

  results.forEach(f => { if (f.value != null) sparkPush(f.id, f.value); });
  if (!isCompact) { renderFlowDiagram(byName); } else { const wrap = document.getElementById('flow-svg-wrap'); if (wrap) wrap.innerHTML = ''; }
  updateCostCard(byName);
  updateOfflineWarningBanner(byName);

  const html = results.map(f => {
    if (f.name === 'Solar Amps' || f.name === 'Inverter Priority') return '';

    if (used.has(f.name)) return '';
    const gn = LINKED_GROUPS.find(g => g.includes(f.name));
    if (gn) gn.forEach(n => used.add(n)); else used.add(f.name);

    if (gn && gn.includes('Solar') && gn.includes('Tot Load')) {
      const s  = byName.get('Solar');
      const l  = byName.get('Tot Load');
      const sv = byName.get('Solar V');
      const t  = byName.get('Solar Today');
      const tt = byName.get('Solar Total');
      return `<div class="card card-solar"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Solar</span>${sparkSvg(s?.id, '#facc15')}<span class="hero-val">${s?.value != null ? Math.round(s.value) : '---'}</span></div>
        <div style="flex:1;text-align:center"><span class="card-name">Solar V</span><span class="hero-val" style="color:var(--accent-env)">${sv?.value != null ? Math.round(sv.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">Tot Load</span>${sparkSvg(l?.id, '#f59e0b')}<span class="hero-val">${l?.value != null ? Math.round(l.value) : '---'}</span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Total</span><span class="linked-reading">${tt?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (gn && gn.includes('Breaker') && gn.includes('AC Volts')) {
      const b  = byName.get('Breaker');
      const ac = byName.get('AC Volts');
      const t  = byName.get('Breaker Today');
      const tt = byName.get('Breaker Total');
      return `<div class="card card-watts"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Breaker</span>${sparkSvg(b?.id, '#f59e0b')}<span class="hero-val">${b?.value != null ? Math.round(b.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">AC Input</span><span class="hero-val" style="color:var(--accent-env)">${ac?.value != null ? Math.round(ac.value) : '---'}<span style="font-size:11px;opacity:0.7;margin-left:2px">V</span></span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Total</span><span class="linked-reading">${tt?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (gn && gn.includes('Bat V') && gn.includes('SOC %')) {
      const v    = byName.get('Bat V') || byName.get('Bat2 Voltage');
      const ca   = byName.get('bt_battery_charging_current') || byName.get('Chg A');
      const da   = byName.get('bt_battery_discharge_current') || byName.get('Dis A');
      const soc  = byName.get('SOC %') || byName.get('Dyness SOC') || byName.get('Bat2 SOC');
      const wattFeed = byName.get('Bat Power') || byName.get('Bat2 Power');
      const soh  = byName.get('Bat SOH')?.value || byName.get('Bat2 SOH')?.value;
      const cyc  = byName.get('Bat Cycle Count')?.value || byName.get('Bat2 Cycle Count')?.value;
      const mosT = byName.get('Bat Mosfet Temp')?.value || byName.get('Bat2 Mosfet Temp')?.value;
      const bmsT = byName.get('Bat BMS Temp')?.value || byName.get('Bat2 BMS Temp')?.value;
      const chgLimA = byName.get('Bat Chg Limit A')?.value || byName.get('Bat2 Chg Limit A')?.value;
      const disLimA = byName.get('Bat Dis Limit A')?.value || byName.get('Bat2 Dis Limit A')?.value;

      const batV = v?.value || 52.0;
      const chgA = ca?.value || 0;
      const disA = da?.value || 0;
      const isCharging = chgA > 0.5 || (wattFeed && wattFeed.value > 15);
      const isDischarging = disA > 0.5 || (wattFeed && wattFeed.value < -15);
      const netA = (chgA > 0.1 ? chgA : 0) - (disA > 0.1 ? disA : 0);
      const netW = wattFeed?.value != null ? Math.round(wattFeed.value) : Math.round(batV * netA);

      const socVal = soc?.value != null ? Math.round(soc.value) : '--';
      const socColor = (socVal > 50) ? '#4ade80' : (socVal > 20 ? '#facc15' : '#ef4444');

      let stText = 'Standby';
      if (isCharging) stText = `Charging (${chgA.toFixed(1)}A)`;
      else if (isDischarging) stText = `Discharging (${disA.toFixed(1)}A)`;

      const batStats = window.monthlyUnits || {};
      const fmtE = (wh) => (wh >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh || 0) + ' Wh');

      // 16 Dyness Cells
      const cellNames = window.BATTERY_CELL_NAMES || window.BATTERY2_CELL_NAMES || [];
      const cells = cellNames.map((n, i) => ({ idx: i + 1, v: byName.get(n)?.value }));
      const validCells = cells.filter(c => c.v != null && c.v > 0);

      let spreadHtml = '';
      let cellGridHtml = '';
      if (validCells.length > 0) {
        const cMin = Math.min(...validCells.map(c => c.v));
        const cMax = Math.max(...validCells.map(c => c.v));
        const spreadMv = Math.round((cMax - cMin) * 1000);
        const minIdx = validCells.find(c => c.v === cMin)?.idx;
        const maxIdx = validCells.find(c => c.v === cMax)?.idx;
        const spreadColor = spreadMv > 30 ? '#ef4444' : (spreadMv > 15 ? '#facc15' : '#4ade80');

        spreadHtml = `<div class="linked-value" style="grid-column: 1 / -1; border-top:1px dashed var(--border); padding-top:4px; margin-top:2px;">
          <span>Cell Spread</span>
          <span class="linked-reading" style="color:${spreadColor}; font-weight:800;">C${minIdx} (${cMin.toFixed(3)}V) &ndash; C${maxIdx} (${cMax.toFixed(3)}V) &nbsp;(Δ${spreadMv}mV)</span>
        </div>`;

        cellGridHtml = `<div class="bat2-cell-grid" id="bat-cell-grid" style="${window._batCellsExpanded ? '' : 'display:none;'}">
          ${cells.map(c => {
            if (c.v == null) return `<div class="bat2-cell-item"><span class="bat2-cell-idx">C${c.idx}</span><span class="bat2-cell-v">--</span></div>`;
            const cls = c.idx === maxIdx ? 'bat2-cell-max' : (c.idx === minIdx ? 'bat2-cell-min' : '');
            return `<div class="bat2-cell-item ${cls}"><span class="bat2-cell-idx">C${c.idx}</span><span class="bat2-cell-v">${c.v.toFixed(3)}</span></div>`;
          }).join('')}
        </div>
        <div class="bat2-cell-toggle" onclick="window._batCellsExpanded = !window._batCellsExpanded; const g = document.getElementById('bat-cell-grid'); if (g) g.style.display = window._batCellsExpanded ? 'grid' : 'none'; this.textContent = window._batCellsExpanded ? '▲ Hide 16 cell voltages' : '▼ Show 16 cell voltages';">
          ${window._batCellsExpanded ? '▲ Hide 16 cell voltages' : '▼ Show 16 cell voltages'}
        </div>`;
      }

      const fmtL = (val, u) => (val != null ? val.toFixed(1) + u : '--');

      return `<div class="card" style="border-left: 3px solid #10b981;">
        <div class="hero-header">
          <div style="flex:1"><span class="card-name">🔋 Battery SOC</span><span class="hero-val" style="color:${socColor}">${socVal}%</span></div>
          <div style="flex:1;text-align:center"><span class="card-name">Voltage</span><span class="hero-val" style="color:var(--accent-kwh)">${batV.toFixed(1)}V</span></div>
          <div style="flex:1;text-align:right"><span class="card-name">Power</span><span class="hero-val" style="color:${netW > 0 ? '#4ade80' : (netW < 0 ? '#f59e0b' : 'var(--text-muted)')}">${netW > 0 ? '+' : ''}${netW}W</span></div>
        </div>
        <div class="linked-values linked-values-pair">
          <div class="linked-value"><span>Status</span><span class="linked-reading" style="color:var(--accent-kwh)">${stText}${prioBadge}</span></div>
          <div class="linked-value"><span>SOH / Cycles</span><span class="linked-reading">${soh != null ? Math.round(soh) + '%' : '--'} &bull; ${cyc != null ? Math.round(cyc) : '--'}</span></div>
        </div>
        <div class="linked-values linked-values-pair" style="border-top:1px dashed var(--border); padding-top:4px; margin-top:4px;">
          <div class="linked-value"><span>Chrg Energy</span><span class="linked-reading" style="color:#10b981">T: ${fmtE(batStats.batChgT)} &bull; M: ${fmtE(batStats.batChgM)}</span></div>
          <div class="linked-value"><span>Disc Energy</span><span class="linked-reading" style="color:#f97316">T: ${fmtE(batStats.batDisT)} &bull; M: ${fmtE(batStats.batDisM)}</span></div>
        </div>
        <div class="linked-values linked-values-pair" style="border-top:1px dashed var(--border); padding-top:4px; margin-top:4px;">
          <div class="linked-value"><span>BMS / Mosfet Temp</span><span class="linked-reading">${fmtL(bmsT, '°C')} &bull; ${fmtL(mosT, '°C')}</span></div>
          <div class="linked-value"><span>Limits (Chg/Dis)</span><span class="linked-reading" style="font-size:10.5px;">${fmtL(chgLimA, 'A')} / ${fmtL(disLimA, 'A')}</span></div>
          ${spreadHtml}
        </div>
        ${cellGridHtml}
      </div>`;
    }

    if (gn && gn.includes('Fridge') && gn.includes('Fridge2')) {
      const f1 = byName.get('Fridge');
      const f2 = byName.get('Fridge2');
      const t1 = byName.get('Fridge Today');
      const t2 = byName.get('Fridge2 Today');
      return `<div class="card card-watts"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Fridge</span>${sparkSvg(f1?.id, '#f59e0b')}<span class="hero-val">${f1?.value != null ? Math.round(f1.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">Fridge2</span>${sparkSvg(f2?.id, '#f59e0b')}<span class="hero-val">${f2?.value != null ? Math.round(f2.value) : '---'}</span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t1?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t2?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (f.name === 'Water Tank') {
      const pct = f.value;
      const isWasting = window.waterWasteDetected?.active;
      const wastageInfo = window.waterWasteDetected;

      const pctColor = isWasting ? '#ef4444' : (pct > 60 ? '#38bdf8' : pct > 30 ? '#f59e0b' : '#f87171');
      const status   = isWasting ? '🚨 LEAK / VALVE OPEN' : (pct > 80 ? 'Full' : pct > 50 ? 'Good' : pct > 25 ? 'Low' : '⚠️ Critical');
      const flowRate = window.waterFlowRate || 0;
      const lastFlow = window.lastFlowRate || 0;
      const lastOnTime = window.lastMotorOnTime || 0;
      const showFlow = flowRate > 0.1 || (lastOnTime > 0 && (Date.now() - lastOnTime < 15 * 60 * 1000) && lastFlow > 0.1);
      
      let flowStr = '';
      if (isWasting) {
        flowStr = ` · -${wastageInfo.ratePerHour.toFixed(1)}%/hr`;
      } else if (showFlow) {
        const displayFlow = flowRate > 0.1 ? flowRate : lastFlow;
        const prefix = flowRate > 0.1 ? '▲ ' : 'Last: ';
        flowStr = ` · ${prefix}${displayFlow.toFixed(1)} L/min`;
        const avgFlow = window.waterAvgFlowRate || 0;
        if (avgFlow > 0.1) {
          flowStr += ` · Ø ${avgFlow.toFixed(1)}`;
        }
      }
      
      if (isCompact) {
        return `<div class="card card-env" style="${isWasting?'border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.12);':''}"><div class="card-header">
          <span class="card-name">Water Tank</span>
          <span style="font-weight:700;color:${pctColor}">${pct != null ? Math.round(pct) : '--'}% · ${status}${flowStr}</span>
        </div></div>`;
      }
      return `<div class="card card-env" style="${isWasting?'border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.1);':''}"><div class="card-header">
        <div class="tank-wrap">
          ${renderWaterTank(pct)}
          <div class="tank-info">
            <span class="card-name">Water Tank</span>
            <span class="tank-pct" style="color:${pctColor}">${pct != null ? Math.round(pct) : '--'}%</span>
            <span class="tank-label" style="${isWasting?'color:#ef4444;font-weight:800;':''}">${status}${flowStr}</span>
            ${isWasting ? `<div style="font-size:10px; color:#fca5a5; font-weight:700; margin-top:2px;">Dropped -${wastageInfo.droppedPct.toFixed(1)}% in ${wastageInfo.timeSpanMin}m</div>` : ''}
            ${sparkSvg(f.id, pctColor)}
          </div>
        </div>
      </div></div>`;
    }

    const group   = gn ? gn.map(n => byName.get(n)).filter(Boolean) : [f];
    const primary = group[0];
    if (!primary) return '';
    if (primary.name === 'Temperature' || primary.name === 'Humidity' || primary.name === 'Temperature 2' || primary.name === 'Humidity 2') {
      const isTwo = primary.name.includes('2');
      const baseName = isTwo ? 'Temperature 2' : 'Temperature';
      const humName = isTwo ? 'Humidity 2' : 'Humidity';
      const t = byName.get(baseName);
      const h = byName.get(humName);
      used.add(baseName); used.add(humName);
      return `<div class="card card-env"><div class="linked-values linked-values-pair">
        <div class="linked-value">
          <span>${baseName}</span>
          <span class="val-env" style="font-weight:700">${t?.value?.toFixed(1) ?? '--'} °C ${sparkSvg(t?.id, '#10b981')}</span>
        </div>
        <div class="linked-value">
          <span>${humName}</span>
          <span class="val-env" style="font-weight:700">${h?.value?.toFixed(1) ?? '--'} % ${sparkSvg(h?.id, '#10b981')}</span>
        </div>
      </div></div>`;
    }

    const sparkColor = primary.type === 'watts' ? '#f59e0b' : primary.type === 'units' ? '#38bdf8' : '#10b981';
    return `<div class="${cardClass(primary.type)}"><div class="card-header">
      <span class="card-name">${primary.name}</span>
      <span class="card-value ${COLORS[primary.type]}">${primary.value != null ? (primary.unit === 'W' ? Math.round(primary.value) : primary.value.toFixed(1)) : '--'} <span style="font-size:11px;opacity:0.6">${primary.unit}</span>${sparkSvg(primary.id, sparkColor)}</span>
    </div>${group.length > 1 ? `<div class="linked-values linked-values-pair">${group.slice(1).map(r => `
      <div class="linked-value"><span>${r.name.includes('Today') ? 'Today' : 'Total'}</span><span class="linked-reading">${r.value != null ? r.value.toFixed(1) : '0.0'}</span></div>`).join('')}</div>` : ''}</div>`;
  }).join('');

  document.getElementById('list').innerHTML = html;
}
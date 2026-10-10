// js/02c-flow-battery2-html.js
// ─── Flow Diagram: responsive Battery 2 (Dyness) HTML card ───────────
// Auto-split from js/02-flow.js by split_02_flow.py

// ── Render Responsive HTML Dyness Battery Card in Flow Section ──
function renderFlowBattery2Html(byName) {
  let b2Wrap = document.getElementById('flow-battery2-wrap');
  if (!b2Wrap) {
    const flowCard = document.getElementById('flow-card');
    if (flowCard) {
      b2Wrap = document.createElement('div');
      b2Wrap.id = 'flow-battery2-wrap';
      flowCard.appendChild(b2Wrap);
    }
  }
  if (!b2Wrap) return;

  const getV = (n) => byName.get(n)?.value;
  const snap = window.lastBattery2Snapshot || {};

  const soc     = snap.soc != null ? snap.soc : (getV('Bat2 SOC') != null ? Math.round(getV('Bat2 SOC')) : (getV('SOC %') != null ? Math.round(getV('SOC %')) : null));
  const volt    = snap.volt != null ? snap.volt : (getV('Bat2 Voltage') || getV('Bat V'));
  const amps    = snap.amps != null ? snap.amps : (getV('Bat2 Current') || ((getV('bt_battery_charging_current') || 0) - (getV('bt_battery_discharge_current') || 0)));
  const watt    = snap.watt != null ? snap.watt : (getV('Bat2 Power') ?? ((volt != null && amps != null) ? volt * amps : null));
  const soh     = snap.soh != null ? snap.soh : (getV('Bat2 SOH') || getV('Bat SOH') || 100);
  const cyc     = snap.cycles != null ? snap.cycles : (getV('Bat2 Cycle Count') || getV('Bat Cycle Count') || 11);
  const mosT    = snap.mosfetTemp != null ? snap.mosfetTemp : (getV('Bat2 Mosfet Temp') || getV('Bat Mosfet Temp'));
  const bmsT    = snap.bmsTemp != null ? snap.bmsTemp : (getV('Bat2 BMS Temp') || getV('Bat BMS Temp'));
  const chgLimA = getV('Bat2 Chg Limit A') || getV('Bat Chg Limit A') || 65.0;
  const disLimA = getV('Bat2 Dis Limit A') || getV('Bat Dis Limit A') || 20.0;

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

  const batStats = window.monthlyUnits || {};
  const fmtE = (wh) => (wh >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh || 0) + ' Wh');
  const fmtL = (val, u) => (val != null && val > 0 ? Number(val).toFixed(1) + u : '--');

  // 16 Cells
  const cellNames = window.BATTERY2_CELL_NAMES || window.BATTERY_CELL_NAMES || [];
  const cells = cellNames.map((n, i) => ({ idx: i + 1, v: getV(n) }));
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

    if (window._batFlowCellsExpanded === undefined) window._batFlowCellsExpanded = true;

    cellGridHtml = `<div class="bat2-cell-grid" id="bat-flow-cell-grid" style="${window._batFlowCellsExpanded ? '' : 'display:none;'}">
      ${cells.map(c => {
        if (c.v == null) return `<div class="bat2-cell-item"><span class="bat2-cell-idx">C${c.idx}</span><span class="bat2-cell-v">--</span></div>`;
        const cls = c.idx === maxIdx ? 'bat2-cell-max' : (c.idx === minIdx ? 'bat2-cell-min' : '');
        return `<div class="bat2-cell-item ${cls}"><span class="bat2-cell-idx">C${c.idx}</span><span class="bat2-cell-v">${c.v.toFixed(3)}</span></div>`;
      }).join('')}
    </div>
    <div class="bat2-cell-toggle" onclick="event.stopPropagation(); window._batFlowCellsExpanded = !window._batFlowCellsExpanded; const g = document.getElementById('bat-flow-cell-grid'); if (g) g.style.display = window._batFlowCellsExpanded ? 'grid' : 'none'; this.textContent = window._batFlowCellsExpanded ? '▲ Hide 16 cell voltages' : '▼ Show 16 cell voltages';">
      ${window._batFlowCellsExpanded ? '▲ Hide 16 cell voltages' : '▼ Show 16 cell voltages'}
    </div>`;
  }

  const pwrColor = watt > 0 ? '#4ade80' : (watt < 0 ? '#f59e0b' : 'var(--text-muted)');
  const pwrSign = (watt != null && watt !== 0) ? ((watt > 0 ? '+' : '') + Math.round(watt)) : '0';

  b2Wrap.innerHTML = `
    <div class="card card-battery2" style="border-left: 3px solid #10b981; cursor:pointer;" onclick="if (typeof openFlowDetail === 'function') openFlowDetail('battery2');">
      <div class="hero-header" style="display:flex; align-items:center; justify-content:space-between;">
        <div style="flex:1.1;">
          <span class="card-name">🔋 Battery</span>
          <div class="hero-val" style="color:${socColor}; font-size:16px; margin-left:0; margin-top:2px;">SOC ${soc != null ? Math.round(soc) : '--'}%</div>
        </div>
        <div id="fd-hero-mode-col" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 6px; flex-shrink:0;">
          <span style="font-size:9.5px; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:2px;">MODE</span>
          ${prioBadge}
        </div>
        <div style="flex:1; text-align:center;">
          <span class="card-name">Voltage</span>
          <span class="hero-val" style="color:var(--accent-kwh)">${volt != null ? Number(volt).toFixed(1) : '--'}V</span>
        </div>
        <div style="flex:1; text-align:right;">
          <span class="card-name">Power</span>
          <span class="hero-val" style="color:${pwrColor}">${pwrSign}W</span>
        </div>
      </div>
      <div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Status</span><span class="linked-reading" style="color:${statusColor}">${statusText}${amps != null ? ' (' + Math.abs(amps).toFixed(1) + 'A)' : ''}${prioBadge}</span></div>
        <div class="linked-value"><span>SOH / Cycles</span><span class="linked-reading" style="color:var(--accent-kwh)">${soh != null ? Math.round(soh) + '%' : '--'} &bull; ${cyc != null ? Math.round(cyc) : '--'}</span></div>
      </div>
      <div class="linked-values linked-values-pair" style="border-top:1px dashed var(--border); padding-top:4px; margin-top:4px;">
        <div class="linked-value"><span>Chrg Energy</span><span class="linked-reading" style="color:#10b981">T: ${fmtE(batStats.batChgT)} &bull; M: ${fmtE(batStats.batChgM)}</span></div>
        <div class="linked-value"><span>Disc Energy</span><span class="linked-reading" style="color:#f97316">T: ${fmtE(batStats.batDisT)} &bull; M: ${fmtE(batStats.batDisM)}</span></div>
      </div>
      <div class="linked-values linked-values-pair" style="border-top:1px dashed var(--border); padding-top:4px; margin-top:4px;">
        <div class="linked-value"><span>BMS / Mosfet Temp</span><span class="linked-reading" style="color:var(--accent-kwh)">${fmtL(bmsT, '°C')} &bull; ${fmtL(mosT, '°C')}</span></div>
        <div class="linked-value"><span>Limits (Chg/Dis)</span><span class="linked-reading" style="font-size:10.5px; color:var(--accent-kwh);">${fmtL(chgLimA, 'A')} / ${fmtL(disLimA, 'A')}</span></div>
        ${spreadHtml}
      </div>
      ${cellGridHtml}
    </div>
  `;
}

// js/22f-flow-detail-battery.js
// ─── Flow Detail: battery 3-box + battery 2 grid renderers ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

      function _renderBattery3Boxes(container, lines) {
    container.style.paddingTop = '10px';
    container.style.paddingBottom = '10px';

    // Helper to apply font size and vertical drag offset (dy) from editor.html / FLOW_DETAIL_TEXT
    function _batStyle(idx, defFs, extraCss) {
      const ov = FD._textOv('battery', idx);
      const fs = (typeof ov.fs === 'number' && ov.fs > 0) ? ov.fs : defFs;
      const dy = (typeof ov.dy === 'number') ? ov.dy : 0;
      let s = '';
      if (fs) s += 'font-size:' + fs + 'px;';
      if (dy) s += 'transform:translateY(' + dy + 'px);';
      if (extraCss) s += extraCss;
      return s;
    }

    let soc = '---', volt = '---', time = '--:--', action = 'Standby', watts = '';
    let rate = '', cutoff = '', chgM = '', chgTY = '', dischM = '', dischTY = '';

    lines.forEach(function (l) {
      const t = l.text.trim();
      if (/^\d+(\.\d+)?%$/.test(t)) soc = t;
      else if (/^\d+(\.\d+)?V$/i.test(t)) volt = t;
      else if (/\d+:\d+\s*(AM|PM)/i.test(t)) time = t;
      else if (/Charging|Discharging|Standby/i.test(t)) action = t;
      else if (/[+-]\d+\s*w/i.test(t)) watts = t;
      else if (/%(\/hr|\/min)/i.test(t)) rate = t;
      else if (/left|to \d+%|reached/i.test(t)) cutoff = t;
      else if (/Chg:\s*M:/i.test(t)) chgM = t.replace(/Chg:\s*/i, '');
      else if (/Disch:\s*M:/i.test(t)) dischM = t.replace(/Disch:\s*/i, '');
      else if (/T:.*Y:/i.test(t)) {
        if (!chgTY && !dischM) chgTY = t;
        else dischTY = t;
      }
    });

    const mU = window.monthlyUnits || {};
    const fmt = function (wh) {
      if (wh == null || isNaN(wh) || wh <= 0) return '0 w';
      return wh >= 500 ? (wh / 1000).toFixed(1) + ' kwh' : Math.round(wh) + ' w';
    };
    if (!chgM && mU.batChgM) chgM = 'M: ' + fmt(mU.batChgM);
    if (!chgTY && (mU.batChgT || mU.batChgY)) chgTY = 'T: ' + fmt(mU.batChgT) + ' Y: ' + fmt(mU.batChgY);
    if (!dischM && mU.batDisM) dischM = 'M: ' + fmt(mU.batDisM);
    if (!dischTY && (mU.batDisT || mU.batDisY)) dischTY = 'T: ' + fmt(mU.batDisT) + ' Y: ' + fmt(mU.batDisY);

    const socNum = parseFloat(soc);
    const socColor = (!isNaN(socNum) && socNum <= 20) ? '#ef4444' : ((!isNaN(socNum) && socNum <= 50) ? '#facc15' : '#25f447');
    const isCharging = action.includes('Charging');

    const byName = window.lastResultsMap || new Map();
    const prioVal = (typeof byName.get === 'function' ? byName.get('Inverter Priority')?.value ?? byName.get('547151')?.value : null) ?? window.lastInverterPriority;
    const prioMode = (typeof getInverterPriorityMode === 'function')
      ? getInverterPriorityMode(prioVal)
      : (Math.round(Number(prioVal)) === 1 ? 'SUB' : (Math.round(Number(prioVal)) === 2 ? 'SBU' : null));
    const prioBadge = prioMode ? '<span class="prio-badge prio-' + prioMode.toLowerCase() + '" style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:0.04em;background:' + (prioMode==='SUB'?'rgba(245,158,11,0.2)':'rgba(16,185,129,0.2)') + ';color:' + (prioMode==='SUB'?'#f59e0b':'#10b981') + ';border:1px solid ' + (prioMode==='SUB'?'rgba(245,158,11,0.45)':'rgba(16,185,129,0.45)') + ';margin-left:4px;vertical-align:middle;">' + prioMode + '</span>' : '';

    let html = '<div class="fd-battery-grid">';

    // ── Box 1: Charge Info (Left) ──
    html += '<div class="fd-bat-card">';
    html += '<div class="fd-bat-header" style="color:#10b981;">⚡ CHARGE' + (prioBadge ? ' ' + prioBadge : '') + '</div>';
    html += '<div class="fd-bat-val" style="' + _batStyle(5, 13, 'color:#4ade80;') + '">' + (watts.startsWith('+') ? watts : (isCharging ? watts : '--')) + '</div>';
    html += '<div class="fd-bat-sub" style="' + _batStyle(4, 10.5, 'color:' + (isCharging ? '#25f447' : '#a1a1aa') + ';') + '">' + action + '</div>';
    if (rate) html += '<div class="fd-bat-sub" style="' + _batStyle(6, 10.5, 'color:#4ade80;') + '">' + rate + '</div>';
    if (cutoff) html += '<div class="fd-bat-sub" style="' + _batStyle(7, 10.5, 'color:#facc15;') + '">' + cutoff + '</div>';
    html += '<div class="fd-bat-divider"></div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(9, 10.5, 'color:#10b981;') + '">' + (chgTY || 'T: 0w Y: 0w') + '</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(8, 10.5, 'color:#10b981;') + '">' + (chgM || 'M: 0w') + '</div>';
    // Mirror the DISCHARGE card stats here too (per request)
    html += '<div class="fd-bat-divider"></div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(11, 10.5, 'color:#f97316;font-weight:700;') + '">' + (dischTY || 'T: 0w Y: 0w') + '</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(10, 10.5, 'color:#f97316;') + '">' + (dischM || 'M: 0w') + '</div>';
    html += '</div>';

    // ── Box 2: Hero SOC (Center) ──
    // idx 0 = Battery Title, idx 1 = SOC %, idx 2 = Voltage, idx 3 = Time
    html += '<div class="fd-bat-card fd-bat-hero">';
    html += '<div class="fd-bat-header" style="' + _batStyle(0, 11, 'color:#10b981;') + '">Battery' + (prioBadge ? ' ' + prioBadge : '') + '</div>';
    html += '<div class="fd-bat-soc" style="' + _batStyle(1, 38, 'color:' + socColor + ';') + '">' + soc + '</div>';
    html += '<div class="fd-bat-volt" style="' + _batStyle(2, 17, 'color:#35c0b7;') + '">' + volt + '</div>';
    html += '<div class="fd-bat-time" style="' + _batStyle(3, 11, 'color:#a1a1aa;') + '">' + time + '</div>';
    html += '</div>';

    // ── Box 3: Discharge & Night (Right) ──
    html += '<div class="fd-bat-card">';
    html += '<div class="fd-bat-header" style="color:#f97316;">⚡ DISCHARGE</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(11, 10.5, 'color:#f97316;font-weight:700;') + '">' + (dischTY || 'T: 0w Y: 0w') + '</div>';
    html += '<div class="fd-bat-stat" style="' + _batStyle(10, 10.5, 'color:#f97316;') + '">' + (dischM || 'M: 0w') + '</div>';
    html += '<div class="fd-bat-divider"></div>';
    html += '<div class="fd-battery-night" style="' + _batStyle('night', 10, 'color:#c084fc;font-weight:700;') + '">Loading night disch&hellip;</div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    const nightEl = container.querySelector('.fd-battery-night');
    if (nightEl) FD._populateBatteryNight(nightEl);
  }

  function _renderBattery2Grid(container) {
    container.style.paddingTop = '10px';
    container.style.paddingBottom = '10px';

    const snap = window.lastBattery2Snapshot || {};
    const byName = window.lastResultsMap || new Map();
    const getV = (n) => byName.get(n)?.value;

    const soc   = snap.soc   != null ? snap.soc   : getV('Bat2 SOC');
    const soh   = snap.soh   != null ? snap.soh   : getV('Bat2 SOH');
    const volt  = snap.volt  != null ? snap.volt  : getV('Bat2 Voltage');
    const amps  = snap.amps  != null ? snap.amps  : getV('Bat2 Current');
    const watt  = snap.watt  != null ? snap.watt  : getV('Bat2 Power');
    const cyc   = snap.cycles != null ? snap.cycles : getV('Bat2 Cycle Count');
    const mosT  = snap.mosfetTemp != null ? snap.mosfetTemp : getV('Bat2 Mosfet Temp');
    const bmsT  = snap.bmsTemp != null ? snap.bmsTemp : getV('Bat2 BMS Temp');
    const chgLimV = getV('Bat2 Chg Limit V');
    const chgLimA = getV('Bat2 Chg Limit A');
    const disLimV = getV('Bat2 Dis Limit V');
    const disLimA = getV('Bat2 Dis Limit A');

    const isCharging = snap.isCharging != null ? snap.isCharging : ((amps > 0.3) || (watt > 15));
    const isDischarging = snap.isDischarging != null ? snap.isDischarging : ((amps < -0.3) || (watt < -15));
    const statusText = isCharging ? '⚡ Charging' : (isDischarging ? '⚡ Discharging' : '⏸ Standby');
    const statusColor = isCharging ? '#4ade80' : (isDischarging ? '#f59e0b' : 'var(--text-muted)');
    const socColor = (soc != null && soc <= 20) ? '#ef4444' : (soc != null && soc <= 50) ? '#facc15' : '#4ade80';

    const cellNames = window.BATTERY2_CELL_NAMES || [];
    const cells = cellNames.map((n, i) => ({ idx: i + 1, v: byName.get(n)?.value }));
    const validCells = cells.filter(c => c.v != null && c.v > 0);

    let html = '';

    // Top stat row: SOC / Voltage / Current / Power
    html += '<div class="fd-bat2-top">';
    html += '<div class="fd-bat2-stat"><div class="lbl">SOC</div><div class="val" style="color:' + socColor + ';">' + (soc != null ? Math.round(soc) + '%' : '--') + '</div></div>';
    html += '<div class="fd-bat2-stat"><div class="lbl">Voltage</div><div class="val" style="color:#35c0b7;">' + (volt != null ? volt.toFixed(2) + 'V' : '--') + '</div></div>';
    html += '<div class="fd-bat2-stat"><div class="lbl">Current</div><div class="val" style="color:#facc15;">' + (amps != null ? amps.toFixed(1) + 'A' : '--') + '</div></div>';
    html += '<div class="fd-bat2-stat"><div class="lbl">Power</div><div class="val" style="color:' + (watt > 0 ? '#4ade80' : (watt < 0 ? '#f59e0b' : 'var(--text-muted)')) + ';">' + (watt != null ? (watt > 0 ? '+' : '') + Math.round(watt) + 'W' : '--') + '</div></div>';
    html += '</div>';

    html += '<div class="fd-bat2-status" style="color:' + statusColor + ';">' + statusText + '</div>';

    // SOH / Cycles / Temps row
    html += '<div class="fd-bat2-top">';
    html += '<div class="fd-bat2-stat"><div class="lbl">SOH</div><div class="val" style="color:#10b981;">' + (soh != null ? Math.round(soh) + '%' : '--') + '</div></div>';
    html += '<div class="fd-bat2-stat"><div class="lbl">Cycles</div><div class="val" style="color:#10b981;">' + (cyc != null ? Math.round(cyc) : '--') + '</div></div>';
    html += '<div class="fd-bat2-stat"><div class="lbl">Mosfet Temp</div><div class="val" style="color:#38bdf8; font-size:14px;">' + (mosT != null ? mosT.toFixed(1) + '°C' : '--') + '</div></div>';
    html += '<div class="fd-bat2-stat"><div class="lbl">BMS Temp</div><div class="val" style="color:#38bdf8; font-size:14px;">' + (bmsT != null ? bmsT.toFixed(1) + '°C' : '--') + '</div></div>';
    html += '</div>';

    // Charge / Discharge limits
    html += '<div class="fd-bat2-limits">';
    html += '<div class="fd-bat2-limit-card"><div class="t" style="color:#4ade80;">Charge Limit</div>' +
      (chgLimV != null ? chgLimV.toFixed(1) + 'V' : '--') + ' &nbsp;/&nbsp; ' +
      (chgLimA != null ? chgLimA.toFixed(1) + 'A' : '--') + '</div>';
    html += '<div class="fd-bat2-limit-card"><div class="t" style="color:#f97316;">Discharge Limit</div>' +
      (disLimV != null ? disLimV.toFixed(1) + 'V' : '--') + ' &nbsp;/&nbsp; ' +
      (disLimA != null ? disLimA.toFixed(1) + 'A' : '--') + '</div>';
    html += '</div>';

    // All 16 cell voltages in an 8×2 grid
    if (validCells.length > 0) {
      const cMin = Math.min(...validCells.map(c => c.v));
      const cMax = Math.max(...validCells.map(c => c.v));
      const spreadMv = Math.round((cMax - cMin) * 1000);
      const minIdx = validCells.find(c => c.v === cMin)?.idx;
      const maxIdx = validCells.find(c => c.v === cMax)?.idx;
      const spreadColor = spreadMv > 30 ? '#ef4444' : (spreadMv > 15 ? '#facc15' : '#4ade80');

      html += '<div style="margin-top:6px;">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
        '<span class="fd-bat2-section-title" style="margin:0;">🔋 16S Cell Voltages (4×4)</span>' +
        '<span style="font-size:11px; font-weight:700; color:' + spreadColor + ';">Min: C' + minIdx + ' (' + cMin.toFixed(3) + 'V) · Max: C' + maxIdx + ' (' + cMax.toFixed(3) + 'V) · Δ' + spreadMv + 'mV</span>' +
        '</div>';
      html += '<div class="fd-bat2-cellgrid">';
      cells.forEach(function (c) {
        if (c.v == null) {
          html += '<div class="fd-bat2-cell"><span class="cnum">C' + c.idx + '</span><span class="cv">--</span></div>';
          return;
        }
        const cls = c.idx === maxIdx ? 'cmax' : (c.idx === minIdx ? 'cmin' : '');
        html += '<div class="fd-bat2-cell ' + cls + '"><span class="cnum">C' + c.idx + '</span><span class="cv">' + c.v.toFixed(3) + '</span></div>';
      });
      html += '</div></div>';
    } else {
      html += '<div class="fd-empty" style="padding:14px;">Cell voltage data not yet available&hellip;</div>';
    }

    container.innerHTML = html;
  }

  // ── Exports ──────────────────────────────────────────────
  FD._renderBattery3Boxes = _renderBattery3Boxes;
  FD._renderBattery2Grid = _renderBattery2Grid;
})();

// js/19c1-graphs-state.js
// ─── Global graph state variables ───────────────────────────────────────────

if (typeof graphIsLoading === 'undefined') window.graphIsLoading = false;
if (typeof graphDataCache === 'undefined') window.graphDataCache = null;
if (typeof graphTab === 'undefined') window.graphTab = 'day';
if (typeof graphFeedKey === 'undefined') window.graphFeedKey = 'solar';
if (typeof graphDateNav === 'undefined') window.graphDateNav = 0;
if (typeof graphMonthNav === 'undefined') window.graphMonthNav = 0;
if (typeof graphYearNav === 'undefined') window.graphYearNav = 0;
if (typeof graphChartType === 'undefined') window.graphChartType = 'line';
if (typeof graphZoomLevel === 'undefined') window.graphZoomLevel = 1;
if (typeof graphPanOffset === 'undefined') window.graphPanOffset = 0;
if (typeof graphIsRendering === 'undefined') window.graphIsRendering = false;
if (typeof graphIsPanning === 'undefined') window.graphIsPanning = false;
if (typeof window.gridAllDisabled === 'undefined') window.gridAllDisabled = new Set();

// ─── Moment Flow toggles state ──────────────────────────────────────────────
if (typeof window.momentFlowDisabled === 'undefined') {
  window.momentFlowDisabled = new Set();
  try {
    const saved = localStorage.getItem('momentFlowDisabled');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) window.momentFlowDisabled = new Set(arr);
    }
  } catch (e) {}
}

const MOMENT_FLOW_FEEDS = [
  { key: 'grid',    label: 'Grid',         color: '#ef4444', isGrid: true },
  { key: 'solar',   label: 'Solar',        color: '#facc15', isSolar: true },
  { key: 'k15',     label: 'Kenwood 1.5T', color: '#38bdf8', isAc: true },
  { key: 'k1',      label: 'Kenwood 1T',   color: '#7dd3fc', isAc: true },
  { key: 'haier',   label: 'Haier 1T',     color: '#a5f3fc', isAc: true },
  { key: 'fridge1', label: 'Fridge 1',     color: '#c084fc' },
  { key: 'fridge2', label: 'Fridge 2',     color: '#22d3ee' },
  { key: 'pc',      label: 'PC',           color: '#4ade80' },
  { key: 'motor',   label: 'Motor',        color: '#fbbf24' },
  { key: 'wm',      label: 'W/M',          color: '#e879f9' },
  { key: 'others',  label: 'Others',       color: '#f59e0b' }
];
window.MOMENT_FLOW_FEEDS = MOMENT_FLOW_FEEDS;

if (typeof window.graphOverlayAc === 'undefined') window.graphOverlayAc = null;

// ─── Others: optional Fridge 1 + Fridge 2 overlay state ────────────────────
if (typeof window.graphOthersIncludeFridges === 'undefined') {
  window.graphOthersIncludeFridges = false;
}
try {
  if (localStorage.getItem('graphOthersIncludeFridges') !== null) {
    window.graphOthersIncludeFridges = localStorage.getItem('graphOthersIncludeFridges') === 'true';
  }
} catch (e) {}

// ─── W/M: independent Motor and Water Tank overlay states ───────────────────
if (typeof window.graphWmIncludeMotor === 'undefined') {
  window.graphWmIncludeMotor = false;
}
try {
  if (localStorage.getItem('graphWmIncludeMotor') !== null) {
    window.graphWmIncludeMotor = localStorage.getItem('graphWmIncludeMotor') === 'true';
  }
} catch (e) {}

if (typeof window.graphWmIncludeWater === 'undefined') {
  window.graphWmIncludeWater = false;
}
try {
  if (localStorage.getItem('graphWmIncludeWater') !== null) {
    window.graphWmIncludeWater = localStorage.getItem('graphWmIncludeWater') === 'true';
  }
} catch (e) {}

// ─── Water Tank: independent Motor and W/M overlay states ───────────────────
if (typeof window.graphWaterIncludeMotor === 'undefined') {
  window.graphWaterIncludeMotor = false;
}
try {
  if (localStorage.getItem('graphWaterIncludeMotor') !== null) {
    window.graphWaterIncludeMotor = localStorage.getItem('graphWaterIncludeMotor') === 'true';
  }
} catch (e) {}

if (typeof window.graphWaterIncludeWm === 'undefined') {
  window.graphWaterIncludeWm = false;
}
try {
  if (localStorage.getItem('graphWaterIncludeWm') !== null) {
    window.graphWaterIncludeWm = localStorage.getItem('graphWaterIncludeWm') === 'true';
  }
} catch (e) {}

// ─── Motor: independent Water Tank and W/M overlay states ───────────────────
if (typeof window.graphMotorIncludeWater === 'undefined') {
  window.graphMotorIncludeWater = false;
}
try {
  if (localStorage.getItem('graphMotorIncludeWater') !== null) {
    window.graphMotorIncludeWater = localStorage.getItem('graphMotorIncludeWater') === 'true';
  }
} catch (e) {}

if (typeof window.graphMotorIncludeWm === 'undefined') {
  window.graphMotorIncludeWm = false;
}
try {
  if (localStorage.getItem('graphMotorIncludeWm') !== null) {
    window.graphMotorIncludeWm = localStorage.getItem('graphMotorIncludeWm') === 'true';
  }
} catch (e) {}

// ─── Battery: Voltage and Power overlay states ─────────────────────────────
if (typeof window.graphBatteryIncludeVoltage === 'undefined') {
  window.graphBatteryIncludeVoltage = true;
}
try {
  if (localStorage.getItem('graphBatteryIncludeVoltage') !== null) {
    window.graphBatteryIncludeVoltage = localStorage.getItem('graphBatteryIncludeVoltage') === 'true';
  }
} catch (e) {}

if (typeof window.graphBatteryIncludePower === 'undefined') {
  window.graphBatteryIncludePower = false;
}
try {
  if (localStorage.getItem('graphBatteryIncludePower') !== null) {
    window.graphBatteryIncludePower = localStorage.getItem('graphBatteryIncludePower') === 'true';
  }
} catch (e) {}

// ─── Energy & Stat line formatter ───────────────────────────────────────────
function _fmtKwh(v) { 
  return v >= 1 ? v.toFixed(1) : (v >= 0.01 ? v.toFixed(2) : v.toFixed(3)); 
}

// Automatically switches to Wh when energy is under 500 Wh (0.5 kWh)
function _fmtEnergy(v) {
  if (v == null || isNaN(v) || v <= 0) return '0 Wh';
  const wh = v * 1000;
  if (wh >= 500) {
    return `${(wh / 1000).toFixed(1)} kWh`;
  }
  return `${Math.round(wh)} Wh`;
}

function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, dayAvgVal, dayTotalVal, nightAvgVal, nightTotalVal, unit, isKwh, currentTab, isCompact = false) {
  const lblLower = (label || '').toLowerCase();
  const isTemp = lblLower.includes('temp') || unit === '°C';
  const isWater = lblLower.includes('water') || lblLower.includes('tank') || (unit === '%' && !lblLower.includes('battery') && !lblLower.includes('soc'));
  const isBat = lblLower.includes('battery') || lblLower.includes('soc') || lblLower.includes('bat');
  const isVolts = lblLower.includes('volt') || unit === 'V';
  const isNonEnergy = isTemp || isWater || isVolts || isBat;

  // Only energy feeds become kWh/Wh in Month/Year
  if ((currentTab === 'month' || currentTab === 'year') && !isNonEnergy) {
    unit = 'kWh';
    isKwh = true;
  }

  const isSolar = lblLower.includes('solar') && !lblLower.includes('grid');
  const isDay = currentTab === 'day';
  const hideNight = isSolar || isNonEnergy;
  const peakLabel = isDay ? "Peak" : (currentTab === 'year' ? "Max Month" : "Max Day");
  const avgLabel  = isDay ? "Avg"  : (currentTab === 'month' ? "Daily Avg" : "Monthly Avg");

  let peakColor = accentColor;
  if (peakVal > 1500 && isDay && !isNonEnergy) peakColor = '#ef4444';

  const fsMain = isCompact ? '12px' : '15px';
  const fsLabel = isCompact ? '11px' : '13px';
  const boldStyle = `font-size: ${isCompact ? '10px' : '12px'}; font-weight: 900;`;

  let avgHtml = '';
  if (avgVal && avgVal > 0.01) {
    const avgDisp = isNonEnergy ? avgVal.toFixed(1) : (isDay ? Math.round(avgVal) : avgVal.toFixed(1));
    avgHtml = ` <span style="color:var(--border)">·</span> <span style="color:${accentColor}; ${boldStyle}">${avgLabel}: ${avgDisp} ${unit}</span>`;
  }

  let dayHtml = '';
  if ((dayAvgVal && dayAvgVal > 0.01) || (dayTotalVal && dayTotalVal > 0.01)) {
    const dayAvgDisp = (isDay && !isNonEnergy) ? Math.round(dayAvgVal) : dayAvgVal.toFixed(1);
    const dKwhDisp = (dayTotalVal && !isNonEnergy) ? _fmtEnergy(dayTotalVal) + ' ' : '';
    const dAvgUnit = isNonEnergy ? unit : (isDay ? 'W' : 'kWh/d');
    dayHtml = `<span style="color:var(--accent-solar); ${boldStyle}">Day: ${dKwhDisp}(Avg: ${dayAvgDisp} ${dAvgUnit})</span>`;
  }

  let nightHtml = '';
  if (!hideNight && ((nightAvgVal && nightAvgVal > 0.01) || (nightTotalVal && nightTotalVal > 0.01))) {
    const nightAvgDisp = (isDay && !isNonEnergy) ? Math.round(nightAvgVal) : nightAvgVal.toFixed(1);
    const nKwhDisp = (nightTotalVal && !isNonEnergy) ? _fmtEnergy(nightTotalVal) + ' ' : '';
    const nAvgUnit = isNonEnergy ? unit : (isDay ? 'W' : 'kWh/d');
    nightHtml = `<span style="color:#c084fc; ${boldStyle}">Night: ${nKwhDisp}(Avg: ${nightAvgDisp} ${nAvgUnit})</span>`;
  }

  let dayNightRow = '';
  if (dayHtml || nightHtml) {
    dayNightRow = `<div style="margin-top:2px; display:flex; gap:8px;">${dayHtml}${nightHtml}</div>`;
  }

  const mainDisplay = isKwh ? _fmtEnergy(mainVal) : `${mainVal.toFixed(1)} ${unit}`;
  const peakDisp = isNonEnergy ? peakVal.toFixed(1) : (isDay ? Math.round(peakVal).toLocaleString() : peakVal.toFixed(1));

  return `<div style="margin-bottom: 6px; line-height:1.2;"><div style="display:flex; align-items:center; gap:6px;"><span style="color:${accentColor}; font-size:${fsLabel}; font-weight:700;">${icon ? icon + ' ' : ''}${label}:</span><span style="color:var(--text-main); font-size:${fsMain}; font-weight:900;">${mainDisplay}</span></div><div style="color:var(--text-muted); font-size:11px; font-weight:600; margin-left: 1px; margin-top: 2px;"><div>(${peakLabel}: <span style="color:${peakColor}; ${boldStyle}">${peakDisp}</span> ${unit}${avgHtml})</div>${dayNightRow}</div></div>`;
}

// ─── Battery: Charge/Discharge Sessions Overlay State ────────────────────────
if (typeof window.graphBatteryShowSessions === 'undefined') {
  window.graphBatteryShowSessions = true;
}
try {
  if (localStorage.getItem('graphBatteryShowSessions') !== null) {
    window.graphBatteryShowSessions = localStorage.getItem('graphBatteryShowSessions') === 'true';
  }
} catch (e) {}

/**
 * Windowed Slope Accumulator: Detects all sustained charge & discharge sessions >= 10m
 */
function detectBatterySessions(socBars, resSec, lastIdx, minDurationMin, minDeltaPct) {
  if (!resSec) resSec = 120;
  if (!minDurationMin) minDurationMin = 10;
  if (!minDeltaPct) minDeltaPct = 2.0;
  if (!socBars || socBars.length < 5) return [];
  const maxLen = Math.min(socBars.length, lastIdx || socBars.length);

  // 1. Clean dropouts (fill 0% glitches with last valid reading)
  const soc = [];
  let lastGood = 50;
  for (let k = 0; k < maxLen; k++) {
    const v = socBars[k];
    if (v != null && !isNaN(v) && v > 15) { lastGood = v; break; }
  }
  for (let k = 0; k < maxLen; k++) {
    const v = socBars[k];
    if (v == null || isNaN(v) || v <= 10) soc.push(lastGood);
    else { lastGood = v; soc.push(v); }
  }

  // 2. Light 3-point smoothing
  const s = [];
  for (let k = 0; k < soc.length; k++) {
    const p0 = soc[Math.max(0, k - 1)];
    const p1 = soc[k];
    const p2 = soc[Math.min(soc.length - 1, k + 1)];
    s.push((p0 + p1 + p2) / 3);
  }

  const sessions = [];
  const plateauLimit = Math.max(4, Math.round((14 * 60) / resSec)); // ~7 points (14m)
  let i = 0;

  while (i < s.length - 2) {
    // Look ahead 4 points (~8m) to detect sustained trend onset
    const lookAhead = Math.min(s.length - 1, i + 4);
    const diff = s[lookAhead] - s[i];
    let dir = 0;

    if (diff >= 0.5) dir = 1;        // Charging
    else if (diff <= -0.5) dir = -1;  // Discharging

    if (dir === 0) {
      i++;
      continue;
    }

    const startIdx = i;
    let endIdx = i;

    if (dir === 1) { // CHARGE TRACKER
      let peakIdx = i;
      let peakVal = s[i];
      let flatCount = 0;

      for (let j = i + 1; j < s.length; j++) {
        if (s[j] > peakVal) {
          peakVal = s[j];
          peakIdx = j;
          flatCount = 0;
        } else if (peakVal - s[j] > 1.2) {
          break; // Reversal
        } else {
          flatCount++;
          if (flatCount > plateauLimit) break; // Plateau reached
        }
      }
      endIdx = peakIdx;
    } else { // DISCHARGE TRACKER
      let troughIdx = i;
      let troughVal = s[i];
      let flatCount = 0;

      for (let j = i + 1; j < s.length; j++) {
        if (s[j] < troughVal) {
          troughVal = s[j];
          troughIdx = j;
          flatCount = 0;
        } else if (s[j] - troughVal > 1.2) {
          break; // Reversal
        } else {
          flatCount++;
          if (flatCount > plateauLimit) break; // Plateau reached
        }
      }
      endIdx = troughIdx;
    }

    const durMin = Math.round(((endIdx - startIdx) * resSec) / 60);
    const delta = soc[endIdx] - soc[startIdx];

    if (durMin >= minDurationMin && Math.abs(delta) >= minDeltaPct) {
      sessions.push({
        type: dir === 1 ? 'charge' : 'discharge',
        startIdx: startIdx,
        endIdx: endIdx,
        startVal: soc[startIdx],
        endVal: soc[endIdx],
        delta: delta,
        durMin: durMin
      });
      i = Math.max(i + 1, endIdx);
    } else {
      i++;
    }
  }

  console.log('🔋 Battery sessions detected:', sessions.length, sessions);
  return sessions;
}
window.detectBatterySessions = detectBatterySessions;


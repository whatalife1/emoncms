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

// ─── Stat line formatter ────────────────────────────────────────────────────
function _fmtKwh(v) { return v >= 1 ? v.toFixed(1) : (v >= 0.01 ? v.toFixed(2) : v.toFixed(3)); }

function _formatStatLine(icon, label, mainVal, accentColor, peakVal, avgVal, dayAvgVal, dayTotalVal, nightAvgVal, nightTotalVal, unit, isKwh, currentTab, isCompact = false) {
  const lblLower = (label || '').toLowerCase();
  const isTemp = lblLower.includes('temp') || unit === '°C';
  const isWater = lblLower.includes('water') || lblLower.includes('tank') || unit === '%';
  const isVolts = lblLower.includes('volt') || unit === 'V';
  const isNonEnergy = isTemp || isWater || isVolts;

  // Only energy feeds become kWh in Month/Year
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
    const dKwhDisp = (dayTotalVal && !isNonEnergy) ? _fmtKwh(dayTotalVal) + ' kWh ' : '';
    const dAvgUnit = isNonEnergy ? unit : (isDay ? 'W' : 'kWh/d');
    dayHtml = `<span style="color:var(--accent-solar); ${boldStyle}">Day: ${dKwhDisp}(Avg: ${dayAvgDisp} ${dAvgUnit})</span>`;
  }

  let nightHtml = '';
  if (!hideNight && ((nightAvgVal && nightAvgVal > 0.01) || (nightTotalVal && nightTotalVal > 0.01))) {
    const nightAvgDisp = (isDay && !isNonEnergy) ? Math.round(nightAvgVal) : nightAvgVal.toFixed(1);
    const nKwhDisp = (nightTotalVal && !isNonEnergy) ? _fmtKwh(nightTotalVal) + ' kWh ' : '';
    const nAvgUnit = isNonEnergy ? unit : (isDay ? 'W' : 'kWh/d');
    nightHtml = `<span style="color:#c084fc; ${boldStyle}">Night: ${nKwhDisp}(Avg: ${nightAvgDisp} ${nAvgUnit})</span>`;
  }

  let dayNightRow = '';
  if (dayHtml || nightHtml) {
    dayNightRow = `<div style="margin-top:2px; display:flex; gap:8px;">${dayHtml}${nightHtml}</div>`;
  }

  const mainDisplay = isKwh ? `${_fmtKwh(mainVal)} kWh` : `${mainVal.toFixed(1)} ${unit}`;
  const peakDisp = isNonEnergy ? peakVal.toFixed(1) : (isDay ? Math.round(peakVal).toLocaleString() : peakVal.toFixed(1));

  return `<div style="margin-bottom: 6px; line-height:1.2;"><div style="display:flex; align-items:center; gap:6px;"><span style="color:${accentColor}; font-size:${fsLabel}; font-weight:700;">${icon ? icon + ' ' : ''}${label}:</span><span style="color:var(--text-main); font-size:${fsMain}; font-weight:900;">${mainDisplay}</span></div><div style="color:var(--text-muted); font-size:11px; font-weight:600; margin-left: 1px; margin-top: 2px;"><div>(${peakLabel}: <span style="color:${peakColor}; ${boldStyle}">${peakDisp}</span> ${unit}${avgHtml})</div>${dayNightRow}</div></div>`;
}

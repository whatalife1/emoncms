// js/19b2-graphs-ui-nav.js
// ─── Navigation info & nav bar rendering ────────────────────────────────────

function _gNavInfo() {
  const now = getPktNow();
  if (graphTab === 'day') {
    let baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() < window.graphDayStartHour) {
      baseDate.setDate(baseDate.getDate() - 1);
    }
    const d = new Date(baseDate);
    d.setDate(d.getDate() + graphDateNav);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    let startMs = getPktDayStart(year, month, day);
    startMs += window.graphDayStartHour * 3600 * 1000;
    const res = (graphChartType === 'hourly') ? 3600 : GRAPH_DAY_RESOLUTION_SECONDS;
    const totalPoints = Math.ceil((24 * 3600) / res);
    const labels = [];
    const fullLabels = [];
    for (let i = 0; i < totalPoints; i++) {
      const currentTs = startMs + i * res * 1000;
      const pktDate = getKarachiDate(currentTs);
      const h = pktDate.hour;
      const m = Math.floor((currentTs / 60000)) % 60;
      const ampm = h >= 12 ? 'pm' : 'am';
      const hh = h % 12 || 12;
      const mm = String(m).padStart(2, '0');
      labels.push(`${hh}${ampm}`);
      fullLabels.push(`${hh}:${mm}${ampm}`);
    }
    let labelText = '';
    if (graphDateNav === 0) labelText = 'Today';
    else if (graphDateNav === -1) labelText = 'Yesterday';
    else if (graphDateNav === 1) labelText = 'Tomorrow';
    else labelText = d.toLocaleDateString('en-PK', { weekday:'short', day:'numeric', month:'short' });
    return {
      label: labelText,
      sub: `${day} ${_MONTH_NAMES[month-1]} ${year}`,
      interval: res,
      startMs,
      endMs: startMs + 24 * 3600 * 1000 - 1,
      isDayTab: true,
      nBars: totalPoints,
      labels,
      timeLabels: fullLabels,
      fullLabels,
      resSeconds: res
    };
  }
  if (graphTab === 'month') {
    let base = new Date(now.getFullYear(), now.getMonth() + graphMonthNav, 1);
    let sM = base.getMonth() - 1; let sY = base.getFullYear(); if (sM < 0) { sM = 11; sY--; }
    const start = new Date(sY, sM, 25);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
    const days = Math.ceil((end - start) / 86400000);
    const labels = [];
    const timeLabels = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i*86400000);
      const pktDate = getKarachiDate(d.getTime());
      labels.push(`${pktDate.day}/${pktDate.month}`);
      timeLabels.push(`${pktDate.day}/${pktDate.month}`);
    }
    return {
      label: `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`,
      interval: GRAPH_MONTH_RESOLUTION_SECONDS,
      isDayTab: false,
      nBars: days,
      startMs: start.getTime(),
      endMs: end.getTime(),
      labels,
      timeLabels,
      month: start.getMonth(),
      year: start.getFullYear(),
      isMonthBilling: true,
      resSeconds: GRAPH_MONTH_RESOLUTION_SECONDS
    };
  }
  if (graphTab === 'year') {
    const y = now.getFullYear() + graphYearNav;
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31, 23, 59, 59);
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if ((y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)) {
      daysInMonth[1] = 29;
    }
    return {
      label: `${y}`,
      interval: GRAPH_YEAR_RESOLUTION_SECONDS,
      isYearly: true,
      nBars: 12,
      startMs: start.getTime(),
      endMs: end.getTime(),
      labels,
      timeLabels,
      daysInMonth: daysInMonth,
      year: y,
      isYearBilling: true,
      resSeconds: GRAPH_YEAR_RESOLUTION_SECONDS,
      isYearView: true
    };
  }
  return { label:'All Time', startMs: new Date(2024,0,1).getTime(), endMs: now.getTime(), labels:[], timeLabels:[] };
}
window._gNavInfo = _gNavInfo;

function _renderGNavBar() {
  const wrap = document.getElementById('graph-nav-bar');
  if (!wrap || graphTab === 'total') return;
  const nav = _gNavInfo();
  const canFwd = (graphTab === 'day' && graphDateNav < 0) ||
                 (graphTab === 'month' && nav.endMs < Date.now()) ||
                 (graphTab === 'year' && graphYearNav < 0);
  let dateStr = '';
  if (graphTab === 'day') {
    const d = new Date(getPktNow().getTime());
    d.setDate(d.getDate() + graphDateNav);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;
  }
  let rightControls = '';
  if (graphTab === 'day') {
    rightControls = `
      <input type="date" id="graph-date-picker" value="${dateStr}"
        style="background:var(--input-bg);border:1px solid var(--border);border-radius:6px;
        color:var(--text-main);padding:3px 6px;font-size:12px;width:auto;max-width:130px;
        cursor:pointer;margin-left:4px;">
      <button id="graph-today-btn" class="graph-nav-btn" style="font-size:10px;padding:2px 8px;margin-left:4px;">Today</button>
    `;
  }
  const startToggle = graphTab === 'day'
    ? `<button id="graph-start-toggle" class="graph-nav-btn" style="font-size:10px; padding:2px 8px; margin-left:4px;">${
        window.graphDayStartHour === 5 ? '5am-5am' : '12am-12am'
      }</button>`
    : '';
  wrap.innerHTML = `
    <button class="graph-nav-btn" id="gnav-prev">‹</button>
    <div class="graph-nav-center" style="flex:1;text-align:center;">
      <div class="graph-nav-label">${nav.label}</div>
      ${nav.sub ? `<div class="graph-nav-sub">${nav.sub}</div>` : ''}
    </div>
    <div style="display:flex;align-items:center;gap:2px;flex-shrink:0;">
      ${startToggle}
      ${rightControls}
      <button class="graph-nav-btn" id="gnav-next" style="opacity:${canFwd ? 1 : 0.3};margin-left:4px;">›</button>
    </div>
  `;
  document.getElementById('gnav-prev').addEventListener('click', () => {
    if (graphTab === 'day') graphDateNav--;
    else if (graphTab === 'month') graphMonthNav--;
    else graphYearNav--;
    graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
    _renderGNavBar();
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  });
  document.getElementById('gnav-next').addEventListener('click', () => {
    if (canFwd) {
      if (graphTab === 'day') graphDateNav++;
      else if (graphTab === 'month') graphMonthNav++;
      else graphYearNav++;
      graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
      _renderGNavBar();
      if (typeof _loadAndDraw === 'function') _loadAndDraw();
    }
  });
  const toggleBtn = document.getElementById('graph-start-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleGraphStartHour(); });
  }
  const datePicker = document.getElementById('graph-date-picker');
  if (datePicker) {
    datePicker.addEventListener('change', function() {
      const [y, m, d] = this.value.split('-').map(Number);
      const targetMs = Date.UTC(y, m - 1, d);
      const pktDate = getKarachiDate(Date.now());
      const todayMs = Date.UTC(pktDate.year, pktDate.month - 1, pktDate.day);
      graphDateNav = Math.round((targetMs - todayMs) / 86400000);
      graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
      _renderGNavBar();
      if (typeof _loadAndDraw === 'function') _loadAndDraw();
    });
  }
  const todayBtn = document.getElementById('graph-today-btn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      graphDateNav = 0; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
      _renderGNavBar();
      if (typeof _loadAndDraw === 'function') _loadAndDraw();
    });
  }
}
window._renderGNavBar = _renderGNavBar;

function countNightHours(startMs, endMs) {
  let count = 0;
  const step = 3600 * 1000;
  for (let t = startMs; t < endMs; t += step) {
    const d = new Date(t);
    const h = d.getHours();
    if (h >= 17 || h < 8) count++;
  }
  return count;
}

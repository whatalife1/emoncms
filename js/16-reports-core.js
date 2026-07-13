const EXPORT_FEEDS = [
  { id: FEEDS_BASE.find(f => f.name === "Solar")?.id,       name: "Solar",        isSolar:   true },
  { id: FEEDS_BASE.find(f => f.name === "Breaker")?.id,     name: "Breaker",      isBreaker: true },
  { id: FEEDS_BASE.find(f => f.name === "Kenwood 1Ton")?.id, name: "Kenwood 1Ton" },
  { id: FEEDS_BASE.find(f => f.name === "Kenwood 1.5Ton")?.id, name: "Kenwood 1.5T" },
  { id: FEEDS_BASE.find(f => f.name === "Haier 1Ton")?.id,   name: "Haier 1Ton" },
  { id: FEEDS_BASE.find(f => f.name === "Fridge")?.id,      name: "Fridge 1" },
  { id: FEEDS_BASE.find(f => f.name === "Fridge2")?.id,     name: "Fridge 2" },
  { id: FEEDS_BASE.find(f => f.name === "PC")?.id,          name: "PC",           isPc: true },
  { id: FEEDS_BASE.find(f => f.name === "Water Motor")?.id, name: "Motor" }
].filter(f => f.id); 

const EXPORT_DAY_START   = 8;
const EXPORT_DAY_END     = 17;
const EXPORT_NIGHT_START = 17;
const EXPORT_NIGHT_END   = 8;
const EXPORT_PC_DAY_START = 6;
const EXPORT_PC_DAY_END   = 17;

function getKarachiDate(ms) {
    // Determine if device is native GMT+5
    const isPkt = (new Date().getTimezoneOffset() === -300);
    const d = isPkt ? new Date(ms) : new Date(ms + 18000000);
    
    return {
        year: isPkt ? d.getFullYear() : d.getUTCFullYear(),
        month: (isPkt ? d.getMonth() : d.getUTCMonth()) + 1,
        day: isPkt ? d.getDate() : d.getUTCDate(),
        hour: isPkt ? d.getHours() : d.getUTCHours()
    };
}

function billingRangeFor(year, month) {
    // Always calculate using UTC and offset to ensure stability
    const start = new Date(Date.UTC(year, month - 2, 25, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, 26, 0, 0, 0));
    return { 
        startMs: start.getTime() - 18000000, 
        endMs: end.getTime() - 18000000 
    };
}

function currentHourMs() {
    const now = getPktNow();
    now.setMinutes(0, 0, 0);
    return now.getTime() + 3600 * 1000;
}

let reportCache = {};
function loadReportCache() {
  try {
    const json = localStorage.getItem('report_cache');
    reportCache = json ? JSON.parse(json) : {};
  } catch (e) { reportCache = {}; }
}

function saveReportCache() {
  try { localStorage.setItem('report_cache', JSON.stringify(reportCache)); } catch (e) {}
}

async function fetchWithCache(feedId, startMs, endMs) {
  if (!reportCache[feedId]) reportCache[feedId] = {};
  const feedCache = reportCache[feedId];
  
  const timestamps = Object.keys(feedCache).map(Number).sort((a,b)=>a-b);
  const startExists = timestamps.length > 0 && timestamps[0] <= startMs + 3600000;
  
  let fetchStartMs = startMs;
  if (startExists) {
    const safeThresholdMs = endMs - (3 * 3600 * 1000);
    let maxSafe = -1;
    for (const ts of timestamps) {
      if (ts >= startMs && ts < safeThresholdMs && ts > maxSafe) maxSafe = ts;
    }
    if (maxSafe !== -1) fetchStartMs = maxSafe;
  }

  if (fetchStartMs < endMs - 60000) {
    const freshData = await fetchHourly(feedId, fetchStartMs, endMs);
    for (const [ts, val] of Object.entries(freshData)) feedCache[ts] = val;
    // Removed saveReportCache() from here to speed up parallel fetches
  }
  
  const result = {};
  for (const [tsStr, val] of Object.entries(feedCache)) {
    const ts = parseInt(tsStr);
    if (ts >= startMs && ts <= endMs) result[ts] = val;
  }
  return result;
}

async function fetchHourly(feedId, startMs, endMs) {
  const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=0&interval=3600`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return {};
    return parseHourlyData(text);
  } catch (e) { return {}; }
}

function parseHourlyData(json) {
  const result = {};
  if (!json || json === 'false' || json === 'null') return result;
  try {
    const root = JSON.parse(json);
    if (!Array.isArray(root) || root.length === 0) return result;
    let data = (typeof root[0] === 'object' && root[0] !== null && root[0].data) ? root[0].data : root;
    for (const point of data) {
      if (!Array.isArray(point) || point.length < 2 || point[1] === null) continue;
      result[point[0]] = parseFloat(point[1]);
    }
  } catch (e) {}
  return result;
}

function sumByDay(data, startHour, endHour) {
  const result = {};
  const allDay = startHour === 0 && endHour === 24;
  const wrapsMidnight = startHour > endHour;
  for (const [timestampStr, watts] of Object.entries(data)) {
    const timestamp = parseInt(timestampStr);
    const local = getKarachiDate(timestamp);
    const hour = local.hour;
    const inPeriod = allDay || (wrapsMidnight ? (hour >= startHour || hour < endHour) : (hour >= startHour && hour < endHour));
    if (!inPeriod) continue;
    
    const key = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
    result[key] = (result[key] || 0) + watts;
  }
  return result;
}

function fmtKwh(wh) {
  const val = wh / 1000.0;
  return val < 0.005 ? "-" : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPkr(pkr) {
  return pkr < 1.0 ? "-" : Math.round(pkr).toLocaleString('en-US');
}

function splitCell(units, pkr) {
  if (units === "-" && pkr === "-") return "-";
  return `<div class='cell-split'><span class='cell-left'>${units}</span><span class='cell-slash'>/</span><span class='cell-right'>${pkr}</span></div>`;
}

function formatHeaderSplitCell(leftLabel, rightLabel) {
  return `<div class='cell-split' style='color:var(--text-muted);font-size:11px;font-weight:normal;margin-top:6px; font-family: system-ui, sans-serif;'><span class='cell-left'>${leftLabel}</span><span class='cell-slash'>/</span><span class='cell-right'>${rightLabel}</span></div>`;
}

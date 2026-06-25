// Map feeds from Config so IDs are always in sync
const EXPORT_FEEDS = [
  { id: FEEDS_BASE.find(f => f.name === "Solar")?.id,       name: "Solar",        isSolar:   true },
  { id: FEEDS_BASE.find(f => f.name === "Breaker")?.id,     name: "Breaker",      isBreaker: true },
  { id: FEEDS_BASE.find(f => f.name === "Kenwood 1Ton")?.id, name: "Kenwood 1Ton" },
  { id: FEEDS_BASE.find(f => f.name === "Kenwood 1.5Ton")?.id, name: "Kenwood 1.5T" },
  { id: FEEDS_BASE.find(f => f.name === "Haier 1Ton")?.id,   name: "Haier 1Ton" },
  { id: FEEDS_BASE.find(f => f.name === "Fridge")?.id,      name: "Fridge 1" },
  { id: FEEDS_BASE.find(f => f.name === "Fridge2")?.id,     name: "Fridge 2" },
  { id: FEEDS_BASE.find(f => f.name === "PC")?.id,          name: "PC",           isPc: true }
].filter(f => f.id); 

const EXPORT_DAY_START   = 7;
const EXPORT_DAY_END     = 16;
const EXPORT_NIGHT_START = 16;
const EXPORT_NIGHT_END   = 7;
const EXPORT_PC_DAY_START = 6;
const EXPORT_PC_DAY_END   = 17;

function getKarachiDate(ms) {
  const date = new Date(ms);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) map[part.type] = part.value;
  return {
    year: parseInt(map.year) || date.getUTCFullYear(),
    month: parseInt(map.month) || (date.getUTCMonth() + 1),
    day: parseInt(map.day) || date.getUTCDate(),
    hour: parseInt(map.hour) || date.getUTCHours()
  };
}

function billingRangeFor(year, month) {
  const endLocal = new Date(Date.UTC(year, month - 1, 26, 0, 0, 0));
  const endMs = endLocal.getTime() - 5 * 3600 * 1000;
  const startLocal = new Date(Date.UTC(year, month - 2, 25, 0, 0, 0));
  const startMs = startLocal.getTime() - 5 * 3600 * 1000;
  return { startMs, endMs };
}

function currentHourMs() {
  const now = new Date();
  const local = getKarachiDate(now.getTime());
  const truncatedUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, 0, 0);
  const truncatedMs = truncatedUtc - 5 * 3600 * 1000;
  return truncatedMs + 3600 * 1000;
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
  const safeThresholdMs = endMs - (3 * 3600 * 1000);
  let fetchStartMs = startMs;
  if (!reportCache[feedId]) reportCache[feedId] = {};
  const feedCache = reportCache[feedId];
  let maxSafe = -1;
  for (const tsStr of Object.keys(feedCache)) {
    const ts = parseInt(tsStr);
    if (ts >= startMs && ts < safeThresholdMs && ts > maxSafe) maxSafe = ts;
  }
  if (maxSafe !== -1) fetchStartMs = maxSafe;
  const freshData = await fetchHourly(feedId, fetchStartMs, endMs);
  for (const [ts, val] of Object.entries(freshData)) feedCache[ts] = val;
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
    let effectiveYear = local.year, effectiveMonth = local.month, effectiveDay = local.day;
    if (wrapsMidnight && hour < endHour) {
      const d = new Date(timestamp);
      const prev = new Date(d.getTime() - 24 * 3600 * 1000);
      const prevLocal = getKarachiDate(prev.getTime());
      effectiveYear = prevLocal.year; effectiveMonth = prevLocal.month; effectiveDay = prevLocal.day;
    }
    const key = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;
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
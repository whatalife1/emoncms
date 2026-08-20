const EXPORT_FEEDS = [
  { id: FEEDS_BASE.find(f => f.name === "Solar")?.id,       name: "Solar",        isSolar:   true },
  { id: FEEDS_BASE.find(f => f.name === "Breaker")?.id,     name: "Breaker",      isBreaker: true },
  { id: FEEDS_BASE.find(f => f.name === "Kenwood 1Ton")?.id, name: "Kenwood 1Ton" },
  { id: FEEDS_BASE.find(f => f.name === "Kenwood 1.5Ton")?.id, name: "Kenwood 1.5T" },
  { id: FEEDS_BASE.find(f => f.name === "Haier 1Ton")?.id,   name: "Haier 1Ton" },
  { id: FEEDS_BASE.find(f => f.name === "Fridge")?.id,      name: "Fridge 1" },
  { id: FEEDS_BASE.find(f => f.name === "Fridge2")?.id,     name: "Fridge 2" },
  { id: FEEDS_BASE.find(f => f.name === "PC")?.id,          name: "PC",           isPc: true },
  { id: FEEDS_BASE.find(f => f.name === "Water Motor")?.id, name: "Motor" },
  { id: FEEDS_BASE.find(f => f.name === "Washing Machine")?.id, name: "Washing Machine" }
].filter(f => f.id); 

const EXPORT_DAY_START   = 8;
const EXPORT_DAY_END     = 17;
const EXPORT_NIGHT_START = 17;
const EXPORT_NIGHT_END   = 8;
const EXPORT_PC_DAY_START = 6;
const EXPORT_PC_DAY_END   = 17;

function getKarachiDate(ms) {
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
    const start = new Date(Date.UTC(year, month - 2, 25, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, 26, 0, 0, 0));
    return { 
        startMs: start.getTime() - 18000000, 
        endMs: end.getTime() - 18000000 
    };
}

function currentHourMs() {
    const pktDate = getKarachiDate(Date.now());
    const startMs = getPktDayStart(pktDate.year, pktDate.month, pktDate.day);
    return startMs + (pktDate.hour + 1) * 3600 * 1000;
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

window._acDayOutageCache = window._acDayOutageCache || {};
try {
  const cachedAc = localStorage.getItem('ac_outage_cache');
  if (cachedAc) Object.assign(window._acDayOutageCache, JSON.parse(cachedAc));
} catch(e) {}

function saveAcOutageCache() {
  try {
    localStorage.setItem('ac_outage_cache', JSON.stringify(window._acDayOutageCache));
  } catch(e) {}
}

function clearReportCache() {
  reportCache = {};
  localStorage.removeItem('report_cache');
  window._acDayOutageCache = {};
  localStorage.removeItem('ac_outage_cache');
  if (window.addDebugLog) window.addDebugLog(`<b style="color:#10b981">Cache Cleared:</b> Report & Outage caches wiped.`);
}

async function fetchWithCache(feedId, startMs, endMs, forceRefresh = false) {
  if (forceRefresh) {
    delete reportCache[feedId];
  }

  if (!reportCache[feedId]) reportCache[feedId] = {};
  const feedCache = reportCache[feedId];
  
  const timestamps = Object.keys(feedCache).map(Number).sort((a,b)=>a-b);
  
  let fetchStartMs = startMs;
  if (!forceRefresh && timestamps.length > 0 && timestamps[0] <= startMs + 3600000) {
    const safeThresholdMs = endMs - (3 * 3600 * 1000);
    let maxSafe = -1;
    for (const ts of timestamps) {
      if (ts >= startMs && ts < safeThresholdMs && ts > maxSafe) maxSafe = ts;
    }
    if (maxSafe !== -1) fetchStartMs = maxSafe;
  }

  if (forceRefresh || fetchStartMs < endMs - 60000) {
    const fetchFrom = forceRefresh ? startMs : fetchStartMs;
    const freshData = await fetchHourly(feedId, fetchFrom, endMs);
    
    for (const [ts, val] of Object.entries(freshData)) {
      feedCache[ts] = val;
    }
    saveReportCache();
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

// ─── Shared Accurate AC Volts Outage / Breakdown Engine ───────────────────────
async function fetchAcBreakdown(startMs, endMs) {
  const feed = FEEDS_BASE.find(f => f.name === 'AC Volts');
  const feedId = feed ? feed.id : '499383';
  const nowMs = Date.now();
  const days = Math.max(1, Math.ceil((endMs - startMs) / 86400000));

  const dayPromises = [];
  for (let i = 0; i < days; i++) {
    const dayStart = startMs + i * 86400000;
    if (dayStart > nowMs) break;
    const dayEnd = Math.min(nowMs, dayStart + 86400000 - 1);
    const p = getKarachiDate(dayStart);
    const dayKey = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
    const dayLabel = `${p.day} ${_MONTH_SHORT[p.month - 1] || ''}`;
    const isPastDay = (dayEnd < nowMs - 3600000);

    if (isPastDay && window._acDayOutageCache[dayKey]) {
      dayPromises.push(Promise.resolve(window._acDayOutageCache[dayKey]));
    } else {
      const prm = (async () => {
        const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${dayStart}&end=${dayEnd}&skipmissing=0&average=1&delta=0&interval=120`;
        try {
          const text = await nativeFetch(url);
          if (!text || text.startsWith('ERROR')) return { dayKey, dayLabel, offMinutes: 0, count: 0 };
          const root = JSON.parse(text);
          const data = root[0]?.data || (Array.isArray(root) ? root : []);

          let offSec = 0;
          let count = 0;
          let inOutage = false;
          const stepSec = 120;

          for (let k = 0; k < data.length; k++) {
            const pt = data[k];
            if (!pt || pt[0] == null) continue;
            const v = (pt[1] !== null && pt[1] !== undefined) ? parseFloat(pt[1]) : 0;
            const isOff = v < 50;

            if (isOff) {
              offSec += stepSec;
              if (!inOutage) {
                inOutage = true;
                count++;
              }
            } else {
              inOutage = false;
            }
          }

          const resObj = {
            dayKey,
            dayLabel,
            offMinutes: Math.round(offSec / 60),
            count
          };

          if (isPastDay) {
            window._acDayOutageCache[dayKey] = resObj;
            saveAcOutageCache();
          }
          return resObj;
        } catch (e) {
          return { dayKey, dayLabel, offMinutes: 0, count: 0 };
        }
      })();
      dayPromises.push(prm);
    }
  }

  const results = await Promise.all(dayPromises);
  let totalMinutes = 0;
  let totalCount = 0;
  const dailyBreakdown = [];
  const dailyMap = {};

  for (const d of results) {
    totalMinutes += d.offMinutes;
    totalCount += d.count;
    dailyMap[d.dayKey] = d;
    if (d.offMinutes > 0) {
      dailyBreakdown.push(d);
    }
  }

  dailyBreakdown.sort((a, b) => b.dayKey.localeCompare(a.dayKey));

  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const formattedDuration = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  const numDays = Math.max(1, days);
  const avgMinPerDay = Math.round(totalMinutes / numDays);
  const avgHrs = Math.floor(avgMinPerDay / 60);
  const avgMins = avgMinPerDay % 60;
  const avgPerDayFormatted = avgHrs > 0 ? `${avgHrs}h ${avgMins}m / day` : `${avgMins}m / day`;

  return {
    totalMinutes,
    totalHours: (totalMinutes / 60).toFixed(1),
    formattedDuration,
    outageCount: totalCount,
    dailyBreakdown,
    dailyMap,
    avgPerDayFormatted,
    numDays
  };
}

window.fetchAcBreakdown = fetchAcBreakdown;

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

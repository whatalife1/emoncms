// ─── Appliance & Grid "unexpectedly off / loadshedding" detection ───────────

const APPLIANCE_MONITOR_LIST = [
  { name: 'AC Volts',       label: '⚡ Grid Power (Loadshedding)', minActiveW: 100, offThresholdW: 20, offMinutes: 10, isVolts: true },
  { name: 'Fridge',         label: 'Fridge 1',        minActiveW: 40,  offThresholdW: 28, offMinutes: 20 },
  { name: 'Fridge2',        label: 'Fridge 2',        minActiveW: 40,  offThresholdW: 28, offMinutes: 20 },
  { name: 'Kenwood 1.5Ton', label: 'Kenwood 1.5T',     minActiveW: 100, offThresholdW: 30, offMinutes: 60 },
  { name: 'Kenwood 1Ton',   label: 'Kenwood 1T',       minActiveW: 100, offThresholdW: 30, offMinutes: 60 },
  { name: 'Haier 1Ton',     label: 'Haier 1T',         minActiveW: 100, offThresholdW: 30, offMinutes: 60 },
  { name: 'PC',             label: 'PC',               minActiveW: 30,  offThresholdW: 15, offMinutes: 45 },
  { name: 'Water Motor',    label: 'Water Motor',      minActiveW: 100, offThresholdW: 20, offMinutes: 30 }
];

// History buffers keyed by appliance name: {t, v}
window.applianceHistory = window.applianceHistory || {};

const APPLIANCE_HISTORY_HOURS = 5;
const APPLIANCE_HISTORY_MS = APPLIANCE_HISTORY_HOURS * 3600 * 1000;

// Map appliance name -> feed id (from FEEDS_BASE) for historical fetches
function _applianceFeedId(name) {
  const f = FEEDS_BASE.find(f => f.name === name);
  return f ? f.id : null;
}

async function _fetchApplianceHistory(name, nowMs) {
  const feedId = _applianceFeedId(name);
  if (!feedId) return [];
  const startMs = nowMs - APPLIANCE_HISTORY_MS;
  
  const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${nowMs}&skipmissing=0&average=1&delta=0&interval=120`;
  
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return [];
    
    let parsed;
    try { parsed = JSON.parse(text); } catch(e) { return []; }
    
    // Robust multi-format EmonCMS response parser
    let dataPts = [];
    if (Array.isArray(parsed)) {
      dataPts = parsed[0]?.data || parsed;
    } else if (parsed && typeof parsed === 'object') {
      dataPts = parsed.data || Object.values(parsed)[0] || [];
    }
    
    if (!Array.isArray(dataPts)) return [];
    
    const out = [];
    dataPts.forEach(pt => {
      if (pt && pt[0] !== undefined && pt[0] !== null) {
        const tMs = pt[0] < 2000000000 ? pt[0] * 1000 : pt[0];
        const rawV = pt[1];
        const v = (rawV === null || rawV === undefined || isNaN(rawV)) ? 0 : parseFloat(rawV);
        out.push({ t: tMs, v: v });
      }
    });
    return out.sort((a, b) => a.t - b.t);
  } catch (e) {
    console.warn('Appliance history fetch warning:', name, e);
    return [];
  }
}

async function checkApplianceOffline(nowSec, forceSimulation = false) {
  const nowMs = nowSec * 1000;
  const isSimulation = forceSimulation || window.isSimulating || Math.abs(nowMs - Date.now()) > 120000;

  const results = [];

  for (const item of APPLIANCE_MONITOR_LIST) {
    let hist = window.applianceHistory[item.name] || [];

    if (isSimulation) {
      // Always fetch fresh historical data in simulation mode
      hist = await _fetchApplianceHistory(item.name, nowMs);
    } else {
      // Live mode: push current reading if available
      const liveEntry = window.lastResultsMap?.get(item.name);
      const liveVal = liveEntry?.value;
      if (liveVal != null && !isNaN(liveVal)) {
        if (hist.length === 0 || (nowMs - hist[hist.length - 1].t) > 10000) {
          hist.push({ t: nowMs, v: liveVal });
        }
      }
      const oldest = hist[0];
      if (!oldest || (nowMs - oldest.t) < APPLIANCE_HISTORY_MS - (20 * 60 * 1000) || hist.length < 5) {
        const fetched = await _fetchApplianceHistory(item.name, nowMs);
        if (fetched.length > 0) {
          const merged = [...fetched, ...hist];
          const uniqueMap = new Map();
          merged.forEach(p => uniqueMap.set(p.t, p.v));
          hist = Array.from(uniqueMap.entries())
            .map(([t, v]) => ({ t, v }))
            .sort((a, b) => a.t - b.t);
        }
      }
      hist = hist.filter(p => (nowMs - p.t) <= APPLIANCE_HISTORY_MS);
      window.applianceHistory[item.name] = hist;
    }

    if (!hist || hist.length < 5) continue;

    const offThreshold = item.offThresholdW !== undefined ? item.offThresholdW : (item.minActiveW * 0.5);
    const sorted = hist.slice().sort((a, b) => b.t - a.t); // Newest first

    let offSinceMs = null;
    let firstOffPointMs = null;
    let sawActivityBeforeOff = false;

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      if (pt.t > nowMs) continue;

      if (pt.v <= offThreshold) {
        firstOffPointMs = pt.t; // Track earliest continuous idle/off timestamp
      } else if (pt.v >= item.minActiveW) {
        sawActivityBeforeOff = true;
        offSinceMs = firstOffPointMs ? firstOffPointMs : pt.t;
        break;
      }
    }

    // Support prolonged outages where the entire 5-hour window is <= offThreshold
    if (!sawActivityBeforeOff && hist.length >= 5) {
      const allOff = hist.every(p => p.v <= offThreshold);
      if (allOff) {
        sawActivityBeforeOff = true;
        offSinceMs = hist[0].t; // Oldest point in history
      }
    }

    if (offSinceMs === null || !sawActivityBeforeOff) continue;

    const offDurationMin = (nowMs - offSinceMs) / 60000;
    if (offDurationMin >= item.offMinutes) {
      results.push({
        name: item.name,
        label: item.label,
        offDurationMin: Math.round(offDurationMin),
        offSinceStr: formatPktTime(offSinceMs, 'time')
      });
    }
  }

  window.applianceOfflineDetected = results;
  return results;
}

// ─── Appliance "unexpectedly off" detection ────────────────────────────────
// Flags an appliance that was drawing meaningful power and then dropped to
// ~0W and STAYED there for longer than its own normal off-cycle would
// suggest. This is NOT meant to flag normal thermostat cycling (fridges,
// ACs turning off for 10-20 min routinely) - only sustained, abnormal
// silence after a period of active use.

const APPLIANCE_MONITOR_LIST = [
  { name: 'Fridge',         label: 'Fridge 1',        minActiveW: 15, offMinutes: 90  },
  { name: 'Fridge2',        label: 'Fridge 2',        minActiveW: 15, offMinutes: 90  },
  { name: 'Kenwood 1.5Ton', label: 'Kenwood 1.5T',     minActiveW: 100, offMinutes: 60 },
  { name: 'Kenwood 1Ton',   label: 'Kenwood 1T',       minActiveW: 100, offMinutes: 60 },
  { name: 'Haier 1Ton',     label: 'Haier 1T',         minActiveW: 100, offMinutes: 60 },
  { name: 'PC',             label: 'PC',               minActiveW: 20, offMinutes: 45  },
  { name: 'Water Motor',    label: 'Water Motor',      minActiveW: 50, offMinutes: 30  }
];

// History buffers keyed by appliance name, same shape as tankHistory: {t, v}
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
    const parsed = JSON.parse(text);
    const dataPts = parsed[0]?.data || (Array.isArray(parsed) ? parsed : []);
    if (!Array.isArray(dataPts)) return [];
    const out = [];
    dataPts.forEach(pt => {
      if (pt && pt[0] && pt[1] !== null && !isNaN(pt[1])) {
        const tMs = pt[0] < 2000000000 ? pt[0] * 1000 : pt[0];
        out.push({ t: tMs, v: parseFloat(pt[1]) });
      }
    });
    return out.sort((a, b) => a.t - b.t);
  } catch (e) {
    console.warn('Appliance history fetch warning:', name, e);
    return [];
  }
}

async function checkApplianceOffline(nowSec) {
  const nowMs = nowSec * 1000;
  const isSimulation = Math.abs(nowMs - Date.now()) > 120000;

  const results = [];

  for (const item of APPLIANCE_MONITOR_LIST) {
    let hist = window.applianceHistory[item.name] || [];

    if (isSimulation) {
      // Always fetch fresh historical data in simulation mode
      hist = await _fetchApplianceHistory(item.name, nowMs);
    } else {
      // Live mode: push current reading if available, then top up if sparse
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

    if (hist.length < 5) continue;

    // Find the most recent contiguous run of "off" (below minActiveW),
    // and check whether it was preceded by genuine activity.
    const offThreshold = item.minActiveW * 0.3; // hysteresis: must drop well below active level

    // Walk backwards from "now" to find how long it's been continuously low.
    const sorted = hist.slice().sort((a, b) => b.t - a.t); // newest first
    let offSinceMs = null;
    let sawActivityBeforeOff = false;

    for (let i = 0; i < sorted.length; i++) {
      const pt = sorted[i];
      if (pt.t > nowMs) continue;
      if (pt.v <= offThreshold) {
        offSinceMs = pt.t;
      } else if (pt.v >= item.minActiveW) {
        sawActivityBeforeOff = true;
        break;
      } else {
        // ambiguous mid-range reading; keep scanning but don't reset offSinceMs
      }
    }

    if (offSinceMs === null || !sawActivityBeforeOff) continue; // never was active, or never went off

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

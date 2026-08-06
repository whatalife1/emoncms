// ─── Appliance & Grid "unexpectedly off / loadshedding" detection ───────────

const APPLIANCE_MONITOR_LIST = [
  { name: 'AC Volts',       label: '⚡ Grid Power (Loadshedding)', minActiveW: 100, offThresholdW: 20, offMinutes: 10, isVolts: true },
  { name: 'Breaker',        label: 'Grid Power',                   minActiveW: 50,  offThresholdW: 5,  offMinutes: 10 },
  { name: 'Fridge',         label: 'Fridge 1',                     minActiveW: 40,  offThresholdW: 28, offMinutes: 20 },
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

async function checkApplianceOffline(nowSec, byName = null) {
  const nowMs = nowSec * 1000;
  const STALE_MS = 5 * 60 * 1000; // 5 minutes
  const results = [];

  for (const item of APPLIANCE_MONITOR_LIST) {
    let status = null; // 'stale' or 'zeroW'
    let offDurationMin = 0;
    let offSinceMs = null;

    // Use byName if available
    if (byName) {
      const feed = byName.get(item.name);
      if (feed && feed.time !== null && feed.time !== undefined) {
        const ageMs = nowMs - (feed.time * 1000);
        if (ageMs >= STALE_MS) {
          // Stale feed
          status = 'stale';
          offSinceMs = feed.time * 1000;
          offDurationMin = (nowMs - offSinceMs) / 60000;
        } else {
          // Fresh feed – check if value is low for a long time
          const val = feed.value;
          const offThreshold = item.offThresholdW !== undefined ? item.offThresholdW : (item.minActiveW * 0.5);
          if (val !== null && val <= offThreshold) {
            // Check history to see how long it's been low
            let hist = window.applianceHistory[item.name] || [];
            // If history has recent points, check the last N minutes
            // Simple: if the value has been low for > offMinutes, mark as zeroW.
            // We'll look at the historical data.
            if (hist.length > 0) {
              // Sort by time descending
              const sorted = hist.slice().sort((a, b) => b.t - a.t);
              // Count consecutive low points at the end
              let lowDuration = 0;
              let lastLowTime = null;
              let firstLowTime = null;
              for (const pt of sorted) {
                if (pt.t > nowMs) continue;
                if (pt.v <= offThreshold) {
                  if (lastLowTime === null) {
                    lastLowTime = pt.t;
                  }
                  firstLowTime = pt.t;
                } else {
                  break; // found a high value, stop
                }
              }
              if (firstLowTime !== null && lastLowTime !== null) {
                const durationMs = lastLowTime - firstLowTime;
                // Also ensure the most recent point is recent (within 5 min)
                const latest = sorted[0];
                if (latest && (nowMs - latest.t) < STALE_MS && durationMs > item.offMinutes * 60 * 1000) {
                  status = 'zeroW';
                  offSinceMs = firstLowTime;
                  offDurationMin = durationMs / 60000;
                }
              }
            }
          }
        }
      } else {
        // Feed missing – treat as stale
        status = 'stale';
        offSinceMs = nowMs;
        offDurationMin = 0;
      }
    } else {
      // Fallback: original logic (skip for now, but keep it)
      // ... (we'll leave the original fallback but we can simplify by not using it)
    }

    if (status) {
      results.push({
        name: item.name,
        label: item.label,
        type: status,
        offDurationMin: Math.round(offDurationMin),
        offSinceStr: formatPktTime(offSinceMs || nowMs, 'time')
      });
    }
  }

  window.applianceOfflineDetected = results;
  return results;
}

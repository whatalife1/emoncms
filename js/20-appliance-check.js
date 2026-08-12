// ─── Appliance & Grid "unexpectedly off / loadshedding" detection ───────────

const APPLIANCE_MONITOR_LIST = [
  { name: 'AC Volts',       label: '⚡ Grid Power (Loadshedding)', minActiveW: 100, offThresholdW: 5, offMinutes: 10, isVolts: true },
  { name: 'Breaker',        label: 'Grid Power',                   minActiveW: 50,  offThresholdW: 5, offMinutes: 10 },
  { name: 'Fridge',         label: 'Fridge 1',                     minActiveW: 40,  offThresholdW: 5, offMinutes: 20 },
  { name: 'Fridge2',        label: 'Fridge 2',                     minActiveW: 40,  offThresholdW: 5, offMinutes: 20 },
  { name: 'Kenwood 1.5Ton', label: 'Kenwood 1.5T',                 minActiveW: 100, offThresholdW: 30, offMinutes: 60 },
  { name: 'Kenwood 1Ton',   label: 'Kenwood 1T',                   minActiveW: 100, offThresholdW: 30, offMinutes: 60 },
  { name: 'Haier 1Ton',     label: 'Haier 1T',                     minActiveW: 100, offThresholdW: 30, offMinutes: 60 },
  { name: 'PC',             label: 'PC',                           minActiveW: 30,  offThresholdW: 15, offMinutes: 45 },
  { name: 'Water Motor',    label: 'Water Motor',                  minActiveW: 100, offThresholdW: 20, offMinutes: 30 },
    { name: 'Washing Machine', label: 'W/M',                      minActiveW: 50,  offThresholdW: 10, offMinutes: 30 }
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
    const STALE_MS = 5 * 60 * 1000; // 5 minutes without an update = offline
    const isSimulation = byName === true;

    if (!isSimulation && (!byName || typeof byName.get !== 'function')) {
        window.applianceOfflineDetected = [];
        return [];
    }

    const tasks = APPLIANCE_MONITOR_LIST.map(async (item) => {
        if (typeof userOrderedFeeds !== 'undefined' && Array.isArray(userOrderedFeeds) && userOrderedFeeds.length > 0) {
            const cfg = userOrderedFeeds.find(f => f.name === item.name);
            if (!cfg || cfg.enabled === false) return null;
        }

        const offThreshold = item.offThresholdW !== undefined
            ? item.offThresholdW
            : (item.minActiveW * 0.5);
        const offMs = (item.offMinutes || 20) * 60 * 1000;
        const storageKey = 'appliance_last_active_' + item.name;

        let status = null;
        let offSinceMs = null;

        if (isSimulation) {
            // ── Simulator mode: evaluate purely from historical data ──
            const hist = await _fetchApplianceHistory(item.name, nowMs);

            let latest = null;
            for (let i = hist.length - 1; i >= 0; i--) {
                if (hist[i].t <= nowMs) {
                    latest = hist[i];
                    break;
                }
            }

            if (!latest) return null;

            if ((nowMs - latest.t) >= STALE_MS) {
                status = 'stale';
                offSinceMs = latest.t;
            } else if (latest.v <= offThreshold) {
                let lastRun = null;
                for (let i = hist.length - 1; i >= 0; i--) {
                    if (hist[i].t <= nowMs && hist[i].v > offThreshold) {
                        lastRun = hist[i].t;
                        break;
                    }
                }
                
                // Find first time below threshold after lastRun
                let firstDropBelow = null;
                if (lastRun !== null) {
                    for (let i = 0; i < hist.length; i++) {
                        if (hist[i].t > lastRun && hist[i].t <= nowMs && hist[i].v <= offThreshold) {
                            firstDropBelow = hist[i].t;
                            break;
                        }
                    }
                }
                const offStart = firstDropBelow || lastRun || nowMs;

                if (lastRun !== null && (nowMs - lastRun) >= offMs) {
                    status = 'zeroW';
                    offSinceMs = offStart; // Use the time it actually dropped, not the last active time
                }
            }
        } else {
            // ── Live mode ──
            let val = null;
            let feedTimeMs = null;

            const feed = byName.get(item.name);
            if (feed) {
                val = feed.value;
                feedTimeMs = feed.time
                    ? (feed.time < 2000000000 ? feed.time * 1000 : feed.time)
                    : null;
            }

            if (val === null || val === undefined) {
                status = 'stale';
                offSinceMs = feedTimeMs || nowMs;
            } else {
                const ageMs = feedTimeMs ? (nowMs - feedTimeMs) : Infinity;

                if (ageMs >= STALE_MS) {
                    status = 'stale';
                    offSinceMs = feedTimeMs || nowMs;
                } else if (val > offThreshold) {
                    // Appliance is running: remember this moment and clear any previous offline marker
                    try {
                        localStorage.setItem(storageKey, nowMs.toString());
                        localStorage.removeItem(storageKey + '_offline_since');
                    } catch (e) {}
                } else {
                    // Value is low → ALWAYS recalculate from recent history so duration is accurate
                    const hist = await _fetchApplianceHistory(item.name, nowMs);

                    // Most recent time the appliance was clearly running
                    let lastRun = null;
                    for (let i = hist.length - 1; i >= 0; i--) {
                        if (hist[i].t <= nowMs && hist[i].v > offThreshold) {
                            lastRun = hist[i].t;
                            break;
                        }
                    }

                    // First sample after lastRun that dropped ≤ threshold (true start of this low period)
                    let firstDropBelow = null;
                    if (lastRun !== null) {
                        for (let i = 0; i < hist.length; i++) {
                            if (hist[i].t > lastRun && hist[i].t <= nowMs && hist[i].v <= offThreshold) {
                                firstDropBelow = hist[i].t;
                                break;
                            }
                        }
                    }

                    const lastActive = lastRun !== null ? lastRun : nowMs;
                    const offlineSince = firstDropBelow || lastActive || nowMs;

                    // Keep localStorage in sync for future polls
                    try {
                        localStorage.setItem(storageKey, lastActive.toString());
                        localStorage.setItem(storageKey + '_offline_since', offlineSince.toString());
                    } catch (e) {}

                    if ((nowMs - lastActive) >= offMs) {
                        status = 'zeroW';
                        offSinceMs = offlineSince;   // real start of the current low period
                    }
                }
            }
        }

        if (!status) return null;

        return {
            name: item.name,
            label: item.label,
            type: status,
            offDurationMin: Math.round((nowMs - (offSinceMs || nowMs)) / 60000),
            offSinceStr: formatPktTime(offSinceMs || nowMs, 'time')
        };
    });

    const settled = await Promise.all(tasks);
    const results = settled.filter(Boolean);

    window.applianceOfflineDetected = results;
    return results;
}
// js/19c2-graphs-data-utils.js
// ─── Data fetching & transformation utilities ───────────────────────────────

function _mergePointsSum(ptsArrays) {
  const byTs = new Map();
  for (const pts of ptsArrays) {
    if (!Array.isArray(pts)) continue;
    for (const p of pts) {
      if (!p || p[1] == null || isNaN(p[1])) continue;
      const ts = p[0];
      byTs.set(ts, (byTs.get(ts) || 0) + p[1]);
    }
  }
  return Array.from(byTs.entries())
    .map(([ts, v]) => [ts, v])
    .sort((a, b) => a[0] - b[0]);
}

function _pointsToBars(pts, nav, feedKey) {
  const isAvg = feedKey && (
    feedKey.startsWith('temp') ||
    feedKey.startsWith('humidity') ||
    feedKey === 'invtemp' ||
    feedKey === 'water' ||
    feedKey === 'acvolts' ||
    feedKey === 'solarv' ||
    feedKey === 'solv'
  );

  if (nav && nav.isMonthBilling) {
    const days = Math.ceil((nav.endMs - nav.startMs) / 86400000);
    if (!pts || !pts.length) {
      if (!nav.labels || !nav.labels.length) {
        const start = new Date(nav.startMs);
        const labels = [];
        for (let i = 0; i < days; i++) {
          const d = new Date(start.getTime() + i * 86400000);
          const pktDate = getKarachiDate(d.getTime());
          labels.push(`${pktDate.day}/${pktDate.month}`);
        }
        nav.labels = labels;
        nav.timeLabels = labels;
        nav.fullLabels = labels;
      }
      nav.nBars = days;
      return Array(days).fill(0);
    }

    const daily = {};
    const counts = {};

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[1] == null) continue;
      const pktDate = getKarachiDate(p[0]);
      const key = `${pktDate.year}-${String(pktDate.month).padStart(2,'0')}-${String(pktDate.day).padStart(2,'0')}`;
      const v = parseFloat(p[1]);

      if (isAvg) {
        if (feedKey === 'acvolts') {
          if (v >= 50) {
            daily[key] = (daily[key] || 0) + v;
            counts[key] = (counts[key] || 0) + 1;
          }
        } else {
          daily[key] = (daily[key] || 0) + v;
          counts[key] = (counts[key] || 0) + 1;
        }
      } else {
        // Hourly watts * 1 hr = Watt-hours (Wh)
        daily[key] = (daily[key] || 0) + v;
      }
    }

    const start = new Date(nav.startMs);
    const bars = [], labels = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const pktDate = getKarachiDate(d.getTime());
      labels.push(`${pktDate.day}/${pktDate.month}`);
      const key = `${pktDate.year}-${String(pktDate.month).padStart(2,'0')}-${String(pktDate.day).padStart(2,'0')}`;
      
      if (isAvg) {
        const cnt = counts[key] || 0;
        bars.push(cnt > 0 ? (daily[key] / cnt) : 0);
      } else {
        // Convert daily Wh to kWh (e.g. 4237 Wh -> 4.237 kWh)
        const dayWh = daily[key] || 0;
        bars.push(dayWh / 1000);
      }
    }

    nav.labels = labels;
    nav.timeLabels = labels;
    nav.fullLabels = labels;
    nav.nBars = bars.length;
    return bars;
  }

  if (nav && nav.isYearBilling) {
    if (!pts || !pts.length) {
      nav.nBars = 12;
      return Array(12).fill(0);
    }
    const monthly = new Array(12).fill(0);
    const mCounts = new Array(12).fill(0);

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[1] == null) continue;
      const pktDate = getKarachiDate(p[0]);
      const month = pktDate.month - 1;
      const v = parseFloat(p[1]);

      if (isAvg) {
        if (feedKey === 'acvolts') {
          if (v >= 50) {
            monthly[month] += v;
            mCounts[month]++;
          }
        } else {
          monthly[month] += v;
          mCounts[month]++;
        }
      } else {
        // Hourly watts * 1 hr / 1000 = kWh
        monthly[month] = (monthly[month] || 0) + (v / 1000);
      }
    }

    nav.nBars = 12;
    if (isAvg) {
      return monthly.map((v, i) => mCounts[i] > 0 ? v / mCounts[i] : 0);
    }
    return monthly;
  }

  const numBars = (nav && nav.nBars) ? nav.nBars : (pts && pts.length ? pts.length : 720);
  if (!pts || !pts.length) {
    return Array(numBars).fill(0);
  }

  const bars = Array(numBars).fill(0), counts = Array(numBars).fill(0);
  const resMs = (nav && nav.resSeconds ? nav.resSeconds : 120) * 1000;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    let idx;
    if (nav.isDayTab) {
      idx = Math.floor((p[0] - nav.startMs) / resMs);
    } else {
      const pktDate = getKarachiDate(p[0]);
      idx = nav.isYearly ? (pktDate.month - 1) : (pktDate.day - 1);
    }
    if (idx >= 0 && idx < bars.length) {
      bars[idx] += isAvg ? p[1] : (p[1] * (nav.isDayTab ? 1 : (nav.interval/3600/1000)));
      counts[idx]++;
    }
  }
  return isAvg ? bars.map((v, i) => counts[i] > 0 ? v / counts[i] : 0) : bars;
}

async function _gFetch(feedId, startMs, endMs, interval) {
  if (!feedId) return [];
  const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=0&interval=${interval}`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return [];
    const root = JSON.parse(text);
    const data = root[0]?.data || root;
    return data.filter(p => p && p[1] != null);
  } catch (e) { return []; }
}

function _calcStatsForRange(bars, startHour, endHour, nav, lastIdx) {
  if (!bars || bars.length === 0) return { avg: 0, activeAvg: 0, total: 0 };
  const isWrapping = startHour > endHour;
  let sum = 0, count = 0, activeCount = 0;
  for (let i = 0; i < Math.min(bars.length, lastIdx || bars.length); i++) {
    const val = bars[i];
    if (val == null || val === undefined) continue;
    const ts = nav.startMs + (i * nav.resSeconds * 1000);
    const isPkt = (new Date().getTimezoneOffset() === -300);
    const d = isPkt ? new Date(ts) : new Date(ts + 18000000);
    const h = isPkt ? (d.getHours() + d.getMinutes() / 60) : (d.getUTCHours() + d.getUTCMinutes() / 60);
    if (isWrapping ? (h >= startHour || h < endHour) : (h >= startHour && h < endHour)) {
      sum += val;
      count++;
      if (val > 10) activeCount++;
    }
  }
  const isKwhView = nav && (nav.isMonthBilling || nav.isYearly);
  let totalKwh = 0;
  if (isKwhView) {
    totalKwh = sum;
  } else {
    totalKwh = (sum * nav.resSeconds / 3600) / 1000;
  }
  return {
    avg: count > 0 ? sum / count : 0,
    activeAvg: activeCount > 0 ? sum / activeCount : (count > 0 ? sum / count : 0),
    total: totalKwh
  };
}

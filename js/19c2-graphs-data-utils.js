// js/19c2-graphs-data-utils.js
// ─── Data fetching & transformation utilities ───────────────────────────────

// Merge multiple raw point arrays by summing values at matching timestamps.
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
  if (!pts || !pts.length) return [];
  if (nav.isMonthBilling) {
    const daily = {};
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[1] == null) continue;
      const pktDate = getKarachiDate(p[0]);
      const key = `${pktDate.year}-${String(pktDate.month).padStart(2,'0')}-${String(pktDate.day).padStart(2,'0')}`;
      daily[key] = (daily[key] || 0) + p[1];
    }
    const start = new Date(nav.startMs);
    const days = Math.ceil((nav.endMs - nav.startMs) / 86400000);
    const bars = [], labels = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86400000);
      const pktDate = getKarachiDate(d.getTime());
      labels.push(`${pktDate.day}/${pktDate.month}`);
      const key = `${pktDate.year}-${String(pktDate.month).padStart(2,'0')}-${String(pktDate.day).padStart(2,'0')}`;
      bars.push(daily[key] || 0);
    }
    nav.labels = labels;
    nav.timeLabels = labels;
    nav.fullLabels = labels;
    nav.nBars = bars.length;
    return bars;
  }
  if (nav.isYearBilling) {
    const monthly = new Array(12).fill(0);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[1] == null) continue;
      const pktDate = getKarachiDate(p[0]);
      const month = pktDate.month - 1;
      monthly[month] = (monthly[month] || 0) + (p[1] / 1000);
    }
    nav.nBars = 12;
    return monthly;
  }
  const isAvg = feedKey && (
    feedKey.startsWith('temp') ||
    feedKey.startsWith('humidity') ||
    feedKey === 'invtemp' ||
    feedKey === 'water' ||
    feedKey === 'acvolts' ||
    feedKey === 'solarv' ||
    feedKey === 'solv'
  );
  const bars = Array(nav.nBars || 1).fill(0), counts = Array(nav.nBars || 1).fill(0);
  const resMs = nav.resSeconds * 1000;
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
  const useDelta = (window.graphTab === "month") ? 1 : 0;
  const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=${useDelta}&interval=${interval}`;
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

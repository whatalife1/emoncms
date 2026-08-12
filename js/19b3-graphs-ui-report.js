// js/19b3-graphs-ui-report.js
// ─── Graph report generation & download ─────────────────────────────────────

window.generateGraphReport = async function() {
  const nav = _gNavInfo();
  const isDay = graphTab === 'day';
  const isMonth = graphTab === 'month';
  const isYear = graphTab === 'year';
  const isAll = graphTab === 'total';
  let startMs, endMs, label;
  if (isAll) {
    startMs = new Date(2020, 0, 1).getTime();
    endMs = Date.now();
    label = 'All Time';
  } else {
    startMs = nav.startMs;
    endMs = nav.endMs;
    label = nav.label;
  }
  const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
    const data = await fetchWithCache(feed.id, startMs, endMs);
    return { feed, data };
  });
  const results = await Promise.all(fetchPromises);
  const sums = {};
  const hourlyData = {};
  results.forEach(r => {
    const fId = r.feed.id;
    const ds = r.feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
    const de = r.feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
    const dWh = {}, nWh = {}, h24 = {};
    const raw = r.data;
    for (const tsStr in raw) {
      const ts = parseInt(tsStr);
      const val = raw[tsStr];
      const p = getKarachiDate(ts);
      const dKey = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
      h24[dKey] = (h24[dKey] || 0) + val;
      if (p.hour >= ds && p.hour < de) dWh[dKey] = (dWh[dKey] || 0) + val;
      if (p.hour >= 17 || p.hour < 8) nWh[dKey] = (nWh[dKey] || 0) + val;
    }
    sums[fId] = { h24, day: dWh, night: nWh };
    hourlyData[fId] = raw;
  });
  const solarF = EXPORT_FEEDS.find(f => f.isSolar);
  const breakerF = EXPORT_FEEDS.find(f => f.isBreaker);
  const loadFeeds = EXPORT_FEEDS.filter(f => !f.isSolar && !f.isBreaker);
  let totalLoadKwh = 0, totalDayLoadKwh = 0, totalNightLoadKwh = 0;
  const rows = [];
  const computeFeedTotals = (feed) => {
    if (feed.id === 'others') return null;
    const totalWh = Object.values(sums[feed.id]?.h24 || {}).reduce((a,b)=>a+b, 0);
    const dayWh = Object.values(sums[feed.id]?.day || {}).reduce((a,b)=>a+b, 0);
    const nightWh = Object.values(sums[feed.id]?.night || {}).reduce((a,b)=>a+b, 0);
    return { totalKwh: totalWh/1000, dayKwh: dayWh/1000, nightKwh: nightWh/1000, totalWh, dayWh, nightWh };
  };
  for (const f of EXPORT_FEEDS) {
    const totals = computeFeedTotals(f);
    if (totals) {
      rows.push({ name: f.name, isSolar: f.isSolar, isBreaker: f.isBreaker, ...totals });
    }
  }
  const solarData = sums[solarF.id]?.h24 || {};
  const breakerData = sums[breakerF.id]?.h24 || {};
  const applianceData = {};
  loadFeeds.forEach(f => { applianceData[f.id] = sums[f.id]?.h24 || {}; });
  const allDays = new Set();
  Object.keys(solarData).forEach(d => allDays.add(d));
  Object.keys(breakerData).forEach(d => allDays.add(d));
  Object.values(applianceData).forEach(obj => Object.keys(obj).forEach(d => allDays.add(d)));
  const othersDaySum = {};
  const othersNightSum = {};
  for (const day of allDays) {
    const solarDayVal = (sums[solarF.id]?.day?.[day] || 0);
    const breakerDayVal = (sums[breakerF.id]?.day?.[day] || 0);
    let applianceDayVal = 0;
    for (const f of loadFeeds) { applianceDayVal += (sums[f.id]?.day?.[day] || 0); }
    const solarNightVal = (sums[solarF.id]?.night?.[day] || 0);
    const breakerNightVal = (sums[breakerF.id]?.night?.[day] || 0);
    let applianceNightVal = 0;
    for (const f of loadFeeds) { applianceNightVal += (sums[f.id]?.night?.[day] || 0); }
    const othersDayVal = Math.max(0, solarDayVal + breakerDayVal - applianceDayVal);
    const othersNightVal = Math.max(0, solarNightVal + breakerNightVal - applianceNightVal);
    if (othersDayVal > 0) othersDaySum[day] = othersDayVal;
    if (othersNightVal > 0) othersNightSum[day] = othersNightVal;
  }
  const totalOthersDayWh = Object.values(othersDaySum).reduce((a,b)=>a+b, 0);
  const totalOthersNightWh = Object.values(othersNightSum).reduce((a,b)=>a+b, 0);
  const totalOthersWh = totalOthersDayWh + totalOthersNightWh;
  rows.push({
    name: 'Others (Fans/Lights)', isSolar: false, isBreaker: false,
    totalKwh: totalOthersWh/1000, dayKwh: totalOthersDayWh/1000, nightKwh: totalOthersNightWh/1000,
    totalWh: totalOthersWh, dayWh: totalOthersDayWh, nightWh: totalOthersNightWh
  });
  let numDays = allDays.size || 1;
  if (isDay) numDays = 1;
  const totalNightHours = countNightHours(startMs, endMs);
  totalLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker).reduce((sum, r) => sum + r.totalKwh, 0);
  totalDayLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker).reduce((sum, r) => sum + r.dayKwh, 0);
  totalNightLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker).reduce((sum, r) => sum + r.nightKwh, 0);
  // Text report
  let txt = `📄 Energy Usage Report: ${label}\n`;
  txt += `Generated: ${new Date().toLocaleString()}\n`;
  txt += `Time Period Definitions:\n`;
  txt += `  • Day   = 8:00 AM  → 5:00 PM  (9 hours)\n`;
  txt += `  • Night = 5:00 PM  → 8:00 AM  (15 hours)\n`;
  txt += `  • Solar hours = 8:00 AM → 5:00 PM\n`;
  const colWidths = { name:22, total:12, day:10, night:10, avgNight:12, avgDay:10, dayPct:8, nightPct:8, dayShare:10, nightShare:10, totalPct:10 };
  const headerParts = [
    'Appliance'.padEnd(colWidths.name), 'Total (kWh)'.padStart(colWidths.total),
    'Day (kWh)'.padStart(colWidths.day), 'Night (kWh)'.padStart(colWidths.night),
    'Avg Night (W)'.padStart(colWidths.avgNight), 'Avg/Day'.padStart(colWidths.avgDay),
    'Day %'.padStart(colWidths.dayPct), 'Night %'.padStart(colWidths.nightPct),
    'Day Share'.padStart(colWidths.dayShare), 'Night Share'.padStart(colWidths.nightShare),
    '% of Total'.padStart(colWidths.totalPct)
  ];
  const header = headerParts.join(' ');
  txt += header + '\n';
  txt += '-'.repeat(header.length) + '\n';
  for (const row of rows) {
    const isSolar = row.isSolar; const isBreaker = row.isBreaker;
    const total = row.totalKwh;
    const day = isSolar ? 0 : row.dayKwh;
    const night = isSolar ? 0 : row.nightKwh;
    const avgNightW = isSolar ? 0 : (totalNightHours > 0 ? (row.nightWh / totalNightHours) : 0);
    const avgDay = total / numDays;
    const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
    const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
    let dayShare, nightShare;
    if (isBreaker || isSolar) { dayShare = '-'; nightShare = '-'; }
    else {
      dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
      nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);
    }
    const totalPct = (totalLoadKwh === 0) ? 0 : (total / totalLoadKwh * 100);
    const shortName = row.name.length > colWidths.name ? row.name.substring(0, colWidths.name-1) + '…' : row.name;
    const parts = [
      shortName.padEnd(colWidths.name),
      total.toFixed(2).padStart(colWidths.total),
      isSolar ? '-'.padStart(colWidths.day) : day.toFixed(2).padStart(colWidths.day),
      isSolar ? '-'.padStart(colWidths.night) : night.toFixed(2).padStart(colWidths.night),
      isSolar ? '-'.padStart(colWidths.avgNight) : (Math.round(avgNightW) + ' W').padStart(colWidths.avgNight),
      avgDay.toFixed(2).padStart(colWidths.avgDay),
      isSolar ? '-'.padStart(colWidths.dayPct) : dayPct.toFixed(1).padStart(colWidths.dayPct) + '%',
      isSolar ? '-'.padStart(colWidths.nightPct) : nightPct.toFixed(1).padStart(colWidths.nightPct) + '%',
      (isSolar || isBreaker) ? '-'.padStart(colWidths.dayShare) : (totalDayLoadKwh === 0 ? '-'.padStart(colWidths.dayShare) : dayShare.toFixed(1).padStart(colWidths.dayShare) + '%'),
      (isSolar || isBreaker) ? '-'.padStart(colWidths.nightShare) : (totalNightLoadKwh === 0 ? '-'.padStart(colWidths.nightShare) : nightShare.toFixed(1).padStart(colWidths.nightShare) + '%'),
      (totalLoadKwh === 0) ? '-'.padStart(colWidths.totalPct) : totalPct.toFixed(1).padStart(colWidths.totalPct) + '%'
    ];
    txt += parts.join(' ') + '\n';
  }
  // HTML report
  let html = `<div class="report-wrapper" style="background:#fff;color:#18181b;border:1px solid #d4d4d8;border-radius:10px;padding:10px;margin-top:20px;font-family:system-ui,sans-serif;">`;
  html += `<h4 style="margin:0 0 10px 0;font-size:14px;border-bottom:1px solid #d4d4d8;padding-bottom:5px;color:#18181b;">Consumption Breakdown</h4>`;
  html += `<div style="font-size:11px;color:#71717a;margin-bottom:12px;padding:8px 12px;background:#f4f4f5;border-radius:6px;border-left:3px solid #f59e0b;">`;
  html += `<span style="font-weight:700;">⏰ Time Periods:</span> `;
  html += `<span style="color:#f59e0b;">Day</span> = 8:00 AM → 5:00 PM (9 hrs) &nbsp;|&nbsp; `;
  html += `<span style="color:#c084fc;">Night</span> = 5:00 PM → 8:00 AM (15 hrs)`;
  html += `</div>`;
  html += `<div class="table-scroll" style="overflow-x:auto;max-width:100%;"><table style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace;min-width:900px;">`;
  html += `<tr style="background:#f4f4f5;border-bottom:2px solid #d4d4d8;">`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:left;">Appliance</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Total (kWh)</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day (kWh)</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night (kWh)</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg Night (W)</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg/Day</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day %</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night %</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day Share</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night Share</th>`;
  html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">% of Total</th>`;
  html += `</tr>`;
  for (const row of rows) {
    const isSolar = row.isSolar; const isBreaker = row.isBreaker;
    const total = row.totalKwh;
    const day = isSolar ? 0 : row.dayKwh;
    const night = isSolar ? 0 : row.nightKwh;
    const avgNightW = isSolar ? 0 : (totalNightHours > 0 ? (row.nightWh / totalNightHours) : 0);
    const avgDay = total / numDays;
    const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
    const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
    let dayShare, nightShare;
    if (isBreaker || isSolar) { dayShare = '-'; nightShare = '-'; }
    else {
      dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
      nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);
    }
    const totalPct = (totalLoadKwh === 0) ? 0 : (total / totalLoadKwh * 100);
    const color = isSolar ? '#f59e0b' : (isBreaker ? '#ef4444' : '#18181b');
    html += `<tr>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;font-weight:bold;color:${color};">${row.name}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${color};">${total.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#f59e0b'};">${isSolar?'-':day.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':night.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':Math.round(avgNightW)+' W'}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${avgDay.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#f59e0b'};">${isSolar?'-':dayPct.toFixed(1)+'%'}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':nightPct.toFixed(1)+'%'}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar||isBreaker?'#71717a':'#f59e0b'};">${(isSolar||isBreaker)?'-':(totalDayLoadKwh===0?'-':dayShare.toFixed(1)+'%')}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar||isBreaker?'#71717a':'#c084fc'};">${(isSolar||isBreaker)?'-':(totalNightLoadKwh===0?'-':nightShare.toFixed(1)+'%')}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${totalLoadKwh===0?'-':totalPct.toFixed(1)+'%'}</td>`;
    html += `</tr>`;
  }
  html += `<tr style="background:#f4f4f5;font-weight:bold;border-top:2px solid #d4d4d8;">`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;">TOTAL LOAD</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${totalLoadKwh.toFixed(2)}</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">${totalDayLoadKwh.toFixed(2)}</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">${totalNightLoadKwh.toFixed(2)}</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">-</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${(totalLoadKwh/numDays).toFixed(2)}</td>`;
  const dayPctTotal = totalLoadKwh === 0 ? 0 : (totalDayLoadKwh / totalLoadKwh * 100);
  const nightPctTotal = totalLoadKwh === 0 ? 0 : (totalNightLoadKwh / totalLoadKwh * 100);
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">${dayPctTotal.toFixed(1)}%</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">${nightPctTotal.toFixed(1)}%</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">100%</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">100%</td>`;
  html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">100%</td>`;
  html += `</tr>`;
  html += `</table></div></div>`;
  return { text: txt, html: html };
};

window.downloadDayGraphReport = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const pre = reportDiv.querySelector('pre');
  if (!pre) { alert('No report text available.'); return; }
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

window.downloadDayGraphReportPng = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const wrapper = reportDiv.querySelector('.report-wrapper');
  if (!wrapper) { alert('No report content to capture.'); return; }
  if (typeof html2canvas === 'undefined') { alert('html2canvas library not loaded.'); return; }
  const btn = document.getElementById('btn-graph-report-png');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  const clone = wrapper.cloneNode(true);
  function setOverflowVisible(el) {
    el.style.overflow = 'visible'; el.style.width = 'auto'; el.style.maxWidth = 'none'; el.style.minWidth = '100%';
    for (let child of el.children) { setOverflowVisible(child); }
  }
  setOverflowVisible(clone);
  const table = clone.querySelector('table');
  if (table) {
    table.style.width = 'auto'; table.style.minWidth = '100%'; table.style.whiteSpace = 'nowrap';
    table.style.borderCollapse = 'collapse';
    table.querySelectorAll('th, td').forEach(cell => {
      cell.style.border = '1px solid #999'; cell.style.padding = '6px 10px';
      cell.style.textAlign = 'right'; cell.style.backgroundColor = '#ffffff'; cell.style.color = '#18181b';
    });
    table.querySelectorAll('td:first-child, th:first-child').forEach(cell => {
      cell.style.textAlign = 'left'; cell.style.fontWeight = 'bold';
    });
    table.querySelectorAll('th').forEach(th => {
      th.style.backgroundColor = '#f0f0f0'; th.style.fontWeight = 'bold'; th.style.textAlign = 'center';
    });
  }
  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:10px;border-bottom:2px solid #ddd;padding-bottom:8px;background:#fff;';
  title.textContent = '📄 Energy Usage Report – ' + new Date().toLocaleDateString('en-PK', { year:'numeric', month:'long', day:'numeric' });
  clone.insertBefore(title, clone.firstChild);
  clone.style.cssText = `position:fixed;top:0;left:0;display:inline-block;background:#ffffff;padding:20px;z-index:-9999;opacity:1;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#18181b;overflow:visible;width:auto;height:auto;`;
  document.body.appendChild(clone);
  html2canvas(clone, { backgroundColor:'#ffffff', scale:2.5, useCORS:true, logging:false, width:clone.scrollWidth, height:clone.scrollHeight }).then(canvas => {
    const a = document.createElement('a');
    a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
  }).catch(err => {
    console.error('PNG capture error:', err);
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
    alert('Failed to capture PNG: ' + err.message);
  });
};

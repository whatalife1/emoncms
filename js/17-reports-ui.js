async function calculateDetailedReport() {
  const out = document.getElementById('usage-report-content');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Loading report... Fetching historical feed data...</div>';

  const month = parseInt(document.getElementById('report-month-m').value);
  const year = parseInt(document.getElementById('report-month-y').value);
  if (!month || !year) {
    out.innerHTML = '<div class="sol-loading" style="color:#f87171">Please select a valid month and year.</div>';
    return;
  }

  try {
    loadReportCache();
    const { startMs, endMs } = billingRangeFor(year, month);
    const effectiveEnd = Math.min(endMs, currentHourMs());
    
    const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
      const data = await fetchWithCache(feed.id, startMs, effectiveEnd);
      return { feed, data };
    });
    
    const results = await Promise.all(fetchPromises);
    saveReportCache();
    
    const feedData = {};
    results.forEach(r => {
      feedData[r.feed.id] = r.data;
    });
    window._lastReportData = feedData;
    
    const pkrRate = solarCfg?.pkrPerUnit ?? 60;
    renderDetailedReport(feedData, startMs, endMs, pkrRate);
    
  } catch (e) {
    out.innerHTML = `<div class="sol-loading" style="color:#f87171">Failed to calculate report: ${e.message}</div>`;
  }
}

function renderDetailedReport(feedData, startMs, endMs, pkrPerKwh) {
  const out = document.getElementById('usage-report-content');
  if (!out) return;

  const startLocal = getKarachiDate(startMs);
  const effectiveEndMs = Math.min(endMs, currentHourMs());
  const effEndLocal = getKarachiDate(effectiveEndMs);

  const dates = [];
  let cursor = new Date(startMs);
  let cursorLocal = getKarachiDate(cursor.getTime());
  let cursorDate = new Date(Date.UTC(cursorLocal.year, cursorLocal.month - 1, cursorLocal.day));
  const endDate = new Date(Date.UTC(effEndLocal.year, effEndLocal.month - 1, effEndLocal.day));
  
  while (cursorDate <= endDate) {
    const yr = cursorDate.getUTCFullYear();
    const mo = cursorDate.getUTCMonth() + 1;
    const dy = cursorDate.getUTCDate();
    dates.push(`${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`);
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
  }

  const sums = {};
  for (const feed of EXPORT_FEEDS) {
    const ds = feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
    const de = feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
    const data = feedData[feed.id] || {};
    sums[feed.id] = {
      h24: sumByDay(data, 0, 24),
      day: sumByDay(data, ds, de),
      night: sumByDay(data, EXPORT_NIGHT_START, EXPORT_NIGHT_END)
    };
  }

  const solarFeed = EXPORT_FEEDS.find(f => f.isSolar);
  const breakerFeed = EXPORT_FEEDS.find(f => f.isBreaker);

  const solarByDay = {};
  const gridByDay = {};
  dates.forEach(d => {
    solarByDay[d] = sums[solarFeed.id].h24[d] || 0;
    gridByDay[d] = sums[breakerFeed.id].h24[d] || 0;
  });

  let sumSolarWh = 0;
  let sumGridWh = 0;
  Object.values(solarByDay).forEach(v => sumSolarWh += v);
  Object.values(gridByDay).forEach(v => sumGridWh += v);

  const totalSolarKwh = sumSolarWh / 1000.0;
  const gridImportKwh = sumGridWh / 1000.0;
  const withoutSolarKwh = totalSolarKwh + gridImportKwh;
  const coveragePct = withoutSolarKwh > 0 ? (totalSolarKwh / withoutSolarKwh * 100) : 0;
  const daysInCycle = Math.round((endMs - startMs) / 86400000.0);
  const avgSolar = dates.length > 0 ? (totalSolarKwh / dates.length) : 0;
  const avgGrid = dates.length > 0 ? (gridImportKwh / dates.length) : 0;

  let headerHtml = '';
  headerHtml += '<tr class=h1><th rowspan=2>Date</th>';
  for (const feed of EXPORT_FEEDS) {
    headerHtml += feed.isSolar 
      ? `<th rowspan=2 class=dv>${feed.name}</th>` 
      : `<th colspan=3 class=dv>${feed.name}</th>`;
  }
  headerHtml += `<th rowspan=2 class=tot>Solar+Breaker<div class='head-split'>kWh / Rs</div></th>`;
  headerHtml += `<th rowspan=2 class=col-save>Solar Saved<div class='head-split'>kWh / Rs</div></th>`;
  headerHtml += `<th rowspan=2 class=col-bill>Grid Bill<div class='head-split'>kWh / Rs</div></th></tr><tr class=h2>`;

  for (const feed of EXPORT_FEEDS) {
    if (!feed.isSolar) {
      headerHtml += `<th class=c24>24hr</th><th class=cday>${feed.isPc ? "Day*" : "Day"}</th><th class='dv cnight'>Night</th>`;
    }
  }
  headerHtml += '</tr>';

  // --- Reversed Bottom Header ---
  let bottomHeaderHtml = '<tr class=h2><th></th>'; // Date space
  for (const feed of EXPORT_FEEDS) {
    if (feed.isSolar) bottomHeaderHtml += '<th class=dv></th>';
    else bottomHeaderHtml += `<th class=c24>24hr</th><th class=cday>${feed.isPc ? "Day*" : "Day"}</th><th class='dv cnight'>Night</th>`;
  }
  bottomHeaderHtml += '<th></th><th></th><th></th></tr>'; // Combined columns spaces
  
  bottomHeaderHtml += '<tr class=h1><th>Date</th>';
  for (const feed of EXPORT_FEEDS) {
    bottomHeaderHtml += feed.isSolar 
      ? `<th class=dv>${feed.name}</th>` 
      : `<th colspan=3 class=dv>${feed.name}</th>`;
  }
  bottomHeaderHtml += `<th>Solar+Breaker</th><th>Solar Saved</th><th>Grid Bill</th></tr>`;

  let tableRows = headerHtml;

  const totals24 = {};
  const totalsDay = {};
  const totalsNight = {};
  EXPORT_FEEDS.forEach(f => {
    totals24[f.id] = 0;
    totalsDay[f.id] = 0;
    totalsNight[f.id] = 0;
  });

  window._lastReportSums = sums;

  let grandSaveKwh = 0;
  let grandSavePkr = 0;
  let grandGridKwh = 0;
  let grandBillPkr = 0;

  for (const date of dates) {
    const parts = date.split('-');
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    tableRows += `<tr><td class=dt>${formattedDate}</td>`;
    
    let daySolarWh = 0;
    let dayBreakerWh = 0;
    
    for (const feed of EXPORT_FEEDS) {
      const s = sums[feed.id];
      const h24 = s.h24[date] || 0;
      const day = s.day[date] || 0;
      const night = s.night[date] || 0;
      
      totals24[feed.id] += h24;
      totalsDay[feed.id] += day;
      totalsNight[feed.id] += night;
      
      if (feed.isSolar) daySolarWh = h24;
      if (feed.isBreaker) dayBreakerWh = h24;
      
      if (feed.isSolar) {
        tableRows += `<td class='dv c24'>${fmtKwh(h24)}</td>`;
      } else {
        tableRows += `<td class=c24>${fmtKwh(h24)}</td><td class=cday>${fmtKwh(day)}</td><td class='dv cnight'>${fmtKwh(night)}</td>`;
      }
    }
    
    const saveKwh = daySolarWh / 1000.0;
    const billKwh = dayBreakerWh / 1000.0;
    const combinedKwh = (daySolarWh + dayBreakerWh) / 1000.0;
    const combinedPkr = combinedKwh * pkrPerKwh;
    
    grandSaveKwh += saveKwh;
    grandGridKwh += billKwh;
    grandSavePkr += saveKwh * pkrPerKwh;
    grandBillPkr += billKwh * pkrPerKwh;
    
    const combinedKwhStr = combinedKwh < 0.005 ? "-" : combinedKwh.toFixed(2);
    const saveKwhStr = saveKwh < 0.005 ? "-" : saveKwh.toFixed(2);
    const billKwhStr = billKwh < 0.005 ? "-" : billKwh.toFixed(2);
    
    tableRows += `<td class=tot>${splitCell(combinedKwhStr, fmtPkr(combinedPkr))}</td>`;
    tableRows += `<td class=col-save>${splitCell(saveKwhStr, fmtPkr(saveKwh * pkrPerKwh))}</td>`;
    tableRows += `<td class=col-bill>${splitCell(billKwhStr, fmtPkr(billKwh * pkrPerKwh))}</td></tr>`;
  }

  const numDays = dates.length || 1;

  // --- Daily Avg. Row ---
  tableRows += `<tr class=tr><td class=dt>Daily Avg.</td>`;
  for (const feed of EXPORT_FEEDS) {
    const a24 = totals24[feed.id] / numDays;
    const aDay = totalsDay[feed.id] / numDays;
    const aNight = totalsNight[feed.id] / numDays;
    if (feed.isSolar) {
      tableRows += `<td class='dv c24'>${fmtKwh(a24)}</td>`;
    } else {
      tableRows += `<td class=c24>${fmtKwh(a24)}</td><td class=cday>${fmtKwh(aDay)}</td><td class='dv cnight'>${fmtKwh(aNight)}</td>`;
    }
  }
  const avgCombinedKwh = (totals24[solarFeed.id] + totals24[breakerFeed.id]) / 1000.0 / numDays;
  const avgSaveKwh = grandSaveKwh / numDays;
  const avgGridKwh = grandGridKwh / numDays;
  tableRows += `<td class=tot>${splitCell(avgCombinedKwh.toFixed(2), fmtPkr(avgCombinedKwh * pkrPerKwh))}</td>`;
  tableRows += `<td class=col-save>${splitCell(avgSaveKwh.toFixed(2), fmtPkr(avgSaveKwh * pkrPerKwh))}</td>`;
  tableRows += `<td class=col-bill>${splitCell(avgGridKwh.toFixed(2), fmtPkr(avgGridKwh * pkrPerKwh))}</td></tr>`;

  // --- Total Row ---
  tableRows += `<tr class=tr><td class=dt>Total</td>`;
  for (const feed of EXPORT_FEEDS) {
    const t24 = totals24[feed.id];
    const tDay = totalsDay[feed.id];
    const tNight = totalsNight[feed.id];
    
    if (feed.isSolar) {
      tableRows += `<td class='dv c24'>${fmtKwh(t24)}</td>`;
    } else {
      tableRows += `<td class=c24>${fmtKwh(t24)}</td><td class=cday>${fmtKwh(tDay)}</td><td class='dv cnight'>${fmtKwh(tNight)}</td>`;
    }
  }

  const totalCombinedKwh = (totals24[solarFeed.id] + totals24[breakerFeed.id]) / 1000.0;
  const totalCombinedPkr = totalCombinedKwh * pkrPerKwh;
  tableRows += `<td class=tot>${splitCell(totalCombinedKwh.toFixed(2), fmtPkr(totalCombinedPkr))}</td>`;
  tableRows += `<td class=col-save>${splitCell(grandSaveKwh.toFixed(2), fmtPkr(grandSavePkr))}</td>`;
  tableRows += `<td class=col-bill>${splitCell(grandGridKwh.toFixed(2), fmtPkr(grandBillPkr))}</td></tr>`;

  // --- Repeated Header at bottom (Reversed) ---
  tableRows += bottomHeaderHtml;

  const maxSolarVal = Math.max(...Object.values(solarByDay).map(v => v / 1000.0), 1.0);
  let heatHtml = '';
  for (const date of dates) {
    const kwh = solarByDay[date] / 1000.0;
    const ratio = kwh / maxSolarVal;
    const hue = Math.round(120 - ratio * 90);
    const lum = Math.round(18 + ratio * 28);
    const bg = kwh < 0.01 ? "#1e1e1f" : `hsl(${hue},65%,${lum}%)`;
    const dayNum = parseInt(date.substring(8));
    heatHtml += `<div class=hc style='background:${bg}' title="${kwh.toFixed(2)} kWh">${dayNum}</div>`;
  }

  const dmy = d => `${String(d.day).padStart(2,'0')}-${String(d.month).padStart(2,'0')}-${d.year}`;
  const rangeStr = `${dmy(startLocal)} → ${dmy(getKarachiDate(endMs))}`;

  out.innerHTML = `
    <div class="report-wrapper">
      <h3>Energy Usage - ${rangeStr}</h3>
      <p class="sub-hours">Day = 7am-4pm &nbsp;|&nbsp; Night = 4pm-7am &nbsp;|&nbsp; * PC Day = 6am-5pm</p>
      
      <div class="pkr-card">
        <div class="pkr-title">PKR Financial Summary &nbsp;·&nbsp; Rate: PKR ${pkrPerKwh.toFixed(0)} / kWh</div>
        <div class="pkr-grid">
          <div class="pkr-item pkr-save">
            <div class="pkr-item-label">Solar savings</div>
            <div class="pkr-item-val">PKR ${fmtPkr(totalSolarKwh * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${totalSolarKwh.toFixed(1)} kWh generated by solar</div>
          </div>
          <div class="pkr-item pkr-bill">
            <div class="pkr-item-label">Est. grid bill</div>
            <div class="pkr-item-val">PKR ${fmtPkr(gridImportKwh * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${gridImportKwh.toFixed(1)} kWh from Breaker</div>
          </div>
          <div class="pkr-item pkr-without">
            <div class="pkr-item-label">Without solar</div>
            <div class="pkr-item-val">PKR ${fmtPkr(withoutSolarKwh * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${withoutSolarKwh.toFixed(1)} kWh total consumption</div>
          </div>
          <div class="pkr-item pkr-avg">
            <div class="pkr-item-label">Avg saving / day</div>
            <div class="pkr-item-val">PKR ${fmtPkr(avgSolar * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${avgSolar.toFixed(1)} kWh / day over ${dates.length} days</div>
          </div>
        </div>
        <div class="pkr-bar-wrap">
          <div class="pkr-bar-label">Solar covered</div>
          <div class="pkr-bar-track">
            <div class="pkr-bar-fill" style="width:${Math.min(100, coveragePct).toFixed(1)}%"></div>
          </div>
          <div class="pkr-bar-pct">${coveragePct.toFixed(0)}%</div>
        </div>
        
        <div class="pkr-proj-title">Full Cycle Estimates (Projected till 26th) &nbsp;·&nbsp; Cycle: ${daysInCycle.toFixed(0)} days (elapsed: ${dates.length})</div>
        <div class="pkr-proj-row">
          <div class="pkr-proj-col">
            <span class="pkr-proj-lbl">Est. Solar Gen</span>
            <span class="pkr-proj-val" style="color:#ca8a04">${(avgSolar * daysInCycle).toFixed(1)} kWh</span>
            <span class="pkr-proj-val" style="color:#ca8a04;margin-top:8px;font-size:12px">Value: PKR ${fmtPkr(avgSolar * daysInCycle * pkrPerKwh)}</span>
          </div>
          <div class="pkr-proj-col">
            <span class="pkr-proj-lbl">Est. Grid Import</span>
            <span class="pkr-proj-val" style="color:#B71C1C">${(avgGrid * daysInCycle).toFixed(1)} kWh</span>
            <span class="pkr-proj-val" style="color:#B71C1C;margin-top:8px;font-size:12px">Bill: PKR ${fmtPkr(avgGrid * daysInCycle * pkrPerKwh)}</span>
          </div>
        </div>
      </div>
      
      <h4>Solar yield heatmap (kWh/day)</h4>
      <div class="heat">${heatHtml}</div>
      
      <h4>Daily Detailed Consumption Log</h4>
      <div class="table-scroll">
        <table>${tableRows}</table>
      </div>
    </div>
  `;
}

async function downloadTextReport() {
    const content = document.getElementById('usage-report-content');
    if (!content || !window._lastReportSums) {
        alert("Please calculate the report first.");
        return;
    }

    const sums = window._lastReportSums;
    const month = document.getElementById('report-month-m').value;
    const year = document.getElementById('report-month-y').value;
    
    let txt = `Energy Usage Summary: ${month}/${year}\n`;
    txt += `Cycle: 25th to 26th\n`;
    txt += `------------------------------------------\n`;

    const getKwh = (id, type) => {
        const val = Object.values(sums[id][type] || {}).reduce((a, b) => a + b, 0);
        return Math.round(val / 1000);
    };

    const solarId = EXPORT_FEEDS.find(f => f.isSolar)?.id;
    const breakerId = EXPORT_FEEDS.find(f => f.isBreaker)?.id;

    const pad = 17;

    if (solarId) {
        txt += "Solar".padEnd(pad) + `${getKwh(solarId, 'h24')} units\n`;
    }
    if (breakerId) {
        txt += "Breaker".padEnd(pad) + `${getKwh(breakerId, 'h24')} units Total (${getKwh(breakerId, 'day')} units solar time)\n`;
    }

    EXPORT_FEEDS.forEach(f => {
        if (f.isSolar || f.isBreaker) return;
        const total = getKwh(f.id, 'h24');
        const day = getKwh(f.id, 'day');
        const wapda = Math.max(0, total - day);
        
        const col1 = f.name.padEnd(pad);
        const col2 = (total + " units Total").padEnd(24);
        const col3 = ("(" + day + " units solar)").padEnd(22);
        const col4 = String(wapda).padStart(4) + " units wapda";
        
        txt += `${col1}${col2}${col3}${col4}\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain' });
    const a = document.createElement('a');
    a.download = `Energy_Report_${month}_${year}.txt`;
    a.href = URL.createObjectURL(blob);
    a.click();
}

// ─── Main View Prediction Loop ──────────────────────────────────────────────
window.lastSolarActual = window.lastSolarActual || 0;

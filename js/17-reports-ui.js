function renderDetailedReport(feedData, startMs, endMs, pkrPerKwh) {
  const out = document.getElementById('usage-report-content');
  if (!out) return;

  const startLocal = getKarachiDate(startMs);
  const effectiveEndMs = Math.min(endMs, currentHourMs());
  const effEndLocal = getKarachiDate(effectiveEndMs);

  const dates = [];
  let cursorDate = new Date(Date.UTC(startLocal.year, startLocal.month - 1, startLocal.day));
  const endDate = new Date(Date.UTC(effEndLocal.year, effEndLocal.month - 1, effEndLocal.day));
  
  while (cursorDate <= endDate) {
    const yr = cursorDate.getUTCFullYear(), mo = cursorDate.getUTCMonth() + 1, dy = cursorDate.getUTCDate();
    dates.push(`${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`);
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
  }

  const sums = {};
  EXPORT_FEEDS.forEach(f => {
    const ds = f.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
    const de = f.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
    sums[f.id] = { h24: sumByDay(feedData[f.id]||{}, 0, 24), day: sumByDay(feedData[f.id]||{}, ds, de), night: sumByDay(feedData[f.id]||{}, EXPORT_NIGHT_START, EXPORT_NIGHT_END) };
  });

  const solarF = EXPORT_FEEDS.find(f => f.isSolar) || { id: '499380', name: 'Solar' };
  const breakerF = EXPORT_FEEDS.find(f => f.isBreaker) || { id: '499374', name: 'Breaker' };
  
  const colTotals = {};
  EXPORT_FEEDS.forEach(f => {
    colTotals[f.id] = { h24: 0, day: 0, night: 0 };
  });

  let sumSolarWh = 0, sumGridWh = 0;
  dates.forEach(d => { 
    sumSolarWh += (sums[solarF.id].h24[d]||0); 
    sumGridWh += (sums[breakerF.id].h24[d]||0); 
    EXPORT_FEEDS.forEach(f => {
      colTotals[f.id].h24 += (sums[f.id].h24[d] || 0);
      colTotals[f.id].day += (sums[f.id].day[d] || 0);
      colTotals[f.id].night += (sums[f.id].night[d] || 0);
    });
  });

  const totalSolarKwh = sumSolarWh / 1000.0, gridImportKwh = sumGridWh / 1000.0;
  const withoutSolarKwh = totalSolarKwh + gridImportKwh, coveragePct = withoutSolarKwh > 0 ? (totalSolarKwh / withoutSolarKwh * 100) : 0;
  const daysInCycle = Math.round((endMs - startMs) / 86400000.0);
  const avgSolar = totalSolarKwh / dates.length, avgGrid = gridImportKwh / dates.length;

  let headerHtml = `<tr class=h1><th rowspan=2>Date</th>`;
  EXPORT_FEEDS.forEach(f => headerHtml += f.isSolar ? `<th rowspan=2 class=dv>${f.name}</th>` : `<th colspan=3 class=dv>${f.name}</th>`);
  headerHtml += `<th rowspan=2 class=tot>Solar+Breaker<div class='head-split'>kWh / Rs</div></th><th rowspan=2 class=col-save>Solar Saved<div class='head-split'>kWh / Rs</div></th><th rowspan=2 class=col-bill>Grid Bill<div class='head-split'>kWh / Rs</div></th></tr><tr class=h2>`;
  EXPORT_FEEDS.forEach(f => { if (!f.isSolar) headerHtml += `<th class=c24>24hr</th><th class=cday>${f.isPc ? "Day*" : "Day"}</th><th class='dv cnight'>Night</th>`; });
  headerHtml += '</tr>';

  let tableRows = headerHtml;
  dates.forEach(date => {
    const fmtDate = date.split('-').reverse().join('-');
    tableRows += `<tr><td class=dt>${fmtDate}</td>`;
    let dSolarWh = (sums[solarF.id].h24[date]||0), dBreakerWh = (sums[breakerF.id].h24[date]||0);
    EXPORT_FEEDS.forEach(f => {
      const h24 = (sums[f.id].h24[date]||0), day = (sums[f.id].day[date]||0), night = (sums[f.id].night[date]||0);
      if (f.isSolar) tableRows += `<td class='dv c24'>${fmtKwh(h24)}</td>`;
      else tableRows += `<td class=c24>${fmtKwh(h24)}</td><td class=cday>${fmtKwh(day)}</td><td class='dv cnight'>${fmtKwh(night)}</td>`;
    });
    const saveKwh = dSolarWh / 1000.0, billKwh = dBreakerWh / 1000.0, combKwh = (dSolarWh + dBreakerWh) / 1000.0;
    tableRows += `<td class=tot>${splitCell(combKwh.toFixed(2), fmtPkr(combKwh * pkrPerKwh))}</td><td class=col-save>${splitCell(saveKwh.toFixed(2), fmtPkr(saveKwh * pkrPerKwh))}</td><td class=col-bill>${splitCell(billKwh.toFixed(2), fmtPkr(billKwh * pkrPerKwh))}</td></tr>`;
  });

  const dayCount = dates.length || 1;
  ['Daily Avg.', 'Total'].forEach(rowLabel => {
    const isAvg = rowLabel === 'Daily Avg.';
    const divisor = isAvg ? dayCount : 1;
    
    tableRows += `<tr class="tr"><td class="dt">${rowLabel}</td>`;
    
    const solKwh = (colTotals[solarF.id].h24 / 1000) / divisor;
    tableRows += `<td class="dv c24">${solKwh.toFixed(2)}</td>`;

    EXPORT_FEEDS.forEach(f => {
      if (f.isSolar) return;
      const h24 = (colTotals[f.id].h24 / 1000) / divisor;
      const day = (colTotals[f.id].day / 1000) / divisor;
      const night = (colTotals[f.id].night / 1000) / divisor;
      tableRows += `<td class="c24">${h24.toFixed(2)}</td><td class="cday">${day.toFixed(2)}</td><td class="dv cnight">${night.toFixed(2)}</td>`;
    });

    const finalSolarKwh = totalSolarKwh / divisor;
    const finalGridKwh = gridImportKwh / divisor;
    const finalCombKwh = finalSolarKwh + finalGridKwh;

    tableRows += `
      <td class="tot">${splitCell(finalCombKwh.toFixed(2), fmtPkr(finalCombKwh * pkrPerKwh))}</td>
      <td class="col-save">${splitCell(finalSolarKwh.toFixed(2), fmtPkr(finalSolarKwh * pkrPerKwh))}</td>
      <td class="col-bill">${splitCell(finalGridKwh.toFixed(2), fmtPkr(finalGridKwh * pkrPerKwh))}</td>
    </tr>`;
  });

  tableRows += `<tr class="h2"><td></td><td></td>`;
  EXPORT_FEEDS.forEach(f => { if (!f.isSolar) tableRows += `<td class="c24">24hr</td><td class="cday">Day</td><td class="dv cnight">Night</td>`; });
  tableRows += `<td></td><td></td><td></td></tr>`;
  
  tableRows += `<tr class="h1"><td class="dt">Date (PKT)</td><td class="dv">Solar</td>`;
  EXPORT_FEEDS.forEach(f => { if (!f.isSolar) tableRows += `<td colspan="3" class="dv">${f.name}</td>`; });
  tableRows += `<td class="tot">Solar+Breaker</td><td class="col-save">Solar Saved</td><td class="col-bill">Grid Bill</td></tr>`;

  const blocks = ['_', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  let sparkTxt = `
Visual Daily Summary (Scale: ${dates.length} days)
--------------------------------------------------------------------------------
`;
  EXPORT_FEEDS.forEach(f => {
      const dArr = dates.map(d => sums[f.id].h24[d] || 0);
      const maxVal = Math.max(...dArr, 0.001); 
      let spark = ''; 
      dArr.forEach(v => {
          const val = v || 0;
          const idx = Math.max(0, Math.min(8, Math.ceil((val / maxVal) * 8)));
          spark += blocks[idx] || '_';
      });
      sparkTxt += f.name.padEnd(16) + ` [${spark}] max: ${(maxVal/1000).toFixed(1)}kWh
`;
  });

  const avgSavingPkr = (totalSolarKwh * pkrPerKwh) / (dates.length || 1);
  const avgSolarPerDay = totalSolarKwh / (dates.length || 1);
  const projectedSolarKwh = avgSolarPerDay * daysInCycle;
  const projectedGridKwh = (gridImportKwh / (dates.length || 1)) * daysInCycle;

  const rangeStr = `${startLocal.day}/${startLocal.month} → 26/${effEndLocal.month}/${effEndLocal.year}`;
  out.innerHTML = `
    <div class="report-wrapper">
      <h3 style="margin-bottom:4px;">Energy Usage - ${rangeStr}</h3>
      <p class="sub-hours">Day = 8am-5pm | Night = 5pm-8am | * PC Day = 6am-5pm</p>
      <div class="pkr-card">
        <div class="pkr-title">PKR Financial Summary &nbsp;·&nbsp; Rate: PKR ${pkrPerKwh.toFixed(0)} / kWh</div>
        <div class="pkr-grid">
            <div class="pkr-item pkr-save"><div class="pkr-item-label">Solar savings</div><div class="pkr-item-val">PKR ${fmtPkr(totalSolarKwh * pkrPerKwh)}</div><div class="pkr-item-sub">${totalSolarKwh.toFixed(1)} kWh generated by solar</div></div>
            <div class="pkr-item pkr-bill"><div class="pkr-item-label">Est. grid bill</div><div class="pkr-item-val">PKR ${fmtPkr(gridImportKwh * pkrPerKwh)}</div><div class="pkr-item-sub">${gridImportKwh.toFixed(1)} kWh from Breaker</div></div>
            <div class="pkr-item pkr-without"><div class="pkr-item-label">Without solar</div><div class="pkr-item-val">PKR ${fmtPkr(withoutSolarKwh * pkrPerKwh)}</div><div class="pkr-item-sub">${withoutSolarKwh.toFixed(1)} kWh total consumption</div></div>
            <div class="pkr-item pkr-avg"><div class="pkr-item-label">Avg saving / day</div><div class="pkr-item-val">PKR ${fmtPkr(avgSavingPkr)}</div><div class="pkr-item-sub">${avgSolarPerDay.toFixed(1)} kWh / day over ${dates.length} days</div></div>
        </div>
        
        <div class="pkr-bar-wrap" style="margin-top: 16px;">
          <div class="pkr-bar-label">Solar covered</div>
          <div class="pkr-bar-track">
            <div class="pkr-bar-fill" style="width: ${coveragePct.toFixed(1)}%;"></div>
          </div>
          <div class="pkr-bar-pct">${coveragePct.toFixed(0)}%</div>
        </div>
        
        <div class="pkr-proj-title">Full Cycle Estimates (Projected till 26th) &nbsp;·&nbsp; Cycle: ${daysInCycle} days (elapsed: ${dates.length})</div>
        <div class="pkr-proj-row">
          <div class="pkr-proj-col">
            <span class="pkr-proj-lbl">Est. Solar Gen</span>
            <span class="pkr-proj-val" style="color: #d97706;">${projectedSolarKwh.toFixed(1)} kWh</span>
            <span class="pkr-proj-lbl" style="margin-top:4px; color: #d97706;">Value: PKR ${fmtPkr(projectedSolarKwh * pkrPerKwh)}</span>
          </div>
          <div class="pkr-proj-col">
            <span class="pkr-proj-lbl">Est. Grid Import</span>
            <span class="pkr-proj-val" style="color: #dc2626;">${projectedGridKwh.toFixed(1)} kWh</span>
            <span class="pkr-proj-lbl" style="margin-top:4px; color: #dc2626;">Bill: PKR ${fmtPkr(projectedGridKwh * pkrPerKwh)}</span>
          </div>
        </div>
      </div>
      <div class="table-scroll"><table>${tableRows}</table></div>
      <pre style="white-space:pre; margin:20px 0 0 0; font-family:monospace; border-top:1px dashed #d4d4d8; padding-top:20px; color:#71717a;">${sparkTxt}</pre>
    </div>`;
}

async function calculateDetailedReport(forceRefresh = false) {
  const out = document.getElementById('usage-report-content');
  if (out) out.innerHTML = '<div class="sol-loading">Fetching billing history...</div>';

  if (forceRefresh && typeof clearReportCache === 'function') {
    clearReportCache();
  }

  const m = parseInt(document.getElementById('report-month-m').value);
  const y = parseInt(document.getElementById('report-month-y').value);
  const { startMs, endMs } = billingRangeFor(y, m);
  const pkrRate = (typeof solarCfg !== 'undefined') ? solarCfg.pkrPerUnit : 60;

  const feedData = {};
  try {
    const promises = EXPORT_FEEDS.map(async (f) => {
      feedData[f.id] = await fetchWithCache(f.id, startMs, endMs, forceRefresh);
    });
    await Promise.all(promises);
    renderDetailedReport(feedData, startMs, endMs, pkrRate);
  } catch (e) {
    console.error("Report Calc Failed:", e);
    if (out) out.innerHTML = `<div class="sol-loading" style="color:#ef4444">Error: ${e.message}</div>`;
  }
}

function downloadTextReport() {
  const pre = document.querySelector('#usage-report-content pre');
  if (!pre) {
    alert('Calculate a report first.');
    return;
  }
  const content = pre.textContent;
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Usage_Report_${new Date().toISOString().split('T')[0]}_PKT.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
}
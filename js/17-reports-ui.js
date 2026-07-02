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

  const solarF = EXPORT_FEEDS.find(f => f.isSolar), breakerF = EXPORT_FEEDS.find(f => f.isBreaker);
  let sumSolarWh = 0, sumGridWh = 0;
  dates.forEach(d => { sumSolarWh += (sums[solarF.id].h24[d]||0); sumGridWh += (sums[breakerF.id].h24[d]||0); });

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

  // --- Visual Sparkline Report Section ---
  const blocks = ['_', '\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
  let sparkTxt = `\nVisual Daily Summary (Scale: ${dates.length} days)\n--------------------------------------------------------------------------------\n`;
  EXPORT_FEEDS.forEach(f => {
      const dArr = dates.map(d => sums[f.id].h24[d]);
      const maxVal = Math.max(...dArr, 1);
      let spark = ''; dArr.forEach(v => spark += blocks[Math.max(0, Math.min(8, Math.ceil((v/maxVal)*8)))]);
      sparkTxt += f.name.padEnd(16) + ` [${spark}] max: ${(maxVal/1000).toFixed(1)}kWh\n`;
  });

  const rangeStr = `${startLocal.day}/${startLocal.month} \u2192 26/${effEndLocal.month}/${effEndLocal.year}`;
  out.innerHTML = `
    <div class="report-wrapper">
      <h3>Energy Usage - ${rangeStr}</h3>
      <div class="pkr-card">
        <div class="pkr-title">Financial Summary &nbsp;\u00b7&nbsp; PKR ${pkrPerKwh.toFixed(0)} / kWh</div>
        <div class="pkr-grid">
            <div class="pkr-item pkr-save"><div class="pkr-item-label">Solar savings</div><div class="pkr-item-val">PKR ${fmtPkr(totalSolarKwh * pkrPerKwh)}</div><div class="pkr-item-sub">${totalSolarKwh.toFixed(1)} kWh Gen</div></div>
            <div class="pkr-item pkr-bill"><div class="pkr-item-label">Est. grid bill</div><div class="pkr-item-val">PKR ${fmtPkr(gridImportKwh * pkrPerKwh)}</div><div class="pkr-item-sub">${gridImportKwh.toFixed(1)} kWh Imp</div></div>
            <div class="pkr-item pkr-without"><div class="pkr-item-label">Without solar</div><div class="pkr-item-val">PKR ${fmtPkr(withoutSolarKwh * pkrPerKwh)}</div><div class="pkr-item-sub">${withoutSolarKwh.toFixed(1)} kWh Total</div></div>
        </div>
      </div>
      <div class="table-scroll"><table>${tableRows}</table></div>
      <pre style="white-space:pre; margin:20px 0 0 0; font-family:monospace; border-top:1px dashed #d4d4d8; padding-top:20px; color:#71717a;">${sparkTxt}</pre>
    </div>`;
}
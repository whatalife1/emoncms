// ─── Detailed Usage Report UI Logic ──────────────────────────────────────────

let lastReportData = null; // Store data globally for the text exporter

async function calculateDetailedReport() {
  const container = document.getElementById('usage-report-content');
  const m = parseInt(document.getElementById('report-month-m').value);
  const y = parseInt(document.getElementById('report-month-y').value);
  const pkrRate = (solarCfg && solarCfg.pkrPerUnit) ? solarCfg.pkrPerUnit : 60;

  container.innerHTML = '<div class="sol-loading">Fetching billing data from EmonCMS...</div>';
  loadReportCache();

  const { startMs, endMs } = billingRangeFor(y, m);
  const nowMs = currentHourMs();
  const fetchEnd = Math.min(endMs, nowMs);

  try {
    const feedsWithData = await Promise.all(EXPORT_FEEDS.map(async f => {
      const raw = await fetchWithCache(f.id, startMs, fetchEnd);
      return {
        ...f,
        dayMap: sumByDay(raw, 0, 24),
        peakMap: sumByDay(raw, EXPORT_DAY_START, EXPORT_DAY_END),
        nightMap: sumByDay(raw, EXPORT_NIGHT_START, EXPORT_NIGHT_END)
      };
    }));
    saveReportCache();

    // Store globally for downloadTextReport
    lastReportData = { 
      feeds: feedsWithData, 
      month: m, 
      year: y, 
      pkrRate,
      startMs,
      endMs,
      fetchEnd
    };

    const solarF = feedsWithData.find(f => f.isSolar);
    const gridF  = feedsWithData.find(f => f.isBreaker);

    const dateKeys = [];
    let curr = new Date(startMs);
    while (curr.getTime() < endMs) {
      dateKeys.push(curr.toISOString().slice(0, 10));
      curr.setDate(curr.getDate() + 1);
    }

    let totSolar = 0, totGrid = 0;
    dateKeys.forEach(k => {
      totSolar += (solarF.dayMap[k] || 0);
      totGrid  += (gridF.dayMap[k] || 0);
    });

    const totUnits = totSolar + totGrid;
    const totBill  = (totGrid / 1000) * pkrRate;
    const totSaved = (totSolar / 1000) * pkrRate;
    const billWithoutSolar = (totUnits / 1000) * pkrRate;

    let html = `
      <div class="report-wrapper">
        <h3>Detailed Usage Report: ${_MONTH_NAMES[m-1]} ${y}</h3>
        <p class="sub-hours">Cycle: 25th to 26th · Day: ${EXPORT_DAY_START}:00-${EXPORT_DAY_END}:00 · Night: Rest</p>

        <div class="pkr-card">
          <div class="pkr-title">Financial Summary (Rate: PKR ${pkrRate}/kWh)</div>
          <div class="pkr-grid">
            <div class="pkr-item pkr-save">
              <div class="pkr-item-label">PKR SAVED</div>
              <div class="pkr-item-val">Rs. ${fmtPkr(totSaved)}</div>
              <div class="pkr-item-sub">${fmtKwh(totSolar)} units produced</div>
            </div>
            <div class="pkr-item pkr-bill">
              <div class="pkr-item-label">EST. BILL</div>
              <div class="pkr-item-val">Rs. ${fmtPkr(totBill)}</div>
              <div class="pkr-item-sub">${fmtKwh(totGrid)} units imported</div>
            </div>
            <div class="pkr-item pkr-without">
              <div class="pkr-item-label">WITHOUT SOLAR</div>
              <div class="pkr-item-val">Rs. ${fmtPkr(billWithoutSolar)}</div>
              <div class="pkr-item-sub">${fmtKwh(totUnits)} units consumed</div>
            </div>
          </div>
        </div>

        <h4>Usage Breakdown Table</h4>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Solar Total<br>${formatHeaderSplitCell('kWh','PKR')}</th>
                <th>Grid Import<br>${formatHeaderSplitCell('kWh','PKR')}</th>
                <th class="dv">Total Load<br>${formatHeaderSplitCell('kWh','PKR')}</th>
                ${feedsWithData.filter(f => !f.isSolar && !f.isBreaker).map(f => `<th>${f.name}<br><small>kWh</small></th>`).join('')}
              </tr>
            </thead>
            <tbody>`;

    dateKeys.forEach(k => {
      const s = solarF.dayMap[k] || 0;
      const g = gridF.dayMap[k] || 0;
      const t = s + g;
      html += `<tr>
          <td class="dt">${k.split('-')[2]} ${_MONTH_SHORT[new Date(k).getMonth()]}</td>
          <td>${splitCell(fmtKwh(s), fmtPkr((s/1000)*pkrRate))}</td>
          <td>${splitCell(fmtKwh(g), fmtPkr((g/1000)*pkrRate))}</td>
          <td class="dv tot">${splitCell(fmtKwh(t), fmtPkr((t/1000)*pkrRate))}</td>
          ${feedsWithData.filter(f => !f.isSolar && !f.isBreaker).map(f => `<td>${fmtKwh(f.dayMap[k] || 0)}</td>`).join('')}
        </tr>`;
    });

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div style="padding:20px; color:#ef4444;">Error: ${e.message}</div>`;
  }
}

function downloadTextReport() {
  if (!lastReportData) { alert("Please calculate report first."); return; }

  const { feeds, month, year, startMs, endMs, fetchEnd } = lastReportData;
  const numDays = Math.ceil((fetchEnd - startMs) / (1000 * 60 * 60 * 24));
  
  let output = `Energy Usage Summary: ${month}/${year}\n`;
  output += `Cycle: 25th to 26th (Period: ${numDays} days)\n`;
  output += "--------------------------------------------------------------------------------\n";

  const solarF = feeds.find(f => f.isSolar);
  const gridF  = feeds.find(f => f.isBreaker);

  const getSum = (map) => Object.values(map).reduce((a, b) => a + b, 0) / 1000;

  // Solar Line
  const solTotal = getSum(solarF.dayMap);
  output += `Solar           ${solTotal.toFixed(0).padEnd(10)} units         (Avg: ${(solTotal / numDays).toFixed(1)} units/day)\n`;

  // Grid/Breaker Line
  const gridTotal = getSum(gridF.dayMap);
  const gridSolarTime = getSum(gridF.peakMap);
  const gridNightTime = getSum(gridF.nightMap);
  output += `Breaker         ${gridTotal.toFixed(0).padEnd(10)} units Total   (${gridSolarTime.toFixed(0)} units solar time) ${gridNightTime.toFixed(0)} units night (Avg: ${(gridNightTime / numDays).toFixed(1)}/night)\n`;
  output += "--------------------------------------------------------------------------------\n";

  // Appliance Lines
  feeds.filter(f => !f.isSolar && !f.isBreaker).forEach(f => {
    const total = getSum(f.dayMap);
    const peak = getSum(f.peakMap);
    const night = getSum(f.nightMap);
    const avgNight = (night / numDays).toFixed(1);
    
    const name = f.name.padEnd(15);
    const totalStr = (total.toFixed(0) + " units Total").padEnd(18);
    const peakStr = ("(" + peak.toFixed(0) + " units solar)").padEnd(24);
    
    output += `${name} ${totalStr} ${peakStr} ${night.toFixed(0).padStart(3)} units night (Avg: ${avgNight}/night)\n`;
  });

  const blob = new Blob([output], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Usage_Summary_${month}_${year}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

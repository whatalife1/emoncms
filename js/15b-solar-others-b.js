async function solRenderDay(dateStr) {
  const out = document.getElementById('sol-day-out');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Calculating…</div>';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const { hourly, weatherAvailable } = await _calcHourly(y, mo, d); 
  const dateObj = new Date(y, mo-1, d);
  const weatherLabel = weatherAvailable? '· Live weather' : '· Clear-sky estimate'; 
  const label = dateObj.toLocaleDateString('en-PK', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ' ' + weatherLabel;
  const arcWrap = document.getElementById('sol-arc-day');
  if (arcWrap) _renderSunArc(y, mo, d, arcWrap);
  out.innerHTML = _daySummaryHtml(hourly, label) +
                  _legendHtml(false) +
                  '<div class="sol-hourly" id="sol-day-bars"></div>';
  _renderHourlyBars(hourly, document.getElementById('sol-day-bars'), null);

  const actualsPromise = _fetchTodayActuals(y, mo, d);
  const breakerPromise = _getBreakerKwh(y, mo, d, false);

  const [actuals, breakerKwh] = await Promise.all([actualsPromise, breakerPromise]);

  const rowsContainer = out.querySelector('.sol-rows-container');
  if (rowsContainer) {
    let rowsHtml = '';
    const totalKwh = hourly.reduce((s, h) => s + h.watt, 0) / 1000;
    const estSavings = (totalKwh * solarCfg.pkrPerUnit).toFixed(0);
    if (solarCfg.pkrPerUnit > 0) {
      rowsHtml += `
        <div class="sol-savings-row">
          <span class="sol-savings-label"> Est. savings</span>
          <span class="sol-savings-val">PKR ${estSavings}</span>
        </div>`;
    }

    if (actuals) {
      _renderHourlyBars(hourly, document.getElementById('sol-today-bars'), actuals);
      const legendEl = out.querySelector('.sol-legend');
      if (legendEl) legendEl.outerHTML = _legendHtml(true);

      const actualKwh    = Object.values(actuals).reduce((s, w) => s + w, 0) / 1000;
      const actualSaving = (actualKwh * solarCfg.pkrPerUnit).toFixed(0);

      const mainValEl = document.getElementById('sol-sum-kwh-val');
      if (mainValEl) {
          mainValEl.innerHTML = `${totalKwh.toFixed(2)} <span style="font-size:18px;color:var(--text-muted);font-weight:normal;margin:0 4px;">/</span> <span style="color:#38bdf8">${actualKwh.toFixed(2)}</span>`;
      }

      rowsHtml += `
        <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
          <span class="sol-savings-label">⚡ Actual saving that day</span>
          <span class="sol-savings-val" style="color:#4ade80">PKR ${actualSaving}</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${actualKwh.toFixed(2)} kWh actual · ${Object.keys(actuals).length} hrs recorded</div>`;
    }

    if (breakerKwh !== null && breakerKwh !== undefined && !isNaN(breakerKwh)) {
      const breakerPkr = (breakerKwh * solarCfg.pkrPerUnit).toFixed(0);
      rowsHtml += `
        <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
          <span class="sol-savings-label">🔌 Grid Import (Breaker)</span>
          <span class="sol-savings-val" style="color:#f87171">PKR ${breakerPkr}</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${breakerKwh.toFixed(2)} kWh imported</div>`;
    }

    rowsContainer.innerHTML = rowsHtml;
  }
}

async function solRenderMonth(y, mo) {
  const out = document.getElementById('sol-month-out');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Calculating…</div>';

  const data    = await _calcMonth(y, mo);
  const maxKwh  = Math.max(...data.daily.map(x => x.kwh), 1);
  const avgKwh  = data.total / data.daily.length;
  const maxDay  = data.daily.reduce((a, b) => b.kwh > a.kwh ? b : a);
  const monthlySavings = (data.total * solarCfg.pkrPerUnit).toFixed(0);

  const monthSummary = `
    <div class="sol-month-sum">
      <div>
        <span class="sol-month-total">${data.total.toFixed(0)}</span>
        <span style="font-size:13px;color:var(--text-muted);margin-left:4px">kWh</span>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${_MONTH_NAMES[mo-1]} ${y}</div>
        ${solarCfg.pkrPerUnit > 0 ? `<div style="font-size:13px;color:#4ade80;font-weight:700;margin-top:4px"> PKR ${monthlySavings}</div>` : ''}
      </div>
      <div class="sol-month-info">
        Avg/day <b>${avgKwh.toFixed(1)} kWh</b><br>
        Best day <b>${maxDay.d} ${_MONTH_SHORT[mo-1]} : ${maxDay.kwh.toFixed(1)} kWh</b><br>
        ${_fmtKwp()} kWp · ${solarCfg.panelCount}×${solarCfg.panelWatts}W<br>
        ☁ ${solarCfg.cloudPct}% cloud
      </div>
    </div>`;

  const bars = data.daily.map(({ d, kwh }) => {
    const pct = (kwh / maxKwh * 100).toFixed(1);
    return `<div class="sol-d-row">
      <span class="sol-d-day">${_pad2(d)}</span>
      <div class="sol-d-bar-wrap"><div class="sol-d-bar" style="width:${pct}%"></div></div>
      <span class="sol-d-kwh">${kwh.toFixed(1)}</span>
    </div>`;
  }).join('');

  const heatDailyData = data.daily.map(({ d, kwh }) => ({
    kwh, d,
    date: new Date(y, mo - 1, d)
  }));

  out.innerHTML = monthSummary + `<div id="sol-month-heatmap"></div>` + `<div class="sol-daily">${bars}</div>`;

  const heatEl = document.getElementById('sol-month-heatmap');
  if (heatEl) _renderHeatmap(heatDailyData, heatEl);
}

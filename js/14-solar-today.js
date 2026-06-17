// Initialize global nav offset
window._navOffset = 0;

async function solRenderToday() {
  const { y, mo, d, date } = _navDate();
  const isToday = window._navOffset === 0;
  const isPast  = window._navOffset < 0;
  const out     = document.getElementById('sol-today-out');
  if (!out) return;

  _updateNavLabel();
  out.innerHTML = '<div class="sol-loading">Calculating…</div>';

  try {
    const { hourly, weatherAvailable } = await _calcHourly(y, mo, d); 
    const arcWrap   = document.getElementById('sol-arc-today');
    if (arcWrap) _renderSunArc(y, mo, d, arcWrap);

    // Calculate cloud and rain
    const hourlyLen = hourly.length || 1;
    const avgCloud  = Math.round(hourly.reduce((s,x)=>s+(x.cloud||0),0) / hourlyLen);
    const maxRain   = Math.round(Math.max(...hourly.map(x=>x.rain||0)));
    
    solarCfg.cloudPct = avgCloud;
    _updateCloudLabel(avgCloud);
    const cloudEl = document.getElementById('sp-cloud');
    if (cloudEl) cloudEl.value = avgCloud;

    const weatherLabel = weatherAvailable? '· Live weather' : '· Clear-sky estimate'; 
    const titleHtml = isToday
      ? `Today · ${date.toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})} ${weatherLabel}`
      : `${date.toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'short',year:'numeric'})} ${weatherLabel}`;

    const nowCard = '<div class="sol-now-card" style="background:var(--bg-panel);border:1px solid var(--border);border-left:3px solid var(--accent-solar);border-radius:10px;padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Now · Predicted Solar</div><div style="font-size:28px;font-weight:800;color:var(--accent-solar);line-height:1.1"><span id="sol-now-watt">---</span> <span style="font-size:14px;font-weight:600">W</span></div></div><div style="text-align:right"><div style="font-size:10px;color:var(--text-muted)">Auto-updates 2 min</div><div id="sol-now-time" style="font-size:13px;font-weight:700;color:var(--text-main);margin-top:2px">--:--</div><div id="sol-now-cloud" style="font-size:10px;color:var(--text-muted);margin-top:2px"></div></div></div>';
    
    out.innerHTML = nowCard + _daySummaryHtml(hourly, titleHtml) +
                    _legendHtml(false) +
                    '<div class="sol-hourly" id="sol-today-bars"></div>';
    
    if (typeof updateSolarNow === 'function') updateSolarNow(hourly);
    _renderHourlyBars(hourly, document.getElementById('sol-today-bars'), null);
    if (isToday) _renderBatteryCard(hourly);

    // Concurrent fetching for performance
    const actualsPromise = (isToday || isPast) ? _fetchTodayActuals(y, mo, d) : Promise.resolve(null);
    const breakerPromise = _getBreakerKwh(y, mo, d, isToday);

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

        const actualKwh    = Object.values(actuals).reduce((s, w) => s + (parseFloat(w)||0), 0) / 1000;
        const actualSaving = (actualKwh * solarCfg.pkrPerUnit).toFixed(0);
        const label        = isToday ? '⚡ Actual saving so far' : '⚡ Actual saving that day';

        const mainValEl = document.getElementById('sol-sum-kwh-val');
        if (mainValEl) {
            mainValEl.innerHTML = `${totalKwh.toFixed(2)} <span style="font-size:18px;color:var(--text-muted);font-weight:normal;margin:0 4px;">/</span> <span style="color:#38bdf8">${actualKwh.toFixed(2)}</span>`;
        }

        rowsHtml += `
          <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
            <span class="sol-savings-label">${label}</span>
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
          <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${parseFloat(breakerKwh).toFixed(2)} kWh imported</div>`;
      }

      if (isToday) {
        const monthData      = await _calcMonth(y, mo);
        const monthlySavings = (monthData.total * solarCfg.pkrPerUnit).toFixed(0);
        rowsHtml += `
          <div class="sol-sum-month" style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">
            <span class="sol-sum-mlabel">📅 ${_MONTH_SHORT[mo-1]} ${y} month estimate</span>
            <span class="sol-sum-mval">${monthData.total.toFixed(0)} kWh</span>
          </div>
          ${solarCfg.pkrPerUnit > 0 ? `
          <div class="sol-savings-row">
            <span class="sol-savings-label"> Est. month savings est.</span>
            <span class="sol-savings-val" style="color:#4ade80">PKR ${monthlySavings}</span>
          </div>` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-top:6px">🌤 Live: ${avgCloud}% clouds · 🌧 ${maxRain}% rain — Open-Meteo</div>`;
      } else {
        rowsHtml += `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">🌤 Live: ${avgCloud}% clouds · 🌧 ${maxRain}% rain — Open-Meteo</div>`;
      }

      rowsContainer.innerHTML = rowsHtml;
    }
  } catch (err) {
    console.error(err);
    out.innerHTML = `<div class="sol-loading" style="color:#f87171">Error calculating: ${err.message}</div>`;
  }
}
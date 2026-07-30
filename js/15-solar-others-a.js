function _billingRange() {
  const pktNow = getPktNow();
  const yr = IS_PKT_ZONE ? pktNow.getFullYear() : pktNow.getUTCFullYear();
  const mo = (IS_PKT_ZONE ? pktNow.getMonth() : pktNow.getUTCMonth()) + 1;
  const dy = IS_PKT_ZONE ? pktNow.getDate() : pktNow.getUTCDate();

  const range = getPktBillingRange(yr, dy < 26 ? mo : mo + 1);
  return { start: new Date(range.startMs), end: new Date(range.endMs) };
}

async function solRenderBilling() {
  const out = document.getElementById('sol-billing-out');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Fetching billing cycle data…</div>';

  const { start, end }    = _billingRange();
  const effectiveEnd       = new Date(Math.min(end.getTime(), Date.now()));
  const solarId            = (userOrderedFeeds.find(f => f.name === 'Solar') ?? { id: '499380' }).id;

  const url = `${PROXY_BASE}/feed/data.json?ids=${solarId}&start=${start.getTime()}&end=${effectiveEnd.getTime()}&skipmissing=0&average=1&delta=0&interval=3600`;

  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) throw new Error(text || 'fetch failed');
    const arr  = JSON.parse(text);
    const data = arr?.[0]?.data || [];

    const ymd  = d => {
      const p = getKarachiDate(d.getTime());
      return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
    };
    const dmy  = d => {
      const p = getKarachiDate(d.getTime());
      return `${String(p.day).padStart(2,'0')}-${String(p.month).padStart(2,'0')}-${p.year}`;
    };

    const byDay = {};
    for (const pt of data) {
      if (pt[1] === null || pt[1] === undefined) continue;
      const k = ymd(new Date(pt[0]));
      byDay[k] = (byDay[k] || 0) + pt[1];
    }

    const days = [];
    const cur  = new Date(start);
    while (cur < effectiveEnd) {
      const k   = ymd(cur);
      const kwh = (byDay[k] || 0) / 1000;
      days.push({ date: new Date(cur), kwh, d: cur.getDate() });
      cur.setDate(cur.getDate() + 1);
    }

    const totalKwh    = days.reduce((s, d) => s + d.kwh, 0);
    const daysElapsed = days.length;
    const avgKwh      = daysElapsed > 0 ? totalKwh / daysElapsed : 0;
    const daysInCycle = Math.round((end - start) / 86400000);
    const projectedKwh = avgKwh * daysInCycle;
    const savings     = (totalKwh * solarCfg.pkrPerUnit).toFixed(0);
    const projSavings = (projectedKwh * solarCfg.pkrPerUnit).toFixed(0);
    const maxKwh      = Math.max(...days.map(d => d.kwh), 1);
    const bestDay     = days.reduce((a, b) => b.kwh > a.kwh ? b : a, days[0] || { date: new Date(), kwh: 0 });
    const rangeStr    = `${dmy(start)} → ${dmy(end)}`;

    const bars = days.map(({ date, kwh }) => {
      const pct     = (kwh / maxKwh * 100).toFixed(1);
      const isToday = ymd(date) === ymd(getPktNow());
      const barColor = isToday ? 'background:linear-gradient(90deg,#164e63,#facc15)' : '';
      return `<div class="sol-d-row">
        <span class="sol-d-day" style="${isToday?'color:var(--accent-solar);font-weight:700':''}">${String(date.getDate()).padStart(2,'0')}</span>
        <div class="sol-d-bar-wrap"><div class="sol-d-bar" style="width:${pct}%;${barColor}"></div></div>
        <span class="sol-d-kwh" style="${isToday?'color:var(--accent-solar)':''}">${kwh.toFixed(1)}</span>
      </div>`;
    }).join('');

    const heatmapData = days.map(({ date, kwh }) => ({ kwh, date, d: date.getDate() }));
    const heatmapWrap = document.createElement('div');
    _renderHeatmap(heatmapData, heatmapWrap);

    out.innerHTML = `
      <div class="sol-billing-card">
        <div class="sol-billing-title">⚡ Billing Cycle · ${rangeStr}</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px">
          <div>
            <span class="sol-billing-big">${totalKwh.toFixed(1)}</span>
            <span style="font-size:13px;color:var(--text-muted);margin-left:4px">kWh so far</span>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${daysElapsed} of ${daysInCycle} days</div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--text-muted);line-height:2">
            Avg/day <b style="color:var(--text-main)">${avgKwh.toFixed(1)} kWh</b><br>
            Best day <b style="color:var(--text-main)">${dmy(bestDay.date)}: ${bestDay.kwh.toFixed(1)} kWh</b>
          </div>
        </div>
        <div class="sol-billing-row"><span> Est. Savings so far</span><span style="color:#4ade80">PKR ${savings}</span></div>
        <div class="sol-billing-row"><span>📈 Projected full cycle</span><span style="color:var(--accent-kwh)">${projectedKwh.toFixed(0)} kWh</span></div>
        <div class="sol-billing-row"><span>📈 Projected savings</span><span style="color:#4ade80">PKR ${projSavings}</span></div>
      </div>
      <div id="heatmap-wrap"></div>
      <div class="sol-daily">${bars}</div>`;

    const hw = document.getElementById('heatmap-wrap');
    if (hw) hw.appendChild(heatmapWrap);

  } catch(e) {
    out.innerHTML = `<div class="sol-loading" style="color:#f87171">Failed to load: ${e.message}</div>`;
  }
}

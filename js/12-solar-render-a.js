function _renderHourlyBars(hourly, container, actualWatts) {
  if (!container) return;
  const maxW   = Math.max(...hourly.map(h => h.watt), 1);
  const sorted = [...hourly].sort((a, b) => b.watt - a.watt);
  const peakHours = new Set(sorted.slice(0, 4).map(h => h.h));

  container.innerHTML = hourly.map(h => {
    const pct  = (h.watt / maxW * 100).toFixed(1);
    const zero = h.watt < 1;
    const wStr = zero ? '-' : Math.round(h.watt) + 'W';
    const color = _barColor(h.watt, maxW);
    const isPeak = peakHours.has(h.h);
    const wColor = isPeak ? '#fca5a5' : h.watt > maxW * 0.66 ? '#f97316' : !zero ? '#facc15' : '#3f3f46';

    let rightStr, rightColor;
    if (actualWatts && actualWatts[h.h] !== undefined) {
      const actW = actualWatts[h.h];
      rightStr   = Math.round(actW) + 'W';
      rightColor = actW > h.watt * 1.05 ? '#4ade80' : actW < h.watt * 0.95 ? '#f87171' : '#38bdf8';
    } else {
      rightStr   = zero ? '-' : (h.watt / 1000).toFixed(2);
      rightColor = '#71717a';
    }

    const rain    = h.rain ?? 0;
    const rainStr = rain > 5 ? `🌧${Math.round(rain)}%` : '';
    const rainColor = rain > 70 ? '#60a5fa' : rain > 40 ? '#38bdf8' : '#71717a';

    let dotHtml = '';
    if (actualWatts && actualWatts[h.h] !== undefined) {
      const actW   = actualWatts[h.h];
      const actPct = Math.min(100, (actW / maxW * 100));
      const dotClass = actW > h.watt * 1.05 ? 'over' : actW < h.watt * 0.95 ? 'under' : '';
      dotHtml = `<div class="sol-h-actual-dot ${dotClass}" style="left:calc(${actPct.toFixed(1)}% - 5px)" title="Actual: ${Math.round(actW)}W"></div>`;
    }

    return `<div class="sol-h-row${isPeak ? ' peak-hour' : ''}">
      <span class="sol-h-time">${_pad2(h.h)}:00</span>
      <div class="sol-h-bar-wrap">
        <div class="sol-h-bar${zero?' zero':''}" style="width:0%;background:${color.bg};--glow:${color.glow}"></div>
        ${dotHtml}
      </div>
      <span class="sol-h-rain" style="color:${rainColor}">${rainStr}</span>
      <span class="sol-h-w" style="color:${wColor}">${wStr}</span>
      <span class="sol-h-kwh" style="color:${rightColor}">${rightStr}</span>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.sol-h-bar:not(.zero)').forEach((bar, i) => {
      const hw = hourly[i];
      if (!hw) return;
      const finalPct = (hw.watt / maxW * 100).toFixed(1) + '%';
      setTimeout(() => { bar.style.width = finalPct; }, i * 25);
    });
  });
}

function _daySummaryHtml(hourly, titleHtml, extraRowsHtml = '') {
  const totalKwh  = hourly.reduce((s, h) => s + h.watt, 0) / 1000;
  const peakWatt  = Math.max(...hourly.map(h => h.watt));
  const peakHour  = hourly.find(h => h.watt === peakWatt);
  const peakTime  = peakHour ? `${_pad2(peakHour.h)}:00` : '--';
  const sorted    = [...hourly].sort((a, b) => b.watt - a.watt).slice(0, 4);
  const peakFrom  = Math.min(...sorted.map(h => h.h));
  const peakTo    = Math.max(...sorted.map(h => h.h)) + 1;

  return `<div class="sol-summary">
    <div class="sol-sum-main" style="margin-bottom:12px">
      <div class="sol-sum-left">
        <div><span class="sol-sum-kwh" id="sol-sum-kwh-val">${totalKwh.toFixed(2)}</span><span class="sol-sum-unit">kWh</span></div>
        <div class="sol-sum-sub">${titleHtml}</div>
        <div class="sol-peak-badge">🔥 Best hours: ${_pad2(peakFrom)}:00–${_pad2(peakTo)}:00</div>
      </div>
      <div class="sol-sum-right">
        Peak: <b>${Math.round(peakWatt)}W</b> @ ${peakTime}<br>
        ${_fmtKwp()} kWp · ${solarCfg.panelCount}×${solarCfg.panelWatts}W<br>
        ☁ ${solarCfg.cloudPct}% cloud · eff ${Math.round(solarCfg.sysEff*100)}%
      </div>
    </div>
    <div class="sol-rows-container"></div>
  </div>`;
}

function _renderBatteryCard(hourly) {
  const card = document.getElementById('sol-battery-card');
  if (!card) return;
  const batt = _calcBattery(hourly, solarCfg.batteryKwh);
  if (!batt) { card.classList.remove('visible'); return; }
  card.classList.add('visible');
  const now  = new Date();
  const curH = now.getHours();
  const rec  = batt.records.find(r => r.h === curH) || batt.records[batt.records.length - 1];
  const pct  = rec ? rec.pct : 0;
  const fillClass = pct < 20 ? 'low' : pct < 50 ? 'mid' : '';
  card.innerHTML = `
    <div class="sol-battery-title">🔋 Battery Estimate — ${solarCfg.batteryKwh} kWh capacity</div>
    <div class="sol-battery-track">
      <div class="sol-battery-fill ${fillClass}" style="width:${pct.toFixed(0)}%"></div>
      <span class="sol-battery-pct">${pct.toFixed(0)}%</span>
    </div>
    <div class="sol-battery-times">
      <span>${batt.fullTime  ? `⚡ Full @ ${_pad2(batt.fullTime)}:00`  : 'May not fully charge today'}</span>
      <span>${batt.emptyTime ? `🌙 Empty @ ${_pad2(batt.emptyTime)}:00` : 'Stays charged all day'}</span>
    </div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Est. with ~500W avg load · starts at 50% SOC</div>`;
}

function _legendHtml(hasActuals) {
  const actualLegend = hasActuals ? `
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#38bdf8;border-radius:50%"></div><span>Actual ≈ pred</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#4ade80;border-radius:50%"></div><span>Actual &gt; pred</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#f87171;border-radius:50%"></div><span>Actual &lt; pred</span></div>` : '';
  return `<div class="sol-legend">
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#ca8a04"></div><span>Low</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#f59e0b"></div><span>Mid</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#f97316"></div><span>High</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#ef4444"></div><span>🔥 Peak</span></div>
    ${actualLegend}
  </div>`;
}

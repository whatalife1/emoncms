// js/23c-flow-extras-grid-16x2.js
// ─── 16-column daily card grid renderer ────────────────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  function render16x2CardGrid(cfg) {
      const {
        title, titleColor, dayList, totalKwh, totalNightKwh, avgKwh, avgNightKwh,
        estKwh, estPkr, pkrSuffix, todayUnits, todayNightUnits, hoverId, valColorDefault,
        extraHeaderRow, isPct, hideNight, todayStatsHtml
      } = cfg;

      const startLabel = dayList.length ? dayList[0].dayLabel : '';
      const endLabel = dayList.length ? dayList[dayList.length - 1].dayLabel : '';
      const pkrText = estPkr != null ? ` (~PKR ${Math.round(estPkr).toLocaleString()}${pkrSuffix ? ' ' + pkrSuffix : ''})` : '';
      const unitLabel = isPct ? '%' : 'kWh';

      const nightStats = (totalNightKwh != null && !hideNight)
        ? ` (<span style="color:#c084fc; font-weight:800;">${totalNightKwh.toFixed(1)} ${unitLabel}</span>)`
        : '';
      const avgNightStats = (avgNightKwh != null && !hideNight)
        ? ` (<span style="color:#c084fc; font-weight:800;">${avgNightKwh.toFixed(1)} ${isPct ? '%' : 'kWh/d'}</span>)`
        : '';

      const estHtml = estKwh != null
        ? `<div style="font-size:12px; font-weight:700; color:var(--text-muted, #71717a); line-height:1.3;">
             Est: <b style="color:#facc15;">~${estKwh.toFixed(0)} kWh</b><span style="font-size:11.5px; color:${titleColor};">${pkrText}</span>
           </div>`
        : '';

      const todayNightKStr = (todayNightUnits != null && !hideNight)
        ? ` <span style="color:#c084fc; font-weight:800;">(${todayNightUnits.toFixed(1)}k)</span>`
        : '';
      const todayText = `[Today: ${todayUnits != null ? (isPct ? Math.round(todayUnits) + '%' : todayUnits.toFixed(1) + ' kWh') : '--'}${todayNightKStr}]`;

      return `
        <div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid ${titleColor}; border-radius:10px; padding:10px 12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
          <div style="margin-bottom:6px;">
            <div style="font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:0; line-height:1.2; color:${titleColor}; margin-bottom:4px;">
              ${title} (${startLabel} → ${endLabel})
            </div>

            <div style="font-size:12px; font-weight:700; color:var(--text-muted, #71717a); line-height:1.3;">
              Total: <b style="color:${titleColor}; font-weight:800;">${totalKwh.toFixed(1)} ${unitLabel}</b>${nightStats}
            </div>

            <div style="font-size:12px; font-weight:700; color:var(--text-muted, #71717a); line-height:1.3;">
              Avg: <b style="color:var(--text-main, #f4f4f5); font-weight:800;">${avgKwh.toFixed(1)}</b> ${isPct ? '%' : 'kWh/d'}${avgNightStats}
            </div>

            ${estHtml}

            <div style="font-size:12px; font-weight:800; color:#facc15; margin-top:2px; line-height:1.3;">${todayText}</div>

            ${todayStatsHtml || ''}

            <div id="${hoverId}" style="font-size:11.5px; font-weight:800; color:#facc15; margin-top:2px; min-height:16px; line-height:1.2;"></div>
          </div>

          ${extraHeaderRow || ''}

          <div class="fd-grid-16-container" onmouseleave="const el=document.getElementById('${hoverId}'); if(el) el.textContent='';">
            ${dayList.map(d => {
              const isToday = d.isToday;
              const isFuture = d.isFuture;
              const valText = isFuture ? '-' : (d.kwh != null ? (isPct ? Math.round(d.kwh) : d.kwh.toFixed(1)) : '0.0');
              const nightText = (d.nightKwh != null && !isFuture && !hideNight) ? (isPct ? Math.round(d.nightKwh) + '%' : d.nightKwh.toFixed(1)) : null;

              const bg = isToday ? 'rgba(250,204,21,0.14)' : (isFuture ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)');
              const border = isToday ? '1.5px solid #facc15' : (isFuture ? '1px dashed rgba(255,255,255,0.08)' : '1px solid var(--border, #27272a)');
              const opacity = isFuture ? 'opacity:0.35;' : '';
              const shadow = isToday ? 'box-shadow:0 0 8px rgba(250,204,21,0.25);' : '';
              const dateColor = isToday ? '#facc15' : 'var(--text-muted, #71717a)';
              const valColor = isToday ? '#facc15' : (isFuture ? 'var(--text-muted, #71717a)' : valColorDefault);

              const hoverInfo = isFuture
                ? `${d.dayLabel}: Upcoming`
                : `${d.dayLabel}: Total ${valText} ${unitLabel}${nightText ? ' · ☀️ Day: ' + ((d.kwh||0)-(d.nightKwh||0)).toFixed(1) + ' · 🌙 Night: ' + nightText : ''}`;

              return `
                <div class="fd-grid-cell ${isToday ? 'is-today' : ''} ${isFuture ? 'is-future' : ''}"
                     title="${hoverInfo}"
                     onmouseenter="const el=document.getElementById('${hoverId}'); if(el) el.textContent='${hoverInfo}';"
                     ontouchstart="const el=document.getElementById('${hoverId}'); if(el) el.textContent='${hoverInfo}';"
                     style="background:${bg}; border:${border}; border-radius:6px; padding:3px 1px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; min-height:46px; min-width:0; box-sizing:border-box; transition:background .12s, border-color .12s; cursor:${isFuture ? 'default' : 'pointer'}; user-select:none; ${opacity} ${shadow}">
                  <span class="fd-cell-date" style="font-size:9.5px; font-weight:700; color:${dateColor}; line-height:1; white-space:nowrap;">${d.dayLabel}</span>
                  <span class="fd-cell-val" style="font-size:12px; font-weight:800; font-family:monospace, system-ui; color:${valColor}; line-height:1.15; white-space:nowrap; margin-top:1.5px;">${valText}</span>
                  ${nightText ? `<span class="fd-cell-night" style="font-size:9.5px; font-weight:800; font-family:monospace, system-ui; color:#c084fc; line-height:1; white-space:nowrap; margin-top:1.5px;">${nightText}</span>` : (isFuture ? `<span style="font-size:9px; color:var(--text-muted); opacity:0.35;">-</span>` : '')}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }


  // ── Attach shared symbols to FX ──
  FX.render16x2CardGrid = render16x2CardGrid;
})();

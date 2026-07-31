function updateOfflineWarningBanner(byName) {
  const wrap = document.getElementById('offline-warning-wrap');
  if (!wrap) return;

  // Hardcoded master toggle (Set to true if you want to force enable in JS)
  const HARDCODED_ENABLE_OFFLINE_WARNINGS = false;

  // Settings UI switch (Default: false/off)
  const uiEnableOfflineWarnings = localStorage.getItem('offlineWarnEnabled') === 'true';

  const isEnabled = HARDCODED_ENABLE_OFFLINE_WARNINGS || uiEnableOfflineWarnings;

  if (!isEnabled || !byName || byName.size === 0) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
    return;
  }

  const warnings = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const OFFLINE_THRESHOLD_SEC = 30 * 60; // 30 minutes offline threshold

  const STALE_CHECK_FEEDS = [
    { name: "Kenwood 1.5Ton", label: "Kenwood 1.5T", type: "appliance", enabled: true },
    { name: "Kenwood 1Ton",   label: "Kenwood 1T",   type: "appliance", enabled: true },
    { name: "Haier 1Ton",     label: "Haier 1T",     type: "appliance", enabled: true },
    { name: "Fridge",         label: "Fridge 1",     type: "appliance", enabled: true },
    { name: "Fridge2",        label: "Fridge 2",     type: "appliance", enabled: true },
    { name: "Water Motor",    label: "Water Motor",  type: "appliance", enabled: true },
    { name: "PC",             label: "PC",           type: "appliance", enabled: true },
    { name: "Temperature",    label: "Temp 1",       type: "temp",      enabled: true },
    { name: "Temperature 2",  label: "Temp 2",       type: "temp",      enabled: true },
    { name: "Inverter Temp",  label: "Inv Temp",     type: "temp",      enabled: true },
    { name: "Water Tank",     label: "Water Tank",   type: "env",       enabled: true },
    { name: "AC Volts",       label: "AC Volts",     type: "env",       enabled: true },
    { name: "Breaker",        label: "Breaker",      type: "watts",     enabled: true },
    { name: "Solar",          label: "Solar",        type: "watts",     enabled: true },
    { name: "Tot Load",       label: "Tot Load",     type: "watts",     enabled: true }
  ];

  const formatAge = (sec) => {
    if (sec < 3600) {
      return `${Math.max(1, Math.floor(sec / 60))}m`;
    }
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  STALE_CHECK_FEEDS.forEach(item => {
    // Skip if disabled in code above
    if (item.enabled === false) return;

    // Skip if disabled in Display Settings UI (⚙)
    if (typeof userOrderedFeeds !== 'undefined' && userOrderedFeeds.length > 0) {
      const userSetting = userOrderedFeeds.find(f => f.name === item.name);
      if (userSetting && userSetting.enabled === false) return;
    }

    const feed = byName.get(item.name);
    const timeSec = (feed && feed.time && typeof feed.time === 'number' && feed.time > 0) ? feed.time : null;
    const ageSec = timeSec ? (nowSec - timeSec) : null;
    const ageText = ageSec && ageSec > 60 ? ` (Off for ${formatAge(ageSec)})` : '';

    if (!feed || feed.value === null || feed.value === undefined) {
      const detailStr = ageSec && ageSec > 60 ? `No Data (Off for ${formatAge(ageSec)})` : 'No Data';
      warnings.push({ label: item.label, detail: detailStr });
      return;
    }

    if (item.type === 'temp' && feed.value <= 0) {
      const detailStr = `${feed.value ?? 0}°C${ageText || ' (Offline)'}`;
      warnings.push({ label: item.label, detail: detailStr });
      return;
    }

    if (ageSec && ageSec > OFFLINE_THRESHOLD_SEC) {
      warnings.push({ label: item.label, detail: `Off for ${formatAge(ageSec)}` });
    }
  });

  if (warnings.length === 0) {
    wrap.style.display = 'none';
    wrap.innerHTML = '';
  } else {
    wrap.style.display = 'flex';
    wrap.innerHTML = `
      <div class="offline-warning-header">
        <span>⚠️ Feeds Not Updating / Offline (${warnings.length}):</span>
      </div>
      <div class="offline-warning-list">
        ${warnings.map(w => `
          <div class="offline-pill">
            <span class="pill-label">${w.label}</span>
            <span>&bull;</span>
            <span class="pill-detail">${w.detail}</span>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function renderResults(results) {
  const byName = new Map(results.map(r => [r.name, r]));
  const used   = new Set();

  results.forEach(f => { if (f.value != null) sparkPush(f.id, f.value); });
  if (!isCompact) { renderFlowDiagram(byName); } else { const wrap = document.getElementById('flow-svg-wrap'); if (wrap) wrap.innerHTML = ''; }
  updateCostCard(byName);
  updateOfflineWarningBanner(byName);

  const html = results.map(f => {
    if (f.name === 'Solar Amps') return '';

    if (used.has(f.name)) return '';
    const gn = LINKED_GROUPS.find(g => g.includes(f.name));
    if (gn) gn.forEach(n => used.add(n)); else used.add(f.name);

    if (gn && gn.includes('Solar') && gn.includes('Tot Load')) {
      const s  = byName.get('Solar');
      const l  = byName.get('Tot Load');
      const sv = byName.get('Solar V');
      const t  = byName.get('Solar Today');
      const tt = byName.get('Solar Total');
      return `<div class="card card-solar"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Solar</span>${sparkSvg(s?.id, '#facc15')}<span class="hero-val">${s?.value != null ? Math.round(s.value) : '---'}</span></div>
        <div style="flex:1;text-align:center"><span class="card-name">Solar V</span><span class="hero-val" style="color:var(--accent-env)">${sv?.value != null ? Math.round(sv.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">Tot Load</span>${sparkSvg(l?.id, '#f59e0b')}<span class="hero-val">${l?.value != null ? Math.round(l.value) : '---'}</span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Total</span><span class="linked-reading">${tt?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (gn && gn.includes('Breaker') && gn.includes('AC Volts')) {
      const b  = byName.get('Breaker');
      const ac = byName.get('AC Volts');
      const t  = byName.get('Breaker Today');
      const tt = byName.get('Breaker Total');
      return `<div class="card card-watts"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Breaker</span>${sparkSvg(b?.id, '#f59e0b')}<span class="hero-val">${b?.value != null ? Math.round(b.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">AC Input</span><span class="hero-val" style="color:var(--accent-env)">${ac?.value != null ? Math.round(ac.value) : '---'}<span style="font-size:11px;opacity:0.7;margin-left:2px">V</span></span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Total</span><span class="linked-reading">${tt?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (gn && gn.includes('Fridge') && gn.includes('Fridge2')) {
      const f1 = byName.get('Fridge');
      const f2 = byName.get('Fridge2');
      const t1 = byName.get('Fridge Today');
      const t2 = byName.get('Fridge2 Today');
      return `<div class="card card-watts"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Fridge</span>${sparkSvg(f1?.id, '#f59e0b')}<span class="hero-val">${f1?.value != null ? Math.round(f1.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">Fridge2</span>${sparkSvg(f2?.id, '#f59e0b')}<span class="hero-val">${f2?.value != null ? Math.round(f2.value) : '---'}</span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t1?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t2?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (f.name === 'Water Tank') {
      const pct = f.value;
      const pctColor = pct > 60 ? '#38bdf8' : pct > 30 ? '#f59e0b' : '#f87171';
      const status   = pct > 80 ? 'Full' : pct > 50 ? 'Good' : pct > 25 ? 'Low' : '⚠️ Critical';
      const flowRate = window.waterFlowRate || 0;
      const lastFlow = window.lastFlowRate || 0;
      const lastOnTime = window.lastMotorOnTime || 0;
      const showFlow = flowRate > 0.1 || (lastOnTime > 0 && (Date.now() - lastOnTime < 15 * 60 * 1000) && lastFlow > 0.1);
      
      let flowStr = '';
      if (showFlow) {
        const displayFlow = flowRate > 0.1 ? flowRate : lastFlow;
        const prefix = flowRate > 0.1 ? '▲ ' : 'Last: ';
        flowStr = ` · ${prefix}${displayFlow.toFixed(1)} L/min`;
        const avgFlow = window.waterAvgFlowRate || 0;
        if (avgFlow > 0.1) {
          flowStr += ` · Ø ${avgFlow.toFixed(1)}`;
        }
      }
      
      if (isCompact) {
        return `<div class="card card-env"><div class="card-header">
          <span class="card-name">Water Tank</span>
          <span style="font-weight:700;color:${pctColor}">${pct != null ? Math.round(pct) : '--'}% · ${status}${flowStr}</span>
        </div></div>`;
      }
      return `<div class="card card-env"><div class="card-header">
        <div class="tank-wrap">
          ${renderWaterTank(pct)}
          <div class="tank-info">
            <span class="card-name">Water Tank</span>
            <span class="tank-pct" style="color:${pctColor}">${pct != null ? Math.round(pct) : '--'}%</span>
            <span class="tank-label">${status}${flowStr}</span>
            ${sparkSvg(f.id, pctColor)}
          </div>
        </div>
      </div></div>`;
    }

    const group   = gn ? gn.map(n => byName.get(n)).filter(Boolean) : [f];
    const primary = group[0];
    if (!primary) return '';
    if (primary.name === 'Temperature' || primary.name === 'Humidity' || primary.name === 'Temperature 2' || primary.name === 'Humidity 2') {
      const isTwo = primary.name.includes('2');
      const baseName = isTwo ? 'Temperature 2' : 'Temperature';
      const humName = isTwo ? 'Humidity 2' : 'Humidity';
      const t = byName.get(baseName);
      const h = byName.get(humName);
      used.add(baseName); used.add(humName);
      return `<div class="card card-env"><div class="linked-values linked-values-pair">
        <div class="linked-value">
          <span>${baseName}</span>
          <span class="val-env" style="font-weight:700">${t?.value?.toFixed(1) ?? '--'} °C ${sparkSvg(t?.id, '#10b981')}</span>
        </div>
        <div class="linked-value">
          <span>${humName}</span>
          <span class="val-env" style="font-weight:700">${h?.value?.toFixed(1) ?? '--'} % ${sparkSvg(h?.id, '#10b981')}</span>
        </div>
      </div></div>`;
    }

    const sparkColor = primary.type === 'watts' ? '#f59e0b' : primary.type === 'units' ? '#38bdf8' : '#10b981';
    return `<div class="${cardClass(primary.type)}"><div class="card-header">
      <span class="card-name">${primary.name}</span>
      <span class="card-value ${COLORS[primary.type]}">${primary.value != null ? (primary.unit === 'W' ? Math.round(primary.value) : primary.value.toFixed(1)) : '--'} <span style="font-size:11px;opacity:0.6">${primary.unit}</span>${sparkSvg(primary.id, sparkColor)}</span>
    </div>${group.length > 1 ? `<div class="linked-values linked-values-pair">${group.slice(1).map(r => `
      <div class="linked-value"><span>${r.name.includes('Today') ? 'Today' : 'Total'}</span><span class="linked-reading">${r.value != null ? r.value.toFixed(1) : '0.0'}</span></div>`).join('')}</div>` : ''}</div>`;
  }).join('');

  document.getElementById('list').innerHTML = html;
}
// js/23-flow-extras.js
(function () {
  'use strict';
  const BAT2_IDS = {
    power:      '546365',
    volt:       '546369',
    current:    '546370',
    soc:        '546371',
    soh:        '546372',
    mosfetTemp: '546373',
    bmsTemp:    '546374',
    cycleCount: '546375',
    chgLimV:    '546376',
    chgLimA:    '546377',
    disLimV:    '546378',
    disLimA:    '546379'
  };

  const EXTRAS_REGISTRY = {
    solar:   { build: buildSolarExtras   },
    grid:    { build: buildGridExtras    },
    battery: { build: buildBatteryExtras },
    fridge:  { build: buildFridgeExtras  },
    k15:     { build: buildAcExtras.bind(null, 'k15') },
    k1:      { build: buildAcExtras.bind(null, 'k1') },
    haier:   { build: buildAcExtras.bind(null, 'haier') },
    water:   { build: buildWaterTankExtras },
    motor:   { build: buildMotorExtras   },
    wm:      { build: buildWmExtras      },
    pc:      { build: buildPcExtras      },
    battery2:{ build: buildBattery2Extras }
  };

  function pkrRate() {
    return (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.pkrPerUnit) || 60;
  }

  function fmtKwhVal(v) {
    if (v == null || isNaN(v)) return '0 Wh';
    const wh = v * 1000;
    return Math.abs(wh) >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh) + ' Wh';
  }

  function fmtWhVal(v) {
    if (v == null || isNaN(v)) return '0 Wh';
    return Math.abs(v) >= 500 ? (v / 1000).toFixed(1) + ' kWh' : Math.round(v) + ' Wh';
  }

  function fmtDuration(min) {
    if (min == null || isNaN(min) || min <= 0) return '0m';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function fmtPkr(v) {
    return 'PKR ' + Math.max(0, Math.round(v || 0)).toLocaleString('en-US');
  }

  async function fetch24h(feedKey, resOverride) {
    if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return [];
    const feed = GRAPH_FEEDS.find(f => f.key === feedKey);
    if (!feed || !feed.id) return [];
    const now = Date.now();
    const startMs = now - 24 * 3600 * 1000;
    const resolutions = resOverride ? [resOverride, 120, 300, 600, 900, 1800, 3600] : [120, 300, 600, 900, 1800, 3600];
    for (const res of resolutions) {
      try {
        const pts = await _gFetch(feed.id, startMs, now, res);
        if (pts && pts.length) return pts;
      } catch (e) {}
    }
    return [];
  }

  async function fetch24hById(feedId, resOverride) {
    if (typeof _gFetch !== 'function' || !feedId) return [];
    const now = Date.now();
    const startMs = now - 24 * 3600 * 1000;
    const resolutions = resOverride ? [resOverride, 120, 300, 600, 900, 1800, 3600] : [120, 300, 600, 900, 1800, 3600];
    for (const res of resolutions) {
      try {
        const pts = await _gFetch(feedId, startMs, now, res);
        if (pts && pts.length) return pts;
      } catch (e) {}
    }
    return [];
  }

  function detectSessions(pts, thresholdW, minDurationMin) {
    if (!pts || pts.length < 2) return [];
    const sessions = [];
    let cur = null;
    for (let i = 0; i < pts.length; i++) {
      const [ts, v] = pts[i];
      const tsMs = ts < 2e9 ? ts * 1000 : ts;
      const on = v != null && v > thresholdW;
      if (on) {
        if (!cur) cur = { start: tsMs, end: tsMs, sum: 0, n: 0, peak: 0 };
        cur.end = tsMs;
        cur.sum += v;
        cur.n++;
        if (v > cur.peak) cur.peak = v;
      } else if (cur) {
        sessions.push(cur);
        cur = null;
      }
    }
    if (cur) sessions.push(cur);
    return sessions
      .map(s => ({
        start: s.start, end: s.end,
        durMin: Math.max(1, Math.round((s.end - s.start) / 60000)),
        avgW: s.n > 0 ? s.sum / s.n : 0,
        peakW: s.peak
      }))
      .filter(s => s.durMin >= (minDurationMin || 1));
  }

  function totalRuntimeMin(sessions) {
    return sessions.reduce((a, s) => a + s.durMin, 0);
  }

  function energyKwhFromSessions(sessions) {
    return sessions.reduce((a, s) => a + (s.avgW * (s.durMin / 60)), 0) / 1000;
  }

  function timeAgoStr(tsMs) {
    if (!tsMs) return '\u2014';
    const mins = Math.round((Date.now() - tsMs) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }

  function row(label, value, opts) {
    opts = opts || {};
    const color = opts.color || 'var(--text-main)';
    const sub = opts.sub ? `<div style="font-size:10.5px;color:var(--text-muted);margin-top:1px;">${opts.sub}</div>` : '';
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:12px;color:var(--text-muted);font-weight:600;flex-shrink:0;">${label}</span>
      <span style="text-align:right;">
        <span style="font-size:13px;font-weight:800;color:${color};">${value}</span>
        ${sub}
      </span>
    </div>`;
  }

  function getFeedVal(name) {
    if (!window.lastResultsMap) return null;
    try {
      if (typeof window.lastResultsMap.get === 'function') {
        const item = window.lastResultsMap.get(name);
        return item ? item.value : null;
      }
      if (Array.isArray(window.lastResultsMap)) {
        const item = window.lastResultsMap.find(f => f && f.name === name);
        return item ? item.value : null;
      }
    } catch (e) {}
    return null;
  }

  // ── Shared 16×2 Card Grid ──
  function render16x2CardGrid(cfg) {
    const {
      title, titleColor, dayList, totalKwh, totalNightKwh, avgKwh, avgNightKwh,
      estKwh, estPkr, pkrSuffix, todayUnits, todayNightUnits, hoverId, valColorDefault,
      extraHeaderRow, isPct, hideNight
    } = cfg;

    const startLabel = dayList.length ? dayList[0].dayLabel : '';
    const endLabel = dayList.length ? dayList[dayList.length - 1].dayLabel : '';
    const pkrText = estPkr != null ? ` (~PKR ${Math.round(estPkr).toLocaleString()}${pkrSuffix ? ' ' + pkrSuffix : ''})` : '';
    const unitLabel = isPct ? '%' : 'kWh';

    const nightStats = (totalNightKwh != null && !hideNight)
      ? ` (<span style="color:#c084fc;">${totalNightKwh.toFixed(1)} kWh</span>)`
      : '';
    const avgNightStats = (avgNightKwh != null && !hideNight)
      ? ` (<span style="color:#c084fc;">${avgNightKwh.toFixed(1)} kWh/d</span>)`
      : '';

    return `
      <div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid ${titleColor}; border-radius:10px; padding:10px 12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:5px;">
          <span style="font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:${titleColor};">
            ${title} (${startLabel} → ${endLabel})
          </span>
          <div style="font-size:12.5px; font-weight:700; color:var(--text-muted, #71717a); display:flex; align-items:center; flex-wrap:wrap; gap:5px;">
            <span>${isPct ? 'Cycle Avg' : 'Total'}: <b style="color:${titleColor};">${totalKwh.toFixed(1)} ${unitLabel}</b>${nightStats}</span>
            <span>&bull;</span>
            <span>${isPct ? 'Min' : 'Avg'}: <b style="color:var(--text-main, #f4f4f5);">${avgKwh.toFixed(1)}</b> ${isPct ? '%' : 'kWh/d'}${avgNightStats}</span>
            ${estKwh != null ? `<span>&bull;</span><span>Est: <b style="color:#facc15;">~${estKwh.toFixed(0)} kWh</b><span style="font-size:11.5px; color:${titleColor};">${pkrText}</span></span>` : ''}
            <span id="${hoverId}" style="margin-left:4px; color:#facc15; font-weight:800;">[Today: ${todayUnits != null ? (isPct ? Math.round(todayUnits) + '%' : todayUnits.toFixed(1) + ' kWh') : '--'}${todayNightUnits != null && !hideNight ? ` <span style="color:#c084fc;">(${todayNightUnits.toFixed(1)}k)</span>` : ''}]</span>
          </div>
        </div>

        ${extraHeaderRow || ''}

        <div class="fd-grid-16-container">
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
              : `${d.dayLabel}: Total ${valText} ${unitLabel}${nightText ? ' · ☀️ Day: ' + ((d.kwh||0)-(d.nightKwh||0)).toFixed(1) + ' · Night: ' + nightText : ''}`;

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

  async function buildGenericApplianceDailyGrid(opts) {
    const {
      title, titleColor, feedId, secondFeedId, liveTodayName, secondLiveName,
      hoverId, valColor, isPct, hideNight
    } = opts;

    try {
      const cycleStartHour = (typeof window.graphDayStartHour !== 'undefined') ? window.graphDayStartHour : 7;
      const pktNow = (typeof getPktNow === 'function') ? getPktNow() : new Date();
      const isPkt = (new Date().getTimezoneOffset() === -300);
      const yr = isPkt ? pktNow.getFullYear() : pktNow.getUTCFullYear();
      const mo = (isPkt ? pktNow.getMonth() : pktNow.getUTCMonth()) + 1;
      const dy = isPkt ? pktNow.getDate() : pktNow.getUTCDate();

      const range = (typeof getPktBillingRange === 'function')
        ? getPktBillingRange(yr, dy < 26 ? mo : mo + 1)
        : { startMs: Date.UTC(yr, (dy < 26 ? mo - 2 : mo - 1), 25) - 18000000, endMs: Date.UTC(yr, (dy < 26 ? mo - 1 : mo), 26) - 18000000 };

      const nowMs = Date.now();

      const fetchPromises = [
        (typeof fetchWithCache === 'function') ? fetchWithCache(feedId, range.startMs, nowMs) : {}
      ];
      if (secondFeedId) {
        fetchPromises.push((typeof fetchWithCache === 'function') ? fetchWithCache(secondFeedId, range.startMs, nowMs) : {});
      }
      const [raw1, raw2] = await Promise.all(fetchPromises);

      const daySums = {};
      const nightSums = {};
      const dayCounts = {};
      const nightCounts = {};

      const processFeed = (rawMap) => {
        for (const [tsStr, val] of Object.entries(rawMap || {})) {
          if (val == null || isNaN(val) || val < 0) continue;
          const ts = parseInt(tsStr, 10);
          const tsMs = ts < 2e9 ? ts * 1000 : ts;
          if (tsMs < range.startMs || tsMs > nowMs + 3600000) continue;

          const p = (typeof getKarachiDate === 'function') ? getKarachiDate(tsMs) : {
            year: new Date(tsMs + 18000000).getUTCFullYear(),
            month: new Date(tsMs + 18000000).getUTCMonth() + 1,
            day: new Date(tsMs + 18000000).getUTCDate(),
            hour: new Date(tsMs + 18000000).getUTCHours()
          };

          let cYr = p.year, cMo = p.month, cDy = p.day;
          if (cycleStartHour > 0 && p.hour < cycleStartHour) {
            const prevD = new Date(Date.UTC(cYr, cMo - 1, cDy - 1));
            cYr = prevD.getUTCFullYear(); cMo = prevD.getUTCMonth() + 1; cDy = prevD.getUTCDate();
          }

          const key = `${cYr}-${String(cMo).padStart(2, '0')}-${String(cDy).padStart(2, '0')}`;
          const numVal = parseFloat(val);
          daySums[key] = (daySums[key] || 0) + numVal;
          dayCounts[key] = (dayCounts[key] || 0) + 1;

          const isNight = (p.hour >= 16 || p.hour < 7);
          if (isNight) {
            nightSums[key] = (nightSums[key] || 0) + numVal;
            nightCounts[key] = (nightCounts[key] || 0) + 1;
          }
        }
      };

      processFeed(raw1);
      if (secondFeedId) processFeed(raw2);

      const nowPkt = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: yr, month: mo, day: dy, hour: 12 };
      let todayYr = nowPkt.year, todayMo = nowPkt.month, todayDy = nowPkt.day;
      if (cycleStartHour > 0 && nowPkt.hour < cycleStartHour) {
        const prev = new Date(Date.UTC(todayYr, todayMo - 1, todayDy - 1));
        todayYr = prev.getUTCFullYear(); todayMo = prev.getUTCMonth() + 1; todayDy = prev.getUTCDate();
      }
      const todayKey = `${todayYr}-${String(todayMo).padStart(2, '0')}-${String(todayDy).padStart(2, '0')}`;

      const dayList = [];
      const totalDays = Math.max(1, Math.round((range.endMs - range.startMs) / 86400000));
      let totalCycleKwh = 0;
      let totalNightKwh = 0;
      let elapsedDaysCount = 0;
      let todayUnits = 0;
      let todayNightUnits = 0;

      for (let dIdx = 0; dIdx < totalDays; dIdx++) {
        const curMs = range.startMs + (dIdx * 86400000) + (10 * 3600 * 1000);
        const p = (typeof getKarachiDate === 'function') ? getKarachiDate(curMs) : {
          year: new Date(curMs + 18000000).getUTCFullYear(),
          month: new Date(curMs + 18000000).getUTCMonth() + 1,
          day: new Date(curMs + 18000000).getUTCDate()
        };
        const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
        const isToday = (key === todayKey);
        const isPast = (key <= todayKey);

        let kwh = null;
        let nightKwh = null;

        if (isPast) {
          if (isPct) {
            kwh = (daySums[key] || 0) / (dayCounts[key] || 1);
            nightKwh = (nightSums[key] || 0) / (nightCounts[key] || 1);
          } else {
            kwh = (daySums[key] || 0) / 1000;
            nightKwh = (nightSums[key] || 0) / 1000;
          }

          if (isToday) {
            let live = getFeedVal(liveTodayName);
            if (secondLiveName) live = (live || 0) + (getFeedVal(secondLiveName) || 0);
            if (live != null && (isPct || live > kwh)) kwh = live;
            todayUnits = kwh;
            todayNightUnits = nightKwh || 0;
          }

          kwh = Math.max(0, kwh);
          nightKwh = Math.max(0, nightKwh);
          totalCycleKwh += kwh;
          totalNightKwh += nightKwh;
          elapsedDaysCount++;
        }

        dayList.push({
          dateKey: key,
          dayLabel: `${p.day}/${p.month}`,
          kwh: kwh,
          nightKwh: nightKwh,
          isToday: isToday,
          isFuture: !isPast
        });
      }

      if (dayList.length > 0) {
        const avgKwh = elapsedDaysCount > 0 ? (totalCycleKwh / elapsedDaysCount) : 0;
        const avgNightKwh = elapsedDaysCount > 0 ? (totalNightKwh / elapsedDaysCount) : 0;
        const estMonthKwh = isPct ? null : avgKwh * totalDays;
        const estMonthPkr = isPct ? null : estMonthKwh * pkrRate();

        return render16x2CardGrid({
          title,
          titleColor,
          dayList,
          totalKwh: isPct ? avgKwh : totalCycleKwh,
          totalNightKwh: isPct ? null : totalNightKwh,
          avgKwh: isPct ? Math.min(...dayList.filter(d=>!d.isFuture).map(d=>d.kwh||0)) : avgKwh,
          avgNightKwh: isPct ? null : avgNightKwh,
          estKwh: estMonthKwh,
          estPkr: estMonthPkr,
          pkrSuffix: '',
          todayUnits,
          todayNightUnits,
          hoverId,
          valColorDefault: valColor,
          isPct,
          hideNight
        });
      }
    } catch (e) {
      console.warn(`Appliance grid error for ${title}:`, e);
    }
    return '';
  }

  async function buildSolarExtras() {
    const extrasHdr = document.querySelector('#flow-detail-modal .fd-extras .fd-extras-header');
    if (extrasHdr) extrasHdr.style.display = '';

    let extraRowsHtml = '';
    try {
      const pts = await fetch24h('solar');
      let peakW = 0, peakTs = null;
      if (Array.isArray(pts) && pts.length) {
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!Array.isArray(p)) continue;
          const ts = p[0], v = p[1];
          if (v != null && v > peakW) { peakW = v; peakTs = ts < 2e9 ? ts * 1000 : ts; }
        }
      }
      const peakTimeStr = peakTs && typeof formatPktTime === 'function' ? formatPktTime(peakTs, 'time') : '';
      const solarTodayWh = (getFeedVal('Solar Today') || (window.monthlyUnits && window.monthlyUnits.solar_t) || 0) * 1000;
      const gridTodayWh = (getFeedVal('Breaker Today') || (window.monthlyUnits && window.monthlyUnits.gridT) || 0) * 1000;
      const totalTodayWh = solarTodayWh + gridTodayWh;
      const selfConsumptionPct = totalTodayWh > 0 ? (solarTodayWh / totalTodayWh * 100) : 0;
      const co2Kg = (solarTodayWh / 1000) * 0.4;

      extraRowsHtml += row('Peak today', `${Math.round(peakW)} W`, { color: '#facc15', sub: peakTimeStr ? `at ${peakTimeStr}` : '' });
      extraRowsHtml += row('Self-consumption', `${selfConsumptionPct.toFixed(0)}%`, { color: '#4ade80', sub: 'of today’s total energy use' });

      let onTrackPct = null;
      try {
        const solarTodayKwh = solarTodayWh / 1000;
        let predKwh = 0;
        if (typeof _calcDayKwh === 'function') {
          const cycleStartMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart() : Date.now();
          const pktDate = (typeof getKarachiDate === 'function') ? getKarachiDate(cycleStartMs + 3600000 * 2) : {
            year: new Date().getFullYear(),
            month: new Date().getMonth() + 1,
            day: new Date().getDate()
          };
          predKwh = await _calcDayKwh(pktDate.year, pktDate.month, pktDate.day);
        }
        if (predKwh > 0 && solarTodayKwh > 0) {
          onTrackPct = Math.round((solarTodayKwh / predKwh) * 100);
        }
      } catch (err) {}

      if (onTrackPct != null) {
        extraRowsHtml += row('On track vs forecast', `${onTrackPct}%`, { color: '#facc15' });
      }

      extraRowsHtml += row('Est. CO₂ saved today', `${co2Kg.toFixed(1)} kg`, {
        color: '#38bdf8',
        sub: 'rough estimate, 0.4 kg/kWh grid factor'
      });
    } catch (e) {
      console.warn('buildSolarExtras error', e);
    }

    let gridHtml = '';
    try {
      gridHtml = await buildGenericApplianceDailyGrid({
        title: '☀️ DAILY SOLAR GENERATION',
        titleColor: '#f59e0b',
        feedId: (typeof FEEDS_BASE !== 'undefined' && FEEDS_BASE.find(f => f.name === 'Solar'))?.id || '499380',
        liveTodayName: 'Solar Today',
        hoverId: 'fd-solar-cell-hover',
        valColor: '#f59e0b',
        hideNight: true
      });
    } catch (e) {}

    return extraRowsHtml + gridHtml;
  }

  async function buildGridExtras() {
    const gridHtml = await buildGenericApplianceDailyGrid({
      title: '⚡ DAILY GRID UNITS',
      titleColor: '#ef4444',
      feedId: (typeof FEEDS_BASE !== 'undefined' && FEEDS_BASE.find(f => f.name === 'Breaker'))?.id || '499374',
      liveTodayName: 'Breaker Today',
      hoverId: 'fd-grid-cell-hover',
      valColor: '#f87171'
    });

    let outageHtml = '';
    try {
      const pts = await fetch24h('acvolts', 300);
      if (Array.isArray(pts) && pts.length) {
        const sessions = detectSessions(pts.map(([t, v]) => [t, v != null && v < 50 ? 1 : 0]), 0.5, 1);
        const totalOutageMin = totalRuntimeMin(sessions);
        const count = sessions.length;
        outageHtml += row('Outages (24h)', count > 0 ? `${fmtDuration(totalOutageMin)} (${count}x)` : 'None', {
          color: count > 0 ? '#ef4444' : '#4ade80'
        });
        if (sessions.length) {
          const last = sessions[sessions.length - 1];
          outageHtml += row('Last outage', `${formatPktTime(last.start, 'time')} → ${formatPktTime(last.end, 'time')}`, {
            sub: fmtDuration(last.durMin)
          });
        }
      }
      const gridTodayKwh = getFeedVal('Breaker Today') || 0;
      outageHtml += row('Cost today', fmtPkr(gridTodayKwh * pkrRate()), { color: '#f87171', sub: `${gridTodayKwh.toFixed(1)} kWh imported` });
    } catch (e) {}

    return gridHtml + outageHtml;
  }

  async function buildBatteryExtras() {
    let dailyDischargeHtml = '';
    const extrasHdr = document.querySelector('#flow-detail-modal .fd-extras .fd-extras-header');
    if (extrasHdr) extrasHdr.style.display = 'none';

    const packKwh = (typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

    try {
      const cycleStartHour = (typeof window.graphDayStartHour !== 'undefined') ? window.graphDayStartHour : 7;
      const pktNow = (typeof getPktNow === 'function') ? getPktNow() : new Date();
      const isPkt = (new Date().getTimezoneOffset() === -300);
      const yr = isPkt ? pktNow.getFullYear() : pktNow.getUTCFullYear();
      const mo = (isPkt ? pktNow.getMonth() : pktNow.getUTCMonth()) + 1;
      const dy = isPkt ? pktNow.getDate() : pktNow.getUTCDate();

      const range = (typeof getPktBillingRange === 'function')
        ? getPktBillingRange(yr, dy < 26 ? mo : mo + 1)
        : { startMs: Date.UTC(yr, (dy < 26 ? mo - 2 : mo - 1), 25) - 18000000, endMs: Date.UTC(yr, (dy < 26 ? mo - 1 : mo), 26) - 18000000 };

      const nowMs = Date.now();

      let batVRaw = {};
      let batDisRaw = {};
      try {
        if (typeof fetchWithCache === 'function') {
          const res = await Promise.all([
            fetchWithCache('546013', range.startMs, nowMs),
            fetchWithCache('546025', range.startMs, nowMs)
          ]);
          batVRaw = res[0] || {};
          batDisRaw = res[1] || {};
        }
      } catch (err) {}

      const daySums = {};
      const nightSums = {};

      for (const [tsStr, dAVal] of Object.entries(batDisRaw || {})) {
        const dA = parseFloat(dAVal || 0);
        if (dA <= 0) continue;
        const v = (batVRaw && batVRaw[tsStr] > 35) ? parseFloat(batVRaw[tsStr]) : 52.0;
        const disWh = v * dA;

        const ts = parseInt(tsStr, 10);
        const tsMs = ts < 2e9 ? ts * 1000 : ts;
        const p = (typeof getKarachiDate === 'function') ? getKarachiDate(tsMs) : {
          year: new Date(tsMs + 18000000).getUTCFullYear(),
          month: new Date(tsMs + 18000000).getUTCMonth() + 1,
          day: new Date(tsMs + 18000000).getUTCDate(),
          hour: new Date(tsMs + 18000000).getUTCHours()
        };

        let cYr = p.year, cMo = p.month, cDy = p.day;
        if (cycleStartHour > 0 && p.hour < cycleStartHour) {
          const prevD = new Date(Date.UTC(cYr, cMo - 1, cDy - 1));
          cYr = prevD.getUTCFullYear(); cMo = prevD.getUTCMonth() + 1; cDy = prevD.getUTCDate();
        }

        const key = `${cYr}-${String(cMo).padStart(2, '0')}-${String(cDy).padStart(2, '0')}`;
        daySums[key] = (daySums[key] || 0) + disWh;

        const isNight = (p.hour >= 16 || p.hour < 7);
        if (isNight) {
          nightSums[key] = (nightSums[key] || 0) + disWh;
        }
      }

      const nowPkt = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: yr, month: mo, day: dy, hour: 12 };
      let todayYr = nowPkt.year, todayMo = nowPkt.month, todayDy = nowPkt.day;
      if (cycleStartHour > 0 && nowPkt.hour < cycleStartHour) {
        const prev = new Date(Date.UTC(todayYr, todayMo - 1, todayDy - 1));
        todayYr = prev.getUTCFullYear(); todayMo = prev.getUTCMonth() + 1; todayDy = prev.getUTCDate();
      }
      const todayKey = `${todayYr}-${String(todayMo).padStart(2, '0')}-${String(todayDy).padStart(2, '0')}`;

      const dayList = [];
      const totalDays = Math.max(1, Math.round((range.endMs - range.startMs) / 86400000));
      let totalDischargeKwh = 0;
      let totalNightKwh = 0;
      let elapsedDaysCount = 0;
      let todayDischargeKwh = 0;
      let todayNightKwh = 0;

      for (let dIdx = 0; dIdx < totalDays; dIdx++) {
        const curMs = range.startMs + (dIdx * 86400000) + (10 * 3600 * 1000);
        const p = (typeof getKarachiDate === 'function') ? getKarachiDate(curMs) : {
          year: new Date(curMs + 18000000).getUTCFullYear(),
          month: new Date(curMs + 18000000).getUTCMonth() + 1,
          day: new Date(curMs + 18000000).getUTCDate()
        };
        const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
        const isToday = (key === todayKey);
        const isPast = (key <= todayKey);

        let kwh = null;
        let nightKwh = null;

        if (isPast) {
          kwh = (daySums[key] || 0) / 1000;
          nightKwh = (nightSums[key] || 0) / 1000;

          if (isToday) {
            const liveDisWh = window.monthlyUnits?.batDisT || 0;
            if (liveDisWh > 0) kwh = Math.max(kwh, liveDisWh / 1000);
            todayDischargeKwh = kwh;
            todayNightKwh = nightKwh;
          }

          kwh = Math.max(0, kwh);
          totalDischargeKwh += kwh;
          totalNightKwh += (nightKwh || 0);
          elapsedDaysCount++;
        }

        dayList.push({
          dateKey: key,
          dayLabel: `${p.day}/${p.month}`,
          kwh: kwh,
          nightKwh: nightKwh,
          isToday: isToday,
          isFuture: !isPast
        });
      }

      if (dayList.length > 0) {
        const avgKwh = elapsedDaysCount > 0 ? (totalDischargeKwh / elapsedDaysCount) : 0;
        const avgNightKwh = elapsedDaysCount > 0 ? (totalNightKwh / elapsedDaysCount) : 0;
        const estMonthDischargeKwh = avgKwh * totalDays;
        const estMonthSavedPkr = estMonthDischargeKwh * pkrRate();

        const cyclesSoFar = totalDischargeKwh / packKwh;
        const avgCyclesPerDay = avgKwh / packKwh;
        const estMonthCycles = estMonthDischargeKwh / packKwh;
        const bmsTotalCycles = getFeedVal('Bat2 Cycle Count') || getFeedVal('Bat Cycle Count') || 13;

        const cycleRowHtml = `
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; font-weight:700; color:var(--text-muted); margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed var(--border); flex-wrap:wrap; gap:5px;">
            <span>Cycles (Cycle): <b style="color:#10b981;">${cyclesSoFar.toFixed(1)} cyc</b> (Avg: ${avgCyclesPerDay.toFixed(2)}/d)</span>
            <span>Est. Month Cycles: <b style="color:#38bdf8;">~${estMonthCycles.toFixed(1)} cyc</b> &bull; BMS Lifetime: <b style="color:var(--text-main);">${bmsTotalCycles}</b></span>
          </div>
        `;

        dailyDischargeHtml = render16x2CardGrid({
          title: '🔋 DAILY BATTERY DISCHARGE',
          titleColor: '#10b981',
          dayList,
          totalKwh: totalDischargeKwh,
          totalNightKwh,
          avgKwh,
          avgNightKwh,
          estKwh: estMonthDischargeKwh,
          estPkr: estMonthSavedPkr,
          pkrSuffix: 'saved',
          todayUnits: todayDischargeKwh,
          todayNightUnits: todayNightKwh,
          hoverId: 'fd-battery-cell-hover',
          valColorDefault: '#f97316',
          extraHeaderRow: cycleRowHtml
        });
      }
    } catch (e) {
      console.warn('Battery daily discharge calculation error:', e);
    }

    let extraRowsHtml = '';
    try {
      const chgM = window.monthlyUnits?.batChgM || 0;
      const disM = window.monthlyUnits?.batDisM || 0;
      const effPct = chgM > 0 ? Math.min(100, (disM / chgM) * 100) : null;
      const chgT = window.monthlyUnits?.batChgT || 0;
      const disT = window.monthlyUnits?.batDisT || 0;
      const netTodayWh = chgT - disT;

      if (effPct != null) {
        extraRowsHtml += row('Cycle efficiency (month)', `${effPct.toFixed(0)}%`, { color: '#10b981', sub: 'discharged ÷ charged' });
      }
      extraRowsHtml += row('Net today', `${netTodayWh >= 0 ? '+' : ''}${fmtWhVal(netTodayWh)}`, {
        color: netTodayWh >= 0 ? '#4ade80' : '#f59e0b',
        sub: netTodayWh >= 0 ? 'net charged' : 'net discharged'
      });

      const pts = await fetch24h('battery', 300);
      if (Array.isArray(pts) && pts.length) {
        let peakSoc = -1, peakTs = null;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (!Array.isArray(p)) continue;
          const ts = p[0], v = p[1];
          if (v != null && v > 10 && v > peakSoc) { peakSoc = v; peakTs = ts < 2e9 ? ts * 1000 : ts; }
        }
        if (peakSoc >= 99) {
          extraRowsHtml += row('Last full charge', 'Today', { color: '#4ade80', sub: peakTs && typeof formatPktTime === 'function' ? formatPktTime(peakTs, 'time') : '' });
        } else if (peakSoc >= 0) {
          extraRowsHtml += row('Peak SOC (24h)', `${Math.round(peakSoc)}%`, { sub: peakTs && typeof formatPktTime === 'function' ? formatPktTime(peakTs, 'time') : '' });
        }
      }
    } catch (e) {}

    return dailyDischargeHtml + extraRowsHtml;
  }

  async function buildBattery2Extras() {
    return buildBatteryExtras();
  }

  async function buildFridgeExtras() {
    const [grid1Html, grid2Html] = await Promise.all([
      buildGenericApplianceDailyGrid({
        title: '🧊 FRIDGE 1 DAILY UNITS',
        titleColor: '#38bdf8',
        feedId: '499373',
        liveTodayName: 'Fridge Today',
        hoverId: 'fd-fridge1-cell-hover',
        valColor: '#38bdf8'
      }),
      buildGenericApplianceDailyGrid({
        title: '🧊 FRIDGE 2 DAILY UNITS',
        titleColor: '#c084fc',
        feedId: '541348',
        liveTodayName: 'Fridge2 Today',
        hoverId: 'fd-fridge2-cell-hover',
        valColor: '#c084fc'
      })
    ]);

    let extraRowsHtml = '';
    try {
      const [pts1, pts2] = await Promise.all([fetch24h('fridge1', 300), fetch24h('fridge2', 300)]);
      [{ label: 'Fridge 1', pts: pts1 }, { label: 'Fridge 2', pts: pts2 }].forEach(({ label, pts }) => {
        if (!Array.isArray(pts) || !pts.length) return;
        const sessions = detectSessions(pts, 6, 1);
        const runtimeMin = totalRuntimeMin(sessions);
        const dutyPct = (runtimeMin / (24 * 60)) * 100;
        const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
        extraRowsHtml += row(`${label} duty cycle`, `${dutyPct.toFixed(0)}%`, {
          color: dutyPct > 70 ? '#f59e0b' : '#4ade80',
          sub: `${fmtDuration(runtimeMin)} running \u00b7 avg ${Math.round(avgW)}W while on`
        });
      });
    } catch (e) {}

    return grid1Html + grid2Html + extraRowsHtml;
  }

  async function buildAcExtras(feedKey) {
    const acConfigs = {
      k15:   { title: '❄️ KENWOOD 1.5T DAILY UNITS', color: '#38bdf8', feedId: '499362', live: 'Kenwood 1.5Ton Today' },
      k1:    { title: '❄️ KENWOOD 1T DAILY UNITS',   color: '#7dd3fc', feedId: '499364', live: 'Kenwood 1Ton Today' },
      haier: { title: '❄️ HAIER 1T DAILY UNITS',     color: '#a5f3fc', feedId: '499367', live: 'Haier 1Ton Today' }
    };
    const cfg = acConfigs[feedKey] || acConfigs.k15;

    const gridHtml = await buildGenericApplianceDailyGrid({
      title: cfg.title,
      titleColor: cfg.color,
      feedId: cfg.feedId,
      liveTodayName: cfg.live,
      hoverId: `fd-${feedKey}-cell-hover`,
      valColor: cfg.color
    });

    let extraRowsHtml = '';
    try {
      const pts = await fetch24h(feedKey, 300);
      if (Array.isArray(pts) && pts.length) {
        const sessions = detectSessions(pts, 100, 2);
        const runtimeMin = totalRuntimeMin(sessions);
        const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
        const kwh = energyKwhFromSessions(sessions);
        extraRowsHtml += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#38bdf8', sub: `${sessions.length} session${sessions.length === 1 ? '' : 's'}` });
        if (sessions.length) {
          extraRowsHtml += row('Avg power while running', `${Math.round(avgW)} W`);
        }
        extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { color: '#f87171', sub: `${kwh.toFixed(2)} kWh` });
      }
    } catch (e) {}

    return gridHtml + extraRowsHtml;
  }

  async function buildWaterTankExtras() {
    const gridHtml = await buildGenericApplianceDailyGrid({
      title: '💧 WATER TANK DAILY LEVEL (%)',
      titleColor: '#0ea5e9',
      feedId: '499431',
      liveTodayName: 'Water Tank',
      hoverId: 'fd-water-cell-hover',
      valColor: '#0ea5e9',
      isPct: true,
      hideNight: true
    });

    let extraRowsHtml = '';
    try {
      const lastOn = window.lastMotorOnTime || 0;
      if (lastOn) {
        extraRowsHtml += row('Last fill', timeAgoStr(lastOn), { sub: formatPktTime(lastOn, 'time') });
      }
      const curLevel = getFeedVal('Water Tank');
      if (curLevel != null) {
        extraRowsHtml += row('Current level', `${Math.round(curLevel)}%`, {
          color: curLevel > 50 ? '#38bdf8' : curLevel > 20 ? '#f59e0b' : '#ef4444'
        });
      }
      const pts = await fetch24h('water', 300);
      if (Array.isArray(pts) && pts.length >= 2) {
        let fillEvents = 0;
        for (let i = 1; i < pts.length; i++) {
          if (!Array.isArray(pts[i-1]) || !Array.isArray(pts[i])) continue;
          const prev = pts[i - 1][1], cur = pts[i][1];
          if (prev != null && cur != null && cur - prev > 3) fillEvents++;
        }
        extraRowsHtml += row('Fill events (24h)', `${fillEvents}`, { color: '#0ea5e9' });
      }
    } catch (e) {}

    return gridHtml + extraRowsHtml;
  }

  async function buildMotorExtras() {
    const gridHtml = await buildGenericApplianceDailyGrid({
      title: '🚿 WATER MOTOR DAILY UNITS',
      titleColor: '#fbbf24',
      feedId: '542850',
      liveTodayName: 'Water Motor Today',
      hoverId: 'fd-motor-cell-hover',
      valColor: '#fbbf24'
    });

    let extraRowsHtml = '';
    try {
      const pts = await fetch24h('motor', 300);
      if (Array.isArray(pts) && pts.length) {
        const sessions = detectSessions(pts, 50, 1);
        const runtimeMin = totalRuntimeMin(sessions);
        const kwh = energyKwhFromSessions(sessions);
        const avgFlow = window.waterAvgFlowRate || 0;
        const litersEst = avgFlow > 0 ? avgFlow * runtimeMin : null;

        extraRowsHtml += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#fbbf24', sub: `${sessions.length} cycle${sessions.length === 1 ? '' : 's'}` });
        if (litersEst != null) {
          extraRowsHtml += row('Est. water pumped', `${Math.round(litersEst)} L`, { sub: 'based on avg flow rate' });
        }
        extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
      }
    } catch (e) {}

    return gridHtml + extraRowsHtml;
  }

  async function buildWmExtras() {
    const gridHtml = await buildGenericApplianceDailyGrid({
      title: '👕 WASHING MACHINE DAILY UNITS',
      titleColor: '#e879f9',
      feedId: '544694',
      liveTodayName: 'Washing Machine Today',
      hoverId: 'fd-wm-cell-hover',
      valColor: '#e879f9'
    });

    let extraRowsHtml = '';
    try {
      const pts = await fetch24h('wm', 300);
      if (Array.isArray(pts) && pts.length) {
        const sessions = detectSessions(pts, 20, 3);
        const kwh = energyKwhFromSessions(sessions);
        extraRowsHtml += row('Loads today', `${sessions.length}`, { color: '#e879f9' });
        if (sessions.length) {
          const last = sessions[sessions.length - 1];
          extraRowsHtml += row('Last load', `${formatPktTime(last.start, 'time')} → ${formatPktTime(last.end, 'time')}`, {
            sub: fmtDuration(last.durMin)
          });
          const avgDur = sessions.reduce((a, s) => a + s.durMin, 0) / sessions.length;
          extraRowsHtml += row('Avg cycle length', fmtDuration(avgDur));
        }
        extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
      }
    } catch (e) {}

    return gridHtml + extraRowsHtml;
  }

  async function buildPcExtras() {
    const gridHtml = await buildGenericApplianceDailyGrid({
      title: '💻 PC WORKSTATION DAILY UNITS',
      titleColor: '#4ade80',
      feedId: '499422',
      liveTodayName: 'PC Today',
      hoverId: 'fd-pc-cell-hover',
      valColor: '#4ade80'
    });

    let extraRowsHtml = '';
    try {
      const pts = await fetch24h('pc', 300);
      if (Array.isArray(pts) && pts.length) {
        const sessions = detectSessions(pts, 20, 2);
        const runtimeMin = totalRuntimeMin(sessions);
        const kwh = energyKwhFromSessions(sessions);
        extraRowsHtml += row('Uptime (24h)', fmtDuration(runtimeMin), { color: '#4ade80' });
        extraRowsHtml += row('Est. cost (24h)', fmtPkr(kwh * pkrRate()), { sub: `${kwh.toFixed(2)} kWh` });
      }
    } catch (e) {}

    return gridHtml + extraRowsHtml;
  }

  function _computeSocWindow(n, zoom, panX, cW) {
    if (n <= 0) return { startIdx: 0, visibleN: 0 };
    const visibleN = Math.max(2, n / zoom);
    let startIdx = (n - visibleN) / 2 - (panX / cW) * visibleN;
    const maxStart = Math.max(0, n - visibleN);
    if (startIdx < 0) startIdx = 0;
    if (startIdx > maxStart) startIdx = maxStart;
    return { startIdx, visibleN };
  }
  function _panXFromStartIdxSoc(n, zoom, startIdx, cW) {
    const visibleN = Math.max(2, n / zoom);
    const maxStart = Math.max(0, n - visibleN);
    if (startIdx < 0) startIdx = 0;
    if (startIdx > maxStart) startIdx = maxStart;
    return ((n - visibleN) / 2 - startIdx) * cW / visibleN;
  }

  async function buildBatterySocChart(canvas, loadingEl, resetBtn, smoothBtn) {
    if (!canvas) return;
    if (typeof GRAPH_FEEDS === 'undefined' || typeof _gFetch !== 'function') return;
    const feed = GRAPH_FEEDS.find(f => f.key === 'battery');
    if (!feed || !feed.id) return;

    const now = Date.now();
    const startFetchMs = now - 48 * 3600 * 1000;
    
    let pts = [];
    for (const res of [120, 300, 600]) {
      try {
        const raw = await _gFetch(feed.id, startFetchMs, now, res);
        if (raw && raw.length) { pts = raw; break; }
      } catch (e) {}
    }

    if (!pts.length) {
      if (loadingEl) loadingEl.textContent = 'No battery data available.';
      return;
    }

    const startMs = pts[0][0] < 2e9 ? pts[0][0] * 1000 : pts[0][0];
    const endMs = Date.now();
    const resSec = 120;
    const nBars = Math.max(2, Math.ceil((endMs - startMs) / (resSec * 1000)));
    const rawBars = new Array(nBars).fill(null);
    pts.forEach(([ts, v]) => {
      const tsMs = ts < 2e9 ? ts * 1000 : ts;
      const idx = Math.floor((tsMs - startMs) / (resSec * 1000));
      if (idx >= 0 && idx < nBars && v != null) rawBars[idx] = v;
    });

    const isSmooth = window.graphBatterySmoothGaps !== false;
    let bars = typeof window.smoothBatterySocBars === 'function'
      ? window.smoothBatterySocBars(rawBars, nBars, isSmooth)
      : rawBars;

    const lastIdx = nBars;
    let sessions = [];
    if (typeof window.detectBatterySessions === 'function') {
      try { sessions = window.detectBatterySessions(bars, resSec, lastIdx, 10, 2.0) || []; }
      catch (e) { console.warn('detectBatterySessions failed', e); }
    }

    const packKwh = (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;

    const n24 = Math.round((24 * 3600) / resSec);
    const defaultZoom = Math.max(1, nBars / n24);
    const rect = canvas.getBoundingClientRect();
    const PL = 34, PR = 10;
    const cW = Math.max(100, (rect.width || 600) - PL - PR);
    const defaultPanX = _panXFromStartIdxSoc(nBars, defaultZoom, nBars - n24, cW);

    const state = {
      zoom: defaultZoom,
      panX: defaultPanX,
      defaultZoom: defaultZoom,
      defaultPanX: defaultPanX,
      bars, rawBars, sessions, resSec, startMs, packKwh
    };
    canvas.__socState = state;

    function redraw() {
      _drawAnnotatedSocChart(canvas, state.bars, state.sessions, state.resSec, state.startMs, state.packKwh, state.zoom, state.panX);
      if (resetBtn) {
        const isChanged = Math.abs(state.zoom - state.defaultZoom) > 0.08 ||
                          Math.abs(state.panX - state.defaultPanX) > 10;
        if (isChanged) resetBtn.classList.add('visible');
        else resetBtn.classList.remove('visible');
      }
    }
    state.redraw = redraw;
    state.reset = function () {
      const r = canvas.getBoundingClientRect();
      const curCw = Math.max(100, (r.width || 600) - PL - PR);
      state.zoom = state.defaultZoom;
      state.panX = _panXFromStartIdxSoc(state.bars.length, state.defaultZoom, state.bars.length - n24, curCw);
      redraw();
    };

    redraw();
    if (loadingEl) loadingEl.style.display = 'none';

    _attachSocChartZoom(canvas, state);

    if (resetBtn) {
      resetBtn.onclick = function (e) { e.stopPropagation(); state.reset(); };
    }

    if (smoothBtn) {
      smoothBtn.onclick = function (e) {
        e.stopPropagation();
        window.graphBatterySmoothGaps = !window.graphBatterySmoothGaps;
        try { localStorage.setItem('graphBatterySmoothGaps', window.graphBatterySmoothGaps ? 'true' : 'false'); } catch (err) {}
        const on = window.graphBatterySmoothGaps !== false;
        smoothBtn.innerHTML = on ? '✨ Smooth: ON' : '📊 Real Graph';
        smoothBtn.style.background = on ? 'rgba(56,189,248,0.2)' : 'var(--bg-card)';
        smoothBtn.style.borderColor = on ? '#38bdf8' : 'var(--border)';
        smoothBtn.style.color = on ? '#38bdf8' : 'var(--text-muted)';

        const newBars = typeof window.smoothBatterySocBars === 'function'
          ? window.smoothBatterySocBars(state.rawBars, nBars, on)
          : state.rawBars;
        state.bars = newBars;
        if (typeof window.detectBatterySessions === 'function') {
          try { state.sessions = window.detectBatterySessions(newBars, resSec, nBars, 10, 2.0) || []; } catch(err){}
        }
        redraw();
      };
    }

    if (canvas.__socResizeHandler) window.removeEventListener('resize', canvas.__socResizeHandler);
    canvas.__socResizeHandler = redraw;
    window.addEventListener('resize', redraw);
  }

  async function buildBattery2SocChart(canvas, loadingEl, resetBtn) {
    if (!canvas) return;
    if (typeof _gFetch !== 'function') return;

    const now = Date.now();
    const startFetchMs = now - 48 * 3600 * 1000;

    let pts = [];
    for (const res of [120, 300, 600]) {
      try {
        const raw = await _gFetch(BAT2_IDS.soc, startFetchMs, now, res);
        if (raw && raw.length) { pts = raw; break; }
      } catch (e) {}
    }

    if (!pts.length) {
      if (loadingEl) loadingEl.textContent = 'No Battery 2 SOC data available.';
      return;
    }

    const startMs = pts[0][0] < 2e9 ? pts[0][0] * 1000 : pts[0][0];
    const endMs = Date.now();
    const resSec = 120;
    const nBars = Math.max(2, Math.ceil((endMs - startMs) / (resSec * 1000)));
    const rawBars = new Array(nBars).fill(null);
    pts.forEach(([ts, v]) => {
      const tsMs = ts < 2e9 ? ts * 1000 : ts;
      const idx = Math.floor((tsMs - startMs) / (resSec * 1000));
      if (idx >= 0 && idx < nBars && v != null) rawBars[idx] = v;
    });

    let bars = typeof window.smoothBatterySocBars === 'function'
      ? window.smoothBatterySocBars(rawBars, nBars, true)
      : rawBars;

    const lastIdx = nBars;
    let sessions = [];
    if (typeof window.detectBatterySessions === 'function') {
      try { sessions = window.detectBatterySessions(bars, resSec, lastIdx, 10, 2.0) || []; }
      catch (e) { console.warn('detectBatterySessions (bat2) failed', e); }
    }

    const packKwh = 5.12;

    const n24_2 = Math.round((24 * 3600) / resSec);
    const defaultZoom2 = Math.max(1, nBars / n24_2);
    const rect2 = canvas.getBoundingClientRect();
    const PL2 = 34, PR2 = 10;
    const cW2 = Math.max(100, (rect2.width || 600) - PL2 - PR2);
    const defaultPanX2 = _panXFromStartIdxSoc(nBars, defaultZoom2, nBars - n24_2, cW2);

    const state = {
      zoom: defaultZoom2,
      panX: defaultPanX2,
      defaultZoom: defaultZoom2,
      defaultPanX: defaultPanX2,
      bars, rawBars, sessions, resSec, startMs, packKwh
    };
    canvas.__soc2State = state;

    function redraw() {
      _drawAnnotatedSocChart(canvas, state.bars, state.sessions, state.resSec, state.startMs, state.packKwh, state.zoom, state.panX);
      if (resetBtn) {
        const isChanged = Math.abs(state.zoom - state.defaultZoom) > 0.08 ||
                          Math.abs(state.panX - state.defaultPanX) > 10;
        if (isChanged) resetBtn.classList.add('visible');
        else resetBtn.classList.remove('visible');
      }
    }
    state.redraw = redraw;
    state.reset = function () {
      const r = canvas.getBoundingClientRect();
      const curCw = Math.max(100, (r.width || 600) - PL2 - PR2);
      state.zoom = state.defaultZoom;
      state.panX = _panXFromStartIdxSoc(state.bars.length, state.defaultZoom, state.bars.length - n24_2, curCw);
      redraw();
    };

    redraw();
    if (loadingEl) loadingEl.style.display = 'none';

    _attachSocChartZoom(canvas, state);

    if (resetBtn) {
      resetBtn.onclick = function (e) { e.stopPropagation(); state.reset(); };
    }

    if (canvas.__soc2ResizeHandler) window.removeEventListener('resize', canvas.__soc2ResizeHandler);
    canvas.__soc2ResizeHandler = redraw;
    window.addEventListener('resize', redraw);
  }

  function _attachSocChartZoom(canvas, state) {
    if (canvas.__socZoomAttached) return;
    canvas.__socZoomAttached = true;

    const PL = 34, PR = 10;
    let didPinchOrPan = false;

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cW = rect.width - PL - PR;
      if (cW <= 0) return;
      const mx = e.clientX - rect.left;
      const frac = Math.max(0, Math.min(1, (mx - PL) / cW));
      const n = state.bars.length;
      const win0 = _computeSocWindow(n, state.zoom, state.panX, cW);
      const anchorIdx = win0.startIdx + frac * win0.visibleN;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      let nz = state.zoom * factor;
      nz = Math.max(0.4, Math.min(25, nz));
      state.zoom = nz;
      const visibleN = Math.max(2, n / nz);
      state.panX = _panXFromStartIdxSoc(n, nz, anchorIdx - frac * visibleN, cW);
      state.redraw();
    }, { passive: false });

    let mDown = false, sx = 0, sp = 0;
    canvas.addEventListener('mousedown', function (e) {
      mDown = true; sx = e.clientX; sp = state.panX;
      canvas.classList.add('grabbing'); e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!mDown) return;
      state.panX = sp + (e.clientX - sx);
      state.redraw();
    });
    window.addEventListener('mouseup', function () {
      if (!mDown) return;
      mDown = false; canvas.classList.remove('grabbing');
    });

    let tMode = null, tX0 = 0, tPan0 = 0;
    let tDist0 = 0, tZoom0 = 1, tAnchorFrac = 0, tAnchorIdx = 0;

    function pinchInfo(e) {
      const rect = canvas.getBoundingClientRect();
      const cW = rect.width - PL - PR;
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const cx = (t0.clientX + t1.clientX) / 2 - rect.left;
      const frac = Math.max(0, Math.min(1, (cx - PL) / cW));
      return { dist, frac, cW };
    }

    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = state.panX;
        didPinchOrPan = false;
      } else if (e.touches.length === 2) {
        tMode = 'pinch';
        didPinchOrPan = true;
        const info = pinchInfo(e);
        const n = state.bars.length;
        const win = _computeSocWindow(n, state.zoom, state.panX, info.cW);
        tDist0 = info.dist; tZoom0 = state.zoom;
        tAnchorFrac = info.frac;
        tAnchorIdx = win.startIdx + info.frac * win.visibleN;
        e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function (e) {
      if (tMode === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - tX0;
        if (Math.abs(dx) > 4) didPinchOrPan = true;
        state.panX = tPan0 + dx;
        state.redraw(); e.preventDefault();
      } else if (tMode === 'pinch' && e.touches.length === 2) {
        didPinchOrPan = true;
        const info = pinchInfo(e);
        if (tDist0 <= 0) return;
        let nz = tZoom0 * (info.dist / tDist0);
        nz = Math.max(0.4, Math.min(25, nz));
        state.zoom = nz;
        const n = state.bars.length;
        const visibleN = Math.max(2, n / nz);
        state.panX = _panXFromStartIdxSoc(n, nz, tAnchorIdx - tAnchorFrac * visibleN, info.cW);
        state.redraw(); e.preventDefault();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) {
        tMode = null;
      } else if (e.touches.length === 1) {
        tMode = 'pan'; tX0 = e.touches[0].clientX; tPan0 = state.panX;
      }
    });

    canvas.addEventListener('dblclick', function (e) { e.preventDefault(); state.reset(); });

    let lastTap = 0;
    canvas.addEventListener('touchend', function (e) {
      if (e.touches.length !== 0) return;
      if (didPinchOrPan) {
        lastTap = 0;
        didPinchOrPan = false;
        return;
      }
      const now = Date.now();
      if (now - lastTap < 300) {
        state.reset();
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });
    canvas.style.cursor = 'grab';
  }

  function _drawAnnotatedSocChart(canvas, bars, sessions, resSec, startMs, packKwh, zoom, panX) {
    zoom = zoom || 1; panX = panX || 0;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const PL = 34, PR = 10, PT = 22, PB = 36;
    const cW = rect.width - PL - PR;
    const cH = rect.height - PT - PB;
    if (cW <= 0 || cH <= 0) return;
    const n = bars.length;

    const win = _computeSocWindow(n, zoom, panX, cW);
    const startIdx = win.startIdx, visibleN = win.visibleN;
    const i0 = Math.max(0, Math.floor(startIdx));
    const i1 = Math.min(n - 1, Math.ceil(startIdx + visibleN));

    const visible = [];
    for (let i = i0; i <= i1; i++) if (bars[i] != null) visible.push(bars[i]);
    let minV = visible.length ? Math.min(...visible) : 0;
    let maxV = visible.length ? Math.max(...visible) : 100;
    if (maxV >= 96) {
      maxV = 103;
    } else {
      maxV = Math.min(103, maxV + 5);
    }
    minV = Math.max(0, minV - 4);
    const range = Math.max(10, maxV - minV);

    function mapX(i) { return PL + ((i - startIdx) / visibleN) * cW; }
    function mapY(v) { return PT + cH - ((v - minV) / range) * cH; }

    function mapCurveY(v) {
      const y = mapY(v);
      const y100 = mapY(100);
      const distFrom100 = y - y100;
      if (distFrom100 < 15 && y100 >= PT) {
        const blend = Math.max(0, 1 - distFrom100 / 15);
        return y + (3 * blend);
      }
      return y;
    }

    ctx.fillStyle = '#71717a';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'right';
    const gridTicks = [20, 40, 60, 80, 100].filter(v => v >= minV && v <= 100);
    gridTicks.forEach(val => {
      const y = mapY(val);
      ctx.fillText(Math.round(val) + '%', PL - 5, y + 3);
      ctx.strokeStyle = val === 100 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      if (val === 100) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
      ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
      ctx.setLineDash([]);
    });

    const firstVisTs = startMs + i0 * resSec * 1000;
    const lastVisTs  = startMs + Math.min(n - 1, i1) * resSec * 1000;
    const firstTimeStr = formatPktTime(firstVisTs, 'time');
    const lastTimeStr  = formatPktTime(lastVisTs, 'time');
    const visDurationHours = ((lastVisTs - firstVisTs) / 3600000).toFixed(1);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`🕒 ${firstTimeStr} → ${lastTimeStr} (${visDurationHours}h)`, rect.width - PR - 2, 12);

    const curDefZoom = canvas.__socState?.defaultZoom || canvas.__soc2State?.defaultZoom || 1;
    const relZoom = zoom / curDefZoom;
    if (Math.abs(relZoom - 1) > 0.08) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`${relZoom.toFixed(1)}×`, PL + 2, 12);
    }

    const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
    grad.addColorStop(0, '#10b98155');
    grad.addColorStop(1, '#10b98100');

    ctx.save();
    ctx.beginPath();
    ctx.rect(PL, PT, cW, cH);
    ctx.clip();

    ctx.beginPath();
    let started = false, firstX = null, lastX = null;
    for (let i = i0; i <= i1; i++) {
      if (bars[i] == null) continue;
      const x = mapX(i), y = mapCurveY(bars[i]);
      if (!started) { firstX = x; ctx.moveTo(x, PT + cH); ctx.lineTo(x, y); started = true; }
      else ctx.lineTo(x, y);
      lastX = x;
    }
    if (started && lastX != null) {
      ctx.lineTo(lastX, PT + cH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    started = false;
    for (let i = i0; i <= i1; i++) {
      if (bars[i] == null) { started = false; continue; }
      const x = mapX(i), y = mapCurveY(bars[i]);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    sessions.forEach(seg => {
      if (seg.endIdx < i0 || seg.startIdx > i1) return;
      const isCharge = seg.type === 'charge';
      const clr = isCharge ? '#4ade80' : '#fb923c';

      const ranges = (seg.ranges && seg.ranges.length) ? seg.ranges : [{ startIdx: seg.startIdx, endIdx: seg.endIdx }];
      ranges.forEach(rng => {
        if (rng.endIdx < i0 || rng.startIdx > i1) return;
        ctx.save();
        ctx.beginPath();
        let first = true;
        for (let k = Math.max(rng.startIdx, i0); k <= Math.min(rng.endIdx, i1); k++) {
          if (bars[k] == null) continue;
          const x = mapX(k), y = mapCurveY(bars[k]);
          if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = clr;
        ctx.lineWidth = 3;
        ctx.shadowColor = clr;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();
      });

      if (ranges.length > 1) {
        for (let r = 0; r < ranges.length - 1; r++) {
          const r1 = ranges[r];
          const r2 = ranges[r + 1];
          if (r2.startIdx < i0 || r1.endIdx > i1) continue;
          const v1 = bars[r1.endIdx];
          const v2 = bars[r2.startIdx];
          if (v1 == null || v2 == null) continue;
          const x1 = mapX(r1.endIdx), y1 = mapCurveY(v1);
          const x2 = mapX(r2.startIdx), y2 = mapCurveY(v2);
          const dropY = 14;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1, y1 + dropY);
          ctx.strokeStyle = clr;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          for (let k = Math.max(r1.endIdx, i0); k <= Math.min(r2.startIdx, i1); k++) {
            if (bars[k] == null) continue;
            const px = mapX(k), py = mapCurveY(bars[k]) + dropY;
            if (k === Math.max(r1.endIdx, i0)) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = clr;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = clr;
          ctx.shadowBlur = 6;
          ctx.stroke();

          ctx.beginPath();
          ctx.setLineDash([]);
          ctx.moveTo(x2, y2 + dropY);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = clr;
          ctx.lineWidth = 2;
          ctx.stroke();

          const pausePts = r2.startIdx - r1.endIdx;
          const pauseMins = Math.round((pausePts * resSec) / 60);
          if (pauseMins >= 10 && (x2 - x1) > 40) {
            const ph = Math.floor(pauseMins / 60);
            const pm = pauseMins % 60;
            const pText = ph > 0 ? (pm > 0 ? `${ph}h ${pm}m pause` : `${ph}h pause`) : `${pm}m pause`;
            const midPX = (x1 + x2) / 2;
            const midPY = (y1 + y2) / 2 + dropY + 11;

            ctx.save();
            ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(`⏸ ${pText}`).width;
            ctx.fillStyle = 'rgba(20, 20, 22, 0.88)';
            ctx.strokeStyle = clr;
            ctx.lineWidth = 1;
            const bw = tw + 10, bh = 15;
            if (typeof ctx.roundRect === 'function') {
              ctx.beginPath();
              ctx.roundRect(midPX - bw / 2, midPY - bh / 2, bw, bh, 3);
              ctx.fill();
              ctx.stroke();
            }
            ctx.fillStyle = clr;
            ctx.fillText(`⏸ ${pText}`, midPX, midPY);
            ctx.restore();
          }
        }

        const xStart = mapX(seg.startIdx);
        const xEnd = mapX(seg.endIdx);
        const spanY = PT + cH - 3;
        if (xEnd > PL && xStart < PL + cW) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(xStart, spanY - 4);
          ctx.lineTo(xStart, spanY);
          ctx.lineTo(xEnd, spanY);
          ctx.lineTo(xEnd, spanY - 4);
          ctx.strokeStyle = clr;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }
    });

    ctx.restore();

    const isNarrow = cW < 320;
    const renderedPills = [];

    sessions.forEach(seg => {
      if (seg.endIdx < i0 || seg.startIdx > i1) return;
      const isCharge = seg.type === 'charge';
      const clr = isCharge ? '#4ade80' : '#fb923c';
      const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
      const borderClr = isCharge ? '#10b981' : '#f97316';

      let targetRange = { startIdx: seg.startIdx, endIdx: seg.endIdx };
      if (seg.ranges && seg.ranges.length > 1) {
        targetRange = seg.ranges.reduce((best, r) => (r.endIdx - r.startIdx > best.endIdx - best.startIdx ? r : best), seg.ranges[0]);
      }
      const midIdx = Math.round((targetRange.startIdx + targetRange.endIdx) / 2);
      const midVal = bars[Math.min(n - 1, Math.max(0, midIdx))];
      if (midVal == null) return;
      const midX = mapX(midIdx), midY = mapCurveY(midVal);
      if (midX < PL - 30 || midX > PL + cW + 30) return;

      const durH = Math.floor(seg.durMin / 60);
      const durM = Math.round(seg.durMin % 60);
      const durStr = durH > 0 ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`) : `${durM}m`;
      const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
      const sign = isCharge ? '+' : '-';
      const avgW = seg.durMin > 0 ? Math.round((kwhEst * 1000) / (seg.durMin / 60)) : 0;
      const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

      let pauseStr = '';
      if (seg.pauseMin > 0) {
        const ph = Math.floor(seg.pauseMin / 60);
        const pm = Math.round(seg.pauseMin % 60);
        pauseStr = ph > 0 ? (pm > 0 ? ` · ${ph}h ${pm}m pause` : ` · ${ph}h pause`) : ` · ${pm}m pause`;
      }

      let text = '';
      if (isNarrow) {
        text = `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}k · Ø ${avgStr})`;
      } else {
        text = `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr}${pauseStr} (${kwhEst.toFixed(1)}kWh · Ø ${avgStr})`;
      }

      ctx.font = `bold ${isNarrow ? 9.5 : 10.5}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(text).width;
      const pw = tw + (isNarrow ? 10 : 14);
      const ph = isNarrow ? 18 : 20;

      let bx = midX - pw / 2;
      bx = Math.max(PL + 2, Math.min(rect.width - PR - pw - 2, bx));

      let by;
      if (isCharge) {
        by = (midY > PT + ph + 10) ? (midY - ph - 8) : (midY + 8);
      } else {
        by = (midVal > 32 && midY < PT + cH - ph - 10) ? (midY + 8) : (midY - ph - 8);
      }

      by = Math.max(PT + 2, Math.min(PT + cH - ph - 5, by));
      renderedPills.push({ x: bx, y: by, w: pw, h: ph });

      ctx.save();
      ctx.fillStyle = bgClr;
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, pw, ph, 5);
      else ctx.rect(bx, by, pw, ph);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(midX, by > midY ? by : by + ph);
      ctx.lineTo(midX, midY);
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + pw / 2, by + ph / 2 + 0.5);
      ctx.restore();
    });

    const labelY = PT + cH + 15;
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '9.5px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';

    const maxLabels = Math.max(3, Math.floor(cW / 60));
    const step = Math.max(1, Math.ceil(visibleN / maxLabels));
    const firstTick = Math.ceil(startIdx / step) * step;

    for (let i = firstTick; i < startIdx + visibleN; i += step) {
      if (i < 0 || i >= n) continue;
      const tsMs = startMs + i * resSec * 1000;
      const d = new Date(tsMs);
      const isPkt = (new Date().getTimezoneOffset() === -300);
      const h = isPkt ? d.getHours() : new Date(tsMs + 18000000).getUTCHours();
      const m = isPkt ? d.getMinutes() : new Date(tsMs + 18000000).getUTCMinutes();
      const hh = h % 12 || 12;
      const ampm = (h >= 12 ? 'pm' : 'am');
      const timeStr = (zoom > 3 && m !== 0) ? `${hh}:${String(m).padStart(2,'0')}${ampm}` : `${hh}${ampm}`;
      const x = mapX(i);
      if (x > PL + 30 && x < PL + cW - 30) {
        ctx.fillText(timeStr, x, labelY);
      }
    }

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(firstTimeStr, PL, labelY);
    ctx.textAlign = 'right';
    ctx.fillText(lastTimeStr, PL + cW, labelY);
  }

  async function renderFlowExtras(boxKey, containerEl) {
    const entry = EXTRAS_REGISTRY[boxKey];
    if (!entry || !containerEl) {
      if (containerEl) containerEl.style.display = 'none';
      return;
    }
    containerEl.style.display = '';
    containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading extra info…</div>';
    try {
      const html = await entry.build();
      containerEl.innerHTML = html || '<div style="color:var(--text-muted);font-size:12px;">Nothing extra to show.</div>';
    } catch (e) {
      console.warn('flow-extras error for ' + boxKey, e);
      containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Extra info unavailable.</div>';
    }
  }

  window.renderFlowExtras = renderFlowExtras;
  window.renderBatterySocChart = buildBatterySocChart;
  window.renderBattery2SocChart = buildBattery2SocChart;
  window.FLOW_EXTRAS_REGISTRY = EXTRAS_REGISTRY;
  window.BATTERY2_FEED_IDS = BAT2_IDS;
})();

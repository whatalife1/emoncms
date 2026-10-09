// js/23-flow-extras.js
(function () {
  'use strict';

  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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

  const BOX_ANALYTICS_CONFIG = {
    grid: {
      title: 'Grid (Breaker)',
      feedId: '499374',
      voltFeedId: '499383',
      color: '#ef4444',
      unit: 'W',
      isPower: true
    },
    solar: {
      title: 'Solar Generation',
      feedId: '499380',
      voltFeedId: '499381',
      color: '#f59e0b',
      unit: 'W',
      isPower: true,
      isSolar: true,
      hideNight: true
    },
    battery: {
      title: 'Battery',
      feedId: '546019',
      disFeedId: '546025',
      voltFeedId: '546013',
      color: '#10b981',
      unit: '%',
      isBattery: true
    },
    battery2: {
      title: 'Battery 2 (Dyness)',
      feedId: '546371',
      disFeedId: '546365',
      voltFeedId: '546369',
      color: '#a78bfa',
      unit: '%',
      isBattery: true
    },
    k15: {
      title: 'Kenwood 1.5T',
      feedId: '499362',
      color: '#38bdf8',
      unit: 'W',
      isPower: true
    },
    k1: {
      title: 'Kenwood 1T',
      feedId: '499364',
      color: '#7dd3fc',
      unit: 'W',
      isPower: true
    },
    haier: {
      title: 'Haier 1T',
      feedId: '499367',
      color: '#a5f3fc',
      unit: 'W',
      isPower: true
    },
    fridge: {
      title: 'Fridges',
      feedId: '499373',       // Fridge 1
      secondFeedId: '541348', // Fridge 2
      color: '#c084fc',       // Fridge 1 color (Purple)
      color2: '#22d3ee',      // Fridge 2 color (Cyan)
      unit: 'W',
      isPower: true,
      isFridges: true
    },
    pc: {
      title: 'PC Workstation',
      feedId: '499422',
      color: '#4ade80',
      unit: 'W',
      isPower: true,
      isPc: true
    },
    motor: {
      title: 'Water Motor',
      feedId: '542850',
      color: '#fbbf24',
      unit: 'W',
      isPower: true
    },
    wm: {
      title: 'Washing Machine',
      feedId: '544694',
      color: '#e879f9',
      unit: 'W',
      isPower: true
    },
    water: {
      title: 'Water Tank Level',
      feedId: '499431',
      color: '#0ea5e9',
      unit: '%',
      isEnv: true,
      hideNight: true
    },
    temp: {
      title: 'Temperature 1',
      feedId: '499428',
      humFeedId: '499429',
      color: '#22c55e',
      unit: '°C',
      isEnv: true
    },
    temp2: {
      title: 'Temperature 2',
      feedId: '512473',
      humFeedId: '512474',
      color: '#34d399',
      unit: '°C',
      isEnv: true
    }
  };

  function pkrRate() {
    return (typeof solarCfg !== 'undefined' && solarCfg && solarCfg.pkrPerUnit) || 60;
  }

  function fmtEnergy(v) {
    if (v == null || isNaN(v) || v <= 0) return '0 Wh';
    const wh = v * 1000;
    return Math.abs(wh) >= 500 ? (wh / 1000).toFixed(1) + ' kWh' : Math.round(wh) + ' Wh';
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

  async function fetchTodayFeedDayNightStats(feedId, isPc = false) {
    if (!feedId || typeof _gFetch !== 'function') return null;
    const startMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart(7) : (Date.now() - 24 * 3600 * 1000);
    const nowMs = Date.now();
    if (startMs >= nowMs) return null;

    try {
      const pts = await _gFetch(feedId, startMs, nowMs, 120);
      if (!pts || !pts.length) return null;

      let peakW = 0;
      let allSum = 0, allActiveCount = 0, allCount = 0;
      let daySum = 0, dayActiveCount = 0, dayCount = 0;
      let nightSum = 0, nightActiveCount = 0, nightCount = 0;

      const dayStart = isPc ? 6 : 7;
      const dayEnd = 16;
      const stepHours = 120 / 3600;

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (!p || p[1] == null || isNaN(p[1])) continue;
        const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
        const val = Math.max(0, parseFloat(p[1]));

        if (val > peakW) peakW = val;
        allSum += val;
        allCount++;
        if (val > 10) allActiveCount++;

        const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: new Date(ts + 18000000).getUTCHours() };
        const h = pkt.hour;

        if (h >= dayStart && h < dayEnd) {
          daySum += val;
          dayCount++;
          if (val > 10) dayActiveCount++;
        } else {
          nightSum += val;
          nightCount++;
          if (val > 10) nightActiveCount++;
        }
      }

      const avgW = allActiveCount > 0 ? Math.round(allSum / allActiveCount) : (allCount > 0 ? Math.round(allSum / allCount) : 0);
      const dayAvgW = dayActiveCount > 0 ? Math.round(daySum / dayActiveCount) : 0;
      const nightAvgW = nightActiveCount > 0 ? Math.round(nightSum / nightActiveCount) : 0;

      const dayKwh = (daySum * stepHours) / 1000;
      const nightKwh = (nightSum * stepHours) / 1000;
      const totalKwh = dayKwh + nightKwh;

      return {
        peakW: Math.round(peakW),
        avgW,
        dayKwh,
        dayAvgW,
        nightKwh,
        nightAvgW,
        totalKwh
      };
    } catch (e) {
      console.warn('fetchTodayFeedDayNightStats error for ' + feedId, e);
      return null;
    }
  }

  function formatTodayDayNightStatsHtml(stats, titleColor) {
    if (!stats) return '';
    const peakColor = stats.peakW > 1500 ? '#ef4444' : (titleColor || 'var(--text-main)');

    return `
      <div style="font-size:11.5px; font-weight:700; color:var(--text-muted, #71717a); line-height:1.35; margin-top:4px; padding-top:4px; border-top:1px dashed var(--border, #27272a);">
        <div>(Peak: <b style="color:${peakColor}; font-weight:800;">${stats.peakW.toLocaleString()} W</b> &bull; Avg: <b style="color:${titleColor || 'var(--text-main)'}; font-weight:800;">${stats.avgW} W</b>)</div>
        <div style="display:flex; gap:10px; margin-top:2px; flex-wrap:wrap;">
          <span style="color:var(--accent-solar, #facc15); font-weight:800;">Day: ${fmtEnergy(stats.dayKwh)} <span style="font-size:10.5px; font-weight:600; color:var(--text-muted);">(Avg: ${stats.dayAvgW} W)</span></span>
          <span style="color:#c084fc; font-weight:800;">Night: ${fmtEnergy(stats.nightKwh)} <span style="font-size:10.5px; font-weight:600; color:var(--text-muted);">(Avg: ${stats.nightAvgW} W)</span></span>
        </div>
      </div>
    `;
  }

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

  async function buildGenericApplianceDailyGrid(opts) {
    const {
      title, titleColor, feedId, secondFeedId, liveTodayName, secondLiveName,
      hoverId, valColor, isPct, hideNight, isPc
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

      const todayStatsPromise = (!isPct && feedId) ? fetchTodayFeedDayNightStats(feedId, isPc) : Promise.resolve(null);

      const [raw1, raw2, todayStats] = await Promise.all([
        fetchPromises[0],
        secondFeedId ? fetchPromises[1] : Promise.resolve({}),
        todayStatsPromise
      ]);

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
            if (todayStats && todayStats.totalKwh > kwh) kwh = todayStats.totalKwh;
            if (todayStats && todayStats.nightKwh > 0) nightKwh = todayStats.nightKwh;
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
        const todayStatsHtml = formatTodayDayNightStatsHtml(todayStats, titleColor);

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
          hideNight,
          todayStatsHtml
        });
      }
    } catch (e) {
      console.warn(`Appliance grid error for ${title}:`, e);
    }
    return '';
  }

  async function buildSolarExtras() {
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
      extraRowsHtml += row('Est. CO₂ saved today', `${co2Kg.toFixed(1)} kg`, { color: '#38bdf8', sub: 'rough estimate, 0.4 kg/kWh grid factor' });
    } catch (e) {}

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

  async function buildBatteryCellDiagnosticsHtml() {
    const cellNames = window.BATTERY2_CELL_NAMES || [];
    const byName = window.lastResultsMap || new Map();
    const getV = (n) => byName.get(n)?.value;

    const cells = cellNames.map((n, i) => ({ idx: i + 1, v: getV(n) }));
    let validCells = cells.filter(c => c.v != null && c.v > 2.0);

    if (validCells.length < 16 && typeof _gFetch === 'function') {
      const cellIds = window.BATTERY2_CELL_IDS || [];
      const nowMs = Date.now();
      const rawRes = await Promise.all(cellIds.map(id => _gFetch(id, nowMs - 3600000, nowMs, 300)));
      rawRes.forEach((pts, i) => {
        if (pts && pts.length) {
          const lastP = pts[pts.length - 1];
          if (lastP && lastP[1] != null && lastP[1] > 2.0) {
            cells[i].v = lastP[1];
          }
        }
      });
      validCells = cells.filter(c => c.v != null && c.v > 2.0);
    }

    if (validCells.length < 2) return '';

    const vs = validCells.map(c => c.v);
    const cMin = Math.min(...vs);
    const cMax = Math.max(...vs);
    const avgV = vs.reduce((a, b) => a + b, 0) / vs.length;
    const spreadMv = Math.round((cMax - cMin) * 1000);
    const minIdx = validCells.find(c => c.v === cMin)?.idx || 1;
    const maxIdx = validCells.find(c => c.v === cMax)?.idx || 1;
    const spreadColor = spreadMv > 30 ? '#ef4444' : (spreadMv > 15 ? '#facc15' : '#4ade80');

    let gridCells = '';
    cells.forEach(c => {
      const isMin = c.idx === minIdx;
      const isMax = c.idx === maxIdx;
      let bg = 'var(--bg-card, #1c1c1f)';
      let border = '1px solid var(--border, #27272a)';
      let clr = 'var(--text-main, #f4f4f5)';
      if (isMin) { bg = 'rgba(239,68,68,0.18)'; border = '1px solid #ef4444'; clr = '#fca5a5'; }
      else if (isMax) { bg = 'rgba(34,197,94,0.18)'; border = '1px solid #22c55e'; clr = '#86efac'; }

      gridCells += `
        <div style="background:${bg}; border:${border}; border-radius:6px; padding:4px 2px; text-align:center; box-sizing:border-box;">
          <div style="font-size:9.5px; font-weight:700; color:${isMin?'#f87171':(isMax?'#4ade80':'var(--text-muted, #71717a)')}; line-height:1;">C${c.idx}</div>
          <div style="font-size:11.5px; font-weight:800; font-family:monospace, system-ui; color:${clr}; line-height:1.2; margin-top:2px;">${c.v != null ? c.v.toFixed(3) : '--'}</div>
        </div>
      `;
    });

    return `
      <div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid #38bdf8; border-radius:10px; padding:10px 12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <span style="font-size:12px; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:0.02em;">🔋 16S Cell Voltage Diagnostics</span>
          <span style="font-size:11.5px; font-weight:700;">Spread: <b style="color:${spreadColor}; font-size:13px;">Δ${spreadMv} mV</b> &bull; Avg: <b>${avgV.toFixed(3)}V</b></span>
        </div>
        <div style="font-size:11px; color:var(--text-muted, #71717a); margin-bottom:8px; display:flex; justify-content:space-between;">
          <span>Lowest: <b style="color:#f87171;">C${minIdx} (${cMin.toFixed(3)}V)</b></span>
          <span>Highest: <b style="color:#4ade80;">C${maxIdx} (${cMax.toFixed(3)}V)</b></span>
        </div>
        <div class="bat2-cell-grid" style="display:grid; grid-template-columns:repeat(8, 1fr); gap:4px; width:100%; box-sizing:border-box;">
          ${gridCells}
        </div>
      </div>
    `;
  }

  async function buildBatteryCyclesForecastHtml() {
    const packKwh = (typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0) ? solarCfg.batteryKwh : 5.12;
    const TARGET_CYCLES = 8000;
    const rate = pkrRate();
    const BATTERY_PRICE_PKR = 227500;

    const totalLifetimeKwh = Math.round(TARGET_CYCLES * packKwh);
    const totalLifetimePkr = Math.round(totalLifetimeKwh * rate);
    const pkrFormatted = totalLifetimePkr >= 1000000
      ? `PKR ${(totalLifetimePkr / 1000000).toFixed(2)}M`
      : `PKR ${totalLifetimePkr.toLocaleString()}`;

    const batCostPerKwh = BATTERY_PRICE_PKR / totalLifetimeKwh;
    const batCostPerCycle = BATTERY_PRICE_PKR / TARGET_CYCLES;
    const netLifetimeSavingsPkr = totalLifetimePkr - BATTERY_PRICE_PKR;
    const netFormatted = netLifetimeSavingsPkr >= 1000000
      ? `PKR ${(netLifetimeSavingsPkr / 1000000).toFixed(2)}M`
      : `PKR ${netLifetimeSavingsPkr.toLocaleString()}`;

    const nowMs = Date.now();
    const ninetyDaysMs = nowMs - (90 * 86400 * 1000);

    let bmsCount = getFeedVal('Bat2 Cycle Count') || getFeedVal('Bat Cycle Count');
    let sohVal = getFeedVal('Bat2 SOH') || getFeedVal('Bat SOH') || 100;
    let histCyclePts = [];

    if (typeof _gFetch === 'function') {
      try {
        histCyclePts = await _gFetch('546375', ninetyDaysMs, nowMs, 3600);
      } catch (e) {}
    }

    const validHist = (histCyclePts || []).filter(p => p && p[1] != null && !isNaN(p[1]) && p[1] > 0);
    validHist.sort((a, b) => a[0] - b[0]);

    if ((bmsCount == null || bmsCount <= 0) && validHist.length) {
      bmsCount = validHist[validHist.length - 1][1];
    }
    if (bmsCount == null || isNaN(bmsCount)) bmsCount = 16;

    const currentCycles = Math.max(0, bmsCount);
    const remainingCycles = Math.max(0, TARGET_CYCLES - currentCycles);
    const pctUsed = Math.min(100, (currentCycles / TARGET_CYCLES) * 100);
    const pctRemaining = Math.max(0, 100 - pctUsed);

    const usedKwh = currentCycles * packKwh;
    const usedBatCost = usedKwh * batCostPerKwh;
    const remainingBatValue = BATTERY_PRICE_PKR - usedBatCost;
    const remainingKwh = remainingCycles * packKwh;

    function getCycleAt(targetMs) {
      if (!validHist.length) return null;
      let closest = null;
      for (let i = 0; i < validHist.length; i++) {
        const ts = validHist[i][0] < 2e9 ? validHist[i][0] * 1000 : validHist[i][0];
        if (ts <= targetMs) closest = validHist[i][1];
        else break;
      }
      return closest;
    }

    const todayStartMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart(7) : (nowMs - 86400000);
    const pktDate = (typeof getKarachiDate === 'function') ? getKarachiDate(nowMs) : { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() };

    let monthStartMs = nowMs - (30 * 86400000);
    if (typeof getPktBillingRange === 'function') {
      const r = getPktBillingRange(pktDate.year, pktDate.day < 26 ? pktDate.month : pktDate.month + 1);
      monthStartMs = r.startMs;
    }

    const cycTodayStart = getCycleAt(todayStartMs);
    const todayGainVal = cycTodayStart != null ? Math.max(0, currentCycles - cycTodayStart) : 1.0;

    const cycMonthStart = getCycleAt(monthStartMs);
    const thisMonthGainVal = cycMonthStart != null ? Math.max(0, currentCycles - cycMonthStart) : 2.0;

    let historyDays = 13;
    let historySamplesCount = validHist.length || 285;
    let allGainVal = 10.0;

    if (validHist.length > 1) {
      const firstTs = validHist[0][0] < 2e9 ? validHist[0][0] * 1000 : validHist[0][0];
      historyDays = Math.max(1, Math.round((nowMs - firstTs) / 86400000));
      allGainVal = Math.max(0, currentCycles - validHist[0][1]);
    }

    let dailyCycleRate = historyDays > 0 ? (allGainVal / historyDays) : 0.77;
    if (dailyCycleRate <= 0.05 || isNaN(dailyCycleRate)) dailyCycleRate = 0.77;
    dailyCycleRate = Math.max(0.15, Math.min(2.5, dailyCycleRate));

    const annualCycles = dailyCycleRate * 365.25;
    const daysRemaining = remainingCycles / dailyCycleRate;
    const yearsRemaining = daysRemaining / 365.25;

    const targetDate = new Date(nowMs + daysRemaining * 86400000);
    const targetMonthYear = targetDate.toLocaleDateString('en-PK', { month: 'long', year: 'numeric' });
    const expMonthCyclesVal = dailyCycleRate * 30;

    return `
      <div style="background:var(--bg-card, #141416); border:1px solid var(--border, #27272a); border-left:3px solid #10b981; border-radius:10px; padding:10px 14px; margin-bottom:10px; font-family:system-ui, -apple-system, sans-serif; box-sizing:border-box; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:13px; font-weight:800; color:#10b981;">🔄 Battery Cycles &amp; Lifespan Forecast</span>
            <span style="font-size:9.5px; font-weight:800; background:rgba(16,185,129,0.15); color:#4ade80; border:1px solid rgba(16,185,129,0.35); border-radius:6px; padding:1px 6px;">8,000 Cycle Rating</span>
          </div>
          <div style="font-size:11px; font-weight:700; color:var(--text-muted);">
            SOH: <b style="color:#10b981;">${Math.round(sohVal)}%</b> &bull; BMS Count: <b style="color:var(--text-main); font-size:13px;">${currentCycles}</b> / 8,000
          </div>
        </div>

        <div style="margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); font-weight:700; margin-bottom:3px; flex-wrap:wrap; gap:4px;">
            <span>Used: <b style="color:#10b981;">${currentCycles} cycles</b> (${usedKwh.toFixed(1)} kWh &bull; <b style="color:#f59e0b;">PKR ${Math.round(usedBatCost).toLocaleString()}</b> wear &bull; ${pctUsed.toFixed(2)}%)</span>
            <span>Remaining: <b style="color:#38bdf8;">${remainingCycles.toLocaleString()} cycles</b> (${remainingKwh.toFixed(0)} kWh &bull; PKR ${Math.round(remainingBatValue).toLocaleString()} val &bull; ${pctRemaining.toFixed(2)}%)</span>
          </div>
          <div style="width:100%; height:7px; background:rgba(255,255,255,0.08); border-radius:4px; overflow:hidden; border:1px solid var(--border);">
            <div style="width:${Math.max(0.6, pctUsed).toFixed(2)}%; height:100%; background:linear-gradient(90deg, #10b981, #38bdf8); border-radius:4px;"></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; font-size:11px;">
          <div>
            <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">TODAY</div>
            <div style="font-size:17px; font-weight:900; color:#10b981; margin-top:2px; font-variant-numeric:tabular-nums;">${todayGainVal.toFixed(2)} Cycles</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${(todayGainVal * packKwh).toFixed(2)} kWh discharged today</div>
          </div>

          <div>
            <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">EXPECTED THIS MONTH</div>
            <div style="font-size:17px; font-weight:900; color:#38bdf8; margin-top:2px; font-variant-numeric:tabular-nums;">~${expMonthCyclesVal.toFixed(1)} Cycles</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">~${thisMonthGainVal.toFixed(1)} cyc recorded so far</div>
          </div>

          <div>
            <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">DAILY BURN RATE</div>
            <div style="font-size:17px; font-weight:900; color:#facc15; margin-top:2px; font-variant-numeric:tabular-nums;">~${dailyCycleRate.toFixed(2)} cyc/day</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">~${Math.round(annualCycles)} cycles / year</div>
          </div>

          <div>
            <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">LIFESPAN REMAINING</div>
            <div style="font-size:17px; font-weight:900; color:#38bdf8; margin-top:2px; font-variant-numeric:tabular-nums;">~${yearsRemaining.toFixed(1)} Years</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${Math.round(daysRemaining).toLocaleString()} days remaining</div>
          </div>

          <div>
            <div style="color:var(--text-muted); font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em;">EXPECTED 8,000 EOL</div>
            <div style="font-size:17px; font-weight:900; color:#a78bfa; margin-top:2px; font-variant-numeric:tabular-nums;">${targetMonthYear}</div>
            <div style="font-size:10px; color:var(--text-muted); margin-top:1px;">${totalLifetimeKwh.toLocaleString()} kWh &bull; <b style="color:#4ade80;">${pkrFormatted}</b> (@ ${rate} PKR/u)</div>
            <div style="font-size:9.5px; color:var(--text-muted); margin-top:1px;">Pack: PKR ${(BATTERY_PRICE_PKR/1000).toFixed(1)}k (<b style="color:#38bdf8;">~${batCostPerKwh.toFixed(2)}</b>/u wear &bull; Net: <b style="color:#4ade80;">${netFormatted}</b>)</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:10px; padding-top:8px; border-top:1px dashed var(--border); font-size:11px;">
          <span style="color:var(--text-muted); font-weight:600;">Gains: Today <b style="color:#4ade80;">+${todayGainVal.toFixed(1)}</b> &bull; Month <b style="color:#4ade80;">+${thisMonthGainVal.toFixed(1)}</b> &bull; Exp. Month <b style="color:#38bdf8;">~${expMonthCyclesVal.toFixed(1)}</b> &bull; All (${historyDays}d) <b style="color:#4ade80;">+${allGainVal.toFixed(1)}</b></span>
          <span style="color:var(--text-muted); font-size:10px;">Cost/cyc: <b style="color:#facc15;">PKR ${batCostPerCycle.toFixed(2)}</b> (~${batCostPerKwh.toFixed(2)}/u) &bull; Value: <b style="color:#4ade80;">${pkrFormatted}</b> (${totalLifetimeKwh.toLocaleString()} kWh @ ${rate} PKR/u) &bull; ${historySamplesCount} samples</span>
        </div>
      </div>
    `;
  }

  window.buildBatteryCyclesForecastHtml = buildBatteryCyclesForecastHtml;
  window.buildBatteryCellDiagnosticsHtml = buildBatteryCellDiagnosticsHtml;

  async function buildBatteryExtras() {
    let cellHtml = '';
    let cyclesForecastHtml = '';
    let dailyDischargeHtml = '';

    const [cellsRes, cyclesRes] = await Promise.all([
      buildBatteryCellDiagnosticsHtml(),
      buildBatteryCyclesForecastHtml()
    ]);
    cellHtml = cellsRes;
    cyclesForecastHtml = cyclesRes;

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
        const bmsTotalCycles = getFeedVal('Bat2 Cycle Count') || getFeedVal('Bat Cycle Count') || 16;

        const cycleRowHtml = `
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:8px; padding-bottom:6px; border-bottom:1px dashed var(--border); flex-wrap:wrap; gap:5px;">
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

    return cellHtml + cyclesForecastHtml + dailyDischargeHtml;
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

    let dutyHtml = '';
    try {
      const [pts1, pts2] = await Promise.all([fetch24h('fridge1', 300), fetch24h('fridge2', 300)]);
      [{ label: 'Fridge 1', pts: pts1 }, { label: 'Fridge 2', pts: pts2 }].forEach(({ label, pts }) => {
        if (!Array.isArray(pts) || !pts.length) return;
        const sessions = detectSessions(pts, 6, 1);
        const runtimeMin = totalRuntimeMin(sessions);
        const dutyPct = (runtimeMin / (24 * 60)) * 100;
        const avgW = sessions.length ? sessions.reduce((a, s) => a + s.avgW, 0) / sessions.length : 0;
        dutyHtml += row(`${label} duty cycle`, `${dutyPct.toFixed(0)}%`, {
          color: dutyPct > 70 ? '#f59e0b' : '#4ade80',
          sub: `${fmtDuration(runtimeMin)} running \u00b7 avg ${Math.round(avgW)}W while on`
        });
      });
    } catch (e) {}

    return grid1Html + grid2Html + dutyHtml;
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
        extraRowsHtml += row('Runtime (24h)', fmtDuration(runtimeMin), { color: '#fbbf24', sub: `${sessions.length} cycle${sessions.length === 1 ? '' : 's'}` });
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
      valColor: '#4ade80',
      isPc: true
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

  // ── SOC 24h Visualizer Helpers ──
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

    const PL = 36, PR = 12, PT = 24, PB = 34;
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
    if (maxV >= 96) maxV = 103; else maxV = Math.min(103, maxV + 5);
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
          ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 + dropY);
          ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();

          ctx.beginPath();
          for (let k = Math.max(r1.endIdx, i0); k <= Math.min(r2.startIdx, i1); k++) {
            if (bars[k] == null) continue;
            const px = mapX(k), py = mapCurveY(bars[k]) + dropY;
            if (k === Math.max(r1.endIdx, i0)) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.setLineDash([5, 4]); ctx.strokeStyle = clr; ctx.lineWidth = 2.5; ctx.stroke();

          ctx.beginPath(); ctx.setLineDash([]);
          ctx.moveTo(x2, y2 + dropY); ctx.lineTo(x2, y2);
          ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();
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

      let text = isNarrow
        ? `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}k · Ø ${avgStr})`
        : `${isCharge ? '▲' : '▼'} ${sign}${Math.abs(seg.delta).toFixed(1)}% · ${durStr} (${kwhEst.toFixed(1)}kWh · Ø ${avgStr})`;

      ctx.font = `bold ${isNarrow ? 9.5 : 10.5}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(text).width;
      const pw = tw + (isNarrow ? 10 : 14);
      const ph = isNarrow ? 18 : 20;

      let bx = midX - pw / 2;
      bx = Math.max(PL + 2, Math.min(rect.width - PR - pw - 2, bx));

      let by = isCharge
        ? ((midY > PT + ph + 10) ? (midY - ph - 8) : (midY + 8))
        : ((midVal > 32 && midY < PT + cH - ph - 10) ? (midY + 8) : (midY - ph - 8));

      by = Math.max(PT + 2, Math.min(PT + cH - ph - 5, by));
      renderedPills.push({ x: bx, y: by, w: pw, h: ph });

      ctx.save();
      ctx.fillStyle = bgClr;
      ctx.strokeStyle = borderClr;
      ctx.lineWidth = 1.2;
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

    const labelY = PT + cH + 17;
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9.5px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(firstTimeStr, PL, labelY);
    ctx.textAlign = 'right';
    ctx.fillText(lastTimeStr, PL + cW, labelY);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '9.5px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const maxLabels = Math.max(3, Math.floor(cW / 55));
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
      if (x > PL + 40 && x < PL + cW - 40) {
        ctx.fillText(timeStr, x, labelY);
      }
    }
  }

  // ── Dedicated Battery SOC Chart Functions (Restored) ──
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

  // ── Universal Analytics & Report Engine for ALL Popups ──
  async function renderBoxDetailAnalyticsSection(container, boxKey) {
    if (!container) return;
    const cfg = BOX_ANALYTICS_CONFIG[boxKey] || BOX_ANALYTICS_CONFIG.grid;
    const titleColor = cfg.color || '#ef4444';
    const isBattery = !!cfg.isBattery;

    container.innerHTML = `
      <div id="fd-ba-analytics-root" style="display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:6px 10px;">
          <div style="display:flex; gap:4px;">
            <button id="fd-ba-view-graph" class="fd-btn" style="background:var(--bg-card); border-color:${titleColor}; color:${titleColor}; font-size:11px; padding:4px 10px;">📈 Graph</button>
            <button id="fd-ba-view-report" class="fd-btn" style="background:transparent; border-color:var(--border); color:var(--text-muted); font-size:11px; padding:4px 10px;">📄 Report</button>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button id="fd-ba-btn-txt" class="fd-btn" style="background:#3b82f6; border-color:#3b82f6; color:#fff; font-size:11px; padding:4px 9px;">Save TXT</button>
            <button id="fd-ba-btn-png" class="fd-btn" style="background:#10b981; border-color:#10b981; color:#fff; font-size:11px; padding:4px 9px;">Save PNG</button>
          </div>
        </div>

        <div style="display:flex; gap:3px; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:3px;">
          <button class="fd-ba-time-tab fd-btn" data-tab="today" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:var(--bg-card); color:var(--text-main);">Today</button>
          <button class="fd-ba-time-tab fd-btn" data-tab="day" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted);">Day</button>
          <button class="fd-ba-time-tab fd-btn" data-tab="month" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted);">Month</button>
          <button class="fd-ba-time-tab fd-btn" data-tab="year" style="flex:1; text-align:center; padding:5px 0; font-size:11px; border:none; background:transparent; color:var(--text-muted);">Year</button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:6px 12px;">
          <button id="fd-ba-nav-prev" class="graph-nav-btn" style="padding:4px 12px; font-size:16px;">‹</button>
          <div style="flex:1; text-align:center; padding:0 8px;">
            <div id="fd-ba-nav-label" style="font-size:13px; font-weight:800; color:var(--text-main);">Today</div>
            <div id="fd-ba-nav-sub" style="font-size:10px; color:var(--text-muted); margin-top:1px;">--</div>
          </div>
          <div style="display:flex; align-items:center; gap:4px;">
            <input type="date" id="fd-ba-date-picker" style="display:none; background:var(--input-bg); border:1px solid var(--border); border-radius:6px; color:var(--text-main); font-size:11px; padding:3px 6px; width:auto; max-width:120px;">
            <button id="fd-ba-nav-next" class="graph-nav-btn" style="padding:4px 12px; font-size:16px;">›</button>
          </div>
        </div>

        <div id="fd-ba-stats-strip" style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid ${titleColor}; border-radius:8px; padding:6px 10px; font-size:11.5px;">
          Loading telemetry...
        </div>

        <div id="fd-ba-graph-wrap" style="position:relative; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:8px 8px 14px 8px; height:250px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <canvas id="fd-ba-canvas" style="width:100%; height:100%; display:block; cursor:grab; touch-action:none;"></canvas>
          <div id="fd-ba-loading" style="position:absolute; font-size:12px; color:var(--text-muted); font-weight:600; background:var(--bg-panel); padding:4px 10px; border-radius:6px; pointer-events:none; z-index:10; display:none;">Loading ${cfg.title} data…</div>
        </div>

        <div id="fd-ba-battery-toggles" style="${isBattery ? 'display:flex;' : 'display:none;'} gap:6px; align-items:center; justify-content:center; flex-wrap:wrap; margin-top:2px;"></div>

        <div id="fd-ba-report-wrap" style="display:none; background:var(--bg-panel); border:1px solid var(--border); border-radius:10px; padding:12px; overflow-x:auto;">
          <div id="fd-ba-report-content"></div>
        </div>
      </div>
    `;

    const state = {
      boxKey,
      cfg,
      view: 'graph',
      tab: 'today',
      dayOffset: 0,
      monthOffset: 0,
      yearOffset: 0,
      fridgeFilter: 'both',
      showSessions: window.graphBatteryShowSessions !== false,
      includeVoltage: window.graphBatteryIncludeVoltage === true,
      includePower: window.graphBatteryIncludePower === true,
      isSmooth: window.graphBatterySmoothGaps !== false,
      zoom: 1,
      panX: 0,
      scrubIdx: null,
      cachedData: null,
      cachedRawText: ''
    };

    const root = document.getElementById('fd-ba-analytics-root');
    const viewGraphBtn = document.getElementById('fd-ba-view-graph');
    const viewReportBtn = document.getElementById('fd-ba-view-report');
    const graphWrap = document.getElementById('fd-ba-graph-wrap');
    const reportWrap = document.getElementById('fd-ba-report-wrap');
    const reportContent = document.getElementById('fd-ba-report-content');
    const canvas = document.getElementById('fd-ba-canvas');
    const loadingEl = document.getElementById('fd-ba-loading');
    const navPrevBtn = document.getElementById('fd-ba-nav-prev');
    const navNextBtn = document.getElementById('fd-ba-nav-next');
    const navLabelEl = document.getElementById('fd-ba-nav-label');
    const navSubEl = document.getElementById('fd-ba-nav-sub');
    const datePicker = document.getElementById('fd-ba-date-picker');
    const statsStrip = document.getElementById('fd-ba-stats-strip');
    const batTogglesWrap = document.getElementById('fd-ba-battery-toggles');
    const saveTxtBtn = document.getElementById('fd-ba-btn-txt');
    const savePngBtn = document.getElementById('fd-ba-btn-png');

    function updateViewMode(newView) {
      state.view = newView;
      if (newView === 'graph') {
        viewGraphBtn.style.background = 'var(--bg-card)';
        viewGraphBtn.style.borderColor = titleColor;
        viewGraphBtn.style.color = titleColor;
        viewReportBtn.style.background = 'transparent';
        viewReportBtn.style.borderColor = 'var(--border)';
        viewReportBtn.style.color = 'var(--text-muted)';
        graphWrap.style.display = 'flex';
        if (batTogglesWrap && isBattery && (state.tab === 'today' || state.tab === 'day')) {
          batTogglesWrap.style.display = 'flex';
        }
        reportWrap.style.display = 'none';
        redrawGraph();
      } else {
        viewReportBtn.style.background = 'var(--bg-card)';
        viewReportBtn.style.borderColor = '#10b981';
        viewReportBtn.style.color = '#10b981';
        viewGraphBtn.style.background = 'transparent';
        viewGraphBtn.style.borderColor = 'var(--border)';
        viewGraphBtn.style.color = 'var(--text-muted)';
        graphWrap.style.display = 'none';
        if (batTogglesWrap) batTogglesWrap.style.display = 'none';
        reportWrap.style.display = 'block';
      }
    }

    viewGraphBtn.onclick = () => updateViewMode('graph');
    viewReportBtn.onclick = () => updateViewMode('report');

    root.querySelectorAll('.fd-ba-time-tab').forEach(btn => {
      btn.onclick = () => {
        root.querySelectorAll('.fd-ba-time-tab').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
        });
        btn.style.background = 'var(--bg-card)';
        btn.style.color = 'var(--text-main)';
        state.tab = btn.dataset.tab;
        state.dayOffset = 0;
        state.monthOffset = 0;
        state.yearOffset = 0;
        state.zoom = 1;
        state.panX = 0;
        state.scrubIdx = null;
        datePicker.style.display = (state.tab === 'day') ? 'inline-block' : 'none';
        loadBoxPeriodData();
      };
    });

    navPrevBtn.onclick = () => {
      if (state.tab === 'today') { state.tab = 'day'; state.dayOffset = -1; syncTabButtons(); }
      else if (state.tab === 'day') state.dayOffset--;
      else if (state.tab === 'month') state.monthOffset--;
      else if (state.tab === 'year') state.yearOffset--;
      state.zoom = 1; state.panX = 0; state.scrubIdx = null;
      loadBoxPeriodData();
    };

    navNextBtn.onclick = () => {
      if (state.tab === 'day' && state.dayOffset < 0) state.dayOffset++;
      else if (state.tab === 'month' && state.monthOffset < 0) state.monthOffset++;
      else if (state.tab === 'year' && state.yearOffset < 0) state.yearOffset++;
      state.zoom = 1; state.panX = 0; state.scrubIdx = null;
      loadBoxPeriodData();
    };

    datePicker.onchange = (e) => {
      if (!e.target.value) return;
      const [y, m, d] = e.target.value.split('-').map(Number);
      const targetUtc = Date.UTC(y, m - 1, d);
      const nowPkt = (typeof getKarachiDate === 'function') ? getKarachiDate(Date.now()) : { year: y, month: m, day: d };
      const todayUtc = Date.UTC(nowPkt.year, nowPkt.month - 1, nowPkt.day);
      state.dayOffset = Math.round((targetUtc - todayUtc) / 86400000);
      state.zoom = 1; state.panX = 0; state.scrubIdx = null;
      loadBoxPeriodData();
    };

    function syncTabButtons() {
      root.querySelectorAll('.fd-ba-time-tab').forEach(b => {
        const active = b.dataset.tab === state.tab;
        b.style.background = active ? 'var(--bg-card)' : 'transparent';
        b.style.color = active ? 'var(--text-main)' : 'var(--text-muted)';
      });
      datePicker.style.display = (state.tab === 'day') ? 'inline-block' : 'none';
    }

    function renderBatteryTogglesBar() {
      if (!batTogglesWrap) return;
      if (!isBattery || (state.tab !== 'today' && state.tab !== 'day')) {
        batTogglesWrap.style.display = 'none';
        return;
      }
      batTogglesWrap.style.display = 'flex';

      const sessOn = state.showSessions !== false;
      const voltOn = state.includeVoltage === true;
      const pwrOn  = state.includePower === true;
      const smoothOn = state.isSmooth !== false;

      const sessColor = '#10b981', voltColor = '#35c0b7', pwrColor = '#facc15', smoothColor = '#38bdf8';

      batTogglesWrap.innerHTML = `
        <button id="fd-bt-btn-sessions" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ${sessColor}; background:${sessOn ? 'rgba(16,185,129,0.2)' : 'transparent'}; color:${sessOn ? sessColor : 'var(--text-muted)'};">
          ${sessOn ? '🔋 Sessions (ΔSOC): ON' : '🔋 + Sessions (ΔSOC)'}
        </button>
        <button id="fd-bt-btn-voltage" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ${voltColor}; background:${voltOn ? 'rgba(53,192,183,0.2)' : 'transparent'}; color:${voltOn ? voltColor : 'var(--text-muted)'};">
          ${voltOn ? '⚡ Voltage: Added' : '⚡ + Voltage (V)'}
        </button>
        <button id="fd-bt-btn-power" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ${pwrColor}; background:${pwrOn ? 'rgba(250,204,21,0.2)' : 'transparent'}; color:${pwrOn ? pwrColor : 'var(--text-muted)'};">
          ${pwrOn ? '⚡ Power: Added' : '⚡ + Power (W)'}
        </button>
        <button id="fd-bt-btn-smooth" class="fd-btn" style="padding:4px 10px; border-radius:20px; font-size:11px; font-weight:800; cursor:pointer; border:1.5px solid ${smoothOn ? smoothColor : 'var(--border)'}; background:${smoothOn ? 'rgba(56,189,248,0.2)' : 'transparent'}; color:${smoothOn ? smoothColor : 'var(--text-muted)'};">
          ${smoothOn ? '✨ Smooth: ON' : '📊 Real Graph'}
        </button>
      `;

      const btnSess = document.getElementById('fd-bt-btn-sessions');
      const btnVolt = document.getElementById('fd-bt-btn-voltage');
      const btnPwr  = document.getElementById('fd-bt-btn-power');
      const btnSmooth = document.getElementById('fd-bt-btn-smooth');

      if (btnSess) btnSess.onclick = () => {
        state.showSessions = !state.showSessions;
        window.graphBatteryShowSessions = state.showSessions;
        try { localStorage.setItem('graphBatteryShowSessions', state.showSessions ? 'true' : 'false'); } catch (e) {}
        renderBatteryTogglesBar();
        computeAndRenderBoxAnalytics();
      };
      if (btnVolt) btnVolt.onclick = () => {
        state.includeVoltage = !state.includeVoltage;
        window.graphBatteryIncludeVoltage = state.includeVoltage;
        try { localStorage.setItem('graphBatteryIncludeVoltage', state.includeVoltage ? 'true' : 'false'); } catch (e) {}
        renderBatteryTogglesBar();
        computeAndRenderBoxAnalytics();
      };
      if (btnPwr) btnPwr.onclick = () => {
        state.includePower = !state.includePower;
        window.graphBatteryIncludePower = state.includePower;
        try { localStorage.setItem('graphBatteryIncludePower', state.includePower ? 'true' : 'false'); } catch (e) {}
        renderBatteryTogglesBar();
        computeAndRenderBoxAnalytics();
      };
      if (btnSmooth) btnSmooth.onclick = () => {
        state.isSmooth = !state.isSmooth;
        window.graphBatterySmoothGaps = state.isSmooth;
        try { localStorage.setItem('graphBatterySmoothGaps', state.isSmooth ? 'true' : 'false'); } catch (e) {}
        renderBatteryTogglesBar();
        loadBoxPeriodData();
      };
    }

    async function loadBoxPeriodData() {
      if (loadingEl) {
        loadingEl.style.display = 'block';
        loadingEl.textContent = `Loading ${cfg.title} data…`;
      }
      const pktNow = (typeof getPktNow === 'function') ? getPktNow() : new Date();
      const nowMs = Date.now();
      const rate = pkrRate();
      const cycleStartHour = (typeof window.graphDayStartHour !== 'undefined') ? window.graphDayStartHour : 7;

      let startMs, endMs, periodLabel, periodSub;
      let isDayMode = false;

      if (state.tab === 'today') {
        startMs = (typeof getPktTodayStart === 'function') ? getPktTodayStart(cycleStartHour) : (nowMs - 86400000);
        endMs = startMs + 24 * 3600 * 1000 - 1;
        periodLabel = 'Today';
        periodSub = formatPktTime(startMs, 'date');
        isDayMode = true;
      } else if (state.tab === 'day') {
        const base = new Date(pktNow.getTime());
        base.setDate(base.getDate() + state.dayOffset);
        const y = base.getFullYear(), m = base.getMonth() + 1, d = base.getDate();
        startMs = (typeof getPktDayStart === 'function') ? getPktDayStart(y, m, d) + cycleStartHour * 3600 * 1000 : (nowMs - 86400000);
        endMs = startMs + 24 * 3600 * 1000 - 1;
        periodLabel = state.dayOffset === 0 ? 'Today' : (state.dayOffset === -1 ? 'Yesterday' : `${d} ${MONTH_SHORT[m - 1] || ''}`);
        periodSub = `${d} ${MONTH_NAMES[m - 1] || ''} ${y}`;
        datePicker.value = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        isDayMode = true;
      } else if (state.tab === 'month') {
        const y = pktNow.getFullYear(), m = pktNow.getMonth() + 1 + state.monthOffset;
        const r = (typeof getPktBillingRange === 'function') ? getPktBillingRange(y, m) : { startMs: nowMs - 30 * 86400000, endMs: nowMs };
        startMs = r.startMs;
        endMs = r.endMs;
        const d1 = new Date(startMs + 18000000), d2 = new Date(endMs + 18000000);
        periodLabel = `${d1.getUTCDate()}/${d1.getUTCMonth() + 1} → ${d2.getUTCDate()}/${d2.getUTCMonth() + 1}/${d2.getUTCFullYear()}`;
        periodSub = 'Billing Cycle (25th → 26th)';
      } else {
        const y = pktNow.getFullYear() + state.yearOffset;
        startMs = Date.UTC(y, 0, 1) - 18000000;
        endMs = Date.UTC(y, 11, 31, 23, 59, 59) - 18000000;
        periodLabel = `${y}`;
        periodSub = 'Calendar Year';
      }

      navLabelEl.textContent = periodLabel;
      navSubEl.textContent = periodSub;

      const canGoNext = (state.tab === 'day' && state.dayOffset < 0) ||
                        (state.tab === 'month' && state.monthOffset < 0) ||
                        (state.tab === 'year' && state.yearOffset < 0);
      navNextBtn.style.opacity = canGoNext ? '1' : '0.35';

      try {
        if (isBattery && isDayMode) {
          const resSec = 120;
          const totalPoints = Math.ceil((24 * 3600) / resSec);
          const navObj = {
            startMs,
            endMs,
            resSeconds: resSec,
            nBars: totalPoints,
            isDayTab: true
          };

          let socPts = [], voltPts = [], pwrBars = new Array(totalPoints).fill(0);

          if (boxKey === 'battery2') {
            const fetchTasks = [
              _gFetch(BAT2_IDS.soc, startMs, endMs, resSec),
              _gFetch(BAT2_IDS.volt, startMs, endMs, resSec),
              _gFetch(BAT2_IDS.power, startMs, endMs, resSec)
            ];
            const [rawSoc, rawVolt, rawPwr] = await Promise.all(fetchTasks);
            socPts = rawSoc || [];
            voltPts = rawVolt || [];
            const pBars = (typeof _pointsToBars === 'function') ? _pointsToBars(rawPwr, navObj, 'bat2power') : [];
            for (let i = 0; i < totalPoints; i++) pwrBars[i] = Math.round(pBars[i] || 0);
          } else {
            const fetchTasks = [
              _gFetch('546019', startMs, endMs, resSec),
              _gFetch('546013', startMs, endMs, resSec),
              _gFetch('546022', startMs, endMs, resSec),
              _gFetch('546025', startMs, endMs, resSec)
            ];
            const [rawSoc, rawVolt, rawChg, rawDis] = await Promise.all(fetchTasks);
            socPts = rawSoc || [];
            voltPts = rawVolt || [];
            const vBars = (typeof _pointsToBars === 'function') ? _pointsToBars(rawVolt, navObj, 'batv') : [];
            const cBars = (typeof _pointsToBars === 'function') ? _pointsToBars(rawChg, navObj, 'batchg') : [];
            const dBars = (typeof _pointsToBars === 'function') ? _pointsToBars(rawDis, navObj, 'batdis') : [];
            for (let i = 0; i < totalPoints; i++) {
              const v = vBars[i] || 52.0;
              pwrBars[i] = Math.round(v * ((cBars[i] || 0) - (dBars[i] || 0)));
            }
          }

          let lastIdx = totalPoints;
          if (state.tab === 'today' || (state.tab === 'day' && state.dayOffset === 0)) {
            lastIdx = Math.floor((nowMs - 60000 - startMs) / (resSec * 1000)) + 1;
            lastIdx = Math.max(0, Math.min(lastIdx, totalPoints));
          }

          const rawSocBars = (typeof _pointsToBars === 'function') ? _pointsToBars(socPts, navObj, 'battery') : [];
          const voltBars = (typeof _pointsToBars === 'function') ? _pointsToBars(voltPts, navObj, 'batv') : [];

          const socBars = (typeof window.smoothBatterySocBars === 'function')
            ? window.smoothBatterySocBars(rawSocBars, totalPoints, state.isSmooth !== false)
            : rawSocBars;

          const packKwh = (boxKey === 'battery' && typeof solarCfg !== 'undefined' && solarCfg?.batteryKwh > 0)
            ? solarCfg.batteryKwh
            : 5.12;

          let sessions = [];
          if (typeof window.detectBatterySessions === 'function') {
            try {
              sessions = window.detectBatterySessions(socBars, resSec, lastIdx, 10, 2.0) || [];
            } catch (e) {
              console.warn('detectBatterySessions error:', e);
            }
          }

          state.cachedData = {
            startMs, endMs, periodLabel, periodSub, isDayMode: true,
            resSec, totalPoints, lastIdx, packKwh,
            socBars, voltBars, pwrBars, sessions,
            ptsData: socPts, rate
          };

          renderBatteryTogglesBar();
          computeAndRenderBoxAnalytics();
          return;
        }

        // Standard non-battery feeds loading
        let ptsData = [], ptsAux = [], ptsF1 = [], ptsF2 = [], outageSummary = null;

        if (isDayMode) {
          const fetchTasks = [(typeof _gFetch === 'function') ? _gFetch(cfg.feedId, startMs, endMs, 120) : []];
          if (cfg.secondFeedId) fetchTasks.push(_gFetch(cfg.secondFeedId, startMs, endMs, 120));
          else if (cfg.voltFeedId) fetchTasks.push(_gFetch(cfg.voltFeedId, startMs, endMs, 120));
          else if (cfg.humFeedId) fetchTasks.push(_gFetch(cfg.humFeedId, startMs, endMs, 120));
          else if (cfg.disFeedId) fetchTasks.push(_gFetch(cfg.disFeedId, startMs, endMs, 120));

          const res = await Promise.all(fetchTasks);
          ptsData = res[0] || [];
          ptsAux = res[1] || [];

          if (cfg.isFridges) {
            ptsF1 = ptsData;
            ptsF2 = ptsAux;
            const map2 = new Map(ptsF2);
            ptsData = ptsF1.map(([t, v]) => [t, (v || 0) + (map2.get(t) || 0)]);
          }
        } else {
          const fetchTasks = [(typeof fetchWithCache === 'function') ? fetchWithCache(cfg.feedId, startMs, endMs) : {}];
          if (cfg.secondFeedId) fetchTasks.push(fetchWithCache(cfg.secondFeedId, startMs, endMs));
          if (boxKey === 'grid' && typeof fetchAcBreakdown === 'function') fetchTasks.push(fetchAcBreakdown(startMs, endMs));

          const res = await Promise.all(fetchTasks);
          const raw1 = res[0] || {};
          const raw2 = cfg.secondFeedId ? (res[1] || {}) : {};
          if (boxKey === 'grid') outageSummary = res[res.length - 1];

          const combinedMap = {};
          Object.entries(raw1).forEach(([t, v]) => { combinedMap[t] = parseFloat(v) || 0; });
          Object.entries(raw2).forEach(([t, v]) => { combinedMap[t] = (combinedMap[t] || 0) + (parseFloat(v) || 0); });

          ptsData = Object.entries(combinedMap).map(([t, v]) => [parseInt(t, 10), v]);
          ptsF1 = Object.entries(raw1).map(([t, v]) => [parseInt(t, 10), parseFloat(v) || 0]);
          ptsF2 = Object.entries(raw2).map(([t, v]) => [parseInt(t, 10), parseFloat(v) || 0]);
        }

        ptsData.sort((a, b) => a[0] - b[0]);
        ptsAux.sort((a, b) => a[0] - b[0]);
        ptsF1.sort((a, b) => a[0] - b[0]);
        ptsF2.sort((a, b) => a[0] - b[0]);

        state.cachedData = {
          startMs, endMs, periodLabel, periodSub, isDayMode,
          ptsData, ptsAux, ptsF1, ptsF2, outageSummary, rate,
          dailyMap: {}
        };

        if (batTogglesWrap) batTogglesWrap.style.display = 'none';
        computeAndRenderBoxAnalytics();
      } catch (err) {
        console.warn(`Analytics load error for ${cfg.title}:`, err);
        if (loadingEl) {
          loadingEl.textContent = 'Failed to load analytics.';
          setTimeout(() => { if (loadingEl) loadingEl.style.display = 'none'; }, 1500);
        }
      } finally {
        if (loadingEl && state.cachedData) loadingEl.style.display = 'none';
      }
    }

    function computeAndRenderBoxAnalytics() {
      if (!state.cachedData) return;
      const { startMs, endMs, periodLabel, isDayMode, rate } = state.cachedData;

      if (isBattery && isDayMode) {
        const { socBars, voltBars, pwrBars, sessions, lastIdx, packKwh } = state.cachedData;
        const validBars = socBars.slice(0, lastIdx).filter(v => v != null && v > 10);
        const latestV = validBars.length ? validBars[validBars.length - 1] : 0;
        const peakV = validBars.length ? Math.max(...validBars) : 0;
        const avgV = validBars.length ? (validBars.reduce((a, b) => a + b, 0) / validBars.length) : 0;

        let dSum = 0, dCount = 0, nSum = 0, nCount = 0;
        for (let i = 0; i < lastIdx; i++) {
          const val = socBars[i];
          if (val == null || val <= 10) continue;
          const ts = startMs + i * 120 * 1000;
          const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: 0 };
          if (pkt.hour >= 7 && pkt.hour < 16) { dSum += val; dCount++; }
          else { nSum += val; nCount++; }
        }
        const dayAvg = dCount > 0 ? (dSum / dCount) : 0;
        const nightAvg = nCount > 0 ? (nSum / nCount) : 0;

        let totalChgKwh = 0, totalDisKwh = 0;
        const chips = (sessions || []).map(s => {
          const isChg = s.type === 'charge';
          const startTs = startMs + s.startIdx * 120 * 1000;
          const endTs = startMs + s.endIdx * 120 * 1000;
          const startStr = formatPktTime(startTs, 'time').replace(':00', '');
          const endStr = s.inProgress ? 'Now' : formatPktTime(endTs, 'time').replace(':00', '');
          const durH = Math.floor(s.durMin / 60);
          const durM = Math.round(s.durMin % 60);
          const durStr = durH > 0 ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`) : `${durM}m`;
          const kwh = (Math.abs(s.delta) / 100) * packKwh;
          const avgW = s.durMin > 0 ? Math.round((kwh * 1000) / (s.durMin / 60)) : 0;
          const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

          if (isChg) totalChgKwh += kwh;
          else totalDisKwh += kwh;

          const bg = isChg ? 'rgba(16,185,129,0.16)' : 'rgba(249,115,22,0.16)';
          const bdr = isChg ? 'rgba(16,185,129,0.45)' : 'rgba(249,115,22,0.45)';
          const textClr = isChg ? '#4ade80' : '#fb923c';

          let pauseStr = '';
          if (s.pauseMin > 0) {
            const ph = Math.floor(s.pauseMin / 60);
            const pm = s.pauseMin % 60;
            const pText = ph > 0 ? (pm > 0 ? `${ph}h ${pm}m` : `${ph}h`) : `${pm}m`;
            pauseStr = ` (pause ${pText})`;
          }

          return `<span style="display:inline-flex; align-items:center; gap:4px; white-space:nowrap; flex-shrink:0; background:${bg}; border:1px solid ${bdr}; border-radius:6px; padding:3px 8px; font-size:11.5px; color:${textClr}; font-weight:700;">
            ${isChg ? '▲ +' : '▼ '}${Math.abs(s.delta).toFixed(1)}% (${kwh.toFixed(1)} kWh - Ø ${avgStr}) in ${durStr}${pauseStr}
            <span style="color:var(--text-muted); font-size:10px; font-weight:600; margin-left:2px;">[${startStr}–${endStr}]</span>
          </span>`;
        });

        const sessionsCardHtml = (sessions && sessions.length > 0)
          ? `<div style="background:var(--bg-panel); border:1px solid var(--border); border-radius:8px; padding:6px 10px; margin-top:5px;">
               <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:800; margin-bottom:4px;">
                 <span style="color:#10b981;">⚡ Activity Sessions (10m+):</span>
                 <span style="color:var(--text-muted); font-size:10.5px;">Chg: <b style="color:#4ade80;">+${totalChgKwh.toFixed(1)} kWh</b> &bull; Disch: <b style="color:#fb923c;">-${totalDisKwh.toFixed(1)} kWh</b></span>
               </div>
               <div style="display:flex; flex-wrap:nowrap; overflow-x:auto; gap:6px; padding:2px 0 4px; -webkit-overflow-scrolling:touch; scrollbar-width:thin;">
                 ${chips.join('')}
               </div>
             </div>`
          : '';

        let auxStatsHtml = '';
        if (state.includeVoltage && voltBars.length) {
          const valVolt = voltBars.slice(0, lastIdx).filter(v => v != null && v > 40);
          if (valVolt.length) {
            const curV = valVolt[valVolt.length - 1];
            const maxV = Math.max(...valVolt);
            const avgV = valVolt.reduce((a, b) => a + b, 0) / valVolt.length;
            auxStatsHtml += `<div style="font-size:11px; margin-top:3px; color:#35c0b7; font-weight:700;">⚡ Voltage: <b style="color:var(--text-main); font-size:12px;">${curV.toFixed(1)} V</b> <span style="color:var(--text-muted);">(Peak: ${maxV.toFixed(1)}V &bull; Avg: ${avgV.toFixed(1)}V)</span></div>`;
          }
        }
        if (state.includePower && pwrBars.length) {
          const valP = pwrBars.slice(0, lastIdx).filter(v => v != null);
          if (valP.length) {
            const curP = valP[valP.length - 1];
            const maxP = Math.max(...valP);
            const avgP = Math.round(valP.reduce((a, b) => a + b, 0) / valP.length);
            auxStatsHtml += `<div style="font-size:11px; margin-top:2px; color:#facc15; font-weight:700;">⚡ Net Power: <b style="color:var(--text-main); font-size:12px;">${curP} W</b> <span style="color:var(--text-muted);">(Peak: ${maxP}W &bull; Avg: ${avgP}W)</span></div>`;
          }
        }

        statsStrip.innerHTML = `
          <div style="margin-bottom:2px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="color:${titleColor}; font-size:13px; font-weight:800;">🔋 ${cfg.title} SOC:</span>
              <span style="color:var(--text-main); font-size:15px; font-weight:900;">${latestV.toFixed(1)} %</span>
              <span style="color:var(--text-muted); font-size:11px; font-weight:600;">(Peak: <b style="color:${titleColor};">${peakV.toFixed(1)} %</b> · Avg: <b style="color:${titleColor};">${avgV.toFixed(1)} %</b>)</span>
            </div>
            <div style="display:flex; gap:10px; margin-top:2px; flex-wrap:wrap;">
              <span style="color:var(--accent-solar); font-size:11.5px; font-weight:800;">Day: (Avg: ${dayAvg.toFixed(1)} %)</span>
              <span style="color:#c084fc; font-size:11.5px; font-weight:800;">Night: (Avg: ${nightAvg.toFixed(1)} %)</span>
            </div>
            ${sessionsCardHtml}
            ${auxStatsHtml}
          </div>
        `;

        buildReportContent({
          periodLabel, totalKwh: totalDisKwh, dayKwh: 0, nightKwh: 0, rate,
          outageMinutes: 0, outageCount: 0, isDayMode: true, dailyMap: {}, ptsData: []
        });

        redrawGraph();
        if (loadingEl) loadingEl.style.display = 'none';
        return;
      }

      // Standard Non-Battery Feeds Analysis
      const { ptsData, ptsAux, ptsF1, ptsF2, outageSummary } = state.cachedData;
      let peakVal = 0, avgVal = 0, dayKwh = 0, dayAvgW = 0, nightKwh = 0, nightAvgW = 0, totalKwh = 0;
      let f1Peak = 0, f1Avg = 0, f1DayKwh = 0, f1NightKwh = 0, f1TotalKwh = 0;
      let f2Peak = 0, f2Avg = 0, f2DayKwh = 0, f2NightKwh = 0, f2TotalKwh = 0;
      let outageMinutes = 0, outageCount = 0;
      const dailyMap = {};

      const isPc = !!cfg.isPc;
      const dayStart = isPc ? 6 : 7;
      const dayEnd = 16;
      const stepHours = 120 / 3600;

      if (isDayMode) {
        let allSum = 0, allActiveCount = 0;
        let daySum = 0, dayActiveCount = 0;
        let nightSum = 0, nightActiveCount = 0;

        ptsData.forEach(p => {
          if (!p || p[1] == null) return;
          const v = Math.max(0, p[1]);
          const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
          if (v > peakVal) peakVal = v;
          allSum += v;
          if (v > 10) allActiveCount++;

          const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: new Date(ts + 18000000).getUTCHours() };
          const h = pkt.hour;
          if (h >= dayStart && h < dayEnd) {
            daySum += v;
            if (v > 10) dayActiveCount++;
          } else {
            nightSum += v;
            if (v > 10) nightActiveCount++;
          }
        });

        avgVal = allActiveCount > 0 ? Math.round(allSum / allActiveCount) : 0;
        dayAvgW = dayActiveCount > 0 ? Math.round(daySum / dayActiveCount) : 0;
        nightAvgW = nightActiveCount > 0 ? Math.round(nightSum / nightActiveCount) : 0;
        dayKwh = (daySum * stepHours) / 1000;
        nightKwh = (nightSum * stepHours) / 1000;
        totalKwh = dayKwh + nightKwh;

        if (cfg.isFridges) {
          let s1 = 0, c1 = 0, ds1 = 0, ns1 = 0;
          ptsF1.forEach(p => {
            const v = Math.max(0, p[1] || 0);
            const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
            if (v > f1Peak) f1Peak = v;
            s1 += v; if (v > 5) c1++;
            const h = (typeof getKarachiDate === 'function') ? getKarachiDate(ts).hour : 0;
            if (h >= dayStart && h < dayEnd) ds1 += v; else ns1 += v;
          });
          f1Avg = c1 > 0 ? Math.round(s1 / c1) : 0;
          f1DayKwh = (ds1 * stepHours) / 1000;
          f1NightKwh = (ns1 * stepHours) / 1000;
          f1TotalKwh = f1DayKwh + f1NightKwh;

          let s2 = 0, c2 = 0, ds2 = 0, ns2 = 0;
          ptsF2.forEach(p => {
            const v = Math.max(0, p[1] || 0);
            const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
            if (v > f2Peak) f2Peak = v;
            s2 += v; if (v > 5) c2++;
            const h = (typeof getKarachiDate === 'function') ? getKarachiDate(ts).hour : 0;
            if (h >= dayStart && h < dayEnd) ds2 += v; else ns2 += v;
          });
          f2Avg = c2 > 0 ? Math.round(s2 / c2) : 0;
          f2DayKwh = (ds2 * stepHours) / 1000;
          f2NightKwh = (ns2 * stepHours) / 1000;
          f2TotalKwh = f2DayKwh + f2NightKwh;
        }

        if (boxKey === 'grid' && ptsAux.length) {
          let inOutage = false, oStart = null;
          ptsAux.forEach(p => {
            if (!p) return;
            const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
            const v = p[1] != null ? p[1] : 0;
            if (v < 50) {
              outageMinutes += 2;
              if (!inOutage) { inOutage = true; outageCount++; oStart = ts; }
            } else {
              if (inOutage) {
                inOutage = false;
              }
            }
          });
        }
      } else {
        const mapF1 = new Map(ptsF1);
        const mapF2 = new Map(ptsF2);

        ptsData.forEach(([ts, v]) => {
          if (v == null || v < 0) return;
          const tsMs = ts < 2e9 ? ts * 1000 : ts;
          const p = (typeof getKarachiDate === 'function') ? getKarachiDate(tsMs) : {
            year: new Date(tsMs + 18000000).getUTCFullYear(),
            month: new Date(tsMs + 18000000).getUTCMonth() + 1,
            day: new Date(tsMs + 18000000).getUTCDate(),
            hour: new Date(tsMs + 18000000).getUTCHours()
          };

          let cYr = p.year, cMo = p.month, cDy = p.day;
          if (p.hour < 7) {
            const prevD = new Date(Date.UTC(cYr, cMo - 1, cDy - 1));
            cYr = prevD.getUTCFullYear(); cMo = prevD.getUTCMonth() + 1; cDy = prevD.getUTCDate();
          }

          const dKey = state.tab === 'year'
            ? `${cYr}-${String(cMo).padStart(2,'0')}`
            : `${cYr}-${String(cMo).padStart(2,'0')}-${String(cDy).padStart(2,'0')}`;

          if (!dailyMap[dKey]) dailyMap[dKey] = {
            totalWh: 0, dayWh: 0, nightWh: 0, f1Wh: 0, f2Wh: 0,
            dLabel: state.tab === 'year' ? MONTH_SHORT[cMo-1] : `${cDy}/${cMo}`
          };
          dailyMap[dKey].totalWh += v;
          totalKwh += v / 1000;

          if (cfg.isFridges) {
            dailyMap[dKey].f1Wh += (mapF1.get(ts) || 0);
            dailyMap[dKey].f2Wh += (mapF2.get(ts) || 0);
          }

          if (p.hour >= dayStart && p.hour < dayEnd) {
            dailyMap[dKey].dayWh += v;
            dayKwh += v / 1000;
          } else {
            dailyMap[dKey].nightWh += v;
            nightKwh += v / 1000;
          }
        });

        if (outageSummary) {
          outageMinutes = outageSummary.totalMinutes || 0;
          outageCount = outageSummary.outageCount || 0;
        }
      }

      state.cachedData.dailyMap = dailyMap;

      let statLine1 = '';
      let statLine2 = '';

      if (cfg.isFridges) {
        statLine1 = `
          <span>
            <span style="color:#c084fc; font-weight:800;">🧊 F1: Peak ${f1Peak}W &bull; Avg ${f1Avg}W</span> &nbsp;|&nbsp;
            <span style="color:#22d3ee; font-weight:800;">🧊 F2: Peak ${f2Peak}W &bull; Avg ${f2Avg}W</span>
          </span>
          <span style="color:#4ade80; font-weight:800;">Combined: ${fmtEnergy(totalKwh)} (${fmtPkr(totalKwh * rate)})</span>
        `;
        statLine2 = `
          <span style="color:var(--accent-solar); font-weight:800;">☀️ Day: F1 ${fmtEnergy(f1DayKwh)} + F2 ${fmtEnergy(f2DayKwh)} = ${fmtEnergy(dayKwh)}</span>
          <span style="color:#c084fc; font-weight:800;">🌙 Night: F1 ${fmtEnergy(f1NightKwh)} + F2 ${fmtEnergy(f2NightKwh)} = ${fmtEnergy(nightKwh)}</span>
        `;
      } else if (cfg.isPower) {
        const peakColor = peakVal > 1500 ? '#ef4444' : titleColor;
        const outStr = outageCount > 0 ? `<span style="color:#ef4444; font-weight:800;">⚡ Outages: ${fmtDuration(outageMinutes)} (${outageCount}x)</span>` : '';
        const dayAvgStr = isDayMode ? `(Avg: ${dayAvgW} W)` : '';
        const nightAvgStr = isDayMode ? `(Avg: ${nightAvgW} W)` : '';
        const costStr = `<span style="color:#4ade80; font-weight:800;">Cost: ${fmtPkr(totalKwh * rate)}</span>`;

        statLine1 = `<span>(Peak: <b style="color:${peakColor};">${isDayMode ? peakVal.toLocaleString() + ' W' : totalKwh.toFixed(1) + ' kWh'}</b> &bull; Avg: <b style="color:${titleColor};">${isDayMode ? avgVal + ' W' : (totalKwh / Math.max(1, Object.keys(dailyMap).length)).toFixed(1) + ' kWh/d'}</b>)</span> ${outStr}`;
        statLine2 = `
          <span style="color:var(--accent-solar); font-weight:800;">Day: ${fmtEnergy(dayKwh)} ${dayAvgStr}</span>
          ${!cfg.hideNight ? `<span style="color:#c084fc; font-weight:800;">Night: ${fmtEnergy(nightKwh)} ${nightAvgStr}</span>` : ''}
          ${costStr}
        `;
      } else {
        const mainDisp = isDayMode ? (ptsData.length ? ptsData[ptsData.length-1][1].toFixed(1) : '--') : (totalKwh / Math.max(1, Object.keys(dailyMap).length)).toFixed(1);
        statLine1 = `<span>Latest: <b style="color:${titleColor};">${mainDisp} ${cfg.unit}</b> &bull; Peak: <b style="color:${titleColor};">${peakVal.toFixed(1)} ${cfg.unit}</b></span>`;
        statLine2 = `<span style="color:var(--text-muted);">Period: ${periodLabel}</span>`;
      }

      statsStrip.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:3px;">
          ${statLine1}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          ${statLine2}
        </div>
      `;

      buildReportContent({
        periodLabel, totalKwh, dayKwh, nightKwh, rate,
        outageMinutes, outageCount, isDayMode, dailyMap, ptsData,
        f1Peak, f1Avg, f1DayKwh, f1NightKwh, f1TotalKwh,
        f2Peak, f2Avg, f2DayKwh, f2NightKwh, f2TotalKwh,
        ptsF1, ptsF2
      });

      redrawGraph();
      if (loadingEl) loadingEl.style.display = 'none';
    }

    function buildReportContent(data) {
      const { periodLabel, totalKwh, dayKwh, nightKwh, rate, outageMinutes, outageCount, isDayMode, dailyMap, ptsData, ptsF1, ptsF2 } = data;
      const nightPct = totalKwh > 0 ? ((nightKwh / totalKwh) * 100).toFixed(1) : '0.0';

      let txt = `================================================================================\n`;
      txt += `📄 ${cfg.title.toUpperCase()} REPORT: ${periodLabel}\n`;
      txt += `Generated: ${new Date().toLocaleString()} (PKT UTC+5)\n`;
      if (cfg.isPower) txt += `Tariff Rate: PKR ${rate.toFixed(0)} / kWh\n`;
      txt += `================================================================================\n\n`;

      if (isBattery && isDayMode) {
        txt += `BATTERY SUMMARY:\n`;
        txt += `  • Discharged: ${totalKwh.toFixed(2)} kWh\n`;
        txt += `  • Savings: PKR ${Math.round(totalKwh * rate).toLocaleString()}\n\n`;
      } else if (cfg.isFridges) {
        txt += `SUMMARY (FRIDGES):\n`;
        txt += `  • Fridge 1 Total: ${data.f1TotalKwh.toFixed(2)} kWh (Day: ${data.f1DayKwh.toFixed(2)}k, Night: ${data.f1NightKwh.toFixed(2)}k)\n`;
        txt += `  • Fridge 2 Total: ${data.f2TotalKwh.toFixed(2)} kWh (Day: ${data.f2DayKwh.toFixed(2)}k, Night: ${data.f2NightKwh.toFixed(2)}k)\n`;
        txt += `  • Combined Energy: ${totalKwh.toFixed(2)} kWh  (PKR ${Math.round(totalKwh * rate).toLocaleString()})\n\n`;
      } else if (cfg.isPower) {
        txt += `SUMMARY:\n`;
        txt += `  • Total Energy  : ${totalKwh.toFixed(2)} kWh  (PKR ${Math.round(totalKwh * rate).toLocaleString()})\n`;
        txt += `  • Day (Daytime) : ${dayKwh.toFixed(2)} kWh  (PKR ${Math.round(dayKwh * rate).toLocaleString()})\n`;
        if (!cfg.hideNight) {
          txt += `  • Night (Overnight): ${nightKwh.toFixed(2)} kWh (${nightPct}%)  (PKR ${Math.round(nightKwh * rate).toLocaleString()})\n`;
        }
        if (boxKey === 'grid') {
          txt += `  • Outages/Breaks : ${fmtDuration(outageMinutes)} across ${outageCount} incident(s)\n`;
        }
        txt += `\n`;
      }

      let tableHtml = '';
      if (isDayMode) {
        if (cfg.isFridges) {
          tableHtml += `
            <table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace; min-width:380px;">
              <thead>
                <tr style="background:var(--bg-card); border-bottom:2px solid var(--border); text-align:right;">
                  <th style="padding:6px; text-align:left;">Hour</th>
                  <th style="padding:6px; color:#c084fc;">F1 (W)</th>
                  <th style="padding:6px; color:#22d3ee;">F2 (W)</th>
                  <th style="padding:6px; color:var(--text-main);">Total (W)</th>
                  <th style="padding:6px; color:var(--accent-solar);">Energy</th>
                  <th style="padding:6px; color:#4ade80;">Cost</th>
                </tr>
              </thead>
              <tbody>
          `;

          const b1 = Array.from({ length: 24 }, () => ({ sum: 0, cnt: 0 }));
          const b2 = Array.from({ length: 24 }, () => ({ sum: 0, cnt: 0 }));
          (ptsF1 || []).forEach(([ts, v]) => {
            const h = (typeof getKarachiDate === 'function') ? getKarachiDate(ts < 2e9 ? ts * 1000 : ts).hour : 0;
            b1[h].sum += (v || 0); b1[h].cnt++;
          });
          (ptsF2 || []).forEach(([ts, v]) => {
            const h = (typeof getKarachiDate === 'function') ? getKarachiDate(ts < 2e9 ? ts * 1000 : ts).hour : 0;
            b2[h].sum += (v || 0); b2[h].cnt++;
          });

          for (let h = 0; h < 24; h++) {
            if (b1[h].cnt === 0 && b2[h].cnt === 0) continue;
            const w1 = b1[h].cnt > 0 ? Math.round(b1[h].sum / b1[h].cnt) : 0;
            const w2 = b2[h].cnt > 0 ? Math.round(b2[h].sum / b2[h].cnt) : 0;
            const totW = w1 + w2;
            const wh = totW;
            const cost = (wh / 1000) * rate;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hh = h % 12 || 12;
            const hStr = `${String(hh).padStart(2, '0')}:00 ${ampm}`;

            tableHtml += `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">
                <td style="padding:5px 6px; text-align:left; color:var(--text-muted);">${hStr}</td>
                <td style="padding:5px 6px; font-weight:800; color:#c084fc;">${w1} W</td>
                <td style="padding:5px 6px; font-weight:800; color:#22d3ee;">${w2} W</td>
                <td style="padding:5px 6px; font-weight:800; color:var(--text-main);">${totW} W</td>
                <td style="padding:5px 6px; color:var(--accent-solar);">${wh} Wh</td>
                <td style="padding:5px 6px; color:#4ade80; font-weight:700;">PKR ${cost.toFixed(1)}</td>
              </tr>
            `;
          }
          tableHtml += `</tbody></table>`;
        } else if (!isBattery) {
          tableHtml += `
            <table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace; min-width:320px;">
              <thead>
                <tr style="background:var(--bg-card); border-bottom:2px solid var(--border); text-align:right;">
                  <th style="padding:6px; text-align:left;">Hour</th>
                  <th style="padding:6px; color:${titleColor};">${cfg.unit === 'W' ? 'Power (W)' : cfg.unit}</th>
                  <th style="padding:6px; color:var(--text-main);">Energy</th>
                  <th style="padding:6px; color:#4ade80;">Cost</th>
                </tr>
              </thead>
              <tbody>
          `;

          const hrBuckets = Array.from({ length: 24 }, () => ({ sumW: 0, cnt: 0 }));
          ptsData.forEach(([ts, v]) => {
            if (v == null) return;
            const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts < 2e9 ? ts * 1000 : ts) : { hour: 0 };
            hrBuckets[pkt.hour].sumW += v;
            hrBuckets[pkt.hour].cnt++;
          });

          hrBuckets.forEach((b, h) => {
            if (b.cnt === 0) return;
            const avgV = Math.round(b.sumW / b.cnt);
            const wh = avgV;
            const cost = (wh / 1000) * rate;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const hh = h % 12 || 12;
            const hStr = `${String(hh).padStart(2, '0')}:00 ${ampm}`;

            tableHtml += `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05); text-align:right;">
                <td style="padding:5px 6px; text-align:left; color:var(--text-muted);">${hStr}</td>
                <td style="padding:5px 6px; font-weight:800; color:${titleColor};">${avgV} ${cfg.unit}</td>
                <td style="padding:5px 6px;">${wh} Wh</td>
                <td style="padding:5px 6px; color:#4ade80; font-weight:700;">PKR ${cost.toFixed(1)}</td>
              </tr>
            `;
          });
          tableHtml += `</tbody></table>`;
        }
      }

      state.cachedRawText = txt;

      reportContent.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-left:3px solid ${titleColor}; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
            <span style="font-size:13px; font-weight:800; color:${titleColor};">📊 ${cfg.title} &bull; ${periodLabel}</span>
            <span style="font-size:12px; font-weight:800; color:#4ade80;">PKR ${Math.round(totalKwh * rate).toLocaleString()} (@ ${rate} PKR/u)</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted); margin-top:4px; flex-wrap:wrap; gap:4px;">
            <span>Total: <b style="color:var(--text-main);">${totalKwh.toFixed(1)} kWh</b></span>
            ${dayKwh > 0 ? `<span>Day: <b style="color:var(--accent-solar);">${dayKwh.toFixed(1)} kWh</b></span>` : ''}
            ${nightKwh > 0 ? `<span>Night: <b style="color:#c084fc;">${nightKwh.toFixed(1)} kWh (${nightPct}%)</b></span>` : ''}
            ${boxKey === 'grid' ? `<span>Outages: <b style="color:#ef4444;">${fmtDuration(outageMinutes)} (${outageCount}x)</b></span>` : ''}
          </div>
        </div>
        ${tableHtml}
      `;
    }

    function redrawGraph() {
      if (state.view !== 'graph' || !state.cachedData) return;
      const { isDayMode } = state.cachedData;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const PL = 36, PR = 14, PT = 22, PB = 30;
      const cW = rect.width - PL - PR;
      const cH = rect.height - PT - PB;
      if (cW <= 0 || cH <= 0) return;

      const maxPan = (cW / 2) * (state.zoom - 1);
      state.panX = Math.max(-maxPan, Math.min(maxPan, state.panX));
      const centerX = PL + cW / 2;
      const mapXCoord = (rawX) => centerX + (rawX - centerX) * state.zoom + state.panX;

      // ── 1. Dedicated Battery Day View Canvas Renderer ──
      if (isBattery && isDayMode) {
        const { socBars, voltBars, pwrBars, sessions, lastIdx, packKwh } = state.cachedData;
        const n = socBars.length;
        if (n < 2) return;

        const mapX = (idx) => mapXCoord(PL + (idx / (n - 1)) * cW);
        const minV = 0, maxV = 110, range = 110;
        const mapY = (v) => PT + cH - ((v - minV) / range) * cH;

        // Grid lines
        ctx.fillStyle = '#71717a';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'right';
        const ticks = [0, 22, 44, 66, 88, 110];
        ticks.forEach(v => {
          const y = mapY(v);
          ctx.fillText(Math.round(v) + '%', PL - 5, y + 3);
          ctx.strokeStyle = v === 100 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)';
          ctx.beginPath();
          if (v === 100) ctx.setLineDash([4, 4]); else ctx.setLineDash([]);
          ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
          ctx.setLineDash([]);
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(PL, PT, cW, cH);
        ctx.clip();

        // Background gradient
        const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
        grad.addColorStop(0, titleColor + '44');
        grad.addColorStop(1, titleColor + '00');

        ctx.beginPath();
        let started = false, firstX = null, lastX = null;
        for (let i = 0; i < lastIdx; i++) {
          if (socBars[i] == null) continue;
          const x = mapX(i), y = mapY(socBars[i]);
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

        // Base green line
        ctx.beginPath();
        started = false;
        for (let i = 0; i < lastIdx; i++) {
          if (socBars[i] == null) { started = false; continue; }
          const x = mapX(i), y = mapY(socBars[i]);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = titleColor;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Glowing slope segments and pause bridges
        if (state.showSessions !== false && sessions && sessions.length) {
          sessions.forEach(seg => {
            const isCharge = seg.type === 'charge';
            const clr = isCharge ? '#4ade80' : '#fb923c';

            const ranges = (seg.ranges && seg.ranges.length) ? seg.ranges : [{ startIdx: seg.startIdx, endIdx: seg.endIdx }];
            ranges.forEach(rng => {
              ctx.save();
              ctx.beginPath();
              let fst = true;
              for (let k = rng.startIdx; k <= Math.min(rng.endIdx, lastIdx - 1); k++) {
                if (socBars[k] == null) continue;
                const px = mapX(k), py = mapY(socBars[k]);
                if (fst) { ctx.moveTo(px, py); fst = false; } else ctx.lineTo(px, py);
              }
              ctx.strokeStyle = clr;
              ctx.lineWidth = 3.5;
              ctx.shadowColor = clr;
              ctx.shadowBlur = 8;
              ctx.stroke();
              ctx.restore();
            });

            // Bridge line for pauses
            if (ranges.length > 1) {
              for (let r = 0; r < ranges.length - 1; r++) {
                const r1 = ranges[r];
                const r2 = ranges[r + 1];
                if (r1.endIdx >= lastIdx) continue;
                const v1 = socBars[r1.endIdx];
                const v2 = socBars[Math.min(r2.startIdx, lastIdx - 1)];
                if (v1 == null || v2 == null) continue;
                const x1 = mapX(r1.endIdx), y1 = mapY(v1);
                const x2 = mapX(r2.startIdx), y2 = mapY(v2);
                const dropY = 14;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x1, y1); ctx.lineTo(x1, y1 + dropY);
                ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();

                ctx.beginPath();
                for (let k = r1.endIdx; k <= Math.min(r2.startIdx, lastIdx - 1); k++) {
                  if (socBars[k] == null) continue;
                  const px = mapX(k), py = mapY(socBars[k]) + dropY;
                  if (k === r1.endIdx) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.setLineDash([5, 4]); ctx.strokeStyle = clr; ctx.lineWidth = 2.5; ctx.stroke();

                ctx.beginPath(); ctx.setLineDash([]);
                ctx.moveTo(x2, y2 + dropY); ctx.lineTo(x2, y2);
                ctx.strokeStyle = clr; ctx.lineWidth = 2; ctx.stroke();
                ctx.restore();
              }
            }
          });
        }

        // Overlays: Voltage (cyan) and Power (yellow)
        if (state.includeVoltage && voltBars.length) {
          const valV = voltBars.slice(0, lastIdx).filter(v => v != null && v > 40);
          const vMin = valV.length ? Math.floor(Math.min(...valV) - 1) : 46;
          const vMax = valV.length ? Math.ceil(Math.max(...valV) + 1) : 56;
          const vRange = Math.max(1, vMax - vMin);
          const mapVy = (v) => PT + cH - ((v - vMin) / vRange) * cH;

          ctx.beginPath();
          started = false;
          for (let i = 0; i < lastIdx; i++) {
            if (voltBars[i] == null) { started = false; continue; }
            const x = mapX(i), y = mapVy(voltBars[i]);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = '#35c0b7'; ctx.lineWidth = 1.8; ctx.stroke();
        }

        if (state.includePower && pwrBars.length) {
          const valP = pwrBars.slice(0, lastIdx).filter(v => v != null && Math.abs(v) > 0);
          const maxP = valP.length ? Math.max(...valP.map(Math.abs)) * 1.15 : 1000;
          const mapPy = (p) => PT + cH / 2 - (p / maxP) * (cH / 2);

          ctx.beginPath();
          started = false;
          for (let i = 0; i < lastIdx; i++) {
            if (pwrBars[i] == null) { started = false; continue; }
            const x = mapX(i), y = mapPy(pwrBars[i]);
            if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.6; ctx.setLineDash([4, 4]); ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.restore();

        // On-Chart Callout Pills
        if (state.showSessions !== false && sessions && sessions.length) {
          const isNarrow = cW < 420;

          sessions.forEach(seg => {
            const isCharge = seg.type === 'charge';
            const clr = isCharge ? '#4ade80' : '#fb923c';
            const bgClr = isCharge ? 'rgba(6, 78, 59, 0.94)' : 'rgba(124, 45, 18, 0.94)';
            const borderClr = isCharge ? '#10b981' : '#f97316';

            let targetRange = { startIdx: seg.startIdx, endIdx: seg.endIdx };
            if (seg.ranges && seg.ranges.length > 1) {
              targetRange = seg.ranges.reduce((best, r) => (r.endIdx - r.startIdx > best.endIdx - best.startIdx ? r : best), seg.ranges[0]);
            }
            const midIdx = Math.round((targetRange.startIdx + targetRange.endIdx) / 2);
            if (midIdx >= lastIdx) return;
            const midVal = socBars[midIdx];
            if (midVal == null) return;
            const midX = mapX(midIdx), midY = mapY(midVal);
            if (midX < PL - 40 || midX > rect.width) return;

            const durH = Math.floor(seg.durMin / 60);
            const durM = Math.round(seg.durMin % 60);
            const durStr = durH > 0 ? (durM > 0 ? `${durH}h ${durM}m` : `${durH}h`) : `${durM}m`;
            const kwhEst = (Math.abs(seg.delta) / 100) * packKwh;
            const sign = isCharge ? '+' : '';
            const avgW = seg.durMin > 0 ? Math.round((kwhEst * 1000) / (seg.durMin / 60)) : 0;
            const avgStr = avgW >= 1000 ? (avgW / 1000).toFixed(1) + 'kW' : avgW + 'W';

            let pauseStr = '';
            if (seg.pauseMin > 0) {
              const ph = Math.floor(seg.pauseMin / 60);
              const pm = seg.pauseMin % 60;
              const pText = ph > 0 ? (pm > 0 ? `${ph}h ${pm}m` : `${ph}h`) : `${pm}m`;
              pauseStr = ` · ${pText} pause`;
            }

            const text = isNarrow
              ? `${isCharge ? '▲' : '▼'} ${sign}${Math.round(seg.delta)}% · ${durStr} (${kwhEst.toFixed(1)}k · Ø ${avgStr})`
              : `${isCharge ? '▲' : '▼'} ${sign}${seg.delta.toFixed(1)}% · ${durStr}${pauseStr} (${kwhEst.toFixed(1)}kWh · Ø ${avgStr})`;

            ctx.font = `bold ${isNarrow ? '9.5px' : '11px'} system-ui, -apple-system, sans-serif`;
            const tw = ctx.measureText(text).width;
            const pw = tw + (isNarrow ? 12 : 18);
            const ph = isNarrow ? 19 : 22;

            let bx = midX - pw / 2;
            bx = Math.max(PL + 4, Math.min(rect.width - PR - pw - 4, bx));
            let by = isCharge ? (midY - ph - 10) : (midY + 10);
            by = Math.max(PT + 2, Math.min(PT + cH - ph - 2, by));

            ctx.save();
            ctx.fillStyle = bgClr;
            ctx.strokeStyle = borderClr;
            ctx.lineWidth = 1.4;
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 6;

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, pw, ph, 5);
            else ctx.rect(bx, by, pw, ph);
            ctx.fill();
            ctx.stroke();

            // Pin tick
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
        }

        // X-axis time ticks
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        const labelIntervals = Math.max(4, Math.floor(cW / 45));
        const step = Math.max(1, Math.ceil(n / (labelIntervals * state.zoom)));
        for (let i = 0; i < n; i += step) {
          const lx = mapX(i);
          if (lx > PL - 10 && lx < rect.width - PR) {
            const ts = state.cachedData.startMs + i * 120 * 1000;
            const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: 0 };
            const ampm = pkt.hour >= 12 ? 'pm' : 'am';
            const hh = pkt.hour % 12 || 12;
            ctx.fillText(`${hh}${ampm}`, lx, PT + cH + 15);
          }
        }

        // Scrub cursor line & tooltip box
        if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < lastIdx) {
          const sx = mapX(state.scrubIdx);
          const val = socBars[state.scrubIdx];
          const sy = val != null ? mapY(val) : PT + cH / 2;

          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1;
          ctx.moveTo(sx, PT);
          ctx.lineTo(sx, PT + cH);
          ctx.stroke();

          if (val != null) {
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = titleColor;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          const ts = state.cachedData.startMs + state.scrubIdx * 120 * 1000;
          const timeStr = formatPktTime(ts, 'time');
          const valStr = val != null ? `${val.toFixed(1)} %` : '--';

          const line1 = timeStr;
          const line2 = `● Value: ${valStr}`;

          ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          const tw1 = ctx.measureText(line1).width;
          const tw2 = ctx.measureText(line2).width;
          const boxW = Math.max(tw1, tw2) + 16;
          const boxH = 34;

          let boxX = sx - boxW / 2;
          boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
          let boxY = sy - boxH - 10;
          if (boxY < PT + 4) boxY = sy + 10;

          ctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
          ctx.strokeStyle = 'var(--border, #3f3f46)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxW, boxH, 6);
          else ctx.rect(boxX, boxY, boxW, boxH);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'var(--text-main, #f4f4f5)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(line1, boxX + 8, boxY + 5);

          ctx.fillStyle = '#4ade80';
          ctx.fillText(line2, boxX + 8, boxY + 18);
          ctx.restore();
        }
        return;
      }

      // ── 2. Standard Non-Battery Feeds with Universal Pan, Zoom & Scrubbing ──
      const { ptsData, ptsAux, ptsF1, ptsF2 } = state.cachedData;
      const dailyMap = state.cachedData.dailyMap || {};

      if (isDayMode) {
        if (cfg.isFridges) {
          const p1 = ptsF1 || [];
          const p2 = ptsF2 || [];
          const n = Math.max(p1.length, p2.length);
          if (n < 2) return;

          const allVals = [];
          if (state.fridgeFilter !== 'f2') allVals.push(...p1.map(p => p[1] || 0));
          if (state.fridgeFilter !== 'f1') allVals.push(...p2.map(p => p[1] || 0));
          const maxW = Math.max(200, Math.max(...allVals) * 1.2);

          const mapX = (idx) => mapXCoord(PL + (idx / (n - 1)) * cW);
          const mapY = (val) => PT + cH - (Math.max(0, val) / maxW) * cH;

          ctx.fillStyle = '#71717a'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
          for (let g = 0; g <= 4; g++) {
            const val = (g / 4) * maxW;
            const y = PT + cH - (g / 4) * cH;
            ctx.fillText(Math.round(val) + 'W', PL - 5, y + 3);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
          }

          ctx.save();
          ctx.beginPath(); ctx.rect(PL, PT, cW, cH); ctx.clip();

          // Fridge 1
          if (state.fridgeFilter === 'both' || state.fridgeFilter === 'f1') {
            const grad1 = ctx.createLinearGradient(0, PT, 0, PT + cH);
            grad1.addColorStop(0, 'rgba(192, 132, 252, 0.28)');
            grad1.addColorStop(1, 'rgba(192, 132, 252, 0.0)');

            ctx.beginPath();
            ctx.moveTo(mapX(0), PT + cH);
            p1.forEach((p, idx) => ctx.lineTo(mapX(idx), mapY(p[1] || 0)));
            ctx.lineTo(mapX(p1.length - 1), PT + cH);
            ctx.closePath();
            ctx.fillStyle = grad1;
            ctx.fill();

            ctx.beginPath();
            p1.forEach((p, idx) => {
              if (idx === 0) ctx.moveTo(mapX(0), mapY(p[1] || 0));
              else ctx.lineTo(mapX(idx), mapY(p[1] || 0));
            });
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.2;
            ctx.stroke();
          }

          // Fridge 2
          if (state.fridgeFilter === 'both' || state.fridgeFilter === 'f2') {
            const grad2 = ctx.createLinearGradient(0, PT, 0, PT + cH);
            grad2.addColorStop(0, 'rgba(34, 211, 238, 0.24)');
            grad2.addColorStop(1, 'rgba(34, 211, 238, 0.0)');

            ctx.beginPath();
            ctx.moveTo(mapX(0), PT + cH);
            p2.forEach((p, idx) => ctx.lineTo(mapX(idx), mapY(p[1] || 0)));
            ctx.lineTo(mapX(p2.length - 1), PT + cH);
            ctx.closePath();
            ctx.fillStyle = grad2;
            ctx.fill();

            ctx.beginPath();
            p2.forEach((p, idx) => {
              if (idx === 0) ctx.moveTo(mapX(0), mapY(p[1] || 0));
              else ctx.lineTo(mapX(idx), mapY(p[1] || 0));
            });
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2.2;
            ctx.stroke();
          }

          ctx.restore();

          ctx.font = 'bold 9.5px system-ui';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#c084fc'; ctx.fillText('● Fridge 1', rect.width - PR - 75, 12);
          ctx.fillStyle = '#22d3ee'; ctx.fillText('● Fridge 2', rect.width - PR, 12);

          // Scaled time ticks
          ctx.fillStyle = '#a1a1aa'; ctx.font = '9.5px system-ui'; ctx.textAlign = 'center';
          const labelIntervals = Math.max(4, Math.floor(cW / 45));
          const step = Math.max(1, Math.ceil(n / (labelIntervals * state.zoom)));
          for (let i = 0; i < n; i += step) {
            const p = p1[i] || p2[i];
            if (!p) continue;
            const lx = mapX(i);
            if (lx > PL - 10 && lx < rect.width - PR) {
              const ts = p[0] < 2e9 ? p[0] * 1000 : p[0];
              const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: 0 };
              const ampm = pkt.hour >= 12 ? 'pm' : 'am';
              const hh = pkt.hour % 12 || 12;
              ctx.fillText(`${hh}${ampm}`, lx, PT + cH + 16);
            }
          }

          // Fridges hover scrubber
          if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < n) {
            const sx = mapX(state.scrubIdx);
            const v1 = p1[state.scrubIdx] ? p1[state.scrubIdx][1] || 0 : 0;
            const v2 = p2[state.scrubIdx] ? p2[state.scrubIdx][1] || 0 : 0;
            const topY = Math.min(mapY(v1), mapY(v2));

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.moveTo(sx, PT); ctx.lineTo(sx, PT + cH); ctx.stroke();

            const ts = (p1[state.scrubIdx] || p2[state.scrubIdx])[0];
            const tsMs = ts < 2e9 ? ts * 1000 : ts;
            const timeStr = formatPktTime(tsMs, 'time');

            const line1 = timeStr;
            const line2 = `F1: ${Math.round(v1)}W · F2: ${Math.round(v2)}W`;

            ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
            const boxW = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 16;
            const boxH = 34;

            let boxX = sx - boxW / 2;
            boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
            let boxY = topY - boxH - 10;
            if (boxY < PT + 4) boxY = topY + 10;

            ctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
            ctx.strokeStyle = 'var(--border, #3f3f46)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            else ctx.rect(boxX, boxY, boxW, boxH);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'var(--text-main, #f4f4f5)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(line1, boxX + 8, boxY + 5);

            ctx.fillStyle = '#c084fc';
            ctx.fillText(line2, boxX + 8, boxY + 18);
            ctx.restore();
          }
        } else {
          // Standard Single-Line Feeds (Solar, Grid, ACs, PC, Motor, WM, Tank, Temp)
          const n = ptsData.length;
          if (n < 2) return;

          const maxW = Math.max(cfg.unit === 'W' ? 500 : 10, Math.max(...ptsData.map(p => p[1] || 0)) * 1.15);
          const mapX = (idx) => mapXCoord(PL + (idx / (n - 1)) * cW);
          const mapY = (val) => PT + cH - (Math.max(0, val) / maxW) * cH;

          ctx.fillStyle = '#71717a'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
          for (let g = 0; g <= 4; g++) {
            const val = (g / 4) * maxW;
            const y = PT + cH - (g / 4) * cH;
            ctx.fillText(Math.round(val) + cfg.unit, PL - 5, y + 3);
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
          }

          ctx.save();
          ctx.beginPath(); ctx.rect(PL, PT, cW, cH); ctx.clip();

          if (boxKey === 'grid' && ptsAux.length > 1) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
            for (let i = 0; i < ptsAux.length; i++) {
              if (ptsAux[i][1] != null && ptsAux[i][1] < 50) {
                const x1 = mapXCoord(PL + (i / (ptsAux.length - 1)) * cW);
                const wBand = Math.max(2, (cW / ptsAux.length) * state.zoom);
                ctx.fillRect(x1, PT, wBand, cH);
              }
            }
          }

          const grad = ctx.createLinearGradient(0, PT, 0, PT + cH);
          grad.addColorStop(0, titleColor + '55');
          grad.addColorStop(1, titleColor + '00');

          ctx.beginPath();
          ctx.moveTo(mapX(0), PT + cH);
          ptsData.forEach((p, idx) => ctx.lineTo(mapX(idx), mapY(p[1] || 0)));
          ctx.lineTo(mapX(n - 1), PT + cH);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          ptsData.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(mapX(0), mapY(p[1] || 0));
            else ctx.lineTo(mapX(idx), mapY(p[1] || 0));
          });
          ctx.strokeStyle = titleColor;
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.restore();

          // Time ticks with zoom
          ctx.fillStyle = '#a1a1aa'; ctx.font = '9.5px system-ui'; ctx.textAlign = 'center';
          const labelIntervals = Math.max(4, Math.floor(cW / 45));
          const step = Math.max(1, Math.ceil(n / (labelIntervals * state.zoom)));
          for (let i = 0; i < n; i += step) {
            const lx = mapX(i);
            if (lx > PL - 10 && lx < rect.width - PR) {
              const ts = ptsData[i][0] < 2e9 ? ptsData[i][0] * 1000 : ptsData[i][0];
              const pkt = (typeof getKarachiDate === 'function') ? getKarachiDate(ts) : { hour: 0 };
              const ampm = pkt.hour >= 12 ? 'pm' : 'am';
              const hh = pkt.hour % 12 || 12;
              ctx.fillText(`${hh}${ampm}`, lx, PT + cH + 16);
            }
          }

          // Single feed hover scrubber
          if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < n) {
            const sx = mapX(state.scrubIdx);
            const val = ptsData[state.scrubIdx][1] || 0;
            const sy = mapY(val);

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.moveTo(sx, PT); ctx.lineTo(sx, PT + cH); ctx.stroke();

            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = titleColor; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

            const ts = ptsData[state.scrubIdx][0];
            const tsMs = ts < 2e9 ? ts * 1000 : ts;
            const timeStr = formatPktTime(tsMs, 'time');
            const valStr = cfg.unit === 'W' ? `${Math.round(val).toLocaleString()} W` : `${val.toFixed(1)} ${cfg.unit}`;

            const line1 = timeStr;
            const line2 = `● Value: ${valStr}`;

            ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
            const boxW = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 16;
            const boxH = 34;

            let boxX = sx - boxW / 2;
            boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
            let boxY = sy - boxH - 10;
            if (boxY < PT + 4) boxY = sy + 10;

            ctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
            ctx.strokeStyle = 'var(--border, #3f3f46)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxW, boxH, 6);
            else ctx.rect(boxX, boxY, boxW, boxH);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = 'var(--text-main, #f4f4f5)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(line1, boxX + 8, boxY + 5);

            ctx.fillStyle = titleColor;
            ctx.fillText(line2, boxX + 8, boxY + 18);
            ctx.restore();
          }
        }
      } else {
        // ── 3. Month & Year Bar Charts with Zoom, Pan & Scrubbing ──
        const entries = Object.entries(dailyMap || {});
        const count = entries.length;
        if (count === 0) return;

        const maxKwh = Math.max(2, Math.max(...entries.map(([, d]) => d.totalWh / 1000)) * 1.15);
        const barWidth = Math.max(2, Math.min(24 * state.zoom, (cW / count) * 0.7 * state.zoom));

        ctx.fillStyle = '#71717a'; ctx.font = '9px system-ui'; ctx.textAlign = 'right';
        for (let g = 0; g <= 4; g++) {
          const val = (g / 4) * maxKwh;
          const y = PT + cH - (g / 4) * cH;
          ctx.fillText(val.toFixed(1) + 'k', PL - 5, y + 3);
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + cW, y); ctx.stroke();
        }

        ctx.save();
        ctx.beginPath(); ctx.rect(PL, PT, cW, cH); ctx.clip();

        entries.forEach(([, d], idx) => {
          const rawCenterX = PL + ((idx + 0.5) / count) * cW;
          const cx = mapXCoord(rawCenterX);

          if (cfg.isFridges) {
            const f1K = d.f1Wh / 1000;
            const f2K = d.f2Wh / 1000;
            const totalY = PT + cH - ((f1K + f2K) / maxKwh) * cH;
            const f1SplitY = PT + cH - (f1K / maxKwh) * cH;

            ctx.fillStyle = '#c084fc';
            ctx.fillRect(cx - barWidth / 2, f1SplitY, barWidth, (PT + cH) - f1SplitY);

            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(cx - barWidth / 2, totalY, barWidth, f1SplitY - totalY);
          } else {
            const dKwh = d.dayWh / 1000;
            const nKwh = d.nightWh / 1000;
            const totalY = PT + cH - ((dKwh + nKwh) / maxKwh) * cH;
            const daySplitY = PT + cH - (dKwh / maxKwh) * cH;

            ctx.fillStyle = titleColor;
            ctx.fillRect(cx - barWidth / 2, daySplitY, barWidth, (PT + cH) - daySplitY);

            if (!cfg.hideNight) {
              ctx.fillStyle = '#c084fc';
              ctx.fillRect(cx - barWidth / 2, totalY, barWidth, daySplitY - totalY);
            }
          }

          // Highlight hovered bar
          if (state.scrubIdx === idx) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            const tK = d.totalWh / 1000;
            const barTopY = PT + cH - (tK / maxKwh) * cH;
            ctx.strokeRect(cx - barWidth / 2 - 1, barTopY - 1, barWidth + 2, (PT + cH) - barTopY + 1);
          }
        });

        ctx.restore();

        if (cfg.isFridges) {
          ctx.font = 'bold 9.5px system-ui';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#c084fc'; ctx.fillText('■ F1', rect.width - PR - 45, 12);
          ctx.fillStyle = '#22d3ee'; ctx.fillText('■ F2', rect.width - PR, 12);
        }

        ctx.fillStyle = '#a1a1aa'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
        const labelStep = Math.max(1, Math.ceil(count / (10 * state.zoom)));
        entries.forEach(([, d], idx) => {
          if (idx % labelStep === 0) {
            const rawCenterX = PL + ((idx + 0.5) / count) * cW;
            const cx = mapXCoord(rawCenterX);
            if (cx > PL - 10 && cx < rect.width - PR) {
              ctx.fillText(d.dLabel, cx, PT + cH + 15);
            }
          }
        });

        // Hover Tooltip for Month/Year bars
        if (state.scrubIdx != null && state.scrubIdx >= 0 && state.scrubIdx < count) {
          const entry = entries[state.scrubIdx];
          const d = entry[1];
          const rawCenterX = PL + ((state.scrubIdx + 0.5) / count) * cW;
          const sx = mapXCoord(rawCenterX);
          const tK = d.totalWh / 1000;
          const sy = PT + cH - (tK / maxKwh) * cH;

          const line1 = d.dLabel;
          const line2 = cfg.isFridges
            ? `F1: ${(d.f1Wh/1000).toFixed(1)}k · F2: ${(d.f2Wh/1000).toFixed(1)}k (${tK.toFixed(1)}k)`
            : `Total: ${tK.toFixed(1)} kWh (PKR ${Math.round(tK * rate).toLocaleString()})`;

          ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
          const boxW = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 16;
          const boxH = 34;

          let boxX = sx - boxW / 2;
          boxX = Math.max(PL + 4, Math.min(rect.width - PR - boxW - 4, boxX));
          let boxY = sy - boxH - 10;
          if (boxY < PT + 4) boxY = sy + 10;

          ctx.fillStyle = 'rgba(20, 20, 22, 0.94)';
          ctx.strokeStyle = 'var(--border, #3f3f46)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') ctx.roundRect(boxX, boxY, boxW, boxH, 6);
          else ctx.rect(boxX, boxY, boxW, boxH);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = 'var(--text-main, #f4f4f5)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(line1, boxX + 8, boxY + 5);

          ctx.fillStyle = titleColor;
          ctx.fillText(line2, boxX + 8, boxY + 18);
        }
      }
    }

    // ── Mouse & Touch Direct Left-Click Pan / Drag / Pinch-Zoom / Scrubbing ──
    if (!canvas.__attachedPopupEvents) {
      canvas.__attachedPopupEvents = true;

      const handleHover = (clientX) => {
        if (!state.cachedData) return;
        const rect = canvas.getBoundingClientRect();
        const PL = 36, PR = 14, cW = rect.width - PL - PR;
        if (cW <= 0) return;
        const mouseX = clientX - rect.left;
        const centerX = PL + cW / 2;

        if (state.cachedData.isDayMode) {
          let n = 720;
          if (isBattery) {
            n = state.cachedData.totalPoints || 720;
          } else if (cfg.isFridges) {
            n = Math.max(state.cachedData.ptsF1?.length || 0, state.cachedData.ptsF2?.length || 0);
          } else {
            n = state.cachedData.ptsData?.length || 0;
          }

          if (n > 1) {
            const relIdx = Math.round(((mouseX - state.panX - centerX) / state.zoom + centerX - PL) / (cW / (n - 1)));
            const maxIdx = isBattery ? (state.cachedData.lastIdx || n) : n;
            if (relIdx >= 0 && relIdx < maxIdx) {
              state.scrubIdx = relIdx;
              redrawGraph();
            }
          }
        } else {
          const entries = Object.entries(state.cachedData.dailyMap || {});
          const count = entries.length;
          if (count > 0) {
            const relIdx = Math.floor(((mouseX - state.panX - centerX) / state.zoom + centerX - PL) / (cW / count));
            if (relIdx >= 0 && relIdx < count) {
              state.scrubIdx = relIdx;
              redrawGraph();
            }
          }
        }
      };

      let isMouseDown = false;
      let dragStartX = 0;
      let dragStartPanX = 0;

      canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; // Left click only
        isMouseDown = true;
        dragStartX = e.clientX;
        dragStartPanX = state.panX;
        canvas.style.cursor = 'grabbing';
        handleHover(e.clientX);
        e.preventDefault();
      });

      window.addEventListener('mousemove', (e) => {
        if (isMouseDown) {
          const dx = e.clientX - dragStartX;
          const rect = canvas.getBoundingClientRect();
          const PL = 36, PR = 14, cW = rect.width - PL - PR;
          const maxPan = (cW / 2) * (state.zoom - 1);

          state.panX = Math.max(-maxPan, Math.min(maxPan, dragStartPanX + dx));
          handleHover(e.clientX);
          redrawGraph();
        } else if (e.target === canvas) {
          handleHover(e.clientX);
        }
      });

      window.addEventListener('mouseup', () => {
        if (isMouseDown) {
          isMouseDown = false;
          canvas.style.cursor = 'grab';
        }
      });

      let isTouching = false;
      let touchStartX = 0;
      let touchStartPanX = 0;
      let pinchDist0 = 0;
      let pinchZoom0 = 1;

      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isTouching = true;
          touchStartX = e.touches[0].clientX;
          touchStartPanX = state.panX;
          handleHover(e.touches[0].clientX);
        } else if (e.touches.length === 2) {
          isTouching = true;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchDist0 = Math.hypot(dx, dy);
          pinchZoom0 = state.zoom;
          e.preventDefault();
        }
      }, { passive: false });

      canvas.addEventListener('touchmove', (e) => {
        if (!isTouching) return;
        if (e.touches.length === 1) {
          const dx = e.touches[0].clientX - touchStartX;
          const rect = canvas.getBoundingClientRect();
          const PL = 36, PR = 14, cW = rect.width - PL - PR;
          const maxPan = (cW / 2) * (state.zoom - 1);
          state.panX = Math.max(-maxPan, Math.min(maxPan, touchStartPanX + dx));
          handleHover(e.touches[0].clientX);
          redrawGraph();
          if (e.cancelable) e.preventDefault();
        } else if (e.touches.length === 2 && pinchDist0 > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const oldZoom = state.zoom;
          state.zoom = Math.max(1, Math.min(25, pinchZoom0 * (dist / pinchDist0)));
          state.panX *= (state.zoom / oldZoom);
          redrawGraph();
          if (e.cancelable) e.preventDefault();
        }
      }, { passive: false });

      canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
          isTouching = false;
          pinchDist0 = 0;
          state.scrubIdx = null;
          redrawGraph();
        } else if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartPanX = state.panX;
        }
      });

      canvas.addEventListener('wheel', (e) => {
        if (!state.cachedData) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        const oldZoom = state.zoom;
        const newZoom = Math.max(1, Math.min(25, state.zoom * factor));
        if (newZoom !== oldZoom) {
          state.panX *= (newZoom / oldZoom);
          state.zoom = newZoom;
          const rect = canvas.getBoundingClientRect();
          const PL = 36, PR = 14, cW = rect.width - PL - PR;
          const maxPan = (cW / 2) * (state.zoom - 1);
          state.panX = Math.max(-maxPan, Math.min(maxPan, state.panX));
          redrawGraph();
        }
      }, { passive: false });

      canvas.addEventListener('dblclick', (e) => {
        e.preventDefault();
        state.zoom = 1;
        state.panX = 0;
        state.scrubIdx = null;
        redrawGraph();
      });

      canvas.addEventListener('mouseleave', () => {
        if (!isMouseDown) {
          state.scrubIdx = null;
          redrawGraph();
        }
      });
    }

    // Export Handlers
    saveTxtBtn.onclick = () => {
      if (!state.cachedRawText) { alert('No report data ready to export.'); return; }
      const cleanLbl = (state.cachedData?.periodLabel || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cfg.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Report_${cleanLbl}.txt`;
      const blob = new Blob([state.cachedRawText], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.download = filename;
      a.href = URL.createObjectURL(blob);
      a.click();
      URL.revokeObjectURL(a.href);
    };

    savePngBtn.onclick = () => {
      const targetEl = (state.view === 'report') ? reportWrap : graphWrap;
      if (!targetEl) return;
      if (typeof html2canvas === 'undefined') { alert('html2canvas library not loaded.'); return; }

      const origBtn = savePngBtn.textContent;
      savePngBtn.disabled = true;
      savePngBtn.textContent = 'Saving…';

      const clone = targetEl.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.zIndex = '-9999';
      clone.style.width = '640px';
      clone.style.background = '#141416';
      clone.style.color = '#f4f4f5';
      clone.style.padding = '14px';
      clone.style.borderRadius = '12px';
      document.body.appendChild(clone);

      html2canvas(clone, {
        backgroundColor: '#141416',
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false
      }).then(c => {
        const cleanLbl = (state.cachedData?.periodLabel || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
        const a = document.createElement('a');
        a.download = `${cfg.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${state.view === 'report' ? 'Report' : 'Graph'}_${cleanLbl}.png`;
        a.href = c.toDataURL('image/png');
        a.click();
        document.body.removeChild(clone);
        savePngBtn.disabled = false;
        savePngBtn.textContent = origBtn;
      }).catch(err => {
        console.error('PNG export failed', err);
        if (clone.parentNode) document.body.removeChild(clone);
        savePngBtn.disabled = false;
        savePngBtn.textContent = origBtn;
        alert('Failed to capture PNG: ' + err.message);
      });
    };

    syncTabButtons();
    loadBoxPeriodData();
  }

    function renderGridDetailSection(container) {
    return renderBoxDetailAnalyticsSection(container, 'grid');
  }

  const EXTRAS_REGISTRY = {
    solar:   { build: () => buildSolarExtras() },
    grid:    { build: () => buildGridExtras() },
    battery: { build: () => buildBatteryExtras() },
    fridge:  { build: () => buildFridgeExtras() },
    k15:     { build: () => buildAcExtras('k15') },
    k1:      { build: () => buildAcExtras('k1') },
    haier:   { build: () => buildAcExtras('haier') },
    water:   { build: () => buildWaterTankExtras() },
    motor:   { build: () => buildMotorExtras() },
    wm:      { build: () => buildWmExtras() },
    pc:      { build: () => buildPcExtras() },
    battery2:{ build: () => buildBattery2Extras() }
  };

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
  window.buildBatterySocChart = buildBatterySocChart;
  window.buildBattery2SocChart = buildBattery2SocChart;
  window.renderBatterySocChart = buildBatterySocChart;
  window.renderBattery2SocChart = buildBattery2SocChart;
  window.renderGridDetailSection = renderGridDetailSection;
  window.renderBoxDetailAnalyticsSection = renderBoxDetailAnalyticsSection;
  window.FLOW_EXTRAS_REGISTRY = EXTRAS_REGISTRY;
  window.BATTERY2_FEED_IDS = BAT2_IDS;
})();

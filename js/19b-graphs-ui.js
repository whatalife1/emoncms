let graphNeedsDayZoom = false;
let tooltipPinned = false;
let graphsAutoRefreshInterval = null;
let graphsLastUpdate = 0;

function _gNavInfo() {
    const now = getPktNow();
    
    if (graphTab === 'day') {
        const d = new Date(now.getTime());
        d.setDate(d.getDate() + graphDateNav);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();

        let startMs = getPktDayStart(year, month, day);
        startMs += window.graphDayStartHour * 3600 * 1000;
        
        const res = (graphChartType === 'hourly') ? 3600 : GRAPH_DAY_RESOLUTION_SECONDS;
        const totalPoints = Math.ceil((24 * 3600) / res);
        const labels = [];
        const fullLabels = [];
        
        for (let i = 0; i < totalPoints; i++) { 
            const currentTs = startMs + i * res * 1000;
            const pktDate = getKarachiDate(currentTs);
            const h = pktDate.hour;
            const m = Math.floor((currentTs / 60000)) % 60;
            const ampm = h >= 12 ? 'pm' : 'am';
            const hh = h % 12 || 12;
            const mm = String(m).padStart(2, '0');
            labels.push(`${hh}${ampm}`);
            fullLabels.push(`${hh}:${mm}${ampm}`);
        }
        
        return { 
            label: graphDateNav === 0 ? 'Today' : `${day} ${_MONTH_SHORT[month-1]}`, 
            sub: `${day} ${_MONTH_NAMES[month-1]} ${year}`,
            interval: res, 
            startMs, 
            endMs: startMs + 24 * 3600 * 1000 - 1, 
            isDayTab: true, 
            nBars: totalPoints, 
            labels, 
            timeLabels: fullLabels,
            fullLabels,
            resSeconds: res 
        };
    }

    if (graphTab === 'month') {
        let base = new Date(now.getFullYear(), now.getMonth() + graphMonthNav, 1);
        let sM = base.getMonth() - 1; let sY = base.getFullYear(); if (sM < 0) { sM = 11; sY--; }
        const start = new Date(sY, sM, 25);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
        const days = Math.ceil((end - start) / 86400000);
        const labels = []; 
        const timeLabels = [];
        for (let i = 0; i < days; i++) { 
            const d = new Date(start.getTime() + i*86400000);
            const pktDate = getKarachiDate(d.getTime());
            labels.push(`${pktDate.day}/${pktDate.month}`);
            timeLabels.push(`${pktDate.day}/${pktDate.month}`);
        }
        return { 
            label: `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})} - ${end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}`,
            interval: GRAPH_MONTH_RESOLUTION_SECONDS,
            isDayTab: false, 
            nBars: days, 
            startMs: start.getTime(), 
            endMs: end.getTime(), 
            labels, 
            timeLabels, 
            month: start.getMonth(), 
            year: start.getFullYear(), 
            isMonthBilling: true, 
            resSeconds: GRAPH_MONTH_RESOLUTION_SECONDS
        };
    }

    if (graphTab === 'year') {
        const y = now.getFullYear() + graphYearNav;
        const start = new Date(y, 0, 1);
        const end = new Date(y, 11, 31, 23, 59, 59);
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const timeLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if ((y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)) {
            daysInMonth[1] = 29;
        }
        return { 
            label: `${y}`, 
            interval: GRAPH_YEAR_RESOLUTION_SECONDS,
            isYearly: true, 
            nBars: 12, 
            startMs: start.getTime(), 
            endMs: end.getTime(), 
            labels, 
            timeLabels,
            daysInMonth: daysInMonth,
            year: y, 
            isYearBilling: true, 
            resSeconds: GRAPH_YEAR_RESOLUTION_SECONDS,
            isYearView: true
        };
    }
    return { label:'All Time', startMs: new Date(2024,0,1).getTime(), endMs: now.getTime(), labels:[], timeLabels:[] };
}
window._gNavInfo = _gNavInfo;

function _renderGNavBar() {
    const wrap = document.getElementById('graph-nav-bar');
    if (!wrap || graphTab === 'total') return;

    const nav = _gNavInfo();
    const canFwd = (graphTab === 'day' && graphDateNav < 0) ||
                   (graphTab === 'month' && nav.endMs < Date.now()) ||
                   (graphTab === 'year' && graphYearNav < 0);

    let dateStr = '';
    if (graphTab === 'day') {
        const d = new Date(getPktNow().getTime());
        d.setDate(d.getDate() + graphDateNav);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
    }

    let rightControls = '';
    if (graphTab === 'day') {
        rightControls = `
            <input type="date" id="graph-date-picker" value="${dateStr}" 
                   style="background:var(--input-bg);border:1px solid var(--border);border-radius:6px;
                          color:var(--text-main);padding:3px 6px;font-size:12px;width:auto;max-width:130px;
                          cursor:pointer;margin-left:4px;">
            <button id="graph-today-btn" class="graph-nav-btn" style="font-size:10px;padding:2px 8px;margin-left:4px;">Today</button>
        `;
    }

    const startToggle = graphTab === 'day'
        ? `<button id="graph-start-toggle" class="graph-nav-btn" style="font-size:10px; padding:2px 8px; margin-left:4px;">${
            window.graphDayStartHour === 5 ? '5am-5am' : '12am-12am'
          }</button>`
        : '';

    wrap.innerHTML = `
        <button class="graph-nav-btn" id="gnav-prev">‹</button>
        <div class="graph-nav-center" style="flex:1;text-align:center;">
            <div class="graph-nav-label">${nav.label}</div>
            ${nav.sub ? `<div class="graph-nav-sub">${nav.sub}</div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:2px;flex-shrink:0;">
            ${startToggle}
            ${rightControls}
            <button class="graph-nav-btn" id="gnav-next" style="opacity:${canFwd ? 1 : 0.3};margin-left:4px;">›</button>
        </div>
    `;

    document.getElementById('gnav-prev').addEventListener('click', () => {
        if (graphTab === 'day') graphDateNav--;
        else if (graphTab === 'month') graphMonthNav--;
        else graphYearNav--;
        graphZoomLevel = 1;
        graphPanOffset = 0;
        hideTooltip();
        _renderGNavBar();
        if (typeof _loadAndDraw === 'function') _loadAndDraw();
    });

    document.getElementById('gnav-next').addEventListener('click', () => {
        if (canFwd) {
            if (graphTab === 'day') graphDateNav++;
            else if (graphTab === 'month') graphMonthNav++;
            else graphYearNav++;
            graphZoomLevel = 1;
            graphPanOffset = 0;
            hideTooltip();
            _renderGNavBar();
            if (typeof _loadAndDraw === 'function') _loadAndDraw();
        }
    });

    const toggleBtn = document.getElementById('graph-start-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleGraphStartHour();
        });
    }

    const datePicker = document.getElementById('graph-date-picker');
    if (datePicker) {
        datePicker.addEventListener('change', function() {
            const [y, m, d] = this.value.split('-').map(Number);
            const targetMs = Date.UTC(y, m - 1, d);
            const pktDate = getKarachiDate(Date.now());
            const todayMs = Date.UTC(pktDate.year, pktDate.month - 1, pktDate.day);
            graphDateNav = Math.round((targetMs - todayMs) / 86400000);
            graphZoomLevel = 1;
            graphPanOffset = 0;
            hideTooltip();
            _renderGNavBar();
            if (typeof _loadAndDraw === 'function') _loadAndDraw();
        });
    }

    const todayBtn = document.getElementById('graph-today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            graphDateNav = 0;
            graphZoomLevel = 1;
            graphPanOffset = 0;
            hideTooltip();
            _renderGNavBar();
            if (typeof _loadAndDraw === 'function') _loadAndDraw();
        });
    }
}
window._renderGNavBar = _renderGNavBar;

window.generateGraphReport = async function() {
    const nav = _gNavInfo();
    const isDay = graphTab === 'day';
    const isMonth = graphTab === 'month';
    const isYear = graphTab === 'year';

    if (!isDay && !isMonth && !isYear) {
        return { text: "Report only available for Day, Month or Year view.", html: "" };
    }

    const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
        const data = await fetchWithCache(feed.id, nav.startMs, nav.endMs);
        return { feed, data };
    });

    const results = await Promise.all(fetchPromises);
    const sums = {};
    const visualData = {}; 
    
    results.forEach(r => {
        const fId = r.feed.id;
        const ds = r.feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
        const de = r.feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
        const dWh = {}, nWh = {}, h24 = {}, hArr = isDay ? new Array(24).fill(0) : [], hCnt = isDay ? new Array(24).fill(0) : [];
        for (const tsStr in r.data) {
            const ts = parseInt(tsStr), val = r.data[tsStr], p = getKarachiDate(ts);
            const dKey = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
            h24[dKey] = (h24[dKey] || 0) + val;
            if (p.hour >= ds && p.hour < de) dWh[dKey] = (dWh[dKey] || 0) + val;
            if (p.hour >= 17 || p.hour < 8) nWh[dKey] = (nWh[dKey] || 0) + val;
            if (isDay) { hArr[p.hour] += val; hCnt[p.hour]++; }
        }
        sums[fId] = { h24, day: dWh, night: nWh };
        if (isDay) {
            const proc = hArr.map((s, i) => hCnt[i] ? s/hCnt[i] : 0);
            visualData[fId] = { arr: proc, max: Math.max(...proc, 0.1) };
        } else {
            const sorted = Object.keys(h24).sort(), dArr = sorted.map(d => h24[d]);
            visualData[fId] = { arr: dArr, max: Math.max(...dArr, 0.1) };
        }
    });

    const solarF = EXPORT_FEEDS.find(f => f.isSolar);
    const breakerF = EXPORT_FEEDS.find(f => f.isBreaker);
    const loadFeeds = EXPORT_FEEDS.filter(f => !f.isSolar && !f.isBreaker);

    let totalLoadKwh = 0, totalDayLoadKwh = 0, totalNightLoadKwh = 0;
    loadFeeds.forEach(f => {
        const totalWh = Object.values(sums[f.id].h24).reduce((a,b)=>a+b, 0);
        const dayWh = Object.values(sums[f.id].day).reduce((a,b)=>a+b, 0);
        const nightWh = Object.values(sums[f.id].night).reduce((a,b)=>a+b, 0);
        totalLoadKwh += totalWh / 1000;
        totalDayLoadKwh += dayWh / 1000;
        totalNightLoadKwh += nightWh / 1000;
    });

    const reportDates = Object.keys(sums[solarF.id].h24).sort();
    const numDays = reportDates.length || 1;
    const nightHoursPerDay = (isDay && graphTab === 'day' && graphDateNav === 0) ? 
        (() => { const now = getPktNow(); const h = now.getHours() + now.getMinutes()/60; 
            if (h < 8) return h;
            if (h >= 17) return 8 + (h - 17);
            return 8;
        })() :
        (24 - EXPORT_NIGHT_START) + EXPORT_NIGHT_END;
    const totalNightHours = nightHoursPerDay * numDays;

    const colWidths = {
        name: 18, total: 12, day: 12, dayPct: 8, night: 12, nightPct: 8,
        dayShare: 10, nightShare: 12, avgNight: 14, avgDay: 10, totalPct: 12
    };

    const headerParts = [
        'Appliance'.padEnd(colWidths.name),
        'Total (kWh)'.padStart(colWidths.total),
        'Day (kWh)'.padStart(colWidths.day),
        'Night (kWh)'.padStart(colWidths.night),
        'Avg Night (W)'.padStart(colWidths.avgNight),
        'Avg/Day'.padStart(colWidths.avgDay),
        'Day %'.padStart(colWidths.dayPct),
        'Night %'.padStart(colWidths.nightPct),
        'Day Share'.padStart(colWidths.dayShare),
        'Night Share'.padStart(colWidths.nightShare),
        '% of Total'.padStart(colWidths.totalPct)
    ];
    const header = headerParts.join(' ');

    let txt = `📄 Energy Usage Report: ${nav.label}\n`;
    txt += `Generated: ${new Date().toLocaleString()}\n\n`;
    txt += `Time Period Definitions:\n`;
    txt += `  • Day   = 8:00 AM  → 5:00 PM  (9 hours)\n`;
    txt += `  • Night = 5:00 PM  → 8:00 AM  (15 hours)\n`;
    txt += `  • Solar hours = 8:00 AM → 5:00 PM\n\n`;
    txt += header + '\n';
    txt += '-'.repeat(header.length) + '\n';

    function formatRow(name, total, day, night, avgNightW, avgDay, totalPct, isSolar, isBreaker) {
        const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
        const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
        const dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
        const nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);

        const shortName = name.length > colWidths.name ? name.substring(0, colWidths.name-1) + '…' : name;

        const parts = [
            shortName.padEnd(colWidths.name),
            total.toFixed(2).padStart(colWidths.total),
            isSolar ? '-'.padStart(colWidths.day) : day.toFixed(2).padStart(colWidths.day),
            isSolar ? '-'.padStart(colWidths.night) : night.toFixed(2).padStart(colWidths.night),
            isSolar ? '-'.padStart(colWidths.avgNight) : (Math.round(avgNightW) + ' W').padStart(colWidths.avgNight),
            avgDay.toFixed(2).padStart(colWidths.avgDay),
            isSolar ? '-'.padStart(colWidths.dayPct) : dayPct.toFixed(1).padStart(colWidths.dayPct) + '%',
            isSolar ? '-'.padStart(colWidths.nightPct) : nightPct.toFixed(1).padStart(colWidths.nightPct) + '%',
            (totalDayLoadKwh === 0) ? '-'.padStart(colWidths.dayShare) : dayShare.toFixed(1).padStart(colWidths.dayShare) + '%',
            (totalNightLoadKwh === 0) ? '-'.padStart(colWidths.nightShare) : nightShare.toFixed(1).padStart(colWidths.nightShare) + '%',
            (totalLoadKwh === 0) ? '-'.padStart(colWidths.totalPct) : totalPct.toFixed(1).padStart(colWidths.totalPct) + '%'
        ];
        return parts.join(' ');
    }

    EXPORT_FEEDS.forEach(f => {
        const totalWh = Object.values(sums[f.id].h24).reduce((a,b)=>a+b,0);
        const dayWh = Object.values(sums[f.id].day).reduce((a,b)=>a+b,0);
        const nightWh = Object.values(sums[f.id].night).reduce((a,b)=>a+b,0);
        const totalKwh = totalWh / 1000;
        const dayKwh = dayWh / 1000;
        const nightKwh = nightWh / 1000;
        const avg = totalKwh / numDays;
        const avgNightW = totalNightHours > 0 ? nightWh / totalNightHours : 0;
        const totalPct = (totalLoadKwh === 0) ? 0 : (totalKwh / totalLoadKwh * 100);

        txt += formatRow(f.name, totalKwh, dayKwh, nightKwh, avgNightW, avg, totalPct, f.isSolar, f.isBreaker) + '\n';
    });

    let html = `<div class="report-wrapper" style="background:var(--bg-panel); color:var(--text-main); border:1px solid var(--border); border-radius:10px; padding:10px; margin-top:20px;">`;
    html += `<h4 style="margin:0 0 10px 0; font-size:14px; border-bottom:1px solid var(--border); padding-bottom:5px;">Consumption Breakdown</h4>`;
    html += `<div style="font-size:11px; color:var(--text-muted); margin-bottom:12px; padding:8px 12px; background:var(--bg-card); border-radius:6px; border-left:3px solid var(--accent-solar);">`;
    html += `<span style="font-weight:700;">⏰ Time Periods:</span> `;
    html += `<span style="color:var(--accent-solar);">Day</span> = 8:00 AM → 5:00 PM (9 hrs) &nbsp;|&nbsp; `;
    html += `<span style="color:#c084fc;">Night</span> = 5:00 PM → 8:00 AM (15 hrs)`;
    html += `</div>`;
    html += `<div class="table-scroll" style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:11px; font-family:monospace;">`;
    html += `<tr style="background:var(--bg-card);">
        <th style="border:1px solid var(--border); padding:6px; text-align:left;">Appliance</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Total (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Day (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Night (kWh)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Avg Night (W)</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Avg/Day</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Day %</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Night %</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Day Share</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">Night Share</th>
        <th style="border:1px solid var(--border); padding:6px; text-align:right;">% of Total</th>
    </tr>`;

    EXPORT_FEEDS.forEach(f => {
        const totalWh = Object.values(sums[f.id].h24).reduce((a,b)=>a+b,0);
        const dayWh = Object.values(sums[f.id].day).reduce((a,b)=>a+b,0);
        const nightWh = Object.values(sums[f.id].night).reduce((a,b)=>a+b,0);
        const totalKwh = totalWh / 1000;
        const dayKwh = dayWh / 1000;
        const nightKwh = nightWh / 1000;
        const avg = totalKwh / numDays;
        const avgNightW = totalNightHours > 0 ? nightWh / totalNightHours : 0;
        const totalPct = (totalLoadKwh === 0) ? 0 : (totalKwh / totalLoadKwh * 100);
        const dayPct = (f.isSolar || totalKwh === 0) ? 0 : (dayKwh / totalKwh * 100);
        const nightPct = (f.isSolar || totalKwh === 0) ? 0 : (nightKwh / totalKwh * 100);
        const dayShare = (totalDayLoadKwh === 0) ? 0 : (dayKwh / totalDayLoadKwh * 100);
        const nightShare = (totalNightLoadKwh === 0) ? 0 : (nightKwh / totalNightLoadKwh * 100);

        let color = "var(--text-main)";
        if (f.isSolar) color = "var(--accent-solar)";
        else if (f.isBreaker) color = "#ef4444";

        html += `<tr>
            <td style="border:1px solid var(--border); padding:6px; font-weight:bold;">${f.name}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:${color};">${totalKwh.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${f.isSolar?'-':dayKwh.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${f.isSolar?'-':nightKwh.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${f.isSolar?'-':Math.round(avgNightW) + ' W'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right;">${avg.toFixed(2)}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${f.isSolar?'-':dayPct.toFixed(1) + '%'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${f.isSolar?'-':nightPct.toFixed(1) + '%'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${totalDayLoadKwh===0?'-':dayShare.toFixed(1) + '%'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${totalNightLoadKwh===0?'-':nightShare.toFixed(1) + '%'}</td>
            <td style="border:1px solid var(--border); padding:6px; text-align:right;">${totalLoadKwh===0?'-':totalPct.toFixed(1)+'%'}</td>
        </tr>`;
    });

    html += `<tr style="background:var(--bg-card); font-weight:bold;">
        <td style="border:1px solid var(--border); padding:6px;">TOTAL LOAD</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">${totalLoadKwh.toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${totalDayLoadKwh.toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${totalNightLoadKwh.toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">-</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">${(totalLoadKwh/numDays).toFixed(2)}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">${totalLoadKwh===0?'-':(totalDayLoadKwh/totalLoadKwh*100).toFixed(1)+'%'}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">${totalLoadKwh===0?'-':(totalNightLoadKwh/totalLoadKwh*100).toFixed(1)+'%'}</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:var(--accent-solar);">100%</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right; color:#c084fc;">100%</td>
        <td style="border:1px solid var(--border); padding:6px; text-align:right;">100%</td>
    </tr>`;
    html += `</table></div>`;
    html += `</div>`;
    return { text: txt, html: html };
};

function startGraphsAutoRefresh() {
    if (graphsAutoRefreshInterval) clearInterval(graphsAutoRefreshInterval);
    if (graphTab === 'day') {
        graphsAutoRefreshInterval = setInterval(() => {
            const p = document.getElementById('graphs-panel');
            if (!p || !p.classList.contains('open')) { clearInterval(graphsAutoRefreshInterval); return; }
            if (!graphIsLoading && !graphIsPanning) {
                if (typeof _loadAndDraw === 'function') _loadAndDraw();
            }
        }, 60000);
    }
}

function stopGraphsAutoRefresh() { if (graphsAutoRefreshInterval) clearInterval(graphsAutoRefreshInterval); }

function _renderChartTypeToggle() {
    const existing = document.getElementById('chart-type-toggle'); if (existing) existing.remove();
    const card = document.querySelector('.graph-chart-card'); if (!card) return;
    const toggle = document.createElement('div'); toggle.id = 'chart-type-toggle';
    toggle.style.cssText = `position:absolute; top:8px; right:8px; z-index:15; display:flex; flex-direction:column; gap:4px; background: var(--bg-panel); padding: 4px; border-radius: 8px; box-shadow: -2px 2px 8px rgba(0,0,0,0.4);`;
    [{ type: 'line', label: 'Line' }, { type: 'bar', label: 'Bar' }, { type: 'hourly', label: 'Hourly' }].forEach(({ type, label }) => {
        const btn = document.createElement('button'); const active = graphChartType === type;
        btn.textContent = label; btn.style.cssText = `padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; width:auto; background:${active ? 'var(--bg-base)' : 'rgba(0,0,0,0.45)'}; border:1px solid ${active ? 'var(--border)' : 'transparent'}; color:var(--text-main); opacity:${active ? '1' : '0.55'}; font-weight:700;`;
        btn.addEventListener('click', () => { graphChartType = type; _renderChartTypeToggle(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
        toggle.appendChild(btn);
    });
    card.appendChild(toggle);
}

function _renderGTimeTabs() {
    const wrap = document.getElementById('graph-time-tabs'); if (!wrap) return;
    wrap.innerHTML = ['day','month','year','total'].map(t => `<button class="gtime-tab${graphTab===t?' active':''}" data-gtab="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
    wrap.querySelectorAll('.gtime-tab').forEach(b => {
        b.addEventListener('click', () => {
            graphTab = b.dataset.gtab; graphChartType = (graphTab === 'day') ? 'line' : 'bar';
            if (graphTab === 'day') startGraphsAutoRefresh(); else stopGraphsAutoRefresh();
            graphDateNav = 0; graphMonthNav = 0; graphYearNav = 0; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip();
            _renderGTimeTabs(); _renderGNavBar(); updateGraphStartButton(); _renderChartTypeToggle(); if (typeof _loadAndDraw === 'function') _loadAndDraw();
        });
    });
}

function _renderGridAllToggles() {
    const existing = document.getElementById('gridall-toggles'); if (existing) existing.remove();
    if (graphFeedKey !== 'gridall') return;
    const wrap = document.createElement('div'); wrap.id = 'gridall-toggles';
    wrap.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 0 8px;flex-shrink:0;align-items:center;justify-content:center;';
    GRID_ALL_FEEDS.forEach(f => {
        const off = window.gridAllDisabled.has(f.key);
        const btn = document.createElement('button');
        btn.style.cssText = `white-space:nowrap; flex-shrink:0; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700; cursor:pointer; border:1.5px solid ${f.color}; width:auto; background:${off ? 'transparent' : f.color + '33'}; color:${off ? 'var(--text-muted)' : f.color}; opacity:${off ? '0.4' : '1'};`;
        btn.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.color};margin-right:5px;vertical-align:middle;opacity:${off?0.3:1}"></span>${f.label}`;
        btn.addEventListener('click', () => { if (window.gridAllDisabled.has(f.key)) window.gridAllDisabled.delete(f.key); else if ((GRID_ALL_FEEDS.length - window.gridAllDisabled.size) > 1) window.gridAllDisabled.add(f.key); _renderGridAllToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
        wrap.appendChild(btn);
    });
    const feedTabsWrap = document.getElementById('graph-feed-tabs');
    if (feedTabsWrap) feedTabsWrap.parentNode.insertBefore(wrap, feedTabsWrap);
}

function _renderOverlayToggles() {
    const existing = document.getElementById('temp-overlay-toggles'); if (existing) existing.remove();
    if (!['temp', 'temp2'].includes(graphFeedKey)) return;
    const container = document.createElement('div'); container.id = 'temp-overlay-toggles';
    container.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:6px 0 8px;align-items:center;justify-content:center;';
    const acs = [{ key: 'haier', label: '+ Haier 1T', color: '#a5f3fc' }, { key: 'k15', label: '+ Kenwood 1.5T', color: '#38bdf8' }, { key: 'k1', label: '+ Kenwood 1T', color: '#7dd3fc' }];
    const clearBtn = document.createElement('button'); clearBtn.textContent = 'Clear'; clearBtn.style.cssText = 'padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--text-muted);';
    clearBtn.addEventListener('click', () => { window.graphOverlayAc = null; _renderOverlayToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
    container.appendChild(clearBtn);
    acs.forEach(t => {
        const active = window.graphOverlayAc === t.key;
        const btn = document.createElement('button'); btn.style.cssText = `padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer; border:1.5px solid ${t.color};background:${active ? t.color+'33' : 'transparent'}; color:${active ? t.color : 'var(--text-muted)'};opacity:${active ? '1' : '0.5'};`;
        btn.textContent = t.label; btn.addEventListener('click', () => { window.graphOverlayAc = t.key; _renderOverlayToggles(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); });
        container.appendChild(btn);
    });
    const fTabs = document.getElementById('graph-feed-tabs'); if (fTabs) fTabs.parentNode.insertBefore(container, fTabs.nextSibling);
}

function _renderGFeedTabs() {
    const wrap = document.getElementById('graph-feed-tabs'); if (!wrap) return;
    const tabs = [GRAPH_COMBINED, GRAPH_MOMENT_FLOW, ...GRAPH_FEEDS];
    wrap.innerHTML = tabs.map(f => `<button class="gfeed-tab${graphFeedKey===f.key?' active':''}" data-gkey="${f.key}" style="${graphFeedKey===f.key?`border-color:${f.color};color:${f.color}`:''}">${f.label}</button>`).join('') + `<button class="gfeed-tab${graphFeedKey==='report'?' active':''}" data-gkey="report" style="${graphFeedKey==='report'?'border-color:#10b981;color:#10b981':''}">📄 Report</button>`;
    wrap.querySelectorAll('.gfeed-tab').forEach(b => { b.addEventListener('click', () => { graphFeedKey = b.dataset.gkey; graphZoomLevel = 1; graphPanOffset = 0; hideTooltip(); _renderGFeedTabs(); if (typeof _loadAndDraw === 'function') _loadAndDraw(); }); });
    _renderGridAllToggles(); _renderOverlayToggles();
}

function hideTooltip() { const t = document.getElementById('graph-tooltip'); if (t) { t.style.display = 'none'; t.classList.remove('pinned'); } tooltipPinned = false; }

function openGraphsPanel() {
    const p = document.getElementById('graphs-panel'); if (!p) return;
    if (navigator.userAgent.toLowerCase().includes('windows')) p.classList.add('fullscreen');
    p.classList.add('open');
    setTimeout(() => { renderGraphsPanel(); if (graphTab === 'day') startGraphsAutoRefresh(); }, 50);
}

function closeGraphsPanel() { const p = document.getElementById('graphs-panel'); if (p) p.classList.remove('open'); hideTooltip(); graphZoomLevel = 1; graphPanOffset = 0; stopGraphsAutoRefresh(); }

function renderGraphsPanel() {
    if (graphIsRendering) return; graphIsRendering = true;
    try { 
        _renderGFeedTabs(); 
        _renderGTimeTabs(); 
        _renderGNavBar(); 
        _renderChartTypeToggle(); 
        if (typeof _loadAndDraw === 'function') _loadAndDraw(); 
    }
    catch(e) { console.warn('Graph render error:', e); } finally { graphIsRendering = false; }
}

window._renderGFeedTabs = _renderGFeedTabs;
window._renderGTimeTabs = _renderGTimeTabs;
window._renderChartTypeToggle = _renderChartTypeToggle;
window.renderGraphsPanel = renderGraphsPanel;
window.openGraphsPanel = openGraphsPanel;
window.closeGraphsPanel = closeGraphsPanel;


// ===== Add to js/19b-graphs-ui.js =====

/**
 * Save the report text (from the <pre> tag) as a .txt file.
 */
window.downloadDayGraphReport = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const pre = reportDiv.querySelector('pre');
  if (!pre) {
    alert('No report text available. Please calculate a report first.');
    return;
  }
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

/**
 * Capture the report HTML block and save as a PNG image using html2canvas.
 */
window.downloadDayGraphReportPng = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const wrapper = reportDiv.querySelector('.report-wrapper');
  if (!wrapper) {
    alert('No report content to capture.');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    alert('html2canvas library not loaded.');
    return;
  }
  const btn = document.getElementById('btn-graph-report-png');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  // Clone the wrapper to avoid affecting the live DOM during rendering.
  const clone = wrapper.cloneNode(true);
  clone.style.cssText = 'position:fixed;top:0;left:0;width:max-content;max-width:none;z-index:-9999;opacity:1';
  document.body.appendChild(clone);

  html2canvas(clone, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    width: clone.scrollWidth,
    height: clone.scrollHeight
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
  }).catch(err => {
    console.error('PNG capture error:', err);
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
    alert('Failed to capture PNG: ' + err.message);
  });
};


// ===== Add to js/19b-graphs-ui.js =====

/**
 * Save the report text (from the <pre> tag) as a .txt file.
 */
window.downloadDayGraphReport = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const pre = reportDiv.querySelector('pre');
  if (!pre) {
    alert('No report text available. Please calculate a report first.');
    return;
  }
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

/**
 * Capture the report HTML block and save as a PNG image using html2canvas.
 * FIXED: ensures the full table (all columns) is captured, not just the first two.
 */
window.downloadDayGraphReportPng = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const wrapper = reportDiv.querySelector('.report-wrapper');
  if (!wrapper) {
    alert('No report content to capture.');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    alert('html2canvas library not loaded.');
    return;
  }
  const btn = document.getElementById('btn-graph-report-png');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  // Clone the wrapper
  const clone = wrapper.cloneNode(true);
  // Force all scrollable containers to expand fully
  const scrollDivs = clone.querySelectorAll('.table-scroll');
  scrollDivs.forEach(el => {
    el.style.overflow = 'visible';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    const table = el.querySelector('table');
    if (table) {
      table.style.width = 'auto';
      table.style.whiteSpace = 'nowrap';
    }
  });
  // Make clone visible and auto-sized
  clone.style.cssText = 'position:fixed;top:0;left:0;display:inline-block;background:var(--bg-panel);padding:10px;z-index:-9999;opacity:1;';
  document.body.appendChild(clone);

  html2canvas(clone, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    width: clone.scrollWidth,
    height: clone.scrollHeight
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
  }).catch(err => {
    console.error('PNG capture error:', err);
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
    alert('Failed to capture PNG: ' + err.message);
  });
};


// ===== Add to js/19b-graphs-ui.js =====

/**
 * Save the report text (from the <pre> tag) as a .txt file.
 */
window.downloadDayGraphReport = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const pre = reportDiv.querySelector('pre');
  if (!pre) {
    alert('No report text available. Please calculate a report first.');
    return;
  }
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

/**
 * Capture the report HTML block and save as a PNG image.
 * Improved: full table, clear headers, and good visual styling.
 */
window.downloadDayGraphReportPng = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const wrapper = reportDiv.querySelector('.report-wrapper');
  if (!wrapper) {
    alert('No report content to capture.');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    alert('html2canvas library not loaded.');
    return;
  }
  const btn = document.getElementById('btn-graph-report-png');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  // Clone the wrapper and apply clean print styles
  const clone = wrapper.cloneNode(true);
  
  // Force all scrollable containers to expand fully
  const scrollDivs = clone.querySelectorAll('.table-scroll');
  scrollDivs.forEach(el => {
    el.style.overflow = 'visible';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    const table = el.querySelector('table');
    if (table) {
      table.style.width = 'auto';
      table.style.whiteSpace = 'nowrap';
      table.style.borderCollapse = 'collapse';
      // Add borders and padding for clarity
      table.querySelectorAll('th, td').forEach(cell => {
        cell.style.border = '1px solid #ccc';
        cell.style.padding = '6px 10px';
        cell.style.textAlign = 'right';
        cell.style.backgroundColor = '#fff';
      });
      // Headers: bold and with background
      table.querySelectorAll('th').forEach(th => {
        th.style.backgroundColor = '#f4f4f5';
        th.style.fontWeight = 'bold';
        th.style.textAlign = 'center';
      });
      // First column (appliance name) left-aligned
      table.querySelectorAll('td:first-child').forEach(td => {
        td.style.textAlign = 'left';
        td.style.fontWeight = 'bold';
      });
      // Color-code Solar (yellow) and Breaker (red) rows if needed
      // We'll let the existing classes handle colors.
    }
  });

  // Also ensure the wrapper itself has a clean background and padding
  clone.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    display: inline-block;
    background: #ffffff;
    padding: 20px;
    z-index: -9999;
    opacity: 1;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #18181b;
  `;
  
  // Add a title and timestamp at the top
  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:10px;border-bottom:2px solid #ddd;padding-bottom:8px;';
  title.textContent = '📄 Energy Usage Report – ' + new Date().toLocaleDateString('en-PK', { year:'numeric', month:'long', day:'numeric' });
  clone.insertBefore(title, clone.firstChild);

  document.body.appendChild(clone);

  html2canvas(clone, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    width: clone.scrollWidth,
    height: clone.scrollHeight
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
  }).catch(err => {
    console.error('PNG capture error:', err);
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
    alert('Failed to capture PNG: ' + err.message);
  });
};


// ===== Add to js/19b-graphs-ui.js =====

/**
 * Save the report text (from the <pre> tag) as a .txt file.
 */
window.downloadDayGraphReport = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const pre = reportDiv.querySelector('pre');
  if (!pre) {
    alert('No report text available. Please calculate a report first.');
    return;
  }
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

/**
 * Capture the report HTML block and save as a PNG image.
 * Forces all elements to expand so every column is visible.
 */
window.downloadDayGraphReportPng = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const wrapper = reportDiv.querySelector('.report-wrapper');
  if (!wrapper) {
    alert('No report content to capture.');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    alert('html2canvas library not loaded.');
    return;
  }
  const btn = document.getElementById('btn-graph-report-png');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  // Clone the wrapper and force full expansion
  const clone = wrapper.cloneNode(true);
  
  // Recursively force all elements to show all content
  function setOverflowVisible(el) {
    el.style.overflow = 'visible';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    el.style.minWidth = '100%';
    for (let child of el.children) {
      setOverflowVisible(child);
    }
  }
  setOverflowVisible(clone);

  // Specifically fix the table
  const table = clone.querySelector('table');
  if (table) {
    table.style.width = 'auto';
    table.style.minWidth = '100%';
    table.style.whiteSpace = 'nowrap';
    table.style.borderCollapse = 'collapse';
    // Ensure all cells are visible and have borders
    table.querySelectorAll('th, td').forEach(cell => {
      cell.style.border = '1px solid #999';
      cell.style.padding = '6px 10px';
      cell.style.textAlign = 'right';
      cell.style.backgroundColor = '#ffffff';
      cell.style.color = '#18181b';
    });
    // First column left-aligned bold
    table.querySelectorAll('td:first-child, th:first-child').forEach(cell => {
      cell.style.textAlign = 'left';
      cell.style.fontWeight = 'bold';
    });
    // Headers background
    table.querySelectorAll('th').forEach(th => {
      th.style.backgroundColor = '#f0f0f0';
      th.style.fontWeight = 'bold';
      th.style.textAlign = 'center';
    });
  }

  // Add a title
  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:10px;border-bottom:2px solid #ddd;padding-bottom:8px;background:#fff;';
  title.textContent = '📄 Energy Usage Report – ' + new Date().toLocaleDateString('en-PK', { year:'numeric', month:'long', day:'numeric' });
  clone.insertBefore(title, clone.firstChild);

  // Style the wrapper itself
  clone.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    display: inline-block;
    background: #ffffff;
    padding: 20px;
    z-index: -9999;
    opacity: 1;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #18181b;
    overflow: visible;
    width: auto;
    height: auto;
  `;

  document.body.appendChild(clone);

  html2canvas(clone, {
    backgroundColor: '#ffffff',
    scale: 2.5,
    useCORS: true,
    logging: false,
    width: clone.scrollWidth,
    height: clone.scrollHeight
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
  }).catch(err => {
    console.error('PNG capture error:', err);
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
    alert('Failed to capture PNG: ' + err.message);
  });
};

// ===== PATCH: Corrected generateGraphReport (excludes Breaker from load) =====

// Override the existing generateGraphReport with a corrected version
window.generateGraphReport = async function() {
    const nav = _gNavInfo();
    const isDay = graphTab === 'day';
    const isMonth = graphTab === 'month';
    const isYear = graphTab === 'year';
    const isAll = graphTab === 'total';

    let startMs, endMs, label;
    if (isAll) {
        startMs = new Date(2020, 0, 1).getTime();
        endMs = Date.now();
        label = 'All Time';
    } else {
        startMs = nav.startMs;
        endMs = nav.endMs;
        label = nav.label;
    }

    const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
        const data = await fetchWithCache(feed.id, startMs, endMs);
        return { feed, data };
    });
    const results = await Promise.all(fetchPromises);

    const sums = {};
    const hourlyData = {};
    results.forEach(r => {
        const fId = r.feed.id;
        const ds = r.feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
        const de = r.feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
        const dWh = {}, nWh = {}, h24 = {};
        const raw = r.data;
        for (const tsStr in raw) {
            const ts = parseInt(tsStr);
            const val = raw[tsStr];
            const p = getKarachiDate(ts);
            const dKey = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
            h24[dKey] = (h24[dKey] || 0) + val;
            if (p.hour >= ds && p.hour < de) dWh[dKey] = (dWh[dKey] || 0) + val;
            if (p.hour >= 17 || p.hour < 8) nWh[dKey] = (nWh[dKey] || 0) + val;
        }
        sums[fId] = { h24, day: dWh, night: nWh };
        hourlyData[fId] = raw;
    });

    const solarF = EXPORT_FEEDS.find(f => f.isSolar);
    const breakerF = EXPORT_FEEDS.find(f => f.isBreaker);
    const loadFeeds = EXPORT_FEEDS.filter(f => !f.isSolar && !f.isBreaker);

    // We will compute total load as sum of appliances (excluding solar and breaker)
    let totalLoadKwh = 0, totalDayLoadKwh = 0, totalNightLoadKwh = 0;

    // Build rows array
    const rows = [];

    // Helper to compute totals for a feed
    const computeFeedTotals = (feed) => {
        if (feed.id === 'others') {
            // Will be computed later
            return null;
        }
        const totalWh = Object.values(sums[feed.id]?.h24 || {}).reduce((a,b)=>a+b, 0);
        const dayWh = Object.values(sums[feed.id]?.day || {}).reduce((a,b)=>a+b, 0);
        const nightWh = Object.values(sums[feed.id]?.night || {}).reduce((a,b)=>a+b, 0);
        const totalKwh = totalWh / 1000;
        const dayKwh = dayWh / 1000;
        const nightKwh = nightWh / 1000;
        return { totalKwh, dayKwh, nightKwh, totalWh, dayWh, nightWh };
    };

    // Add all regular feeds (including Solar and Breaker)
    for (const f of EXPORT_FEEDS) {
        const totals = computeFeedTotals(f);
        if (totals) {
            rows.push({
                name: f.name,
                isSolar: f.isSolar,
                isBreaker: f.isBreaker,
                totalKwh: totals.totalKwh,
                dayKwh: totals.dayKwh,
                nightKwh: totals.nightKwh,
                totalWh: totals.totalWh,
                dayWh: totals.dayWh,
                nightWh: totals.nightWh
            });
        }
    }

    // ---- Compute "Others" ----
    // Others = (Solar + Breaker) - sum(known appliances)   (for each day)
    // We compute day/night separately.
    const solarData = sums[solarF.id]?.h24 || {};
    const breakerData = sums[breakerF.id]?.h24 || {};
    const applianceData = {};
    loadFeeds.forEach(f => {
        applianceData[f.id] = sums[f.id]?.h24 || {};
    });

    const allDays = new Set();
    Object.keys(solarData).forEach(d => allDays.add(d));
    Object.keys(breakerData).forEach(d => allDays.add(d));
    Object.values(applianceData).forEach(obj => Object.keys(obj).forEach(d => allDays.add(d)));

    // Compute Others day/night per day
    const othersDaySum = {};
    const othersNightSum = {};
    for (const day of allDays) {
        const solarDayVal = (sums[solarF.id]?.day?.[day] || 0);
        const breakerDayVal = (sums[breakerF.id]?.day?.[day] || 0);
        let applianceDayVal = 0;
        for (const f of loadFeeds) {
            applianceDayVal += (sums[f.id]?.day?.[day] || 0);
        }
        const solarNightVal = (sums[solarF.id]?.night?.[day] || 0);
        const breakerNightVal = (sums[breakerF.id]?.night?.[day] || 0);
        let applianceNightVal = 0;
        for (const f of loadFeeds) {
            applianceNightVal += (sums[f.id]?.night?.[day] || 0);
        }
        const othersDayVal = Math.max(0, solarDayVal + breakerDayVal - applianceDayVal);
        const othersNightVal = Math.max(0, solarNightVal + breakerNightVal - applianceNightVal);
        if (othersDayVal > 0) othersDaySum[day] = othersDayVal;
        if (othersNightVal > 0) othersNightSum[day] = othersNightVal;
    }

    const totalOthersDayWh = Object.values(othersDaySum).reduce((a,b)=>a+b, 0);
    const totalOthersNightWh = Object.values(othersNightSum).reduce((a,b)=>a+b, 0);
    const totalOthersWh = totalOthersDayWh + totalOthersNightWh;
    const othersTotalKwh = totalOthersWh / 1000;
    const othersDayKwh = totalOthersDayWh / 1000;
    const othersNightKwh = totalOthersNightWh / 1000;

    // Add Others row
    rows.push({
        name: 'Others (Fans/Lights)',
        isSolar: false,
        isBreaker: false,
        totalKwh: othersTotalKwh,
        dayKwh: othersDayKwh,
        nightKwh: othersNightKwh,
        totalWh: totalOthersWh,
        dayWh: totalOthersDayWh,
        nightWh: totalOthersNightWh
    });

    // Now compute total load (excluding solar and breaker) for percentages
    const numDays = allDays.size || 1;
    const nightHoursPerDay = 15;
    const totalNightHours = nightHoursPerDay * numDays;

    // Recalculate totals for all rows (excluding solar AND breaker)
    totalLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker).reduce((sum, r) => sum + r.totalKwh, 0);
    totalDayLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker).reduce((sum, r) => sum + r.dayKwh, 0);
    totalNightLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker).reduce((sum, r) => sum + r.nightKwh, 0);

    // Generate text report
    let txt = `📄 Energy Usage Report: ${label}\n`;
    txt += `Generated: ${new Date().toLocaleString()}\n\n`;
    txt += `Time Period Definitions:\n`;
    txt += `  • Day   = 8:00 AM  → 5:00 PM  (9 hours)\n`;
    txt += `  • Night = 5:00 PM  → 8:00 AM  (15 hours)\n`;
    txt += `  • Solar hours = 8:00 AM → 5:00 PM\n\n`;

    const colWidths = {
        name: 22,
        total: 12,
        day: 10,
        night: 10,
        avgNight: 12,
        avgDay: 10,
        dayPct: 8,
        nightPct: 8,
        dayShare: 10,
        nightShare: 10,
        totalPct: 10
    };
    const headerParts = [
        'Appliance'.padEnd(colWidths.name),
        'Total (kWh)'.padStart(colWidths.total),
        'Day (kWh)'.padStart(colWidths.day),
        'Night (kWh)'.padStart(colWidths.night),
        'Avg Night (W)'.padStart(colWidths.avgNight),
        'Avg/Day'.padStart(colWidths.avgDay),
        'Day %'.padStart(colWidths.dayPct),
        'Night %'.padStart(colWidths.nightPct),
        'Day Share'.padStart(colWidths.dayShare),
        'Night Share'.padStart(colWidths.nightShare),
        '% of Total'.padStart(colWidths.totalPct)
    ];
    const header = headerParts.join(' ');
    txt += header + '\n';
    txt += '-'.repeat(header.length) + '\n';

    for (const row of rows) {
        const isSolar = row.isSolar;
        const isBreaker = row.isBreaker;
        const total = row.totalKwh;
        const day = isSolar ? 0 : row.dayKwh;
        const night = isSolar ? 0 : row.nightKwh;
        const avgNightW = isSolar ? 0 : (totalNightHours > 0 ? (row.nightWh / totalNightHours) : 0);
        const avgDay = total / numDays;
        const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
        const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
        // For Breaker, we do not compute Day/Night Share because it's not a load
        let dayShare, nightShare;
        if (isBreaker || isSolar) {
            dayShare = '-';
            nightShare = '-';
        } else {
            dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
            nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);
        }
        const totalPct = (totalLoadKwh === 0) ? 0 : (total / totalLoadKwh * 100);

        const shortName = row.name.length > colWidths.name ? row.name.substring(0, colWidths.name-1) + '…' : row.name;
        const parts = [
            shortName.padEnd(colWidths.name),
            total.toFixed(2).padStart(colWidths.total),
            isSolar ? '-'.padStart(colWidths.day) : day.toFixed(2).padStart(colWidths.day),
            isSolar ? '-'.padStart(colWidths.night) : night.toFixed(2).padStart(colWidths.night),
            isSolar ? '-'.padStart(colWidths.avgNight) : (Math.round(avgNightW) + ' W').padStart(colWidths.avgNight),
            avgDay.toFixed(2).padStart(colWidths.avgDay),
            isSolar ? '-'.padStart(colWidths.dayPct) : dayPct.toFixed(1).padStart(colWidths.dayPct) + '%',
            isSolar ? '-'.padStart(colWidths.nightPct) : nightPct.toFixed(1).padStart(colWidths.nightPct) + '%',
            (isSolar || isBreaker) ? '-'.padStart(colWidths.dayShare) : (totalDayLoadKwh === 0 ? '-'.padStart(colWidths.dayShare) : dayShare.toFixed(1).padStart(colWidths.dayShare) + '%'),
            (isSolar || isBreaker) ? '-'.padStart(colWidths.nightShare) : (totalNightLoadKwh === 0 ? '-'.padStart(colWidths.nightShare) : nightShare.toFixed(1).padStart(colWidths.nightShare) + '%'),
            (totalLoadKwh === 0) ? '-'.padStart(colWidths.totalPct) : totalPct.toFixed(1).padStart(colWidths.totalPct) + '%'
        ];
        txt += parts.join(' ') + '\n';
    }

    // Generate HTML report
    let html = `<div class="report-wrapper" style="background:#fff;color:#18181b;border:1px solid #d4d4d8;border-radius:10px;padding:10px;margin-top:20px;font-family:system-ui,sans-serif;">`;
    html += `<h4 style="margin:0 0 10px 0;font-size:14px;border-bottom:1px solid #d4d4d8;padding-bottom:5px;color:#18181b;">Consumption Breakdown</h4>`;
    html += `<div style="font-size:11px;color:#71717a;margin-bottom:12px;padding:8px 12px;background:#f4f4f5;border-radius:6px;border-left:3px solid #f59e0b;">`;
    html += `<span style="font-weight:700;">⏰ Time Periods:</span> `;
    html += `<span style="color:#f59e0b;">Day</span> = 8:00 AM → 5:00 PM (9 hrs) &nbsp;|&nbsp; `;
    html += `<span style="color:#c084fc;">Night</span> = 5:00 PM → 8:00 AM (15 hrs)`;
    html += `</div>`;
    html += `<div class="table-scroll" style="overflow-x:auto;max-width:100%;"><table style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace;min-width:900px;">`;
    // Headers
    html += `<tr style="background:#f4f4f5;border-bottom:2px solid #d4d4d8;">`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:left;">Appliance</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Total (kWh)</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day (kWh)</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night (kWh)</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg Night (W)</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg/Day</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day %</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night %</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day Share</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night Share</th>`;
    html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">% of Total</th>`;
    html += `</tr>`;

    for (const row of rows) {
        const isSolar = row.isSolar;
        const isBreaker = row.isBreaker;
        const total = row.totalKwh;
        const day = isSolar ? 0 : row.dayKwh;
        const night = isSolar ? 0 : row.nightKwh;
        const avgNightW = isSolar ? 0 : (totalNightHours > 0 ? (row.nightWh / totalNightHours) : 0);
        const avgDay = total / numDays;
        const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
        const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
        let dayShare, nightShare;
        if (isBreaker || isSolar) {
            dayShare = '-';
            nightShare = '-';
        } else {
            dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
            nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);
        }
        const totalPct = (totalLoadKwh === 0) ? 0 : (total / totalLoadKwh * 100);
        const color = isSolar ? '#f59e0b' : (isBreaker ? '#ef4444' : '#18181b');

        html += `<tr>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;font-weight:bold;color:${color};">${row.name}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${color};">${total.toFixed(2)}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#f59e0b'};">${isSolar?'-':day.toFixed(2)}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':night.toFixed(2)}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':Math.round(avgNightW)+' W'}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${avgDay.toFixed(2)}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#f59e0b'};">${isSolar?'-':dayPct.toFixed(1)+'%'}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':nightPct.toFixed(1)+'%'}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar||isBreaker?'#71717a':'#f59e0b'};">${(isSolar||isBreaker)?'-':(totalDayLoadKwh===0?'-':dayShare.toFixed(1)+'%')}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar||isBreaker?'#71717a':'#c084fc'};">${(isSolar||isBreaker)?'-':(totalNightLoadKwh===0?'-':nightShare.toFixed(1)+'%')}</td>`;
        html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${totalLoadKwh===0?'-':totalPct.toFixed(1)+'%'}</td>`;
        html += `</tr>`;
    }

    // Total row (only for load, excluding solar and breaker)
    html += `<tr style="background:#f4f4f5;font-weight:bold;border-top:2px solid #d4d4d8;">`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;">TOTAL LOAD</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${totalLoadKwh.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">${totalDayLoadKwh.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">${totalNightLoadKwh.toFixed(2)}</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">-</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${(totalLoadKwh/numDays).toFixed(2)}</td>`;
    const dayPctTotal = totalLoadKwh === 0 ? 0 : (totalDayLoadKwh / totalLoadKwh * 100);
    const nightPctTotal = totalLoadKwh === 0 ? 0 : (totalNightLoadKwh / totalLoadKwh * 100);
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">${dayPctTotal.toFixed(1)}%</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">${nightPctTotal.toFixed(1)}%</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">100%</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">100%</td>`;
    html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">100%</td>`;
    html += `</tr>`;

    html += `</table></div></div>`;

    return { text: txt, html: html };
};

// Ensure download functions exist (they were already defined, but we keep them)
window.downloadDayGraphReport = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const pre = reportDiv.querySelector('pre');
  if (!pre) {
    alert('No report text available. Please calculate a report first.');
    return;
  }
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.txt`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
};

window.downloadDayGraphReportPng = function() {
  const reportDiv = document.getElementById('graph-report-view');
  if (!reportDiv) return;
  const wrapper = reportDiv.querySelector('.report-wrapper');
  if (!wrapper) {
    alert('No report content to capture.');
    return;
  }
  if (typeof html2canvas === 'undefined') {
    alert('html2canvas library not loaded.');
    return;
  }
  const btn = document.getElementById('btn-graph-report-png');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const clone = wrapper.cloneNode(true);
  
  function setOverflowVisible(el) {
    el.style.overflow = 'visible';
    el.style.width = 'auto';
    el.style.maxWidth = 'none';
    el.style.minWidth = '100%';
    for (let child of el.children) {
      setOverflowVisible(child);
    }
  }
  setOverflowVisible(clone);

  const table = clone.querySelector('table');
  if (table) {
    table.style.width = 'auto';
    table.style.minWidth = '100%';
    table.style.whiteSpace = 'nowrap';
    table.style.borderCollapse = 'collapse';
    table.querySelectorAll('th, td').forEach(cell => {
      cell.style.border = '1px solid #999';
      cell.style.padding = '6px 10px';
      cell.style.textAlign = 'right';
      cell.style.backgroundColor = '#ffffff';
      cell.style.color = '#18181b';
    });
    table.querySelectorAll('td:first-child, th:first-child').forEach(cell => {
      cell.style.textAlign = 'left';
      cell.style.fontWeight = 'bold';
    });
    table.querySelectorAll('th').forEach(th => {
      th.style.backgroundColor = '#f0f0f0';
      th.style.fontWeight = 'bold';
      th.style.textAlign = 'center';
    });
  }

  const title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:10px;border-bottom:2px solid #ddd;padding-bottom:8px;background:#fff;';
  title.textContent = '📄 Energy Usage Report – ' + new Date().toLocaleDateString('en-PK', { year:'numeric', month:'long', day:'numeric' });
  clone.insertBefore(title, clone.firstChild);

  clone.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    display: inline-block;
    background: #ffffff;
    padding: 20px;
    z-index: -9999;
    opacity: 1;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #18181b;
    overflow: visible;
    width: auto;
    height: auto;
  `;

  document.body.appendChild(clone);

  html2canvas(clone, {
    backgroundColor: '#ffffff',
    scale: 2.5,
    useCORS: true,
    logging: false,
    width: clone.scrollWidth,
    height: clone.scrollHeight
  }).then(canvas => {
    const a = document.createElement('a');
    a.download = `Graph_Report_${new Date().toISOString().split('T')[0]}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
  }).catch(err => {
    console.error('PNG capture error:', err);
    document.body.removeChild(clone);
    if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
    alert('Failed to capture PNG: ' + err.message);
  });
};

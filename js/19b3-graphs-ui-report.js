// js/19b3-graphs-ui-report.js
// ─── Graph report generation & download ─────────────────────────────────────
window.generateGraphReport = async function(forceRefresh = false) {
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
		const data = await fetchWithCache(feed.id, startMs, endMs, forceRefresh);
		return { feed, data };
	});
	const acBreakdownPromise = typeof fetchAcBreakdown === 'function'
		? fetchAcBreakdown(startMs, endMs)
		: Promise.resolve({ totalHours: '0.0', formattedDuration: '0m', outageCount: 0 });
	const batVPromise = fetchWithCache('546013', startMs, endMs, forceRefresh);
	const batChgPromise = fetchWithCache('546022', startMs, endMs, forceRefresh);
	const batDisPromise = fetchWithCache('546025', startMs, endMs, forceRefresh);
	const [results, acBreakdown, batVRaw, batChgRaw, batDisRaw] = await Promise.all([
		Promise.all(fetchPromises),
		acBreakdownPromise,
		batVPromise,
		batChgPromise,
		batDisPromise
	]);
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
	let totalLoadKwh = 0, totalDayLoadKwh = 0, totalNightLoadKwh = 0;
	const rows = [];
	const computeFeedTotals = (feed) => {
		if (feed.id === 'others') return null;
		const totalWh = Object.values(sums[feed.id]?.h24 || {}).reduce((a,b)=>a+b, 0);
		const dayWh = Object.values(sums[feed.id]?.day || {}).reduce((a,b)=>a+b, 0);
		const nightWh = Object.values(sums[feed.id]?.night || {}).reduce((a,b)=>a+b, 0);
		return { totalKwh: totalWh/1000, dayKwh: dayWh/1000, nightKwh: nightWh/1000, totalWh, dayWh, nightWh };
	};
	for (const f of EXPORT_FEEDS) {
		const totals = computeFeedTotals(f);
		if (totals) {
			rows.push({ name: f.name, isSolar: f.isSolar, isBreaker: f.isBreaker, ...totals });
		}
	}
		// ── Battery Charge & Discharge computations for Report ──
	let batChgTotalWh = 0, batChgDayWh = 0, batChgNightWh = 0;
	let batDisTotalWh = 0, batDisDayWh = 0, batDisNightWh = 0;
	const batChgDayMap = {}, batChgNightMap = {};
	const batDisDayMap = {}, batDisNightMap = {};
	const allBatTimestamps = new Set([
		...Object.keys(batChgRaw || {}),
		...Object.keys(batDisRaw || {})
	]);
	for (const tsStr of allBatTimestamps) {
		const ts = parseInt(tsStr);
		const v = (batVRaw && batVRaw[tsStr] > 35) ? batVRaw[tsStr] : 52.0;
		const cA = (batChgRaw && batChgRaw[tsStr]) ? batChgRaw[tsStr] : 0;
		const dA = (batDisRaw && batDisRaw[tsStr]) ? batDisRaw[tsStr] : 0;
		const chgW = Math.max(0, v * cA);
		const disW = Math.max(0, v * dA);
		const p = getKarachiDate(ts);
		const dKey = `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`;
		const isDayHour = (p.hour >= 8 && p.hour < 17);

		batChgTotalWh += chgW;
		batDisTotalWh += disW;
		if (isDayHour) {
			batChgDayWh += chgW;
			batDisDayWh += disW;
			batChgDayMap[dKey] = (batChgDayMap[dKey] || 0) + chgW;
			batDisDayMap[dKey] = (batDisDayMap[dKey] || 0) + disW;
		} else {
			batChgNightWh += chgW;
			batDisNightWh += disW;
			batChgNightMap[dKey] = (batChgNightMap[dKey] || 0) + chgW;
			batDisNightMap[dKey] = (batDisNightMap[dKey] || 0) + disW;
		}
	}

	const solarData = sums[solarF.id]?.h24 || {};
	const breakerData = sums[breakerF.id]?.h24 || {};
	const applianceData = {};
	loadFeeds.forEach(f => { applianceData[f.id] = sums[f.id]?.h24 || {}; });
	const allDays = new Set();
	Object.keys(solarData).forEach(d => allDays.add(d));
	Object.keys(breakerData).forEach(d => allDays.add(d));
	Object.values(applianceData).forEach(obj => Object.keys(obj).forEach(d => allDays.add(d)));
	const othersDaySum = {};
	const othersNightSum = {};
	for (const day of allDays) {
		const solarDayVal = (sums[solarF.id]?.day?.[day] || 0);
		const breakerDayVal = (sums[breakerF.id]?.day?.[day] || 0);
		let applianceDayVal = 0;
		for (const f of loadFeeds) { applianceDayVal += (sums[f.id]?.day?.[day] || 0); }
		const solarNightVal = (sums[solarF.id]?.night?.[day] || 0);
		const breakerNightVal = (sums[breakerF.id]?.night?.[day] || 0);
		let applianceNightVal = 0;
		for (const f of loadFeeds) { applianceNightVal += (sums[f.id]?.night?.[day] || 0); }

		const batDisDay = batDisDayMap[day] || 0;
		const batChgDay = batChgDayMap[day] || 0;
		const batDisNight = batDisNightMap[day] || 0;
		const batChgNight = batChgNightMap[day] || 0;

		// Real power available to house: Solar + Grid + Bat Discharge - Bat Charge
		const netDaySupply = Math.max(0, solarDayVal + breakerDayVal + batDisDay - batChgDay);
		const netNightSupply = Math.max(0, solarNightVal + breakerNightVal + batDisNight - batChgNight);

		const othersDayVal = Math.max(0, netDaySupply - applianceDayVal);
		const othersNightVal = Math.max(0, netNightSupply - applianceNightVal);

		if (othersDayVal > 0) othersDaySum[day] = othersDayVal;
		if (othersNightVal > 0) othersNightSum[day] = othersNightVal;
	}
	const totalOthersDayWh = Object.values(othersDaySum).reduce((a,b)=>a+b, 0);
	const totalOthersNightWh = Object.values(othersNightSum).reduce((a,b)=>a+b, 0);
	const totalOthersWh = totalOthersDayWh + totalOthersNightWh;
	rows.push({
		name: 'Others (Fans/Lights)', isSolar: false, isBreaker: false,
		totalKwh: totalOthersWh/1000, dayKwh: totalOthersDayWh/1000, nightKwh: totalOthersNightWh/1000,
		totalWh: totalOthersWh, dayWh: totalOthersDayWh, nightWh: totalOthersNightWh
	});

	rows.push({
		name: '⚡🔋 Bat Charge', isSolar: false, isBreaker: false, isBatteryMetric: true,
		totalKwh: batChgTotalWh/1000, dayKwh: batChgDayWh/1000, nightKwh: batChgNightWh/1000,
		totalWh: batChgTotalWh, dayWh: batChgDayWh, nightWh: batChgNightWh
	});
	rows.push({
		name: '⚡🔋 Bat Discharge', isSolar: false, isBreaker: false, isBatteryMetric: true,
		totalKwh: batDisTotalWh/1000, dayKwh: batDisDayWh/1000, nightKwh: batDisNightWh/1000,
		totalWh: batDisTotalWh, dayWh: batDisDayWh, nightWh: batDisNightWh
	});
	let numDays = allDays.size || 1;
	if (isDay) numDays = 1;
	const totalNightHours = countNightHours(startMs, Math.min(endMs, Date.now()));
	totalLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker && !r.isBatteryMetric).reduce((sum, r) => sum + r.totalKwh, 0);
	totalDayLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker && !r.isBatteryMetric).reduce((sum, r) => sum + r.dayKwh, 0);
	totalNightLoadKwh = rows.filter(r => !r.isSolar && !r.isBreaker && !r.isBatteryMetric).reduce((sum, r) => sum + r.nightKwh, 0);
	// Text report
	let txt = `📄 Energy Usage Report: ${label}\n`;
	txt += `Generated: ${new Date().toLocaleString()}\n`;
	txt += `⚡ Total Electricity Outages: ${acBreakdown.formattedDuration} (${acBreakdown.totalHours} hrs across ${acBreakdown.outageCount} times)\n`;
	const batEffTxt = batChgTotalWh > 0 ? ((batDisTotalWh / batChgTotalWh) * 100).toFixed(0) + '%' : '100%';
	txt += `🔋 Battery Cycled: Charged ${(batChgTotalWh/1000).toFixed(2)} kWh | Discharged ${(batDisTotalWh/1000).toFixed(2)} kWh (Efficiency: ${batEffTxt})\n`;
	// -- Outage event times (Day view only) --
	if (isDay && acBreakdown.dailyBreakdown && acBreakdown.dailyBreakdown.length > 0) {
		acBreakdown.dailyBreakdown.forEach(d => {
			if (d.events && d.events.length > 0) {
				const timesStr = d.events.map(ev => {
					const s = formatPktTime(ev.start, 'time');
					const e = ev.ongoing ? 'Now' : formatPktTime(ev.end, 'time');
					return `${s}\u2013${e} (${ev.durMin}m)`;
				}).join(', ');
				txt += `   Times: ${timesStr}\n`;
			}
		});
	}
	txt += `Time Period Definitions:\n`;
	txt += `  • Day   = 8:00 AM  → 5:00 PM  (9 hours)\n`;
	txt += `  • Night = 5:00 PM  → 8:00 AM  (15 hours)\n`;
	txt += `  • Solar hours = 8:00 AM → 5:00 PM\n`;
	const colWidths = { name:22, total:12, day:10, night:10, avgNightKwh:15, avgNight:21, avgDay:10, dayPct:8, nightPct:8, dayShare:10, nightShare:10, totalPct:10 };
	const headerParts = [
		'Appliance'.padEnd(colWidths.name), 'Total (kWh)'.padStart(colWidths.total),
		'Day (kWh)'.padStart(colWidths.day), 'Night (kWh)'.padStart(colWidths.night),
		'Avg Night (kWh)'.padStart(colWidths.avgNightKwh),
		'Avg Night Hourly (W)'.padStart(colWidths.avgNight), 'Avg/Day'.padStart(colWidths.avgDay),
		'Day %'.padStart(colWidths.dayPct), 'Night %'.padStart(colWidths.nightPct),
		'Day Share'.padStart(colWidths.dayShare), 'Night Share'.padStart(colWidths.nightShare),
		'% of Total'.padStart(colWidths.totalPct)
	];
	const header = headerParts.join(' ');
	txt += header + '\n';
	txt += '-'.repeat(header.length) + '\n';
	for (const row of rows) {
		const isSolar = row.isSolar; const isBreaker = row.isBreaker;
		const total = row.totalKwh;
		const day = isSolar ? 0 : row.dayKwh;
		const night = isSolar ? 0 : row.nightKwh;
		const avgNightW = isSolar ? 0 : (totalNightHours > 0 ? (row.nightWh / totalNightHours) : 0);
		const avgDay = total / numDays;
		const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
		const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
		const isSourceOrMetric = isBreaker || isSolar || row.isBatteryMetric;
		let dayShare, nightShare;
		if (isSourceOrMetric) { dayShare = '-'; nightShare = '-'; }
		else {
			dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
			nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);
		}
		const totalPct = (totalLoadKwh === 0 || isSourceOrMetric) ? '-' : (total / totalLoadKwh * 100).toFixed(1) + '%';
		const shortName = row.name.length > colWidths.name ? row.name.substring(0, colWidths.name-1) + '…' : row.name;
		const parts = [
			shortName.padEnd(colWidths.name),
			total.toFixed(2).padStart(colWidths.total),
			isSolar ? '-'.padStart(colWidths.day) : day.toFixed(2).padStart(colWidths.day),
			isSolar ? '-'.padStart(colWidths.night) : night.toFixed(2).padStart(colWidths.night),
			isSolar ? '-'.padStart(colWidths.avgNightKwh) : (night / numDays).toFixed(2).padStart(colWidths.avgNightKwh),
			isSolar ? '-'.padStart(colWidths.avgNight) : (Math.round(avgNightW) + ' W').padStart(colWidths.avgNight),
			avgDay.toFixed(2).padStart(colWidths.avgDay),
			isSolar ? '-'.padStart(colWidths.dayPct) : dayPct.toFixed(1).padStart(colWidths.dayPct) + '%',
			isSolar ? '-'.padStart(colWidths.nightPct) : nightPct.toFixed(1).padStart(colWidths.nightPct) + '%',
			(isSourceOrMetric) ? '-'.padStart(colWidths.dayShare) : (totalDayLoadKwh === 0 ? '-'.padStart(colWidths.dayShare) : dayShare.toFixed(1).padStart(colWidths.dayShare) + '%'),
			(isSourceOrMetric) ? '-'.padStart(colWidths.nightShare) : (totalNightLoadKwh === 0 ? '-'.padStart(colWidths.nightShare) : nightShare.toFixed(1).padStart(colWidths.nightShare) + '%'),
			(isSourceOrMetric || totalLoadKwh === 0) ? '-'.padStart(colWidths.totalPct) : totalPct.padStart(colWidths.totalPct)
		];
		txt += parts.join(' ') + '\n';
	}
	// HTML report
	let html = `<div class="report-wrapper" style="background:#fff;color:#18181b;border:1px solid #d4d4d8;border-radius:10px;padding:12px;margin-top:10px;font-family:system-ui,sans-serif;box-sizing:border-box;width:100%;max-width:100%;">`;
	html += `<h4 style="margin:0 0 8px 0;font-size:14px;border-bottom:1px solid #d4d4d8;padding-bottom:4px;color:#18181b;">Consumption Breakdown</h4>`;
	let outageTimesHtml = '';
	if (isDay && acBreakdown.dailyBreakdown && acBreakdown.dailyBreakdown.length > 0) {
		const allEvents = [];
		acBreakdown.dailyBreakdown.forEach(d => {
			if (d.events && d.events.length > 0) d.events.forEach(ev => allEvents.push(ev));
		});
		if (allEvents.length > 0) {
			const chips = allEvents.map(ev => {
				const s = formatPktTime(ev.start, 'time');
				const e = ev.ongoing ? 'Now' : formatPktTime(ev.end, 'time');
				return `<span style="display:inline-block; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); border-radius:5px; padding:1px 6px; font-size:10.5px; font-weight:600; color:#b91c1c; margin:1px 6px 1px 0;">${s}&ndash;${e} <span style="color:#ef4444; font-weight:800;">(${ev.durMin}m)</span></span>`;
			}).join('');
			outageTimesHtml = `<div style="white-space:normal; font-weight:600; color:#71717a; margin-top:1px; font-size:10.5px; line-height:1.25;"><b style="color:#ef4444;">⚡ Times:</b> ${chips}</div>`;
		}
	}
	html += `<div style="white-space:normal; font-size:11px; color:#ef4444; margin-bottom:8px; padding:3px 10px 4px; line-height:1.25; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:6px; box-sizing:border-box; width:100%;"><div style="display:flex; justify-content:space-between; align-items:center; font-weight:700;"><span>⚡ Electricity Breakdown / Outages:</span><span style="font-size:12px; font-weight:800; white-space:nowrap; margin-left:10px;">${acBreakdown.formattedDuration} (${acBreakdown.totalHours} hrs &bull; ${acBreakdown.outageCount} ${acBreakdown.outageCount === 1 ? 'time' : 'times'})</span></div>${outageTimesHtml}</div>`;
	const batEffPct = batChgTotalWh > 0 ? ((batDisTotalWh / batChgTotalWh) * 100).toFixed(0) : 100;
	html += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:8px; padding:6px 10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.35); border-radius:6px;"><span style="color:#10b981; font-weight:800;">🔋 Battery Cycled:</span><span style="color:var(--text-main); font-weight:700;">⚡ Charged: <b style="color:#10b981;">${(batChgTotalWh/1000).toFixed(2)} kWh</b> &bull; ⚡ Discharged: <b style="color:#f97316;">${(batDisTotalWh/1000).toFixed(2)} kWh</b> &bull; Eff: <b style="color:#38bdf8;">${batEffPct}%</b></span></div>`;
	html += `<div style="font-size:11px;color:#71717a;margin-bottom:12px;padding:8px 12px;background:#f4f4f5;border-radius:6px;border-left:3px solid #f59e0b;box-sizing:border-box;width:100%;">`;
	html += `<span style="font-weight:700;">⏰ Time Periods:</span> `;
	html += `<span style="color:#f59e0b;">Day</span> = 8:00 AM → 5:00 PM (9 hrs) &nbsp;|&nbsp; `;
	html += `<span style="color:#c084fc;">Night</span> = 5:00 PM → 8:00 AM (15 hrs)`;
	html += `</div>`;
	html += `<div class="table-scroll" style="overflow-x:auto;max-width:100%;width:100%;box-sizing:border-box;"><table style="width:100%;border-collapse:collapse;font-size:11px;font-family:monospace;min-width:900px;">`;
	html += `<tr style="background:#f4f4f5;border-bottom:2px solid #d4d4d8;">`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:left;">Appliance</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Total (kWh)</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day (kWh)</th>`;
	html += `<th style="border:1px solid #c4b5fd;padding:6px;text-align:right;background:#e2d9f3;color:#581c87;font-weight:800;">Night (kWh)</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg Night (kWh)</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg Night Hourly (W)</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Avg/Day</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day %</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night %</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Day Share</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">Night Share</th>`;
	html += `<th style="border:1px solid #d4d4d8;padding:6px;text-align:right;">% of Total</th>`;
	html += `</tr>`;
	for (const row of rows) {
		const isSolar = row.isSolar; const isBreaker = row.isBreaker;
		const total = row.totalKwh;
		const day = isSolar ? 0 : row.dayKwh;
		const night = isSolar ? 0 : row.nightKwh;
		const avgNightW = isSolar ? 0 : (totalNightHours > 0 ? (row.nightWh / totalNightHours) : 0);
		const avgDay = total / numDays;
		const dayPct = (isSolar || total === 0) ? 0 : (day / total * 100);
		const nightPct = (isSolar || total === 0) ? 0 : (night / total * 100);
		const isSourceOrMetric = isBreaker || isSolar || row.isBatteryMetric;
		let dayShare, nightShare;
		if (isSourceOrMetric) { dayShare = '-'; nightShare = '-'; }
		else {
			dayShare = (totalDayLoadKwh === 0) ? 0 : (day / totalDayLoadKwh * 100);
			nightShare = (totalNightLoadKwh === 0) ? 0 : (night / totalNightLoadKwh * 100);
		}
		const totalPct = (totalLoadKwh === 0 || isSourceOrMetric) ? '-' : (total / totalLoadKwh * 100).toFixed(1) + '%';
		const color = isSolar ? '#f59e0b' : (isBreaker ? '#ef4444' : '#18181b');
		html += `<tr>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;font-weight:bold;color:${color};">${row.name}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${color};">${total.toFixed(2)}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#f59e0b'};">${isSolar?'-':day.toFixed(2)}</td>`;
		html += `<td style="border:1px solid #c4b5fd;padding:6px;text-align:right;background:#ede5f8;color:${isSolar?'#71717a':'#6b21a8'};font-weight:800;">${isSolar?'-':night.toFixed(2)}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':(night/numDays).toFixed(2)}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':Math.round(avgNightW)+' W'}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${avgDay.toFixed(2)}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#f59e0b'};">${isSolar?'-':dayPct.toFixed(1)+'%'}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSolar?'#71717a':'#c084fc'};">${isSolar?'-':nightPct.toFixed(1)+'%'}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSourceOrMetric?'#71717a':'#f59e0b'};">${(isSourceOrMetric)?'-':(totalDayLoadKwh===0?'-':dayShare.toFixed(1)+'%')}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSourceOrMetric?'#71717a':'#c084fc'};">${(isSourceOrMetric)?'-':(totalNightLoadKwh===0?'-':nightShare.toFixed(1)+'%')}</td>`;
		html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:${isSourceOrMetric?'#71717a':'inherit'};">${(isSourceOrMetric)?'-':totalPct}</td>`;
		html += `</tr>`;
	}
	html += `<tr style="background:#f4f4f5;font-weight:bold;border-top:2px solid #d4d4d8;">`;
	html += `<td style="border:1px solid #d4d4d8;padding:6px;">TOTAL LOAD</td>`;
	html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;">${totalLoadKwh.toFixed(2)}</td>`;
	html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#f59e0b;">${totalDayLoadKwh.toFixed(2)}</td>`;
	html += `<td style="border:1px solid #c4b5fd;padding:6px;text-align:right;background:#e2d4f7;color:#581c87;font-weight:900;">${totalNightLoadKwh.toFixed(2)}</td>`;
	html += `<td style="border:1px solid #d4d4d8;padding:6px;text-align:right;color:#c084fc;">${(totalNightLoadKwh/numDays).toFixed(2)}</td>`;
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

	// Net Grid Load (Total Load minus battery discharge)
	const netGridTotal = Math.max(0, totalLoadKwh - (batDisTotalWh / 1000));
	const netGridDay = Math.max(0, totalDayLoadKwh - (batDisDayWh / 1000));
	const netGridNight = Math.max(0, totalNightLoadKwh - (batDisNightWh / 1000));

	html += `<tr style="background:#fef2f2;font-weight:bold;border-top:1px dashed #ef4444;">`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;color:#dc2626;">NET LOAD (Grid / -Bat)</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#dc2626;">${netGridTotal.toFixed(2)}</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#ea580c;">${netGridDay.toFixed(2)}</td>`;
	html += `<td style="border:1px solid #c4b5fd;padding:6px;text-align:right;background:#ede9fe;color:#dc2626;font-weight:900;">${netGridNight.toFixed(2)}</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#c084fc;">${(netGridNight/numDays).toFixed(2)}</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;">-</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;">${(netGridTotal/numDays).toFixed(2)}</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#71717a;">-</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#71717a;">-</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#71717a;">-</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#71717a;">-</td>`;
	html += `<td style="border:1px solid #fca5a5;padding:6px;text-align:right;color:#71717a;">-</td>`;
	html += `</tr>`;
	html += `</table></div></div>`;
	return { text: txt, html: html };
};
window.downloadDayGraphReport = function() {
	const reportDiv = document.getElementById('graph-report-view');
	if (!reportDiv) return;
	const pre = reportDiv.querySelector('pre');
	if (!pre) { alert('No report text available.'); return; }
	const text = pre.textContent;
	const blob = new Blob([text], { type: 'text/plain' });
	const a = document.createElement('a');
	const nav = typeof _gNavInfo === 'function' ? _gNavInfo() : null;
	
	// --- Updated Filename Logic ---
	let fileLabel = '';
	if (nav) {
		if (graphTab === 'day') {
			fileLabel = nav.sub || nav.label; // Always use full date like '12 September 2026'
		} else {
			fileLabel = nav.label;
		}
	} else {
		fileLabel = new Date().toISOString().split('T')[0];
	}
	const cleanTxtLabel = fileLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
	// ------------------------------
	
	a.download = `Graph_Report_${cleanTxtLabel}.txt`;
	a.href = URL.createObjectURL(blob);
	a.click();
	URL.revokeObjectURL(a.href);
};
window.downloadDayGraphReportPng = function() {
	const reportDiv = document.getElementById('graph-report-view');
	if (!reportDiv) return;
	const wrapper = reportDiv.querySelector('.report-wrapper');
	if (!wrapper) { alert('No report content to capture.'); return; }
	if (typeof html2canvas === 'undefined') { alert('html2canvas library not loaded.'); return; }
	const btn = document.getElementById('btn-graph-report-png');
	if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
	// 1. Measure the natural table width needed so no elements blowout to screen width
	const origTable = wrapper.querySelector('table');
	const tableWidth = origTable ? Math.max(origTable.scrollWidth, 900) : 900;
	const cardWidth = tableWidth + 24; // padding allowance
	const containerWidth = cardWidth + 40;
	// 2. Clone the report card
	const clone = wrapper.cloneNode(true);
	clone.style.width = cardWidth + 'px';
	clone.style.maxWidth = cardWidth + 'px';
	clone.style.boxSizing = 'border-box';
	clone.style.margin = '0 auto';
	const tableScroll = clone.querySelector('.table-scroll');
	if (tableScroll) {
		tableScroll.style.overflow = 'visible';
		tableScroll.style.width = '100%';
		tableScroll.style.maxWidth = 'none';
	}
	const table = clone.querySelector('table');
	if (table) {
		table.style.width = '100%';
		table.style.minWidth = '100%';
		table.style.whiteSpace = 'nowrap';
		table.style.borderCollapse = 'collapse';
		table.querySelectorAll('th, td').forEach(cell => {
			cell.style.border = '1px solid #999';
			cell.style.padding = '6px 10px';
			cell.style.textAlign = 'right';
			if (!cell.style.backgroundColor) {
				cell.style.backgroundColor = '#ffffff';
			}
			if (!cell.style.color) {
				cell.style.color = '#18181b';
			}
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
	// 3. Wrapper container for html2canvas
	const captureWrapper = document.createElement('div');
	captureWrapper.style.cssText = `
	position: fixed;
	top: 0;
	left: 0;
	width: ${containerWidth}px;
	min-width: ${containerWidth}px;
	max-width: ${containerWidth}px;
	background: #ffffff;
	padding: 20px;
	z-index: -9999;
	opacity: 1;
	font-family: system-ui, -apple-system, sans-serif;
	font-size: 12px;
	color: #18181b;
	box-sizing: border-box;
	`;
	const nav = typeof _gNavInfo === 'function' ? _gNavInfo() : null;
	const reportPeriod = (nav && nav.label) ? nav.label : new Date().toLocaleDateString('en-PK', { year:'numeric', month:'long', day:'numeric' });
	const title = document.createElement('div');
	title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:12px;border-bottom:2px solid #ddd;padding-bottom:8px;background:#fff;';
	title.textContent = '📄 Energy Usage Report – ' + reportPeriod;
	captureWrapper.appendChild(title);
	captureWrapper.appendChild(clone);
	document.body.appendChild(captureWrapper);
	try {
		const _pCanvas = document.createElement('canvas');
		const _pCtx = _pCanvas.getContext('2d');
		captureWrapper.querySelectorAll('*').forEach(el => {
			['color', 'backgroundColor', 'borderColor'].forEach(p => {
				const val = el.style[p] || (window.getComputedStyle ? window.getComputedStyle(el)[p] : '');
				if (val && (val.includes('oklab') || val.includes('oklch') || val.includes('color('))) {
					try { _pCtx.fillStyle = val; el.style[p] = _pCtx.fillStyle; } catch(e) {}
				}
			});
		});
	} catch(e) {}
	html2canvas(captureWrapper, {
		backgroundColor: '#ffffff',
		scale: 2.5,
		useCORS: true,
		logging: false,
		width: containerWidth,
		height: captureWrapper.scrollHeight,
		windowWidth: containerWidth
	}).then(canvas => {
		const a = document.createElement('a');
		
		// --- Updated Filename Logic ---
		let fileLabel = '';
		if (nav) {
			if (graphTab === 'day') {
				fileLabel = nav.sub || nav.label; // Always use full date like '12 September 2026'
			} else {
				fileLabel = nav.label;
			}
		} else {
			fileLabel = new Date().toISOString().split('T')[0];
		}
		const cleanFileLabel = fileLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
		// ------------------------------
		
		a.download = `Graph_Report_${cleanFileLabel}.png`;
		a.href = canvas.toDataURL('image/png');
		a.click();
		document.body.removeChild(captureWrapper);
		if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
	}).catch(err => {
		console.error('PNG capture error:', err);
		if (captureWrapper.parentNode) document.body.removeChild(captureWrapper);
		if (btn) { btn.disabled = false; btn.textContent = 'Save PNG'; }
		alert('Failed to capture PNG: ' + err.message);
	});
};

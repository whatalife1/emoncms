async function _calcHourly(y, mo, d) {
  const doy   = _doy(y, mo, d);
  const peakW = solarCfg.panelWatts * solarCfg.panelCount;
  const weather = await fetchLahoreWeather();
  const cloud   = _cloudFactor();
  const out = [];
  let weatherAvailable = false; 
  for (let h = 5; h <= 18; h++) {
    const pos  = _solarPos(y, mo, d, h + 0.5);
    let watt = 0, cloudHour = solarCfg.cloudPct, rainHour = 0;
    const wf = getWeatherForHour(weather, y, mo, d, h);
    if (wf && wf.ghi != null) {
      weatherAvailable = true; 
      const ghi = wf.ghi;
      cloudHour = wf.cloud; rainHour = wf.rain;
      let dni = 0, dhi = 0;
      if (pos.elev > 3 && ghi > 5) {
        const elevR = _R(pos.elev);
        const sinElev = Math.sin(elevR);
        const doy2 = _doy(y, mo, d);
        const Iext = 1367 * (1 + 0.033 * Math.cos(_R(360 * doy2 / 365)));
        const kt = Math.min(1.0, ghi / (Iext * sinElev));
        const df = kt <= 0.22 ? 1.0 - 0.09 * kt
                 : kt <= 0.80 ? 0.9511 - 0.1604*kt + 4.388*kt*kt - 16.638*kt*kt*kt + 12.336*kt*kt*kt*kt
                 : 0.165;
        dhi = df * ghi;
        dni = sinElev > 0.01 ? Math.max(0, (ghi - dhi) / sinElev) : 0;
      } else {
        dhi = ghi * 0.15;
      }
      const poa = _poa(pos.elev, pos.az, solarCfg.tiltDeg, solarCfg.azimuthDeg, { ghi, dni, dhi });
      watt = Math.max(0, (poa / 1000) * peakW * solarCfg.sysEff);
    } else {
      const irr = _clearSky(pos.elev, doy);
      const poa = _poa(pos.elev, pos.az, solarCfg.tiltDeg, solarCfg.azimuthDeg, irr);
      watt = Math.max(0, (poa / 1000) * peakW * solarCfg.sysEff * cloud);
    }
    out.push({ h, elev: pos.elev, az: pos.az, watt, cloud: cloudHour, rain: rainHour });
  }
  return { hourly: out, weatherAvailable }; 
}

async function _calcDayKwh(y, mo, d) {
  const { hourly } = await _calcHourly(y, mo, d); 
  return hourly.reduce((s, x) => s + x.watt, 0) / 1000;
}

async function _calcMonth(y, mo) {
  const days = new Date(y, mo, 0).getDate();
  let total = 0;
  const daily = [];
  for (let d = 1; d <= days; d++) {
    const kwh = await _calcDayKwh(y, mo, d);
    daily.push({ d, kwh }); total += kwh;
  }
  return { total, daily };
}

function _calcBattery(hourly, battKwh) {
  if (!battKwh || battKwh <= 0) return null;
  const avgLoadW = 500;
  let soc = battKwh * 0.5 * 1000;
  const maxWh = battKwh * 1000;
  const records = [];
  let fullTime = null, emptyTime = null;
  for (const h of hourly) {
    const net = h.watt - avgLoadW;
    soc = Math.max(0, Math.min(maxWh, soc + net));
    const pct = (soc / maxWh) * 100;
    if (!fullTime  && pct >= 98) fullTime  = h.h;
    if (!emptyTime && pct <= 2)  emptyTime = h.h;
    records.push({ h: h.h, pct });
  }
  return { records, fullTime, emptyTime, maxWh };
}

function _barColor(watt, maxWatt) {
  if (watt <= 0) return { bg: 'transparent', glow: 'transparent' };
  const ratio = watt / maxWatt;
  if (ratio < 0.33) return { bg: 'linear-gradient(90deg,#854d0e,#ca8a04)', glow: '#ca8a04' };
  if (ratio < 0.66) return { bg: 'linear-gradient(90deg,#92400e,#f59e0b)', glow: '#f59e0b' };
  if (ratio < 0.85) return { bg: 'linear-gradient(90deg,#b45309,#f97316)', glow: '#f97316' };
  return { bg: 'linear-gradient(90deg,#c2410c,#ef4444)', glow: '#ef4444' };
}

function _renderSunArc(y, mo, d, container) {
  const { rise, set } = _sunriseSunset(y, mo, d);
  const now     = new Date();
  const isToday = (y === now.getFullYear() && mo === now.getMonth()+1 && d === now.getDate());
  const currentH = isToday ? now.getHours() + now.getMinutes()/60 : null;
  const W  = 340, H = 90, PAD = 26;
  const arc_w = W - PAD*2;
  const cx = W/2, cy = H - 8, rx = arc_w/2, ry = H - 18;
  const x1 = PAD, x2 = W - PAD;

  function timeToX(h) { return PAD + ((h - rise) / (set - rise)) * arc_w; }

  let ticks = '';
  for (let h = Math.ceil(rise); h <= Math.floor(set); h += 2) {
    const x = timeToX(h);
    if (x < PAD + 10 || x > W - PAD - 10) continue;
    ticks += `<line x1="${x.toFixed(1)}" y1="${cy}" x2="${x.toFixed(1)}" y2="${cy+5}" stroke="#3f3f46" stroke-width="1"/>
              <text x="${x.toFixed(1)}" y="${cy+14}" text-anchor="middle" fill="#52525b" font-size="8">${_pad2(h)}</text>`;
  }

  let sunEl = '';
  if (currentH !== null && currentH >= rise && currentH <= set) {
    const t     = (currentH - rise) / (set - rise);
    const angle = Math.PI - t * Math.PI;
    const sx    = (cx + rx * Math.cos(angle)).toFixed(1);
    const sy    = (cy - ry * Math.sin(angle)).toFixed(1);
    sunEl = `<circle cx="${sx}" cy="${sy}" r="12" fill="#facc15" opacity="0.15"/>
      <circle cx="${sx}" cy="${sy}" r="7" fill="#facc15" opacity="0.9"/>
      <circle cx="${sx}" cy="${sy}" r="3" fill="#fff"/>
      <line x1="${sx}" y1="${cy}" x2="${sx}" y2="${parseFloat(sy)+4}" stroke="#facc15" stroke-width="1" stroke-dasharray="2,3" opacity="0.4"/>`;
  }

  const riseLabel   = `<text x="${PAD}" y="${cy+26}" fill="#52525b" font-size="9" text-anchor="middle">↑${_fmtH(rise)}</text>`;
  const setLabel    = `<text x="${W-PAD}" y="${cy+26}" fill="#52525b" font-size="9" text-anchor="middle">↓${_fmtH(set)}</text>`;
  const dayLen      = set - rise;
  const dayHr       = Math.floor(dayLen);
  const dayMin      = Math.round((dayLen - dayHr) * 60);
  const centerLabel = `<text x="${W/2}" y="${cy+26}" fill="#3f3f46" font-size="8" text-anchor="middle">${dayHr}h ${dayMin}m daylight</text>`;

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#78350f" stop-opacity="0.5"/>
      <stop offset="40%" stop-color="#f59e0b" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#facc15" stop-opacity="1"/>
      <stop offset="80%" stop-color="#f59e0b" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#78350f" stop-opacity="0.5"/>
    </linearGradient></defs>
    <line x1="${PAD}" y1="${cy}" x2="${W-PAD}" y2="${cy}" stroke="#27272a" stroke-width="1"/>
    <path d="M ${x1} ${cy} A ${rx} ${ry} 0 0 1 ${x2} ${cy}" fill="none" stroke="url(#arcGrad)" stroke-width="2" stroke-linecap="round"/>
    ${ticks}${riseLabel}${setLabel}${centerLabel}${sunEl}
  </svg>`;
}

function _fmtH(h)  { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${_pad2(hh)}:${_pad2(mm)}`; }
function _pad2(n)  { return String(Math.floor(n)).padStart(2, '0'); }
function _fmtKwp() { return ((solarCfg.panelWatts * solarCfg.panelCount) / 1000).toFixed(2); }
const _MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

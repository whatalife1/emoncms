function loadSolarConfig() {
  try {
    const s = localStorage.getItem('solarCfg');
    if (s) solarCfg = {...SOLAR_DEFAULTS,...JSON.parse(s) };
  } catch(e) {}
  solarCfg.sysEff = SOLAR_DEFAULTS.sysEff;
  _syncSolarUI();
}

function _syncSolarUI() {
  const sum = document.getElementById('sol-cfg-summary');
  if (sum) sum.textContent = `${solarCfg.panelCount} × ${solarCfg.panelWatts}W · ${solarCfg.tiltDeg}° tilt · ${solarCfg.azimuthDeg}° az`;
  const fields = {
    'sp-count': solarCfg.panelCount, 'sp-watts': solarCfg.panelWatts,
    'sp-tilt': solarCfg.tiltDeg, 'sp-azimuth': solarCfg.azimuthDeg,
    'sp-battery': solarCfg.batteryKwh, 'sp-pkr': solarCfg.pkrPerUnit,
    'sp-syseff': Math.round(solarCfg.sysEff * 100)
  };
  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id); if (el) el.value = val;
  }
  const cloudEl = document.getElementById('sp-cloud');
  if (cloudEl) { cloudEl.value = solarCfg.cloudPct; _updateCloudLabel(solarCfg.cloudPct); }
}

function _updateCloudLabel(val) {
  const lbl = document.getElementById('sp-cloud-val');
  if (!lbl) return;
  const pct = parseInt(val);
  const desc = pct === 0? '☀ Clear' : pct < 25? '🌤 Mostly Clear' :
               pct < 50? '⛅ Partly Cloudy' : pct < 75? '🌥 Mostly Cloudy' : '☁ Overcast';
  lbl.textContent = `${desc} (${pct}%)`;
}

async function applySolarConfig() {
  solarCfg.panelCount = parseInt(document.getElementById('sp-count').value) || SOLAR_DEFAULTS.panelCount;
  solarCfg.panelWatts = parseInt(document.getElementById('sp-watts').value) || SOLAR_DEFAULTS.panelWatts;
  solarCfg.tiltDeg = parseFloat(document.getElementById('sp-tilt').value);
  solarCfg.azimuthDeg = parseFloat(document.getElementById('sp-azimuth').value);
  solarCfg.batteryKwh = parseFloat(document.getElementById('sp-battery').value) || 0;
  solarCfg.pkrPerUnit = parseFloat(document.getElementById('sp-pkr').value) || SOLAR_DEFAULTS.pkrPerUnit;
  solarCfg.cloudPct = parseInt(document.getElementById('sp-cloud').value) || 0;
  const effPct = parseFloat(document.getElementById('sp-syseff').value);
  solarCfg.sysEff = (!isNaN(effPct) && effPct > 0)? effPct / 100 : SOLAR_DEFAULTS.sysEff;
  if (isNaN(solarCfg.tiltDeg)) solarCfg.tiltDeg = SOLAR_DEFAULTS.tiltDeg;
  if (isNaN(solarCfg.azimuthDeg)) solarCfg.azimuthDeg = SOLAR_DEFAULTS.azimuthDeg;
  localStorage.setItem('solarCfg', JSON.stringify(solarCfg));
  _syncSolarUI();
  if (window.Android && window.Android.savePkrRate) {
    window.Android.savePkrRate(solarCfg.pkrPerUnit);
  }

  localStorage.removeItem('lhr_weather_v2');
  await fetchLahoreWeather(true);

  const activeTab = document.querySelector('.sol-tab.active')?.dataset.tab || 'today';
  if (activeTab === 'today') solRenderToday();
  else if (activeTab === 'day') { const dt = document.getElementById('sp-day-date').value; if (dt) solRenderDay(dt); }
  else if (activeTab === 'month') { const m = parseInt(document.getElementById('sp-month-m').value); const y = parseInt(document.getElementById('sp-month-y').value); solRenderMonth(y, m); }
}

async function fetchLahoreWeather(force = false) {
  const CACHE_KEY = 'lhr_weather_v2';
  if (!force) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const obj = JSON.parse(cached);
      const now = getPktNow();
      if (now.getTime() - obj.ts < 10 * 60 * 1000) return obj.data;
    }
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SOL_LAT}&longitude=${SOL_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&hourly=cloudcover,shortwave_radiation,precipitation_probability&daily=sunrise,sunset&timezone=auto&past_days=7&forecast_days=7`;
  try {
    const text = await nativeFetch(url);
    if (text.startsWith('ERROR')) return null;
    const data = JSON.parse(text);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));

    if (window.addDebugLog) {
      window.addDebugLog(`<b>Weather API:</b> OK (${data.hourly.time.length} hrs)`);
    }
    return data;
  } catch(e) {
    console.warn('Open-Meteo error', e);
    return null;
  }
}

function getWeatherForHour(weather, y, mo, d, hour) {
  if (!weather?.hourly?.time) return null;
  const target = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00`;
  const idx = weather.hourly.time.indexOf(target);
  if (idx === -1) return null;
  return { cloud: weather.hourly.cloudcover[idx], ghi: weather.hourly.shortwave_radiation[idx], rain: weather.hourly.precipitation_probability[idx] };
}

function _cloudFactor() { return 1.0 - (solarCfg.cloudPct / 100) * 0.90; }

function _R(d) { return d * Math.PI / 180; }
function _D(r) { return r * 180 / Math.PI; }
function _doy(y, mo, d) { return Math.floor((new Date(y, mo-1, d) - new Date(y, 0, 1)) / 86400000) + 1; }

function _solarPos(y, mo, d, localHour) {
  const doy = _doy(y, mo, d);
  const B = (doy - 1) * 2 * Math.PI / 365;
  const EoT = 229.18 * (0.000075 + 0.001868*Math.cos(B) - 0.032077*Math.sin(B) - 0.014615*Math.cos(2*B) - 0.04089*Math.sin(2*B));
  const decl = 0.006918 - 0.399912*Math.cos(B) + 0.070257*Math.sin(B) - 0.006758*Math.cos(2*B) + 0.000907*Math.sin(2*B) - 0.002697*Math.cos(3*B) + 0.00148*Math.sin(3*B);
  const LSTM = SOL_TZ * 15;
  const TC = (4 * (SOL_LON - LSTM) + EoT) / 60;
  const solHr = localHour + TC;
  const ha = _R(15 * (solHr - 12));
  const latR = _R(SOL_LAT);
  const sinElev = Math.sin(latR)*Math.sin(decl) + Math.cos(latR)*Math.cos(decl)*Math.cos(ha);
  const elevR = Math.asin(Math.max(-1, Math.min(1, sinElev)));
  const elevDeg = _D(elevR);
  if (elevDeg <= 0) return { elev: elevDeg, az: 180 };
  const cosAz = (Math.sin(decl) - Math.sin(elevR)*Math.sin(latR)) / (Math.cos(elevR)*Math.cos(latR));
  const azBase = _D(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  const azDeg = ha >= 0? 360 - azBase : azBase;
  return { elev: elevDeg, az: (azDeg + 360) % 360 };
}

function _clearSky(elevDeg, doy) {
  if (elevDeg <= 0) return { ghi: 0, dni: 0, dhi: 0 };
  const elevR = _R(elevDeg);
  const Iext = 1367 * (1 + 0.033*Math.cos(_R(360*doy/365)));
  const AM = 1 / (Math.sin(elevR) + 0.50572 * Math.pow(elevDeg + 6.07995, -1.6364));
  const DNI = Iext * Math.pow(0.7, Math.pow(AM, 0.678));
  const DHI = 0.1 * Iext * Math.sin(elevR);
  const GHI = DNI * Math.sin(elevR) + DHI;
  return { ghi: Math.max(0, GHI), dni: Math.max(0, DNI), dhi: Math.max(0, DHI) };
}

function _poa(elevDeg, azDeg, tiltDeg, panelAzDeg, irr) {
  if (elevDeg <= 0 || irr.ghi === 0) return 0;
  const elevR = _R(elevDeg);
  const tiltR = _R(tiltDeg);
  const diffAzR = _R(azDeg - panelAzDeg);
  const cosAOI = Math.sin(elevR)*Math.cos(tiltR) + Math.cos(elevR)*Math.cos(diffAzR)*Math.sin(tiltR);
  const beam = cosAOI > 0? irr.dni * cosAOI : 0;
  const sky = irr.dhi * (1 + Math.cos(tiltR)) / 2;
  const ground = irr.ghi * 0.2 * (1 - Math.cos(tiltR)) / 2;
  return Math.max(0, beam + sky + ground);
}

function _sunriseSunset(y, mo, d) {
  let rise = 6, set = 18;
  for (let h = 4; h <= 8; h += 0.1) { if (_solarPos(y, mo, d, h).elev > 0) { rise = h; break; } }
  for (let h = 16; h <= 21; h += 0.1) { if (_solarPos(y, mo, d, h).elev <= 0) { set = h; break; } }
  return { rise, set };
}
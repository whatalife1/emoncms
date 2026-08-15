// js/02-flow.js
const LAYOUT = {
 weather: { x:5, y:10, w:708, h:49, color:'#0ea5e9', label:'Weather', ly1:25, fs:25, c1:'#ffffff',  },
 solar: { x:5, y:66, w:321, h:365, color:'#f59e0b', label:'Solar', ly1:42, fs:47, c1:'#ffff00', ly2:106, fs2:46, c2:'#2c8758', ly3:172, fs3:31, c3:'#b4b635', ly4:219, fs4:22, c4:'#21c442', ly5:289, fs5:24, c5:'#3de31c', ly6:330, fs6:22, c6:'#38bdf8', ly7:140, fs7:17, c7:'#a1a1aa', ly8:246, fs8:22, c8:'#21c442',  },
 grid: { x:330, y:64, w:245, h:365, color:'#ef4444', label:'Grid', ly1:35, fs:38, c1:'#ef4444', ly2:154, fs2:28, c2:'#35c0b7', ly3:291, fs3:21, c3:'#3de3e4', ly4:332, fs4:16, c4:'#38bdf8', ly5:186, fs5:19, c5:'#a1a1aa', ly6:79, fs6:20, c6:'#a1a1aa',  },
 water: { x:579, y:62, w:146, h:365, color:'#0ea5e9', label:'Water', ly1:33, fs:44, c1:'#0ea5e9', ly2:158, fs2:56, c2:'#25f447', ly3:251, fs3:25, c3:'#9ca3af', ly4:295, fs4:20, c4:'#0ce4e0', ly5:320, fs5:19, c5:'#38bdf8', ly6:342, fs6:18, c6:'#a1a1aa',  },
 haier: { x:7, y:436, w:238, h:199, color:'#38bdf8', label:'Haier 1T', ly1:22, fs:34, c1:'#38bdf8', ly2:75, fs2:63, c2:'#25f447', ly3:143, fs3:25, c3:'#00c8f0', ly4:175, fs4:25, c4:'#518e35', ly5:113, fs5:16, c5:'#a1a1aa',  },
 k15: { x:252, y:436, w:238, h:199, color:'#38bdf8', label:'Kenwood 1.5T', ly1:21, fs:33, c1:'#38bdf8', ly2:68, fs2:60, c2:'#25f447', ly3:142, fs3:25, c3:'#00c8f0', ly4:175, fs4:25, c4:'#518e35', ly5:114, fs5:16, c5:'#a1a1aa',  },
 k1: { x:497, y:435, w:231, h:200, color:'#38bdf8', label:'Kenwood 1T', ly1:27, fs:34, c1:'#38bdf8', ly2:75, fs2:57, c2:'#25f447', ly3:143, fs3:21, c3:'#00c8f0', ly4:175, fs4:22, c4:'#518e35', ly5:114, fs5:16, c5:'#a1a1aa',  },
 fridge: { x:8, y:678, w:227, h:241, color:'#c084fc', label:'Fridges', ly1:16, fs:36, c1:'#38bdf8', ly2:53, fs2:52, c2:'#25f447', ly3:103, fs3:18, c3:'#518e35', ly4:132, fs4:36, c4:'#38bdf8', ly5:171, fs5:52, c5:'#25f447', ly6:228, fs6:18, c6:'#518e35', ly7:86, fs7:14, c7:'#a1a1aa', ly8:205, fs8:17, c8:'#a1a1aa',  },
 pc: { x:445, y:684, w:133, h:240, color:'#10b9f8', label:'PC', ly1:25, fs:45, c1:'#38bdf8', ly2:83, fs2:46, c2:'#25f447', ly3:187, fs3:21, c3:'#00c8f0', ly4:225, fs4:20, c4:'#518e35', ly5:128, fs5:18, c5:'#a1a1aa',  },
 wm: { x:582, y:687, w:139, h:238, color:'#e879f9', label:'Washing|Machine', ly1:19, fs:30, c1:'#e879f9', ly2:92, fs2:43, c2:'#25f447', ly3:180, fs3:21, c3:'#00c8f0', ly4:219, fs4:21, c4:'#518e35',  },
 motor: { x:241, y:681, w:199, h:241, color:'#fbbf24', label:'Water Motor', ly1:24, fs:31, c1:'#fbbf24', ly2:83, fs2:57, c2:'#38bdf8', ly3:188, fs3:21, c3:'#518e35', ly4:221, fs4:22, c4:'#518e35', ly5:129, fs5:18, c5:'#a1a1aa',  },
 temp: { x:502, y:642, w:225, h:40, color:'#22c55e', label:'temp', ly1:20, fs:26, c1:'#25f447',  },
 temp2: { x:8, y:639, w:238, h:35, color:'#22c55e', label:'temp2', ly1:16, fs:27, c1:'#25f447',  },
};

function renderFlowDiagram(byName) {
  if (!byName) return;

  const titleEl = document.getElementById('flow-title');
  if (titleEl && typeof solarCfg !== 'undefined') {
    const pCount = solarCfg.panelCount || 9;
    const pWatts = solarCfg.panelWatts || 580;
    const totalKw = ((pCount * pWatts) / 1000).toFixed(1);
    titleEl.innerHTML = `⚡ Live power flow &bull; Inverter: 6kW &bull; Solar ${totalKw} kW (${pCount}×${pWatts})`;
  }

  const getV = (n) => byName.get(n)?.value ?? 0;
  
  const offlineList = window.applianceOfflineDetected || [];
  const getStatus = (name) => offlineList.find(a => a.name === name);

  const s = getV('Solar');
  const b = getV('Breaker');
  const l = getV('Tot Load');
  const v = getV('AC Volts');
  const sv = getV('Solar Volts') || getV('Solar V');
  const sa = getV('Solar Amps');
  const invT = getV('Inverter Temp');
  const tk = getV('Water Tank');
  const tp = getV('Temperature');
  const hm = getV('Humidity');
  const tp2 = getV('Temperature 2');
  const hm2 = getV('Humidity 2');
  const solar_t = getV('Solar Today');
  const grid_t = getV('Utility Today') || getV('Breaker Today') || getV('Grid Today');
  const motW = getV('Water Motor');

  const mU = window.monthlyUnits || {};
  const rate = window.pkrRate || 60;
  const L = LAYOUT;
  const cx = o => o.x + o.w / 2;

  const nF = x => Math.round(x).toLocaleString('en-US');
  const pF = x => Math.round(x) + ' w';
  
  const predF = x => {
    if (x >= 1000) return (x / 1000).toFixed(1) + ' kW';
    return Math.round(x) + ' W';
  };

  const kF = x => {
    const v = Math.round(x);
    if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
    return v.toLocaleString('en-US');
  };
  const tpProps = 'font-family="system-ui, -apple-system, sans-serif" dominant-baseline="central" text-anchor="middle" font-weight="700"';
  
  const maxH = Object.values(LAYOUT).reduce((max, d) => Math.max(max, d.y + d.h), 0) + 15;
  
  let svg = `<svg viewBox="0 0 730 ${maxH}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%" preserveAspectRatio="xMidYMid meet">`;

  // 0. WEATHER
  let o = L.weather;
  const weatherStr = localStorage.getItem('lhr_weather_v2');
  let tW = '--', feels = '--', humW = '--', wCode = -1;
  if (weatherStr) {
    try { 
      const currentWea = JSON.parse(weatherStr).data.current;
      tW = Math.round(currentWea.temperature_2m);
      feels = Math.round(currentWea.apparent_temperature);
      humW = Math.round(currentWea.relative_humidity_2m);
      wCode = currentWea.weather_code;
    } catch(e){}
  }
  const cl = window.currentCloud !== undefined ? window.currentCloud : '--';
  const rn = window.currentRain !== undefined ? window.currentRain : '--';
  const clearSky = cl !== '--' ? Math.max(0, 100 - cl) : '--';

  let wIcon = '🌤';
  if (wCode === 0) wIcon = '☀';
  else if (wCode >= 1 && wCode <= 3) wIcon = '⛅';
  else if (wCode >= 45 && wCode <= 48) wIcon = '🌫';
  else if (wCode >= 51 && wCode <= 67) wIcon = '🌧';
  else if (wCode >= 71 && wCode <= 77) wIcon = '❄';
  else if (wCode >= 80 && wCode <= 82) wIcon = '🌧';
  else if (wCode >= 95) wIcon = '⛈';

  if (o) {
    const sFs = Math.round(o.fs * 0.78);
    const mFs = Math.round(o.fs * 0.72);
    const timeNow = getPktNow().toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
    svg += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#0f172a" stroke="${o.color}" stroke-width="2"/>`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}"><tspan fill="#a1a1aa" font-size="${sFs}">${timeNow}</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> ${wIcon} ${tW}°C <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#f59e0b" font-size="${sFs}">Feels: ${feels}°C</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#38bdf8" font-size="${sFs}">Hum: ${humW}%</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#cbd5e1" font-size="${sFs}">☁ ${cl}%</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#60a5fa" font-size="${sFs}">🌧 ${rn}%</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#facc15" font-size="${sFs}">☀️ ${clearSky}%</tspan></text>`;
  }

  // 1. SOLAR
  o = L.solar;
  const predW = window.currentPredW || 0; 
  const pred2W = window.currentPred2W || 0;
  const cloud = window.currentCloud || 0;
  const rain = window.currentRain || 0;
  const solAct = s > 20;
  const lTime = byName.get('Tot Load')?.time;
  const lTimeStr = lTime ? new Date(lTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  svg += `<rect class="${solAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#1a1508" stroke="${o.color}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}" data-maxw="${o.w-12}">${o.label}: ${pF(s)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${o.c2}" data-maxw="${o.w-12}">Load: ${pF(l)}</text>`;
  if (o.ly7) svg += `<text x="${cx(o)}" y="${o.y+o.ly7}" ${tpProps} font-size="${o.fs7}" fill="${o.c7}">${lTimeStr}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">${Math.round(sv)}V | ${sa.toFixed(1)}A | ${invT.toFixed(1)}°C</text>`;
  const rainStr = rain > 0 ? ` 🌧 ${rain}%` : '';
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">Pred: ${predF(predW)} | ☁ ${cloud}%${rainStr}</text>`;
  if (o.ly8) svg += `<text x="${cx(o)}" y="${o.y+o.ly8}" ${tpProps} font-size="${o.fs8}" fill="${o.c8}">Pred2: ${predF(pred2W)} | ☀️ ${window.currentPred2SunPct != null ? window.currentPred2SunPct : Math.max(0, 100 - cloud)}%</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${o.c5}">Today: ${solar_t.toFixed(1)} kWh | ${kF(solar_t*rate)} PKR</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6}">Month: ${nF(mU.solar||0)} kWh | ${kF((mU.solar||0)*rate)} PKR</text>`;

  // 2. GRID 
  o = L.grid; 
  const grdAct = Math.abs(b) > 20;
  const gridOff = v < 10;

  const breakerStatus = getStatus('Breaker') || getStatus('Grid Power');
  const isBreakerZero = breakerStatus && breakerStatus.type === 'zeroW';

  const nowSec = Math.floor(Date.now() / 1000);
  let breaker0WLocal = false;
  let bLastActiveStr = localStorage.getItem('Breaker_last_active');
  if (b <= 5 && !gridOff) {
    if (bLastActiveStr) {
      const bLastActive = parseInt(bLastActiveStr, 10);
      if ((nowSec - bLastActive) >= 10 * 60) {
        breaker0WLocal = true;
      }
    }
  } else {
    localStorage.setItem('Breaker_last_active', nowSec.toString());
  }

  const showBreakerZeroWarn = (isBreakerZero || breaker0WLocal) && !gridOff;

  let gClass = '';
  let gFill = gridOff ? '#2a0a0a' : (grdAct ? '#2a0a0a' : '#1f1f23');
  let gStroke = gridOff ? '#ef4444' : (grdAct ? o.color : '#666');

  if (gridOff) {
    gClass = 'grid-off-anim';
    gFill = '#2a0a0a';
    gStroke = '#ef4444';
  } else if (showBreakerZeroWarn) {
    gClass = 'zeroW-anim';
    gStroke = '#f59e0b';
    gFill = '#1f1f23';
  } else if (grdAct) {
    gClass = 'pulse-animation';
  }

  let gridBadge = '';
  if (gridOff) {
    gridBadge = ' <tspan fill="#ef4444" font-weight="900">⚠ OFF</tspan>';
  } else if (showBreakerZeroWarn) {
    gridBadge = ' <tspan fill="#f59e0b" font-weight="900">⚠ 0 W</tspan>';
  }

  const vTime = byName.get('AC Volts')?.time;
  const vTimeStr = vTime ? new Date(vTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const gTime = byName.get('Breaker')?.time;
  const gTimeStr = gTime ? new Date(gTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  svg += `<rect class="${gClass}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${gFill}" stroke="${gStroke}" stroke-width="2"/>`;
  if (gridOff) {
    svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="#ef4444" data-maxw="${o.w-12}">GRID OFF${gridBadge}</text>`;
  } else {
    const valText = showBreakerZeroWarn ? '' : ` ${pF(b)}`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${grdAct ? o.c1 : (showBreakerZeroWarn ? '#f59e0b' : '#777')}" data-maxw="${o.w-12}">${o.label}:${valText}${gridBadge}</text>`;
  }
  if (o.ly6) svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${gridOff ? '#ef4444' : o.c6}">${gTimeStr}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${gridOff ? '#ef4444' : o.c2}">AC Input: ${Math.round(v)}V</text>`;
  if (o.ly5) svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${gridOff ? '#ef4444' : o.c5}">${vTimeStr}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">T: ${grid_t.toFixed(1)} kWh | ${kF(grid_t*rate)} PKR</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">M: ${nF(mU.grid||0)} kWh | ${kF((mU.grid||0)*rate)} PKR</text>`;

  // 3. WATER 
  o = L.water;
  const tkFeed = byName.get('Water Tank');
  const tkTime = tkFeed?.time;
  const isWasting = window.waterWasteDetected?.active;

  let wS = "CRITICAL", wC = "#f87171";
  if (isWasting) {
    wS = "🚨 VALVE OPEN";
    wC = "#ef4444";
  } else if (tk > 95) { wS = "FULL"; wC = "#38bdf8"; }
  else if (tk > 70) { wS = "GOOD"; wC = "#4ade80"; }
  else if (tk > 40) { wS = "MODERATE"; wC = "#facc15"; }
  else if (tk > 20) { wS = "LOW"; wC = "#f59e0b"; }

  const boxClass = isWasting ? "pulse-animation" : "";
  svg += `<rect class="${boxClass}" style="--pulse-clr:#ef4444" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${isWasting?'#2a0a0a':'#0f1a20'}" stroke="${wC}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${isWasting?'#ef4444':o.c1}">${o.label}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${isWasting?'#fca5a5':o.c2}">${Math.round(tk)}%</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${wC}" data-maxw="${o.w-8}">${wS}</text>`;
  if (tkTime) {
    const timeStr = new Date(tkTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">${timeStr}</text>`;
  }

  const flowRate = window.waterFlowRate || 0;
  const lastFlow = window.lastFlowRate || 0;
  const lastOnTime = window.lastMotorOnTime || 0;
  const showFlow = flowRate > 0.1 || (lastOnTime > 0 && (Date.now() - lastOnTime < 15 * 60 * 1000) && lastFlow > 0.1);

  const avgFlow = window.waterAvgFlowRate || 0;

  if (isWasting && o.ly5) {
    const rateHr = window.waterWasteDetected.ratePerHour || 0;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="#ef4444">▼ -${rateHr.toFixed(1)}%/hr</text>`;
  } else if (showFlow && o.ly5) {
    const displayFlow = flowRate > 0.1 ? flowRate : lastFlow;
    const prefix = flowRate > 0.1 ? '▲ ' : 'Last: ';
    svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${o.c5}">${prefix}${displayFlow.toFixed(1)} L/min</text>`;
  }

  if (showFlow && avgFlow > 0.1 && o.ly6 && !isWasting) {
    svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6 || '#a1a1aa'}">Ø ${avgFlow.toFixed(1)} L/min</text>`;
  }

  // 4. APPLIANCES
  const drawApp = (k, name, suffix="Today") => {
    if (!L[k]) { console.warn('drawApp: missing layout key', k); return; }
    const oA = L[k]; const val = getV(name); const act = val > 6;
    const t = getV(name + " " + suffix); const mon = mU[k] || 0;
    const aTime = byName.get(name)?.time;
    const aTimeStr = aTime ? new Date(aTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
    
    svg += `<rect class="${act ? 'pulse-animation' : ''}" style="--pulse-clr:${oA.color}" x="${oA.x}" y="${oA.y}" width="${oA.w}" height="${oA.h}" rx="10" fill="${act?'#141416':'#1a1a1c'}" stroke="${act?oA.color:'#333'}" stroke-width="2"/>`;
    const lblParts = String(oA.label).split('|');
    const isMulti  = lblParts.length > 1;
    const lblHtml  = isMulti ? lblParts.map((pp, i) => `<tspan x="${cx(oA)}" dy="${i === 0 ? 0 : oA.fs + 2}">${pp}</tspan>`).join('') : oA.label;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly1}" ${tpProps} font-size="${oA.fs}" fill="${act?oA.c1:'#777'}"${isMulti ? '' : ` data-maxw="${oA.w-12}"`}>${lblHtml}</text>`;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly2}" ${tpProps} font-size="${oA.fs2}" fill="${act?oA.c2:'#555'}">${pF(val)}</text>`;
    if (oA.ly5) svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly5}" ${tpProps} font-size="${oA.fs5}" fill="${oA.c5}">${aTimeStr}</text>`;
    
    // Use 2 decimal places specifically for Washing Machine (wm)
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly3}" ${tpProps} font-size="${oA.fs3}" fill="${oA.c3}">T: ${t.toFixed(k === 'wm' ? 2 : 1)} kWh</text>`;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly4}" ${tpProps} font-size="${oA.fs4}" fill="${oA.c4}">M: ${mon.toFixed(1)} kWh</text>`;
  };
  drawApp('haier', 'Haier 1Ton'); drawApp('k15', 'Kenwood 1.5Ton'); drawApp('k1', 'Kenwood 1Ton'); drawApp('pc', 'PC'); drawApp('motor', 'Water Motor');
  drawApp('wm', 'Washing Machine');
  
  const f1W = getV('Fridge'); const f2W = getV('Fridge2');
  const f1T = getV('Fridge Today'); const f2T = getV('Fridge2 Today');
  const fAct = (f1W + f2W) > 6;

  const f1Status = getStatus('Fridge');
  const f2Status = getStatus('Fridge2');
  const isFridge1Stale = f1Status && f1Status.type === 'stale';
  const isFridge2Stale = f2Status && f2Status.type === 'stale';
  const isFridge1Zero = f1Status && f1Status.type === 'zeroW';
  const isFridge2Zero = f2Status && f2Status.type === 'zeroW';

  o = L.fridge;
  let rectClass = '';
  let rectStroke = o.color;
  let rectFill = fAct ? '#141416' : '#1a1a1c';

  if (isFridge1Stale || isFridge2Stale) {
    rectClass = 'offline-anim';
    rectStroke = '#ef4444';
    rectFill = '#2a0a0a';
  } else if (isFridge1Zero || isFridge2Zero) {
    rectClass = 'zeroW-anim';
    rectStroke = '#f59e0b';
    rectFill = '#1a1a1c';
  }

  svg += `<rect class="${rectClass}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${rectFill}" stroke="${rectStroke}" stroke-width="2"/>`;
  const f1Time = byName.get('Fridge')?.time;
  const f1TimeStr = f1Time ? new Date(f1Time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const f2Time = byName.get('Fridge2')?.time;
  const f2TimeStr = (f2Time && !isNaN(f2Time)) ? new Date(f2Time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  let badge1 = '';
  if (isFridge1Stale) badge1 = ' <tspan fill="#ef4444" font-weight="900">⚠ OFF</tspan>';
  else if (isFridge1Zero) badge1 = ' <tspan fill="#f59e0b" font-weight="900">⚠ Low (' + Math.round(f1W) + 'W)</tspan>';
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${f1W>6?o.c1:'#777'}" data-maxw="${o.w-12}">Fridge 1${badge1}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${f1W>6?o.c2:'#555'}">${pF(f1W)}</text>`;
  if (o.ly7) svg += `<text x="${cx(o)}" y="${o.y+o.ly7}" ${tpProps} font-size="${o.fs7}" fill="${o.c7}">${f1TimeStr}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">T: ${f1T.toFixed(2)} kWh M: ${(mU.f1||0).toFixed(1)} kWh</text>`;

  let badge2 = '';
  if (isFridge2Stale) badge2 = ' <tspan fill="#ef4444" font-weight="900">⚠ OFF</tspan>';
  else if (isFridge2Zero) badge2 = ' <tspan fill="#f59e0b" font-weight="900">⚠ Low (' + Math.round(f2W) + 'W)</tspan>';
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${f2W>6?o.c4:'#777'}" data-maxw="${o.w-12}">Fridge 2${badge2}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${f2W>6?o.c5:'#555'}">${pF(f2W)}</text>`;
  if (o.ly8) svg += `<text x="${cx(o)}" y="${o.y+o.ly8}" ${tpProps} font-size="${o.fs8}" fill="${o.c8}">${f2TimeStr}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6}">T: ${f2T.toFixed(2)} kWh M: ${(mU.f2||0).toFixed(1)} kWh</text>`;

  // 5. TEMP
  const oT = L.temp;
  svg += `<rect x="${oT.x}" y="${oT.y}" width="${oT.w}" height="${oT.h}" rx="8" fill="#141416" stroke="${oT.color}" stroke-width="1.5"/><text x="${cx(oT)}" y="${oT.y+oT.ly1}" ${tpProps} font-size="${oT.fs}" fill="${oT.c1}">${tp.toFixed(1)}°C / ${Math.round(hm)}%</text>`;
  const oT2 = L.temp2;
  svg += `<rect x="${oT2.x}" y="${oT2.y}" width="${oT2.w}" height="${oT2.h}" rx="8" fill="#141416" stroke="${oT2.color}" stroke-width="1.5"/><text x="${cx(oT2)}" y="${oT2.y+oT2.ly1}" ${tpProps} font-size="${oT2.fs}" fill="${oT2.c1}">${tp2.toFixed(1)}°C / ${Math.round(hm2)}%</text></svg>`;
  
  const flowWrap = document.getElementById('flow-svg-wrap');
  flowWrap.innerHTML = svg;
  flowWrap.querySelectorAll('text[data-maxw]').forEach(t => {
    try {
      const maxW = parseFloat(t.getAttribute('data-maxw'));
      const len  = t.getComputedTextLength();
      if (len > maxW) {
        const fs = parseFloat(t.getAttribute('font-size')) || 12;
        t.setAttribute('font-size', Math.max(9, (fs * maxW) / len).toFixed(1));
      }
    } catch (e) {}
  });
}

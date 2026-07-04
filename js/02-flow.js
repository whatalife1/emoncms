const LAYOUT = {
 weather: { x:5, y:10, w:708, h:49, color:'#0ea5e9', label:'Weather', ly1:25, fs:25, c1:'#ffffff',  },
 solar: { x:7, y:64, w:321, h:365, color:'#f59e0b', label:'Solar', ly1:42, fs:47, c1:'#ffff00', ly2:106, fs2:46, c2:'#2c8758', ly3:166, fs3:38, c3:'#b4b635', ly4:219, fs4:22, c4:'#21c442', ly5:279, fs5:24, c5:'#3de31c', ly6:317, fs6:22, c6:'#38bdf8',  },
 grid: { x:330, y:64, w:245, h:365, color:'#ef4444', label:'Grid', ly1:48, fs:38, c1:'#ef4444', ly2:154, fs2:28, c2:'#35c0b7', ly3:278, fs3:22, c3:'#3de3e4', ly4:317, fs4:22, c4:'#38bdf8',  },
 water: { x:585, y:64, w:140, h:365, color:'#0ea5e9', label:'Water', ly1:48, fs:46, c1:'#0ea5e9', ly2:158, fs2:56, c2:'#25f447', ly3:251, fs3:25, c3:'#9ca3af', ly4:295, fs4:20, c4:'#0ce4e0', ly5:320, fs5:19, c5:'#38bdf8', ly6:342, fs6:18, c6:'#a1a1aa',  },
 haier: { x:7, y:436, w:238, h:199, color:'#38bdf8', label:'Haier 1T', ly1:25, fs:34, c1:'#38bdf8', ly2:75, fs2:63, c2:'#25f447', ly3:137, fs3:25, c3:'#00c8f0', ly4:173, fs4:25, c4:'#518e35',  },
 k15: { x:252, y:436, w:238, h:199, color:'#38bdf8', label:'Kenwood 1.5T', ly1:21, fs:33, c1:'#38bdf8', ly2:68, fs2:60, c2:'#25f447', ly3:137, fs3:25, c3:'#00c8f0', ly4:173, fs4:25, c4:'#518e35',  },
 k1: { x:497, y:435, w:230, h:192, color:'#38bdf8', label:'Kenwood 1T', ly1:27, fs:34, c1:'#38bdf8', ly2:75, fs2:61, c2:'#25f447', ly3:137, fs3:25, c3:'#00c8f0', ly4:173, fs4:25, c4:'#518e35',  },
 fridge: { x:8, y:678, w:240, h:231, color:'#c084fc', label:'Fridges', ly1:19, fs:36, c1:'#38bdf8', ly2:60, fs2:52, c2:'#25f447', ly3:94, fs3:19, c3:'#518e35', ly4:125, fs4:36, c4:'#38bdf8', ly5:172, fs5:52, c5:'#25f447', ly6:212, fs6:19, c6:'#518e35',  },
 pc: { x:508, y:676, w:218, h:232, color:'#10b9f8', label:'PC', ly1:27, fs:47, c1:'#38bdf8', ly2:93, fs2:53, c2:'#25f447', ly3:160, fs3:25, c3:'#00c8f0', ly4:207, fs4:21, c4:'#518e35',  },
 motor: { x:249, y:678, w:248, h:231, color:'#fbbf24', label:'Water Motor', ly1:24, fs:35, c1:'#fbbf24', ly2:99, fs2:57, c2:'#38bdf8', ly3:157, fs3:21, c3:'#518e35', ly4:200, fs4:22, c4:'#518e35',  },
 temp: { x:500, y:631, w:225, h:40, color:'#22c55e', label:'temp', ly1:20, fs:27, c1:'#25f447',  },
 temp2: { x:8, y:639, w:238, h:35, color:'#22c55e', label:'temp2', ly1:16, fs:27, c1:'#25f447',  },
};


function renderFlowDiagram(byName) {
  if (!byName) return;

  const getV = (n) => byName.get(n)?.value ?? 0;
  const s = getV('Solar');
  const b = getV('Breaker');
  const l = getV('Tot Load');
  const v = getV('AC Volts');
  const sv = getV('Solar Volts') || getV('Solar V');
  const sa = getV('Solar Amps');
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
    if (x >= 1000) return (x / 1000).toFixed(1) + ' kWh';
    return Math.round(x) + ' w';
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
    const timeNow = new Date().toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase().replace(' ', '');
    svg += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#0f172a" stroke="${o.color}" stroke-width="2"/>`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}"><tspan fill="#a1a1aa" font-size="${sFs}">${timeNow}</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> ${wIcon} ${tW}°C <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#f59e0b" font-size="${sFs}">Feels: ${feels}°C</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#38bdf8" font-size="${sFs}">Hum: ${humW}%</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#cbd5e1" font-size="${sFs}">☁ ${cl}%</tspan> <tspan fill="#334155" font-size="${mFs}">|</tspan> <tspan fill="#60a5fa" font-size="${sFs}">🌧 ${rn}%</tspan></text>`;
  }

  // 1. SOLAR
  o = L.solar;
  const predW = window.currentPredW || 0; 
  const cloud = window.currentCloud || 0;
  const rain = window.currentRain || 0;
  const solAct = s > 20;
  svg += `<rect class="${solAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#1a1508" stroke="${o.color}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}">${o.label}: ${pF(s)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${o.c2}">Load: ${pF(l)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">${Math.round(sv)}V | ${sa.toFixed(1)}A</text>`;
  const rainStr = rain > 0 ? ` 🌧 ${rain}%` : '';
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">Pred: ${predF(predW)} | ☁ ${cloud}%${rainStr}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${o.c5}">Today: ${solar_t.toFixed(1)} kWh | ${kF(solar_t*rate)} PKR</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6}">Month: ${nF(mU.solar||0)} kWh | ${kF((mU.solar||0)*rate)} PKR</text>`;

  // 2. GRID 
  o = L.grid; 
  const grdAct = Math.abs(b) > 20;
  const gridOff = v < 10;
  const gClass = gridOff ? 'grid-off-anim' : (grdAct ? 'pulse-animation' : '');
  const gFill = gridOff ? '#1f1f23' : (grdAct ? '#2a0a0a' : '#1f1f23');
  const gStroke = gridOff ? '#666' : (grdAct ? o.color : '#666');
  svg += `<rect class="${gClass}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${gFill}" stroke="${gStroke}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${gridOff?'#ef4444':(grdAct?o.c1:'#777')}">${gridOff?'GRID OFF':o.label+': '+pF(b)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${gridOff?'#ef4444':o.c2}">AC Input: ${Math.round(v)}V</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">T: ${grid_t.toFixed(1)} kWh | ${kF(grid_t*rate)} PKR</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">M: ${nF(mU.grid||0)} kWh | ${kF((mU.grid||0)*rate)} PKR</text>`;

  // 3. WATER 
  o = L.water;
  const tkFeed = byName.get('Water Tank');
  const tkTime = tkFeed?.time;
  let wS = "CRITICAL", wC = "#f87171";
  if (tk > 95) { wS = "FULL"; wC = "#38bdf8"; }
  else if (tk > 70) { wS = "GOOD"; wC = "#4ade80"; }
  else if (tk > 40) { wS = "MODERATE"; wC = "#facc15"; }
  else if (tk > 20) { wS = "LOW"; wC = "#f59e0b"; }
  svg += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#0f1a20" stroke="${wC}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}">${o.label}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${o.c2}">${Math.round(tk)}%</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${wC}">${wS}</text>`;
  if (tkTime) {
    const timeStr = new Date(tkTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">${timeStr}</text>`;
  }

  const flowRate = window.waterFlowRate || 0;
  const lastFlow = window.lastFlowRate || 0;
  const lastOnTime = window.lastMotorOnTime || 0;
  const showFlow = flowRate > 0.1 || (lastOnTime > 0 && (Date.now() - lastOnTime < 15 * 60 * 1000) && lastFlow > 0.1);

  const avgFlow = window.waterAvgFlowRate || 0;

  if (showFlow && o.ly5) {
    const displayFlow = flowRate > 0.1 ? flowRate : lastFlow;
    const prefix = flowRate > 0.1 ? '▲ ' : 'Last: ';
    svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${o.c5}">${prefix}${displayFlow.toFixed(1)} L/min</text>`;
  }

  if (showFlow && avgFlow > 0.1 && o.ly6) {
    svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6 || '#a1a1aa'}">Ø ${avgFlow.toFixed(1)} L/min</text>`;
  }

  // 4. APPLIANCES
  const drawApp = (k, name, suffix="Today") => {
    const oA = L[k]; const val = getV(name); const act = val > 20;
    const t = getV(name + " " + suffix); const mon = mU[k] || 0;
    svg += `<rect class="${act ? 'pulse-animation' : ''}" style="--pulse-clr:${oA.color}" x="${oA.x}" y="${oA.y}" width="${oA.w}" height="${oA.h}" rx="10" fill="${act?'#141416':'#1a1a1c'}" stroke="${act?oA.color:'#333'}" stroke-width="2"/>`;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly1}" ${tpProps} font-size="${oA.fs}" fill="${act?oA.c1:'#777'}">${oA.label}</text>`;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly2}" ${tpProps} font-size="${oA.fs2}" fill="${act?oA.c2:'#555'}">${pF(val)}</text>`;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly3}" ${tpProps} font-size="${oA.fs3}" fill="${oA.c3}">Today: ${t.toFixed(1)} kWh</text>`;
    svg += `<text x="${cx(oA)}" y="${oA.y+oA.ly4}" ${tpProps} font-size="${oA.fs4}" fill="${oA.c4}">Month: ${mon.toFixed(1)} kWh</text>`;
  };
  drawApp('haier', 'Haier 1Ton'); drawApp('k15', 'Kenwood 1.5Ton'); drawApp('k1', 'Kenwood 1Ton'); drawApp('pc', 'PC');
  
  const f1W = getV('Fridge'); const f2W = getV('Fridge2');
  const f1T = getV('Fridge Today'); const f2T = getV('Fridge2 Today');
  const fAct = (f1W + f2W) > 15; o = L.fridge;
  svg += `<rect class="${fAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${fAct?'#141416':'#1a1a1c'}" stroke="${fAct?o.color:'#333'}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${f1W>5?o.c1:'#777'}">Fridge 1</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${f1W>5?o.c2:'#25f447'}">${pF(f1W)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">T: ${f1T.toFixed(2)} kWh M: ${(mU.f1||0).toFixed(1)} kWh</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${f2W>5?o.c4:'#777'}">Fridge 2</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${f2W>5?o.c5:'#25f447'}">${pF(f2W)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6}">T: ${f2T.toFixed(2)} kWh M: ${(mU.f2||0).toFixed(1)} kWh</text>`;

  const motT = getV('Water Motor Today');
  const motAct = motW > 20; o = L.motor;
  if(o) {
    svg += `<rect class="${motAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${motAct?'#141416':'#1a1a1c'}" stroke="${motAct?o.color:'#333'}" stroke-width="2"/>`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${motAct?o.c1:'#777'}">${o.label}</text>`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${motAct?o.c2:'#555'}">${pF(motW)}</text>`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">Today ${motT.toFixed(2)} kWh</text>`;
    svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">Month ${(mU.motor||0).toFixed(1)} kWh</text>`;
  }

  // 5. TEMP
  const oT = L.temp;
  svg += `<rect x="${oT.x}" y="${oT.y}" width="${oT.w}" height="${oT.h}" rx="8" fill="#141416" stroke="${oT.color}" stroke-width="1.5"/><text x="${cx(oT)}" y="${oT.y+oT.ly1}" ${tpProps} font-size="${oT.fs}" fill="${oT.c1}">${tp.toFixed(1)}°C / ${Math.round(hm)}%</text>`;
  const oT2 = L.temp2;
  svg += `<rect x="${oT2.x}" y="${oT2.y}" width="${oT2.w}" height="${oT2.h}" rx="8" fill="#141416" stroke="${oT2.color}" stroke-width="1.5"/><text x="${cx(oT2)}" y="${oT2.y+oT2.ly1}" ${tpProps} font-size="${oT2.fs}" fill="${oT2.c1}">${tp2.toFixed(1)}°C / ${Math.round(hm2)}%</text></svg>`;
  
  document.getElementById('flow-svg-wrap').innerHTML = svg;
}
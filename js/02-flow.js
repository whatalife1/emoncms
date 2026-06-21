const LAYOUT = {
 solar: { x:5, y:10, w:315, h:365, color:'#f59e0b', label:'Solar', ly1:42, fs:47, c1:'#ffff00', ly2:106, fs2:46, c2:'#2c8758', ly3:166, fs3:38, c3:'#b4b635', ly4:219, fs4:28, c4:'#21c442', ly5:264, fs5:24, c5:'#3de31c', ly6:314, fs6:22, c6:'#38bdf8',  },
 grid: { x:330, y:10, w:245, h:365, color:'#ef4444', label:'Grid', ly1:48, fs:38, c1:'#ef4444', ly2:154, fs2:28, c2:'#35c0b7', ly3:275, fs3:22, c3:'#3de3e4', ly4:317, fs4:22, c4:'#38bdf8',  },
 water: { x:585, y:10, w:140, h:365, color:'#0ea5e9', label:'Water', ly1:56, fs:46, c1:'#0ea5e9', ly2:158, fs2:56, c2:'#25f447', ly3:251, fs3:25, c3:'#9ca3af', ly4:80, fs4:12, c4:'#9ca3af',  },
 haier: { x:7, y:379, w:235, h:210, color:'#38bdf8', label:'Haier 1T', ly1:25, fs:34, c1:'#38bdf8', ly2:75, fs2:63, c2:'#25f447', ly3:147, fs3:25, c3:'#00c8f0', ly4:186, fs4:25, c4:'#518e35',  },
 k15: { x:252, y:379, w:235, h:210, color:'#38bdf8', label:'Kenwood 1.5T', ly1:21, fs:34, c1:'#38bdf8', ly2:74, fs2:59, c2:'#25f447', ly3:147, fs3:25, c3:'#00c8f0', ly4:180, fs4:26, c4:'#518e35',  },
 k1: { x:497, y:379, w:230, h:210, color:'#38bdf8', label:'Kenwood 1T', ly1:27, fs:34, c1:'#38bdf8', ly2:75, fs2:63, c2:'#25f447', ly3:148, fs3:24, c3:'#00c8f0', ly4:184, fs4:26, c4:'#518e35',  },
 fridge: { x:5, y:637, w:350, h:195, color:'#c084fc', label:'Fridges', ly1:19, fs:34, c1:'#38bdf8', ly2:59, fs2:62, c2:'#25f447', ly3:132, fs3:26, c3:'#00c8f0', ly4:166, fs4:25, c4:'#518d35',  },
 pc: { x:368, y:641, w:360, h:195, color:'#10b9f8', label:'PC', ly1:22, fs:52, c1:'#38bdf8', ly2:72, fs2:62, c2:'#25f447', ly3:123, fs3:28, c3:'#00c8f0', ly4:164, fs4:25, c4:'#518e35',  },
 temp: { x:253, y:588, w:236, h:40, color:'#22c55e', label:'temp', ly1:20, fs:27, c1:'#25f447',  },
 temp2: { x:501, y:598, w:228, h:35, color:'#22c55e', label:'temp2', ly1:16, fs:27, c1:'#25f447',  },
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
  const grid_t = getV('Grid Today') || getV('Breaker Today');
  
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

  // 1. SOLAR
  let o = L.solar;
  const predW = window.currentPredW || 0; const cloud = window.currentCloud || 0;
  const solAct = s > 20;
  svg += `<rect class="${solAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#1a1508" stroke="${o.color}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}">${o.label}: ${pF(s)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${o.c2}">Load: ${pF(l)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">${Math.round(sv)}V | ${sa.toFixed(1)}A</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">Pred: ${predF(predW)} | ☁ ${cloud}%</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly5}" ${tpProps} font-size="${o.fs5}" fill="${o.c5}">Today: ${solar_t.toFixed(1)} kWh | ${kF(solar_t*rate)} PKR</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly6}" ${tpProps} font-size="${o.fs6}" fill="${o.c6}">Month: ${nF(mU.solar||0)} kWh | ${kF((mU.solar||0)*rate)} PKR</text>`;

  // 2. GRID 
  o = L.grid; const grdAct = Math.abs(b) > 20;
  svg += `<rect class="${grdAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${grdAct?'#2a0a0a':'#1f1f23'}" stroke="${grdAct?o.color:'#666'}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${grdAct?o.c1:'#777'}">${o.label}: ${pF(b)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${o.c2}">AC Input: ${Math.round(v)}V</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">T: ${grid_t.toFixed(1)} kWh | ${kF(grid_t*rate)} PKR</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">M: ${nF(mU.grid||0)} kWh | ${kF((mU.grid||0)*rate)} PKR</text>`;

  // 3. WATER 
  o = L.water;
  let wS = "CRITICAL", wC = "#f87171";
  if (tk > 95) { wS = "FULL"; wC = "#38bdf8"; }
  else if (tk > 70) { wS = "GOOD"; wC = "#4ade80"; }
  else if (tk > 40) { wS = "MODERATE"; wC = "#facc15"; }
  else if (tk > 20) { wS = "LOW"; wC = "#f59e0b"; }
  svg += `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="#0f1a20" stroke="${wC}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${o.c1}">${o.label}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${o.c2}">${Math.round(tk)}%</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${wC}">${wS}</text>`;

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
  
  const fW = getV('Fridge') + getV('Fridge2'); const fT = getV('Fridge Today') + getV('Fridge2 Today');
  const fAct = fW > 15; o = L.fridge;
  svg += `<rect class="${fAct ? 'pulse-animation' : ''}" style="--pulse-clr:${o.color}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="10" fill="${fAct?'#141416':'#1a1a1c'}" stroke="${fAct?o.color:'#333'}" stroke-width="2"/>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly1}" ${tpProps} font-size="${o.fs}" fill="${fAct?o.c1:'#777'}">${o.label}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly2}" ${tpProps} font-size="${o.fs2}" fill="${fAct?o.c2:'#555'}">${pF(fW)}</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly3}" ${tpProps} font-size="${o.fs3}" fill="${o.c3}">Today: ${fT.toFixed(1)} kWh</text>`;
  svg += `<text x="${cx(o)}" y="${o.y+o.ly4}" ${tpProps} font-size="${o.fs4}" fill="${o.c4}">Month: ${(mU.fridge||0).toFixed(1)} kWh</text>`;

  // 5. TEMP
  const oT = L.temp;
  svg += `<rect x="${oT.x}" y="${oT.y}" width="${oT.w}" height="${oT.h}" rx="8" fill="#141416" stroke="${oT.color}" stroke-width="1.5"/><text x="${cx(oT)}" y="${oT.y+oT.ly1}" ${tpProps} font-size="${oT.fs}" fill="${oT.c1}">${tp.toFixed(1)}°C / ${Math.round(hm)}%</text>`;
  const oT2 = L.temp2;
  svg += `<rect x="${oT2.x}" y="${oT2.y}" width="${oT2.w}" height="${oT2.h}" rx="8" fill="#141416" stroke="${oT2.color}" stroke-width="1.5"/><text x="${cx(oT2)}" y="${oT2.y+oT2.ly1}" ${tpProps} font-size="${oT2.fs}" fill="${oT2.c1}">${tp2.toFixed(1)}°C / ${Math.round(hm2)}%</text></svg>`;
  
  document.getElementById('flow-svg-wrap').innerHTML = svg;
}
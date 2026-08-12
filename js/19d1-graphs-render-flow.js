// js/19d1-graphs-render-flow.js
// ─── Moment Flow replay into the SVG diagram ────────────────────────────────

function replayFlowDiagramAtMoment(multiData, idx, timestampSec) {
  if (!multiData || typeof renderFlowDiagram !== 'function') return;
  const nav = graphDataCache?.nav || (typeof _gNavInfo === 'function' ? _gNavInfo() : { resSeconds: 120 });
  const factor = (nav.resSeconds || 120) / 3600000;
  const getVal = (key) => {
    const item = multiData.find(m => m.key === key);
    return item && item.data[idx] != null ? Math.max(0, Math.round(item.data[idx])) : 0;
  };
  const getCumKwh = (key) => {
    const item = multiData.find(m => m.key === key);
    if (!item || !item.data) return 0;
    let sum = 0;
    const maxI = Math.min(idx, item.data.length - 1);
    for (let k = 0; k <= maxI; k++) {
      if (item.data[k] != null && item.data[k] > 0) sum += item.data[k];
    }
    return sum * factor;
  };
  const solarW  = getVal('solar');
  const gridW   = getVal('grid');
  const k15W    = getVal('k15');
  const k1W     = getVal('k1');
  const haierW  = getVal('haier');
  const f1W     = getVal('fridge1');
  const f2W     = getVal('fridge2');
  const pcW     = getVal('pc');
  const motorW  = getVal('motor');
  const wmW     = getVal('wm');
  const totLoad = k15W + k1W + haierW + f1W + f2W + pcW + motorW + wmW;
  const solarCumKwh = getCumKwh('solar');
  const gridCumKwh  = getCumKwh('grid');
  const k15CumKwh   = getCumKwh('k15');
  const k1CumKwh    = getCumKwh('k1');
  const haierCumKwh = getCumKwh('haier');
  const f1CumKwh    = getCumKwh('fridge1');
  const f2CumKwh    = getCumKwh('fridge2');
  const pcCumKwh    = getCumKwh('pc');
  const motorCumKwh = getCumKwh('motor');
  const wmCumKwh    = getCumKwh('wm');
  const mockMap = new Map();
  mockMap.set('Solar',           { value: solarW, time: timestampSec });
  mockMap.set('Solar Today',     { value: solarCumKwh, time: timestampSec });
  mockMap.set('Breaker',         { value: gridW,  time: timestampSec });
  mockMap.set('Breaker Today',   { value: gridCumKwh, time: timestampSec });
  mockMap.set('Utility Today',   { value: gridCumKwh, time: timestampSec });
  mockMap.set('Tot Load',        { value: totLoad, time: timestampSec });
  mockMap.set('AC Volts',        { value: gridW > 20 ? 230 : 0, time: timestampSec });
  mockMap.set('Solar V',         { value: solarW > 20 ? 380 : 0, time: timestampSec });
  mockMap.set('Solar Amps',      { value: solarW > 20 ? (solarW / 380) : 0, time: timestampSec });
  mockMap.set('Inverter Temp',   { value: 38, time: timestampSec });
  mockMap.set('Water Tank',      { value: 75, time: timestampSec });
  mockMap.set('Temperature',     { value: 30, time: timestampSec });
  mockMap.set('Humidity',        { value: 55, time: timestampSec });
  mockMap.set('Temperature 2',   { value: 29, time: timestampSec });
  mockMap.set('Humidity 2',      { value: 55, time: timestampSec });
  mockMap.set('Kenwood 1.5Ton',       { value: k15W, time: timestampSec });
  mockMap.set('Kenwood 1.5Ton Today', { value: k15CumKwh, time: timestampSec });
  mockMap.set('Kenwood 1Ton',         { value: k1W,  time: timestampSec });
  mockMap.set('Kenwood 1Ton Today',   { value: k1CumKwh, time: timestampSec });
  mockMap.set('Haier 1Ton',           { value: haierW, time: timestampSec });
  mockMap.set('Haier 1Ton Today',     { value: haierCumKwh, time: timestampSec });
  mockMap.set('Fridge',              { value: f1W,  time: timestampSec });
  mockMap.set('Fridge Today',         { value: f1CumKwh, time: timestampSec });
  mockMap.set('Fridge2',             { value: f2W,  time: timestampSec });
  mockMap.set('Fridge2 Today',        { value: f2CumKwh, time: timestampSec });
  mockMap.set('PC',                  { value: pcW,  time: timestampSec });
  mockMap.set('PC Today',             { value: pcCumKwh, time: timestampSec });
  mockMap.set('Water Motor',         { value: motorW, time: timestampSec });
  mockMap.set('Water Motor Today',   { value: motorCumKwh, time: timestampSec });
  mockMap.set('Washing Machine',         { value: wmW,      time: timestampSec });
  mockMap.set('Washing Machine Today', { value: wmCumKwh,  time: timestampSec });
  renderFlowDiagram(mockMap);
}

const GRAPH_DAY_RESOLUTION_SECONDS = 120;
const GRAPH_MONTH_RESOLUTION_SECONDS = 3600;
const GRAPH_YEAR_RESOLUTION_SECONDS  = 3600;

const GRAPH_MOMENT_FLOW = { 
  key: 'momentflow', 
  name: 'Moment Flow Inspector', 
  color: '#f59e0b', 
  label: '🔍 Moment Flow', 
  isWatts: true 
};

const GRAPH_FEEDS = [
    { key: 'solar',     name: 'Solar',          id: '499380', color: '#facc15', label: '☀ Solar',        isWatts: true },
    { key: 'grid',      name: 'Grid (Breaker)',  id: '499374', color: '#ef4444', label: '⚡ Grid',         isWatts: true },
    { key: 'battery',   name: 'Battery',        id: '546019', color: '#10b981', label: '🔋 Battery',      isWatts: false, statLabel: '🔋 Battery SOC' },
    { key: 'batchg',    name: 'Bat Charge',     id: '546022', color: '#10b981', label: '⚡🔋 Bat Charge', isWatts: true, statLabel: '⚡🔋 Bat Charge' },
    { key: 'batdis',    name: 'Bat Discharge',  id: '546025', color: '#f97316', label: '⚡🔋 Bat Dischg', isWatts: true, statLabel: '⚡🔋 Bat Discharge' },
    { key: 'batv',      name: 'Bat Voltage',    id: '546013', color: '#35c0b7', label: '⚡ Bat V',        isWatts: false, statLabel: '⚡ Battery Voltage' },
    { key: 'acvolts',   name: 'AC Input Volts',  id: '499383', color: '#fb7185', label: '⚡ AC Volts',     isWatts: false },
    { key: 'temp',      name: 'Temperature',     id: '499428', color: '#10b981', label: '🌡 Temp 1',      isWatts: false, isTemp: true },
    { key: 'temp2',     name: 'Temperature 2',   id: '512473', color: '#34d399', label: '🌡 Temp 2',      isWatts: false, isTemp: true },
    { key: 'invtemp',   name: 'Inverter_Temp',   id: '499394', color: '#f59e0b', label: '🌡 Inv Temp',    isWatts: false, isTemp: true },
    { key: 'k15',       name: 'Kenwood 1.5T',    id: '499362', color: '#38bdf8', label: '❄ Kenwood 1.5T', isWatts: true },
    { key: 'k1',        name: 'Kenwood 1T',      id: '499364', color: '#7dd3fc', label: '❄ Kenwood 1T',   isWatts: true },
    { key: 'haier',     name: 'Haier 1T',        id: '499367', color: '#a5f3fc', label: '❄ Haier 1T',     isWatts: true },
    { key: 'fridge1',   name: 'Fridge 1',        id: '499373', color: '#c084fc', label: '🧊 Fridge 1',    isWatts: true },
    { key: 'fridge2',   name: 'Fridge 2',        id: '541348', color: '#22d3ee', label: '🧊 Fridge 2',    isWatts: true },
    { key: 'pc',        name: 'PC',              id: '499422', color: '#4ade80', label: '💻 PC',          isWatts: true },
    { key: 'motor',     name: 'Water Motor',     id: '542850', color: '#fbbf24', label: '🚿 Motor',       isWatts: true },
    { key: 'water',     name: 'Water Tank',      id: '499431', color: '#0ea5e9', label: '💧 Water',       isWatts: false },
  
    { key: 'wm',        name: 'Washing Machine', id: '544694', color: '#e879f9', label: '👕 W/M', statLabel: "👕 Washing Machine",       isWatts: true },
{ key: 'others',    name: 'Others',          id: null,     color: '#f59e0b', label: '💡 Others',      isWatts: true, isComputed: true },

    // ── Battery 2 (Dyness DL5.0F, 5kWh) ─────────────────────────────
    { key: 'bat2soc',     name: 'Battery 2',           id: '546371', color: '#a78bfa', label: '🔋 Battery 2',      isWatts: false, statLabel: '🔋 Battery 2 SOC' },
    { key: 'bat2power',   name: 'Bat2 Power',          id: '546365', color: '#a78bfa', label: '⚡🔋 Bat2 Power',   isWatts: true,  statLabel: '⚡🔋 Battery 2 Power' },
    { key: 'bat2volt',    name: 'Bat2 Voltage',        id: '546369', color: '#c4b5fd', label: '⚡ Bat2 Voltage',   isWatts: false, statLabel: '⚡ Battery 2 Voltage' },
    { key: 'bat2current', name: 'Bat2 Current',        id: '546370', color: '#818cf8', label: '⚡ Bat2 Current',   isWatts: false, statLabel: '⚡ Battery 2 Current' },
    { key: 'bat2mosftemp',name: 'Bat2 Mosfet Temp',    id: '546373', color: '#f472b6', label: '🌡 Bat2 Mosfet',    isWatts: false, isTemp: true },
    { key: 'bat2bmstemp', name: 'Bat2 BMS Temp',       id: '546374', color: '#fb7185', label: '🌡 Bat2 BMS',       isWatts: false, isTemp: true },
    { key: 'bat2cells',   name: 'Bat2 16 Cells',       id: null,     color: '#38bdf8', label: '🔋 Bat2 16-Cells',  isWatts: false, isComputed: true, statLabel: '🔋 Battery 2 (16-Cell Diagnostics)' },
    { key: 'bat2cellspread', name: 'Bat2 Cell Spread', id: null,     color: '#f59e0b', label: '🔋 Bat2 Cell Δ',    isWatts: false, isComputed: true, statLabel: '🔋 Battery 2 Cell Spread (mV)' },

    { key: 'gridall',   name: 'All',             id: null,     color: '#ff6b6b', label: '⚡ All',         isWatts: true, isMultiLine: true }
];

const GRAPH_COMBINED = { key: 'combined', name: 'Solar + Grid', color: '#facc15', label: '⚡☀ Solar+Grid' };
const GRAPH_BAT_CHG_DIS = { key: 'batchgdis', name: 'Battery Chg / Dis', color: '#10b981', color2: '#f97316', label: '🔋 Chg vs Dis' };
window.GRAPH_BAT_CHG_DIS = GRAPH_BAT_CHG_DIS;

const GRID_ALL_FEEDS = [
    { key: 'solar',     id: '499380', color: '#facc15', label: 'Solar'        },
    { key: 'grid',      id: '499374', color: '#ef4444', label: 'Grid'         },
    { key: 'k15',       id: '499362', color: '#38bdf8', label: 'Kenwood 1.5T' },
    { key: 'k1',        id: '499364', color: '#7dd3fc', label: 'Kenwood 1T'   },
    { key: 'haier',     id: '499367', color: '#a5f3fc', label: 'Haier 1T'     },
    { key: 'fridge1',   id: '499373', color: '#c084fc', label: 'Fridge 1'     },
    { key: 'fridge2',   id: '541348', color: '#22d3ee', label: 'Fridge 2'     },
    { key: 'pc',        id: '499422', color: '#4ade80', label: 'PC'           },
    { key: 'motor',     id: '542850', color: '#fbbf24', label: 'Motor'        }
];

// The 16 Battery 2 (Dyness) cell voltage feed IDs, in cell order (1-16).
// Used by the 'bat2cellspread' computed graph feed to fetch and diff all
// 16 cells over the selected time range, rather than a single feed ID.
const BATTERY2_CELL_IDS = [
  '546380','546381','546382','546383','546384','546385','546386','546387',
  '546388','546389','546390','546391','546392','546393','546394','546395'
];
window.BATTERY2_CELL_IDS = BATTERY2_CELL_IDS;

const TEMP_RANGE_PADDING = 5;

let graphIsLoading = false;
let graphDataCache = null;
let graphTab = 'day';
let graphFeedKey = 'solar';
let graphDateNav = 0;
let graphMonthNav = 0;
let graphYearNav = 0;
let graphChartType = 'line';
let graphZoomLevel = 1;
let graphPanOffset = 0;
let graphIsRendering = false;
let graphIsPanning = false;

window.gridAllDisabled = new Set();
window.graphOverlayAc = null;

window.GRAPH_FEEDS = GRAPH_FEEDS;
window.GRAPH_COMBINED = GRAPH_COMBINED;
window.GRAPH_MOMENT_FLOW = GRAPH_MOMENT_FLOW;
window.GRID_ALL_FEEDS = GRID_ALL_FEEDS;
window.TEMP_RANGE_PADDING = TEMP_RANGE_PADDING;
window.GRAPH_DAY_RESOLUTION_SECONDS = GRAPH_DAY_RESOLUTION_SECONDS;
window.GRAPH_MONTH_RESOLUTION_SECONDS = GRAPH_MONTH_RESOLUTION_SECONDS;
window.GRAPH_YEAR_RESOLUTION_SECONDS = GRAPH_YEAR_RESOLUTION_SECONDS;
window.graphIsLoading = graphIsLoading;
window.graphDataCache = graphDataCache;
window.graphTab = graphTab;
window.graphFeedKey = graphFeedKey;
window.graphDateNav = graphDateNav;
window.graphMonthNav = graphMonthNav;
window.graphYearNav = graphYearNav;
window.graphChartType = graphChartType;
window.graphZoomLevel = graphZoomLevel;
window.graphPanOffset = graphPanOffset;
window.graphIsRendering = graphIsRendering;
window.graphIsPanning = graphIsPanning;

window.graphDayStartHour = 7;
try {
  const saved = localStorage.getItem('graphDayStartHour');
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    window.graphDayStartHour = (parsed === 0 || parsed === 7) ? parsed : 7;
  } else {
    localStorage.setItem('graphDayStartHour', '7');
  }
} catch(e) { window.graphDayStartHour = 7; }

function toggleGraphStartHour() {
  window.graphDayStartHour = window.graphDayStartHour === 7 ? 0 : 7;
  try {
    localStorage.setItem('graphDayStartHour', window.graphDayStartHour.toString());
  } catch(e) {}

  if (typeof fetchTodayBatteryEnergy === 'function') {
    fetchTodayBatteryEnergy().then(() => {
      if (window.lastResultsMap && typeof renderResults === 'function') {
        renderResults(Array.from(window.lastResultsMap.values()));
      }
    });
  }

  if (window.graphTab === 'day') {
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }
  updateGraphStartButton();
}

function updateGraphStartButton() {
  const btn = document.getElementById('graph-start-toggle');
  if (!btn) return;
  if (typeof graphTab !== 'undefined' && graphTab !== 'day') {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  const label = window.graphDayStartHour === 7 ? '4pm-7am' : '12am-12am';
  btn.textContent = label;
  btn.title = window.graphDayStartHour === 7 ? 'Cycle: 4pm-7am (7am start). Click for 12am-12am' : 'Cycle: 12am-12am. Click for 4pm-7am';
}

window.toggleGraphStartHour = toggleGraphStartHour;
window.updateGraphStartButton = updateGraphStartButton;

// ── Battery 2 Cell Spread (computed graph feed) ──────────────────────
// Fetches all 16 Battery 2 cell-voltage feeds over the same range used by
// the current graph nav window, and returns a per-bucket (max - min) in mV
// series. Mirrors the shape _pointsToBars() expects: an array of [ts, val]
// pairs that the standard bar-mapping pipeline in 19c2-graphs-data-utils.js
// can consume directly, so no changes are needed there.
async function fetchBattery2CellSpreadPoints(startMs, endMs, interval) {
  if (typeof _gFetch !== 'function') return [];
  const allSeries = await Promise.all(
    BATTERY2_CELL_IDS.map(id => _gFetch(id, startMs, endMs, interval))
  );
  // Merge into a timestamp -> [values] map, then reduce to (max-min)*1000 mV.
  const byTs = new Map();
  allSeries.forEach(series => {
    if (!Array.isArray(series)) return;
    series.forEach(p => {
      if (!p || p[1] == null) return;
      const ts = p[0];
      if (!byTs.has(ts)) byTs.set(ts, []);
      byTs.get(ts).push(p[1]);
    });
  });
  const out = [];
  for (const [ts, vals] of byTs.entries()) {
    if (vals.length < 2) continue;
    const spreadMv = (Math.max(...vals) - Math.min(...vals)) * 1000;
    out.push([ts, spreadMv]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}
window.fetchBattery2CellSpreadPoints = fetchBattery2CellSpreadPoints;

const BATTERY2_CELL_COLORS = [
  '#38bdf8', '#818cf8', '#a78bfa', '#c084fc',
  '#e879f9', '#f472b6', '#fb7185', '#f87171',
  '#fb923c', '#f59e0b', '#facc15', '#a3e635',
  '#4ade80', '#34d399', '#2dd4bf', '#22d3ee'
];
window.BATTERY2_CELL_COLORS = BATTERY2_CELL_COLORS;

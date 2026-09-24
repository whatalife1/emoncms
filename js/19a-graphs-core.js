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

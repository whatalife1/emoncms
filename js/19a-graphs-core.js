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
    { key: 'acvolts',   name: 'AC Input Volts',  id: '499383', color: '#fb7185', label: '⚡ AC Volts',     isWatts: false },
    { key: 'temp',      name: 'Temperature',     id: '499428', color: '#10b981', label: '🌡 Temp 1',      isWatts: false, isTemp: true },
    { key: 'temp2',     name: 'Temperature 2',   id: '512473', color: '#34d399', label: '🌡 Temp 2',      isWatts: false, isTemp: true },
    { key: 'invtemp',   name: 'Inverter_Temp',   id: '499394', color: '#f59e0b', label: '🌡 Inv Temp',    isWatts: false, isTemp: true },
    { key: 'k15',       name: 'Kenwood 1.5T',    id: '499362', color: '#38bdf8', label: '❄ Kenwood 1.5T', isWatts: true },
    { key: 'k1',        name: 'Kenwood 1T',      id: '499364', color: '#7dd3fc', label: '❄ Kenwood 1T',   isWatts: true },
    { key: 'haier',     name: 'Haier 1T',        id: '499367', color: '#a5f3fc', label: '❄ Haier 1T',     isWatts: true },
    { key: 'fridge1',   name: 'Fridge 1',        id: '499373', color: '#c084fc', label: '🧊 Fridge 1',    isWatts: true },
    { key: 'fridge2',   name: 'Fridge 2',        id: '541348', color: '#e879f9', label: '🧊 Fridge 2',    isWatts: true },
    { key: 'pc',        name: 'PC',              id: '499422', color: '#4ade80', label: '💻 PC',          isWatts: true },
    { key: 'motor',     name: 'Water Motor',     id: '542850', color: '#fbbf24', label: '🚿 Motor',       isWatts: true },
    { key: 'water',     name: 'Water Tank',      id: '499431', color: '#0ea5e9', label: '💧 Water',       isWatts: false },
  { key: 'others',    name: 'Others',          id: null,     color: '#f59e0b', label: '💡 Others',      isWatts: true, isComputed: true },




    { key: 'gridall',   name: 'All',             id: null,     color: '#ff6b6b', label: '⚡ All',         isWatts: true, isMultiLine: true }
];

const GRAPH_COMBINED = { key: 'combined', name: 'Solar + Grid', color: '#facc15', label: '⚡☀ Solar+Grid' };

const GRID_ALL_FEEDS = [
    { key: 'solar',     id: '499380', color: '#facc15', label: 'Solar'        },
    { key: 'grid',      id: '499374', color: '#ef4444', label: 'Grid'         },
    { key: 'k15',       id: '499362', color: '#38bdf8', label: 'Kenwood 1.5T' },
    { key: 'k1',        id: '499364', color: '#7dd3fc', label: 'Kenwood 1T'   },
    { key: 'haier',     id: '499367', color: '#a5f3fc', label: 'Haier 1T'     },
    { key: 'fridge1',   id: '499373', color: '#c084fc', label: 'Fridge 1'     },
    { key: 'fridge2',   id: '541348', color: '#e879f9', label: 'Fridge 2'     },
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

window.graphDayStartHour = 5;
try {
  const saved = localStorage.getItem('graphDayStartHour');
  if (saved !== null) window.graphDayStartHour = parseInt(saved) || 5;
} catch(e) {}

function toggleGraphStartHour() {
  window.graphDayStartHour = window.graphDayStartHour === 5 ? 0 : 5;
  localStorage.setItem('graphDayStartHour', window.graphDayStartHour);
  if (window.graphTab === 'day') {
    if (typeof _loadAndDraw === 'function') _loadAndDraw();
  }
  updateGraphStartButton();
}

function updateGraphStartButton() {
  const btn = document.getElementById('graph-start-toggle');
  if (!btn) return;
  const label = window.graphDayStartHour === 5 ? '5am-5am' : '12am-12am';
  btn.textContent = label;
  btn.title = 'Toggle day start time';
}

window.toggleGraphStartHour = toggleGraphStartHour;
window.updateGraphStartButton = updateGraphStartButton;

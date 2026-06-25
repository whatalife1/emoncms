// ─── Graphs Panel - Core Configuration ──────────────────────────────────────

// Set to 120 for 2-minute resolution
const GRAPH_DAY_RESOLUTION_SECONDS = 120;

// ---- GRAPH FEEDS ----
const GRAPH_FEEDS = [
    { key: 'solar',     name: 'Solar',          id: '499380', color: '#facc15', label: '☀ Solar',        isWatts: true },
    { key: 'grid',      name: 'Grid (Breaker)',  id: '499374', color: '#ef4444', label: '⚡ Grid',         isWatts: true },
    { key: 'acvolts',   name: 'AC Input Volts',  id: '499383', color: '#fb7185', label: '⚡ AC Volts',     isWatts: false },
    { key: 'temp',      name: 'Temperature',     id: '499428', color: '#10b981', label: '🌡 Temp 1',      isWatts: false, isTemp: true },
    { key: 'temp2',     name: 'Temperature 2',   id: '512473', color: '#34d399', label: '🌡 Temp 2',      isWatts: false, isTemp: true },
    { key: 'k15',       name: 'Kenwood 1.5T',    id: '499362', color: '#38bdf8', label: '❄ Kenwood 1.5T', isWatts: true },
    { key: 'k1',        name: 'Kenwood 1T',      id: '499364', color: '#7dd3fc', label: '❄ Kenwood 1T',   isWatts: true },
    { key: 'haier',     name: 'Haier 1T',        id: '499367', color: '#a5f3fc', label: '❄ Haier 1T',     isWatts: true },
    { key: 'fridge1',   name: 'Fridge 1',        id: '499373', color: '#c084fc', label: '🧊 Fridge 1',    isWatts: true },
    { key: 'fridge2',   name: 'Fridge 2',        id: '541348', color: '#e879f9', label: '🧊 Fridge 2',    isWatts: true },
    { key: 'pc',        name: 'PC',              id: '499422', color: '#4ade80', label: '💻 PC',          isWatts: true },
    { key: 'water',     name: 'Water Tank',      id: '499431', color: '#0ea5e9', label: '💧 Water',       isWatts: false },
    // ---- Grid-All Multi-Line (shows all appliances as separate lines) ----
    { key: 'gridall',   name: 'All',             id: null,     color: '#ff6b6b', label: '⚡ All',         isWatts: true, isMultiLine: true }
];

const GRAPH_COMBINED = { key: 'combined', name: 'Solar + Grid', color: '#facc15', label: '⚡☀ Solar+Grid' };

// ---- Map of feeds to show in Grid-All multi-line graph ----
const GRID_ALL_FEEDS = [
    { key: 'solar',     id: '499380', color: '#facc15', label: 'Solar'        },
    { key: 'grid',      id: '499374', color: '#ef4444', label: 'Grid'         },
    { key: 'k15',       id: '499362', color: '#38bdf8', label: 'Kenwood 1.5T' },
    { key: 'k1',        id: '499364', color: '#7dd3fc', label: 'Kenwood 1T'   },
    { key: 'haier',     id: '499367', color: '#a5f3fc', label: 'Haier 1T'     },
    { key: 'fridge1',   id: '499373', color: '#c084fc', label: 'Fridge 1'     },
    { key: 'fridge2',   id: '541348', color: '#e879f9', label: 'Fridge 2'     },
    { key: 'pc',        id: '499422', color: '#4ade80', label: 'PC'           }
];

// ---- Temperature range config ----
const TEMP_RANGE_PADDING = 5;

// ---- Shared variables ----
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

// ---- Grid-All per-feed toggle: keys in this Set are hidden ----
window.gridAllDisabled = new Set();

// ---- AC overlay for Temp feeds: null, 'haier', 'k1', or 'k15' ----
window.graphOverlayAc = null;

// ---- Expose globals ----
window.GRAPH_FEEDS = GRAPH_FEEDS;
window.GRAPH_COMBINED = GRAPH_COMBINED;
window.GRID_ALL_FEEDS = GRID_ALL_FEEDS;
window.TEMP_RANGE_PADDING = TEMP_RANGE_PADDING;
window.GRAPH_DAY_RESOLUTION_SECONDS = GRAPH_DAY_RESOLUTION_SECONDS;
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
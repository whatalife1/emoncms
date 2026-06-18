// Change this to 5, 10, 15, 30, or 60 to easily adjust the daily graph resolution!
const GRAPH_DAY_RESOLUTION_MINUTES = 20; 

// ─── Graphs Panel - Core Configuration ──────────────────────────────────────
const GRAPH_FEEDS = [
  { key: 'solar',   name: 'Solar',         id: '499380', color: '#facc15', label: '☀ Solar'        },
  { key: 'grid',    name: 'Grid (Breaker)', id: '499374', color: '#ef4444', label: '⚡ Grid'         },
  { key: 'temp',    name: 'Temperature',   id: '499428', color: '#10b981', label: '🌡 Temp'         },
  { key: 'k15',     name: 'Kenwood 1.5T',  id: '499362', color: '#38bdf8', label: '❄ Kenwood 1.5T' },
  { key: 'k1',      name: 'Kenwood 1T',    id: '499364', color: '#7dd3fc', label: '❄ Kenwood 1T'   },
  { key: 'haier',   name: 'Haier 1T',      id: '499367', color: '#a5f3fc', label: '❄ Haier 1T'     },
  { key: 'fridge1', name: 'Fridge 1',      id: '499373', color: '#c084fc', label: '🧊 Fridge 1'     },
  { key: 'fridge2', name: 'Fridge 2',      id: '541348', color: '#e879f9', label: '🧊 Fridge 2'     },
  { key: 'pc',      name: 'PC',            id: '499422', color: '#4ade80', label: '💻 PC'           },
  { key: 'water',   name: 'Water Tank',    id: '499431', color: '#0ea5e9', label: '💧 Water'        },
];
const GRAPH_COMBINED = { key: 'combined', name: 'Solar + Grid', color: '#facc15', label: '⚡☀ Solar+Grid' };

let graphTab     = 'day';
let graphFeedKey = 'solar';
let graphDateNav = 0;
let graphMonthNav = 0;
let graphYearNav  = 0;
let graphIsRendering = false;
let graphChartType = 'line'; 
let graphZoomLevel = 1;
let graphZoomMin = 1;        
let graphZoomMax = 60;          // 6000%
let graphPanOffset = 0;
let graphPanStart = null;
let graphIsPanning = false;
let graphDataCache = null;

function openGraphsPanel() {
  const p = document.getElementById('graphs-panel');
  if (!p) return;
  p.classList.add('open');
  setTimeout(renderGraphsPanel, 50);
}

function closeGraphsPanel() {
  const p = document.getElementById('graphs-panel');
  if (p) p.classList.remove('open');
  hideTooltip();
  graphZoomLevel = 1;
  graphPanOffset = 0;
}

function renderGraphsPanel() {
  if (graphIsRendering) return;
  graphIsRendering = true;
  try {
    _renderGFeedTabs();
    _renderGTimeTabs();
    _renderGNavBar();
    _renderChartTypeToggle();
    _renderZoomControls();

    if (graphTab === 'day') {
      graphNeedsDayZoom = true;
    }

    _loadAndDraw();
  } catch(e) {
    console.warn('Graph render error:', e);
  } finally {
    graphIsRendering = false;
  }
}
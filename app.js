// Proxy worker endpoint
const PROXY_BASE = 'https://emon-proxy.new-life-786-786-786.workers.dev';

let autoRefreshSec = 30;

const FEEDS_BASE = [
  { id: "499431", name: "Water Tank",           unit: "%",   type: "env"   },
  { id: "499374", name: "Breaker",              unit: "W",   type: "watts" },
  { id: "499383", name: "AC Volts",             unit: "V",   type: "env"   },
  { id: "499413", name: "Breaker Today",        unit: "kWh", type: "units" },
  { id: "499412", name: "Breaker Total",        unit: "kWh", type: "units" },
  { id: "499380", name: "Solar",                unit: "W",   type: "watts" },
  { id: "499381", name: "Solar V",              unit: "",    type: "env"   },
  { id: "499388", name: "Tot Load",             unit: "W",   type: "watts" },
  { id: "499415", name: "Solar Today",          unit: "kWh", type: "units" },
  { id: "499414", name: "Solar Total",          unit: "kWh", type: "units" },
  { id: "499403", name: "Utility",              unit: "W",   type: "watts" },
  { id: "499421", name: "Utility Today",        unit: "kWh", type: "units" },
  { id: "499420", name: "Utility Total",        unit: "kWh", type: "units" },
  { id: "499373", name: "Fridge",               unit: "W",   type: "watts" },
  { id: "541348", name: "Fridge2",              unit: "W",   type: "watts" },
  { id: "499411", name: "Fridge Today",         unit: "kWh", type: "units" },
  { id: "541350", name: "Fridge2 Today",        unit: "kWh", type: "units" },
  { id: "499362", name: "Kenwood 1.5Ton",       unit: "W",   type: "watts" },
  { id: "499405", name: "Kenwood 1.5Ton Today", unit: "kWh", type: "units" },
  { id: "499404", name: "Kenwood 1.5Ton Total", unit: "kWh", type: "units" },
  { id: "499364", name: "Kenwood 1Ton",         unit: "W",   type: "watts" },
  { id: "499407", name: "Kenwood 1Ton Today",   unit: "kWh", type: "units" },
  { id: "499406", name: "Kenwood 1Ton Total",   unit: "kWh", type: "units" },
  { id: "499367", name: "Hair 1Ton",            unit: "W",   type: "watts" },
  { id: "499409", name: "Hair 1Ton Today",      unit: "kWh", type: "units" },
  { id: "499408", name: "Hair 1Ton Total",      unit: "kWh", type: "units" },
  { id: "499422", name: "PC",                   unit: "W",   type: "watts" },
  { id: "499424", name: "PC Today",             unit: "kWh", type: "units" },
  { id: "499428", name: "Temperature",          unit: "°C",  type: "env"   },
  { id: "499429", name: "Humidity",             unit: "%",   type: "env"   }
];

const COLORS = { watts: "val-watts", units: "val-units", env: "val-env" };

const LINKED_GROUPS = [
  ["Solar", "Solar V", "Tot Load", "Solar Today", "Solar Total"],
  ["Breaker", "AC Volts", "Breaker Today", "Breaker Total"],
  ["Utility", "Utility Today", "Utility Total"],
  ["PC", "PC Today"],
  ["Kenwood 1Ton", "Kenwood 1Ton Today", "Kenwood 1Ton Total"],
  ["Kenwood 1.5Ton", "Kenwood 1.5Ton Today", "Kenwood 1.5Ton Total"],
  ["Hair 1Ton", "Hair 1Ton Today", "Hair 1Ton Total"],
  ["Fridge", "Fridge2", "Fridge Today", "Fridge2 Today"],
  ["Temperature", "Humidity"]
];

const WIDGET_CATALOG = [
  { category: "📊 Full Dashboard", items: [
    { name: "EmonCMS Dashboard",   desc: "Every feed in one big widget" },
    { name: "EmonCMS All-in-One",  desc: "Compact: Solar, Load, Breaker, Utility, Fridge, Temp" }
  ]},
  { category: "⚡ Live Watts", items: [
    { name: "Emon Solar",          desc: "Solar W" },
    { name: "Emon Solar V",        desc: "Solar Voltage" },
    { name: "Emon Tot Load",       desc: "Total Load W" },
    { name: "Emon Breaker",        desc: "Breaker W" },
    { name: "Emon Utility",        desc: "Utility W" },
    { name: "Emon Fridge",         desc: "Fridge W" },
    { name: "Emon Fridge2",        desc: "Fridge2 W" },
    { name: "Emon PC",             desc: "PC W" },
    { name: "Emon Kenwood 1.5Ton", desc: "Kenwood 1.5Ton W" },
    { name: "Emon Kenwood 1Ton",   desc: "Kenwood 1Ton W" },
    { name: "Emon Hair 1Ton",      desc: "Hair 1Ton W" }
  ]},
  { category: "📅 Today / Total kWh", items: [
    { name: "Emon Solar Today",           desc: "Solar kWh today" },
    { name: "Emon Breaker Today",         desc: "Breaker kWh today" },
    { name: "Emon Utility Today",         desc: "Utility kWh today" },
    { name: "Emon Fridge Today",          desc: "Fridge kWh today" },
    { name: "Emon PC Today",              desc: "PC kWh today" },
    { name: "Emon Kenwood 1.5Ton Today",  desc: "Kenwood 1.5Ton kWh today" },
    { name: "Emon Kenwood 1Ton Today",    desc: "Kenwood 1Ton kWh today" },
    { name: "Emon Hair 1Ton Today",       desc: "Hair 1Ton kWh today" },
    { name: "Emon Kenwood 1.5Ton Total",  desc: "Kenwood 1.5Ton lifetime kWh" },
    { name: "Emon Kenwood 1Ton Total",    desc: "Kenwood 1Ton lifetime kWh" },
    { name: "Emon Hair 1Ton Total",       desc: "Hair 1Ton lifetime kWh" }
  ]},
  { category: "🌡 Environment", items: [
    { name: "Emon Temperature", desc: "Temperature °C" },
    { name: "Emon Humidity",    desc: "Humidity %" },
    { name: "Emon Water Tank",  desc: "Water Tank %" }
  ]}
];

let userOrderedFeeds = [];
let isCompact = false;
window.lastSolarActual = 0;

// ─── Sparkline Ring Buffer ──────────────────────────────────────────────────
const SPARK_MAX = 20;
const sparkHistory = {};

function sparkPush(id, val) {
  if (val == null) return;
  if (!sparkHistory[id]) sparkHistory[id] = [];
  sparkHistory[id].push(val);
  if (sparkHistory[id].length > SPARK_MAX) sparkHistory[id].shift();
}

function sparkSvg(id, color) {
  if (isCompact) return '';
  const h = sparkHistory[id];
  if (!h || h.length < 3) return '';
  const W = 80, H = 24, PAD = 2;
  const min = Math.min(...h), max = Math.max(...h);
  const range = max - min || 1;
  const pts = h.map((v, i) => {
    const x = PAD + (i / (h.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last4 = h.slice(-4);
  const trend = last4[last4.length - 1] - last4[0];
  return `<div class="sparkline-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="${(PAD + (W - PAD * 2)).toFixed(1)}" cy="${(H - PAD - ((h[h.length-1] - min) / range) * (H - PAD * 2)).toFixed(1)}" r="2.5" fill="${color}" opacity="0.9"/>
  </svg></div>
  <span class="trend ${trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-flat'}">${trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}</span>`;
}

// ─── Power Flow Diagram ─────────────────────────────────────────────────────
function renderFlowDiagram(byName) {
  const solar   = byName.get('Solar')?.value   ?? 0;
  const utility = byName.get('Utility')?.value ?? 0;
  const load    = byName.get('Tot Load')?.value ?? 0;
  const breaker = byName.get('Breaker')?.value ?? 0;

  const solarGood  = solar > 500;
  const solarColor = solarGood ? '#facc15' : '#71717a';
  const utilColor  = utility > 50 ? '#f87171' : '#4ade80';
  const loadColor  = '#38bdf8';
  const breakerColor = '#f59e0b';

  const cap  = v => Math.max(1, Math.min(5, (v / 500)));
  const sw   = v => cap(v).toFixed(1);
  const fmt  = v => v >= 1000 ? (v / 1000).toFixed(1) + 'kW' : Math.round(v) + 'W';
  const op  = (v, threshold=50) => v > threshold ? 1 : 0.2;

  const svg = `<svg id="flow-svg" viewBox="0 0 340 130" xmlns="http://www.w3.org/2000/svg" width="100%">
  <defs>
    <marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M2 2L8 5L2 8" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <rect x="10" y="10" width="80" height="48" rx="8" fill="#1a1a10" stroke="${solarColor}" stroke-width="1.5"/>
  <text x="50" y="28" text-anchor="middle" font-size="9" fill="${solarColor}" font-weight="700">☀️ SOLAR</text>
  <text x="50" y="44" text-anchor="middle" font-size="13" fill="${solarColor}" font-weight="800" font-family="monospace">${fmt(solar)}</text>

  <rect x="10" y="72" width="80" height="48" rx="8" fill="#1a1010" stroke="${utilColor}" stroke-width="1.5"/>
  <text x="50" y="90" text-anchor="middle" font-size="9" fill="${utilColor}" font-weight="700">⚡ UTILITY</text>
  <text x="50" y="106" text-anchor="middle" font-size="13" fill="${utilColor}" font-weight="800" font-family="monospace">${fmt(utility)}</text>

  <rect x="130" y="40" width="80" height="48" rx="8" fill="#1a160a" stroke="${breakerColor}" stroke-width="1.5"/>
  <text x="170" y="58" text-anchor="middle" font-size="9" fill="${breakerColor}" font-weight="700">🔌 BREAKER</text>
  <text x="170" y="74" text-anchor="middle" font-size="13" fill="${breakerColor}" font-weight="800" font-family="monospace">${fmt(breaker)}</text>

  <rect x="250" y="40" width="80" height="48" rx="8" fill="#0a1520" stroke="${loadColor}" stroke-width="1.5"/>
  <text x="290" y="58" text-anchor="middle" font-size="9" fill="${loadColor}" font-weight="700">🏠 LOAD</text>
  <text x="290" y="74" text-anchor="middle" font-size="13" fill="${loadColor}" font-weight="800" font-family="monospace">${fmt(load)}</text>

  <path d="M 90 34 C 110 34, 120 52, 130 56"
    fill="none" stroke="${solarColor}" stroke-width="${sw(solar)}"
    stroke-linecap="round" marker-end="url(#fa)"
    opacity="${op(solar)}"/>

  <path d="M 90 96 C 110 96, 120 72, 130 72"
    fill="none" stroke="${utilColor}" stroke-width="${sw(utility)}"
    stroke-linecap="round" marker-end="url(#fa)"
    opacity="${op(utility)}"/>

  <line x1="210" y1="64" x2="250" y2="64"
    stroke="${breakerColor}" stroke-width="${sw(breaker)}"
    stroke-linecap="round" marker-end="url(#fa)"
    opacity="${op(breaker)}"/>

  <text x="330" y="124" text-anchor="end" font-size="9" fill="#52525b">
    ${utility > 50 ? '⚠️ grid draw' : solar > 50 ? '✓ solar only' : '— standby'}
  </text>
</svg>`;

  const wrap = document.getElementById('flow-svg-wrap');
  if (wrap) wrap.innerHTML = svg;
}

// ─── Water Tank SVG Renderer ────────────────────────────────────────────────
function renderWaterTank(pct) {
  if (pct == null) return '';
  const p = Math.max(0, Math.min(100, pct));
  const tankH = 52, tankW = 28, x0 = 4, y0 = 4;
  const fillH = (p / 100) * tankH;
  const fillY = y0 + tankH - fillH;
  const waterColor = p > 60 ? '#38bdf8' : p > 30 ? '#f59e0b' : '#f87171';
  const pctColor   = p > 60 ? '#38bdf8' : p > 30 ? '#f59e0b' : '#f87171';
  return `<svg width="36" height="68" viewBox="0 0 36 68" xmlns="http://www.w3.org/2000/svg" class="tank-svg-container">
    <rect x="${x0}" y="${y0}" width="${tankW}" height="${tankH}" rx="5" fill="#1c1c1f" stroke="#27272a" stroke-width="1.5"/>
    ${fillH > 0 ? `<rect x="${x0+1}" y="${fillY}" width="${tankW-2}" height="${fillH}" rx="3" fill="${waterColor}" opacity="0.8"/>` : ''}
    <line x1="${x0+tankW-4}" y1="${y0 + tankH * 0.25}" x2="${x0+tankW}" y2="${y0 + tankH * 0.25}" stroke="#3f3f46" stroke-width="0.8"/>
    <line x1="${x0+tankW-4}" y1="${y0 + tankH * 0.5}" x2="${x0+tankW}" y2="${y0 + tankH * 0.5}" stroke="#3f3f46" stroke-width="0.8"/>
    <line x1="${x0+tankW-4}" y1="${y0 + tankH * 0.75}" x2="${x0+tankW}" y2="${y0 + tankH * 0.75}" stroke="#3f3f46" stroke-width="0.8"/>
    <rect x="${x0+8}" y="1" width="${tankW-16}" height="5" rx="2" fill="#27272a"/>
    <rect x="${x0+10}" y="${y0+tankH}" width="${tankW-20}" height="6" rx="2" fill="#27272a"/>
    <text x="${x0 + tankW/2}" y="${y0 + tankH/2 + 5}" text-anchor="middle" font-size="9" font-weight="800" fill="${pctColor}" font-family="monospace">${Math.round(p)}%</text>
  </svg>`;
}

// ─── Daily Cost Card ────────────────────────────────────────────────────────
function updateCostCard(byName) {
  const utilKwh  = byName.get('Utility Today')?.value ?? 0;
  const solarKwh = byName.get('Solar Today')?.value ?? 0;
  const pkr      = solarCfg?.pkrPerUnit ?? 60;

  if (utilKwh === 0 && solarKwh === 0) {
    document.getElementById('cost-wrap').style.display = 'none';
    return;
  }

  const cost     = (utilKwh * pkr).toFixed(0);
  const solarSave = (solarKwh * pkr).toFixed(0);

  document.getElementById('cost-wrap').style.display = '';
  document.getElementById('cost-pkr').textContent = `PKR ${cost}`;
  document.getElementById('cost-units').textContent = `${utilKwh.toFixed(2)} kWh utility used today`;
  document.getElementById('cost-solar-save').textContent = `PKR ${solarSave} (${solarKwh.toFixed(2)} kWh)`;
}

// ─── Theme & Layout toggles ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function initCompact() {
  isCompact = localStorage.getItem('compactMode') === 'true';
  applyCompactMode();
  updateCompactBtn();
}

function applyCompactMode() {
  const flowWrap = document.getElementById('flow-wrap');
  if (flowWrap) flowWrap.style.display = isCompact ? 'none' : '';
}

function updateCompactBtn() {
  const btn = document.getElementById('btn-compact');
  if (!btn) return;
  btn.textContent = isCompact ? '⬚' : '◩';
  btn.title = isCompact ? 'Switch to Full view' : 'Switch to Compact view';
}

function toggleCompact() {
  isCompact = !isCompact;
  localStorage.setItem('compactMode', isCompact);
  applyCompactMode();
  updateCompactBtn();
  poll();
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

async function loadSettings() {
  const savedLayout   = localStorage.getItem('customLayout');
  const savedInterval = localStorage.getItem('refreshInterval');
  const debugEnabled  = localStorage.getItem('debugEnabled') === 'true';
  autoRefreshSec = savedInterval ? parseInt(savedInterval) : 30;
  document.getElementById('refresh-interval').value = autoRefreshSec;
  document.getElementById('debug-toggle').checked = debugEnabled;
  document.getElementById('debug-info').style.display = debugEnabled ? 'block' : 'none';
  if (savedLayout) {
    const parsed = JSON.parse(savedLayout);
    userOrderedFeeds = parsed.map(saved => {
      const base = FEEDS_BASE.find(f => f.id === saved.id);
      return base ? { ...base, enabled: saved.enabled } : null;
    }).filter(Boolean);
    const existingIds = new Set(userOrderedFeeds.map(f => f.id));
    FEEDS_BASE.forEach(f => { if (!existingIds.has(f.id)) userOrderedFeeds.push({ ...f, enabled: true }); });
  } else {
    userOrderedFeeds = FEEDS_BASE.map(f => ({ ...f, enabled: true }));
  }
}

async function saveSettings() {
  autoRefreshSec = Math.max(5, parseInt(document.getElementById('refresh-interval').value) || 30);
  const rows = document.querySelectorAll('.setting-item');
  const newOrder = [];
  rows.forEach(row => {
    const id      = row.dataset.id;
    const enabled = row.querySelector('input').checked;
    const base    = FEEDS_BASE.find(f => f.id === id);
    if (!base) return;
    const gn = LINKED_GROUPS.find(g => g.includes(base.name));
    if (gn) {
      gn.forEach(name => {
        const member = FEEDS_BASE.find(f => f.name === name);
        if (member) newOrder.push({ ...member, enabled });
      });
    } else {
      newOrder.push({ ...base, enabled });
    }
  });
  userOrderedFeeds = newOrder;
  const layout = userOrderedFeeds.map(f => ({ id: f.id, enabled: f.enabled }));
  localStorage.setItem('customLayout', JSON.stringify(layout));
  localStorage.setItem('refreshInterval', autoRefreshSec);
  localStorage.setItem('debugEnabled', document.getElementById('debug-toggle').checked);
  document.getElementById('debug-info').style.display = document.getElementById('debug-toggle').checked ? 'block' : 'none';
  document.getElementById('settings').classList.remove('open');

  if (window.Android && window.Android.saveWidgetPrefs) {
    window.Android.saveWidgetPrefs(
      'https://emoncms.org',
      'c28cb22a6877c80b1c6a2611b72c25f4',
      '499380'
    );
  }
  poll();
}

function openSettings() {
  document.getElementById('settings').classList.add('open');
  const list        = document.getElementById('settings-list');
  const settingsSet = [];
  const used        = new Set();
  userOrderedFeeds.forEach(f => {
    if (used.has(f.name)) return;
    const gn = LINKED_GROUPS.find(g => g.includes(f.name));
    if (gn) gn.forEach(n => used.add(n)); else used.add(f.name);
    settingsSet.push(f);
  });
  list.innerHTML = settingsSet.map(f => `
    <div class="setting-item" data-id="${f.id}" draggable="true">
      <span class="setting-label">${f.name}</span>
      <label class="switch"><input type="checkbox" ${f.enabled ? 'checked' : ''}><span class="slider"></span></label>
    </div>`).join('');
  setupDragAndDrop();
}

function setupDragAndDrop() {
  const list = document.getElementById('settings-list');
  let draggingItem = null;
  list.addEventListener('touchstart', e => {
    const item = e.target.closest('.setting-item');
    if (item && !e.target.closest('.switch')) { draggingItem = item; draggingItem.classList.add('dragging'); }
  }, { passive: false });
  list.addEventListener('touchmove', e => {
    if (!draggingItem) return;
    e.preventDefault();
    const touch  = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const item   = target?.closest('.setting-item');
    if (item && item !== draggingItem) {
      const rect = item.getBoundingClientRect();
      const mid  = rect.top + rect.height / 2;
      if (touch.clientY < mid) list.insertBefore(draggingItem, item);
      else list.insertBefore(draggingItem, item.nextElementSibling);
    }
  }, { passive: false });
  list.addEventListener('touchend', () => {
    if (draggingItem) { draggingItem.classList.remove('dragging'); draggingItem = null; }
  });
}

function buildWidgetPanel() {
  const body = document.getElementById('widgets-body');
  body.innerHTML = `
    <div class="widget-tip">Search <b>"Emon"</b> within your mobile device widget configuration interface to search for active widgets.</div>
    ${WIDGET_CATALOG.map(cat => `
      <div class="widget-category">${cat.category}</div>
      ${cat.items.map(w => `<div class="widget-row"><span class="widget-name">${w.name}</span><span class="widget-desc">${w.desc}</span></div>`).join('')}
    `).join('')}`;
}

// ─── Alert Thresholds ───────────────────────────────────────────────────────
const DEFAULT_ALERTS = [
  { feedName: 'Utility',     condition: '>',  value: 100,  label: 'Grid draw detected',     enabled: true  },
  { feedName: 'AC Volts',    condition: '<',  value: 200,  label: 'AC voltage low (<200V)',  enabled: true  },
  { feedName: 'Water Tank',  condition: '<',  value: 20,   label: 'Water tank critical',     enabled: true  },
  { feedName: 'Temperature', condition: '>',  value: 45,   label: 'Temperature high (>45°)', enabled: true  },
  { feedName: 'Solar',       condition: '<',  value: 50,   label: 'Solar offline',           enabled: false }
];
let alertConfig = [];

function loadAlerts() {
  try {
    const s = localStorage.getItem('alertConfig');
    alertConfig = s ? JSON.parse(s) : DEFAULT_ALERTS.map(a => ({...a}));
  } catch(e) { alertConfig = DEFAULT_ALERTS.map(a => ({...a})); }
}

function saveAlerts() {
  localStorage.setItem('alertConfig', JSON.stringify(alertConfig));
}

const _alertFired = {};

function checkAlerts(byName) {
  alertConfig.forEach((alert, i) => {
    if (!alert.enabled) return;
    const feed = byName.get(alert.feedName);
    if (!feed || feed.value == null) return;
    const triggered = alert.condition === '>' ? feed.value > alert.value : feed.value < alert.value;
    const key = `${i}_${alert.feedName}`;
    if (triggered && !_alertFired[key]) {
      _alertFired[key] = true;
      const msg = `${alert.label}: ${feed.value}${feed.unit || ''}`;
      showToast(msg, 'alert');
      
      if (window.Android && window.Android.showNotification) {
        window.Android.showNotification(alert.label, msg);
      } else if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
        new Notification(alert.label, { body: msg });
      }
    } else if (!triggered) {
      delete _alertFired[key];
    }
  });
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'toast';
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-show'), 10);
  setTimeout(() => { el.classList.remove('toast-show'); setTimeout(() => el.remove(), 400); }, 4000);
}

function openAlerts() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  document.getElementById('alerts-panel').classList.add('open');
  renderAlertList();
}

function renderAlertList() {
  const list = document.getElementById('alerts-list');
  list.innerHTML = alertConfig.map((a, i) => `
    <div class="alert-item">
      <div class="alert-row1">
        <label class="switch"><input type="checkbox" ${a.enabled ? 'checked' : ''} onchange="alertConfig[${i}].enabled=this.checked;saveAlerts()"><span class="slider"></span></label>
        <span class="alert-feed">${a.feedName}</span>
        <select class="alert-cond" onchange="alertConfig[${i}].condition=this.value;saveAlerts()">
          <option value=">" ${a.condition==='>'?'selected':''}>above</option>
          <option value="<" ${a.condition==='<'?'selected':''}>below</option>
        </select>
        <input type="number" class="alert-val" value="${a.value}" onchange="alertConfig[${i}].value=parseFloat(this.value);saveAlerts()">
      </div>
      <div class="alert-label-row">
        <input type="text" class="alert-label-inp" value="${a.label}" placeholder="Alert message"
          onchange="alertConfig[${i}].label=this.value;saveAlerts()">
        <button class="alert-del" onclick="alertConfig.splice(${i},1);saveAlerts();renderAlertList()">✕</button>
      </div>
    </div>`).join('');
}

function addAlert() {
  alertConfig.push({ feedName: 'Solar', condition: '>', value: 0, label: 'New alert', enabled: true });
  saveAlerts();
  renderAlertList();
}

const nativeCallbacks = {};
window.onNativeResponse = (id, res) => {
  if (nativeCallbacks[id]) { nativeCallbacks[id](res); delete nativeCallbacks[id]; }
};

function nativeFetch(url) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).substr(2, 9);
    nativeCallbacks[id] = resolve;
    if (window.Android && window.Android.fetchData) { 
      window.Android.fetchData(url, id); 
    } else {
      // Standard web fallback for GitHub hosting / local CORS-enabled requests
      fetch(url)
        .then(res => res.text())
        .then(text => resolve(text))
        .catch(err => resolve('ERROR: ' + err.message));
    }
  });
}

async function fetchEmon(id) {
  const url = `${PROXY_BASE}/?id=${id}`;
  const debugEnabled = document.getElementById('debug-toggle').checked;
  const debugEl = debugEnabled ? document.getElementById('debug-info') : null;
  try {
    if (debugEl) debugEl.innerHTML = `<b>URL:</b><br><small>${url}</small><br><b>Response:</b><br><span id="debug-res">Fetching...</span>`;
    const text = await nativeFetch(url);
    if (debugEl) { const el = document.getElementById('debug-res'); if (el) el.textContent = text || '(Empty)'; }
    if (text.startsWith('ERROR:')) throw new Error(text);
    if (text.includes('authentication failed') || text === 'false') throw new Error('Auth Failed');
    const val = parseFloat(text.replace(/['"]/g, ''));
    return isNaN(val) ? null : val;
  } catch (e) {
    document.getElementById('footer').textContent = 'Err: ' + e.message;
    if (debugEl) { const el = document.getElementById('debug-res'); if (el) el.textContent = 'ERROR: ' + e.message; }
    return null;
  }
}

function cardClass(type) {
  return type === 'watts' ? 'card card-watts' :
         type === 'units' ? 'card card-units' :
         type === 'env'   ? 'card card-env'   : 'card';
}

function renderResults(results) {
  const byName = new Map(results.map(r => [r.name, r]));
  const used   = new Set();

  results.forEach(f => { if (f.value != null) sparkPush(f.id, f.value); });
  if (!isCompact) { renderFlowDiagram(byName); } else { const wrap = document.getElementById('flow-svg-wrap'); if (wrap) wrap.innerHTML = ''; }
  updateCostCard(byName);

  const html = results.map(f => {
    if (used.has(f.name)) return '';
    const gn = LINKED_GROUPS.find(g => g.includes(f.name));
    if (gn) gn.forEach(n => used.add(n)); else used.add(f.name);

    if (gn && gn.includes('Solar') && gn.includes('Tot Load')) {
      const s  = byName.get('Solar');
      const l  = byName.get('Tot Load');
      const sv = byName.get('Solar V');
      const t  = byName.get('Solar Today');
      const tt = byName.get('Solar Total');
      return `<div class="card card-solar"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Solar</span>${sparkSvg(s?.id, '#facc15')}<span class="hero-val">${s?.value != null ? Math.round(s.value) : '---'}</span></div>
        <div style="flex:1;text-align:center"><span class="card-name">Solar V</span><span class="hero-val" style="color:var(--accent-env)">${sv?.value != null ? Math.round(sv.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">Tot Load</span>${sparkSvg(l?.id, '#f59e0b')}<span class="hero-val">${l?.value != null ? Math.round(l.value) : '---'}</span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Total</span><span class="linked-reading">${tt?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (gn && gn.includes('Breaker') && gn.includes('AC Volts')) {
      const b  = byName.get('Breaker');
      const ac = byName.get('AC Volts');
      const t  = byName.get('Breaker Today');
      const tt = byName.get('Breaker Total');
      return `<div class="card card-watts"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Breaker</span>${sparkSvg(b?.id, '#f59e0b')}<span class="hero-val">${b?.value != null ? Math.round(b.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">AC Input</span><span class="hero-val" style="color:var(--accent-env)">${ac?.value != null ? Math.round(ac.value) : '---'}<span style="font-size:11px;opacity:0.7;margin-left:2px">V</span></span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Total</span><span class="linked-reading">${tt?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (gn && gn.includes('Fridge') && gn.includes('Fridge2')) {
      const f1 = byName.get('Fridge');
      const f2 = byName.get('Fridge2');
      const t1 = byName.get('Fridge Today');
      const t2 = byName.get('Fridge2 Today');
      return `<div class="card card-watts"><div class="hero-header">
        <div style="flex:1"><span class="card-name">Fridge</span>${sparkSvg(f1?.id, '#f59e0b')}<span class="hero-val">${f1?.value != null ? Math.round(f1.value) : '---'}</span></div>
        <div style="flex:1;text-align:right"><span class="card-name">Fridge2</span>${sparkSvg(f2?.id, '#f59e0b')}<span class="hero-val">${f2?.value != null ? Math.round(f2.value) : '---'}</span></div>
      </div><div class="linked-values linked-values-pair">
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t1?.value?.toFixed(1) ?? '0.0'}</span></div>
        <div class="linked-value"><span>Today</span><span class="linked-reading">${t2?.value?.toFixed(1) ?? '0.0'}</span></div>
      </div></div>`;
    }

    if (f.name === 'Water Tank') {
      const pct = f.value;
      const pctColor = pct > 60 ? '#38bdf8' : pct > 30 ? '#f59e0b' : '#f87171';
      const status   = pct > 80 ? 'Full' : pct > 50 ? 'Good' : pct > 25 ? 'Low' : '⚠️ Critical';
      if (isCompact) {
        return `<div class="card card-env"><div class="card-header">
          <span class="card-name">Water Tank</span>
          <span style="font-weight:700;color:${pctColor}">${pct != null ? Math.round(pct) : '--'}% · ${status}</span>
        </div></div>`;
      }
      return `<div class="card card-env"><div class="card-header">
        <div class="tank-wrap">
          ${renderWaterTank(pct)}
          <div class="tank-info">
            <span class="card-name">Water Tank</span>
            <span class="tank-pct" style="color:${pctColor}">${pct != null ? Math.round(pct) : '--'}%</span>
            <span class="tank-label">${status}</span>
            ${sparkSvg(f.id, pctColor)}
          </div>
        </div>
      </div></div>`;
    }

    const group   = gn ? gn.map(n => byName.get(n)).filter(Boolean) : [f];
    const primary = group[0];
    if (!primary) return '';
    if (primary.name === 'Temperature' || primary.name === 'Humidity') {
      const t = byName.get('Temperature');
      const h = byName.get('Humidity');
      used.add('Temperature'); used.add('Humidity');
      return `<div class="card card-env"><div class="linked-values linked-values-pair">
        <div class="linked-value">
          <span>Temperature</span>
          <span class="val-env" style="font-weight:700">${t?.value?.toFixed(1) ?? '--'} °C ${sparkSvg(t?.id, '#10b981')}</span>
        </div>
        <div class="linked-value">
          <span>Humidity</span>
          <span class="val-env" style="font-weight:700">${h?.value?.toFixed(1) ?? '--'} % ${sparkSvg(h?.id, '#10b981')}</span>
        </div>
      </div></div>`;
    }

    const sparkColor = primary.type === 'watts' ? '#f59e0b' : primary.type === 'units' ? '#38bdf8' : '#10b981';
    return `<div class="${cardClass(primary.type)}"><div class="card-header">
      <span class="card-name">${primary.name}</span>
      <span class="card-value ${COLORS[primary.type]}">${primary.value != null ? (primary.unit === 'W' ? Math.round(primary.value) : primary.value.toFixed(1)) : '--'} <span style="font-size:11px;opacity:0.6">${primary.unit}</span>${sparkSvg(primary.id, sparkColor)}</span>
    </div>${group.length > 1 ? `<div class="linked-values linked-values-pair">${group.slice(1).map(r => `
      <div class="linked-value"><span>${r.name.includes('Today') ? 'Today' : 'Total'}</span><span class="linked-reading">${r.value != null ? r.value.toFixed(1) : '0.0'}</span></div>`).join('')}</div>` : ''}</div>`;
  }).join('');

  document.getElementById('list').innerHTML = html;
}

async function poll() {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin">↻</span>';
  try {
    const active  = userOrderedFeeds.filter(f => f.enabled);
    const results = await Promise.all(active.map(async f => ({ ...f, value: await fetchEmon(f.id) })));
    window.lastSolarActual = results.find(r => r.name === 'Solar')?.value || 0;
    renderResults(results);
    if (typeof updateMainPredicted === 'function') updateMainPredicted();
    const bm = new Map(results.map(r => [r.name, r]));
    checkAlerts(bm);
    document.getElementById('footer').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } finally {
    btn.disabled  = false;
    btn.textContent = 'Refresh';
    resetCountdown();
    _lastPollSuccess = Date.now();
  }
}

let _lastPollSuccess = Date.now();
setInterval(() => {
  const stale = Date.now() - _lastPollSuccess > 5 * 60 * 1000;
  const ind   = document.getElementById('stale-indicator');
  if (ind) ind.style.display = stale ? 'inline' : 'none';
}, 30000);

let countdownVal = autoRefreshSec;
let countdownTimer, refreshTimer;

function resetCountdown() {
  clearInterval(countdownTimer);
  clearTimeout(refreshTimer);
  countdownVal = autoRefreshSec;
  updateCountdown();
  countdownTimer = setInterval(() => {
    countdownVal--;
    updateCountdown();
    if (countdownVal <= 0) clearInterval(countdownTimer);
  }, 1000);
  refreshTimer = setTimeout(poll, autoRefreshSec * 1000);
}

function updateCountdown() {
  const el    = document.getElementById('countdown');
  const pb    = document.getElementById('progress-bar');
  const ratio = Math.max(0, countdownVal / autoRefreshSec);
  if (el) el.textContent = countdownVal > 0 ? `Next in ${countdownVal}s` : '';
  if (pb) pb.style.width = (ratio * 100).toFixed(1) + '%';
}

// ─── Solar Geometry / Lahore Configuration ──────────────────────────────────
const SOL_LAT = 31.5497;
const SOL_LON = 74.3436;
const SOL_TZ  = 5;

const SOLAR_DEFAULTS = {
  panelWatts: 580, panelCount: 6, tiltDeg: 10, azimuthDeg: 200,
  sysEff: 0.82, batteryKwh: 0, pkrPerUnit: 60, cloudPct: 0
};
let solarCfg = { ...SOLAR_DEFAULTS };

function loadSolarConfig() {
  try {
    const s = localStorage.getItem('solarCfg');
    if (s) solarCfg = { ...SOLAR_DEFAULTS, ...JSON.parse(s) };
  } catch(e) {}
  solarCfg.sysEff = SOLAR_DEFAULTS.sysEff;
  _syncSolarUI();
}

function _syncSolarUI() {
  const sum = document.getElementById('sol-cfg-summary');
  if (sum) sum.textContent = `${solarCfg.panelCount} × ${solarCfg.panelWatts}W · ${solarCfg.tiltDeg}° tilt · ${solarCfg.azimuthDeg}° az`;
  const fields = {
    'sp-count': solarCfg.panelCount, 'sp-watts': solarCfg.panelWatts,
    'sp-tilt': solarCfg.tiltDeg,     'sp-azimuth': solarCfg.azimuthDeg,
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
  const pct  = parseInt(val);
  const desc = pct === 0 ? '☀️ Clear' : pct < 25 ? '🌤 Mostly Clear' :
               pct < 50  ? '⛅ Partly Cloudy' : pct < 75 ? '🌥 Mostly Cloudy' : '☁ Overcast';
  lbl.textContent = `${desc} (${pct}%)`;
}

function applySolarConfig() {
  solarCfg.panelCount  = parseInt(document.getElementById('sp-count').value)   || SOLAR_DEFAULTS.panelCount;
  solarCfg.panelWatts  = parseInt(document.getElementById('sp-watts').value)   || SOLAR_DEFAULTS.panelWatts;
  solarCfg.tiltDeg     = parseFloat(document.getElementById('sp-tilt').value);
  solarCfg.azimuthDeg  = parseFloat(document.getElementById('sp-azimuth').value);
  solarCfg.batteryKwh  = parseFloat(document.getElementById('sp-battery').value) || 0;
  solarCfg.pkrPerUnit  = parseFloat(document.getElementById('sp-pkr').value)   || SOLAR_DEFAULTS.pkrPerUnit;
  solarCfg.cloudPct    = parseInt(document.getElementById('sp-cloud').value)   || 0;
  const effPct = parseFloat(document.getElementById('sp-syseff').value);
  solarCfg.sysEff = (!isNaN(effPct) && effPct > 0) ? effPct / 100 : SOLAR_DEFAULTS.sysEff;
  if (isNaN(solarCfg.tiltDeg))    solarCfg.tiltDeg    = SOLAR_DEFAULTS.tiltDeg;
  if (isNaN(solarCfg.azimuthDeg)) solarCfg.azimuthDeg = SOLAR_DEFAULTS.azimuthDeg;
  localStorage.setItem('solarCfg', JSON.stringify(solarCfg));
  _syncSolarUI();
  if (window.Android && window.Android.savePkrRate) {
    window.Android.savePkrRate(solarCfg.pkrPerUnit);
  }
  const activeTab = document.querySelector('.sol-tab.active')?.dataset.tab || 'today';
  if (activeTab === 'today') solRenderToday();
  else if (activeTab === 'day') { const dt = document.getElementById('sp-day-date').value; if (dt) solRenderDay(dt); }
  else if (activeTab === 'month') { const m = parseInt(document.getElementById('sp-month-m').value); const y = parseInt(document.getElementById('sp-month-y').value); solRenderMonth(y, m); }
}

async function fetchLahoreWeather() {
  const CACHE_KEY = 'lhr_weather_v1';
  const cached    = localStorage.getItem(CACHE_KEY);
  if (cached) {
    const obj = JSON.parse(cached);
    if (Date.now() - obj.ts < 30 * 60 * 1000) return obj.data;
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SOL_LAT}&longitude=${SOL_LON}&hourly=cloudcover,shortwave_radiation,precipitation_probability&daily=sunrise,sunset&timezone=Asia/Karachi&forecast_days=2`;
  try {
    const text = await nativeFetch(url);
    if (text.startsWith('ERROR')) return null;
    const data = JSON.parse(text);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch(e) { return null; }
}

function getWeatherForHour(weather, y, mo, d, hour) {
  if (!weather?.hourly?.time) return null;
  const target = `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00`;
  const idx    = weather.hourly.time.indexOf(target);
  if (idx === -1) return null;
  return { cloud: weather.hourly.cloudcover[idx], ghi: weather.hourly.shortwave_radiation[idx], rain: weather.hourly.precipitation_probability[idx] };
}

function _cloudFactor() { return 1.0 - (solarCfg.cloudPct / 100) * 0.90; }

function _R(d) { return d * Math.PI / 180; }
function _D(r) { return r * 180 / Math.PI; }
function _doy(y, mo, d) { return Math.floor((new Date(y, mo-1, d) - new Date(y, 0, 1)) / 86400000) + 1; }

function _solarPos(y, mo, d, localHour) {
  const doy = _doy(y, mo, d);
  const B   = (doy - 1) * 2 * Math.PI / 365;
  const EoT = 229.18 * (0.000075 + 0.001868*Math.cos(B) - 0.032077*Math.sin(B) - 0.014615*Math.cos(2*B) - 0.04089*Math.sin(2*B));
  const decl = 0.006918 - 0.399912*Math.cos(B) + 0.070257*Math.sin(B) - 0.006758*Math.cos(2*B) + 0.000907*Math.sin(2*B) - 0.002697*Math.cos(3*B) + 0.00148*Math.sin(3*B);
  const LSTM = SOL_TZ * 15;
  const TC   = (4 * (SOL_LON - LSTM) + EoT) / 60;
  const solHr = localHour + TC;
  const ha   = _R(15 * (solHr - 12));
  const latR = _R(SOL_LAT);
  const sinElev = Math.sin(latR)*Math.sin(decl) + Math.cos(latR)*Math.cos(decl)*Math.cos(ha);
  const elevR   = Math.asin(Math.max(-1, Math.min(1, sinElev)));
  const elevDeg = _D(elevR);
  if (elevDeg <= 0) return { elev: elevDeg, az: 180 };
  const cosAz  = (Math.sin(decl) - Math.sin(elevR)*Math.sin(latR)) / (Math.cos(elevR)*Math.cos(latR));
  const azBase = _D(Math.acos(Math.max(-1, Math.min(1, cosAz))));
  const azDeg  = ha >= 0 ? 360 - azBase : azBase;
  return { elev: elevDeg, az: (azDeg + 360) % 360 };
}

function _clearSky(elevDeg, doy) {
  if (elevDeg <= 0) return { ghi: 0, dni: 0, dhi: 0 };
  const elevR = _R(elevDeg);
  const Iext  = 1367 * (1 + 0.033*Math.cos(_R(360*doy/365)));
  const AM    = 1 / (Math.sin(elevR) + 0.50572 * Math.pow(elevDeg + 6.07995, -1.6364));
  const DNI   = Iext * Math.pow(0.7, Math.pow(AM, 0.678));
  const DHI   = 0.1 * Iext * Math.sin(elevR);
  const GHI   = DNI * Math.sin(elevR) + DHI;
  return { ghi: Math.max(0, GHI), dni: Math.max(0, DNI), dhi: Math.max(0, DHI) };
}

function _poa(elevDeg, azDeg, tiltDeg, panelAzDeg, irr) {
  if (elevDeg <= 0 || irr.ghi === 0) return 0;
  const elevR   = _R(elevDeg);
  const tiltR   = _R(tiltDeg);
  const diffAzR = _R(azDeg - panelAzDeg);
  const cosAOI  = Math.sin(elevR)*Math.cos(tiltR) + Math.cos(elevR)*Math.cos(diffAzR)*Math.sin(tiltR);
  const beam    = cosAOI > 0 ? irr.dni * cosAOI : 0;
  const sky     = irr.dhi * (1 + Math.cos(tiltR)) / 2;
  const ground  = irr.ghi * 0.2 * (1 - Math.cos(tiltR)) / 2;
  return Math.max(0, beam + sky + ground);
}

function _sunriseSunset(y, mo, d) {
  let rise = 6, set = 18;
  for (let h = 4; h <= 8; h += 0.1)  { if (_solarPos(y, mo, d, h).elev > 0)   { rise = h; break; } }
  for (let h = 16; h <= 21; h += 0.1) { if (_solarPos(y, mo, d, h).elev <= 0) { set  = h; break; } }
  return { rise, set };
}

async function _calcHourly(y, mo, d) {
  const doy   = _doy(y, mo, d);
  const peakW = solarCfg.panelWatts * solarCfg.panelCount;
  const weather = await fetchLahoreWeather();
  const cloud   = _cloudFactor();
  const out = [];
  let weatherAvailable = false; 
  for (let h = 5; h <= 18; h++) {
    const pos  = _solarPos(y, mo, d, h + 0.5);
    let watt = 0, cloudHour = solarCfg.cloudPct, rainHour = 0;
    const wf = getWeatherForHour(weather, y, mo, d, h);
    if (wf && wf.ghi != null) {
      weatherAvailable = true; 
      const ghi = wf.ghi;
      cloudHour = wf.cloud; rainHour = wf.rain;
      let dni = 0, dhi = 0;
      if (pos.elev > 3 && ghi > 5) {
        const elevR = _R(pos.elev);
        const sinElev = Math.sin(elevR);
        const doy2 = _doy(y, mo, d);
        const Iext = 1367 * (1 + 0.033 * Math.cos(_R(360 * doy2 / 365)));
        const kt = Math.min(1.0, ghi / (Iext * sinElev));
        const df = kt <= 0.22 ? 1.0 - 0.09 * kt
                 : kt <= 0.80 ? 0.9511 - 0.1604*kt + 4.388*kt*kt - 16.638*kt*kt*kt + 12.336*kt*kt*kt*kt
                 : 0.165;
        dhi = df * ghi;
        dni = sinElev > 0.01 ? Math.max(0, (ghi - dhi) / sinElev) : 0;
      } else {
        dhi = ghi * 0.15;
      }
      const poa = _poa(pos.elev, pos.az, solarCfg.tiltDeg, solarCfg.azimuthDeg, { ghi, dni, dhi });
      watt = Math.max(0, (poa / 1000) * peakW * solarCfg.sysEff);
    } else {
      const irr = _clearSky(pos.elev, doy);
      const poa = _poa(pos.elev, pos.az, solarCfg.tiltDeg, solarCfg.azimuthDeg, irr);
      watt = Math.max(0, (poa / 1000) * peakW * solarCfg.sysEff * cloud);
    }
    out.push({ h, elev: pos.elev, az: pos.az, watt, cloud: cloudHour, rain: rainHour });
  }
  return { hourly: out, weatherAvailable }; 
}

async function _calcDayKwh(y, mo, d) {
  const { hourly } = await _calcHourly(y, mo, d); 
  return hourly.reduce((s, x) => s + x.watt, 0) / 1000;
}

async function _calcMonth(y, mo) {
  const days = new Date(y, mo, 0).getDate();
  let total = 0;
  const daily = [];
  for (let d = 1; d <= days; d++) {
    const kwh = await _calcDayKwh(y, mo, d);
    daily.push({ d, kwh }); total += kwh;
  }
  return { total, daily };
}

function _calcBattery(hourly, battKwh) {
  if (!battKwh || battKwh <= 0) return null;
  const avgLoadW = 500;
  let soc = battKwh * 0.5 * 1000;
  const maxWh = battKwh * 1000;
  const records = [];
  let fullTime = null, emptyTime = null;
  for (const h of hourly) {
    const net = h.watt - avgLoadW;
    soc = Math.max(0, Math.min(maxWh, soc + net));
    const pct = (soc / maxWh) * 100;
    if (!fullTime  && pct >= 98) fullTime  = h.h;
    if (!emptyTime && pct <= 2)  emptyTime = h.h;
    records.push({ h: h.h, pct });
  }
  return { records, fullTime, emptyTime, maxWh };
}

function _barColor(watt, maxWatt) {
  if (watt <= 0) return { bg: 'transparent', glow: 'transparent' };
  const ratio = watt / maxWatt;
  if (ratio < 0.33) return { bg: 'linear-gradient(90deg,#854d0e,#ca8a04)', glow: '#ca8a04' };
  if (ratio < 0.66) return { bg: 'linear-gradient(90deg,#92400e,#f59e0b)', glow: '#f59e0b' };
  if (ratio < 0.85) return { bg: 'linear-gradient(90deg,#b45309,#f97316)', glow: '#f97316' };
  return { bg: 'linear-gradient(90deg,#c2410c,#ef4444)', glow: '#ef4444' };
}

function _renderSunArc(y, mo, d, container) {
  const { rise, set } = _sunriseSunset(y, mo, d);
  const now     = new Date();
  const isToday = (y === now.getFullYear() && mo === now.getMonth()+1 && d === now.getDate());
  const currentH = isToday ? now.getHours() + now.getMinutes()/60 : null;
  const W  = 340, H = 90, PAD = 26;
  const arc_w = W - PAD*2;
  const cx = W/2, cy = H - 8, rx = arc_w/2, ry = H - 18;
  const x1 = PAD, x2 = W - PAD;

  function timeToX(h) { return PAD + ((h - rise) / (set - rise)) * arc_w; }

  let ticks = '';
  for (let h = Math.ceil(rise); h <= Math.floor(set); h += 2) {
    const x = timeToX(h);
    if (x < PAD + 10 || x > W - PAD - 10) continue;
    ticks += `<line x1="${x.toFixed(1)}" y1="${cy}" x2="${x.toFixed(1)}" y2="${cy+5}" stroke="#3f3f46" stroke-width="1"/>
              <text x="${x.toFixed(1)}" y="${cy+14}" text-anchor="middle" fill="#52525b" font-size="8">${_pad2(h)}</text>`;
  }

  let sunEl = '';
  if (currentH !== null && currentH >= rise && currentH <= set) {
    const t     = (currentH - rise) / (set - rise);
    const angle = Math.PI - t * Math.PI;
    const sx    = (cx + rx * Math.cos(angle)).toFixed(1);
    const sy    = (cy - ry * Math.sin(angle)).toFixed(1);
    sunEl = `<circle cx="${sx}" cy="${sy}" r="12" fill="#facc15" opacity="0.15"/>
      <circle cx="${sx}" cy="${sy}" r="7" fill="#facc15" opacity="0.9"/>
      <circle cx="${sx}" cy="${sy}" r="3" fill="#fff"/>
      <line x1="${sx}" y1="${cy}" x2="${sx}" y2="${parseFloat(sy)+4}" stroke="#facc15" stroke-width="1" stroke-dasharray="2,3" opacity="0.4"/>`;
  }

  const riseLabel   = `<text x="${PAD}" y="${cy+26}" fill="#52525b" font-size="9" text-anchor="middle">↑${_fmtH(rise)}</text>`;
  const setLabel    = `<text x="${W-PAD}" y="${cy+26}" fill="#52525b" font-size="9" text-anchor="middle">↓${_fmtH(set)}</text>`;
  const dayLen      = set - rise;
  const dayHr       = Math.floor(dayLen);
  const dayMin      = Math.round((dayLen - dayHr) * 60);
  const centerLabel = `<text x="${W/2}" y="${cy+26}" fill="#3f3f46" font-size="8" text-anchor="middle">${dayHr}h ${dayMin}m daylight</text>`;

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#78350f" stop-opacity="0.5"/>
      <stop offset="40%" stop-color="#f59e0b" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#facc15" stop-opacity="1"/>
      <stop offset="80%" stop-color="#f59e0b" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#78350f" stop-opacity="0.5"/>
    </linearGradient></defs>
    <line x1="${PAD}" y1="${cy}" x2="${W-PAD}" y2="${cy}" stroke="#27272a" stroke-width="1"/>
    <path d="M ${x1} ${cy} A ${rx} ${ry} 0 0 1 ${x2} ${cy}" fill="none" stroke="url(#arcGrad)" stroke-width="2" stroke-linecap="round"/>
    ${ticks}${riseLabel}${setLabel}${centerLabel}${sunEl}
  </svg>`;
}

function _fmtH(h)  { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${_pad2(hh)}:${_pad2(mm)}`; }
function _pad2(n)  { return String(Math.floor(n)).padStart(2, '0'); }
function _fmtKwp() { return ((solarCfg.panelWatts * solarCfg.panelCount) / 1000).toFixed(2); }
const _MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const _MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function _renderHourlyBars(hourly, container, actualWatts) {
  if (!container) return;
  const maxW   = Math.max(...hourly.map(h => h.watt), 1);
  const sorted = [...hourly].sort((a, b) => b.watt - a.watt);
  const peakHours = new Set(sorted.slice(0, 4).map(h => h.h));

  container.innerHTML = hourly.map(h => {
    const pct  = (h.watt / maxW * 100).toFixed(1);
    const zero = h.watt < 1;
    const wStr = zero ? '-' : Math.round(h.watt) + 'W';
    const color = _barColor(h.watt, maxW);
    const isPeak = peakHours.has(h.h);
    const wColor = isPeak ? '#fca5a5' : h.watt > maxW * 0.66 ? '#f97316' : !zero ? '#facc15' : '#3f3f46';

    let rightStr, rightColor;
    if (actualWatts && actualWatts[h.h] !== undefined) {
      const actW = actualWatts[h.h];
      rightStr   = Math.round(actW) + 'W';
      rightColor = actW > h.watt * 1.05 ? '#4ade80' : actW < h.watt * 0.95 ? '#f87171' : '#38bdf8';
    } else {
      rightStr   = zero ? '-' : (h.watt / 1000).toFixed(2);
      rightColor = '#71717a';
    }

    const rain    = h.rain ?? 0;
    const rainStr = rain > 5 ? `🌧${Math.round(rain)}%` : '';
    const rainColor = rain > 70 ? '#60a5fa' : rain > 40 ? '#38bdf8' : '#71717a';

    let dotHtml = '';
    if (actualWatts && actualWatts[h.h] !== undefined) {
      const actW   = actualWatts[h.h];
      const actPct = Math.min(100, (actW / maxW * 100));
      const dotClass = actW > h.watt * 1.05 ? 'over' : actW < h.watt * 0.95 ? 'under' : '';
      dotHtml = `<div class="sol-h-actual-dot ${dotClass}" style="left:calc(${actPct.toFixed(1)}% - 5px)" title="Actual: ${Math.round(actW)}W"></div>`;
    }

    return `<div class="sol-h-row${isPeak ? ' peak-hour' : ''}">
      <span class="sol-h-time">${_pad2(h.h)}:00</span>
      <div class="sol-h-bar-wrap">
        <div class="sol-h-bar${zero?' zero':''}" style="width:0%;background:${color.bg};--glow:${color.glow}"></div>
        ${dotHtml}
      </div>
      <span class="sol-h-rain" style="color:${rainColor}">${rainStr}</span>
      <span class="sol-h-w" style="color:${wColor}">${wStr}</span>
      <span class="sol-h-kwh" style="color:${rightColor}">${rightStr}</span>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.sol-h-bar:not(.zero)').forEach((bar, i) => {
      const hw = hourly[i];
      if (!hw) return;
      const finalPct = (hw.watt / maxW * 100).toFixed(1) + '%';
      setTimeout(() => { bar.style.width = finalPct; }, i * 25);
    });
  });
}

function _daySummaryHtml(hourly, titleHtml, extraRowsHtml = '') {
  const totalKwh  = hourly.reduce((s, h) => s + h.watt, 0) / 1000;
  const peakWatt  = Math.max(...hourly.map(h => h.watt));
  const peakHour  = hourly.find(h => h.watt === peakWatt);
  const peakTime  = peakHour ? `${_pad2(peakHour.h)}:00` : '--';
  const sorted    = [...hourly].sort((a, b) => b.watt - a.watt).slice(0, 4);
  const peakFrom  = Math.min(...sorted.map(h => h.h));
  const peakTo    = Math.max(...sorted.map(h => h.h)) + 1;

  return `<div class="sol-summary">
    <div class="sol-sum-main" style="margin-bottom:12px">
      <div class="sol-sum-left">
        <div><span class="sol-sum-kwh" id="sol-sum-kwh-val">${totalKwh.toFixed(2)}</span><span class="sol-sum-unit">kWh</span></div>
        <div class="sol-sum-sub">${titleHtml}</div>
        <div class="sol-peak-badge">🔥 Best hours: ${_pad2(peakFrom)}:00–${_pad2(peakTo)}:00</div>
      </div>
      <div class="sol-sum-right">
        Peak: <b>${Math.round(peakWatt)}W</b> @ ${peakTime}<br>
        ${_fmtKwp()} kWp · ${solarCfg.panelCount}×${solarCfg.panelWatts}W<br>
        ☁ ${solarCfg.cloudPct}% cloud · eff ${Math.round(solarCfg.sysEff*100)}%
      </div>
    </div>
    <div class="sol-rows-container"></div>
  </div>`;
}

function _renderBatteryCard(hourly) {
  const card = document.getElementById('sol-battery-card');
  if (!card) return;
  const batt = _calcBattery(hourly, solarCfg.batteryKwh);
  if (!batt) { card.classList.remove('visible'); return; }
  card.classList.add('visible');
  const now  = new Date();
  const curH = now.getHours();
  const rec  = batt.records.find(r => r.h === curH) || batt.records[batt.records.length - 1];
  const pct  = rec ? rec.pct : 0;
  const fillClass = pct < 20 ? 'low' : pct < 50 ? 'mid' : '';
  card.innerHTML = `
    <div class="sol-battery-title">🔋 Battery Estimate — ${solarCfg.batteryKwh} kWh capacity</div>
    <div class="sol-battery-track">
      <div class="sol-battery-fill ${fillClass}" style="width:${pct.toFixed(0)}%"></div>
      <span class="sol-battery-pct">${pct.toFixed(0)}%</span>
    </div>
    <div class="sol-battery-times">
      <span>${batt.fullTime  ? `⚡ Full @ ${_pad2(batt.fullTime)}:00`  : 'May not fully charge today'}</span>
      <span>${batt.emptyTime ? `🌙 Empty @ ${_pad2(batt.emptyTime)}:00` : 'Stays charged all day'}</span>
    </div>
    <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Est. with ~500W avg load · starts at 50% SOC</div>`;
}

function _legendHtml(hasActuals) {
  const actualLegend = hasActuals ? `
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#38bdf8;border-radius:50%"></div><span>Actual ≈ pred</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#4ade80;border-radius:50%"></div><span>Actual &gt; pred</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#f87171;border-radius:50%"></div><span>Actual &lt; pred</span></div>` : '';
  return `<div class="sol-legend">
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#ca8a04"></div><span>Low</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#f59e0b"></div><span>Mid</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#f97316"></div><span>High</span></div>
    <div class="sol-legend-item"><div class="sol-legend-dot" style="background:#ef4444"></div><span>🔥 Peak</span></div>
    ${actualLegend}
  </div>`;
}

async function _fetchTodayActuals(y, mo, d) {
  const solarFeed = userOrderedFeeds.find(f => f.name === 'Solar');
  const solarId   = solarFeed ? solarFeed.id : '499380';

  const startOfDay = new Date(y, mo-1, d, 0, 0, 0).getTime();
  const endOfDay   = new Date(y, mo-1, d, 23, 59, 59).getTime();
  const url        = `${PROXY_BASE}/feed/data.json?ids=${solarId}&start=${startOfDay}&end=${endOfDay}&skipmissing=0&average=1&delta=0&interval=3600`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return null;
    const arr  = JSON.parse(text);
    if (!arr || arr.length === 0) return null;
    const data   = arr[0]?.data || [];
    const result = {};
    for (const pt of data) {
      if (pt[1] === null || pt[1] === undefined) continue;
      const h = new Date(pt[0]).getHours();
      result[h] = pt[1];
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch(e) { return null; }
}

async function _fetchDayBreakerKwh(y, mo, d) {
  const breakerTodayFeed = userOrderedFeeds.find(f => f.name === 'Breaker Today');
  const feedId = breakerTodayFeed ? breakerTodayFeed.id : '499413';
  
  const startOfDay = new Date(y, mo-1, d, 0, 0, 0).getTime();
  const endOfDay   = new Date(y, mo-1, d, 23, 59, 59).getTime();
  const url        = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startOfDay}&end=${endOfDay}&skipmissing=0&average=1&delta=0&interval=3600`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return null;
    const arr  = JSON.parse(text);
    if (!arr || arr.length === 0) return null;
    const data = arr[0]?.data || [];
    const values = data.map(pt => pt[1]).filter(v => v !== null && v !== undefined);
    if (values.length === 0) return null;
    return Math.max(...values);
  } catch(e) { return null; }
}

async function _getBreakerKwh(y, mo, d, isToday) {
  const breakerTodayFeed = userOrderedFeeds.find(f => f.name === 'Breaker Today');
  const feedId = breakerTodayFeed ? breakerTodayFeed.id : '499413';
  if (isToday) {
    return await fetchEmon(feedId);
  } else {
    return await _fetchDayBreakerKwh(y, mo, d);
  }
}

let _navOffset = 0;

function _navDate() {
  const d = new Date();
  d.setDate(d.getDate() + _navOffset);
  return { y: d.getFullYear(), mo: d.getMonth()+1, d: d.getDate(), date: d };
}

function _updateNavLabel() {
  const { date } = _navDate();
  const lbl = document.getElementById('sol-nav-label');
  const sub = document.getElementById('sol-nav-sub');
  if (!lbl) return;
  if (_navOffset === 0)      lbl.textContent = 'Today';
  else if (_navOffset === -1) lbl.textContent = 'Yesterday';
  else if (_navOffset === 1)  lbl.textContent = 'Tomorrow';
  else lbl.textContent = date.toLocaleDateString('en-PK', { weekday:'short', day:'numeric', month:'short' });
  if (sub) sub.textContent = date.toLocaleDateString('en-PK', { day:'numeric', month:'long', year:'numeric' });
  const nextBtn = document.getElementById('sol-next-day');
  if (nextBtn) nextBtn.style.opacity = _navOffset >= 7 ? '0.3' : '1';
}

function _renderHeatmap(daily, container) {
  if (!container || !daily || daily.length === 0) return;
  const maxKwh = Math.max(...daily.map(d => d.kwh), 0.1);
  const DOW = ['M','T','W','T','F','S','S'];
  const headers = DOW.map(d => `<div class="sol-heatmap-label">${d}</div>`).join('');

  const firstDate = daily[0].date || new Date(daily[0].y, daily[0].mo - 1, daily[0].d || 1);
  const startDow  = ((firstDate.getDay() + 6) % 7);
  const blanks    = Array(startDow).fill(`<div></div>`).join('');

  const cells = daily.map(({ kwh, d, date }) => {
    const ratio = kwh / maxKwh;
    const bg = kwh < 0.01
      ? '#1c1c1f'
      : `hsl(${120 - ratio * 100}, 70%, ${15 + ratio * 25}%)`;
    const label = d ?? (date ? date.getDate() : '');
    return `<div class="sol-heatmap-day" style="background:${bg}" title="${kwh.toFixed(2)} kWh">
      <span style="color:rgba(255,255,255,${ratio > 0.3 ? 0.9 : 0.4});font-size:9px">${label}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="sol-heatmap-legend">
      <span style="font-size:10px;color:var(--text-muted)">Yield:</span>
      <div class="sol-heatmap-legend-track">
        ${[0,0.25,0.5,0.75,1].map(r => `<div class="sol-heatmap-legend-sq" style="background:hsl(${120 - r*100},70%,${15+r*25}%)"></div>`).join('')}
      </div>
      <span style="font-size:10px;color:var(--text-muted)">Low → High</span>
    </div>
    <div class="sol-heatmap" style="grid-template-columns:repeat(7,1fr)">
      ${headers}${blanks}${cells}
    </div>`;
}

function updateSolarNow(hourly) {
  try {
    const elW = document.getElementById('sol-now-watt');
    if (!elW) return;
    const now = new Date();
    const cur = now.getHours() + now.getMinutes()/60;
    let watt = 0, cloud = 0;

    const firstHour = hourly[0]?.h ?? 5;
    const lastHour = hourly[hourly.length - 1]?.h ?? 18;

    if (cur >= lastHour + 1 || cur < firstHour) {
      watt = 0;
      cloud = hourly[hourly.length - 1]?.cloud ?? 0;
    } else {
      for (let i=0; i<hourly.length; i++) {
        const h0 = hourly[i], h1 = hourly[i+1];
        if (h0.h <= cur && (!h1 || h1.h > cur)) {
          if (h1) {
            const t = Math.max(0, Math.min(1, (cur - h0.h)/(h1.h - h0.h)));
            watt = h0.watt + t*(h1.watt - h0.watt);
            cloud = (h0.cloud||0) + t*((h1.cloud||0)-(h0.cloud||0));
          } else { 
            const t = Math.max(0, Math.min(1, cur - h0.h));
            watt = h0.watt * (1 - t);
            cloud = h0.cloud||0; 
          }
          break;
        }
      }
    }

    elW.textContent = Math.round(watt);
    const elT = document.getElementById('sol-now-time');
    const elC = document.getElementById('sol-now-cloud');
    if (elT) elT.textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (elC) elC.textContent = '☁ ' + Math.round(cloud) + '%';
  } catch(e){}
}

async function solRenderToday() {
  const { y, mo, d, date } = _navDate();
  const isToday = _navOffset === 0;
  const isPast  = _navOffset < 0;
  const out     = document.getElementById('sol-today-out');
  if (!out) return;

  _updateNavLabel();
  out.innerHTML = '<div class="sol-loading">Calculating…</div>';

  const { hourly, weatherAvailable } = await _calcHourly(y, mo, d); 
  const arcWrap   = document.getElementById('sol-arc-today');
  if (arcWrap) _renderSunArc(y, mo, d, arcWrap);

  const avgCloud  = Math.round(hourly.reduce((s,x)=>s+(x.cloud||0),0)/hourly.length);
  const maxRain   = Math.round(Math.max(...hourly.map(x=>x.rain||0)));
  solarCfg.cloudPct = avgCloud;
  _updateCloudLabel(avgCloud);
  const cloudEl = document.getElementById('sp-cloud');
  if (cloudEl) cloudEl.value = avgCloud;

  const weatherLabel = weatherAvailable? '· Live weather' : '· Clear-sky estimate'; 
  const titleHtml = isToday
    ? `Today · ${date.toLocaleDateString('en-PK',{day:'numeric',month:'short',year:'numeric'})} ${weatherLabel}`
    : `${date.toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'short',year:'numeric'})} ${weatherLabel}`;

  const nowCard = '<div class="sol-now-card" style="background:var(--bg-panel);border:1px solid var(--border);border-left:3px solid var(--accent-solar);border-radius:10px;padding:10px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;font-weight:700">Now · Predicted Solar</div><div style="font-size:28px;font-weight:800;color:var(--accent-solar);line-height:1.1"><span id="sol-now-watt">---</span> <span style="font-size:14px;font-weight:600">W</span></div></div><div style="text-align:right"><div style="font-size:10px;color:var(--text-muted)">Auto-updates 2 min</div><div id="sol-now-time" style="font-size:13px;font-weight:700;color:var(--text-main);margin-top:2px">--:--</div><div id="sol-now-cloud" style="font-size:10px;color:var(--text-muted);margin-top:2px"></div></div></div>';
  out.innerHTML = nowCard + _daySummaryHtml(hourly, titleHtml) +
                  _legendHtml(false) +
                  '<div class="sol-hourly" id="sol-today-bars"></div>';
  if (typeof updateSolarNow === 'function') updateSolarNow(hourly);

  _renderHourlyBars(hourly, document.getElementById('sol-today-bars'), null);
  if (isToday) _renderBatteryCard(hourly);

  const actualsPromise = (isToday || isPast) ? _fetchTodayActuals(y, mo, d) : Promise.resolve(null);
  const breakerPromise = _getBreakerKwh(y, mo, d, isToday);

  const [actuals, breakerKwh] = await Promise.all([actualsPromise, breakerPromise]);

  const rowsContainer = out.querySelector('.sol-rows-container');
  if (rowsContainer) {
    let rowsHtml = '';
    const totalKwh = hourly.reduce((s, h) => s + h.watt, 0) / 1000;
    const estSavings = (totalKwh * solarCfg.pkrPerUnit).toFixed(0);
    if (solarCfg.pkrPerUnit > 0) {
      rowsHtml += `
        <div class="sol-savings-row">
          <span class="sol-savings-label"> Est. savings</span>
          <span class="sol-savings-val">PKR ${estSavings}</span>
        </div>`;
    }

    if (actuals) {
      _renderHourlyBars(hourly, document.getElementById('sol-today-bars'), actuals);
      const legendEl = out.querySelector('.sol-legend');
      if (legendEl) legendEl.outerHTML = _legendHtml(true);

      const actualKwh    = Object.values(actuals).reduce((s, w) => s + w, 0) / 1000;
      const actualSaving = (actualKwh * solarCfg.pkrPerUnit).toFixed(0);
      const label        = isToday ? '⚡ Actual saving so far' : '⚡ Actual saving that day';

      const mainValEl = document.getElementById('sol-sum-kwh-val');
      if (mainValEl) {
          mainValEl.innerHTML = `${totalKwh.toFixed(2)} <span style="font-size:18px;color:var(--text-muted);font-weight:normal;margin:0 4px;">/</span> <span style="color:#38bdf8">${actualKwh.toFixed(2)}</span>`;
      }

      rowsHtml += `
        <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
          <span class="sol-savings-label">${label}</span>
          <span class="sol-savings-val" style="color:#4ade80">PKR ${actualSaving}</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${actualKwh.toFixed(2)} kWh actual · ${Object.keys(actuals).length} hrs recorded</div>`;
    }

    if (breakerKwh !== null && breakerKwh !== undefined && !isNaN(breakerKwh)) {
      const breakerPkr = (breakerKwh * solarCfg.pkrPerUnit).toFixed(0);
      rowsHtml += `
        <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
          <span class="sol-savings-label">🔌 Grid Import (Breaker)</span>
          <span class="sol-savings-val" style="color:#f87171">PKR ${breakerPkr}</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${breakerKwh.toFixed(2)} kWh imported</div>`;
    }

    if (isToday) {
      const monthData      = await _calcMonth(y, mo);
      const monthlySavings = (monthData.total * solarCfg.pkrPerUnit).toFixed(0);
      rowsHtml += `
        <div class="sol-sum-month" style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">
          <span class="sol-sum-mlabel">📅 ${_MONTH_SHORT[mo-1]} ${y} month estimate</span>
          <span class="sol-sum-mval">${monthData.total.toFixed(0)} kWh</span>
        </div>
        ${solarCfg.pkrPerUnit > 0 ? `
        <div class="sol-savings-row">
          <span class="sol-savings-label"> Est. month savings est.</span>
          <span class="sol-savings-val" style="color:#4ade80">PKR ${monthlySavings}</span>
        </div>` : ''}
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">🌤 Live: ${avgCloud}% clouds · 🌧 ${maxRain}% rain — Open-Meteo</div>`;
    } else {
      rowsHtml += `<div style="font-size:11px;color:var(--text-muted);margin-top:6px">🌤 Live: ${avgCloud}% clouds · 🌧 ${maxRain}% rain — Open-Meteo</div>`;
    }

    rowsContainer.innerHTML = rowsHtml;
  }
}

function _billingRange() {
  const now   = new Date();
  const day   = now.getDate();
  const endCal = new Date(now.getFullYear(), now.getMonth(), 25, 0, 0);
  if (day < 25) endCal.setMonth(endCal.getMonth());
  else endCal.setMonth(endCal.getMonth() + 1);
  const startCal = new Date(endCal);
  startCal.setMonth(startCal.getMonth() - 1);
  return { start: startCal, end: endCal };
}

async function solRenderBilling() {
  const out = document.getElementById('sol-billing-out');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Fetching billing cycle data…</div>';

  const { start, end }    = _billingRange();
  const effectiveEnd       = new Date(Math.min(end.getTime(), Date.now()));
  const solarId            = (userOrderedFeeds.find(f => f.name === 'Solar') ?? { id: '499380' }).id;

  const url = `${PROXY_BASE}/feed/data.json?ids=${solarId}&start=${start.getTime()}&end=${effectiveEnd.getTime()}&skipmissing=0&average=1&delta=0&interval=3600`;

  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) throw new Error(text || 'fetch failed');
    const arr  = JSON.parse(text);
    const data = arr?.[0]?.data || [];

    const ymd  = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dmy  = d => `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;

    const byDay = {};
    for (const pt of data) {
      if (pt[1] === null || pt[1] === undefined) continue;
      const k = ymd(new Date(pt[0]));
      byDay[k] = (byDay[k] || 0) + pt[1];
    }

    const days = [];
    const cur  = new Date(start);
    while (cur < effectiveEnd) {
      const k   = ymd(cur);
      const kwh = (byDay[k] || 0) / 1000;
      days.push({ date: new Date(cur), kwh, d: cur.getDate() });
      cur.setDate(cur.getDate() + 1);
    }

    const totalKwh    = days.reduce((s, d) => s + d.kwh, 0);
    const daysElapsed = days.length;
    const avgKwh      = daysElapsed > 0 ? totalKwh / daysElapsed : 0;
    const daysInCycle = Math.round((end - start) / 86400000);
    const projectedKwh = avgKwh * daysInCycle;
    const savings     = (totalKwh * solarCfg.pkrPerUnit).toFixed(0);
    const projSavings = (projectedKwh * solarCfg.pkrPerUnit).toFixed(0);
    const maxKwh      = Math.max(...days.map(d => d.kwh), 1);
    const bestDay     = days.reduce((a, b) => b.kwh > a.kwh ? b : a, days[0]);
    const rangeStr    = `${dmy(start)} → ${dmy(end)}`;

    const bars = days.map(({ date, kwh }) => {
      const pct     = (kwh / maxKwh * 100).toFixed(1);
      const isToday = ymd(date) === ymd(new Date());
      const barColor = isToday ? 'background:linear-gradient(90deg,#164e63,#facc15)' : '';
      return `<div class="sol-d-row">
        <span class="sol-d-day" style="${isToday?'color:var(--accent-solar);font-weight:700':''}">${String(date.getDate()).padStart(2,'0')}</span>
        <div class="sol-d-bar-wrap"><div class="sol-d-bar" style="width:${pct}%;${barColor}"></div></div>
        <span class="sol-d-kwh" style="${isToday?'color:var(--accent-solar)':''}">${kwh.toFixed(1)}</span>
      </div>`;
    }).join('');

    const heatmapData = days.map(({ date, kwh }) => ({ kwh, date, d: date.getDate() }));
    const heatmapWrap = document.createElement('div');
    _renderHeatmap(heatmapData, heatmapWrap);

    out.innerHTML = `
      <div class="sol-billing-card">
        <div class="sol-billing-title">⚡ Billing Cycle · ${rangeStr}</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px">
          <div>
            <span class="sol-billing-big">${totalKwh.toFixed(1)}</span>
            <span style="font-size:13px;color:var(--text-muted);margin-left:4px">kWh so far</span>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${daysElapsed} of ${daysInCycle} days</div>
          </div>
          <div style="text-align:right;font-size:11px;color:var(--text-muted);line-height:2">
            Avg/day <b style="color:var(--text-main)">${avgKwh.toFixed(1)} kWh</b><br>
            Best day <b style="color:var(--text-main)">${dmy(bestDay.date)}: ${bestDay.kwh.toFixed(1)} kWh</b>
          </div>
        </div>
        <div class="sol-billing-row"><span> Est. Savings so far</span><span style="color:#4ade80">PKR ${savings}</span></div>
        <div class="sol-billing-row"><span>📈 Projected full cycle</span><span style="color:var(--accent-kwh)">${projectedKwh.toFixed(0)} kWh</span></div>
        <div class="sol-billing-row"><span>📈 Projected savings</span><span style="color:#4ade80">PKR ${projSavings}</span></div>
      </div>
      <div id="heatmap-wrap"></div>
      <div class="sol-daily">${bars}</div>`;

    const hw = document.getElementById('heatmap-wrap');
    if (hw) hw.appendChild(heatmapWrap);

  } catch(e) {
    out.innerHTML = `<div class="sol-loading" style="color:#f87171">Failed to load: ${e.message}</div>`;
  }
}

async function solRenderDay(dateStr) {
  const out = document.getElementById('sol-day-out');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Calculating…</div>';
  const [y, mo, d] = dateStr.split('-').map(Number);
  const { hourly, weatherAvailable } = await _calcHourly(y, mo, d); 
  const dateObj = new Date(y, mo-1, d);
  const weatherLabel = weatherAvailable? '· Live weather' : '· Clear-sky estimate'; 
  const label = dateObj.toLocaleDateString('en-PK', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) + ' ' + weatherLabel;
  const arcWrap = document.getElementById('sol-arc-day');
  if (arcWrap) _renderSunArc(y, mo, d, arcWrap);
  out.innerHTML = _daySummaryHtml(hourly, label) +
                  _legendHtml(false) +
                  '<div class="sol-hourly" id="sol-day-bars"></div>';
  _renderHourlyBars(hourly, document.getElementById('sol-day-bars'), null);

  const actualsPromise = _fetchTodayActuals(y, mo, d);
  const breakerPromise = _getBreakerKwh(y, mo, d, false);

  const [actuals, breakerKwh] = await Promise.all([actualsPromise, breakerPromise]);

  const rowsContainer = out.querySelector('.sol-rows-container');
  if (rowsContainer) {
    let rowsHtml = '';
    const totalKwh = hourly.reduce((s, h) => s + h.watt, 0) / 1000;
    const estSavings = (totalKwh * solarCfg.pkrPerUnit).toFixed(0);
    if (solarCfg.pkrPerUnit > 0) {
      rowsHtml += `
        <div class="sol-savings-row">
          <span class="sol-savings-label"> Est. savings</span>
          <span class="sol-savings-val">PKR ${estSavings}</span>
        </div>`;
    }

    if (actuals) {
      _renderHourlyBars(hourly, document.getElementById('sol-today-bars'), actuals);
      const legendEl = out.querySelector('.sol-legend');
      if (legendEl) legendEl.outerHTML = _legendHtml(true);

      const actualKwh    = Object.values(actuals).reduce((s, w) => s + w, 0) / 1000;
      const actualSaving = (actualKwh * solarCfg.pkrPerUnit).toFixed(0);

      const mainValEl = document.getElementById('sol-sum-kwh-val');
      if (mainValEl) {
          mainValEl.innerHTML = `${totalKwh.toFixed(2)} <span style="font-size:18px;color:var(--text-muted);font-weight:normal;margin:0 4px;">/</span> <span style="color:#38bdf8">${actualKwh.toFixed(2)}</span>`;
      }

      rowsHtml += `
        <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
          <span class="sol-savings-label">⚡ Actual saving that day</span>
          <span class="sol-savings-val" style="color:#4ade80">PKR ${actualSaving}</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${actualKwh.toFixed(2)} kWh actual · ${Object.keys(actuals).length} hrs recorded</div>`;
    }

    if (breakerKwh !== null && breakerKwh !== undefined && !isNaN(breakerKwh)) {
      const breakerPkr = (breakerKwh * solarCfg.pkrPerUnit).toFixed(0);
      rowsHtml += `
        <div class="sol-savings-row" style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">
          <span class="sol-savings-label">🔌 Grid Import (Breaker)</span>
          <span class="sol-savings-val" style="color:#f87171">PKR ${breakerPkr}</span>
        </div>
        <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px">${breakerKwh.toFixed(2)} kWh imported</div>`;
    }

    rowsContainer.innerHTML = rowsHtml;
  }
}

async function solRenderMonth(y, mo) {
  const out = document.getElementById('sol-month-out');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Calculating…</div>';

  const data    = await _calcMonth(y, mo);
  const maxKwh  = Math.max(...data.daily.map(x => x.kwh), 1);
  const avgKwh  = data.total / data.daily.length;
  const maxDay  = data.daily.reduce((a, b) => b.kwh > a.kwh ? b : a);
  const monthlySavings = (data.total * solarCfg.pkrPerUnit).toFixed(0);

  const monthSummary = `
    <div class="sol-month-sum">
      <div>
        <span class="sol-month-total">${data.total.toFixed(0)}</span>
        <span style="font-size:13px;color:var(--text-muted);margin-left:4px">kWh</span>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${_MONTH_NAMES[mo-1]} ${y}</div>
        ${solarCfg.pkrPerUnit > 0 ? `<div style="font-size:13px;color:#4ade80;font-weight:700;margin-top:4px"> PKR ${monthlySavings}</div>` : ''}
      </div>
      <div class="sol-month-info">
        Avg/day <b>${avgKwh.toFixed(1)} kWh</b><br>
        Best day <b>${maxDay.d} ${_MONTH_SHORT[mo-1]} : ${maxDay.kwh.toFixed(1)} kWh</b><br>
        ${_fmtKwp()} kWp · ${solarCfg.panelCount}×${solarCfg.panelWatts}W<br>
        ☁ ${solarCfg.cloudPct}% cloud
      </div>
    </div>`;

  const bars = data.daily.map(({ d, kwh }) => {
    const pct = (kwh / maxKwh * 100).toFixed(1);
    return `<div class="sol-d-row">
      <span class="sol-d-day">${_pad2(d)}</span>
      <div class="sol-d-bar-wrap"><div class="sol-d-bar" style="width:${pct}%"></div></div>
      <span class="sol-d-kwh">${kwh.toFixed(1)}</span>
    </div>`;
  }).join('');

  const heatDailyData = data.daily.map(({ d, kwh }) => ({
    kwh, d,
    date: new Date(y, mo - 1, d)
  }));

  out.innerHTML = monthSummary + `<div id="sol-month-heatmap"></div>` + `<div class="sol-daily">${bars}</div>`;

  const heatEl = document.getElementById('sol-month-heatmap');
  if (heatEl) _renderHeatmap(heatDailyData, heatEl);
}

// ─── Scoped Detailed Billing Report Processor ──────────────────────────────
const EXPORT_FEEDS = [
  { id: "499380", name: "Solar",        isSolar:   true },
  { id: "499374", name: "Breaker",      isBreaker: true },
  { id: "499364", name: "Kenwood 1Ton" },
  { id: "499362", name: "Kenwood 1.5T" },
  { id: "499367", name: "Haier 1Ton" },
  { id: "499373", name: "Fridge 1" },
  { id: "541348", name: "Fridge 2" },
  { id: "499422", name: "PC",           isPc: true }
];

const EXPORT_DAY_START   = 7;
const EXPORT_DAY_END     = 16;
const EXPORT_NIGHT_START = 16;
const EXPORT_NIGHT_END   = 7;
const EXPORT_PC_DAY_START = 6;
const EXPORT_PC_DAY_END   = 17;

// Pakistan Standard Time (UTC+5) Date helper
function getKarachiDate(ms) {
  const date = new Date(ms);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', hour12: false
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return {
    year: parseInt(map.year) || date.getUTCFullYear(),
    month: parseInt(map.month) || (date.getUTCMonth() + 1),
    day: parseInt(map.day) || date.getUTCDate(),
    hour: parseInt(map.hour) || date.getUTCHours()
  };
}

function billingRangeFor(year, month) {
  const endLocal = new Date(Date.UTC(year, month - 1, 25, 0, 0, 0));
  const endMs = endLocal.getTime() - 5 * 3600 * 1000;
  
  const startLocal = new Date(Date.UTC(year, month - 2, 25, 0, 0, 0));
  const startMs = startLocal.getTime() - 5 * 3600 * 1000;
  
  return { startMs, endMs };
}

function currentHourMs() {
  const now = new Date();
  const local = getKarachiDate(now.getTime());
  const truncatedUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, 0, 0);
  const truncatedMs = truncatedUtc - 5 * 3600 * 1000;
  return truncatedMs + 3600 * 1000;
}

let reportCache = {};
function loadReportCache() {
  try {
    const json = localStorage.getItem('report_cache');
    reportCache = json ? JSON.parse(json) : {};
  } catch (e) {
    reportCache = {};
  }
}

function saveReportCache() {
  try {
    localStorage.setItem('report_cache', JSON.stringify(reportCache));
  } catch (e) {}
}

async function fetchWithCache(feedId, startMs, endMs) {
  const safeThresholdMs = endMs - (3 * 3600 * 1000);
  let fetchStartMs = startMs;
  
  if (!reportCache[feedId]) {
    reportCache[feedId] = {};
  }
  const feedCache = reportCache[feedId];
  
  let maxSafe = -1;
  for (const tsStr of Object.keys(feedCache)) {
    const ts = parseInt(tsStr);
    if (ts >= startMs && ts < safeThresholdMs && ts > maxSafe) {
      maxSafe = ts;
    }
  }
  if (maxSafe !== -1) {
    fetchStartMs = maxSafe;
  }
  
  const freshData = await fetchHourly(feedId, fetchStartMs, endMs);
  
  for (const [ts, val] of Object.entries(freshData)) {
    feedCache[ts] = val;
  }
  
  const result = {};
  for (const [tsStr, val] of Object.entries(feedCache)) {
    const ts = parseInt(tsStr);
    if (ts >= startMs && ts <= endMs) {
      result[ts] = val;
    }
  }
  return result;
}

async function fetchHourly(feedId, startMs, endMs) {
  const url = `${PROXY_BASE}/feed/data.json?ids=${feedId}&start=${startMs}&end=${endMs}&skipmissing=0&average=1&delta=0&interval=3600`;
  try {
    const text = await nativeFetch(url);
    if (!text || text.startsWith('ERROR')) return {};
    return parseHourlyData(text);
  } catch (e) {
    return {};
  }
}

function parseHourlyData(json) {
  const result = {};
  if (!json || json === 'false' || json === 'null') return result;
  try {
    const root = JSON.parse(json);
    if (!Array.isArray(root) || root.length === 0) return result;
    
    let data = (typeof root[0] === 'object' && root[0] !== null && root[0].data) ? root[0].data : root;
    for (const point of data) {
      if (!Array.isArray(point) || point.length < 2 || point[1] === null) continue;
      result[point[0]] = parseFloat(point[1]);
    }
  } catch (e) {}
  return result;
}

function sumByDay(data, startHour, endHour) {
  const result = {};
  const allDay = startHour === 0 && endHour === 24;
  const wrapsMidnight = startHour > endHour;

  for (const [timestampStr, watts] of Object.entries(data)) {
    const timestamp = parseInt(timestampStr);
    const local = getKarachiDate(timestamp);
    const hour = local.hour;
    
    const inPeriod = allDay || (wrapsMidnight 
      ? (hour >= startHour || hour < endHour) 
      : (hour >= startHour && hour < endHour));
      
    if (!inPeriod) continue;

    let effectiveYear = local.year;
    let effectiveMonth = local.month;
    let effectiveDay = local.day;

    if (wrapsMidnight && hour < endHour) {
      const d = new Date(timestamp);
      const prev = new Date(d.getTime() - 24 * 3600 * 1000);
      const prevLocal = getKarachiDate(prev.getTime());
      effectiveYear = prevLocal.year;
      effectiveMonth = prevLocal.month;
      effectiveDay = prevLocal.day;
    }

    const key = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-${String(effectiveDay).padStart(2, '0')}`;
    result[key] = (result[key] || 0) + watts;
  }
  return result;
}

function fmtKwh(wh) {
  const val = wh / 1000.0;
  return val < 0.005 ? "-" : val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPkr(pkr) {
  return pkr < 1.0 ? "-" : Math.round(pkr).toLocaleString('en-US');
}

function splitCell(units, pkr) {
  if (units === "-" && pkr === "-") return "-";
  return `<div class='cell-split'><span class='cell-left'>${units}</span><span class='cell-slash'>/</span><span class='cell-right'>${pkr}</span></div>`;
}

async function calculateDetailedReport() {
  const out = document.getElementById('usage-report-content');
  if (!out) return;
  out.innerHTML = '<div class="sol-loading">Loading report... Fetching historical feed data...</div>';

  const month = parseInt(document.getElementById('report-month-m').value);
  const year = parseInt(document.getElementById('report-month-y').value);
  if (!month || !year) {
    out.innerHTML = '<div class="sol-loading" style="color:#f87171">Please select a valid month and year.</div>';
    return;
  }

  try {
    loadReportCache();
    const { startMs, endMs } = billingRangeFor(year, month);
    const effectiveEnd = Math.min(endMs, currentHourMs());
    
    const fetchPromises = EXPORT_FEEDS.map(async (feed) => {
      const data = await fetchWithCache(feed.id, startMs, effectiveEnd);
      return { feed, data };
    });
    
    const results = await Promise.all(fetchPromises);
    saveReportCache();
    
    const feedData = {};
    results.forEach(r => {
      feedData[r.feed.id] = r.data;
    });
    
    const pkrRate = solarCfg?.pkrPerUnit ?? 60;
    renderDetailedReport(feedData, startMs, endMs, pkrRate);
    
  } catch (e) {
    out.innerHTML = `<div class="sol-loading" style="color:#f87171">Failed to calculate report: ${e.message}</div>`;
  }
}

function renderDetailedReport(feedData, startMs, endMs, pkrPerKwh) {
  const out = document.getElementById('usage-report-content');
  if (!out) return;

  const startLocal = getKarachiDate(startMs);
  const effectiveEndMs = Math.min(endMs, currentHourMs());
  const effEndLocal = getKarachiDate(effectiveEndMs);

  const dates = [];
  let cursor = new Date(startMs);
  let cursorLocal = getKarachiDate(cursor.getTime());
  let cursorDate = new Date(Date.UTC(cursorLocal.year, cursorLocal.month - 1, cursorLocal.day));
  const endDate = new Date(Date.UTC(effEndLocal.year, effEndLocal.month - 1, effEndLocal.day));
  
  while (cursorDate <= endDate) {
    const yr = cursorDate.getUTCFullYear();
    const mo = cursorDate.getUTCMonth() + 1;
    const dy = cursorDate.getUTCDate();
    dates.push(`${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`);
    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
  }

  const sums = {};
  for (const feed of EXPORT_FEEDS) {
    const ds = feed.isPc ? EXPORT_PC_DAY_START : EXPORT_DAY_START;
    const de = feed.isPc ? EXPORT_PC_DAY_END : EXPORT_DAY_END;
    const data = feedData[feed.id] || {};
    sums[feed.id] = {
      h24: sumByDay(data, 0, 24),
      day: sumByDay(data, ds, de),
      night: sumByDay(data, EXPORT_NIGHT_START, EXPORT_NIGHT_END)
    };
  }

  const solarFeed = EXPORT_FEEDS.find(f => f.isSolar);
  const breakerFeed = EXPORT_FEEDS.find(f => f.isBreaker);

  const solarByDay = {};
  const gridByDay = {};
  dates.forEach(d => {
    solarByDay[d] = sums[solarFeed.id].h24[d] || 0;
    gridByDay[d] = sums[breakerFeed.id].h24[d] || 0;
  });

  let sumSolarWh = 0;
  let sumGridWh = 0;
  Object.values(solarByDay).forEach(v => sumSolarWh += v);
  Object.values(gridByDay).forEach(v => sumGridWh += v);

  const totalSolarKwh = sumSolarWh / 1000.0;
  const gridImportKwh = sumGridWh / 1000.0;
  const withoutSolarKwh = totalSolarKwh + gridImportKwh;
  const coveragePct = withoutSolarKwh > 0 ? (totalSolarKwh / withoutSolarKwh * 100) : 0;
  const daysInCycle = Math.round((endMs - startMs) / 86400000.0);
  const avgSolar = dates.length > 0 ? (totalSolarKwh / dates.length) : 0;
  const avgGrid = dates.length > 0 ? (gridImportKwh / dates.length) : 0;

  let tableRows = '';
  tableRows += '<tr class=h1><th rowspan=2>Date</th>';
  for (const feed of EXPORT_FEEDS) {
    tableRows += feed.isSolar 
      ? `<th rowspan=2 class=dv>${feed.name}</th>` 
      : `<th colspan=3 class=dv>${feed.name}</th>`;
  }
  tableRows += `<th rowspan=2 class=tot>Solar+Breaker<div class='head-split'>kWh / Rs</div></th>`;
  tableRows += `<th rowspan=2 class=col-save>Solar Saved<div class='head-split'>kWh / Rs</div></th>`;
  tableRows += `<th rowspan=2 class=col-bill>Grid Bill<div class='head-split'>kWh / Rs</div></th></tr><tr class=h2>`;

  for (const feed of EXPORT_FEEDS) {
    if (!feed.isSolar) {
      tableRows += `<th class=c24>24hr</th><th class=cday>${feed.isPc ? "Day*" : "Day"}</th><th class='dv cnight'>Night</th>`;
    }
  }
  tableRows += '</tr>';

  const totals24 = {};
  const totalsDay = {};
  const totalsNight = {};
  EXPORT_FEEDS.forEach(f => {
    totals24[f.id] = 0;
    totalsDay[f.id] = 0;
    totalsNight[f.id] = 0;
  });

  let grandSaveKwh = 0;
  let grandSavePkr = 0;
  let grandGridKwh = 0;
  let grandBillPkr = 0;

  for (const date of dates) {
    const parts = date.split('-');
    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    tableRows += `<tr><td class=dt>${formattedDate}</td>`;
    
    let daySolarWh = 0;
    let dayBreakerWh = 0;
    
    for (const feed of EXPORT_FEEDS) {
      const s = sums[feed.id];
      const h24 = s.h24[date] || 0;
      const day = s.day[date] || 0;
      const night = s.night[date] || 0;
      
      totals24[feed.id] += h24;
      totalsDay[feed.id] += day;
      totalsNight[feed.id] += night;
      
      if (feed.isSolar) daySolarWh = h24;
      if (feed.isBreaker) dayBreakerWh = h24;
      
      if (feed.isSolar) {
        tableRows += `<td class='dv c24'>${fmtKwh(h24)}</td>`;
      } else {
        tableRows += `<td class=c24>${fmtKwh(h24)}</td><td class=cday>${fmtKwh(day)}</td><td class='dv cnight'>${fmtKwh(night)}</td>`;
      }
    }
    
    const saveKwh = daySolarWh / 1000.0;
    const billKwh = dayBreakerWh / 1000.0;
    const combinedKwh = (daySolarWh + dayBreakerWh) / 1000.0;
    const combinedPkr = combinedKwh * pkrPerKwh;
    
    grandSaveKwh += saveKwh;
    grandGridKwh += billKwh;
    grandSavePkr += saveKwh * pkrPerKwh;
    grandBillPkr += billKwh * pkrPerKwh;
    
    const combinedKwhStr = combinedKwh < 0.005 ? "-" : combinedKwh.toFixed(2);
    const saveKwhStr = saveKwh < 0.005 ? "-" : saveKwh.toFixed(2);
    const billKwhStr = billKwh < 0.005 ? "-" : billKwh.toFixed(2);
    
    tableRows += `<td class=tot>${splitCell(combinedKwhStr, fmtPkr(combinedPkr))}</td>`;
    tableRows += `<td class=col-save>${splitCell(saveKwhStr, fmtPkr(saveKwh * pkrPerKwh))}</td>`;
    tableRows += `<td class=col-bill>${splitCell(billKwhStr, fmtPkr(billKwh * pkrPerKwh))}</td></tr>`;
  }

  tableRows += `<tr class=tr><td class=dt>Total</td>`;
  for (const feed of EXPORT_FEEDS) {
    const t24 = totals24[feed.id];
    const tDay = totalsDay[feed.id];
    const tNight = totalsNight[feed.id];
    
    if (feed.isSolar) {
      tableRows += `<td class='dv c24'>${fmtKwh(t24)}</td>`;
    } else {
      tableRows += `<td class=c24>${fmtKwh(t24)}</td><td class=cday>${fmtKwh(tDay)}</td><td class='dv cnight'>${fmtKwh(tNight)}</td>`;
    }
  }

  const totalCombinedKwh = (totals24[solarFeed.id] + totals24[breakerFeed.id]) / 1000.0;
  const totalCombinedPkr = totalCombinedKwh * pkrPerKwh;
  tableRows += `<td class=tot>${splitCell(totalCombinedKwh.toFixed(2), fmtPkr(totalCombinedPkr))}</td>`;
  tableRows += `<td class=col-save>${splitCell(grandSaveKwh.toFixed(2), fmtPkr(grandSavePkr))}</td>`;
  tableRows += `<td class=col-bill>${splitCell(grandGridKwh.toFixed(2), fmtPkr(grandBillPkr))}</td></tr>`;

  const maxSolarVal = Math.max(...Object.values(solarByDay).map(v => v / 1000.0), 1.0);
  let heatHtml = '';
  for (const date of dates) {
    const kwh = solarByDay[date] / 1000.0;
    const ratio = kwh / maxSolarVal;
    const hue = Math.round(120 - ratio * 90);
    const lum = Math.round(18 + ratio * 28);
    const bg = kwh < 0.01 ? "#1e1e1f" : `hsl(${hue},65%,${lum}%)`;
    const dayNum = parseInt(date.substring(8));
    heatHtml += `<div class=hc style='background:${bg}' title="${kwh.toFixed(2)} kWh">${dayNum}</div>`;
  }

  const dmy = d => `${String(d.day).padStart(2,'0')}-${String(d.month).padStart(2,'0')}-${d.year}`;
  const rangeStr = `${dmy(startLocal)} → ${dmy(getKarachiDate(endMs))}`;

  out.innerHTML = `
    <div class="report-wrapper">
      <h3>Energy Usage - ${rangeStr}</h3>
      <p class="sub-hours">Day = 7am-4pm &nbsp;|&nbsp; Night = 4pm-7am &nbsp;|&nbsp; * PC Day = 6am-5pm</p>
      
      <div class="pkr-card">
        <div class="pkr-title">PKR Financial Summary &nbsp;·&nbsp; Rate: PKR ${pkrPerKwh.toFixed(0)} / kWh</div>
        <div class="pkr-grid">
          <div class="pkr-item pkr-save">
            <div class="pkr-item-label">Solar savings</div>
            <div class="pkr-item-val">PKR ${fmtPkr(totalSolarKwh * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${totalSolarKwh.toFixed(1)} kWh generated by solar</div>
          </div>
          <div class="pkr-item pkr-bill">
            <div class="pkr-item-label">Est. grid bill</div>
            <div class="pkr-item-val">PKR ${fmtPkr(gridImportKwh * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${gridImportKwh.toFixed(1)} kWh from Breaker</div>
          </div>
          <div class="pkr-item pkr-without">
            <div class="pkr-item-label">Without solar</div>
            <div class="pkr-item-val">PKR ${fmtPkr(withoutSolarKwh * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${withoutSolarKwh.toFixed(1)} kWh total consumption</div>
          </div>
          <div class="pkr-item pkr-avg">
            <div class="pkr-item-label">Avg saving / day</div>
            <div class="pkr-item-val">PKR ${fmtPkr(avgSolar * pkrPerKwh)}</div>
            <div class="pkr-item-sub">${avgSolar.toFixed(1)} kWh / day over ${dates.length} days</div>
          </div>
        </div>
        <div class="pkr-bar-wrap">
          <div class="pkr-bar-label">Solar covered</div>
          <div class="pkr-bar-track">
            <div class="pkr-bar-fill" style="width:${Math.min(100, coveragePct).toFixed(1)}%"></div>
          </div>
          <div class="pkr-bar-pct">${coveragePct.toFixed(0)}%</div>
        </div>
        
        <div class="pkr-proj-title">Full Cycle Estimates (Projected till 25th) &nbsp;·&nbsp; Cycle: ${daysInCycle.toFixed(0)} days (elapsed: ${dates.length})</div>
        <div class="pkr-proj-row">
          <div class="pkr-proj-col">
            <span class="pkr-proj-lbl">Est. Solar Gen</span>
            <span class="pkr-proj-val" style="color:#ca8a04">${(avgSolar * daysInCycle).toFixed(1)} kWh</span>
            <span class="pkr-proj-val" style="color:#ca8a04;margin-top:8px;font-size:12px">Value: PKR ${fmtPkr(avgSolar * daysInCycle * pkrPerKwh)}</span>
          </div>
          <div class="pkr-proj-col">
            <span class="pkr-proj-lbl">Est. Grid Import</span>
            <span class="pkr-proj-val" style="color:#B71C1C">${(avgGrid * daysInCycle).toFixed(1)} kWh</span>
            <span class="pkr-proj-val" style="color:#B71C1C;margin-top:8px;font-size:12px">Bill: PKR ${fmtPkr(avgGrid * daysInCycle * pkrPerKwh)}</span>
          </div>
        </div>
      </div>
      
      <h4>Solar yield heatmap (kWh/day)</h4>
      <div class="heat">${heatHtml}</div>
      
      <h4>Daily Detailed Consumption Log</h4>
      <div class="table-scroll">
        <table>${tableRows}</table>
      </div>
    </div>
  `;
}

// ─── Main View Prediction Loop ──────────────────────────────────────────────
window.lastSolarActual = window.lastSolarActual || 0;

async function updateMainPredicted() {
  try {
    const wrap = document.getElementById('pred-wrap');
    if (!wrap || typeof _calcHourly!== 'function') return;
    const now = new Date();
    const { hourly } = await _calcHourly(now.getFullYear(), now.getMonth()+1, now.getDate()); 
    const cur = now.getHours() + now.getMinutes()/60;
    let watt = 0, cloud = 0;

    const firstHour = hourly[0]?.h ?? 5;
    const lastHour = hourly[hourly.length - 1]?.h ?? 18;

    if (cur >= lastHour + 1 || cur < firstHour) {
      watt = 0;
      cloud = hourly[hourly.length - 1]?.cloud ?? 0;
    } else {
      for (let i=0; i<hourly.length; i++) {
        const h0 = hourly[i], h1 = hourly[i+1];
        if (h0.h <= cur && (!h1 || h1.h > cur)) {
          if (h1) {
            const t = Math.max(0, Math.min(1, (cur - h0.h)/(h1.h - h0.h)));
            watt = h0.watt + t*(h1.watt - h0.watt);
            cloud = (h0.cloud||0) + t*((h1.cloud||0)-(h0.cloud||0));
          } else {
            const t = Math.max(0, Math.min(1, cur - h0.h));
            watt = h0.watt * (1 - t);
            cloud = h0.cloud||0;
          }
          break;
        }
      }
    }

    document.getElementById('pred-watt').textContent = Math.round(watt);
    document.getElementById('pred-cloud').textContent = '☁ ' + Math.round(cloud) + '%';
    const vs = document.getElementById('pred-vs');
    if (window.lastSolarActual > 0) {
      const diff = window.lastSolarActual - watt;
      const pct = watt>10? Math.round(diff/watt*100) : 0;
      vs.textContent = 'vs actual ' + Math.round(window.lastSolarActual) + 'W (' + (diff>=0?'+':'') + pct + '%)';
      vs.style.color = Math.abs(pct)<10? '#4ade80' : Math.abs(pct)<25? '#f59e0b' : '#f87171';
    }
    wrap.style.display = '';
  } catch(e) { console.log(e); }
}

// Polling wrapper injection
const _origPoll = poll;
poll = async function() {
  await _origPoll();
  updateMainPredicted();
};

// ─── Initializer Bindings ───────────────────────────────────────────────────
document.getElementById('btn-solar').addEventListener('click', () => {
  document.getElementById('solar-panel').classList.add('open');
  const now = new Date();
  document.getElementById('sp-day-date').value   = now.toISOString().split('T')[0];
  document.getElementById('sp-month-m').value    = now.getMonth() + 1;
  document.getElementById('sp-month-y').value    = now.getFullYear();
  _navOffset = 0;
  solRenderToday();
});

document.getElementById('btn-solar-close').addEventListener('click', () => {
  document.getElementById('solar-panel').classList.remove('open');
});

document.getElementById('sol-prev-day').addEventListener('click', () => { _navOffset--; solRenderToday(); });
document.getElementById('sol-next-day').addEventListener('click', () => { if (_navOffset >= 7) return; _navOffset++; solRenderToday(); });

document.getElementById('sol-cfg-toggle').addEventListener('click', () => {
  const body  = document.getElementById('sol-cfg-body');
  const arrow = document.getElementById('sol-cfg-arrow');
  const open  = body.style.display === 'block';
  body.style.display    = open ? 'none' : 'block';
  arrow.style.transform = open ? '' : 'rotate(180deg)';
});

document.getElementById('sp-apply').addEventListener('click', applySolarConfig);
document.getElementById('sp-cloud').addEventListener('input', function() { _updateCloudLabel(this.value); });

document.querySelectorAll('.sol-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sol-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.sol-tab-content').forEach(c => c.classList.remove('active'));
    const name = tab.dataset.tab;
    document.getElementById('sol-tab-' + name).classList.add('active');
    if (name === 'today')   { _navOffset = 0; solRenderToday(); }
    if (name === 'billing') solRenderBilling();
  });
});

document.getElementById('sp-day-calc').addEventListener('click', () => {
  const dt = document.getElementById('sp-day-date').value;
  if (!dt) return;
  solRenderDay(dt);
});

document.getElementById('sp-month-calc').addEventListener('click', () => {
  const mo = parseInt(document.getElementById('sp-month-m').value);
  const y  = parseInt(document.getElementById('sp-month-y').value);
  if (!mo || !y) return;
  solRenderMonth(y, mo);
});

document.getElementById('btn-refresh').addEventListener('click', poll);
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-save').addEventListener('click', saveSettings);

document.getElementById('btn-view-report').addEventListener('click', () => {
  document.getElementById('usage-report-panel').classList.add('open');
  const now = new Date();
  document.getElementById('report-month-m').value = now.getMonth() + 1;
  document.getElementById('report-month-y').value = now.getFullYear();
  calculateDetailedReport();
});

// Event listener to save report as a PNG image (captures full table width)
    document.getElementById('btn-report-png').addEventListener('click', () => {
      const btn = document.getElementById('btn-report-png');
      const content = document.querySelector('#usage-report-content .report-wrapper');
      
      if (!content) {
        alert('Please calculate the report first before saving.');
        return;
      }
      
      btn.disabled = true;
      btn.textContent = 'Saving...';
      
      // 1. Create a temporary off-screen clone to bypass browser width limits and scrollbars
      const clone = content.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.width = 'max-content';
      clone.style.maxWidth = 'none';
      clone.style.height = 'auto';
      clone.style.zIndex = '-9999';
      clone.style.opacity = '1';       // Keep visible behind the screen layer for rendering
      clone.style.pointerEvents = 'none';
      
      // 2. Force the scroll wrapper inside the clone to be fully visible (no scrollbar)
      const cloneScroll = clone.querySelector('.table-scroll');
      if (cloneScroll) {
        cloneScroll.style.overflow = 'visible';
        cloneScroll.style.overflowX = 'visible';
        cloneScroll.style.width = 'max-content';
      }
      
      // 3. Let the table take up its natural maximum horizontal width
      const cloneTable = clone.querySelector('table');
      if (cloneTable) {
        cloneTable.style.width = 'max-content';
        cloneTable.style.minWidth = '900px';
      }
      
      document.body.appendChild(clone);
      
      // 4. Capture the fully expanded off-screen clone
      html2canvas(clone, {
        backgroundColor: '#121214', 
        scale: 2,                  // High resolution clarity
        logging: false,
        useCORS: true,
        width: clone.scrollWidth,  // Ensure full canvas width matching the table width
        height: clone.scrollHeight
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `EmonCMS_Detailed_Report_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Cleanup the off-screen clone
        document.body.removeChild(clone);
        
        btn.disabled = false;
        btn.textContent = 'Save PNG';
      }).catch(err => {
        console.error(err);
        if (clone.parentNode) {
          document.body.removeChild(clone);
        }
        alert('Failed to generate PNG image.');
        btn.disabled = false;
        btn.textContent = 'Save PNG';
      });
    });


    document.getElementById('btn-widgets').addEventListener('click', () => document.getElementById('widgets-panel').classList.add('open'));
    document.getElementById('btn-widgets-close').addEventListener('click', () => document.getElementById('widgets-panel').classList.remove('open'));
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-compact').addEventListener('click', toggleCompact);
    document.getElementById('btn-alerts').addEventListener('click', openAlerts);
    document.getElementById('btn-alerts-close').addEventListener('click', () => document.getElementById('alerts-panel').classList.remove('open'));
    document.getElementById('btn-alert-add').addEventListener('click', addAlert);

    // Bootstrap app
    buildWidgetPanel();
    loadSolarConfig();
    loadAlerts();
    initTheme();
    initCompact();
    loadSettings().then(poll);

    setInterval(updateMainPredicted, 120000);
    setTimeout(updateMainPredicted, 3000);


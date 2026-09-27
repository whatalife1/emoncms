const PROXY_ENDPOINTS = [
  'https://emon-proxy.new-life-786-786-786.workers.dev',
  'https://my-vercel-proxy-1.vercel.app',
  'https://gxmbeybitqckkonxxtcr.supabase.co/functions/v1/proxy'
//  'https://taupe-bunny-bb0a25.netlify.app/'
];

let activeProxyIndex = 0;
try {
  const savedIdx = parseInt(localStorage.getItem('activeProxyIndex'));
  if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < PROXY_ENDPOINTS.length) {
    activeProxyIndex = savedIdx;
  }
} catch (e) {}

let PROXY_BASE = PROXY_ENDPOINTS[activeProxyIndex];

const DOH_RESOLVERS = [
  { name: 'Google DNS (8.8.8.8 / 8.8.4.4)', url: 'https://dns.google/resolve?type=A&name=' },
  { name: 'Cloudflare DNS (1.1.1.1 / 1.0.0.1)', url: 'https://cloudflare-dns.com/dns-query?type=A&ct=application/dns-json&name=' },
  { name: 'AdGuard DNS (94.140.14.14 / 94.140.15.15)', url: 'https://dns.adguard-dns.com/resolve?type=A&name=' }
];

async function resolveDomainDoH(hostname) {
  for (const resolver of DOH_RESOLVERS) {
    try {
      const res = await fetch(resolver.url + encodeURIComponent(hostname), {
        headers: { 'accept': 'application/dns-json' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.Answer && data.Answer.length > 0) {
        const ips = data.Answer.filter(a => a.type === 1).map(a => a.data);
        if (ips.length > 0) {
          return { provider: resolver.name, ips: ips };
        }
      }
    } catch (e) {}
  }
  return null;
}

function rotateProxyEndpoint() {
  if (PROXY_ENDPOINTS.length > 1) {
    activeProxyIndex = (activeProxyIndex + 1) % PROXY_ENDPOINTS.length;
    PROXY_BASE = PROXY_ENDPOINTS[activeProxyIndex];
    try {
      localStorage.setItem('activeProxyIndex', activeProxyIndex.toString());
    } catch (e) {}
    return PROXY_BASE;
  }
  return PROXY_BASE;
}

let autoRefreshSec = 30;

// Set to true to include Grid in estimated battery watts calculation.
// Set to false to calculate estimate purely from Solar and Load (ignoring Grid).
const BATTERY_EST_USE_GRID = true;

// ── Battery Cutoff Settings ──────────────────────────────────────────
// Change this value anytime; flow diagram and cards will update dynamically:
const BATTERY_HEAVY_LOAD_CUTOFF_SOC = 20; // Inverter turns off heavy loads (ACs/motor) at this SOC %
const BATTERY_TOTAL_CUTOFF_SOC = 10;      // Inverter reserve shutdown cutoff SOC %

const STALE_MS = 5 * 60 * 1000;
const STALE_EXEMPT = new Set([
  "Water Tank",
  "Temperature",
  "Humidity",
  "Temperature 2",
  "Humidity 2",
  "Inverter Temp",
  "Bat V",
  "Status",
  "Bat Status",
  "SOC %",
  "bt_battery_charging_current",
  "bt_battery_discharge_current",
  "Chg A",
  "Dis A",
  // Battery 2 (Dyness) — same staleness leniency as Battery 1
  "Bat2 Voltage",
  "Bat2 Current",
  "Bat2 SOC",
  "Bat2 SOH",
  "Bat2 Mosfet Temp",
  "Bat2 BMS Temp",
  "Bat2 Cycle Count",
  "Bat2 Chg Limit V",
  "Bat2 Chg Limit A",
  "Bat2 Dis Limit V",
  "Bat2 Dis Limit A",
  "Bat2 Cell 1", "Bat2 Cell 2", "Bat2 Cell 3", "Bat2 Cell 4",
  "Bat2 Cell 5", "Bat2 Cell 6", "Bat2 Cell 7", "Bat2 Cell 8",
  "Bat2 Cell 9", "Bat2 Cell 10", "Bat2 Cell 11", "Bat2 Cell 12",
  "Bat2 Cell 13", "Bat2 Cell 14", "Bat2 Cell 15", "Bat2 Cell 16"
]);

const BULK_UNRELIABLE_IDS = ["541348", "541350", "542850", "542853", "512473", "512474"];

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
  // { id: "499403", name: "Utility",              unit: "W",   type: "watts" },
  // { id: "499421", name: "Utility Today",        unit: "kWh", type: "units" },
  // { id: "499420", name: "Utility Total",        unit: "kWh", type: "units" },
  { id: "499373", name: "Fridge",               unit: "W",   type: "watts" },
  { id: "541348", name: "Fridge2",              unit: "W",   type: "watts" },
  { id: "542850", name: "Water Motor",          unit: "W",   type: "watts" },
  { id: "542853", name: "Water Motor Today",    unit: "kWh", type: "units" },
  { id: "499411", name: "Fridge Today",         unit: "kWh", type: "units" },
  { id: "541350", name: "Fridge2 Today",        unit: "kWh", type: "units" },
  { id: "499362", name: "Kenwood 1.5Ton",       unit: "W",   type: "watts" },
  { id: "499405", name: "Kenwood 1.5Ton Today", unit: "kWh", type: "units" },
  { id: "499404", name: "Kenwood 1.5Ton Total", unit: "kWh", type: "units" },
  { id: "499364", name: "Kenwood 1Ton",         unit: "W",   type: "watts" },
  { id: "499407", name: "Kenwood 1Ton Today",   unit: "kWh", type: "units" },
  { id: "499406", name: "Kenwood 1Ton Total",   unit: "kWh", type: "units" },
  { id: "499367", name: "Haier 1Ton",           unit: "W",   type: "watts" },
  { id: "499409", name: "Haier 1Ton Today",     unit: "kWh", type: "units" },
  { id: "499408", name: "Haier 1Ton Total",     unit: "kWh", type: "units" },
  { id: "499422", name: "PC",                   unit: "W",   type: "watts" },
  { id: "499424", name: "PC Today",             unit: "kWh", type: "units" },
    { id: "544694", name: "Washing Machine",       unit: "W",   type: "watts" },
    { id: "544696", name: "Washing Machine Today",  unit: "kWh", type: "units" },
  { id: "499428", name: "Temperature",          unit: "°C",  type: "env"   },
  { id: "499382", name: "Solar Amps",           unit: "A",   type: "env"   },
  { id: "499429", name: "Humidity",             unit: "%",   type: "env"   },
  { id: "512473", name: "Temperature 2",        unit: "°C",  type: "env"   },
  { id: "512474", name: "Humidity 2",           unit: "%",   type: "env"   },
  {
    id: "499394", name: "Inverter Temp",        unit: "°C",  type: "env"   },
  // Battery 1 Feeds
  { id: "546013", name: "Bat V",                         unit: "V",   type: "env"   },
  { id: "546016", name: "Status",                        unit: "",    type: "env"   },
  { id: "546019", name: "SOC %",                         unit: "%",   type: "env"   },
  { id: "546022", name: "bt_battery_charging_current",   unit: "A",   type: "env"   },
  { id: "546025", name: "bt_battery_discharge_current",  unit: "A",   type: "env"   },

  // Battery 2 (Dyness DL5.0F, 5kWh) Feeds
  { id: "546365", name: "Bat2 Power",          unit: "W",   type: "watts" },
  { id: "546369", name: "Bat2 Voltage",        unit: "V",   type: "env"   },
  { id: "546370", name: "Bat2 Current",        unit: "A",   type: "env"   },
  { id: "546371", name: "Bat2 SOC",            unit: "%",   type: "env"   },
  { id: "546372", name: "Bat2 SOH",            unit: "%",   type: "env"   },
  { id: "546373", name: "Bat2 Mosfet Temp",    unit: "°C",  type: "env"   },
  { id: "546374", name: "Bat2 BMS Temp",       unit: "°C",  type: "env"   },
  { id: "546375", name: "Bat2 Cycle Count",    unit: "",    type: "env"   },
  { id: "546376", name: "Bat2 Chg Limit V",    unit: "V",   type: "env"   },
  { id: "546377", name: "Bat2 Chg Limit A",    unit: "A",   type: "env"   },
  { id: "546378", name: "Bat2 Dis Limit V",    unit: "V",   type: "env"   },
  { id: "546379", name: "Bat2 Dis Limit A",    unit: "A",   type: "env"   },
  { id: "546380", name: "Bat2 Cell 1",         unit: "V",   type: "env"   },
  { id: "546381", name: "Bat2 Cell 2",         unit: "V",   type: "env"   },
  { id: "546382", name: "Bat2 Cell 3",         unit: "V",   type: "env"   },
  { id: "546383", name: "Bat2 Cell 4",         unit: "V",   type: "env"   },
  { id: "546384", name: "Bat2 Cell 5",         unit: "V",   type: "env"   },
  { id: "546385", name: "Bat2 Cell 6",         unit: "V",   type: "env"   },
  { id: "546386", name: "Bat2 Cell 7",         unit: "V",   type: "env"   },
  { id: "546387", name: "Bat2 Cell 8",         unit: "V",   type: "env"   },
  { id: "546388", name: "Bat2 Cell 9",         unit: "V",   type: "env"   },
  { id: "546389", name: "Bat2 Cell 10",        unit: "V",   type: "env"   },
  { id: "546390", name: "Bat2 Cell 11",        unit: "V",   type: "env"   },
  { id: "546391", name: "Bat2 Cell 12",        unit: "V",   type: "env"   },
  { id: "546392", name: "Bat2 Cell 13",        unit: "V",   type: "env"   },
  { id: "546393", name: "Bat2 Cell 14",        unit: "V",   type: "env"   },
  { id: "546394", name: "Bat2 Cell 15",        unit: "V",   type: "env"   },
  { id: "546395", name: "Bat2 Cell 16",        unit: "V",   type: "env"   },
];

// Convenience list of the 16 Battery 2 cell feed names, in cell order (1-16).
const BATTERY2_CELL_NAMES = [
  "Bat2 Cell 1","Bat2 Cell 2","Bat2 Cell 3","Bat2 Cell 4",
  "Bat2 Cell 5","Bat2 Cell 6","Bat2 Cell 7","Bat2 Cell 8",
  "Bat2 Cell 9","Bat2 Cell 10","Bat2 Cell 11","Bat2 Cell 12",
  "Bat2 Cell 13","Bat2 Cell 14","Bat2 Cell 15","Bat2 Cell 16"
];
window.BATTERY2_CELL_NAMES = BATTERY2_CELL_NAMES;

const COLORS = { watts: "val-watts", units: "val-units", env: "val-env" };

const LINKED_GROUPS = [
  ["Solar", "Solar V", "Tot Load", "Solar Today", "Solar Total", "Inverter Temp"],
    ["Breaker", "AC Volts", "Breaker Today", "Breaker Total"],
  ["Bat V", "Status", "SOC %", "bt_battery_charging_current", "bt_battery_discharge_current"],
  // Battery 2 (Dyness) — grouped as one card/settings row; cells are handled separately by flow-detail/extras
  ["Bat2 Power", "Bat2 Voltage", "Bat2 Current", "Bat2 SOC", "Bat2 SOH", "Bat2 Mosfet Temp", "Bat2 BMS Temp", "Bat2 Cycle Count",
   "Bat2 Chg Limit V", "Bat2 Chg Limit A", "Bat2 Dis Limit V", "Bat2 Dis Limit A",
   ...BATTERY2_CELL_NAMES],
  // ["Utility", "Utility Today", "Utility Total"],
  ["PC", "PC Today"],
    ["Washing Machine", "Washing Machine Today"],
  ["Water Motor", "Water Motor Today"],
  ["Kenwood 1Ton", "Kenwood 1Ton Today", "Kenwood 1Ton Total"],
  ["Kenwood 1.5Ton", "Kenwood 1.5Ton Today", "Kenwood 1.5Ton Total"],
  ["Haier 1Ton", "Haier 1Ton Today", "Haier 1Ton Total"],
  ["Fridge", "Fridge2", "Fridge Today", "Fridge2 Today"],
  ["Temperature", "Humidity"],
  ["Temperature 2", "Humidity 2"]
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
    { name: "Emon Haier 1Ton",     desc: "Haier 1Ton W" },
        { name: "Emon Washing Machine", desc: "Washing Machine W" }
  ]},
  { category: "📅 Today / Total kWh", items: [
    { name: "Emon Solar Today",           desc: "Solar kWh today" },
    { name: "Emon Breaker Today",         desc: "Breaker kWh today" },
    { name: "Emon Utility Today",         desc: "Utility kWh today" },
    { name: "Emon Fridge Today",          desc: "Fridge kWh today" },
    { name: "Emon PC Today",              desc: "PC kWh today" },
    { name: "Emon Water Motor Today",     desc: "Water Motor kWh today" },
    { name: "Emon Kenwood 1.5Ton Today",  desc: "Kenwood 1.5Ton kWh today" },
    { name: "Emon Kenwood 1Ton Today",    desc: "Kenwood 1Ton kWh today" },
    { name: "Emon Kenwood 1.5Ton Total",  desc: "Kenwood 1.5Ton lifetime kWh" },
    { name: "Emon Kenwood 1Ton Total",    desc: "Kenwood 1Ton lifetime kWh" },
        { name: "Emon Washing Machine Today", desc: "Washing Machine kWh today" }
  ]},
  { category: "🌡 Environment", items: [
    { name: "Emon Temperature",   desc: "Temperature °C" },
    { name: "Emon Humidity",      desc: "Humidity %" },
    { name: "Emon Temperature 2", desc: "Temperature 2 °C" },
    { name: "Emon Humidity 2",    desc: "Humidity 2 %" },
    { name: "Emon Water Tank",    desc: "Water Tank %" }
  ]}
];

let userOrderedFeeds = [];
let isCompact = false;
window.lastSolarActual = 0;

window.graphDayStartHour = 7;
try {
  const saved = localStorage.getItem('graphDayStartHour');
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed !== 5) window.graphDayStartHour = parsed;
    else { window.graphDayStartHour = 7; localStorage.setItem('graphDayStartHour', '7'); }
  } else {
    localStorage.setItem('graphDayStartHour', '7');
  }
} catch (e) {}

const IS_PKT_ZONE = (new Date().getTimezoneOffset() === -300);

function getPktNow() {
    const now = new Date();
    if (IS_PKT_ZONE) return now;
    return new Date(now.getTime() + 18000000);
}

function getPktDayStart(year, month, day) {
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
    return utcMidnight - (5 * 3600 * 1000);
}

function getPktTodayStart(startHour = (window.graphDayStartHour !== undefined ? window.graphDayStartHour : 7)) {
    const now = getPktNow();
    const hr = IS_PKT_ZONE ? now.getHours() : now.getUTCHours();
    let yr = IS_PKT_ZONE ? now.getFullYear() : now.getUTCFullYear();
    let mo = (IS_PKT_ZONE ? now.getMonth() : now.getUTCMonth()) + 1;
    let dy = IS_PKT_ZONE ? now.getDate() : now.getUTCDate();

    // If before startHour (e.g. 05:00 AM), cycle started yesterday at startHour
    if (hr < startHour) {
        const prev = new Date(Date.UTC(yr, mo - 1, dy - 1));
        yr = prev.getUTCFullYear();
        mo = prev.getUTCMonth() + 1;
        dy = prev.getUTCDate();
    }

    return getPktDayStart(yr, mo, dy) + (startHour * 3600 * 1000);
}

function formatPktTime(timestamp, format = 'datetime') {
    const ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const date = IS_PKT_ZONE ? new Date(ts) : new Date(ts + 18000000);
    
    const yr = IS_PKT_ZONE ? date.getFullYear() : date.getUTCFullYear();
    const mo = String((IS_PKT_ZONE ? date.getMonth() : date.getUTCMonth()) + 1).padStart(2, '0');
    const dy = String(IS_PKT_ZONE ? date.getDate() : date.getUTCDate()).padStart(2, '0');
    const hr = IS_PKT_ZONE ? date.getHours() : date.getUTCHours();
    const mn = String(IS_PKT_ZONE ? date.getMinutes() : date.getUTCMinutes()).padStart(2, '0');
    
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const hr12 = hr % 12 || 12;

    if (format === 'date') return `${dy}/${mo}/${yr}`;
    if (format === 'time') return `${hr12}:${mn} ${ampm}`;
    return `${dy}/${mo}/${yr} ${hr12}:${mn} ${ampm}`;
}

function isPktToday(timestamp) {
    const ts = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const start = getPktTodayStart();
    return ts >= start && ts < (start + 86400000);
}

function getPktBillingRange(year, month) {
    const start = new Date(Date.UTC(year, month - 2, 25, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, 26, 0, 0, 0));
    return {
        startMs: start.getTime() - 18000000,
        endMs: end.getTime() - 18000000
    };
}

function decodeInverterStatus(statusCode) {
  const code = parseInt(statusCode, 10) || 0;
  return {
    raw: code,
    gridCharging:  Boolean(code & 0x01),
    solarCharging: Boolean(code & 0x02),
    chargeActive:  Boolean(code & 0x04),
    batteryLow:    Boolean(code & 0x08),
    loadOn:        Boolean(code & 0x10),
    configChanged: Boolean(code & 0x40),
  };
}
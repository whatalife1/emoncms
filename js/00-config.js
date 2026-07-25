// ─── Proxy & DNS Configuration ──────────────────────────────────────────────
const PROXY_ENDPOINTS = [
  'https://emon-proxy.new-life-786-786-786.workers.dev',
  // You can add secondary backup endpoints or custom domains here:
  // 'https://emon-backup.yourdomain.com'
];

let activeProxyIndex = 0;
let PROXY_BASE = PROXY_ENDPOINTS[0];

// DoH (DNS-over-HTTPS) Resolvers for Google, Cloudflare, and AdGuard
const DOH_RESOLVERS = [
  { name: 'Google DNS (8.8.8.8 / 8.8.4.4)', url: 'https://dns.google/resolve?type=A&name=' },
  { name: 'Cloudflare DNS (1.1.1.1 / 1.0.0.1)', url: 'https://cloudflare-dns.com/dns-query?type=A&ct=application/dns-json&name=' },
  { name: 'AdGuard DNS (94.140.14.14 / 94.140.15.15)', url: 'https://dns.adguard-dns.com/resolve?type=A&name=' }
];

/**
 * Perform a DoH lookup across public resolvers when local ISP DNS fails
 */
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
    } catch (e) {
      // Continue trying next DoH provider
    }
  }
  return null;
}

/**
 * Rotate to next proxy endpoint if available
 */
function rotateProxyEndpoint() {
  if (PROXY_ENDPOINTS.length > 1) {
    activeProxyIndex = (activeProxyIndex + 1) % PROXY_ENDPOINTS.length;
    PROXY_BASE = PROXY_ENDPOINTS[activeProxyIndex];
    return PROXY_BASE;
  }
  return PROXY_BASE;
}

let autoRefreshSec = 30;

// ─── Staleness config ───────────────────────────────────────────────────────
const STALE_MS = 5 * 60 * 1000; // 5 minutes — force live readings to 0 if no update in this long
const STALE_EXEMPT = new Set([
  "Water Tank",
  "Temperature",
  "Humidity",
  "Temperature 2",
  "Humidity 2",
  "Inverter Temp"
]); // feeds that should NOT be zeroed when stale

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
  { id: "499428", name: "Temperature",          unit: "°C",  type: "env"   },
  { id: "499382", name: "Solar Amps",           unit: "A",   type: "env"   },
  { id: "499429", name: "Humidity",             unit: "%",   type: "env"   },
  { id: "512473", name: "Temperature 2",        unit: "°C",  type: "env"   },
  { id: "512474", name: "Humidity 2",           unit: "%",   type: "env"   },
  { id: "499394", name: "Inverter Temp",        unit: "°C",  type: "env"   }
];

const COLORS = { watts: "val-watts", units: "val-units", env: "val-env" };

const LINKED_GROUPS = [
  ["Solar", "Solar V", "Tot Load", "Solar Today", "Solar Total", "Inverter Temp"],
  ["Breaker", "AC Volts", "Breaker Today", "Breaker Total"],
  ["Utility", "Utility Today", "Utility Total"],
  ["PC", "PC Today"],
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
    { name: "Emon Haier 1Ton",     desc: "Haier 1Ton W" }
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
    { name: "Emon Kenwood 1Ton Total",    desc: "Kenwood 1Ton lifetime kWh" }
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

// ─── Fast Timezone Detection ────────────────────────────────────────────────
const IS_PKT_ZONE = (new Date().getTimezoneOffset() === -300);

function getPktNow() {
    if (IS_PKT_ZONE) return new Date();
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + 18000000);
}

function getPktTodayStart() {
    const now = getPktNow();
    if (IS_PKT_ZONE) {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
}

function getPktDayStart(year, month, day) {
    // 1. Get the exact UTC timestamp for 12:00 AM UTC
    const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0);
    // 2. Subtract exactly 5 hours to get Pakistan Midnight
    return utcMidnight - (5 * 3600 * 1000);
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
    const now = getPktNow();
    const d = new Date(ts + (IS_PKT_ZONE ? 0 : 18000000));
    
    const d_day = IS_PKT_ZONE ? d.getDate() : d.getUTCDate();
    const n_day = IS_PKT_ZONE ? now.getDate() : now.getUTCDate();
    if (d_day !== n_day) return false;
    
    const d_mo = IS_PKT_ZONE ? d.getMonth() : d.getUTCMonth();
    const n_mo = IS_PKT_ZONE ? now.getMonth() : now.getUTCMonth();
    return d_mo === n_mo;
}

function getPktBillingRange(year, month) {
    const start = new Date(Date.UTC(year, month - 2, 25, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, 26, 0, 0, 0));
    return {
        startMs: start.getTime() - 18000000,
        endMs: end.getTime() - 18000000
    };
}
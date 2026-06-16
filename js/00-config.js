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
  { id: "499367", name: "Haier 1Ton",           unit: "W",   type: "watts" },
  { id: "499409", name: "Haier 1Ton Today",     unit: "kWh", type: "units" },
  { id: "499408", name: "Haier 1Ton Total",     unit: "kWh", type: "units" },
  { id: "499422", name: "PC",                   unit: "W",   type: "watts" },
  { id: "499424", name: "PC Today",             unit: "kWh", type: "units" },
  { id: "499428", name: "Temperature",          unit: "°C",  type: "env"   },
  { id: "499382", name: "Solar Amps",           unit: "A",   type: "env"   },
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
  ["Haier 1Ton", "Haier 1Ton Today", "Haier 1Ton Total"],
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
    { name: "Emon Haier 1Ton",     desc: "Haier 1Ton W" }
  ]},
  { category: "📅 Today / Total kWh", items: [
    { name: "Emon Solar Today",           desc: "Solar kWh today" },
    { name: "Emon Breaker Today",         desc: "Breaker kWh today" },
    { name: "Emon Utility Today",         desc: "Utility kWh today" },
    { name: "Emon Fridge Today",          desc: "Fridge kWh today" },
    { name: "Emon PC Today",              desc: "PC kWh today" },
    { name: "Emon Kenwood 1.5Ton Today",  desc: "Kenwood 1.5Ton kWh today" },
    { name: "Emon Kenwood 1Ton Today",    desc: "Kenwood 1Ton kWh today" },
    { name: "Emon Kenwood 1.5Ton Total",  desc: "Kenwood 1.5Ton lifetime kWh" },
    { name: "Emon Kenwood 1Ton Total",    desc: "Kenwood 1Ton lifetime kWh" }
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
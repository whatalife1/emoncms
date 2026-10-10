// js/02a-flow-config.js
// ─── Flow Diagram: canvas height, LAYOUT, continuous rate helpers ────
// Auto-split from js/02-flow.js by split_02_flow.py

// js/02-flow.js
// ── CANVAS HEIGHT CONFIG ─────────────────────────────────────────────
const FLOW_CANVAS_HEIGHT = 1010;

try {
  window.FLOW_CANVAS_HEIGHT = FLOW_CANVAS_HEIGHT;
  const savedH = parseInt(localStorage.getItem('editor_preset_height'), 10);
  if (savedH > 1100) localStorage.removeItem('editor_preset_height');
} catch (e) {}

function _resolveFlowHeight(autoH) {
  if (typeof FLOW_CANVAS_HEIGHT === 'number' && FLOW_CANVAS_HEIGHT > 0) {
    return FLOW_CANVAS_HEIGHT;
  }
  try {
    const saved = parseInt(localStorage.getItem('editor_preset_height'), 10);
    if (!isNaN(saved) && saved > 0) return saved;
  } catch (e) {}
  return autoH;
}

const LAYOUT = {
 weather: { x:5, y:2, w:708, h:42, color:'#0ea5e9', label:'Weather', ly1:20, fs:22, c1:'#ffffff',  },
 solar: { x:12, y:52, w:299, h:460, color:'#f59e0b', label:'Solar', ly1:39, fs:46, c1:'#ffff00', ly2:106, fs2:45, c2:'#2c8758', ly3:212, fs3:27, c3:'#b4b635', ly4:267, fs4:20, c4:'#21c442', ly5:399, fs5:22, c5:'#3de31c', ly6:431, fs6:20, c6:'#38bdf8', ly7:168, fs7:22, c7:'#a1a1aa', ly8:305, fs8:21, c8:'#21c442', ly12:NaN,  },
 grid: { x:311, y:53, w:156, h:452, color:'#ef4444', label:'Grid', ly1:25, fs:28, c1:'#ef4444', ly2:67, fs2:44, c2:'#ef4444', ly3:114, fs3:18, c3:'#a1a1aa', ly4:161, fs4:27, c4:'#35c0b7', ly5:195, fs5:22, c5:'#35c0b7', ly6:249, fs6:18, c6:'#a1a1aa', ly7:328, fs7:21, c7:'#3de3e4', ly8:354, fs8:19, c8:'#3de3e4', ly9:406, fs9:20, c9:'#38bdf8', ly10:432, fs10:19, c10:'#38bdf8', ly11:380, fs11:20, c11:'#3de3e4',  },
 battery: { x:471, y:50, w:257, h:455, color:'#10b981', label:'Battery', ly1:17, fs:34, c1:'#10b981', ly2:64, fs2:53, c2:'#25f447', ly3:175, fs3:24, c3:'#facc15', ly4:105, fs4:29, c4:'#35c0b7', ly5:278, fs5:20, c5:'#38bdf8', ly6:204, fs6:24, c6:'#4ade80', ly7:139, fs7:18, c7:'#a1a1aa', ly8:330, fs8:23, c8:'#10b981', ly9:362, fs9:21, c9:'#10b981', ly10:391, fs10:22, c10:'#10b981', ly11:421, fs11:23, c11:'#10b981', ly12:282, fs12:21, c12:'#facc15', ly13:246, fs13:20, c13:'#facc15',  },
 haier: { x:6, y:510, w:179, h:206, color:'#38bdf8', label:'Haier 1T', ly1:17, fs:28, c1:'#38bdf8', ly2:65, fs2:55, c2:'#25f447', ly3:143, fs3:25, c3:'#00c8f0', ly4:175, fs4:25, c4:'#518e35', ly5:113, fs5:17, c5:'#a1a1aa',  },
 k15: { x:192, y:510, w:196, h:198, color:'#38bdf8', label:'Kenwood 1.5T', ly1:21, fs:27, c1:'#38bdf8', ly2:68, fs2:53, c2:'#25f447', ly3:142, fs3:25, c3:'#00c8f0', ly4:175, fs4:25, c4:'#518e35', ly5:114, fs5:16, c5:'#a1a1aa',  },
 k1: { x:395, y:507, w:189, h:198, color:'#38bdf8', label:'Kenwood 1T', ly1:20, fs:30, c1:'#38bdf8', ly2:64, fs2:52, c2:'#25f447', ly3:143, fs3:21, c3:'#00c8f0', ly4:175, fs4:22, c4:'#518e35', ly5:114, fs5:18, c5:'#a1a1aa',  },
 pc: { x:591, y:509, w:133, h:240, color:'#10b9f8', label:'PC', ly1:17, fs:40, c1:'#38bdf8', ly2:61, fs2:44, c2:'#25f447', ly3:174, fs3:19, c3:'#00c8f0', ly4:219, fs4:19, c4:'#518e35', ly5:113, fs5:18, c5:'#a1a1aa',  },
 wm: { x:582, y:756, w:139, h:238, color:'#e879f9', label:'Washing|Machine', ly1:16, fs:29, c1:'#e879f9', ly2:92, fs2:43, c2:'#25f447', ly3:180, fs3:19, c3:'#00c8f0', ly4:219, fs4:21, c4:'#518e35',  },
 water: { x:421, y:754, w:152, h:242, color:'#0ea5e9', label:'Water|Tank', ly1:15, fs:32, c1:'#0ea5e9', ly2:97, fs2:52, c2:'#25f447', ly3:139, fs3:27, c3:'#9ca3af', ly4:171, fs4:19, c4:'#0ce4e0', ly5:203, fs5:20, c5:'#38bdf8', ly6:224, fs6:18, c6:'#a1a1aa',  },
 motor: { x:233, y:755, w:183, h:243, color:'#fbbf24', label:'Water|Motor', ly1:15, fs:37, c1:'#fbbf24', ly2:105, fs2:52, c2:'#38bdf8', ly3:188, fs3:21, c3:'#518e35', ly4:221, fs4:22, c4:'#518e35', ly5:150, fs5:18, c5:'#a1a1aa',  },
 fridge: { x:5, y:755, w:224, h:239, color:'#c084fc', label:'Fridges', ly1:16, fs:36, c1:'#38bdf8', ly2:53, fs2:52, c2:'#25f447', ly3:103, fs3:17, c3:'#518e35', ly4:129, fs4:36, c4:'#38bdf8', ly5:171, fs5:52, c5:'#25f447', ly6:228, fs6:18, c6:'#518e35', ly7:86, fs7:14, c7:'#a1a1aa', ly8:205, fs8:17, c8:'#a1a1aa',  },
 temp: { x:396, y:710, w:189, h:38, color:'#22c55e', label:'temp', ly1:16, fs:24, c1:'#25f447',  },
 temp2: { x:722, y:703, w:179, h:36, color:'#22c55e', label:'temp2', ly1:16, fs:21, c1:'#25f447',  },
};

const FLOW_BAND_GAP = 60;

// ── Continuous State Helper Functions (20s minimum) ─────────────────────────
function getBatteryContinuousRate(isCharging, isDischarging, activeWatts, packWh) {
  const now = Date.now();
  let currentMode = 'standby';
  if (isCharging && activeWatts > 15) currentMode = 'charging';
  else if (isDischarging && activeWatts > 15) currentMode = 'discharging';

  let state = window._batActivityState;
  if (!state) {
    try {
      const saved = localStorage.getItem('bat_cont_activity');
      if (saved) state = JSON.parse(saved);
    } catch (e) {}
  }

  if (!state || state.mode !== currentMode || state.startTime > now) {
    state = { mode: currentMode, startTime: now };
    window._batActivityState = state;
    try { localStorage.setItem('bat_cont_activity', JSON.stringify(state)); } catch (e) {}
  } else {
    window._batActivityState = state;
  }

  if (currentMode === 'standby') return null;

  const elapsedSec = (now - state.startTime) / 1000;
  if (elapsedSec < 20) return null;

  if (!packWh || packWh <= 0) packWh = 5120;
  const ratePerHour = (activeWatts / packWh) * 100;
  const ratePerMin = ratePerHour / 60;
  const arrow = currentMode === 'charging' ? '▲' : '▼';

  return {
    mode: currentMode,
    ratePerHour,
    ratePerMin,
    elapsedSec,
    arrow,
    text: `${arrow} ${ratePerHour.toFixed(1)}%/hr | ${ratePerMin.toFixed(2)}%/min`,
    rawText: `${ratePerHour.toFixed(1)}%/hr | ${ratePerMin.toFixed(2)}%/min`
  };
}
window.getBatteryContinuousRate = getBatteryContinuousRate;

function getBattery2ContinuousRate(isCharging, isDischarging, activeWatts, packWh) {
  const now = Date.now();
  let currentMode = 'standby';
  if (isCharging && activeWatts > 15) currentMode = 'charging';
  else if (isDischarging && activeWatts > 15) currentMode = 'discharging';

  let state = window._bat2ActivityState;
  if (!state) {
    try {
      const saved = localStorage.getItem('bat2_cont_activity');
      if (saved) state = JSON.parse(saved);
    } catch (e) {}
  }

  if (!state || state.mode !== currentMode || state.startTime > now) {
    state = { mode: currentMode, startTime: now };
    window._bat2ActivityState = state;
    try { localStorage.setItem('bat2_cont_activity', JSON.stringify(state)); } catch (e) {}
  } else {
    window._bat2ActivityState = state;
  }

  if (currentMode === 'standby') return null;

  const elapsedSec = (now - state.startTime) / 1000;
  if (elapsedSec < 20) return null;

  if (!packWh || packWh <= 0) packWh = 5120;
  const ratePerHour = (activeWatts / packWh) * 100;
  const ratePerMin = ratePerHour / 60;
  const arrow = currentMode === 'charging' ? '▲' : '▼';

  return {
    mode: currentMode,
    ratePerHour,
    ratePerMin,
    elapsedSec,
    arrow,
    text: `${arrow} ${ratePerHour.toFixed(1)}%/hr | ${ratePerMin.toFixed(2)}%/min`,
    rawText: `${ratePerHour.toFixed(1)}%/hr | ${ratePerMin.toFixed(2)}%/min`
  };
}
window.getBattery2ContinuousRate = getBattery2ContinuousRate;

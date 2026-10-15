// js/02a-flow-config.js
// ─── Flow Diagram: canvas height, LAYOUT, continuous rate helpers ────
// Auto-split from js/02-flow.js by split_02_flow.py

// js/02-flow.js
// ── CANVAS HEIGHT CONFIG ─────────────────────────────────────────────
const FLOW_CANVAS_HEIGHT = 1070;

try {
  window.FLOW_CANVAS_HEIGHT = FLOW_CANVAS_HEIGHT;
  const savedH = parseInt(localStorage.getItem('editor_preset_height'), 10);
  if (savedH > 1006) localStorage.removeItem('editor_preset_height');
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
 solar: { x:12, y:52, w:307, h:414, color:'#f59e0b', label:'Solar', ly1:39, fs:46, c1:'#ffff00', ly2:106, fs2:45, c2:'#2c8758', ly3:212, fs3:27, c3:'#b4b635', ly4:267, fs4:20, c4:'#21c442', ly5:368, fs5:22, c5:'#3de31c', ly6:397, fs6:20, c6:'#38bdf8', ly7:168, fs7:22, c7:'#a1a1aa', ly8:305, fs8:21, c8:'#21c442',  },
 grid: { x:311, y:53, w:162, h:415, color:'#ef4444', label:'Grid', ly1:25, fs:28, c1:'#ef4444', ly2:67, fs2:44, c2:'#ef4444', ly3:114, fs3:18, c3:'#a1a1aa', ly4:161, fs4:27, c4:'#35c0b7', ly5:195, fs5:22, c5:'#35c0b7', ly6:249, fs6:18, c6:'#a1a1aa', ly7:293, fs7:21, c7:'#3de3e4', ly8:318, fs8:19, c8:'#3de3e4', ly9:370, fs9:20, c9:'#38bdf8', ly10:393, fs10:19, c10:'#38bdf8', ly11:340, fs11:20, c11:'#3de3e4',  },
 battery: { x:471, y:50, w:257, h:417, color:'#10b981', label:'Battery', ly1:17, fs:34, c1:'#10b981', ly2:64, fs2:53, c2:'#25f447', ly3:175, fs3:24, c3:'#facc15', ly4:105, fs4:29, c4:'#35c0b7', ly5:278, fs5:20, c5:'#38bdf8', ly6:204, fs6:24, c6:'#4ade80', ly7:139, fs7:18, c7:'#a1a1aa', ly8:319, fs8:23, c8:'#10b981', ly9:348, fs9:21, c9:'#10b981', ly10:373, fs10:22, c10:'#10b981', ly11:398, fs11:22, c11:'#10b981', ly12:282, fs12:20, c12:'#facc15', ly13:246, fs13:18, c13:'#facc15',  },
 haier: { x:5, y:470, w:186, h:214, color:'#38bdf8', label:'Haier 1T', ly1:17, fs:28, c1:'#38bdf8', ly2:55, fs2:55, c2:'#25f447', ly3:198, fs3:21, c3:'#00c8f0', ly4:172, fs4:19, c4:'#518e35', ly5:93, fs5:17, c5:'#a1a1aa', ly6:118, fs6:19, c6:'#a5f3fc', ly7:144, fs7:16, c7:'#4ade80',  },
 k15: { x:194, y:471, w:198, h:214, color:'#38bdf8', label:'Kenwood 1.5T', ly1:21, fs:27, c1:'#38bdf8', ly2:78, fs2:53, c2:'#25f447', ly3:167, fs3:23, c3:'#00c8f0', ly4:195, fs4:23, c4:'#518e35', ly5:137, fs5:16, c5:'#a1a1aa',  },
 k1: { x:395, y:472, w:187, h:216, color:'#38bdf8', label:'Kenwood 1T', ly1:20, fs:30, c1:'#38bdf8', ly2:79, fs2:52, c2:'#25f447', ly3:167, fs3:21, c3:'#00c8f0', ly4:195, fs4:21, c4:'#518e35', ly5:139, fs5:18, c5:'#a1a1aa',  },
 pc: { x:585, y:467, w:149, h:217, color:'#10b9f8', label:'PC', ly1:22, fs:42, c1:'#38bdf8', ly2:77, fs2:44, c2:'#25f447', ly3:163, fs3:19, c3:'#00c8f0', ly4:190, fs4:19, c4:'#518e35', ly5:123, fs5:18, c5:'#a1a1aa',  },
 wm: { x:582, y:725, w:150, h:332, color:'#e879f9', label:'Washing|Machine', ly1:23, fs:31, c1:'#e879f9', ly2:124, fs2:43, c2:'#25f447', ly3:270, fs3:18, c3:'#00c8f0', ly4:302, fs4:19, c4:'#518e35',  },
 water: { x:432, y:733, w:149, h:327, color:'#0ea5e9', label:'Water|Tank', ly1:17, fs:36, c1:'#0ea5e9', ly2:104, fs2:52, c2:'#25f447', ly3:163, fs3:27, c3:'#9ca3af', ly4:209, fs4:19, c4:'#0ce4e0', ly5:268, fs5:20, c5:'#38bdf8', ly6:300, fs6:18, c6:'#a1a1aa',  },
 motor: { x:253, y:733, w:173, h:328, color:'#fbbf24', label:'Water|Motor', ly1:19, fs:37, c1:'#fbbf24', ly2:125, fs2:52, c2:'#38bdf8', ly3:271, fs3:20, c3:'#518e35', ly4:301, fs4:21, c4:'#518e35', ly5:217, fs5:19, c5:'#a1a1aa',  },
 fridge1: { x:2, y:730, w:246, h:120, color:'#38bdf8', label:'Fridge 1', ly1:16, fs:33, c1:'#38bdf8', ly2:54, fs2:50, c2:'#25f447', ly3:106, fs3:16, c3:'#518e35', ly5:86, fs5:15, c5:'#a1a1aa',  },
 fridge2: { x:5, y:857, w:250, h:207, color:'#c084fc', label:'Fridge 2', ly1:17, fs:33, c1:'#38bdf8', ly2:57, fs2:50, c2:'#25f447', ly3:192, fs3:17, c3:'#518e35', ly5:170, fs5:16, c5:'#a1a1aa', ly6:93, fs6:20, c6:'#38bdf8', ly7:119, fs7:18, c7:'#a1a1aa', ly8:146, fs8:19, c8:'#4ade80',  },
 temp: { x:400, y:693, w:180, h:34, color:'#22c55e', label:'temp', ly1:16, fs:24, c1:'#25f447',  },
 temp2: { x:718, y:671, w:179, h:36, color:'#22c55e', label:'temp2', ly1:16, fs:21, c1:'#25f447',  },
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

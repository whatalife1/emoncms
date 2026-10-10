// js/22b-flow-detail-core.js
// ─── Flow Detail: core (config, constants, state, _textOv) ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  // ── Configuration ────────────────────────────────────────
  FD.FLOW_DETAIL_CONFIG = {
    weather: { title: 'Weather',         color: '#0ea5e9', graphs: [] },
    solar:   { title: 'Solar',           color: '#f59e0b', graphs: ['solar'] },
    grid:    { title: 'Grid',            color: '#ef4444', graphs: ['grid'] },
    battery: { title: 'Battery',         color: '#10b981', graphs: ['battery'] },
    haier:   { title: 'Haier 1Ton',      color: '#a5f3fc', graphs: ['haier'] },
    k15:     { title: 'Kenwood 1.5T',    color: '#38bdf8', graphs: ['k15'] },
    k1:      { title: 'Kenwood 1T',      color: '#7dd3fc', graphs: ['k1'] },
    pc:      { title: 'PC',              color: '#4ade80', graphs: ['pc'] },
    fridge:  { title: 'Fridges',         color: '#c084fc', graphs: ['fridge1', 'fridge2'] },
    water:   { title: 'Water Tank',      color: '#0ea5e9', graphs: ['water'] },
    motor:   { title: 'Water Motor',     color: '#fbbf24', graphs: ['motor'] },
    wm:      { title: 'Washing Machine', color: '#e879f9', graphs: ['wm'] },
    temp:    { title: 'Temperature',     color: '#22c55e', graphs: ['temp'] },
    temp2:   { title: 'Temperature 2',   color: '#22c55e', graphs: ['temp2'] },
    // FLOW_BATTERY2_PATCH_V1
    battery2:{ title: 'Battery 2 (Dyness)', color: '#a78bfa', graphs: ['bat2power', 'bat2volt'] }
  };

  // ── Constants ────────────────────────────────────────────
  FD.ZOOM_MIN = 1;
  FD.ZOOM_MAX = 20;
  FD.PREFS_KEY = 'flowDetailModalPrefs';

  // ── Mutable state ────────────────────────────────────────
  FD._currentBoxKey = null;
  FD._batNightCache = { ts: 0, T: 0, Y: 0 };

    function _textOv(boxKey, idx) {
    let T = null;
    try {
      const raw = localStorage.getItem('flow_detail_text_live');
      if (raw) T = JSON.parse(raw);
    } catch(e) {}
    if (!T || Object.keys(T).length === 0) {
      if (typeof FLOW_DETAIL_TEXT !== 'undefined') T = FLOW_DETAIL_TEXT;
      else if (typeof window !== 'undefined' && window.FLOW_DETAIL_TEXT) T = window.FLOW_DETAIL_TEXT;
    }
    if (!T || !T[boxKey]) return {};
    return T[boxKey][idx] || {};
  }

  // ── Exports ──────────────────────────────────────────────
  FD._textOv = _textOv;
})();

// js/22a-flow-detail-text.js
// ─── Per-line text overrides for the flow-detail popup ────────────────
//
// Edit visually in editor.html, then copy the generated constant back
// into this file and reload.
//
// Structure:
//   FLOW_DETAIL_TEXT[boxKey][lineIndex] = { fs?: number, dy?: number }
//     fs  = font size in px (omit for default; defaults are 22 title / 40 hero / 17 normal)
//     dy  = vertical offset in px (positive = move down)
//
//   FLOW_DETAIL_TEXT[boxKey].night = { fs?, dy? }   // battery "Night Disch" row only
//
// boxKey matches the keys in FLOW_DETAIL_CONFIG (battery, solar, grid,
// fridge, water, motor, wm, pc, haier, k15, k1, temp, temp2).

const FLOW_DETAIL_TEXT = {
  battery: {
    0: { dy: -24 },
    1: { dy: -34 },
    2: { fs: 27, dy: -52 },
    3: { fs: 10, dy: -54 },
    4: { fs: 20, dy: -56 },
    5: { fs: 20, dy: -59 },
    6: { fs: 20, dy: -56 },
    7: { fs: 19, dy: -61 },
    8: { dy: -61 },
    9: { dy: -60 },
    10: { dy: -65 },
    11: { fs: 19, dy: -68 },
    night: { fs: 19, dy: -79 },
  },
};

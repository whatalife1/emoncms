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
    1: { dy: -2 },
  },
};

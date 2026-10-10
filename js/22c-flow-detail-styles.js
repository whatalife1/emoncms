// js/22c-flow-detail-styles.js
// ─── Flow Detail: CSS injection ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _injectStyle() {
    if (document.getElementById('flow-detail-styles')) return;
    const s = document.createElement('style');
    s.id = 'flow-detail-styles';
    s.textContent = `
      #flow-svg-wrap rect[data-flow-box] { cursor: pointer; transition: filter .15s ease; }
      #flow-svg-wrap rect[data-flow-box]:hover {
        animation: none !important;
        filter: drop-shadow(0 0 10px rgba(255,255,255,.65)) brightness(1.2) !important;
      }
      #flow-svg-wrap rect[data-flow-box]:active {
        filter: drop-shadow(0 0 16px rgba(255,255,255,.9)) brightness(1.3) !important;
      }
      #flow-detail-modal {
        position: fixed; inset: 0; z-index: 99998;
        display: none; opacity: 0; transition: opacity .18s ease; pointer-events: none;
      }
      #flow-detail-modal.open {
        display: flex; align-items: flex-start; justify-content: center;
        opacity: 1; pointer-events: auto;
      }
      #flow-detail-modal .fd-backdrop {
        position: absolute; inset: 0; background: rgba(0,0,0,.75);
        backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      }
      #flow-detail-modal .fd-panel {
        position: relative; width: 100%; max-width: 680px;
        margin: 40px auto; max-height: calc(100vh - 80px);
        background: var(--bg-base); border: 1px solid var(--border);
        border-radius: 14px; overflow: hidden;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,.75);
        transform: translateY(10px) scale(.98); transition: transform .2s ease;
      }
      #flow-detail-modal.open .fd-panel { transform: translateY(0) scale(1); }
      #flow-detail-modal .fd-panel.fd-floating {
        position: fixed; margin: 0; max-width: none; max-height: none;
      }
      @media (max-width: 640px) {
        #flow-detail-modal .fd-panel,
        #flow-detail-modal .fd-panel.fd-floating {
          position: relative !important;
          margin: 0 !important;
          left: 0 !important; top: 0 !important;
          width: 100% !important; height: auto !important;
          max-height: 100vh !important;
          border-radius: 0 !important; border: none !important;
        }
        #flow-detail-modal .fd-resize { display: none !important; }
        #flow-detail-modal .fd-reset-pos { display: none !important; }
      }
      #flow-detail-modal .fd-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px; flex-shrink: 0;
        background: var(--bg-panel);
        border-bottom: 1px solid var(--border);
        border-top: 3px solid var(--fd-color, var(--accent-solar));
        cursor: grab; user-select: none; -webkit-user-select: none;
      }
      #flow-detail-modal .fd-header.grabbing { cursor: grabbing; }
      #flow-detail-modal .fd-header-actions {
        display: flex; gap: 6px; align-items: center;
      }
      #flow-detail-modal .fd-title {
        font-size: 16px; font-weight: 800; color: var(--text-main);
        letter-spacing: .02em;
      }
      #flow-detail-modal .fd-btn {
        background: var(--bg-card); border: 1px solid var(--border);
        color: var(--text-main); border-radius: 8px;
        padding: 4px 10px; font-size: 14px; font-weight: 700; cursor: pointer;
      }
      #flow-detail-modal .fd-btn:hover { background: var(--bg-base); }
      #flow-detail-modal .fd-body {
        flex: 1; overflow-y: auto; padding: 14px; padding-bottom: 34px;
        display: flex; flex-direction: column; gap: 12px;
      }

      #flow-detail-modal .fd-battery-grid {
        display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; width: 100%; box-sizing: border-box;
      }
      #flow-detail-modal .fd-bat-card {
        background: rgba(255,255,255,0.03); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px 6px; display: flex; flex-direction: column;
        align-items: center; justify-content: flex-start; text-align: center; gap: 3px;
        font-variant-numeric: tabular-nums; box-sizing: border-box; min-height: 125px;
      }
      #flow-detail-modal .fd-bat-card.fd-bat-hero {
        background: rgba(16,185,129,0.05); border-color: rgba(16,185,129,0.35); justify-content: center;
      }
      #flow-detail-modal .fd-bat-header {
        font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 2px;
      }
      #flow-detail-modal .fd-bat-soc {
        font-size: 38px; font-weight: 900; line-height: 1; margin: 2px 0;
      }
      #flow-detail-modal .fd-bat-volt {
        font-size: 17px; font-weight: 800; color: #35c0b7;
      }
      #flow-detail-modal .fd-bat-time {
        font-size: 11px; font-weight: 700; color: #a1a1aa;
      }
      #flow-detail-modal .fd-bat-val { font-size: 13px; font-weight: 800; }
      #flow-detail-modal .fd-bat-sub { font-size: 10.5px; font-weight: 700; line-height: 1.25; }
      #flow-detail-modal .fd-bat-stat { font-size: 10.5px; font-weight: 600; line-height: 1.25; }
      #flow-detail-modal .fd-bat-divider { width: 100%; height: 1px; background: var(--border); margin: 3px 0; opacity: .7; }

      /* FLOW_BATTERY2_PATCH_V1: Battery 2 (Dyness) popup layout */
      #flow-detail-modal .fd-bat2-top {
        display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; width: 100%; box-sizing: border-box;
      }
      #flow-detail-modal .fd-bat2-stat {
        background: rgba(167,139,250,0.06); border: 1px solid var(--border);
        border-radius: 10px; padding: 8px 6px; text-align: center;
        display: flex; flex-direction: column; gap: 2px;
      }
      #flow-detail-modal .fd-bat2-stat .lbl {
        font-size: 9.5px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .04em; color: var(--text-muted);
      }
      #flow-detail-modal .fd-bat2-stat .val {
        font-size: 17px; font-weight: 900; font-variant-numeric: tabular-nums;
      }
      #flow-detail-modal .fd-bat2-status {
        text-align: center; font-size: 13px; font-weight: 800; padding: 6px 0;
      }
      #flow-detail-modal .fd-bat2-cellgrid {
        display: grid; grid-template-columns: repeat(8, 1fr); gap: 5px; width: 100%; box-sizing: border-box;
      }
      #flow-detail-modal .fd-bat2-cell {
        background: var(--bg-card); border: 1px solid var(--border); border-radius: 7px;
        padding: 6px 3px; display: flex; flex-direction: column; justify-content: center; align-items: center;
        text-align: center; gap: 2px; box-sizing: border-box; min-width: 0;
      }
      #flow-detail-modal .fd-bat2-cell .cv {
        font-weight: 800; color: var(--text-main); font-variant-numeric: tabular-nums;
      }
      #flow-detail-modal .fd-bat2-cell.cmax { border-color: #4ade80; }
      #flow-detail-modal .fd-bat2-cell.cmin { border-color: #f87171; }
      #flow-detail-modal .fd-bat2-section-title {
        font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em;
        color: var(--text-muted); margin-bottom: 4px;
      }
      #flow-detail-modal .fd-bat2-limits {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%; box-sizing: border-box;
      }
      #flow-detail-modal .fd-bat2-limit-card {
        background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
        padding: 8px 10px; font-size: 11px;
      }
      #flow-detail-modal .fd-bat2-limit-card .t {
        font-weight: 800; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: .05em;
      }

      #flow-detail-modal .fd-lines {
        display: flex; flex-direction: column; align-items: stretch; justify-content: center;
        gap: 6px; padding: 12px 14px; overflow: visible;
        background:
          radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,.035), transparent 70%),
          var(--bg-panel);
        border: 1px solid var(--border); border-radius: 12px;
        text-align: center; font-variant-numeric: tabular-nums; min-height: auto;
        margin-bottom: 6px;}
      /* ── KPI layout shared by every non-battery popup ── */
      #flow-detail-modal .fd-lines.fd-lines--kpi {
        padding: 0; background: transparent; border: none; gap: 10px;
      }
      #flow-detail-modal .fd-kpi-grid {
        display: grid; gap: 8px; width: 100%; box-sizing: border-box;
        grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
      }
      #flow-detail-modal .fd-kpi-card {
        background: var(--bg-card); border: 1px solid var(--border);
        border-radius: 10px; padding: 9px 6px;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 2px; min-height: 62px;
      }
      #flow-detail-modal .fd-kpi-lbl {
        font-size: 9.5px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .05em; color: var(--text-muted);
      }
      #flow-detail-modal .fd-kpi-val {
        font-size: 20px; font-weight: 900; line-height: 1.05;
        font-variant-numeric: tabular-nums;
      }
      #flow-detail-modal .fd-kpi-unit {
        font-size: 11px; font-weight: 700; margin-left: 3px;
        color: var(--text-muted);
      }
      #flow-detail-modal .fd-status-row {
        text-align: center; font-size: 13px; font-weight: 800;
        padding: 6px 0 2px; letter-spacing: .01em;
      }
      #flow-detail-modal .fd-status-row .fd-status-time {
        font-weight: 600; color: var(--text-muted);
        font-size: 11px; margin-left: 6px;
      }
      #flow-detail-modal .fd-fallback-list {
        display: flex; flex-direction: column; gap: 3px;
        padding: 8px 12px;
        background: var(--bg-panel); border: 1px solid var(--border);
        border-radius: 10px; font-size: 12px; text-align: left;
      }
      #flow-detail-modal .fd-fallback-list .fd-fb-row {
        display: flex; justify-content: space-between; gap: 10px;
      }
      #flow-detail-modal .fd-fallback-list .fd-fb-row span:first-child {
        color: var(--text-muted); font-weight: 600;
      }
      #flow-detail-modal .fd-fallback-list .fd-fb-row span:last-child {
        color: var(--text-main); font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      #flow-detail-modal .fd-lines.is-loading { animation: fd-pulse 1.2s ease-in-out infinite; }
      @keyframes fd-pulse { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
      #flow-detail-modal .fd-line { line-height: 1.15; word-break: break-word; }
      #flow-detail-modal .fd-line.multiline > span { display: block; }
      #flow-detail-modal .fd-empty {
        text-align: center; color: var(--text-muted);
        padding: 22px; font-size: 13px; font-weight: 600;
      }
      #flow-detail-modal .fd-charts { display: flex; flex-direction: column; gap: 14px; }
      #flow-detail-modal .fd-chart-section { display: flex; flex-direction: column; gap: 6px; }
      /* FLOW_EXTRAS_PATCH_V1 */
      #flow-detail-modal .fd-extras {
        margin-top: 4px;
        display: flex; flex-direction: column; gap: 4px;
        background: var(--bg-panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 10px 12px;
      }
      #flow-detail-modal .fd-extras-header {
        font-size: 11px; font-weight: 800; text-transform: uppercase;
        letter-spacing: .07em; color: var(--text-muted);
        margin-bottom: 4px;
      }
      #flow-detail-modal .fd-chart-header {
        font-size: 11px; font-weight: 800;
        text-transform: uppercase; letter-spacing: .07em;
        color: var(--text-muted);
        display: flex; align-items: center; justify-content: space-between;
      }
      #flow-detail-modal .fd-chart-title { display: flex; align-items: center; gap: 4px; }
      #flow-detail-modal .fd-chart-header .fd-chart-dot {
        display: inline-block; width: 8px; height: 8px; border-radius: 50%;
        margin-right: 6px; vertical-align: middle;
      }
      #flow-detail-modal .fd-chart-reset {
        background: var(--bg-card); border: 1px solid var(--border);
        color: var(--text-muted); border-radius: 6px;
        padding: 2px 8px; font-size: 10px; font-weight: 700;
        cursor: pointer; display: none; text-transform: none; letter-spacing: 0;
      }
      #flow-detail-modal .fd-chart-reset.visible { display: inline-block; }
      #flow-detail-modal .fd-chart-reset:hover { color: var(--text-main); }
      #flow-detail-modal .fd-chart-hint {
        font-size: 10px; color: var(--text-muted);
        font-weight: 500; letter-spacing: 0; text-transform: none;
      }
      #flow-detail-modal .fd-chart-wrap {
        position: relative; background: var(--bg-panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 8px 8px 14px 8px; height: 250px;
        display: flex; align-items: center; justify-content: center;
      }
      #flow-detail-modal canvas.fd-chart {
        width: 100%; height: 100%; display: block;
        cursor: grab; touch-action: none;
      }
      #flow-detail-modal canvas.fd-chart.grabbing { cursor: grabbing; }
      #flow-detail-modal .fd-chart-loading {
        position: absolute; font-size: 12px; color: var(--text-muted); font-weight: 600;
        background: var(--bg-panel); padding: 4px 10px; border-radius: 6px;
      }
      #flow-detail-modal .fd-resize {
        position: absolute; right: 0; bottom: 0;
        width: 20px; height: 20px;
        cursor: nwse-resize; z-index: 20;
        background:
          linear-gradient(135deg,
            transparent 0 45%,
            var(--text-muted) 45% 50%,
            transparent 50% 60%,
            var(--text-muted) 60% 65%,
            transparent 65% 100%);
        border-bottom-right-radius: 14px;
        opacity: .55;
      }
      #flow-detail-modal .fd-resize:hover { opacity: 1; }
    `;
    document.head.appendChild(s);
  }

  // ── Exports ──────────────────────────────────────────────
  FD._injectStyle = _injectStyle;
})();

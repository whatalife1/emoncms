// js/23o-flow-extras-registry.js
// ─── EXTRAS_REGISTRY + renderFlowExtras dispatcher ─────────────────────
// Auto-extracted from js/23-flow-extras.js by patch_23_flow_extras.py

(function () {
  'use strict';

  const FX = window.FX;

  const {
    buildSolarExtras, buildGridExtras, buildBatteryExtras,
    buildBattery2Extras, buildFridgeExtras, buildAcExtras,
    buildWaterTankExtras, buildMotorExtras, buildWmExtras, buildPcExtras,
    BAT2_IDS
  } = FX;

  const EXTRAS_REGISTRY = {
      solar:   { build: () => buildSolarExtras() },
      grid:    { build: () => buildGridExtras() },
      battery: { build: () => buildBatteryExtras() },
      fridge:  { build: () => buildFridgeExtras() },
      k15:     { build: () => buildAcExtras('k15') },
      k1:      { build: () => buildAcExtras('k1') },
      haier:   { build: () => buildAcExtras('haier') },
      water:   { build: () => buildWaterTankExtras() },
      motor:   { build: () => buildMotorExtras() },
      wm:      { build: () => buildWmExtras() },
      pc:      { build: () => buildPcExtras() },
      battery2:{ build: () => buildBattery2Extras() }
    };

  async function renderFlowExtras(boxKey, containerEl) {
      const entry = EXTRAS_REGISTRY[boxKey];
      if (!entry || !containerEl) {
        if (containerEl) containerEl.style.display = 'none';
        return;
      }
      containerEl.style.display = '';
      containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Loading extra info…</div>';
      try {
        const html = await entry.build();
        containerEl.innerHTML = html || '<div style="color:var(--text-muted);font-size:12px;">Nothing extra to show.</div>';
      } catch (e) {
        console.warn('flow-extras error for ' + boxKey, e);
        containerEl.innerHTML = '<div style="color:var(--text-muted);font-size:12px;">Extra info unavailable.</div>';
      }
    }


  // ── Attach shared symbols to FX ──
  FX.renderFlowExtras = renderFlowExtras;
  FX.EXTRAS_REGISTRY = EXTRAS_REGISTRY;

  // ── Backwards-compatible window aliases ──
  window.renderFlowExtras = renderFlowExtras;
  window.FLOW_EXTRAS_REGISTRY = EXTRAS_REGISTRY;
  window.BATTERY2_FEED_IDS = BAT2_IDS;
})();

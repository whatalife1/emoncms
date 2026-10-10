// js/22g-flow-detail-kpi.js
// ─── Flow Detail: compact KPI grid renderer ──────────────────────
// Auto-split from js/22-flow-detail.js by split_22_flow_detail.py

(function () {
  'use strict';

  const FD = window.FD || (window.FD = {});

  function _renderKpiGrid(container, lines, boxKey, cfg) {
    const body = lines.slice(1)
                     .map(function (l) { return (l.text || '').trim(); })
                     .filter(Boolean);

    const metrics  = [];
    const freeform = [];
    let lastSeen   = null;
    let statusWord = null;

    function pushMetric(label, value, unit, color, dimWhenZero) {
      metrics.push({
        label: label,
        value: value,
        unit:  unit  || '',
        color: color || 'var(--text-main)',
        dimWhenZero: !!dimWhenZero
      });
    }

    body.forEach(function (t) {
      // "T: 0.95 kWh M: 8.8 kWh"
      let m = t.match(/^T:\s*([\d.,]+)\s*kWh\s+M:\s*([\d.,]+)\s*kWh/i);
      if (m) {
        pushMetric('TODAY', m[1], 'kWh', 'var(--accent-kwh)');
        pushMetric('MONTH', m[2], 'kWh', 'var(--accent-kwh)');
        return;
      }
      // "T: 0.0 kWh"
      m = t.match(/^T:\s*([\d.,]+)\s*kWh/i);
      if (m) { pushMetric('TODAY', m[1], 'kWh', 'var(--accent-kwh)'); return; }
      // "M: 8.8 kWh"
      m = t.match(/^M:\s*([\d.,]+)\s*kWh/i);
      if (m) { pushMetric('MONTH', m[1], 'kWh', 'var(--accent-kwh)'); return; }
      // Bare "0.24 kWh"
      m = t.match(/^([\d.,]+)\s*kWh$/i);
      if (m) { pushMetric('ENERGY', m[1], 'kWh', 'var(--accent-kwh)'); return; }

      // "673 PKR"
      m = t.match(/([\d.,]+)\s*PKR/i);
      if (m) { pushMetric('COST', m[1], 'PKR', '#4ade80'); return; }

      // Pure watts: "0 w", "524 w", "+2186 w", "-408 w"
      m = t.match(/^([+\-]?[\d.,]+)\s*w$/i);
      if (m) { pushMetric('CURRENT', m[1], 'W', cfg.color, true); return; }

      // "30.7°C / 69%"
      m = t.match(/^([\d.,]+)\s*°C\s*\/\s*([\d.,]+)\s*%$/);
      if (m) {
        pushMetric('TEMP', m[1], '°C', cfg.color);
        pushMetric('HUM',  m[2], '%',  '#38bdf8');
        return;
      }
      // "119V | 0.1A | 48.0°C"
      m = t.match(/^([\d.,]+)\s*V\s*\|\s*([\d.,]+)\s*A\s*\|\s*([\d.,]+)\s*°C$/);
      if (m) {
        pushMetric('VOLTS', m[1], 'V',  '#35c0b7');
        pushMetric('AMPS',  m[2], 'A',  '#facc15');
        pushMetric('TEMP',  m[3], '°C', '#f59e0b');
        return;
      }

      // Percentage-only: "70%"
      m = t.match(/^([\d.,]+)\s*%$/);
      if (m) { pushMetric('LEVEL', m[1], '%', cfg.color); return; }

      // Water-tank status words
      if (/^(FULL|GOOD|MODERATE|LOW|CRITICAL)$/i.test(t)) {
        statusWord = { text: t.toUpperCase(), color: cfg.color };
        return;
      }

      // Time — stash for the status row
      m = t.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM))$/i);
      if (m) { lastSeen = m[1]; return; }

      // Anything else -> freeform
      m = t.match(/^([^:]{1,24}):\s*(.+)$/);
      if (m) {
        freeform.push({ label: m[1].trim(), value: m[2].trim() });
      } else {
        freeform.push({ label: '', value: t });
      }
    });

    // ── Build HTML ──
    let html = '';

    if (metrics.length > 0) {
      html += '<div class="fd-kpi-grid">';
      metrics.forEach(function (mm) {
        const num = parseFloat(String(mm.value).replace(',', ''));
        const dim = mm.dimWhenZero && Math.abs(num) < 0.5;
        const color = dim ? 'var(--text-muted)' : mm.color;
        html += '<div class="fd-kpi-card">' +
                  '<div class="fd-kpi-lbl">' + FD._escape(mm.label) + '</div>' +
                  '<div class="fd-kpi-val" style="color:' + color + ';">' +
                    FD._escape(mm.value) +
                    (mm.unit ? '<span class="fd-kpi-unit">' + FD._escape(mm.unit) + '</span>' : '') +
                  '</div>' +
                '</div>';
      });
      html += '</div>';
    }

    // Status row: explicit word wins, otherwise infer from CURRENT watts.
    let statusText  = null;
    let statusColor = 'var(--text-muted)';
    if (statusWord) {
      statusText  = statusWord.text;
      statusColor = statusWord.color;
    } else {
      const cur = metrics.find(function (x) { return x.label === 'CURRENT'; });
      if (cur) {
        const num = parseFloat(String(cur.value).replace(',', ''));
        if (Math.abs(num) >= 6) {
          statusText  = '⚡ Running';
          statusColor = '#4ade80';
        } else {
          statusText  = '⏸ Standby';
        }
      }
    }
    if (statusText || lastSeen) {
      html += '<div class="fd-status-row" style="color:' + statusColor + ';">' +
                (statusText ? FD._escape(statusText) : '') +
                (lastSeen ? '<span class="fd-status-time">· ' + FD._escape(lastSeen) + '</span>' : '') +
              '</div>';
    }

    if (freeform.length > 0) {
      html += '<div class="fd-fallback-list">';
      freeform.forEach(function (f) {
        if (f.label) {
          html += '<div class="fd-fb-row"><span>' + FD._escape(f.label) +
                  '</span><span>' + FD._escape(f.value) + '</span></div>';
        } else {
          html += '<div class="fd-fb-row"><span style="color:var(--text-main);">' +
                  FD._escape(f.value) + '</span></div>';
        }
      });
      html += '</div>';
    }

    if (!html) html = '<div class="fd-empty">No data yet.</div>';

    container.classList.remove('is-loading');
    container.classList.add('fd-lines--kpi');
    container.innerHTML = html;
  }

  // ── Exports ──────────────────────────────────────────────
  FD._renderKpiGrid = _renderKpiGrid;
})();

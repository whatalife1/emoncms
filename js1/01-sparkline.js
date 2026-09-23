// ─── Sparkline Ring Buffer ──────────────────────────────────────────────────
const SPARK_MAX = 20;
const sparkHistory = {};

function sparkPush(id, val) {
  if (val == null) return;
  if (!sparkHistory[id]) sparkHistory[id] = [];
  sparkHistory[id].push(val);
  if (sparkHistory[id].length > SPARK_MAX) sparkHistory[id].shift();
}

function sparkSvg(id, color) {
  if (isCompact) return '';
  const h = sparkHistory[id];
  if (!h || h.length < 3) return '';
  const W = 80, H = 24, PAD = 2;
  const min = Math.min(...h), max = Math.max(...h);
  const range = max - min || 1;
  const pts = h.map((v, i) => {
    const x = PAD + (i / (h.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last4 = h.slice(-4);
  const trend = last4[last4.length - 1] - last4[0];
  return `<div class="sparkline-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
    <circle cx="${(PAD + (W - PAD * 2)).toFixed(1)}" cy="${(H - PAD - ((h[h.length-1] - min) / range) * (H - PAD * 2)).toFixed(1)}" r="2.5" fill="${color}" opacity="0.9"/>
  </svg></div>
  <span class="trend ${trend > 0 ? 'trend-up' : trend < 0 ? 'trend-down' : 'trend-flat'}">${trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}</span>`;
}

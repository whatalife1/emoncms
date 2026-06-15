// ─── Theme & Layout toggles ─────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
}

function initCompact() {
  isCompact = localStorage.getItem('compactMode') === 'true';
  applyCompactMode();
  updateCompactBtn();
}

function applyCompactMode() {
  const flowWrap = document.getElementById('flow-wrap');
  if (flowWrap) flowWrap.style.display = isCompact ? 'none' : '';
}

function updateCompactBtn() {
  const btn = document.getElementById('btn-compact');
  if (!btn) return;
  btn.textContent = isCompact ? '⬚' : '◩';
  btn.title = isCompact ? 'Switch to Full view' : 'Switch to Compact view';
}

function toggleCompact() {
  isCompact = !isCompact;
  localStorage.setItem('compactMode', isCompact);
  applyCompactMode();
  updateCompactBtn();
  poll();
}

function toggleTheme() {
  const cur  = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

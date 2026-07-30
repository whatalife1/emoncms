async function loadSettings() {
  const savedLayout   = localStorage.getItem('customLayout');
  const savedInterval = localStorage.getItem('refreshInterval');
  const debugEnabled  = localStorage.getItem('debugEnabled') === 'true';
  autoRefreshSec = Math.max(5, parseInt(savedInterval) || 30);
  document.getElementById('refresh-interval').value = autoRefreshSec;
  document.getElementById('debug-toggle').checked = debugEnabled;
  document.getElementById('debug-info').style.display = debugEnabled ? 'block' : 'none';
  if (savedLayout) {
    const parsed = JSON.parse(savedLayout);
    userOrderedFeeds = parsed.map(saved => {
      const base = FEEDS_BASE.find(f => f.id === saved.id);
      return base ? { ...base, enabled: saved.enabled } : null;
    }).filter(Boolean);
    const existingIds = new Set(userOrderedFeeds.map(f => f.id));
    FEEDS_BASE.forEach(f => { if (!existingIds.has(f.id)) userOrderedFeeds.push({ ...f, enabled: true }); });
  } else {
    userOrderedFeeds = FEEDS_BASE.map(f => ({ ...f, enabled: true }));
  }
}

async function saveSettings() {
  autoRefreshSec = Math.max(5, parseInt(document.getElementById('refresh-interval').value) || 30);
  const rows = document.querySelectorAll('.setting-item');
  const newOrder = [];
  rows.forEach(row => {
    const id      = row.dataset.id;
    const enabled = row.querySelector('input').checked;
    const base    = FEEDS_BASE.find(f => f.id === id);
    if (!base) return;
    const gn = LINKED_GROUPS.find(g => g.includes(base.name));
    if (gn) {
      gn.forEach(name => {
        const member = FEEDS_BASE.find(f => f.name === name);
        if (member) newOrder.push({ ...member, enabled });
      });
    } else {
      newOrder.push({ ...base, enabled });
    }
  });
  userOrderedFeeds = newOrder;
  const layout = userOrderedFeeds.map(f => ({ id: f.id, enabled: f.enabled }));
  localStorage.setItem('customLayout', JSON.stringify(layout));
  localStorage.setItem('refreshInterval', autoRefreshSec);
  localStorage.setItem('debugEnabled', document.getElementById('debug-toggle').checked);
  document.getElementById('debug-info').style.display = document.getElementById('debug-toggle').checked ? 'block' : 'none';
  document.getElementById('settings').classList.remove('open');

  if (window.Android && window.Android.saveWidgetPrefs) {
    window.Android.saveWidgetPrefs(
      'https://emoncms.org',
      '',
      '499380'
    );
  }
  poll();
}

function openSettings() {
  document.getElementById('settings').classList.add('open');
  const list        = document.getElementById('settings-list');
  const settingsSet = [];
  const used        = new Set();
  userOrderedFeeds.forEach(f => {
    if (used.has(f.name)) return;
    const gn = LINKED_GROUPS.find(g => g.includes(f.name));
    if (gn) gn.forEach(n => used.add(n)); else used.add(f.name);
    settingsSet.push(f);
  });
  list.innerHTML = settingsSet.map(f => `
    <div class="setting-item" data-id="${f.id}" draggable="true">
      <span class="setting-label">${f.name}</span>
      <label class="switch"><input type="checkbox" ${f.enabled ? 'checked' : ''}><span class="slider"></span></label>
    </div>`).join('');
  setupDragAndDrop();
}

function setupDragAndDrop() {
  const list = document.getElementById('settings-list');
  let draggingItem = null;
  list.addEventListener('touchstart', e => {
    const item = e.target.closest('.setting-item');
    if (item && !e.target.closest('.switch')) { draggingItem = item; draggingItem.classList.add('dragging'); }
  }, { passive: false });
  list.addEventListener('touchmove', e => {
    if (!draggingItem) return;
    e.preventDefault();
    const touch  = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const item   = target?.closest('.setting-item');
    if (item && item !== draggingItem) {
      const rect = item.getBoundingClientRect();
      const mid  = rect.top + rect.height / 2;
      if (touch.clientY < mid) list.insertBefore(draggingItem, item);
      else list.insertBefore(draggingItem, item.nextElementSibling);
    }
  }, { passive: false });
  list.addEventListener('touchend', () => {
    if (draggingItem) { draggingItem.classList.remove('dragging'); draggingItem = null; }
  });
}

function buildWidgetPanel() {
  const body = document.getElementById('widgets-body');
  body.innerHTML = `
    <div class="widget-tip">Search <b>"Emon"</b> within your mobile device widget configuration interface to search for active widgets.</div>
    ${WIDGET_CATALOG.map(cat => `
      <div class="widget-category">${cat.category}</div>
      ${cat.items.map(w => `<div class="widget-row"><span class="widget-name">${w.name}</span><span class="widget-desc">${w.desc}</span></div>`).join('')}
    `).join('')}`;
}

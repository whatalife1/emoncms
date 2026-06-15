// ─── Alert Thresholds ───────────────────────────────────────────────────────
const DEFAULT_ALERTS = [
  { feedName: 'Utility',     condition: '>',  value: 100,  label: 'Grid draw detected',     enabled: true  },
  { feedName: 'AC Volts',    condition: '<',  value: 200,  label: 'AC voltage low (<200V)',  enabled: true  },
  { feedName: 'Water Tank',  condition: '<',  value: 20,   label: 'Water tank critical',     enabled: true  },
  { feedName: 'Temperature', condition: '>',  value: 45,   label: 'Temperature high (>45°)', enabled: true  },
  { feedName: 'Solar',       condition: '<',  value: 50,   label: 'Solar offline',           enabled: false }
];
let alertConfig = [];

function loadAlerts() {
  try {
    const s = localStorage.getItem('alertConfig');
    alertConfig = s ? JSON.parse(s) : DEFAULT_ALERTS.map(a => ({...a}));
  } catch(e) { alertConfig = DEFAULT_ALERTS.map(a => ({...a})); }
}

function saveAlerts() {
  localStorage.setItem('alertConfig', JSON.stringify(alertConfig));
}

const _alertFired = {};

function checkAlerts(byName) {
  alertConfig.forEach((alert, i) => {
    if (!alert.enabled) return;
    const feed = byName.get(alert.feedName);
    if (!feed || feed.value == null) return;
    const triggered = alert.condition === '>' ? feed.value > alert.value : feed.value < alert.value;
    const key = `${i}_${alert.feedName}`;
    if (triggered && !_alertFired[key]) {
      _alertFired[key] = true;
      const msg = `${alert.label}: ${feed.value}${feed.unit || ''}`;
      showToast(msg, 'alert');
      
      if (window.Android && window.Android.showNotification) {
        window.Android.showNotification(alert.label, msg);
      } else if (typeof Notification !== 'undefined' && Notification.permission === "granted") {
        new Notification(alert.label, { body: msg });
      }
    } else if (!triggered) {
      delete _alertFired[key];
    }
  });
}

function showToast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'toast';
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('toast-show'), 10);
  setTimeout(() => { el.classList.remove('toast-show'); setTimeout(() => el.remove(), 400); }, 4000);
}

function openAlerts() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  document.getElementById('alerts-panel').classList.add('open');
  renderAlertList();
}

function renderAlertList() {
  const list = document.getElementById('alerts-list');
  list.innerHTML = alertConfig.map((a, i) => `
    <div class="alert-item">
      <div class="alert-row1">
        <label class="switch"><input type="checkbox" ${a.enabled ? 'checked' : ''} onchange="alertConfig[${i}].enabled=this.checked;saveAlerts()"><span class="slider"></span></label>
        <span class="alert-feed">${a.feedName}</span>
        <select class="alert-cond" onchange="alertConfig[${i}].condition=this.value;saveAlerts()">
          <option value=">" ${a.condition==='>'?'selected':''}>above</option>
          <option value="<" ${a.condition==='<'?'selected':''}>below</option>
        </select>
        <input type="number" class="alert-val" value="${a.value}" onchange="alertConfig[${i}].value=parseFloat(this.value);saveAlerts()">
      </div>
      <div class="alert-label-row">
        <input type="text" class="alert-label-inp" value="${a.label}" placeholder="Alert message"
          onchange="alertConfig[${i}].label=this.value;saveAlerts()">
        <button class="alert-del" onclick="alertConfig.splice(${i},1);saveAlerts();renderAlertList()">✕</button>
      </div>
    </div>`).join('');
}

function addAlert() {
  alertConfig.push({ feedName: 'Solar', condition: '>', value: 0, label: 'New alert', enabled: true });
  saveAlerts();
  renderAlertList();
}

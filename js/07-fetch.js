const nativeCallbacks = {};
window.onNativeResponse = (id, res) => {
  if (nativeCallbacks[id]) { nativeCallbacks[id](res); delete nativeCallbacks[id]; }
};

function nativeFetch(url) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).substr(2, 9);
    nativeCallbacks[id] = resolve;
    if (window.Android && window.Android.fetchData) { 
      window.Android.fetchData(url, id); 
    } else {
      // Standard web fallback for GitHub hosting / local CORS-enabled requests
      fetch(url)
        .then(res => res.text())
        .then(text => resolve(text))
        .catch(err => resolve('ERROR: ' + err.message));
    }
  });
}

async function fetchEmon(id) {
  const url = `${PROXY_BASE}/?id=${id}`;
  const debugEnabled = document.getElementById('debug-toggle').checked;
  const debugEl = debugEnabled ? document.getElementById('debug-info') : null;
  try {
    if (debugEl) debugEl.innerHTML = `<b>URL:</b><br><small>${url}</small><br><b>Response:</b><br><span id="debug-res">Fetching...</span>`;
    const text = await nativeFetch(url);
    if (debugEl) { const el = document.getElementById('debug-res'); if (el) el.textContent = text || '(Empty)'; }
    if (text.startsWith('ERROR:')) throw new Error(text);
    if (text.includes('authentication failed') || text === 'false') throw new Error('Auth Failed');
    const val = parseFloat(text.replace(/['"]/g, ''));
    return isNaN(val) ? null : val;
  } catch (e) {
    document.getElementById('footer').textContent = 'Err: ' + e.message;
    if (debugEl) { const el = document.getElementById('debug-res'); if (el) el.textContent = 'ERROR: ' + e.message; }
    return null;
  }
}

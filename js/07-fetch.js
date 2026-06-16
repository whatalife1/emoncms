const nativeCallbacks = {};

window.onNativeResponse = (id, res) => {
  if (nativeCallbacks[id]) { 
    nativeCallbacks[id](res); 
    delete nativeCallbacks[id]; 
  }
};

function nativeFetch(url) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).substr(2, 9);
    nativeCallbacks[id] = resolve;
    if (window.Android && window.Android.fetchData) { 
      window.Android.fetchData(url, id); 
    } else {
      fetch(url)
        .then(res => res.text())
        .then(text => resolve(text))
        .catch(err => resolve('ERROR: ' + err.message));
    }
  });
}

// Optimized: Gets ALL feeds and their current values in one request
async function fetchEmonBulk() {
  const url = `${PROXY_BASE}/feed/list.json`;
  try {
    const text = await nativeFetch(url);
    if (text.startsWith('ERROR:')) throw new Error(text);
    
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return null;
    
    // Create a fast lookup Map (ID -> Value)
    const lookup = new Map();
    data.forEach(f => {
      // We store the ID as a string to ensure matching works perfectly
      lookup.set(String(f.id), parseFloat(f.value));
    });
    return lookup;
  } catch (e) {
    console.error("Bulk fetch failed:", e);
    return null;
  }
}

// Kept for specific single-feed logic if needed elsewhere
async function fetchEmon(id) {
  const url = `${PROXY_BASE}/?id=${id}`;
  try {
    const text = await nativeFetch(url);
    if (text.startsWith('ERROR:')) throw new Error(text);
    const val = parseFloat(text.replace(/['"]/g, ''));
    return isNaN(val) ? null : val;
  } catch (e) {
    return null;
  }
}
const nativeCallbacks = {};

window.onNativeResponse = (id, res) => {
  if (nativeCallbacks[id]) { 
    nativeCallbacks[id](res); 
    delete nativeCallbacks[id]; 
  }
};

/**
 * Robust fetch with Retry logic
 */
function nativeFetch(url, retries = 2, delay = 1000) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).substr(2, 9);
    
    // Safety timeout: If no response in 10s, force a retry
    const timeoutTimer = setTimeout(() => {
      if (nativeCallbacks[id]) {
        if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Timeout:</b> 10s exceeded. Force-canceling.`);
        nativeCallbacks[id]("ERROR: Timeout");
      }
    }, 10000);

    nativeCallbacks[id] = (result) => {
      clearTimeout(timeoutTimer);
      if (typeof result === 'string' && result.startsWith('ERROR:') && retries > 0) {
        if (window.addDebugLog) window.addDebugLog(`<b style="color:#f59e0b">Retry:</b> ${result} (Attempt ${3-retries}/3)`);
        setTimeout(() => {
          resolve(nativeFetch(url, retries - 1, delay * 1.5));
        }, delay);
      } else {
        if (typeof result === 'string' && result.startsWith('ERROR:')) {
           if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Fetch Failed:</b> ${result.substring(0, 60)}...`);
        }
        resolve(result);
      }
    };

    if (window.Android && window.Android.fetchData) { 
      window.Android.fetchData(url, id); 
    } else {
      fetch(url)
        .then(res => res.text())
        .then(text => {
          if (nativeCallbacks[id]) nativeCallbacks[id](text);
        })
        .catch(err => {
          if (nativeCallbacks[id]) nativeCallbacks[id]('ERROR: ' + err.message);
        });
    }
  });
}

async function fetchEmonBulk() {
  const url = `${PROXY_BASE}/feed/list.json`;
  try {
    const text = await nativeFetch(url);
    if (!text) throw new Error("Empty response");
    if (typeof text === 'string' && text.startsWith('ERROR:')) throw new Error(text);
    
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
        throw new Error("Proxy returned HTML instead of data");
    }

    const data = JSON.parse(text);
    const lookup = new Map();
    data.forEach(f => {
      lookup.set(String(f.id), { v: parseFloat(f.value), t: parseInt(f.time) });
    });
    return lookup;
  } catch (e) {
    throw e; 
  }
}

async function fetchEmon(id) {
  const url = `${PROXY_BASE}/?id=${id}`;
  try {
    const text = await nativeFetch(url);
    if (typeof text === 'string' && text.startsWith('ERROR:')) throw new Error(text);
    if (window.addDebugLog) window.addDebugLog(`<b style="color:var(--accent-kwh)">Fetch:</b> ID ${id} = ${String(text).substring(0,15)}`);
    const val = parseFloat(text.replace(/['"]/g, ''));
    return isNaN(val) ? null : val;
  } catch (e) {
    return null;
  }
}
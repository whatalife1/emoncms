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
    
    nativeCallbacks[id] = (result) => {
      if (typeof result === 'string' && result.startsWith('ERROR:') && retries > 0) {
        setTimeout(() => {
          resolve(nativeFetch(url, retries - 1, delay * 1.5));
        }, delay);
      } else {
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
      lookup.set(String(f.id), parseFloat(f.value));
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
    const val = parseFloat(text.replace(/['"]/g, ''));
    return isNaN(val) ? null : val;
  } catch (e) {
    return null;
  }
}
const nativeCallbacks = {};

window.onNativeResponse = (id, res) => {
  if (nativeCallbacks[id]) { 
    nativeCallbacks[id](res); 
    delete nativeCallbacks[id]; 
  }
};

function nativeFetch(url, retries = PROXY_ENDPOINTS.length - 1, delay = 500) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).substring(2, 11);
    
    const timeoutTimer = setTimeout(() => {
      if (nativeCallbacks[id]) {
        if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Timeout:</b> 4.5s exceeded. Force-canceling & rotating.`);
        const cb = nativeCallbacks[id];
        delete nativeCallbacks[id];
        cb("ERROR: Timeout");
      }
    }, 4500);

    nativeCallbacks[id] = async (result) => {
      clearTimeout(timeoutTimer);
      delete nativeCallbacks[id];
      if (typeof result === 'string' && result.startsWith('ERROR:') && retries > 0) {
        try {
          const parsedUrl = new URL(url);
          const hostname = parsedUrl.hostname;

          if (window.addDebugLog) {
            window.addDebugLog(`<b style="color:#f59e0b">Network/DNS Failure:</b> (${result}). Testing DoH lookup for ${hostname}...`);
          }

          const dohResult = await resolveDomainDoH(hostname);
          if (dohResult) {
            if (window.addDebugLog) {
              window.addDebugLog(`<b style="color:#10b981">DoH Resolved [${dohResult.provider}]:</b> ${hostname} -> [${dohResult.ips.join(', ')}]`);
            }
          }

          if (typeof PROXY_ENDPOINTS !== 'undefined' && PROXY_ENDPOINTS.length > 1) {
            const oldBase = PROXY_BASE;
            const newBase = rotateProxyEndpoint();
            url = url.replace(oldBase, newBase);
            if (window.addDebugLog) {
              window.addDebugLog(`<b style="color:#38bdf8">Switching Endpoint:</b> ${newBase}`);
            }
          }
        } catch (e) {}

        setTimeout(() => {
          resolve(nativeFetch(url, retries - 1, Math.min(delay * 1.5, 2000)));
        }, delay);
      } else {
        if (typeof result === 'string' && result.startsWith('ERROR:')) {
           if (window.addDebugLog) window.addDebugLog(`<b style="color:#ef4444">Fetch Failed:</b> ${result.substring(0, 60)}...`);
        } else {
           try {
             localStorage.setItem('activeProxyIndex', activeProxyIndex.toString());
           } catch (e) {}
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
      const t = (f.time !== undefined && f.time !== null) ? parseInt(f.time) : null;
      const time = (t !== null && !isNaN(t)) ? t : null;
      lookup.set(String(f.id), { v: parseFloat(f.value) || 0, t: time });
    });

    const missingIds = BULK_UNRELIABLE_IDS.filter(id => !lookup.has(id));
    if (missingIds.length > 0) {
      const patches = await Promise.all(missingIds.map(async id => {
        const val = await fetchEmon(id);
        return { id, val };
      }));
      const nowSec = Math.floor(Date.now() / 1000);
      patches.forEach(({ id, val }) => {
        if (val !== null) lookup.set(id, { v: val, t: nowSec });
      });
    }

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

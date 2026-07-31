// ─── Store the latest feed data for flow updates ──────────────────────────────
let _latestFeedData = null;

async function updateMainPredicted() {
  try {
    if (typeof _calcHourly !== 'function') return;
    
    const now = new Date();
    const { hourly } = await _calcHourly(now.getFullYear(), now.getMonth()+1, now.getDate()); 
    const cur = now.getHours() + now.getMinutes()/60;
    
    let watt = 0, cloud = 0, rain = 0;
    const firstHour = hourly[0]?.h ?? 5;
    const lastHour = hourly[hourly.length - 1]?.h ?? 18;

    if (cur < firstHour || cur >= lastHour + 1) {
      watt = 0;
      cloud = hourly[hourly.length - 1]?.cloud ?? 0;
      rain = hourly[hourly.length - 1]?.rain ?? 0;
    } else {
      for (let i=0; i<hourly.length; i++) {
        const h0 = hourly[i], h1 = hourly[i+1];
        if (h0.h <= cur && (!h1 || h1.h > cur)) {
          if (h1) {
            const t = (cur - h0.h)/(h1.h - h0.h);
            watt = h0.watt + t*(h1.watt - h0.watt);
            cloud = (h0.cloud||0) + t*((h1.cloud||0)-(h0.cloud||0));
            rain = (h0.rain||0) + t*((h1.rain||0)-(h0.rain||0));
          } else {
            watt = h0.watt; cloud = h0.cloud; rain = h0.rain;
          }
          break;
        }
      }
    }

    // Update global variables

    // ─── Compute irradiance % from hourly data ──────────────────────────────────
    let irradPct = null;
    if (typeof _doy === 'function' && typeof _solarPos === 'function' && typeof _clearSky === 'function') {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const hour = now.getHours();
            const targetTime = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00`;
            const weather = await fetchLahoreWeather();
            if (weather && weather.hourly && weather.hourly.time && weather.hourly.shortwave_radiation) {
                const idx = weather.hourly.time.indexOf(targetTime);
                if (idx !== -1) {
                    const actualGhi = weather.hourly.shortwave_radiation[idx];
                    if (actualGhi !== undefined && actualGhi !== null && actualGhi > 0) {
                        const doy = _doy(year, month, day);
                        const elev = _solarPos(year, month, day, hour + 0.5).elev;
                        if (elev > 0) {
                            const clearSky = _clearSky(elev, doy).ghi;
                            if (clearSky > 0) {
                                irradPct = Math.min(100, Math.round((actualGhi / clearSky) * 100));
                            }
                        }
                    }
                }
            }
        } catch(e) { /* ignore */ }
    }
    window.irradiancePct = irradPct;
    window.currentPredW = Math.round(watt);
    window.currentCloud = Math.round(cloud);
    window.currentRain = Math.round(rain);

    // CRITICAL: If energy data exists, re-draw the flow chart with new pred values
    if (window.lastResultsMap) {
      renderFlowDiagram(window.lastResultsMap);
    }

  } catch(e) { console.log("Prediction Error:", e); }
}

// Intercept the poll function
const _origPoll = poll;
poll = async function() {
  await _origPoll();
  await updateMainPredicted();
};
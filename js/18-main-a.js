// ─── Store the latest feed data for flow updates ──────────────────────────────
let _latestFeedData = null;

async function updateMainPredicted() {
  try {
    if (typeof _calcHourly !== 'function') return;
    
    const now = new Date();
    const { hourly } = await _calcHourly(now.getFullYear(), now.getMonth()+1, now.getDate()); 
    const cur = now.getHours() + now.getMinutes()/60;
    
    let watt = 0, cloud = 0;
    const firstHour = hourly[0]?.h ?? 5;
    const lastHour = hourly[hourly.length - 1]?.h ?? 18;

    if (cur < firstHour || cur >= lastHour + 1) {
      watt = 0;
      cloud = hourly[hourly.length - 1]?.cloud ?? 0;
    } else {
      for (let i=0; i<hourly.length; i++) {
        const h0 = hourly[i], h1 = hourly[i+1];
        if (h0.h <= cur && (!h1 || h1.h > cur)) {
          if (h1) {
            const t = (cur - h0.h)/(h1.h - h0.h);
            watt = h0.watt + t*(h1.watt - h0.watt);
            cloud = (h0.cloud||0) + t*((h1.cloud||0)-(h0.cloud||0));
          } else {
            watt = h0.watt; cloud = h0.cloud;
          }
          break;
        }
      }
    }

    // Update global variables
    window.currentPredW = Math.round(watt);
    window.currentCloud = Math.round(cloud);

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
// Safe button helper
function _btn(id, fn) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', fn);
  } else {
    console.warn('Missing element:', id);
  }
}

// Button wiring
function wireButtons() {
  _btn('btn-solar', () => {
    const panel = document.getElementById('solar-panel');
    if (panel) panel.classList.add('open');
    const now = new Date();
    const dateInput = document.getElementById('sp-day-date');
    const monthInput = document.getElementById('sp-month-m');
    const yearInput = document.getElementById('sp-month-y');
    if (dateInput) dateInput.value = now.toISOString().split('T')[0];
    if (monthInput) monthInput.value = now.getMonth() + 1;
    if (yearInput) yearInput.value = now.getFullYear();
    window._navOffset = 0;
    if (typeof solRenderToday === 'function') solRenderToday();
  });
  
  _btn('btn-solar-close', () => {
    const panel = document.getElementById('solar-panel');
    if (panel) panel.classList.remove('open');
  });
  
  _btn('sol-prev-day', () => { 
    window._navOffset--; 
    if (typeof solRenderToday === 'function') solRenderToday();
  });
  
  _btn('sol-next-day', () => { 
    if (window._navOffset >= 7) return; 
    window._navOffset++; 
    if (typeof solRenderToday === 'function') solRenderToday();
  });

  _btn('sol-cfg-toggle', () => {
    const body = document.getElementById('sol-cfg-body');
    const arrow = document.getElementById('sol-cfg-arrow');
    if (!body) return;
    const isOpen = body.style.display === 'block';
    body.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
  });

  _btn('sp-apply', () => {
    if (typeof applySolarConfig === 'function') applySolarConfig();
  });

  const cloudSlider = document.getElementById('sp-cloud');
  if (cloudSlider) {
    cloudSlider.addEventListener('input', function() {
      if (typeof _updateCloudLabel === 'function') _updateCloudLabel(this.value);
    });
  }

  // Solar tabs
  document.querySelectorAll('.sol-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sol-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.sol-tab-content').forEach(c => c.classList.remove('active'));
      const name = tab.dataset.tab;
      const content = document.getElementById('sol-tab-' + name);
      if (content) content.classList.add('active');
      if (name === 'today') { 
        window._navOffset = 0; 
        if (typeof solRenderToday === 'function') solRenderToday();
      }
      if (name === 'billing' && typeof solRenderBilling === 'function') {
        solRenderBilling();
      }
    });
  });

  _btn('sp-day-calc', () => {
    const dt = document.getElementById('sp-day-date');
    if (dt && dt.value && typeof solRenderDay === 'function') {
      solRenderDay(dt.value);
    }
  });
  
  _btn('sp-month-calc', () => {
    const mo = parseInt(document.getElementById('sp-month-m')?.value || '0');
    const y = parseInt(document.getElementById('sp-month-y')?.value || '0');
    if (mo && y && typeof solRenderMonth === 'function') {
      solRenderMonth(y, mo);
    }
  });

  _btn('btn-refresh', () => {
    if (typeof poll === 'function') poll();
  });
  
  _btn('btn-settings', () => {
    if (typeof openSettings === 'function') openSettings();
  });
  
  _btn('btn-save', () => {
    if (typeof saveSettings === 'function') saveSettings();
  });

  _btn('btn-view-report', () => {
    const panel = document.getElementById('usage-report-panel');
    if (panel) panel.classList.add('open');
    const now = new Date();
    const monthInput = document.getElementById('report-month-m');
    const yearInput = document.getElementById('report-month-y');
    if (monthInput) monthInput.value = now.getMonth() + 1;
    if (yearInput) yearInput.value = now.getFullYear();
    if (typeof calculateDetailedReport === 'function') {
      setTimeout(calculateDetailedReport, 100);
    }
  });
  
  _btn('btn-report-calculate', () => {
    if (typeof calculateDetailedReport === 'function') calculateDetailedReport();
  });

  _btn('btn-report-clear-cache', () => {
    if (typeof clearReportCache === 'function') clearReportCache();
    if (typeof calculateDetailedReport === 'function') {
      calculateDetailedReport(true);
    }
  });

  _btn('btn-report-text', () => {
    if (typeof downloadTextReport === 'function') downloadTextReport();
  });

  _btn('btn-report-png', () => {
    const btn = document.getElementById('btn-report-png');
    const content = document.querySelector('#usage-report-content .report-wrapper');
    if (!content) { 
      alert('Calculate report first'); 
      return; 
    }
    if (typeof html2canvas === 'undefined') {
      alert('html2canvas library not loaded');
      return; 
    }
    btn.disabled = true; 
    btn.textContent = 'Saving...';
    const clone = content.cloneNode(true);
    clone.style.cssText = 'position:fixed;top:0;left:0;width:max-content;max-width:none;z-index:-9999;opacity:1';
    document.body.appendChild(clone);
    html2canvas(clone, {
      backgroundColor: '#ffffff', 
      scale: 3, 
      useCORS: true,
      logging: false,
      width: clone.scrollWidth, 
      height: clone.scrollHeight
    }).then(canvas => {
      const a = document.createElement('a');
      a.download = `Report_${new Date().toISOString().split('T')[0]}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      document.body.removeChild(clone);
      btn.disabled = false; 
      btn.textContent = 'Save PNG';
    }).catch(() => {
      document.body.removeChild(clone);
      btn.disabled = false; 
      btn.textContent = 'Save PNG';
    });
  });

  _btn('btn-widgets', () => {
    const panel = document.getElementById('widgets-panel');
    if (panel) panel.classList.add('open');
  });
  
  _btn('btn-widgets-close', () => {
    const panel = document.getElementById('widgets-panel');
    if (panel) panel.classList.remove('open');
  });
  
  _btn('btn-theme', () => {
    if (typeof toggleTheme === 'function') toggleTheme();
  });
  
  _btn('btn-compact', () => {
    if (typeof toggleCompact === 'function') toggleCompact();
  });
  
  _btn('btn-alerts', () => {
    if (typeof openAlerts === 'function') openAlerts();
  });
  
  _btn('btn-alerts-close', () => {
    const panel = document.getElementById('alerts-panel');
    if (panel) panel.classList.remove('open');
  });
  
  _btn('btn-alert-add', () => {
    if (typeof addAlert === 'function') addAlert();
  });

  _btn('btn-simulator', () => {
    if (typeof openSimulatorPanel === 'function') openSimulatorPanel();
  });

  // Graph buttons
  _btn('btn-graphs', () => {
    if (typeof openGraphsPanel === 'function') {
      openGraphsPanel();
    } else {
      const p = document.getElementById('graphs-panel');
      if (p) {
        p.classList.add('open');
        if (typeof renderGraphsPanel === 'function') {
          setTimeout(renderGraphsPanel, 50);
        }
        if (graphTab === 'day' && typeof startGraphsAutoRefresh === 'function') {
          setTimeout(startGraphsAutoRefresh, 100);
        }
      }
    }
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  });

  _btn('btn-graphs-close', () => {
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (typeof closeGraphsPanel === 'function') {
      closeGraphsPanel();
    } else {
      const p = document.getElementById('graphs-panel');
      if (p) p.classList.remove('open');
    }
  });

  _btn('btn-graphs-fullscreen', () => {
    const p = document.getElementById('graphs-panel');
    if (!p) return;
    
    const isGoingFull = !p.classList.contains('fullscreen');
    p.classList.toggle('fullscreen');
    const btn = document.getElementById('btn-graphs-fullscreen');
    if (btn) {
      btn.textContent = isGoingFull ? 'Exit' : 'Full';
    }

    if (screen.orientation && screen.orientation.lock) {
      if (isGoingFull) {
        screen.orientation.lock('landscape').catch(() => {});
      } else {
        screen.orientation.unlock();
      }
    }
    
    setTimeout(() => {
      if (typeof _syncOverlaySize === 'function') _syncOverlaySize();
      if (typeof _fastRedraw === 'function') _fastRedraw();
    }, 300);
  });
}

// APP BOOT
function initApp() {
  try { 
    if (typeof loadReportCache === 'function') loadReportCache();
  } catch(e) { console.error('loadReportCache', e); }

  try { 
    if (typeof buildWidgetPanel === 'function') buildWidgetPanel(); 
  } catch(e) { console.error('buildWidgetPanel',e); }
  
  try { 
    if (typeof loadSolarConfig === 'function') loadSolarConfig(); 
  } catch(e) { console.error('loadSolarConfig',e); }
  
  try { 
    if (typeof loadAlerts === 'function') loadAlerts(); 
  } catch(e) { console.error('loadAlerts',e); }
  
  try { 
    if (typeof initTheme === 'function') initTheme(); 
  } catch(e) { console.error('initTheme',e); }
  
  try { 
    if (typeof initCompact === 'function') initCompact(); 
  } catch(e) { console.error('initCompact',e); }

  try {
    if (typeof updateSimulatorButtonVisibility === 'function') updateSimulatorButtonVisibility();
  } catch(e) { console.error('updateSimulatorButtonVisibility', e); }

  try {
    wireButtons();
  } catch(e) {
    console.error('wireButtons error:', e);
  }

  try {
    const cached = localStorage.getItem('last_known_results');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof renderResults === 'function') {
        renderResults(parsed);
      }
      const footer = document.getElementById('footer');
      if (footer) footer.textContent = 'Loading fresh data...';
    } else {
      if (typeof renderFlowDiagram === 'function') {
        renderFlowDiagram(new Map());
      }
      const footer = document.getElementById('footer');
      if (footer) footer.textContent = 'Initializing...';
    }
  } catch(e) {
    console.error('Cache render error:', e);
    try { 
      if (typeof renderFlowDiagram === 'function') renderFlowDiagram(new Map()); 
    } catch(_) {}
    const footer = document.getElementById('footer');
    if (footer) footer.textContent = 'Initializing...';
  }

  try {
    if (typeof window.backgroundFetchMonthly === 'function') {
      window.backgroundFetchMonthly();
    }
  } catch(e) { console.error('backgroundFetchMonthly',e); }

  if (typeof loadSettings === 'function') {
    loadSettings().then(() => {
      if (typeof poll === 'function') poll();
    }).catch(e => {
      console.error('loadSettings failed:', e);
      if (typeof poll === 'function') poll();
    });
  } else {
    if (typeof poll === 'function') poll();
  }

  const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
  const fullBtn = document.getElementById('btn-graphs-fullscreen');
  if (fullBtn && !isDesktop) {
    fullBtn.style.display = 'none';
  }

  if (typeof updateMainPredicted === 'function') {
    setInterval(updateMainPredicted, 120000);
    setTimeout(updateMainPredicted, 3000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (window.addDebugLog) window.addDebugLog(`<b>System:</b> App woke up. Triggering fresh poll.`);
      if (typeof poll === 'function') poll();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

document.getElementById('btn-solar').addEventListener('click', () => {
  document.getElementById('solar-panel').classList.add('open');
  const now = new Date();
  document.getElementById('sp-day-date').value   = now.toISOString().split('T')[0];
  document.getElementById('sp-month-m').value    = now.getMonth() + 1;
  document.getElementById('sp-month-y').value    = now.getFullYear();
  _navOffset = 0;
  solRenderToday();
});

document.getElementById('btn-solar-close').addEventListener('click', () => {
  document.getElementById('solar-panel').classList.remove('open');
});

document.getElementById('sol-prev-day').addEventListener('click', () => { _navOffset--; solRenderToday(); });
document.getElementById('sol-next-day').addEventListener('click', () => { if (_navOffset >= 7) return; _navOffset++; solRenderToday(); });

document.getElementById('sol-cfg-toggle').addEventListener('click', () => {
  const body  = document.getElementById('sol-cfg-body');
  const arrow = document.getElementById('sol-cfg-arrow');
  const open  = body.style.display === 'block';
  body.style.display    = open ? 'none' : 'block';
  arrow.style.transform = open ? '' : 'rotate(180deg)';
});

document.getElementById('sp-apply').addEventListener('click', applySolarConfig);
document.getElementById('sp-cloud').addEventListener('input', function() { _updateCloudLabel(this.value); });

document.querySelectorAll('.sol-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sol-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.sol-tab-content').forEach(c => c.classList.remove('active'));
    const name = tab.dataset.tab;
    document.getElementById('sol-tab-' + name).classList.add('active');
    if (name === 'today')   { _navOffset = 0; solRenderToday(); }
    if (name === 'billing') solRenderBilling();
  });
});

document.getElementById('sp-day-calc').addEventListener('click', () => {
  const dt = document.getElementById('sp-day-date').value;
  if (!dt) return;
  solRenderDay(dt);
});

document.getElementById('sp-month-calc').addEventListener('click', () => {
  const mo = parseInt(document.getElementById('sp-month-m').value);
  const y  = parseInt(document.getElementById('sp-month-y').value);
  if (!mo || !y) return;
  solRenderMonth(y, mo);
});

document.getElementById('btn-refresh').addEventListener('click', poll);
document.getElementById('btn-settings').addEventListener('click', openSettings);
document.getElementById('btn-save').addEventListener('click', saveSettings);

document.getElementById('btn-view-report').addEventListener('click', () => {
  document.getElementById('usage-report-panel').classList.add('open');
  const now = new Date();
  document.getElementById('report-month-m').value = now.getMonth() + 1;
  document.getElementById('report-month-y').value = now.getFullYear();
  calculateDetailedReport();
});

// Event listener to save report as a PNG image (captures full table width)
    document.getElementById('btn-report-png').addEventListener('click', () => {
      const btn = document.getElementById('btn-report-png');
      const content = document.querySelector('#usage-report-content .report-wrapper');
      
      if (!content) {
        alert('Please calculate the report first before saving.');
        return;
      }
      
      btn.disabled = true;
      btn.textContent = 'Saving...';
      
      // 1. Create a temporary off-screen clone to bypass browser width limits and scrollbars
      const clone = content.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '0';
      clone.style.width = 'max-content';
      clone.style.maxWidth = 'none';
      clone.style.height = 'auto';
      clone.style.zIndex = '-9999';
      clone.style.opacity = '1';       // Keep visible behind the screen layer for rendering
      clone.style.pointerEvents = 'none';
      
      // 2. Force the scroll wrapper inside the clone to be fully visible (no scrollbar)
      const cloneScroll = clone.querySelector('.table-scroll');
      if (cloneScroll) {
        cloneScroll.style.overflow = 'visible';
        cloneScroll.style.overflowX = 'visible';
        cloneScroll.style.width = 'max-content';
      }
      
      // 3. Let the table take up its natural maximum horizontal width
      const cloneTable = clone.querySelector('table');
      if (cloneTable) {
        cloneTable.style.width = 'max-content';
        cloneTable.style.minWidth = '900px';
      }
      
      document.body.appendChild(clone);
      
      // 4. Capture the fully expanded off-screen clone
      html2canvas(clone, {
        backgroundColor: '#121214', 
        scale: 2,                  // High resolution clarity
        logging: false,
        useCORS: true,
        width: clone.scrollWidth,  // Ensure full canvas width matching the table width
        height: clone.scrollHeight
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `EmonCMS_Detailed_Report_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        // Cleanup the off-screen clone
        document.body.removeChild(clone);
        
        btn.disabled = false;
        btn.textContent = 'Save PNG';
      }).catch(err => {
        console.error(err);
        if (clone.parentNode) {
          document.body.removeChild(clone);
        }
        alert('Failed to generate PNG image.');
        btn.disabled = false;
        btn.textContent = 'Save PNG';
      });
    });


    document.getElementById('btn-widgets').addEventListener('click', () => document.getElementById('widgets-panel').classList.add('open'));
    document.getElementById('btn-widgets-close').addEventListener('click', () => document.getElementById('widgets-panel').classList.remove('open'));
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-compact').addEventListener('click', toggleCompact);
    document.getElementById('btn-alerts').addEventListener('click', openAlerts);
    document.getElementById('btn-alerts-close').addEventListener('click', () => document.getElementById('alerts-panel').classList.remove('open'));
    document.getElementById('btn-alert-add').addEventListener('click', addAlert);

    // Bootstrap app
    buildWidgetPanel();
    loadSolarConfig();
    loadAlerts();
    initTheme();
    initCompact();
    loadSettings().then(poll);

    setInterval(updateMainPredicted, 120000);
    setTimeout(updateMainPredicted, 3000);

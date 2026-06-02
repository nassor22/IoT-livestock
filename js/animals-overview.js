document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.querySelector('#animalsTable tbody');
  const summary = document.getElementById('overviewSummary');

  function clear() { tableBody.innerHTML = ''; summary.innerHTML = ''; }

  function renderSummary(list) {
    const total = list.length;
    const normal = list.filter(a => a.status === 'normal').length;
    const warning = list.filter(a => a.status === 'warning').length;
    const alert = list.filter(a => a.status === 'alert').length;

    summary.innerHTML = `<strong>Total:</strong> ${total} — <strong>Normal:</strong> ${normal} <strong>Warning:</strong> ${warning} <strong>Alert:</strong> ${alert}`;
  }

  function renderRow(animal) {
    const tr = document.createElement('tr');

    const idTd = document.createElement('td');
    idTd.textContent = animal.id || 'UNKNOWN';

    const statusTd = document.createElement('td');
    statusTd.innerHTML = `<span class="${animal.status === 'alert' ? 'status-value high' : (animal.status === 'warning' ? 'status-value' : 'status-value normal')}">${animal.status}</span>`;

    const tempTd = document.createElement('td');
    tempTd.textContent = animal.temperature != null ? animal.temperature.toFixed(1) : '—';

    const pulseTd = document.createElement('td');
    pulseTd.textContent = animal.pulseRate != null ? Math.round(animal.pulseRate) : '—';

    const thiTd = document.createElement('td');
    thiTd.textContent = animal.thi != null ? animal.thi : '—';

    const locTd = document.createElement('td');
    locTd.textContent = animal.gpsData || 'Unknown';

    const lastTd = document.createElement('td');
    lastTd.textContent = animal.lastUpdate || '—';

    tr.appendChild(idTd);
    tr.appendChild(statusTd);
    tr.appendChild(tempTd);
    tr.appendChild(pulseTd);
    tr.appendChild(thiTd);
    tr.appendChild(locTd);
    tr.appendChild(lastTd);

    tableBody.appendChild(tr);
  }

  async function load() {
    clear();
    try {
      const list = await getLiveLivestock('all');
      if (!list || !list.length) {
        tableBody.innerHTML = '<tr><td colspan="7">No animals found</td></tr>';
        renderSummary([]);
        return;
      }

      renderSummary(list);
      list.forEach(renderRow);
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="7">Error loading data: ${err.message}</td></tr>`;
    }
  }

  // Initial load and periodic refresh
  await load();
  setInterval(load, 15000);
});

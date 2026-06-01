/**
 * Livestock Detail Page Module
 * Handles individual animal detail view with charts
 */

const SENSOR_API_BASE = 'https://iot-livestock.onrender.com';

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = checkAuth();
    if (!user) return;
    
    // Check role
    if (user.role !== 'farmer') {
        window.location.href = 'ministry-dashboard.html';
        return;
    }
    
    // Get selected animal
    const animalId = sessionStorage.getItem('selectedAnimal');
    if (!animalId) {
        renderNoSelectedAnimal();
        return;
    }

    const animal = (await getLivestockById(animalId)) || getEmptyAnimal(animalId);

    renderAnimalDetail(animal);
    initPeriodButtons();

    await loadSensorData(animalId, animal);
});

function getEmptyAnimal(animalId) {
    return {
        id: animalId,
        type: 'Sensor Node',
        age: 'Unknown',
        icon: 'fa-cow',
        status: 'normal',
        statusText: 'Normal',
        temperature: null,
        activity: 'Unknown',
        rumination: 'Unknown',
        lastUpdate: 'Waiting for sensor data'
    };
}

function renderNoSelectedAnimal() {
    document.getElementById('animalId').textContent = 'No animal selected';
    document.getElementById('animalType').textContent = 'Choose a livestock record from the dashboard';

    const statusBadge = document.getElementById('animalStatus');
    statusBadge.className = 'status-badge status-normal';
    statusBadge.innerHTML = '<i class="fas fa-circle-notch"></i> Awaiting data';

    updateReading('bodyTemp', '--°C', 'status-value');
    updateReading('pulseRate', '-- bpm', 'status-value');
    updateReading('rumination', 'Unknown', 'status-value');
    updateReading('lastUpdated', 'Waiting for sensor data', 'status-value');

    updateReading('envTemp', '--', 'env-value');
    updateReading('envHumidity', '--', 'env-value');
    updateReading('envHeatIndex', '--', 'env-value');
    updateReading('envGps', 'Waiting for GPS data', 'env-value');
}

async function loadSensorData(animalId, animal) {
    try {
        const [latestResponse, historyResponse] = await Promise.all([
            fetch(`${SENSOR_API_BASE}/api/livestock/${encodeURIComponent(animalId)}/latest`),
            fetch(`${SENSOR_API_BASE}/api/livestock/${encodeURIComponent(animalId)}/readings?limit=7`)
        ]);

        const latestReading = latestResponse.ok ? await latestResponse.json() : null;
        const historyReadings = historyResponse.ok ? await historyResponse.json() : [];

        if (latestReading) {
            renderSensorReadings(animal, latestReading);
        }

        initCharts(animalId, historyReadings);
    } catch (error) {
        console.warn('Live sensor data unavailable.', error);
        initCharts(animalId, []);
    }
}

// Render animal details
function renderAnimalDetail(animal) {
    // Header
    document.getElementById('animalId').textContent = animal.id;
    document.getElementById('animalType').textContent = `${animal.type} • ${animal.age}`;
    
    // Update status badge
    const statusBadge = document.getElementById('animalStatus');
    statusBadge.className = `status-badge status-${animal.status}`;
    statusBadge.innerHTML = `
        <i class="fas ${animal.status === 'normal' ? 'fa-check-circle' : animal.status === 'warning' ? 'fa-exclamation-circle' : 'fa-times-circle'}"></i>
        ${animal.statusText}
    `;
    
    // Current readings
    updateReading('bodyTemp', animal.temperature == null ? '--°C' : `${animal.temperature}°C`, getTemperatureClass(animal.temperature));
    
    updateReading('pulseRate', animal.pulseRate == null ? '-- bpm' : `${Math.round(animal.pulseRate)} bpm`, getPulseClass(animal.pulseRate));
    
    updateReading('rumination', animal.rumination, `status-value ${animal.rumination === 'Reduced' ? 'low' : 'normal'}`);
    
    updateReading('lastUpdated', animal.lastUpdate, 'status-value');

    updateReading('envTemp', '--', 'env-value');
    updateReading('envHumidity', '--', 'env-value');
    updateReading('envHeatIndex', '--', 'env-value');
    updateReading('envGps', 'Waiting for GPS data', 'env-value');
}

// Initialize charts
function initCharts(animalId, historyReadings = []) {
    const orderedReadings = Array.isArray(historyReadings) ? [...historyReadings].reverse() : [];
    const chartLabels = orderedReadings.map(reading => formatHistoryLabel(reading.timestamp));

    // Temperature Chart
    const tempCtx = document.getElementById('tempChart').getContext('2d');
    
    const tempData = orderedReadings.length > 0
        ? orderedReadings.map(reading => reading.body_temp ?? reading.bodyTemperature ?? null).filter(value => value !== null)
        : [];

    if (window.tempChart && typeof window.tempChart.destroy === 'function') {
        window.tempChart.destroy();
    }
    
    window.tempChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Temperature (°C)',
                data: tempData,
                borderColor: '#F44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#F44336',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    min: 37,
                    max: 42,
                    ticks: {
                        callback: value => value + '°C'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    // Pulse Rate Chart
    const activityCtx = document.getElementById('activityChart').getContext('2d');
    
    const pulseData = orderedReadings.length > 0
        ? orderedReadings.map(reading => reading.pulse_rate ?? reading.heart_rate ?? reading.activity ?? null).filter(value => value !== null)
        : [];

    if (window.activityChart && typeof window.activityChart.destroy === 'function') {
        window.activityChart.destroy();
    }
    
    window.activityChart = new Chart(activityCtx, {
        type: 'bar',
        data: {
            labels: chartLabels,
            datasets: [{
                label: orderedReadings.length > 0 ? 'Pulse Rate' : 'No live data yet',
                data: pulseData,
                backgroundColor: 'rgba(46, 125, 50, 0.7)',
                borderColor: '#2E7D32',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        callback: value => value + '%'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function renderSensorReadings(animal, reading) {
    const bodyTemp = reading.body_temp ?? reading.bodyTemperature ?? animal.temperature;
    const pulseRate = reading.pulse_rate ?? reading.heart_rate ?? reading.activity;
    const ambientTemp = reading.ambient_temp;
    const humidity = reading.humidity;
    const thi = reading.thi;
    const gpsData = reading.gps_data ?? reading.gpsData;
    const timestamp = reading.timestamp ? new Date(reading.timestamp) : null;

    if (bodyTemp != null) {
        updateReading('bodyTemp', `${Number(bodyTemp).toFixed(1)}°C`, getTemperatureClass(Number(bodyTemp)));
    }

    if (pulseRate != null) {
        updateReading('pulseRate', `${Math.round(Number(pulseRate))} bpm`, getPulseClass(Number(pulseRate)));
    }

    if (ambientTemp != null) {
        updateReading('envTemp', `${Number(ambientTemp).toFixed(1)}°C`, 'env-value');
    }

    if (humidity != null) {
        updateReading('envHumidity', `${Math.round(Number(humidity))}%`, 'env-value');
    }

    if (thi != null) {
        updateReading('envHeatIndex', Number(thi).toFixed(1), 'env-value');
    }

    if (gpsData != null) {
        updateReading('envGps', gpsData, 'env-value');
    }

    updateReading('lastUpdated', timestamp ? timestamp.toLocaleString() : animal.lastUpdate, 'status-value');

    const statusBadge = document.getElementById('animalStatus');
    const resolvedStatus = getReadingStatus(bodyTemp, pulseRate, thi);
    statusBadge.className = `status-badge status-${resolvedStatus}`;
    statusBadge.innerHTML = `
        <i class="fas ${resolvedStatus === 'normal' ? 'fa-check-circle' : resolvedStatus === 'warning' ? 'fa-exclamation-circle' : 'fa-times-circle'}"></i>
        ${resolvedStatus === 'normal' ? 'Normal' : resolvedStatus === 'warning' ? 'Warning' : 'Alert'}
    `;
}

function updateReading(elementId, value, className) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = value;
    if (className) {
        element.className = className;
    }
}

function getTemperatureClass(temperature) {
    if (temperature == null) return 'status-value';
    if (temperature > 39.5) return 'status-value high';
    if (temperature < 38) return 'status-value low';
    return 'status-value normal';
}

function getPulseClass(pulseRate) {
    if (pulseRate == null) return 'status-value';
    if (pulseRate > 100) return 'status-value high';
    if (pulseRate < 50) return 'status-value low';
    return 'status-value normal';
}

function getReadingStatus(bodyTemp, pulseRate, thi) {
    if ((bodyTemp != null && bodyTemp > 39.8) || (pulseRate != null && pulseRate > 110) || (thi != null && thi >= 72)) {
        return 'alert';
    }

    if ((bodyTemp != null && bodyTemp > 39.2) || (pulseRate != null && (pulseRate < 50 || pulseRate > 100))) {
        return 'warning';
    }

    return 'normal';
}

function formatHistoryLabel(timestamp) {
    if (!timestamp) {
        return '';
    }

    return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Initialize period buttons
function initPeriodButtons() {
    const periodBtns = document.querySelectorAll('.period-btn');
    
    periodBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const parent = this.closest('.chart-period');
            parent.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const period = this.dataset.period;
            console.log('Selected period:', period);
        });
    });
}

// Action functions
function markAsChecked() {
    alert('Animal marked as checked. Status will be updated.');
}

function isolateAnimal() {
    if (confirm('Are you sure you want to mark this animal for isolation?')) {
        alert('Animal has been flagged for isolation. Please move the animal to a separate area.');
    }
}

function contactVet() {
    alert('Veterinary contact information:\n\nDr. Abebe Bekele\nPhone: +251 911 234 567\n\nAlternative:\nDistrict Vet Office: +251 911 987 654');
}

function viewFullHistory() {
    alert('Full history view would show complete health records, vaccination history, and all past alerts for this animal.');
}

/* ==========================================================================
   LIVESTOCK HEALTH MONITOR SYSTEM - APPLICATION LOGIC
   ========================================================================== */

// --- Global Application State ---
const state = {
    currentTab: 'screen-home',
    selectedAnimalId: null,
    ownerName: 'Nassor',
    mqtt: {
        client: null,
        status: 'disconnected', // 'disconnected', 'connecting', 'connected'
        brokerUrl: 'wss://broker.hivemq.com:8884/mqtt',
        topic: 'nassor22/sensors/esp32c6/+/telemetry',
        username: '',
        password: '',
        logs: []
    },
    thresholds: {
        tempNormalMax: 39.5,
        tempWarningMax: 40.0,
        pulseNormalMin: 48,
        pulseNormalMax: 84
    },
    // Pre-registered animals
    animals: {
        'COW-001': {
            id: 'COW-001',
            breed: 'Dairy Cow',
            age: '3 years',
            status: 'awaiting',
            temp: null,
            pulse: null,
            rumination: 'Unknown',
            thi: null,
            lastUpdated: null,
            history: {
                '24H': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'], temp: [], activity: [] },
                '7D': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], temp: [], activity: [] },
                '30D': { labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'], temp: [], activity: [] }
            }
        },
        'COW-002': {
            id: 'COW-002',
            breed: 'Brahman Bull',
            age: '5 years',
            status: 'awaiting', // Starts as awaiting data based on Image 4
            temp: null,
            pulse: null,
            rumination: 'Unknown',
            thi: null,
            lastUpdated: null,
            history: {
                '24H': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'], temp: [], activity: [] },
                '7D': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], temp: [], activity: [] },
                '30D': { labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'], temp: [], activity: [] }
            }
        },
        'COW-003': {
            id: 'COW-003',
            breed: 'Hereford',
            age: '2 years',
            status: 'awaiting', // Starts as awaiting data
            temp: null,
            pulse: null,
            rumination: 'Unknown',
            thi: null,
            lastUpdated: null,
            history: {
                '24H': { labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Now'], temp: [], activity: [] },
                '7D': { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], temp: [], activity: [] },
                '30D': { labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'], temp: [], activity: [] }
            }
        }
    },
    alerts: [],
    homeFilter: 'all',
    alertFilter: 'all',
    alertsPageLimit: 5
};

// --- Chart Instances ---
let tempChartInstance = null;
let activityChartInstance = null;

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMQTTForm();
    initFilters();
    initSettingsListeners();
    
    // Initial Render
    updateDashboardStats();
    renderHomeLivestock();
    renderLivestockList();
    renderAlerts();
    
    // Lucide Icons initialization
    lucide.createIcons();
    
    // Log system load
    logToConsole('System initialized. Welcome ' + state.ownerName + '.', 'system');
});

// --- Tab Navigation ---
function initNavigation() {
    const navButtons = document.querySelectorAll('.bottom-nav .nav-btn');
    const screens = document.querySelectorAll('.app-screen');
    
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            switchTab(targetId);
        });
    });

    // Back button in animal details
    document.getElementById('btn-detail-back').addEventListener('click', () => {
        showSubscreen('livestock-list-subscreen');
        state.selectedAnimalId = null;
    });

    // View All Alerts link on Home page
    document.getElementById('link-view-all-alerts').addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('screen-alerts');
    });

    // Home Stats cards click handlers
    document.getElementById('btn-stat-total').addEventListener('click', () => {
        setHomeFilter('all');
    });
    document.getElementById('btn-stat-warning').addEventListener('click', () => {
        setHomeFilter('warning');
    });
    document.getElementById('btn-stat-alert').addEventListener('click', () => {
        setHomeFilter('alert');
    });
}

function switchTab(tabId) {
    // Update nav state
    document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
        if (btn.getAttribute('data-target') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update screen visibility
    document.querySelectorAll('.app-screen').forEach(screen => {
        if (screen.id === tabId) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });

    state.currentTab = tabId;

    // Special handlers when switching tabs
    if (tabId === 'screen-livestock') {
        // If an animal details subscreen is active, redraw its charts
        const detailSubscreen = document.getElementById('livestock-detail-subscreen');
        if (detailSubscreen.classList.contains('active') && state.selectedAnimalId) {
            setTimeout(() => initCharts(state.selectedAnimalId), 100);
        }
    }
    
    // Refresh icons
    lucide.createIcons();
}

function showSubscreen(subscreenId) {
    document.querySelectorAll('.subscreen').forEach(sub => {
        if (sub.id === subscreenId) {
            sub.classList.add('active');
        } else {
            sub.classList.remove('active');
        }
    });
    lucide.createIcons();
}

// --- Home and Livestock Filters ---
function initFilters() {
    // Home Filter pills
    const homePills = document.querySelectorAll('#screen-home .filter-pill');
    homePills.forEach(pill => {
        pill.addEventListener('click', () => {
            homePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            const filterVal = pill.getAttribute('data-filter');
            setHomeFilter(filterVal);
        });
    });

    // Livestock search bar
    const searchInput = document.getElementById('livestock-search-input');
    searchInput.addEventListener('input', (e) => {
        renderLivestockList(e.target.value.trim());
    });

    // Alerts Filter pills
    const alertPills = document.querySelectorAll('#screen-alerts .filter-pill');
    alertPills.forEach(pill => {
        pill.addEventListener('click', () => {
            alertPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            const filterVal = pill.getAttribute('data-alert-filter');
            state.alertFilter = filterVal;
            renderAlerts();
        });
    });

    // Alerts search bar
    const alertSearchInput = document.getElementById('alerts-search-input');
    alertSearchInput.addEventListener('input', () => {
        renderAlerts();
    });

    // Load More Alerts button
    document.getElementById('btn-load-more-alerts').addEventListener('click', () => {
        state.alertsPageLimit += 5;
        renderAlerts();
    });

    // Clear resolved alerts button
    document.getElementById('btn-clear-resolved').addEventListener('click', () => {
        state.alerts = state.alerts.filter(a => !a.resolved);
        renderAlerts();
        updateDashboardStats();
    });
}

function setHomeFilter(filterVal) {
    state.homeFilter = filterVal;
    
    // Update UI pills to match
    const homePills = document.querySelectorAll('#screen-home .filter-pill');
    homePills.forEach(pill => {
        if (pill.getAttribute('data-filter') === filterVal) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    renderHomeLivestock();
}

// --- Dynamic Renderers ---

function updateDashboardStats() {
    let totalCount = 0;
    let warningCount = 0;
    let alertCount = 0;

    Object.values(state.animals).forEach(animal => {
        // Only count if they are NOT awaiting data
        if (animal.status !== 'awaiting') {
            totalCount++;
            if (animal.status === 'warning') warningCount++;
            if (animal.status === 'alert') alertCount++;
        }
    });

    document.getElementById('stat-total-val').innerText = totalCount;
    document.getElementById('stat-warning-val').innerText = warningCount;
    document.getElementById('stat-alert-val').innerText = alertCount;
}

function renderHomeLivestock() {
    const listContainer = document.getElementById('home-livestock-list');
    listContainer.innerHTML = '';

    const filtered = Object.values(state.animals).filter(animal => {
        // Hide awaiting data from dashboard lists
        if (animal.status === 'awaiting') return false;
        
        if (state.homeFilter === 'all') return true;
        return animal.status === state.homeFilter;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrapper"><i data-lucide="cow" class="empty-icon"></i></div>
                <p>No animals in this category.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    filtered.forEach(animal => {
        const card = createAnimalCard(animal);
        listContainer.appendChild(card);
    });

    lucide.createIcons();
}

function renderLivestockList(searchQuery = '') {
    const listContainer = document.getElementById('livestock-grid-container');
    listContainer.innerHTML = '';

    const query = searchQuery.toLowerCase();
    const filtered = Object.values(state.animals).filter(animal => {
        if (!query) return true;
        return animal.id.toLowerCase().includes(query) || animal.breed.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrapper"><i data-lucide="search" class="empty-icon"></i></div>
                <p>No livestock matches your search.</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    filtered.forEach(animal => {
        const card = createAnimalCard(animal);
        listContainer.appendChild(card);
    });

    lucide.createIcons();
}

function createAnimalCard(animal) {
    const card = document.createElement('div');
    card.className = 'animal-card';
    card.setAttribute('data-id', animal.id);
    
    // Status text mapping
    let statusText = animal.status;
    if (animal.status === 'awaiting') statusText = 'awaiting data';

    card.innerHTML = `
        <div class="animal-card-left">
            <div class="animal-avatar-box state-${animal.status}">
                <i data-lucide="cow"></i>
            </div>
            <div class="animal-details">
                <h3>${animal.id}</h3>
                <p>${animal.breed} • ${animal.age}</p>
            </div>
        </div>
        <div class="status-pill state-${animal.status}">
            <span class="status-dot"></span>
            <span>${statusText}</span>
        </div>
    `;

    // Click handler opens animal details
    card.addEventListener('click', () => {
        openAnimalDetails(animal.id);
    });

    return card;
}

function openAnimalDetails(cowId) {
    state.selectedAnimalId = cowId;
    const animal = state.animals[cowId];
    
    // Set text contents
    document.getElementById('detail-cow-name').innerText = animal.id;
    
    const breedAgeEl = document.getElementById('detail-cow-breed-age');
    const statusPill = document.getElementById('detail-status-pill');
    const statusText = document.getElementById('detail-status-text');
    const headerEl = document.getElementById('detail-header-element');

    // Update statuses
    statusPill.className = `status-pill state-${animal.status}`;
    headerEl.className = `detail-header header-${animal.status}`;

    if (animal.status === 'awaiting') {
        breedAgeEl.innerText = 'Awaiting live sensor data';
        statusText.innerText = 'Awaiting data';
        
        document.getElementById('detail-reading-temp').innerText = '--°C';
        document.getElementById('detail-reading-temp').className = 'reading-value font-jakarta';
        document.getElementById('detail-reading-pulse').innerText = '-- bpm';
        document.getElementById('detail-reading-pulse').className = 'reading-value font-jakarta';
        document.getElementById('detail-reading-rumination').innerText = 'Unknown';
        document.getElementById('detail-reading-updated').innerText = 'Waiting for sensor data';
    } else {
        breedAgeEl.innerText = `${animal.breed} • ${animal.age}`;
        statusText.innerText = animal.status;

        // Readings Values & Colors
        const tempValEl = document.getElementById('detail-reading-temp');
        tempValEl.innerText = `${animal.temp.toFixed(1)}°C`;
        tempValEl.className = `reading-value font-jakarta ${getReadingColorClass('temp', animal.temp)}`;

        const pulseValEl = document.getElementById('detail-reading-pulse');
        pulseValEl.innerText = `${animal.pulse} bpm`;
        pulseValEl.className = `reading-value font-jakarta ${getReadingColorClass('pulse', animal.pulse)}`;

        document.getElementById('detail-reading-rumination').innerText = animal.rumination;
        
        // Time format
        const diffMs = Date.now() - animal.lastUpdated.getTime();
        const diffMins = Math.max(0, Math.floor(diffMs / 60000));
        document.getElementById('detail-reading-updated').innerText = diffMins === 0 ? 'Just now' : `${diffMins} min ago`;
    }

    // Initialize Charts
    initCharts(cowId);

    // Timeframe switchers for charts
    setupChartTimeframeSwitchers('temp', cowId);
    setupChartTimeframeSwitchers('activity', cowId);

    // Switch screen
    switchTab('screen-livestock');
    showSubscreen('livestock-detail-subscreen');
}

function getReadingColorClass(type, val) {
    if (type === 'temp') {
        if (val > state.thresholds.tempWarningMax) return 'alert-val';
        if (val > state.thresholds.tempNormalMax) return 'warning-val';
        return 'normal-val';
    } else if (type === 'pulse') {
        if (val > 100 || val < 40) return 'alert-val';
        if (val > state.thresholds.pulseNormalMax || val < state.thresholds.pulseNormalMin) return 'warning-val';
        return 'normal-val';
    }
    return '';
}

// --- Chart setup ---
function initCharts(cowId) {
    const animal = state.animals[cowId];
    
    // Destroy previous charts if they exist
    if (tempChartInstance) tempChartInstance.destroy();
    if (activityChartInstance) activityChartInstance.destroy();

    const tempCtx = document.getElementById('chart-temp').getContext('2d');
    const activityCtx = document.getElementById('chart-activity').getContext('2d');

    // Default timeframes
    const tempTimeframe = getActiveTimeframe('temp');
    const activityTimeframe = getActiveTimeframe('activity');

    const tempHistory = animal.history[tempTimeframe];
    const activityHistory = animal.history[activityTimeframe];

    // Check if there is data
    const hasData = tempHistory.temp && tempHistory.temp.length > 0;

    // Style variables for Charts
    const isDarkTheme = false;
    const gridColor = 'rgba(0, 0, 0, 0.05)';
    const textColor = '#78909c';

    // 1. Temperature Chart Configuration
    tempChartInstance = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: hasData ? tempHistory.labels : ['No Data'],
            datasets: [{
                label: 'Temperature (°C)',
                data: hasData ? tempHistory.temp : [null],
                borderColor: '#e53935',
                borderWidth: 2.5,
                backgroundColor: 'rgba(229, 57, 53, 0.08)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#e53935',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#263238',
                    titleFont: { family: 'Outfit', size: 12 },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
                    callbacks: {
                        label: function(context) {
                            return ` ${context.parsed.y.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 37,
                    max: 42,
                    ticks: {
                        stepSize: 1,
                        color: textColor,
                        font: { family: 'Plus Jakarta Sans', size: 10 }
                    },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: {
                        color: textColor,
                        font: { family: 'Plus Jakarta Sans', size: 10 }
                    },
                    grid: { display: false }
                }
            }
        }
    });

    // 2. Activity/Movement Bar Chart Configuration
    activityChartInstance = new Chart(activityCtx, {
        type: 'bar',
        data: {
            labels: hasData ? activityHistory.labels : ['No Data'],
            datasets: [{
                label: 'Activity level (%)',
                data: hasData ? activityHistory.activity : [null],
                backgroundColor: '#388e3c',
                borderRadius: 4,
                maxBarThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#263238',
                    titleFont: { family: 'Outfit', size: 12 },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
                    callbacks: {
                        label: function(context) {
                            return ` ${context.parsed.y}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        color: textColor,
                        font: { family: 'Plus Jakarta Sans', size: 10 },
                        callback: function(value) { return value + '%'; }
                    },
                    grid: { color: gridColor }
                },
                x: {
                    ticks: {
                        color: textColor,
                        font: { family: 'Plus Jakarta Sans', size: 10 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function getActiveTimeframe(type) {
    const tabsContainer = document.getElementById(`chart-tabs-${type}`);
    const activeTab = tabsContainer.querySelector('.chart-tab.active');
    return activeTab ? activeTab.getAttribute('data-timeframe') : '24H';
}

function setupChartTimeframeSwitchers(type, cowId) {
    const tabsContainer = document.getElementById(`chart-tabs-${type}`);
    const tabs = tabsContainer.querySelectorAll('.chart-tab');
    
    tabs.forEach(tab => {
        // Remove previous listeners
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', () => {
            tabsContainer.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            newTab.classList.add('active');
            
            const timeframe = newTab.getAttribute('data-timeframe');
            const animal = state.animals[cowId];
            const hist = animal.history[timeframe];
            
            if (type === 'temp') {
                tempChartInstance.data.labels = hist.temp.length > 0 ? hist.labels : ['No Data'];
                tempChartInstance.data.datasets[0].data = hist.temp.length > 0 ? hist.temp : [null];
                tempChartInstance.update();
            } else {
                activityChartInstance.data.labels = hist.activity.length > 0 ? hist.labels : ['No Data'];
                activityChartInstance.data.datasets[0].data = hist.activity.length > 0 ? hist.activity : [null];
                activityChartInstance.update();
            }
        });
    });
}

// --- Render Alerts Page and Widgets ---
function renderAlerts() {
    const homeAlertList = document.getElementById('home-alerts-list');
    const alertsEmptyState = document.getElementById('home-alerts-empty');
    
    const pageAlertList = document.getElementById('alerts-list-container');
    const searchQuery = document.getElementById('alerts-search-input').value.toLowerCase().trim();

    // 1. Filter Alerts
    const activeAlerts = state.alerts.filter(a => !a.resolved);
    const hasActiveAlerts = activeAlerts.length > 0;

    // Home Alerts Panel (show active alerts only, max 3)
    if (hasActiveAlerts) {
        alertsEmptyState.classList.add('hidden');
        // Clear previous alert cards (keeping empty state hidden)
        const oldCards = homeAlertList.querySelectorAll('.alert-card');
        oldCards.forEach(c => c.remove());
        
        activeAlerts.slice(0, 3).forEach(alert => {
            const card = createAlertCard(alert, false);
            homeAlertList.appendChild(card);
        });
    } else {
        alertsEmptyState.classList.remove('hidden');
        const oldCards = homeAlertList.querySelectorAll('.alert-card');
        oldCards.forEach(c => c.remove());
    }

    // Home Recommendations Panel
    const recList = document.getElementById('home-recommendations-list');
    const recEmptyState = document.getElementById('home-recommendations-empty');
    
    if (hasActiveAlerts) {
        recEmptyState.classList.add('hidden');
        const oldRecs = recList.querySelectorAll('.recommendation-card');
        oldRecs.forEach(r => r.remove());

        activeAlerts.slice(0, 3).forEach(alert => {
            const rec = createRecommendationCard(alert);
            recList.appendChild(rec);
        });
    } else {
        recEmptyState.classList.remove('hidden');
        const oldRecs = recList.querySelectorAll('.recommendation-card');
        oldRecs.forEach(r => r.remove());
    }

    // 2. Full Alerts Page Rendering
    pageAlertList.innerHTML = '';
    
    let filteredAlerts = state.alerts.filter(alert => {
        // Tab Filter
        if (state.alertFilter === 'critical') return alert.type === 'critical' && !alert.resolved;
        if (state.alertFilter === 'warning') return alert.type === 'warning' && !alert.resolved;
        if (state.alertFilter === 'resolved') return alert.resolved;
        return true; // 'all'
    });

    // Search Query Filter
    if (searchQuery) {
        filteredAlerts = filteredAlerts.filter(a => 
            a.cowId.toLowerCase().includes(searchQuery) || 
            a.message.toLowerCase().includes(searchQuery)
        );
    }

    if (filteredAlerts.length === 0) {
        pageAlertList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrapper"><i data-lucide="bell-off" class="empty-icon"></i></div>
                <p>No alerts match the criteria.</p>
            </div>`;
        document.getElementById('btn-load-more-alerts').classList.add('hidden');
    } else {
        // Pagination slicing
        const paginatedAlerts = filteredAlerts.slice(0, state.alertsPageLimit);
        
        paginatedAlerts.forEach(alert => {
            const card = createAlertCard(alert, true);
            pageAlertList.appendChild(card);
        });

        // Toggle load more visibility
        if (filteredAlerts.length > state.alertsPageLimit) {
            document.getElementById('btn-load-more-alerts').classList.remove('hidden');
        } else {
            document.getElementById('btn-load-more-alerts').classList.add('hidden');
        }
    }

    lucide.createIcons();
}

function createAlertCard(alert, showResolveButton = false) {
    const card = document.createElement('div');
    card.className = `alert-card ${alert.type}-type ${alert.resolved ? 'resolved-type' : ''}`;
    
    const timeString = formatAlertDate(alert.timestamp);
    const smsClass = alert.smsStatus.toLowerCase();
    const smsLabel = alert.smsStatus === 'Sent' ? 'SMS Sent' : alert.smsStatus === 'Pending' ? 'SMS Pending' : 'No SMS';

    let iconName = 'alert-triangle';
    if (alert.resolved) iconName = 'check-circle-2';
    else if (alert.type === 'critical') iconName = 'thermometer';

    card.innerHTML = `
        <div class="alert-icon-circle">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="alert-content">
            <div class="alert-title">Sensor Alert - ${alert.cowId}</div>
            <div class="alert-values">${alert.message}</div>
            <div class="alert-footer">
                <div class="alert-time">
                    <i data-lucide="calendar"></i> ${timeString}
                </div>
                ${alert.smsStatus !== 'None' ? `
                <div class="alert-sms ${smsClass}">
                    <i data-lucide="mail"></i> ${smsLabel}
                </div>` : ''}
            </div>
        </div>
    `;

    // Click handler - Go to animal details
    card.addEventListener('click', (e) => {
        // Prevent trigger if they clicked resolve
        if (e.target.closest('.btn-resolve-alert')) return;
        openAnimalDetails(alert.cowId);
    });

    if (showResolveButton && !alert.resolved) {
        const resolveBtn = document.createElement('button');
        resolveBtn.className = 'btn-resolve-alert';
        resolveBtn.setAttribute('title', 'Mark as Resolved');
        resolveBtn.innerHTML = `<i data-lucide="check"></i>`;
        
        resolveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resolveAlert(alert.id);
        });
        
        card.appendChild(resolveBtn);
    }

    return card;
}

function createRecommendationCard(alert) {
    const card = document.createElement('div');
    card.className = 'recommendation-card';
    
    card.innerHTML = `
        <div class="rec-icon-circle ${alert.type}-type">
            <i data-lucide="thermometer"></i>
        </div>
        <div class="rec-content">
            <div class="rec-title">Review ${alert.cowId}</div>
            <div class="rec-desc">${alert.message}</div>
        </div>
    `;

    card.addEventListener('click', () => {
        openAnimalDetails(alert.cowId);
    });

    return card;
}

function resolveAlert(alertId) {
    const alert = state.alerts.find(a => a.id === alertId);
    if (alert) {
        alert.resolved = true;
        alert.smsStatus = 'None';
        
        // Also update the animal state if this was its active critical state
        const cow = state.animals[alert.cowId];
        // If all active alerts for this cow are resolved, return cow to normal/warning
        const cowActiveAlerts = state.alerts.filter(a => a.cowId === alert.cowId && !a.resolved);
        if (cowActiveAlerts.length === 0) {
            cow.status = 'normal';
            // Re-render
            if (state.selectedAnimalId === cow.id) {
                openAnimalDetails(cow.id);
            }
        }
        
        renderAlerts();
        renderHomeLivestock();
        renderLivestockList();
        updateDashboardStats();
    }
}

function formatAlertDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const mins = pad(date.getMinutes());
    const secs = pad(date.getSeconds());
    
    return `${day}/${month}/${year}, ${hours}:${mins}:${secs}`;
}

// --- MQTT WebSocket Connection Handler ---
function initMQTTForm() {
    const connectBtn = document.getElementById('btn-mqtt-connect');
    const disconnectBtn = document.getElementById('btn-mqtt-disconnect');
    
    connectBtn.addEventListener('click', () => {
        const brokerInput = document.getElementById('mqtt-broker-input').value.trim();
        const topicInput = document.getElementById('mqtt-topic-input').value.trim();
        const userInput = document.getElementById('mqtt-user-input').value.trim();
        const passInput = document.getElementById('mqtt-pass-input').value.trim();

        if (!brokerInput) {
            alert('Please enter a WebSocket broker URL');
            return;
        }

        state.mqtt.brokerUrl = brokerInput;
        state.mqtt.topic = topicInput;
        state.mqtt.username = userInput;
        state.mqtt.password = passInput;

        connectMQTT();
    });

    disconnectBtn.addEventListener('click', () => {
        disconnectMQTT();
    });

    document.getElementById('btn-clear-console').addEventListener('click', () => {
        document.getElementById('mqtt-console').innerHTML = '';
        logToConsole('Logs cleared.', 'system');
    });
}

function connectMQTT() {
    updateMQTTStatus('connecting');
    logToConsole(`Connecting to ${state.mqtt.brokerUrl}...`, 'system');

    const options = {
        keepalive: 60,
        clientId: 'livestock_monitor_' + Math.random().toString(16).substr(2, 8),
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 30 * 1000,
        rejectUnauthorized: false
    };

    if (state.mqtt.username) options.username = state.mqtt.username;
    if (state.mqtt.password) options.password = state.mqtt.password;

    try {
        // Connect to MQTT Broker via WebSockets
        state.mqtt.client = mqtt.connect(state.mqtt.brokerUrl, options);
        
        state.mqtt.client.on('connect', () => {
            updateMQTTStatus('connected');
            logToConsole('Successfully connected to MQTT Broker!', 'system');
            
            // Subscribe to topic
            state.mqtt.client.subscribe(state.mqtt.topic, (err) => {
                if (!err) {
                    logToConsole(`Subscribed to topic: "${state.mqtt.topic}"`, 'system');
                } else {
                    logToConsole(`Subscription error: ${err.message}`, 'error');
                }
            });
        });

        state.mqtt.client.on('message', (topic, message) => {
            const rawPayload = message.toString();
            logToConsole(`[Topic: ${topic}] Received: ${rawPayload}`, 'received');
            handleIncomingTelemetry(rawPayload);
        });

        state.mqtt.client.on('error', (err) => {
            updateMQTTStatus('disconnected');
            logToConsole(`MQTT Error: ${err.message}`, 'error');
        });

        state.mqtt.client.on('close', () => {
            updateMQTTStatus('disconnected');
            logToConsole('Connection closed by broker.', 'system');
        });

    } catch (e) {
        updateMQTTStatus('disconnected');
        logToConsole(`Setup Exception: ${e.message}`, 'error');
    }
}

function disconnectMQTT() {
    if (state.mqtt.client) {
        logToConsole('Disconnecting client...', 'system');
        state.mqtt.client.end(true, () => {
            updateMQTTStatus('disconnected');
            logToConsole('Disconnected from broker.', 'system');
        });
        state.mqtt.client = null;
    }
}

function updateMQTTStatus(status) {
    state.mqtt.status = status;
    const indicator = document.getElementById('mqtt-status-indicator');
    const connectBtn = document.getElementById('btn-mqtt-connect');
    const disconnectBtn = document.getElementById('btn-mqtt-disconnect');

    indicator.className = `status-indicator-light ${status}`;

    if (status === 'connected') {
        connectBtn.classList.add('hidden');
        disconnectBtn.classList.remove('hidden');
    } else {
        connectBtn.classList.remove('hidden');
        disconnectBtn.classList.add('hidden');
    }
}

function logToConsole(message, type = 'system') {
    const consoleBody = document.getElementById('mqtt-console');
    const line = document.createElement('div');
    line.className = `console-line ${type}`;
    
    const now = new Date();
    const timeStr = `[${now.toTimeString().split(' ')[0]}]`;
    
    line.innerText = `${timeStr} ${message}`;
    consoleBody.appendChild(line);
    
    // Auto-scroll
    consoleBody.scrollTop = consoleBody.scrollHeight;
}

// --- Data Router / Telemetry Handler ---
function handleIncomingTelemetry(rawJson) {
    try {
        const payload = JSON.parse(rawJson);
        
        // Map device_id to cowId with smart normalization
        let rawCowId = payload.cow_id || payload.cowId || payload.device;
        let cowId = null;
        
        if (rawCowId) {
            let cleanId = String(rawCowId).trim().toUpperCase();
            
            // Normalize common inputs to COW-001, COW-002, COW-003
            if (cleanId === '001' || cleanId === '1' || cleanId === 'COW-001') {
                cowId = 'COW-001';
            } else if (cleanId === '002' || cleanId === '2' || cleanId === 'COW-002' || cleanId === 'ESP32C6_01') {
                cowId = 'COW-002';
            } else if (cleanId === '003' || cleanId === '3' || cleanId === 'COW-003') {
                cowId = 'COW-003';
            } else {
                cowId = cleanId;
            }
        }

        if (!cowId || !state.animals[cowId]) {
            logToConsole(`Invalid or unregistered cow ID in payload: ${rawCowId} (resolved to: ${cowId})`, 'error');
            return;
        }

        const cow = state.animals[cowId];
        
        // Temperature parsing with fallback for stringified readings or -127 error code
        let rawTemp = payload.temp || payload.temperature || payload.temperature_c || payload.temperature_sensor_c;
        let temp = parseFloat(rawTemp);
        if (temp === -127.0 || (typeof rawTemp === 'string' && rawTemp.toLowerCase().includes('error')) || isNaN(temp)) {
            temp = 38.8; // Fallback temperature if sensor error is transmitted
            logToConsole(`[Warning] Temp sensor error (${rawTemp}°C) reported from MCU. Using fallback.`, 'error');
        }

        // Pulse parsing with fallback for raw pulse signal percent or raw ADC value
        let rawPulse = payload.pulse || payload.pulse_rate;
        let pulse = parseInt(rawPulse);
        if (isNaN(pulse)) {
            if (payload.pulse_raw) {
                const rawVal = parseInt(payload.pulse_raw);
                // Convert raw ADC (0-4095) to estimated BPM (60-110 bpm)
                pulse = Math.round(60 + (rawVal / 4095.0) * 50);
            } else if (payload.pulse_signal_percent) {
                const signalPercent = parseFloat(payload.pulse_signal_percent);
                pulse = Math.round(60 + (signalPercent / 100) * 50);
            } else {
                pulse = 72; // default fallback if missing
            }
        }

        // Rumination mapping from payload or activity level
        let rumination = payload.rumination || 'Normal';
        if (payload.activity_level) {
            if (payload.activity_level === 'Low') rumination = 'Decreased';
            else if (payload.activity_level === 'High') rumination = 'Increased';
            else if (payload.activity_level === 'Normal') rumination = 'Normal';
        }
        
        // Use THI if in payload, else calculate based on ambient, else mock
        const thi = parseFloat(payload.thi) || 72.0;

        if (isNaN(temp) || isNaN(pulse)) {
            logToConsole(`Malformed sensor readings in payload for ${cowId} (Temp: ${temp}, Pulse: ${pulse})`, 'error');
            return;
        }

        // 1. Update State values
        cow.temp = temp;
        cow.pulse = pulse;
        cow.rumination = rumination;
        cow.thi = thi;
        cow.lastUpdated = new Date();

        // Calculate state status
        let newStatus = 'normal';
        
        // Critical conditions
        if (temp > state.thresholds.tempWarningMax || pulse > 100 || pulse < 40) {
            newStatus = 'alert';
        }
        // Warning conditions
        else if (temp > state.thresholds.tempNormalMax || pulse > state.thresholds.pulseNormalMax || pulse < state.thresholds.pulseNormalMin || rumination === 'Decreased') {
            newStatus = 'warning';
        }
        
        cow.status = newStatus;

        // 2. Append to historical trend (24H dataset example)
        const history24h = cow.history['24H'];
        
        // Shift values to mimic moving window if preloaded
        if (history24h.temp.length >= 7) {
            history24h.temp.shift();
            history24h.activity.shift();
            history24h.labels.shift();
            history24h.labels.push(new Date().toTimeString().split(' ')[0].substring(0, 5)); // HH:MM
        }
        
        history24h.temp.push(temp);
        
        // Convert pulse rate to activity level percentage (mock scaling)
        let simulatedActivity = 40;
        if (newStatus === 'alert') simulatedActivity = 15; // low activity
        else if (pulse > 85) simulatedActivity = 75; // high/stressed
        else simulatedActivity = Math.round(50 + (Math.random() * 20 - 10)); // ~50%
        history24h.activity.push(simulatedActivity);

        // Mirror to 7D / 30D latest points
        const history7d = cow.history['7D'];
        if (history7d.temp.length > 0) {
            history7d.temp[history7d.temp.length - 1] = temp;
            history7d.activity[history7d.activity.length - 1] = simulatedActivity;
        }

        // 3. Trigger Alert if it's Warning or Critical
        if (newStatus === 'alert' || newStatus === 'warning') {
            const alertType = newStatus === 'alert' ? 'critical' : 'warning';
            const alertMessage = `Body temp ${temp.toFixed(1)}°C · Pulse ${pulse} bpm · THI ${thi.toFixed(1)}`;
            
            // Check if there is already an unresolved active alert for this cow of the same type
            const existingAlert = state.alerts.find(a => a.cowId === cowId && !a.resolved && a.type === alertType);
            
            if (!existingAlert) {
                const newAlert = {
                    id: 'ALERT-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    cowId: cowId,
                    type: alertType,
                    message: alertMessage,
                    timestamp: new Date(),
                    smsStatus: alertType === 'critical' ? 'Pending' : 'None',
                    resolved: false
                };
                state.alerts.unshift(newAlert);
                
                // Simulate SMS Dispatching for critical alerts
                if (newAlert.smsStatus === 'Pending') {
                    setTimeout(() => {
                        newAlert.smsStatus = 'Sent';
                        logToConsole(`[SMS Service] Dispatched emergency alert to Nassor for ${cowId}!`, 'system');
                        renderAlerts();
                    }, 4000);
                }
            }
        }

        // 4. Update UI Components
        updateDashboardStats();
        renderHomeLivestock();
        renderLivestockList();
        renderAlerts();

        // If currently viewing details for this animal, update details view live!
        if (state.selectedAnimalId === cowId) {
            openAnimalDetails(cowId);
        }

        logToConsole(`Processed data for ${cowId}: Status = ${newStatus.toUpperCase()}`, 'system');

    } catch (e) {
        logToConsole(`Parsing Exception: ${e.message}`, 'error');
    }
}

// Simulator removed - automatic telemetry active.

// --- Settings Section Listeners ---
function initSettingsListeners() {
    // Owner name update
    const ownerInput = document.getElementById('owner-name-input');
    ownerInput.addEventListener('input', (e) => {
        state.ownerName = e.target.value.trim() || 'Nassor';
        document.getElementById('user-greeting').innerText = `Hello, ${state.ownerName}!`;
    });

    // Threshold updates
    const tNormInput = document.getElementById('rule-temp-normal');
    const tWarnInput = document.getElementById('rule-temp-warning');
    const pMinInput = document.getElementById('rule-pulse-min');
    const pMaxInput = document.getElementById('rule-pulse-max');

    tNormInput.addEventListener('change', (e) => {
        state.thresholds.tempNormalMax = parseFloat(e.target.value) || 39.5;
    });
    tWarnInput.addEventListener('change', (e) => {
        state.thresholds.tempWarningMax = parseFloat(e.target.value) || 40.0;
    });
    pMinInput.addEventListener('change', (e) => {
        state.thresholds.pulseNormalMin = parseInt(e.target.value) || 48;
    });
    pMaxInput.addEventListener('change', (e) => {
        state.thresholds.pulseNormalMax = parseInt(e.target.value) || 84;
    });
}

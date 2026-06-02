/**
 * Farmer Dashboard Module
 * Handles rendering and interactivity for the farmer dashboard
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = checkAuth();
    if (!user) return;
    
    // Check role
    if (user.role !== 'farmer') {
        window.location.href = 'ministry-dashboard.html';
        return;
    }
    
    // Set farmer name
    document.getElementById('farmerName').textContent = user.name.split(' ')[0];
    
    // Initialize dashboard
    await initDashboard();
    initFilters();
    initOfflineDetection();
    subscribeToTelemetryUpdates(scheduleDashboardRefresh);
    scheduleDashboardRefresh();
});

let dashboardRefreshTimer = null;

function scheduleDashboardRefresh() {
    if (dashboardRefreshTimer) {
        clearTimeout(dashboardRefreshTimer);
    }

    dashboardRefreshTimer = setTimeout(() => {
        dashboardRefreshTimer = null;
        refreshDashboard();
    }, 150);
}

async function refreshDashboard() {
    await Promise.all([
        renderStats(),
        renderLivestockList(document.querySelector('.filter-tab.active')?.dataset.filter || 'all'),
        renderAlerts(),
        renderRecommendations()
    ]);
}

// Initialize dashboard data
async function initDashboard() {
    await Promise.all([
        renderStats(),
        renderLivestockList('all'),
        renderAlerts(),
        renderRecommendations()
    ]);
}

// Render statistics
async function renderStats() {
    const stats = await getLivestockStats();
    document.getElementById('totalAnimals').textContent = stats.total;
    document.getElementById('warningCount').textContent = stats.warning;
    document.getElementById('alertCount').textContent = stats.alert;
    
    // Update notification badge
    const notificationCount = document.getElementById('notificationCount');
    if (notificationCount) {
        const alerts = await getAlertsByFilter('all');
        notificationCount.textContent = alerts.length;
    }
}

// Render livestock list
async function renderLivestockList(filter) {
    const container = document.getElementById('livestockList');
    const livestock = await getLivestockByFilter(filter);
    
    // Show only first 5 on dashboard
    const displayLivestock = livestock.slice(0, 5);

    if (!displayLivestock.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wave-square"></i>
                <p>No live livestock sensor data is available yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = displayLivestock.map(animal => `
        <div class="livestock-item" onclick="viewLivestockDetail('${animal.id}')">
            <div class="livestock-icon">
                <i class="fas ${animal.icon}"></i>
            </div>
            <div class="livestock-info">
                <div class="livestock-id">${animal.id}</div>
                <div class="livestock-type">${animal.type}</div>
            </div>
            <div class="livestock-status">
                <span class="status-badge status-${animal.status}">
                    <i class="fas ${animal.status === 'normal' ? 'fa-check-circle' : animal.status === 'warning' ? 'fa-exclamation-circle' : 'fa-times-circle'}"></i>
                    ${animal.statusText}
                </span>
                <span class="livestock-arrow">
                    <i class="fas fa-chevron-right"></i>
                </span>
            </div>
        </div>
    `).join('');
}

// Render alerts
async function renderAlerts() {
    const container = document.getElementById('alertList');
    const alerts = (await getAlertsByFilter('all')).slice(0, 3);

    if (!alerts.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-bell-slash"></i>
                <p>No live alerts from sensors right now.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="alert-card ${alert.type}">
            <div class="alert-header">
                <div class="alert-icon">
                    <i class="fas ${alert.icon}"></i>
                </div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-description">${alert.description}</div>
                </div>
            </div>
            <div class="alert-meta">
                <span><i class="fas fa-clock"></i> ${alert.time}</span>
                ${alert.smsSent 
                    ? '<span class="sms-sent"><i class="fas fa-check-circle"></i> SMS Sent</span>'
                    : '<span><i class="fas fa-envelope"></i> SMS Pending</span>'
                }
            </div>
        </div>
    `).join('');
}

// Render recommendations
async function renderRecommendations() {
    const container = document.getElementById('recommendationsList');
    const alerts = await getAlertsByFilter('all');
    const liveRecommendations = alerts.slice(0, 3).map(alert => ({
        icon: alert.type === 'alert' ? 'fa-temperature-high' : 'fa-exclamation-triangle',
        iconClass: alert.type === 'alert' ? 'urgent' : 'warning',
        action: `Review ${alert.animalId}`,
        detail: alert.description
    }));
    
    if (!liveRecommendations.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>No recommendations until a sensor crosses a threshold.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = liveRecommendations.map(rec => `
        <div class="recommendation-card">
            <div class="recommendation-icon ${rec.iconClass}">
                <i class="fas ${rec.icon}"></i>
            </div>
            <div class="recommendation-content">
                <div class="recommendation-action">${rec.action}</div>
                <div class="recommendation-detail">${rec.detail}</div>
            </div>
        </div>
    `).join('');
}

// Initialize filter tabs
function initFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active state
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Filter livestock list
            const filter = this.dataset.filter;
            renderLivestockList(filter);
        });
    });
}

// Navigate to livestock detail
function viewLivestockDetail(id) {
    sessionStorage.setItem('selectedAnimal', id);
    window.location.href = 'livestock-detail.html';
}

// Show notifications
async function showNotifications() {
    const alerts = await getAlertsByFilter('all');
    if (!alerts.length) {
        alert('Notifications:\n\nNo live alerts available from sensors yet.');
        return;
    }

    alert('Notifications:\n\n' + alerts.map(a => `• ${a.title}`).join('\n'));
}

// Offline detection
function initOfflineDetection() {
    const offlineIndicator = document.getElementById('offlineIndicator');
    
    function updateOnlineStatus() {
        if (!navigator.onLine) {
            offlineIndicator.classList.add('show');
        } else {
            offlineIndicator.classList.remove('show');
        }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

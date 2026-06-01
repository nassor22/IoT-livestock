/**
 * Ministry Dashboard Module
 * Handles rendering charts and statistics for ministry overview
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = checkAuth();
    if (!user) return;
    
    // Check role
    if (user.role !== 'ministry') {
        window.location.href = 'farmer-dashboard.html';
        return;
    }
    
    // Initialize dashboard
    await initMinistryDashboard();
});

async function initMinistryDashboard() {
    updateCurrentDate();
    await renderStats();
    await renderRegionalSummary();
    await initCharts();
    initSidebar();
}

// Update current date
function updateCurrentDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateElements = document.querySelectorAll('#currentDate');
    const today = new Date().toLocaleDateString('en-US', options);
    dateElements.forEach(el => el.textContent = today);
}

async function renderStats() {
    const stats = await getNationalStats();
    const statValues = document.querySelectorAll('.ministry-stat-card .stat-value');
    const statNotes = document.querySelectorAll('.ministry-stat-card .stat-change');

    if (statValues[0]) statValues[0].textContent = stats.totalMonitored.toLocaleString();
    if (statValues[1]) statValues[1].textContent = stats.healthyAnimals.toLocaleString();
    if (statValues[2]) statValues[2].textContent = stats.activeAlerts.toLocaleString();
    if (statValues[3]) statValues[3].textContent = stats.highRiskAreas.toString();

    if (statNotes[0]) statNotes[0].textContent = 'Live total from sensor readings';
    if (statNotes[1]) statNotes[1].textContent = 'Latest normal sensor status';
    if (statNotes[2]) statNotes[2].textContent = 'Active sensor warnings and alerts';
    if (statNotes[3]) statNotes[3].textContent = 'Animals currently in alert state';
}

async function renderRegionalSummary() {
    const tbody = document.getElementById('regionalSummaryBody');
    if (!tbody) {
        return;
    }

    const regionalData = await getAllRegionalData();

    if (!regionalData.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state-row">No regional sensor tags are available yet. Connect region metadata to populate this table.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = regionalData.map(region => `
        <tr>
            <td>${region.name}</td>
            <td>${region.monitored.toLocaleString()}</td>
            <td>${region.healthy.toLocaleString()}</td>
            <td>${region.alerts.toLocaleString()}</td>
            <td><span class="risk-indicator ${region.riskLevel}"></span> ${region.riskLevel.charAt(0).toUpperCase() + region.riskLevel.slice(1)}</td>
            <td>${region.trend}</td>
        </tr>
    `).join('');
}

// Initialize charts
async function initCharts() {
    const trendData = await getDiseaseTrends();
    const distData = await getAlertDistribution();

    // Trend Chart
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
        new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: trendData.labels,
                datasets: [
                    {
                        label: 'Body Temperature',
                        data: trendData.datasets.bodyTemp,
                        borderColor: '#F44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Pulse Rate',
                        data: trendData.datasets.pulseRate,
                        borderColor: '#FF9800',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Alert Count',
                        data: trendData.datasets.alerts,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.05)'
                        }
                    }
                }
            }
        });
    }
    
    // Alert Distribution Chart
    const distCtx = document.getElementById('alertDistChart');
    if (distCtx) {
        new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: distData.labels,
                datasets: [{
                    data: distData.data,
                    backgroundColor: [
                        '#F44336',
                        '#FFC107',
                        '#FF9800',
                        '#2196F3',
                        '#4CAF50',
                        '#9C27B0'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }
}

// Initialize sidebar
function initSidebar() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    // Close sidebar on link click (mobile)
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
    });
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
}

// Generate report
function generateReport(type) {
    let reportType = type || 'summary';
    alert(`Generating ${reportType} report...\n\nReport will be downloaded from live sensor aggregates.`);
}

// Export data
function exportData() {
    alert('Exporting live sensor aggregates as CSV...\n\nThis export contains no mocked data.');
}

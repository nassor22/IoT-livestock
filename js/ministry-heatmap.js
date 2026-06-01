/**
 * Ministry Heat Map Module
 * Handles interactive heat map and risk visualization
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const user = checkAuth();
    if (!user) return;
    
    // Check role
    if (user.role !== 'ministry') {
        window.location.href = 'farmer-dashboard.html';
        return;
    }
    
    // Initialize heat map
    initHeatMap();
    initSidebar();
    updateCurrentDate();
});

// Initialize heat map interactions
function initHeatMap() {
    const mapRegions = document.querySelectorAll('.map-region');
    const tooltip = document.getElementById('mapTooltip');
    
    mapRegions.forEach(region => {
        region.addEventListener('mouseenter', function(e) {
            const regionId = this.dataset.region;
            const data = getRegionalData(regionId);
            
            document.getElementById('tooltipTitle').textContent = data ? data.name : this.textContent.trim();
            document.getElementById('tooltipAnimals').textContent = data ? data.monitored.toLocaleString() : '--';
            document.getElementById('tooltipAlerts').textContent = data ? data.alerts : '--';
            document.getElementById('tooltipRisk').textContent = data ? data.riskLevel.charAt(0).toUpperCase() + data.riskLevel.slice(1) : 'Unavailable';
            document.getElementById('tooltipTrend').textContent = data ? data.trend : 'No live regional data';

            const rect = this.getBoundingClientRect();
            tooltip.style.left = (rect.left + rect.width / 2 - 100) + 'px';
            tooltip.style.top = (rect.top - 150) + 'px';
            tooltip.classList.add('show');
        });
        
        region.addEventListener('mouseleave', function() {
            tooltip.classList.remove('show');
        });
        
        region.addEventListener('click', function() {
            const regionId = this.dataset.region;
            const data = getRegionalData(regionId);
            
            if (data) {
                alert(`Region: ${data.name}\n\n` +
                    `Monitored Animals: ${data.monitored.toLocaleString()}\n` +
                    `Active Alerts: ${data.alerts}\n` +
                    `Risk Level: ${data.riskLevel}\n` +
                    `Trend: ${data.trend}`);
            } else {
                alert('No live regional sensor data is available yet for this map view.');
            }
        });
    });
}

// Update current date
function updateCurrentDate() {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateElements = document.querySelectorAll('#currentDate');
    const today = new Date().toLocaleDateString('en-US', options);
    dateElements.forEach(el => el.textContent = today);
}

// Initialize sidebar
function initSidebar() {
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
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

// Export heat map
function exportHeatMap() {
    alert('Exporting heat map as PDF...\n\nThis view is currently awaiting live regional sensor tags.');
}

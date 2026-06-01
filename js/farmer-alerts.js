/**
 * Farmer Alerts Page Module
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
    
    // Initialize page
    initFilters();
    initSearch();
    await renderAlerts('all', '');
});

let activeFilter = 'all';
let activeQuery = '';

// Initialize filter tabs
function initFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            activeFilter = filter;
            renderAlerts(activeFilter, activeQuery);
        });
    });
}

// Render alerts list
async function renderAlerts(filter, query) {
    const container = document.getElementById('allAlertsList');
    const alerts = await getAlertsByFilter(filter);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredAlerts = alerts.filter(alert => {
        if (!normalizedQuery) return true;
        const title = alert.title.toLowerCase();
        const description = alert.description.toLowerCase();
        return title.includes(normalizedQuery) || description.includes(normalizedQuery);
    });

    if (!filteredAlerts.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No live alerts match your filter</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredAlerts.map(alert => {
        const isResolved = alert.type === 'resolved';
        const cardClass = isResolved ? 'resolved' : alert.type;
        const metaStatus = isResolved
            ? '<span class="sms-sent"><i class="fas fa-check-double"></i> Resolved</span>'
            : alert.smsSent
                ? '<span class="sms-sent"><i class="fas fa-check-circle"></i> SMS Sent</span>'
                : '<span><i class="fas fa-envelope"></i> SMS Pending</span>';

        return `
            <div class="alert-card ${cardClass}" data-status="${alert.type}">
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
                    ${metaStatus}
                </div>
            </div>
        `;
    }).join('');
}

// Initialize search
function initSearch() {
    const searchInput = document.getElementById('alertSearch');
    
    searchInput.addEventListener('input', function() {
        activeQuery = this.value;
        renderAlerts(activeFilter, activeQuery);
    });
}

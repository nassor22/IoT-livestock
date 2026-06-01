/**
 * Farmer Livestock List Page Module
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
    await initLivestockPage();
});

async function initLivestockPage() {
    await renderStats();
    await renderFullLivestockList('all');
    initFilters();
    initSearch();
}

// Render statistics
async function renderStats() {
    const stats = await getLivestockStats();
    document.getElementById('totalAnimals').textContent = stats.total;
    document.getElementById('warningCount').textContent = stats.warning;
    document.getElementById('alertCount').textContent = stats.alert;
}

// Render full livestock list
async function renderFullLivestockList(filter) {
    const container = document.getElementById('fullLivestockList');
    const livestock = await getLivestockByFilter(filter);
    
    if (livestock.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No live sensor animals found with this filter</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = livestock.map(animal => `
        <div class="livestock-item" onclick="viewLivestockDetail('${animal.id}')">
            <div class="livestock-icon">
                <i class="fas ${animal.icon}"></i>
            </div>
            <div class="livestock-info">
                <div class="livestock-id">${animal.id}</div>
                <div class="livestock-type">${animal.type} • ${animal.age}</div>
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

// Initialize filter tabs
function initFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            renderFullLivestockList(filter);
        });
    });
}

// Initialize search
function initSearch() {
    const searchInput = document.getElementById('livestockSearch');
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const items = document.querySelectorAll('.livestock-item');
        
        items.forEach(item => {
            const id = item.querySelector('.livestock-id').textContent.toLowerCase();
            const type = item.querySelector('.livestock-type').textContent.toLowerCase();
            
            if (id.includes(query) || type.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

// Navigate to livestock detail
function viewLivestockDetail(id) {
    sessionStorage.setItem('selectedAnimal', id);
    window.location.href = 'livestock-detail.html';
}

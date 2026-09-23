const token = localStorage.getItem('access_token');
const activeUser = JSON.parse(localStorage.getItem('activeUser') || '{}');

if (!token || activeUser.role !== 'admin') {
    window.location.href = 'index.html';
}

if (activeUser.name) {
    const adminNames = document.querySelectorAll('.desktop-user-info p:first-child');
    adminNames.forEach(el => el.textContent = activeUser.name);
    
    const dropdownName = document.getElementById('dropdown-full-name');
    if (dropdownName) dropdownName.textContent = activeUser.name;

    const dropdownEmail = document.getElementById('dropdown-email');
    if (dropdownEmail && activeUser.email) dropdownEmail.textContent = activeUser.email;

    const avatarImgs = document.querySelectorAll('#user-menu-btn img');
    avatarImgs.forEach(img => {
        img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser.name)}&background=EF4444&color=fff&bold=true`;
    });
}

function logoutUser() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('activeUser');
    window.location.href = 'index.html';
}

let revenueChartInstance = null;
let operationalChartInstance = null;

async function loadAnalyticsData() {
    const syncIcon = document.querySelector('button[onclick="loadAnalyticsData()"] i');
    const syncBtn = document.querySelector('button[onclick="loadAnalyticsData()"]');
    
    if (syncIcon) syncIcon.classList.add('animate-spin');
    if (syncBtn) syncBtn.disabled = true;
    
    if (window.showToast) {
        window.showToast("Synchronizing analytics database...", "info");
    }

    try {
        const res = await fetch('/api/v1/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                window.location.href = 'index.html';
            }
            throw new Error('Failed to load dashboard statistics.');
        }

        const json = await res.json();
        if (json.success && json.data) {
            const { dashboard_stats, revenue_chart } = json.data;

            // Update stats indicators
            document.getElementById('stat-users-count').textContent = dashboard_stats.total_users;
            document.getElementById('stat-mechanics-count').textContent = dashboard_stats.active_mechanics;
            document.getElementById('stat-requests-count').textContent = dashboard_stats.pending_requests;
            document.getElementById('stat-revenue-sum').textContent = `Rs. ${dashboard_stats.monthly_revenue.toLocaleString()}`;

            // Render Revenue Line Chart
            renderRevenueChart(revenue_chart);

            // Render Operational Resource distribution Chart
            renderOperationalChart(dashboard_stats);
            
            lucide.createIcons();

            if (window.showToast) {
                window.showToast("Analytics data synchronized successfully!", "success");
            }
        }
    } catch (err) {
        console.error(err);
        if (window.showToast) {
            window.showToast("Failed to synchronize analytics data.", "error");
        }
    } finally {
        if (syncIcon) syncIcon.classList.remove('animate-spin');
        if (syncBtn) syncBtn.disabled = false;
    }
}

function renderRevenueChart(chartData) {
    const canvas = document.getElementById('analyticsRevenueChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    const labels = chartData.map(item => item.date);
    const values = chartData.map(item => item.value);

    const isLight = document.body.classList.contains('light-mode');
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
    const textColor = isLight ? '#1F2937' : '#E5E7EB';

    revenueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue (Rs.)',
                data: values,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                pointHoverRadius: 8
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
                    beginAtZero: true,
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return 'Rs. ' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: textColor
                    }
                }
            }
        }
    });
}

function renderOperationalChart(stats) {
    const canvas = document.getElementById('operationalDistributionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (operationalChartInstance) {
        operationalChartInstance.destroy();
    }

    const isLight = document.body.classList.contains('light-mode');
    const textColor = isLight ? '#1F2937' : '#E5E7EB';

    operationalChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Total Customers', 'Active Mechanics', 'Unresolved Tasks'],
            datasets: [{
                data: [stats.total_users || 5, stats.active_mechanics || 2, stats.pending_requests || 1],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)', // Primary
                    'rgba(16, 185, 129, 0.8)', // Success
                    'rgba(245, 158, 11, 0.8)'  // Warning
                ],
                borderColor: isLight ? '#ffffff' : 'rgba(17, 24, 39, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 11
                        },
                        padding: 15
                    }
                }
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    loadAnalyticsData();

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            setTimeout(() => {
                const isLight = document.body.classList.contains('light-mode');
                themeBtn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
                lucide.createIcons();
                loadAnalyticsData();
            }, 50);
        });
    }

    if (window.innerWidth > 768) {
        const searchEl = document.querySelector('.desktop-search');
        if (searchEl) searchEl.style.display = 'block';
        const userInfoEl = document.querySelector('.desktop-user-info');
        if (userInfoEl) userInfoEl.style.display = 'block';
    }
    lucide.createIcons();
});

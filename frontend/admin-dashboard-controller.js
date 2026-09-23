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

async function loadDashboardData() {
    const syncIcon = document.querySelector('button[onclick="loadDashboardData()"] i');
    const syncBtn = document.querySelector('button[onclick="loadDashboardData()"]');
    
    if (syncIcon) syncIcon.classList.add('animate-spin');
    if (syncBtn) syncBtn.disabled = true;
    
    if (window.showToast) {
        window.showToast("Synchronizing system stats...", "info");
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
            const { dashboard_stats, recent_activity, revenue_chart, system_health } = json.data;

            document.getElementById('stat-total-users').textContent = dashboard_stats.total_users;
            document.getElementById('stat-active-mechanics').textContent = dashboard_stats.active_mechanics;
            document.getElementById('stat-pending-requests').textContent = dashboard_stats.pending_requests;
            document.getElementById('stat-monthly-revenue').textContent = `Rs. ${dashboard_stats.monthly_revenue.toLocaleString()}`;

            const tbody = document.getElementById('recent-activities-tbody');
            tbody.innerHTML = '';

            if (recent_activity.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">No recent activities logged in system audit.</td></tr>`;
            } else {
                recent_activity.forEach(act => {
                    const row = document.createElement('tr');
                    
                    let idCell = '';
                    if (act.entity_type === "ServiceRequest") {
                        idCell = `<span style="font-family: monospace; font-weight: 600; color: var(--primary);">SR-${act.entity_id}</span>`;
                    } else if (act.entity_type === "Vehicle") {
                        idCell = `<span style="font-family: monospace; font-weight: 600; color: var(--success);">VH-${act.entity_id}</span>`;
                    } else if (act.entity_type === "Invoice") {
                        idCell = `<span style="font-family: monospace; font-weight: 600; color: var(--warning);">INV-${act.entity_id}</span>`;
                    } else {
                        idCell = `<span style="font-family: monospace; font-weight: 600; color: var(--text-muted);">LOG-${act.id}</span>`;
                    }

                    let badgeClass = 'badge-pending';
                    if (act.action_type === 'payment_completed' || act.action_type === 'request_completed') {
                        badgeClass = 'badge-completed';
                    } else if (act.action_type === 'vehicle_added' || act.action_type === 'user_created') {
                        badgeClass = 'badge-progress';
                    }

                    const dateObj = new Date(act.created_at);
                    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

                    let actionBtn = '';
                    if (act.entity_type === "ServiceRequest") {
                        actionBtn = `<a href="admin-all-requests.html" class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; display: inline-block;">Manage</a>`;
                    } else if (act.entity_type === "User") {
                        actionBtn = `<a href="admin-users.html" class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; display: inline-block;">Manage</a>`;
                    } else {
                        actionBtn = `<button class="btn btn-outline" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="showLogDetails('${encodeURIComponent(act.description)}')">Log</button>`;
                    }

                    row.innerHTML = `
                        <td>${idCell}</td>
                        <td style="font-weight: 500;">${act.user_name}</td>
                        <td><span style="font-weight: 600; text-transform: uppercase; font-size: 0.75rem; color: var(--primary);">${act.action_type.replace(/_/g, ' ')}</span></td>
                        <td><span class="badge ${badgeClass}">${act.status || 'success'}</span></td>
                        <td style="color: var(--text-muted); font-size: 0.8rem;">${formattedDate}</td>
                        <td>${actionBtn}</td>
                    `;
                    tbody.appendChild(row);
                });
            }

            renderHealthBadge('health-database', system_health.database);
            renderHealthBadge('health-api', system_health.api);
            renderHealthBadge('health-storage', system_health.storage);
            renderHealthBadge('health-upload', system_health.upload_service);

            renderRevenueChart(revenue_chart);
            lucide.createIcons();
            
            if (window.showToast) {
                window.showToast("System overview statistics synchronized!", "success");
            }
        }
    } catch (err) {
        console.error(err);
        const tbody = document.getElementById('recent-activities-tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 3rem;">Error sync trailing system metrics: ${err.message}</td></tr>`;
        }
        if (window.showToast) {
            window.showToast("Failed to synchronize system stats.", "error");
        }
    } finally {
        if (syncIcon) syncIcon.classList.remove('animate-spin');
        if (syncBtn) syncBtn.disabled = false;
    }
}

function showLogDetails(desc) {
    alert("Audit Trail Event Details:\n\n" + decodeURIComponent(desc));
}

function renderHealthBadge(elementId, status) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = status === 'healthy' ? 'Healthy' : 'Problem';
    if (status === 'healthy') {
        el.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
        el.style.color = "var(--success)";
        el.style.border = "1px solid var(--success)";
    } else {
        el.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
        el.style.color = "var(--danger)";
        el.style.border = "1px solid var(--danger)";
    }
}

let revenueChartInstance = null;
function renderRevenueChart(chartData) {
    const canvas = document.getElementById('revenueChartCanvas');
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

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            // Let app.js toggle the class first, then update chart styling
            setTimeout(() => {
                const isLight = document.body.classList.contains('light-mode');
                themeBtn.innerHTML = `<i data-lucide="${isLight ? 'moon' : 'sun'}"></i>`;
                lucide.createIcons();
                const data = revenueChartInstance ? revenueChartInstance.data.datasets[0].data : [];
                const labels = revenueChartInstance ? revenueChartInstance.data.labels : [];
                if (data.length > 0) {
                    const chartData = labels.map((lbl, idx) => ({ date: lbl, value: data[idx] }));
                    renderRevenueChart(chartData);
                }
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

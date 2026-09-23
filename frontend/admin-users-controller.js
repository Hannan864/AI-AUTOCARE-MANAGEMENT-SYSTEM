async function loadSystemRegistries() {
    const tBody = document.getElementById('users-tbody');
    if (tBody) {
        tBody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 4rem;">
                    <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
                    <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem;">Retrieving real-time registry credentials database...</p>
                </td>
            </tr>
        `;
    }

    try {
        const searchParams = new URLSearchParams({
            page: currentPage.toString(),
            limit: currentLimit.toString(),
            ...queryParams
        });

        const response = await fetch(`/api/v1/admin/users?${searchParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("HTTP connection error loading users registry database files");

        const payload = await response.json();
        if (payload.success) {
            renderUsersTable(payload.users);
            renderPaginationElements(payload.pagination);
            updateStatsGrid();
        } else {
            notify(payload.message || "Failed to load database registries", "error");
        }
    } catch (err) {
        console.error(err);
        notify(err.message, "error");
        if (tBody) {
            tBody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--danger); padding: 4rem;">Failure fetching live users: ${err.message}</td></tr>`;
        }
    }
}
window.loadSystemRegistries = loadSystemRegistries;

async function updateStatsGrid() {
    try {
        const resp = await fetch('/api/v1/admin/dashboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
            const json = await resp.json();
            if (json.success) {
                const resAll = await fetch('/api/v1/admin/users?limit=100000', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resAll.ok) {
                    const allData = await resAll.json();
                    if (allData.success) {
                        const list = allData.users;
                        document.getElementById('stat-total').textContent = list.length;
                        document.getElementById('stat-active').textContent = list.filter(u => u.status === 'ACTIVE').length;
                        document.getElementById('stat-suspended').textContent = list.filter(u => u.status === 'SUSPENDED').length;
                        document.getElementById('stat-blocked').textContent = list.filter(u => u.status === 'BLOCKED').length;
                    }
                }
            }
        }
    } catch (err) {
        console.error("Metric sync warning:", err);
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 4rem; color: var(--text-muted);">
                    <i data-lucide="inbox" style="width: 32px; height: 32px; margin: 0 auto 0.75rem;"></i>
                    <p style="font-size: 0.875rem;">No registered individuals matching strict queries criteria found.</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    users.forEach(user => {
        const row = document.createElement('tr');
        const statusLcase = (user.status || 'ACTIVE').toLowerCase();
        let statusLabel = user.status || 'ACTIVE';
        const createdDate = new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const loginDate = user.last_login ? new Date(user.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : 'Never';

        let roleColor = 'var(--text-muted)';
        if (user.role === 'ADMIN') roleColor = 'var(--danger)';
        else if (user.role === 'MECHANIC') roleColor = 'var(--success)';
        else if (user.role === 'WORKSHOP_MANAGER') roleColor = 'var(--primary)';

        row.innerHTML = `
            <td>
                <img src="${user.profile_image}" class="user-avatar-cell" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&background=6366F1&color=fff'">
            </td>
            <td style="font-weight: 600;">${user.full_name}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${user.email}</td>
            <td style="font-family: monospace; font-size: 0.85rem;">${user.phone_number}</td>
            <td>
                <span style="font-size: 0.75rem; font-weight: 700; color: ${roleColor}; letter-spacing: 0.05em;">${user.role}</span>
            </td>
            <td style="text-align: center; font-weight: 500">${user.vehiclesCount || 0}</td>
            <td style="text-align: center; font-weight: 500">${user.repairRequestsCount || 0}</td>
            <td style="text-align: center; font-weight: 500">${user.recoveryRequestsCount || 0}</td>
            <td>
                <span class="badge-status ${statusLcase}">${statusLabel}</span>
            </td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${createdDate}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${loginDate}</td>
            <td style="text-align: right;">
                <div class="dropdown-actions">
                    <button class="btn btn-outline" style="padding: 0.25rem 0.5rem;"><i data-lucide="more-horizontal"></i></button>
                    <div class="dropdown-actions-menu">
                        <button onclick="viewUserDetail(${user.id})"><i data-lucide="eye" style="color: var(--primary);"></i> View Portfolio</button>
                        <button onclick="openEditUserModal(${user.id})"><i data-lucide="edit-2"></i> Edit Record</button>
                        <button onclick="patchUserStatus(${user.id}, 'activate')"><i data-lucide="check-circle" style="color: var(--success);"></i> Activate Profile</button>
                        <button onclick="patchUserStatus(${user.id}, 'suspend')"><i data-lucide="pause-circle" style="color: var(--warning);"></i> Suspend</button>
                        <button onclick="patchUserStatus(${user.id}, 'block')"><i data-lucide="slash" style="color: var(--danger);"></i> Block Account</button>
                        <button onclick="patchUserStatus(${user.id}, 'unlock')"><i data-lucide="unlock"></i> Unlock attempts</button>
                        <button onclick="triggerPasswordReset(${user.id})"><i data-lucide="key"></i> Reset Password</button>
                        <button class="danger" onclick="triggerDeleteUser(${user.id})"><i data-lucide="trash-2" style="color: var(--danger);"></i> Purge user</button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
    lucide.createIcons();
}

function renderPaginationElements(pag) {
    const start = pag.total === 0 ? 0 : (pag.page - 1) * pag.limit + 1;
    const end = Math.min(pag.page * pag.limit, pag.total);
    document.getElementById('pagination-info').textContent = `Showing indexes ${start} to ${end} of ${pag.total} registrations`;

    const btns = document.getElementById('pagination-btns');
    btns.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'btn btn-outline';
    prev.disabled = pag.page === 1;
    prev.innerHTML = `&larr; Prev`;
    prev.onclick = () => { if (currentPage > 1) { currentPage--; loadSystemRegistries(); } };
    btns.appendChild(prev);

    for (let i = 1; i <= pag.pages; i++) {
        const pBtn = document.createElement('button');
        pBtn.className = `btn ${i === pag.page ? 'btn-primary' : 'btn-outline'}`;
        pBtn.style.padding = '0.35rem 0.6rem';
        pBtn.textContent = i.toString();
        pBtn.onclick = () => { currentPage = i; loadSystemRegistries(); };
        btns.appendChild(pBtn);
    }

    const next = document.createElement('button');
    next.className = 'btn btn-outline';
    next.disabled = pag.page === pag.pages;
    next.innerHTML = `Next &rarr;`;
    next.onclick = () => { if (currentPage < pag.pages) { currentPage++; loadSystemRegistries(); } };
    btns.appendChild(next);
}

// Basic setup for filters
const searchEl = document.getElementById('filter-search');
const roleEl = document.getElementById('filter-role');
const statusEl = document.getElementById('filter-status');
const cityEl = document.getElementById('filter-city');
const startEl = document.getElementById('filter-start-date');
const endEl = document.getElementById('filter-end-date');

const updateFilters = () => {
    if (searchEl) queryParams.search = searchEl.value;
    if (roleEl) queryParams.role = roleEl.value;
    if (statusEl) queryParams.status = statusEl.value;
    if (cityEl) queryParams.city = cityEl.value;
    if (startEl) queryParams.startDate = startEl.value;
    if (endEl) queryParams.endDate = endEl.value;
    currentPage = 1;
    loadSystemRegistries();
};

if (searchEl) {
    let timer;
    searchEl.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(updateFilters, 300);
    });
}
if (roleEl) roleEl.addEventListener('change', updateFilters);
if (statusEl) statusEl.addEventListener('change', updateFilters);
if (cityEl) cityEl.addEventListener('change', updateFilters);
if (startEl) startEl.addEventListener('change', updateFilters);
if (endEl) endEl.addEventListener('change', updateFilters);

loadSystemRegistries();

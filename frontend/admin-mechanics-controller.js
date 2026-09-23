document.addEventListener('DOMContentLoaded', () => {
    // 1. Hook up filters
    setupFilters();

    // 2. Load initially
    loadMechanicRegistries();

    // 3. Setup form submissions
    const addForm = document.getElementById('add-mechanic-form');
    if (addForm) addForm.addEventListener('submit', handleAddMechanicSubmit);

    const editForm = document.getElementById('edit-mechanic-form');
    if (editForm) editForm.addEventListener('submit', handleEditMechanicSubmit);

    const assignForm = document.getElementById('assign-job-form');
    if (assignForm) assignForm.addEventListener('submit', handleAssignJobSubmit);
});

function setupFilters() {
    const searchEl = document.getElementById('filter-search');
    const specEl = document.getElementById('filter-specialization');
    const statEl = document.getElementById('filter-status');
    const availEl = document.getElementById('filter-availability');
    const workEl = document.getElementById('filter-workshop');
    const ratEl = document.getElementById('filter-rating');
    const expEl = document.getElementById('filter-experience');

    const updateFilters = () => {
        queryParams.search = searchEl.value;
        queryParams.specialization = specEl.value;
        queryParams.status = statEl.value;
        queryParams.availability = availEl.value;
        queryParams.workshop_id = workEl.value;
        queryParams.rating = ratEl.value;
        queryParams.experience = expEl.value;
        currentPage = 1;
        loadMechanicRegistries();
    };

    if (searchEl) searchEl.addEventListener('input', debounce(updateFilters, 300));
    if (specEl) specEl.addEventListener('change', updateFilters);
    if (statEl) statEl.addEventListener('change', updateFilters);
    if (availEl) availEl.addEventListener('change', updateFilters);
    if (workEl) workEl.addEventListener('change', updateFilters);
    if (ratEl) ratEl.addEventListener('change', updateFilters);
    if (expEl) expEl.addEventListener('change', updateFilters);
}

function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

function loadMechanicRegistries() {
    renderSkeletons();
    updateLivePerformanceStats();

    const searchParams = new URLSearchParams({
        page: currentPage,
        limit: currentLimit,
        ...queryParams
    });

    fetch(`/api/v1/admin/mechanics?${searchParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error("Faulty response payload while loading mechanic registry list");
        return res.json();
    })
    .then(payload => {
        if (!payload.success) throw new Error(payload.message || "Failed to load mechanics.");
        renderMechanicTable(payload.mechanics);
        renderPagination(payload.pagination);
    })
    .catch(err => {
        renderErrorState(err.message);
    });
}

function updateLivePerformanceStats() {
    fetch('/api/v1/admin/mechanics/performance', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(payload => {
        if (!payload.success) return;
        const d = payload.data;

        // Auto-update stats DOM counters
        const activeCount = document.getElementById('stat-active-count');
        const availCount = document.getElementById('stat-available-count');
        const busyCount = document.getElementById('stat-busy-count');
        const jobsAssigned = document.getElementById('stat-assigned-jobs-count');
        const jobsCompleted = document.getElementById('stat-completed-jobs-count');

        if (activeCount) activeCount.textContent = d.active_mechanics;
        if (availCount) availCount.textContent = d.available_mechanics;
        if (busyCount) busyCount.textContent = d.busy_mechanics;

        // Calculate total jobs assigned and completed from detailed mechanics table
        const totalAssignedSum = d.mechanic_table ? d.mechanic_table.reduce((sum, m) => sum + (m.total_jobs_assigned || 0), 0) : 0;
        const totalCompletedSum = d.mechanic_table ? d.mechanic_table.reduce((sum, m) => sum + (m.completed_jobs || 0), 0) : 0;

        if (jobsAssigned) jobsAssigned.textContent = totalAssignedSum;
        if (jobsCompleted) jobsCompleted.textContent = totalCompletedSum;
    })
    .catch(err => {
        console.warn("Could not synchronize live dashboard performance statistics dynamically", err);
    });
}

function renderSkeletons() {
    const tbody = document.getElementById('mechanic-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        tbody.innerHTML += `
            <tr>
                <td colspan="12" style="padding: 1rem;">
                    <div class="skeleton-el" style="height: 32px; width: 100%;"></div>
                </td>
            </tr>
        `;
    }
}

function renderErrorState(message) {
    const tbody = document.getElementById('mechanic-table-body');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 2.5rem; color: var(--danger);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                        <i data-lucide="alert-circle" style="width: 32px; height: 32px;"></i>
                        <p style="font-weight: 600; font-size: 0.95rem;">Service Interruption Error</p>
                        <p style="font-size: 0.825rem; color: var(--text-muted);">${message}</p>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) lucide.createIcons();
    }
}

function renderMechanicTable(mechanics) {
    const tbody = document.getElementById('mechanic-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!mechanics || mechanics.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                        <i data-lucide="inbox" style="width: 32px; height: 32px;"></i>
                        <p style="font-weight: 500; font-size: 0.9rem;">No Matching Mechanics Registered</p>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    mechanics.forEach(m => {
        // Specialization badges
        const specs = m.specialization ? m.specialization.join(', ') : 'General Care';
        const ratingStars = `<i data-lucide="star" style="width: 14px; height: 14px; fill: #FBBF24; color: #FBBF24; display: inline-block; vertical-align: middle;"></i> ${m.rating.toFixed(1)}`;

        tbody.innerHTML += `
            <tr style="cursor: pointer;" onclick="openDetailDrawer(${m.id})">
                <td onclick="event.stopPropagation(); openDetailDrawer(${m.id})" style="font-weight: 500; display: flex; align-items: center; gap: 0.75rem; min-height: 54px;">
                    <img class="user-avatar-cell" src="${m.profile_image}" alt="${m.full_name}">
                    <span style="font-weight: 600; color: var(--text);">${m.full_name}</span>
                </td>
                <td style="font-family: var(--font-mono); font-size: 0.775rem;">${m.employee_code}</td>
                <td>${m.phone_number}</td>
                <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${specs}</td>
                <td style="text-align: center;">${m.experience_years}y</td>
                <td style="text-align: center; font-weight: 600; color: var(--primary);">${m.pending_jobs_count || 0}</td>
                <td style="text-align: center;" class="text-success font-semibold">${m.completed_jobs_count || 0}</td>
                <td>${ratingStars}</td>
                <td><span class="badge-avail ${m.availability_status.toLowerCase()}">${m.availability_status}</span></td>
                <td><span class="badge-status ${m.current_status.toLowerCase()}">${m.current_status}</span></td>
                <td onclick="event.stopPropagation()">
                    <div style="display: flex; gap: 0.25rem;">
                        <div class="dropdown-actions">
                            <button class="btn btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;">
                                Actions <i data-lucide="chevron-down" style="width: 12px; height: 12px; display: inline-block;"></i>
                            </button>
                            <div class="dropdown-actions-menu">
                                <button onclick="openDetailDrawer(${m.id})"><i data-lucide="user"></i> Performance</button>
                                <button onclick="openEditModal(${m.id})"><i data-lucide="edit"></i> Modify Profile</button>
                                <button onclick="openAssignJobModal(${m.id}, '${m.full_name}')" ${m.current_status === 'ACTIVE' && m.availability_status === 'AVAILABLE' ? '' : 'style="opacity: 0.5;"'}><i data-lucide="share-2"></i> Dispatch Job</button>
                                
                                <hr style="border: none; border-top: 1px solid var(--border); margin: 0.25rem 0;">
                                
                                <!-- Status Triggers -->
                                ${m.current_status === 'ACTIVE' ? `
                                    <button onclick="changeStatus(${m.id}, '${m.full_name}', 'suspended')" style="color: var(--warning);"><i data-lucide="alert-triangle"></i> Suspend</button>
                                    <button onclick="changeStatus(${m.id}, '${m.full_name}', 'blocked')" style="color: var(--danger);"><i data-lucide="shield-alert"></i> Block Account</button>
                                ` : `
                                    <button onclick="changeStatus(${m.id}, '${m.full_name}', 'active')" style="color: var(--success);"><i data-lucide="check-circle"></i> Activate Professional</button>
                                `}

                                <!-- Availability Triggers -->
                                ${m.availability_status === 'AVAILABLE' ? `
                                    <button onclick="changeAvailability(${m.id}, '${m.full_name}', 'off_leave')"><i data-lucide="calendar"></i> Set On Leave</button>
                                    <button onclick="changeAvailability(${m.id}, '${m.full_name}', 'offline')"><i data-lucide="moon"></i> Set Offline</button>
                                ` : `
                                    <button onclick="changeAvailability(${m.id}, '${m.full_name}', 'available')" style="color: var(--success);"><i data-lucide="smile"></i> Set Available</button>
                                `}
                            </div>
                        </div>
                        <button onclick="deleteMechanic(${m.id}, \`${m.full_name.replace(/`/g, '')}\`)" class="btn btn-outline" style="padding: 0.3rem 0.5rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.2);" title="Delete Mechanic">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    if (window.lucide) {
        lucide.createIcons();
    }
}

function renderPagination(p) {
    const info = document.getElementById('pagination-info');
    const container = document.getElementById('pagination-btns');
    if (!info || !container) return;

    if (!p || p.total === 0) {
        info.textContent = '';
        container.innerHTML = '';
        return;
    }

    const start = (p.page - 1) * p.limit + 1;
    const end = Math.min(start + p.limit - 1, p.total);
    info.textContent = `Showing details ${start}-${end} of ${p.total} profiles`;

    container.innerHTML = `
        <button class="btn btn-outline" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;" ${p.page <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="changePage(${p.page - 1})">
            Previous
        </button>
        <button class="btn btn-primary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; margin-left: 0.25rem;" ${p.page >= p.pages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''} onclick="changePage(${p.page + 1})">
            Next
        </button>
    `;
}

function changePage(newPage) {
    currentPage = newPage;
    loadMechanicRegistries();
}

window.loadMechanicRegistries = loadMechanicRegistries;

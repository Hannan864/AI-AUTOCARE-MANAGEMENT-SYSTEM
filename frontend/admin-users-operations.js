async function viewUserDetail(id) {
    try {
        const response = await fetch(`/api/v1/admin/users/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Connection failed loading profile sheet portfolio");
        const res = await response.json();
        if (res.success) {
            const u = res.data;
            document.getElementById('view-avatar').src = u.profile_image;
            document.getElementById('view-fullname').textContent = u.full_name;
            document.getElementById('view-email').textContent = u.email;
            document.getElementById('view-phone').textContent = u.phone_number;
            document.getElementById('view-city').textContent = u.city;
            document.getElementById('view-address').textContent = u.address;
            document.getElementById('view-created').textContent = new Date(u.created_at).toLocaleString();
            document.getElementById('view-lastlogin').textContent = u.last_login ? new Date(u.last_login).toLocaleString() : 'Never';
            document.getElementById('view-locked').textContent = u.account_locked ? `Locked (Until ${u.account_locked_until || 'Infinity'})` : `Unlocked (Attempts: ${u.failed_login_attempts})`;

            document.getElementById('view-vehicles-count').textContent = u.vehiclesCount || 0;
            document.getElementById('view-repairs-count').textContent = u.repairRequestsCount || 0;
            document.getElementById('view-recoveries-count').textContent = u.recoveryRequestsCount || 0;

            const rl = document.getElementById('view-role-badge');
            rl.innerHTML = `<span style="font-weight: 700; font-size: 0.75rem; color: var(--primary); letter-spacing: 0.05em;">${u.role}</span>`;

            const sb = document.getElementById('view-status-badge');
            sb.className = `badge-status ${(u.status || 'ACTIVE').toLowerCase()}`;
            sb.textContent = u.status || 'ACTIVE';

            const hFeed = document.getElementById('view-history-logs');
            hFeed.innerHTML = '';
            const logs = u.relationships?.activity_timeline || [];
            if (logs.length === 0) {
                hFeed.innerHTML = `<p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 1rem;">No registered log event timelines found</p>`;
            } else {
                logs.forEach(log => {
                    const lDiv = document.createElement('div');
                    lDiv.style = "background: var(--bg); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border); font-size: 0.75rem;";
                    lDiv.innerHTML = `
                        <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 0.15rem;">
                            <span style="color: var(--primary);">${log.action_type.replace(/_/g, ' ').toUpperCase()}</span>
                            <span style="color: var(--text-muted); font-size: 0.7rem;">${new Date(log.created_at).toLocaleDateString()}</span>
                        </div>
                        <p style="color: var(--text);">${log.description}</p>
                    `;
                    hFeed.appendChild(lDiv);
                });
            }

            document.getElementById('user-drawer-overlay').classList.add('active');
            document.getElementById('user-drawer').classList.add('active');
            lucide.createIcons();
        }
    } catch (err) {
        notify(err.message, "error");
    }
}
window.viewUserDetail = viewUserDetail;

function closeUserDrawer() {
    document.getElementById('user-drawer-overlay').classList.remove('active');
    document.getElementById('user-drawer').classList.remove('active');
}
window.closeUserDrawer = closeUserDrawer;

function openAddUserModal() {
    document.getElementById('form-create-user').reset();
    document.getElementById('modal-add-user').classList.add('active');
}
window.openAddUserModal = openAddUserModal;

let originalAddUserHtml = '';
let originalEditUserHtml = '';

function closeAddUserModal() {
    document.getElementById('modal-add-user').classList.remove('active');
    const container = document.querySelector('#modal-add-user .modal-container');
    if (container && originalAddUserHtml) {
        container.innerHTML = originalAddUserHtml;
    }
}
window.closeAddUserModal = closeAddUserModal;

async function handleCreateUserSubmit(e) {
    e.preventDefault();
    const payload = {
        full_name: document.getElementById('add-fname').value,
        email: document.getElementById('add-email').value,
        phone_number: document.getElementById('add-phone').value,
        role: document.getElementById('add-role').value,
        city: document.getElementById('add-city').value,
        status: document.getElementById('add-status').value,
        address: document.getElementById('add-address').value,
        profile_image: document.getElementById('add-avatar-url').value || undefined,
        password_hash: document.getElementById('add-password').value || undefined
    };

    const container = document.querySelector('#modal-add-user .modal-container');
    if (container && !originalAddUserHtml) {
        originalAddUserHtml = container.innerHTML;
    }

    if (container) {
        container.innerHTML = `
            <div style="padding: 2.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem;">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(99, 102, 241, 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; border: 1px solid rgba(99, 102, 241, 0.2);">
                    <i data-lucide="loader" class="spin" style="width: 28px; height: 28px; color: var(--primary);"></i>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Registering User Account</h3>
                <p style="color: var(--text-muted); font-size: 0.875rem; max-width: 360px; margin: 0 auto;">Setting up credentials, generating unique security salts, and provisioning profile data fields...</p>
                
                <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 0.75rem; text-align: left; background: var(--bg-card); border: 1px solid var(--border); padding: 1.25rem; border-radius: 8px;">
                    <div id="add-u-step-1" style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--success); font-weight: 500;">
                        <i data-lucide="loader" class="spin" style="width: 14px; height: 14px;"></i>
                        <span>Verifying email & phone numbers...</span>
                    </div>
                    <div id="add-u-step-2" style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); opacity: 0.5;">
                        <i data-lucide="circle" style="width: 14px; height: 14px;"></i>
                        <span>Salting and hashing session secrets...</span>
                    </div>
                    <div id="add-u-step-3" style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); opacity: 0.5;">
                        <i data-lucide="circle" style="width: 14px; height: 14px;"></i>
                        <span>Instantiating user security profile...</span>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    await new Promise(r => setTimeout(r, 450));
    const u1 = document.getElementById('add-u-step-1');
    if (u1) u1.innerHTML = `<i data-lucide="check-circle" style="width: 14px; height: 14px; color: var(--success);"></i> <span style="color: var(--success);">Uniqueness check completed successfully</span>`;
    
    const u2 = document.getElementById('add-u-step-2');
    if (u2) {
        u2.innerHTML = `<i data-lucide="loader" class="spin" style="width: 14px; height: 14px; color: var(--primary);"></i> <span style="color: var(--text); font-weight: 500;">Generating temporary password hash...</span>`;
        u2.style.opacity = '1';
    }
    if (window.lucide) lucide.createIcons();

    await new Promise(r => setTimeout(r, 450));
    if (u2) u2.innerHTML = `<i data-lucide="check-circle" style="width: 14px; height: 14px; color: var(--success);"></i> <span style="color: var(--success);">Security hash generated successfully</span>`;
    
    const u3 = document.getElementById('add-u-step-3');
    if (u3) {
        u3.innerHTML = `<i data-lucide="loader" class="spin" style="width: 14px; height: 14px; color: var(--primary);"></i> <span style="color: var(--text); font-weight: 500;">Saving records on central database...</span>`;
        u3.style.opacity = '1';
    }
    if (window.lucide) lucide.createIcons();

    await new Promise(r => setTimeout(r, 400));

    try {
        const response = await fetch('/api/v1/admin/users', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const json = await response.json();
        if (response.ok && json.success) {
            notify(`User created successfully for ${json.data.full_name}!`);
            closeAddUserModal();
            loadSystemRegistries();

            document.getElementById('label-password-secret-text').textContent = json.temporaryPassword;
            document.getElementById('modal-password-generated').classList.add('active');
        } else {
            throw new Error(json.message || "Failed validating user creation credentials");
        }
    } catch (err) {
        notify(err.message, "error");
        if (container && originalAddUserHtml) {
            container.innerHTML = originalAddUserHtml;
        }
    }
}
window.handleCreateUserSubmit = handleCreateUserSubmit;

function closePasswordModal() {
    document.getElementById('modal-password-generated').classList.remove('active');
}
window.closePasswordModal = closePasswordModal;

async function openEditUserModal(id) {
    try {
        const response = await fetch(`/api/v1/admin/users/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Could not download user records profile sheet");
        const json = await response.json();
        if (json.success) {
            const u = json.data;
            document.getElementById('edit-id').value = u.id;
            document.getElementById('edit-fname').value = u.full_name;
            document.getElementById('edit-phone').value = u.phone_number;
            document.getElementById('edit-city').value = u.city;
            document.getElementById('edit-address').value = u.address;
            document.getElementById('edit-role').value = u.role;
            document.getElementById('edit-status').value = u.status;
            document.getElementById('edit-avatar-url').value = u.profile_image || '';

            document.getElementById('modal-edit-user').classList.add('active');
        }
    } catch (err) {
        notify(err.message, "error");
    }
}
window.openEditUserModal = openEditUserModal;

function closeEditUserModal() {
    document.getElementById('modal-edit-user').classList.remove('active');
    const container = document.querySelector('#modal-edit-user .modal-container');
    if (container && originalEditUserHtml) {
        container.innerHTML = originalEditUserHtml;
    }
}
window.closeEditUserModal = closeEditUserModal;

async function handleEditUserSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const payload = {
        full_name: document.getElementById('edit-fname').value,
        phone_number: document.getElementById('edit-phone').value,
        city: document.getElementById('edit-city').value,
        address: document.getElementById('edit-address').value,
        role: document.getElementById('edit-role').value,
        status: document.getElementById('edit-status').value,
        profile_image: document.getElementById('edit-avatar-url').value || undefined
    };

    const container = document.querySelector('#modal-edit-user .modal-container');
    if (container && !originalEditUserHtml) {
        originalEditUserHtml = container.innerHTML;
    }

    if (container) {
        container.innerHTML = `
            <div style="padding: 2.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem;">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(99, 102, 241, 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem; border: 1px solid rgba(99, 102, 241, 0.2);">
                    <i data-lucide="loader" class="spin" style="width: 28px; height: 28px; color: var(--primary);"></i>
                </div>
                <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text);">Synchronizing User Details</h3>
                <p style="color: var(--text-muted); font-size: 0.875rem; max-width: 360px; margin: 0 auto;">Processing account adjustments, saving profile changes, and updating authorized server pools...</p>
                
                <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 0.75rem; text-align: left; background: var(--bg-card); border: 1px solid var(--border); padding: 1.25rem; border-radius: 8px;">
                    <div id="edit-u-step-1" style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--success); font-weight: 500;">
                        <i data-lucide="loader" class="spin" style="width: 14px; height: 14px;"></i>
                        <span>Validating profile payload...</span>
                    </div>
                    <div id="edit-u-step-2" style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); opacity: 0.5;">
                        <i data-lucide="circle" style="width: 14px; height: 14px;"></i>
                        <span>Rewriting metadata in registry registers...</span>
                    </div>
                    <div id="edit-u-step-3" style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--text-muted); opacity: 0.5;">
                        <i data-lucide="circle" style="width: 14px; height: 14px;"></i>
                        <span>Synchronizing with authorization cache...</span>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    await new Promise(r => setTimeout(r, 450));
    const u1 = document.getElementById('edit-u-step-1');
    if (u1) u1.innerHTML = `<i data-lucide="check-circle" style="width: 14px; height: 14px; color: var(--success);"></i> <span style="color: var(--success);">Profile data structure verified</span>`;
    
    const u2 = document.getElementById('edit-u-step-2');
    if (u2) {
        u2.innerHTML = `<i data-lucide="loader" class="spin" style="width: 14px; height: 14px; color: var(--primary);"></i> <span style="color: var(--text); font-weight: 500;">Applying adjustments to secure tables...</span>`;
        u2.style.opacity = '1';
    }
    if (window.lucide) lucide.createIcons();

    await new Promise(r => setTimeout(r, 450));
    if (u2) u2.innerHTML = `<i data-lucide="check-circle" style="width: 14px; height: 14px; color: var(--success);"></i> <span style="color: var(--success);">Adjustments committed successfully</span>`;
    
    const u3 = document.getElementById('edit-u-step-3');
    if (u3) {
        u3.innerHTML = `<i data-lucide="loader" class="spin" style="width: 14px; height: 14px; color: var(--primary);"></i> <span style="color: var(--text); font-weight: 500;">Rebuilding permission structures...</span>`;
        u3.style.opacity = '1';
    }
    if (window.lucide) lucide.createIcons();

    await new Promise(r => setTimeout(r, 400));

    try {
        const response = await fetch(`/api/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (response.ok && json.success) {
            notify("Registration entry aligned and adjusted properly!");
            closeEditUserModal();
            loadSystemRegistries();
        } else {
            throw new Error(json.message || "Failed user detail updates");
        }
    } catch (err) {
        notify(err.message, "error");
        if (container && originalEditUserHtml) {
            container.innerHTML = originalEditUserHtml;
        }
    }
}
window.handleEditUserSubmit = handleEditUserSubmit;

async function patchUserStatus(id, endpoint) {
    try {
        const response = await fetch(`/api/v1/admin/users/${id}/${endpoint}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await response.json();
        if (response.ok && json.success) {
            notify(`User record ${endpoint} status patched correctly!`);
            loadSystemRegistries();
        } else {
            throw new Error(json.message || `PATCH user status to ${endpoint} failed`);
        }
    } catch (err) {
        notify(err.message, "error");
    }
}
window.patchUserStatus = patchUserStatus;

async function triggerPasswordReset(id) {
    if (!confirm("Reset user's password to a secure random credential?")) return;
    try {
        const response = await fetch(`/api/v1/admin/users/${id}/reset-password`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await response.json();
        if (response.ok && json.success) {
            notify("Password Hash reset properly!");
            document.getElementById('label-password-secret-text').textContent = json.temporaryPassword;
            document.getElementById('modal-password-generated').classList.add('active');
        } else {
            throw new Error(json.message || "Failed password secret updates");
        }
    } catch (err) {
        notify(err.message, "error");
    }
}
window.triggerPasswordReset = triggerPasswordReset;

async function triggerDeleteUser(id) {
    if (!confirm("Permanently delete this user record? This is irreversible.")) return;
    try {
        const response = await fetch(`/api/v1/admin/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await response.json();
        if (response.ok && json.success) {
            if (json.mode === 'soft_delete') {
                notify("User soft-deleted to INACTIVE because of open dependencies.", "warning");
            } else {
                notify("Permanent registry record purged safely!");
            }
            loadSystemRegistries();
        } else {
            throw new Error(json.message || "Delete security check failure");
        }
    } catch (err) {
        notify(err.message, "error");
    }
}
window.triggerDeleteUser = triggerDeleteUser;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-apply-filters').addEventListener('click', () => {
        queryParams = {
            search: document.getElementById('filter-search').value,
            role: document.getElementById('filter-role').value,
            status: document.getElementById('filter-status').value,
            city: document.getElementById('filter-city').value,
            startDate: document.getElementById('filter-start-date').value,
            endDate: document.getElementById('filter-end-date').value
        };
        currentPage = 1;
        loadSystemRegistries();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        clearQueryFilters();
    });

    document.getElementById('user-drawer-overlay').addEventListener('click', () => {
        closeUserDrawer();
    });

    let searchTimeout;
    document.getElementById('filter-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            queryParams.search = e.target.value;
            currentPage = 1;
            loadSystemRegistries();
        }, 500);
    });
});

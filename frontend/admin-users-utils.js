const token = localStorage.getItem('access_token');
const activeUser = JSON.parse(localStorage.getItem('activeUser') || '{}');

if (!token || activeUser.role !== 'admin') {
    window.location.href = 'index.html';
}

const topEl = document.getElementById('user-avatar-top');
if (topEl) {
    topEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser.name || 'System Admin')}&background=EF4444&color=fff&bold=true`;
}

let currentPage = 1;
let currentLimit = 10;
let queryParams = {
    search: '',
    role: '',
    status: '',
    city: '',
    startDate: '',
    endDate: ''
};

function notify(message, type = "success") {
    const container = document.getElementById('toast-anchoring-grid');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    else if (type === 'error') icon = 'alert-triangle';
    else if (type === 'warning') icon = 'alert-circle';

    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i data-lucide="${icon}"></i>
            <span style="font-size: 0.85rem; font-weight: 500;">${message}</span>
        </div>
        <button style="background: none; border: none; cursor: pointer; color: var(--text-muted);" onclick="this.parentElement.remove()">&times;</button>
    `;
    container.appendChild(toast);
    if (window.lucide) {
        lucide.createIcons();
    }

    setTimeout(() => {
        toast.style.animation = 'none';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

function clearQueryFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-role').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-city').value = '';
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';

    queryParams = { search: '', role: '', status: '', city: '', startDate: '', endDate: '' };
    currentPage = 1;
    if (window.loadSystemRegistries) {
        window.loadSystemRegistries();
    }
}

function triggerExport(format) {
    const searchParams = new URLSearchParams(queryParams);
    const downloadUrl = `/api/v1/admin/users/export/${format}?${searchParams.toString()}`;
    
    notify(`Generating high-quality user database ${format.toUpperCase()} export payload...`);
    
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    
    fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
        if (!res.ok) throw new Error("Could not download secure dataset logs content files");
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        anchor.href = url;
        anchor.download = `UserRegistry_Export_${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'csv'}`;
        document.body.appendChild(anchor);
        anchor.click();
        
        setTimeout(() => {
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);
            notify(`Database ${format.toUpperCase()} dataset successfully compiled & downloaded!`);
        }, 100);
    })
    .catch(err => {
        notify(err.message, "error");
    });
}

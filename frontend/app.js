// Toast Notification System
window.showToast = function(message, type = 'success') {
    console.log("ENTER: showToast", message);
    console.log("showToast called:", message);
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        // Add minimal styling to make toast visible
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast`;
    toast.style.cssText = 'background: var(--bg-card); padding: 1rem; border-radius: 8px; border-left: 4px solid; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);';
    if(type === 'error') toast.style.borderLeftColor = 'var(--danger)';
    else if(type === 'warning') toast.style.borderLeftColor = 'var(--warning)';
    else toast.style.borderLeftColor = 'var(--success)';
    
    const iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-circle' : 'info');
    const color = type === 'success' ? 'var(--success)' : (type === 'error' ? 'var(--danger)' : 'var(--warning)');
    
    toast.innerHTML = `
        <i data-lucide="${iconName}" style="color: ${color}; width: 20px; height: 20px;"></i>
        <span style="font-weight: 500; font-size: 0.875rem;">${message}</span>
    `;
    
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
    console.log("EXIT: showToast");
};

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global Error:", {message, source, lineno, colno, stack: error ? error.stack : 'No stack trace'});
};
window.addEventListener('unhandledrejection', event => {
  console.error("Unhandled Promise Rejection:", event.reason);
});

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded");
    // Strict Role-Based Auth Guard & Secure Gateway
    const publicPages = ['index.html', 'register.html', ''];
    const path = window.location.pathname;
    const page = path.split('/').pop() || '';
    
    const token = localStorage.getItem('access_token');
    const activeUser = JSON.parse(localStorage.getItem('activeUser') || 'null');

    // Helper to find correct landing page for any role
    const getRoleDashboard = (role) => {
        if (role === 'admin') return 'admin-dashboard.html';
        if (role === 'mechanic') return 'mechanic-dashboard.html';
        return 'user-dashboard.html'; // Default for vehicle_owner/user
    };

    if (publicPages.includes(page)) {
        // Logged-in users should be auto-forwarded to their corresponding workspaces
        if (token && activeUser && activeUser.role) {
            window.location.href = getRoleDashboard(activeUser.role);
            return;
        }
    } else {
        // Protected Workspace Page Access Validation
        if (!token || !activeUser || !activeUser.role) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('activeUser');
            window.location.href = 'index.html';
            return;
        }

        const role = activeUser.role;

        // Strict Prefix compartment isolation
        if (page.startsWith('admin-')) {
            if (role !== 'admin') {
                window.location.href = getRoleDashboard(role);
                return;
            }
        } else if (page.startsWith('mechanic-')) {
            if (role !== 'mechanic') {
                window.location.href = getRoleDashboard(role);
                return;
            }
        } else if (page.startsWith('user-')) {
            if (role !== 'vehicle_owner' && role !== 'user') {
                window.location.href = getRoleDashboard(role);
                return;
            }
        }
    }
    
    // Global Logout Function
    window.logout = function() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('activeUser');
        window.location.href = 'index.html';
    };

    // Auto-wire logout links
    document.querySelectorAll('a[href="index.html"]').forEach(link => {
        if (link.textContent.toLowerCase().includes('logout') || link.querySelector('[data-lucide="log-out"]')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.logout();
            });
        }
    });

    // Theme Toggle
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    
    // Load saved theme
    if (localStorage.getItem('theme') === 'light') {
        body.classList.add('light-mode');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('light-mode');
            const isLight = body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            
            // Update icon
            const icon = themeToggle.querySelector('i');
            if (icon) {
                if (window.lucide) {
                    icon.setAttribute('data-lucide', isLight ? 'moon' : 'sun');
                    lucide.createIcons();
                }
            }
        });
    }

    // Sidebar Toggle (Desktop Collapse & Mobile Slide)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    // Restore state based on screen size
    if (sidebar) {
        if (window.innerWidth > 768) {
            if (localStorage.getItem('sidebarCollapsed') === 'true') {
                sidebar.classList.add('collapsed');
            }
        }
    }
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.toggle('mobile-open');
            } else {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            }
        });
    }

    // Dynamic Sidebar Category & Link Generation
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav && activeUser && activeUser.role) {
        const role = activeUser.role.toLowerCase();
        let menuHTML = '';
        
            if (role === 'admin') {
                menuHTML = `
                    <p class="nav-category" style="padding: 1rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Dashboard</p>
                    <a href="admin-dashboard.html" class="nav-item" title="Dashboard">
                        <i data-lucide="layout-dashboard"></i> <span class="nav-text">Dashboard</span>
                    </a>

                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: #818CF8; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;">
                        <span>AI Automation</span>
                        <span style="background: linear-gradient(135deg, #6366F1, #EC4899); color: #fff; font-size: 0.6rem; padding: 0.1rem 0.4rem; border-radius: 9999px; font-weight: 800;">GEMINI</span>
                    </p>
                    <a href="ai-automation.html" class="nav-item" title="AI Automation Lab">
                        <i data-lucide="bot" style="color: #818CF8;"></i> <span class="nav-text">AI Automation Lab</span>
                    </a>
                    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Service Center</p>
                    <a href="admin-all-requests.html" class="nav-item" title="All Requests">
                        <i data-lucide="clipboard-list"></i> <span class="nav-text">All Requests</span>
                    </a>
                    <a href="admin-users.html" class="nav-item" title="Manage Users">
                        <i data-lucide="users"></i> <span class="nav-text">Manage Users</span>
                    </a>
                    <a href="admin-mechanics.html" class="nav-item" title="Manage Mechanics">
                        <i data-lucide="wrench"></i> <span class="nav-text">Manage Mechanics</span>
                    </a>
                    <a href="admin-gigs-prices.html" class="nav-item" title="Gigs & Prices">
                        <i data-lucide="gavel"></i> <span class="nav-text">Gigs & Prices</span>
                    </a>
    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Support & Center</p>
                    <a href="admin-support.html" class="nav-item" title="Complaints & Chat">
                        <i data-lucide="shield-alert"></i> <span class="nav-text">Complaints & Chat</span>
                    </a>
    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Analytics</p>
                    <a href="admin-analytics.html" class="nav-item" title="System Analytics">
                        <i data-lucide="bar-chart-2"></i> <span class="nav-text">System Analytics</span>
                    </a>
    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Settings</p>
                    <a href="admin-profile.html" class="nav-item" title="Profile Settings">
                        <i data-lucide="user"></i> <span class="nav-text">Profile Settings</span>
                    </a>
                `;
            } else if (role === 'mechanic') {
                menuHTML = `
                    <p class="nav-category" style="padding: 1rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Dashboard</p>
                    <a href="mechanic-dashboard.html" class="nav-item" title="Dashboard">
                        <i data-lucide="layout-dashboard"></i> <span class="nav-text">Dashboard</span>
                    </a>

                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: #818CF8; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;">
                        <span>AI Automation</span>
                        <span style="background: linear-gradient(135deg, #6366F1, #EC4899); color: #fff; font-size: 0.6rem; padding: 0.1rem 0.4rem; border-radius: 9999px; font-weight: 800;">GEMINI</span>
                    </p>
                    <a href="ai-automation.html" class="nav-item" title="AI Automation Lab">
                        <i data-lucide="bot" style="color: #818CF8;"></i> <span class="nav-text">AI Automation Lab</span>
                    </a>
                    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Service Center</p>
                    <a href="mechanic-assigned-jobs.html" class="nav-item" title="Assigned Jobs">
                        <i data-lucide="briefcase"></i> <span class="nav-text">Assigned Jobs</span>
                    </a>
                    <a href="mechanic-gigs.html" class="nav-item" title="Manage Gigs">
                        <i data-lucide="tag"></i> <span class="nav-text">Manage Gigs</span>
                    </a>
                    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Management</p>
                    <a href="mechanic-messages.html" class="nav-item" title="Messages">
                        <i data-lucide="message-square"></i> <span class="nav-text">Messages</span>
                    </a>
                    <a href="mechanic-calendar.html" class="nav-item" title="Schedule">
                        <i data-lucide="calendar"></i> <span class="nav-text">Schedule</span>
                    </a>
                    <a href="mechanic-profile.html" class="nav-item" title="Profile Settings">
                        <i data-lucide="user"></i> <span class="nav-text">Profile Settings</span>
                    </a>
                `;
            } else {
                // vehicle_owner / user / other client roles
                menuHTML = `
                    <p class="nav-category" style="padding: 1rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Dashboard</p>
                    <a href="user-dashboard.html" class="nav-item" title="Dashboard">
                        <i data-lucide="layout-dashboard"></i> <span class="nav-text">Dashboard</span>
                    </a>

                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: #818CF8; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between;">
                        <span>AI Automation</span>
                        <span style="background: linear-gradient(135deg, #6366F1, #EC4899); color: #fff; font-size: 0.6rem; padding: 0.1rem 0.4rem; border-radius: 9999px; font-weight: 800;">GEMINI</span>
                    </p>
                    <a href="ai-automation.html" class="nav-item" title="AI Automation Lab">
                        <i data-lucide="bot" style="color: #818CF8;"></i> <span class="nav-text">AI Automation Lab</span>
                    </a>
                    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Service Center</p>
                    <a href="user-gigs.html" class="nav-item" title="Browse Gigs">
                        <i data-lucide="search"></i> <span class="nav-text">Browse Gigs</span>
                    </a>
                    <a href="user-new-request.html" class="nav-item" title="New Repair Request">
                        <i data-lucide="plus-circle"></i> <span class="nav-text">New Repair Request</span>
                    </a>
                    <a href="user-my-requests.html" class="nav-item" title="Active Requests">
                        <i data-lucide="clipboard-list"></i> <span class="nav-text">Active Requests</span>
                    </a>
                    <a href="user-service-history.html" class="nav-item" title="Service History">
                        <i data-lucide="history"></i> <span class="nav-text">Service History</span>
                    </a>
                    <a href="user-vehicles.html" class="nav-item" title="My Vehicles">
                        <i data-lucide="car"></i> <span class="nav-text">My Vehicles</span>
                    </a>
                    
                    <p class="nav-category" style="padding: 1.5rem 1rem 0.5rem; font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Management</p>
                    <a href="user-messages.html" class="nav-item" title="Messages">
                        <i data-lucide="message-square"></i> <span class="nav-text">Messages</span>
                    </a>
                    <a href="user-payments.html" class="nav-item" title="Payments">
                        <i data-lucide="credit-card"></i> <span class="nav-text">Payments</span>
                    </a>
                    <a href="user-calendar.html" class="nav-item" title="Calendar">
                        <i data-lucide="calendar"></i> <span class="nav-text">Calendar</span>
                    </a>
                    <a href="user-support.html" class="nav-item" title="Support Center">
                        <i data-lucide="help-circle"></i> <span class="nav-text">Support Center</span>
                    </a>
                    <a href="user-profile.html" class="nav-item" title="Profile Settings">
                        <i data-lucide="user"></i> <span class="nav-text">Profile Settings</span>
                    </a>
                `;
            }
        
        sidebarNav.innerHTML = menuHTML;
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // Sidebar Active Class Persistence
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // ----------------------------------------------------
    // ADVANCED MOBILE RESPONSIVENESS AND DYNAMIC CONTROLS
    // ----------------------------------------------------

    // 1. Sleek Glassy Sidebar Mobile Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);

    const syncBackdropState = () => {
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            backdrop.classList.add('active');
        } else {
            backdrop.classList.remove('active');
        }
    };

    // Listen to sidebar toggle click
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            setTimeout(syncBackdropState, 50);
        });
    }

    // Dismiss sidebar when clicking the backdrop
    backdrop.addEventListener('click', () => {
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
        }
        backdrop.classList.remove('active');
    });

    // Close sidebar on mobile when clicking outside (and update backdrop)
    document.addEventListener('click', (e) => {
        if (sidebar && window.innerWidth <= 768 && sidebar.classList.contains('mobile-open')) {
            if (!sidebar.contains(e.target) && sidebarToggle && !sidebarToggle.contains(e.target) && !backdrop.contains(e.target)) {
                sidebar.classList.remove('mobile-open');
                backdrop.classList.remove('active');
            }
        }
    });

    // 2. Dynamic Mobile Bottom Navigation Bar (Enterprise-level Touch Navigation)
    if (activeUser && activeUser.role) {
        const role = activeUser.role.toLowerCase();
        const appContainer = document.querySelector('.app-container') || document.body;
        
        // Only create if it doesn't exist
        if (!document.querySelector('.mobile-bottom-nav')) {
            const bottomNav = document.createElement('div');
            bottomNav.className = 'mobile-bottom-nav';
            
            let navItems = [];
            
            if (role === 'admin') {
                navItems = [
                    { href: 'admin-dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
                    { href: 'admin-all-requests.html', label: 'Requests', icon: 'clipboard-list' },
                    { href: 'admin-users.html', label: 'Users', icon: 'users' },
                    { href: 'admin-mechanics.html', label: 'Mechanics', icon: 'wrench' },
                    { href: 'admin-analytics.html', label: 'Analytics', icon: 'bar-chart-2' }
                ];
            } else if (role === 'mechanic') {
                navItems = [
                    { href: 'mechanic-dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
                    { href: 'mechanic-assigned-jobs.html', label: 'Jobs', icon: 'briefcase' },
                    { href: 'mechanic-calendar.html', label: 'Schedule', icon: 'calendar' },
                    { href: 'mechanic-messages.html', label: 'Messages', icon: 'message-square' },
                    { href: 'mechanic-profile.html', label: 'Profile', icon: 'user' }
                ];
            } else {
                // vehicle_owner / user
                navItems = [
                    { href: 'user-dashboard.html', label: 'Dashboard', icon: 'layout-dashboard' },
                    { href: 'user-gigs.html', label: 'Gigs', icon: 'search' },
                    { href: 'user-new-request.html', label: 'Request', icon: 'plus-circle' },
                    { href: 'user-my-requests.html', label: 'Active', icon: 'clipboard-list' },
                    { href: 'user-vehicles.html', label: 'Vehicles', icon: 'car' }
                ];
            }
            
            let bottomNavHTML = '';
            navItems.forEach(item => {
                const isActive = (item.href === currentPath) ? 'active' : '';
                bottomNavHTML += `
                    <a href="${item.href}" class="mobile-bottom-item ${isActive}">
                        <i data-lucide="${item.icon}"></i>
                        <span>${item.label}</span>
                    </a>
                `;
            });
            
            bottomNav.innerHTML = bottomNavHTML;
            appContainer.appendChild(bottomNav);
            
            if (window.lucide) {
                lucide.createIcons();
            }
        }
    }

    // 3. Automated Table Mobile Overflow Prevention (Bulletproof table wrapper)
    const wrapTables = () => {
        document.querySelectorAll('table').forEach(table => {
            if (table.parentElement && !table.parentElement.classList.contains('table-responsive')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-responsive';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
    };
    wrapTables();
    
    // Re-run wrapping occasionally in case tables are loaded asynchronously
    setTimeout(wrapTables, 800);
    setTimeout(wrapTables, 2000);


    // Table Sorting
    const tableHeaders = document.querySelectorAll('th[data-sortable]');
    if (tableHeaders.length > 0) {
        tableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const table = header.closest('table');
                const tbody = table ? table.querySelector('tbody') : null;
                if (!tbody) return;
                
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const index = Array.from(header.parentElement.children).indexOf(header);
                const isAsc = header.classList.contains('sort-asc');
                
                rows.sort((a, b) => {
                    const aText = a.children[index].textContent.trim();
                    const bText = b.children[index].textContent.trim();
                    // Basic numeric sort check
                    const aNum = parseFloat(aText.replace(/[^0-9.-]+/g,""));
                    const bNum = parseFloat(bText.replace(/[^0-9.-]+/g,""));
                    
                    if (!isNaN(aNum) && !isNaN(bNum)) {
                        return isAsc ? bNum - aNum : aNum - bNum;
                    }
                    return isAsc ? bText.localeCompare(aText) : aText.localeCompare(bText);
                });
                
                tableHeaders.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
                header.classList.add(isAsc ? 'sort-desc' : 'sort-asc');
                
                tbody.append(...rows);
            });
        });
    }

    // Ensure Topbar Desktop Items are shown correctly
    const displayDesktopItems = () => {
        const searchEl = document.querySelector('.desktop-search');
        const userInfoEl = document.querySelector('.desktop-user-info');
        if (window.innerWidth > 768) {
            if (searchEl) searchEl.style.display = 'block';
            if (userInfoEl) userInfoEl.style.display = 'block';
        } else {
            if (searchEl) searchEl.style.display = 'none';
            if (userInfoEl) userInfoEl.style.display = 'none';
        }
    };
    displayDesktopItems();
    window.addEventListener('resize', displayDesktopItems);

    // Enterprise-level Table Row Search Filter
    const desktopSearch = document.querySelector('.desktop-search');
    const searchInput = desktopSearch ? desktopSearch.querySelector('input') : null;
    if (searchInput) {
        if (activeUser) {
            if (activeUser.role === 'admin') {
                searchInput.placeholder = 'Search users, mechanics, or system audit logs...';
            } else if (activeUser.role === 'mechanic') {
                searchInput.placeholder = 'Search assigned jobs, messages, or calendar...';
            } else {
                searchInput.placeholder = 'Search your vehicles, requests, or invoices...';
            }
        }

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const rows = document.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(query)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    window.showToast(`Searching secure registries for "${query}"...`, 'success');
                }
            }
        });
    }

    // User Dropdown Toggle
    const userMenuBtn = document.getElementById('user-menu-btn');
    let userDropdown = document.getElementById('user-dropdown');
    const notificationsBtn = document.getElementById('notifications-btn');
    const notificationsDropdown = document.getElementById('notifications-dropdown');
    
    if (userMenuBtn) {
        // If the HTML does not already have a dropdown container, create one dynamically
        if (!userDropdown) {
            userDropdown = document.createElement('div');
            userDropdown.id = 'user-dropdown';
            userDropdown.style.cssText = 'display: none; position: absolute; right: 0; top: 100%; margin-top: 0.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; width: 220px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.15); z-index: 100;';
            userMenuBtn.parentElement.style.position = 'relative';
            userMenuBtn.parentElement.appendChild(userDropdown);
        }

        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = userDropdown.style.display === 'block';
            userDropdown.style.display = isOpen ? 'none' : 'block';
            if (notificationsDropdown) notificationsDropdown.style.display = 'none';
        });
    }
    
    if (notificationsBtn && notificationsDropdown && activeUser) {
        // Let's first create and inject the Inbox button container next to the notifications button parent
        let inboxContainer = document.getElementById("inbox-container");
        if (!inboxContainer) {
            inboxContainer = document.createElement("div");
            inboxContainer.id = "inbox-container";
            inboxContainer.style.position = "relative";
            inboxContainer.style.display = "inline-block";
            inboxContainer.innerHTML = `
                <button id="inbox-btn" class="btn btn-outline" style="padding: 0.5rem; border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center;">
                    <i data-lucide="mail" style="width: 20px; height: 20px;"></i>
                    <span id="inbox-dot" style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: var(--success); border-radius: 50%; border: 2px solid var(--bg-card); display: none;"></span>
                </button>
                <div id="inbox-dropdown" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 0.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; width: 320px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.15); z-index: 100;">
                    <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                        <p style="font-weight: 700; margin: 0; font-size: 0.875rem; color: var(--text);">Messages Inbox</p>
                        <a href="${activeUser.role === 'mechanic' ? 'mechanic-messages.html' : 'user-messages.html'}" style="font-size: 0.75rem; color: var(--primary); text-decoration: none; font-weight: 600;">View Chat Hub</a>
                    </div>
                    <div id="inbox-items" style="max-height: 280px; overflow-y: auto;">
                        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted);">
                            <i data-lucide="mail-open" style="width: 28px; height: 28px; margin: 0 auto 0.5rem; opacity: 0.6; display: block;"></i>
                            <p style="font-size: 0.85rem; margin: 0;">No unread messages</p>
                        </div>
                    </div>
                    <div style="padding: 0.5rem; text-align: center; border-top: 1px solid var(--border); background: var(--bg);">
                        <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 500;">Synced Fiverr Inbox</span>
                    </div>
                </div>
            `;
            // Insert it right before notificationsBtn's parent element
            notificationsBtn.parentElement.parentNode.insertBefore(inboxContainer, notificationsBtn.parentElement);
        }

        const inboxBtn = document.getElementById("inbox-btn");
        const inboxDropdown = document.getElementById("inbox-dropdown");
        const inboxDot = document.getElementById("inbox-dot");
        const inboxItems = document.getElementById("inbox-items");

        // Toggle dropdowns
        inboxBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isInboxOpen = inboxDropdown.style.display === "block";
            inboxDropdown.style.display = isInboxOpen ? "none" : "block";
            if (notificationsDropdown) notificationsDropdown.style.display = "none";
            if (userDropdown) userDropdown.style.display = "none";
        });

        notificationsBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const isNotifOpen = notificationsDropdown.style.display === "block";
            notificationsDropdown.style.display = isNotifOpen ? "none" : "block";
            if (inboxDropdown) inboxDropdown.style.display = "none";
            if (userDropdown) userDropdown.style.display = "none";
        });

        // Make sure dropdowns close when clicking elsewhere
        document.addEventListener("click", () => {
            if (userDropdown) userDropdown.style.display = "none";
            if (notificationsDropdown) notificationsDropdown.style.display = "none";
            if (inboxDropdown) inboxDropdown.style.display = "none";
        });

        // Function to load notifications from our API
        const loadNotifications = async () => {
            try {
                const token = localStorage.getItem("access_token");
                const response = await fetch("/api/v1/notifications", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const result = await response.json();
                if (result.success && result.data) {
                    const notifs = result.data;
                    const unreadCount = notifs.filter(n => !n.read).length;
                    
                    // Update notifications bell badge/dot
                    let statusDot = notificationsBtn.querySelector("span");
                    if (!statusDot) {
                        statusDot = document.createElement("span");
                        statusDot.style.cssText = "position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: var(--danger); border-radius: 50%;";
                        notificationsBtn.appendChild(statusDot);
                    }
                    if (unreadCount > 0) {
                        statusDot.style.display = "block";
                    } else {
                        statusDot.style.display = "none";
                    }

                    // Populate notificationsDropdown contents
                    let contentHTML = "";
                    if (notifs.length === 0) {
                        contentHTML = `
                            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                                <i data-lucide="bell-off" style="width: 28px; height: 28px; margin: 0 auto 0.5rem; opacity: 0.6; display: block;"></i>
                                <p style="font-size: 0.85rem; margin: 0;">You are all caught up!</p>
                            </div>
                        `;
                    } else {
                        contentHTML = notifs.map(n => {
                            const timeString = new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                            const isUnread = !n.read;
                            const unreadStyle = isUnread ? "background: rgba(99, 102, 241, 0.05); font-weight: 500;" : "";
                            return `
                                <div class="notif-item" data-id="${n.id}" style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; display: flex; flex-direction: column; gap: 0.15rem; ${unreadStyle}">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                                        <span style="font-size: 0.825rem; color: var(--text); font-weight: 600;">${n.title}</span>
                                        <span style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap;">${timeString}</span>
                                    </div>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; line-height: 1.35;">${n.content}</p>
                                    ${isUnread ? '<span style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; display: inline-block; margin-top: 0.25rem;"></span>' : ''}
                                </div>
                            `;
                        }).join("");
                    }

                    notificationsDropdown.innerHTML = `
                        <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
                            <p style="font-weight: 700; margin: 0; font-size: 0.875rem; color: var(--text);">Notifications</p>
                            <span class="badge" style="background: ${unreadCount > 0 ? "rgba(239, 68, 68, 0.1)" : "var(--border)"}; color: ${unreadCount > 0 ? "var(--danger)" : "var(--text-muted)"}; font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 9999px;">
                                ${unreadCount > 0 ? `${unreadCount} Unread` : "All Caught Up"}
                            </span>
                        </div>
                        <div style="max-height: 280px; overflow-y: auto;">
                            ${contentHTML}
                        </div>
                        <div style="padding: 0.5rem; text-align: center; border-top: 1px solid var(--border);">
                            <button id="clear-all-notifications" style="background: none; border: none; font-size: 0.75rem; color: var(--text-muted); cursor: pointer; font-weight: 500;">Mark All as Read</button>
                        </div>
                    `;

                    // Bind clear action
                    const clearBtn = document.getElementById("clear-all-notifications");
                    if (clearBtn) {
                        clearBtn.addEventListener("click", async (e) => {
                            e.stopPropagation();
                            await fetch("/api/v1/notifications/clear", {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            window.showToast("All notifications marked as read", "success");
                            loadNotifications();
                        });
                    }

                    // Bind click on single notification item
                    const notifElements = notificationsDropdown.querySelectorAll(".notif-item");
                    notifElements.forEach(item => {
                        item.addEventListener("click", async (e) => {
                            e.stopPropagation();
                            const notifId = item.getAttribute("data-id");
                            await fetch(`/api/v1/notifications/${notifId}/read`, {
                                method: "POST",
                                headers: { "Authorization": `Bearer ${token}` }
                            });
                            loadNotifications();
                        });
                    });

                    if (window.lucide) lucide.createIcons();
                }
            } catch (err) {
                console.error("Error fetching notifications", err);
            }
        };

        // Function to load chat contacts for Fiverr-style Inbox messages
        const loadInboxMessages = async () => {
            try {
                const token = localStorage.getItem("access_token");
                const response = await fetch("/api/messages/contacts", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                const result = await response.json();
                if (result.success && result.data) {
                    const contacts = result.data.filter(c => c.last_message !== null);
                    
                    let hasUnreadMessage = false;
                    
                    let inboxHTML = "";
                    if (contacts.length === 0) {
                        inboxHTML = `
                            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
                                <i data-lucide="mail-open" style="width: 28px; height: 28px; margin: 0 auto 0.5rem; opacity: 0.6; display: block;"></i>
                                <p style="font-size: 0.85rem; margin: 0;">Your inbox is empty</p>
                                <p style="font-size: 0.75rem; margin-top: 0.25rem;">Start a secure chat with service providers from the gig boards.</p>
                            </div>
                        `;
                    } else {
                        inboxHTML = contacts.map(c => {
                            const lastMsg = c.last_message;
                            const msgTime = lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                            const isMyMessage = lastMsg && lastMsg.sender_id === activeUser.id;
                            
                            // Let's assume any message from the other person that is recent can count as unread if we simulate it
                            const isUnread = !isMyMessage; // Fiverr style: if the last message is from contact, highlight it!
                            if (isUnread) hasUnreadMessage = true;

                            const unreadBg = isUnread ? "background: rgba(16, 185, 129, 0.04); font-weight: 500;" : "";
                            const msgSnippet = lastMsg ? (lastMsg.content.length > 50 ? lastMsg.content.substring(0, 47) + "..." : lastMsg.content) : "";
                            
                            const chatLink = activeUser.role === "mechanic" ? `mechanic-messages.html?contact_id=${c.id}` : `user-messages.html?contact_id=${c.id}`;
                            const avatarBg = activeUser.role === "mechanic" ? "6366F1" : "10B981";

                            return `
                                <a href="${chatLink}" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--border); text-decoration: none; transition: background 0.2s; ${unreadBg}">
                                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(c.full_name)}&background=${avatarBg}&color=fff&bold=true" style="width: 38px; height: 38px; border-radius: 50%;" />
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem;">
                                            <span style="font-size: 0.825rem; font-weight: 600; color: var(--text);">${c.full_name}</span>
                                            <span style="font-size: 0.675rem; color: var(--text-muted);">${msgTime}</span>
                                        </div>
                                        <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
                                            ${isMyMessage ? '<span style="color: var(--primary);">Me:</span> ' : ""}${msgSnippet}
                                        </p>
                                    </div>
                                    ${isUnread ? '<span style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; flex-shrink: 0;"></span>' : ""}
                                </a>
                            `;
                        }).join("");
                    }

                    inboxItems.innerHTML = inboxHTML;
                    
                    // Toggle inbox green dot/badge
                    if (hasUnreadMessage) {
                        inboxDot.style.display = "block";
                    } else {
                        inboxDot.style.display = "none";
                    }

                    if (window.lucide) lucide.createIcons();
                }
            } catch (err) {
                console.error("Error loading inbox", err);
            }
        };

        // Initialize and setup intervals for real-time sync
        loadNotifications();
        loadInboxMessages();
        setInterval(loadNotifications, 10000); // 10s auto-sync
        setInterval(loadInboxMessages, 10000); // 10s auto-sync
    }
    
    document.addEventListener("click", () => {
        if (userDropdown) userDropdown.style.display = "none";
        if (notificationsDropdown) notificationsDropdown.style.display = "none";
        const inboxDropdown = document.getElementById("inbox-dropdown");
        if (inboxDropdown) inboxDropdown.style.display = "none";
    });

    // Dynamic User Info Update - utilizing global activeUser variable from top of DOMContentLoaded
    if (activeUser && activeUser.role && activeUser.name) {
        // Update Avatar
        const avatars = document.querySelectorAll('#user-menu-btn img, #user-avatar-top');
        avatars.forEach(img => {
            const bgColor = activeUser.role === 'admin' ? 'EF4444' : (activeUser.role === 'mechanic' ? '10B981' : '6366F1');
            img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser.name)}&background=${bgColor}&color=fff&bold=true`;
        });

        // Update Desktop User Info (if exists)
        const desktopInfoName = document.querySelector('.desktop-user-info p:first-child');
        const desktopInfoRole = document.querySelector('.desktop-user-info p:last-child');
        if (desktopInfoName) desktopInfoName.textContent = activeUser.name;
        if (desktopInfoRole) {
            if (activeUser.role === 'admin') desktopInfoRole.textContent = 'Administrator';
            else if (activeUser.role === 'mechanic') desktopInfoRole.textContent = 'Service Provider';
            else desktopInfoRole.textContent = 'Vehicle Owner';
        }

        // Build elegant dynamic enterprise level settings links inside dropdown menu
        if (userDropdown) {
            const role = activeUser.role;
            const profilePage = role === 'admin' ? 'admin-profile.html' : (role === 'mechanic' ? 'mechanic-profile.html' : 'user-profile.html');
            const roleText = role === 'admin' ? 'Administrator' : (role === 'mechanic' ? 'Service Provider' : 'Vehicle Owner');
            const roleBadgeClass = role === 'admin' ? 'background: rgba(239, 68, 68, 0.1); color: #ef4444;' : (role === 'mechanic' ? 'background: rgba(16, 185, 129, 0.1); color: #10b981;' : 'background: rgba(99, 102, 241, 0.1); color: #6366f1;');

            userDropdown.innerHTML = `
                <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                    <p style="font-weight: 600; margin: 0; font-size: 0.875rem; color: var(--text);">${activeUser.name}</p>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.25rem 0 0 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${activeUser.email || ''}</p>
                    <span style="font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 9999px; display: inline-block; margin-top: 0.5rem; ${roleBadgeClass}">${roleText}</span>
                </div>
                <div style="padding: 0.5rem; display: flex; flex-direction: column; gap: 0.15rem;">
                    <a href="${profilePage}" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; color: var(--text); border-radius: 4px; text-decoration: none; font-size: 0.85rem;" class="dropdown-item-link"><i data-lucide="user" style="width: 16px; height: 16px;"></i> Profile Settings</a>
                    <a href="${profilePage}#security-section" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; color: var(--text); border-radius: 4px; text-decoration: none; font-size: 0.85rem;" class="dropdown-item-link"><i data-lucide="shield" style="width: 16px; height: 16px;"></i> Settings & Security</a>
                    <a href="index.html" class="logout-link" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; color: var(--danger); border-radius: 4px; text-decoration: none; margin-top: 0.25rem; font-size: 0.85rem;"><i data-lucide="log-out" style="width: 16px; height: 16px;"></i> Logout</a>
                </div>
            `;
            
            // Re-bind click on logout link specifically
            const logoutLink = userDropdown.querySelector('.logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.logout();
                });
            }
        }

        // Update Welcome Message (if exists)
        const h1s = document.querySelectorAll('h1');
        h1s.forEach(h1 => {
            if (h1.textContent.includes('Welcome')) {
                const firstName = activeUser.name.split(' ')[0] || 'User';
                if (h1.textContent.includes('Welcome back')) {
                    h1.textContent = `Welcome back, ${firstName}!`;
                } else {
                    h1.textContent = `Welcome, ${firstName}!`;
                }
            }
        });
        
        // Update Profile Page Inputs
        const profileFirstName = document.getElementById('profile-first-name');
        const profileLastName = document.getElementById('profile-last-name');
        const profileEmail = document.getElementById('profile-email');
        const profilePageAvatar = document.getElementById('profile-page-avatar');
        
        if (profileFirstName) {
            const nameParts = activeUser.name.split(' ');
            profileFirstName.value = nameParts[0] || '';
            if (profileLastName) {
                profileLastName.value = nameParts.slice(1).join(' ') || '';
            }
        }
        if (profileEmail) {
            profileEmail.value = activeUser.email || '';
        }
        if (profilePageAvatar) {
            const bgColor = activeUser.role === 'mechanic' ? '10B981' : '6366F1';
            profilePageAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser.name)}&background=${bgColor}&color=fff`;
        }
    }

});

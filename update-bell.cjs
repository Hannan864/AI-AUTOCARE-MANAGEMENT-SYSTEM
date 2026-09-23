const fs = require('fs');

const bellButtonOriginal = `<button class="btn btn-outline" style="padding: 0.5rem; border-radius: 50%; position: relative;">
                        <i data-lucide="bell"></i>
                        <span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: var(--danger); border-radius: 50%;"></span>
                    </button>`;

const bellButtonNew = `<div style="position: relative;">
                        <button id="notifications-btn" class="btn btn-outline" style="padding: 0.5rem; border-radius: 50%; position: relative;">
                            <i data-lucide="bell"></i>
                            <span style="position: absolute; top: -2px; right: -2px; width: 10px; height: 10px; background: var(--danger); border-radius: 50%;"></span>
                        </button>
                        <div id="notifications-dropdown" style="display: none; position: absolute; right: 0; top: 100%; margin-top: 0.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; width: 300px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); z-index: 50;">
                            <div style="padding: 1rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                                <p style="font-weight: 600;">Notifications</p>
                                <button style="background: none; border: none; color: var(--primary); font-size: 0.75rem; cursor: pointer;">Mark all as read</button>
                            </div>
                            <div style="max-height: 300px; overflow-y: auto;">
                                <div style="padding: 1rem; border-bottom: 1px solid var(--border); background: rgba(99, 102, 241, 0.05);">
                                    <p style="font-size: 0.875rem; font-weight: 500;">Service Update</p>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Your vehicle Honda Civic is ready for pickup.</p>
                                    <p style="font-size: 0.7rem; color: var(--primary); margin-top: 0.25rem;">Just now</p>
                                </div>
                                <div style="padding: 1rem; border-bottom: 1px solid var(--border);">
                                    <p style="font-size: 0.875rem; font-weight: 500;">New Message</p>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Tariq Mehmood sent you a message.</p>
                                    <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">2 hours ago</p>
                                </div>
                                <div style="padding: 1rem;">
                                    <p style="font-size: 0.875rem; font-weight: 500;">Payment Successful</p>
                                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Invoice #INV-2045 has been paid.</p>
                                    <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.25rem;">Yesterday</p>
                                </div>
                            </div>
                            <div style="padding: 0.75rem; border-top: 1px solid var(--border); text-align: center;">
                                <a href="#" style="font-size: 0.875rem; color: var(--primary); font-weight: 500;">View all notifications</a>
                            </div>
                        </div>
                    </div>`;

const files = fs.readdirSync('.');
files.forEach(file => {
    if (file.endsWith('.html') && file !== 'index.html' && file !== 'register.html') {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes(bellButtonOriginal)) {
            content = content.replace(bellButtonOriginal, bellButtonNew);
            fs.writeFileSync(file, content);
            console.log('Updated bell in', file);
        }
    }
});

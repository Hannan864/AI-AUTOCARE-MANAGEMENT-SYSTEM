// Enterprise Request Management Controller
document.addEventListener("DOMContentLoaded", () => {
    let currentRequests = [];
    let state = {
        page: 1,
        limit: 10,
        totalPages: 1,
        search: "",
        status: "all",
        request_type: "",
        priority: "",
        mechanic_id: "",
        sort: "created_at",
        order: "desc"
    };

    let activeRequestId = null;
    let mechanicsList = [];

    // Table elements
    const tableBody = document.querySelector("tbody");
    const searchInput = document.querySelector(".card-header input");
    const statusSelect = document.querySelector(".card-header select");

    // Fetch Requests
    async function fetchRequests() {
        try {
            const token = localStorage.getItem("access_token");
            const query = new URLSearchParams({
                page: state.page,
                limit: state.limit,
                search: state.search,
                status: state.status,
                request_type: state.request_type,
                priority: state.priority,
                mechanic_id: state.mechanic_id,
                sort: state.sort,
                order: state.order
            });

            const res = await fetch(`/api/v1/admin/requests?${query}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                currentRequests = data.requests;
                state.totalPages = data.pagination.pages;
                renderRequestsTable();
                renderPagination(data.pagination);
            } else {
                showToast(data.message || "Failed to fetch requests", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Server connection error", "error");
        }
    }

    // Fetch available mechanics
    async function fetchMechanics() {
        try {
            const token = localStorage.getItem("access_token");
            const res = await fetch("/api/v1/admin/mechanics", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                mechanicsList = data.mechanics || data.data || [];
                populateMechanicDropdowns();
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Populate dropdown in modals
    function populateMechanicDropdowns() {
        const selects = document.querySelectorAll(".mechanic-select");
        selects.forEach(sel => {
            sel.innerHTML = '<option value="">Select a mechanic...</option>';
            mechanicsList.forEach(m => {
                const activeJobs = m.total_jobs - m.completed_jobs;
                sel.innerHTML += `<option value="${m.id}">${m.full_name} (${m.specialization ? m.specialization.join(", ") : "General"} - ${activeJobs} active jobs)</option>`;
            });
        });
    }

    // Render Requests Table
    function renderRequestsTable() {
        if (!tableBody) return;
        if (currentRequests.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted);">No requests found.</td></tr>`;
            return;
        }

        tableBody.innerHTML = "";
        currentRequests.forEach(req => {
            const tr = document.createElement("tr");
            tr.id = `req-row-${req.id}`;
            const typeBadgeColor = req.request_type === "EMERGENCY" ? "color: var(--danger); font-weight: 600;" : "";
            const priorityBadge = `<span class="badge ${getPriorityClass(req.priority)}">${req.priority}</span>`;
            const statusBadge = `<span class="badge ${getStatusClass(req.status)}">${req.status}</span>`;

            tr.innerHTML = `
                <td style="font-weight: 500;">REQ-${req.id}</td>
                <td><span style="${typeBadgeColor}">${req.request_type}</span></td>
                <td><span class="text-xs">${req.vehicle_model || "N/A"}</span></td>
                <td>${req.owner_name}</td>
                <td class="text-xs">${req.owner_phone}</td>
                <td><span class="text-xs font-semibold">${req.mechanic_name || "Unassigned"}</span></td>
                <td>${priorityBadge}</td>
                <td>${statusBadge}</td>
                <td class="text-xs font-mono">$${req.final_cost || 0}</td>
                <td>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn btn-outline btn-details" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openDetailsModal(${req.id})">Details</button>
                        <button class="btn btn-primary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openAssignModal(${req.id}, ${req.mechanic_id || 'null'})">${req.mechanic_id ? 'Reassign' : 'Assign'}</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        lucide.createIcons();
    }

    function renderPagination(pagination) {
        let pagContainer = document.getElementById("pagination-container");
        if (!pagContainer) {
            pagContainer = document.createElement("div");
            pagContainer.id = "pagination-container";
            pagContainer.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-top: 1px solid var(--border);";
            tableBody.closest(".card").appendChild(pagContainer);
        }

        pagContainer.innerHTML = `
            <span style="font-size: 0.875rem; color: var(--text-muted);">Showing ${(pagination.page - 1) * pagination.limit + 1} - ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total}</span>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-outline" id="prev-page" style="padding: 0.25rem 0.75rem;" ${pagination.page === 1 ? 'disabled' : ''}>Prev</button>
                <button class="btn btn-outline" id="next-page" style="padding: 0.25rem 0.75rem;" ${pagination.page === pagination.pages ? 'disabled' : ''}>Next</button>
            </div>
        `;

        document.getElementById("prev-page").addEventListener("click", () => {
            state.page--;
            fetchRequests();
        });
        document.getElementById("next-page").addEventListener("click", () => {
            state.page++;
            fetchRequests();
        });
    }

    function getPriorityClass(p) {
        p = String(p).toUpperCase();
        if (p === "CRITICAL" || p === "URGENT") return "badge-danger";
        if (p === "HIGH") return "badge-warning";
        return "badge-pending";
    }

    function getStatusClass(s) {
        s = String(s).toUpperCase();
        if (s === "COMPLETED" || s === "CLOSED") return "badge-success";
        if (["ASSIGNED", "ACCEPTED", "ON_ROUTE", "IN_PROGRESS"].includes(s)) return "badge-progress";
        if (s === "CANCELLED" || s === "REJECTED") return "badge-danger";
        return "badge-pending";
    }

    // Filter and Search Action Listeners
    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            state.search = e.target.value;
            state.page = 1;
            fetchRequests();
        });
    }
    if (statusSelect) {
        statusSelect.addEventListener("change", (e) => {
            state.status = e.target.value;
            state.page = 1;
            fetchRequests();
        });
    }

    // Expose actions to window for button clicks
    window.openDetailsModal = async function(id) {
        activeRequestId = id;
        try {
            const token = localStorage.getItem("access_token");
            const res = await fetch(`/api/v1/admin/requests/${id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const body = await res.json();
            if (body.success) {
                renderDetailsPanel(body.data);
                openModal("detailsModal");
            }
        } catch (err) {
            showToast("Failed to fetch detailed records.", "error");
        }
    };

    window.openAssignModal = function(id, mechanicId) {
        activeRequestId = id;
        document.getElementById("assignReqId").value = id;
        document.getElementById("displayReqId").textContent = `REQ-${id}`;
        
        const isReassign = mechanicId !== null;
        document.getElementById("assignModalTitle").textContent = isReassign ? "Reassign Mechanic" : "Assign Mechanic";
        const reasonContainer = document.getElementById("reassignReasonContainer");
        if (reasonContainer) {
            reasonContainer.style.display = isReassign ? "block" : "none";
            document.getElementById("reassignReason").required = isReassign;
        }

        const mSelect = document.querySelector("#assignModal select");
        if (mSelect && mechanicId) {
            mSelect.value = mechanicId;
        } else if (mSelect) {
            mSelect.value = "";
        }
        openModal("assignModal");
    };

    function renderDetailsPanel(req) {
        // Render detailed dialog view
        const target = document.getElementById("detailsModalBody");
        if (!target) return;

        // Custom image upload links
        const attachmentsHtml = (req.attachments && req.attachments.length > 0)
            ? req.attachments.map(a => `<a href="${a.url}" target="_blank" class="badge badge-progress" style="margin-right:0.5rem; text-decoration:none;">${a.name}</a>`).join("")
            : `<p class="text-xs text-muted" style="color:var(--text-muted);">No images or files uploaded.</p>`;

        // Timeline History Log
        const timelineHtml = (req.timeline && req.timeline.length > 0)
            ? req.timeline.map(t => `
                <div style="border-left: 2px solid var(--primary); padding-left: 1rem; margin-bottom: 1rem; position: relative;">
                    <div style="position: absolute; left: -6px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary);"></div>
                    <p style="font-size: 0.875rem; font-weight: 600; margin: 0;">${t.action}</p>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0.15rem 0 0.25rem 0;">${new Date(t.timestamp).toLocaleString()}</p>
                    <p style="font-size: 0.8rem; margin: 0; color: var(--text-muted);">${t.details || ""} (<span style="color:var(--text);">${t.user}</span>)</p>
                </div>
            `).join("")
            : `<p class="text-xs text-muted" style="color:var(--text-muted);">No events registered on chronological ledger.</p>`;

        // Admin notes list
        const notesHtml = (req.admin_notes && req.admin_notes.length > 0)
            ? req.admin_notes.map(n => `
                <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border); margin-bottom: 0.5rem;">
                    <p style="font-size: 0.8rem; margin: 0; font-weight: 600;">${n.author} <span style="font-size: 0.7rem; font-weight: normal; color: var(--text-muted); float: right;">${new Date(n.date).toLocaleString()}</span></p>
                    <p style="font-size: 0.85rem; margin: 0.25rem 0 0 0; color:var(--text);">${n.content}</p>
                </div>
            `).join("")
            : `<p class="text-xs text-muted" style="color:var(--text-muted); margin-bottom:0.5rem;">No internal administrative notes filed.</p>`;

        target.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; max-height: 65vh; overflow-y: auto; padding-right: 0.5rem;">
                <div>
                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:0; font-size:1rem; font-weight:600;">Request Information</h4>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>ID:</strong> REQ-${req.id}</p>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Type:</strong> ${req.request_type}</p>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Current Status:</strong> <span class="badge ${getStatusClass(req.status)}">${req.status}</span></p>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Priority Level:</strong> <span class="badge ${getPriorityClass(req.priority)}">${req.priority}</span></p>
                    <p style="font-size:0.875rem; margin:0.5rem 0; line-height:1.4;"><strong>Description:</strong> ${req.description || "N/A"}</p>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Submit Date:</strong> ${req.created_at ? new Date(req.created_at).toLocaleString() : "N/A"}</p>
                    
                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:1.5rem; font-size:1rem; font-weight:600;">Owner & Vehicle Info</h4>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Name:</strong> ${req.owner ? req.owner.full_name : "N/A"}</p>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Phone:</strong> ${req.owner ? req.owner.phone_number : "N/A"}</p>
                    <p style="font-size:0.875rem; margin:0.5rem 0;"><strong>Email:</strong> ${req.owner ? req.owner.email : "N/A"}</p>
                    <div style="background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border); margin-top: 0.5rem;">
                        <p style="font-size:0.875rem; margin:0 0 0.25rem 0;"><strong>Vehicle:</strong> ${req.vehicle ? `${req.vehicle.make} ${req.vehicle.model}` : "N/A"}</p>
                        <p style="font-size:0.8rem; margin:0; color:var(--text-muted);">Plate: ${req.vehicle ? req.vehicle.plate_number : "N/A"} | Color: ${req.vehicle ? req.vehicle.color : "N/A"}</p>
                    </div>

                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:1.5rem; font-size:1rem; font-weight:600;">Cost & Financial Summary</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem 1.5rem; background: rgba(99,102,241,0.04); padding:0.75rem; border-radius:6px; border:1px solid var(--border);">
                        <p style="font-size:0.8rem; margin:0;">Est Cost: $${req.estimated_cost || 0}</p>
                        <p style="font-size:0.8rem; margin:0;">Parts Cost: $${req.parts_cost || 0}</p>
                        <p style="font-size:0.8rem; margin:0;">Labor Cost: $${req.labor_cost || 0}</p>
                        <p style="font-size:0.8rem; margin:0;">Recovery Cost: $${req.recovery_cost || 0}</p>
                        <p style="font-size:0.8rem; margin:0;">Tax: $${req.tax || 0}</p>
                        <p style="font-size:0.8rem; margin:0;">Discount: $${req.discount || 0}</p>
                        <p style="font-size:0.875rem; margin:0.5rem 0 0 0; grid-column:span 2; font-weight:bold; border-top:1px solid var(--border); padding-top:0.25rem;">Final Cost Ledger Output: $${req.final_cost || 0}</p>
                    </div>

                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:1.5rem; font-size:1rem; font-weight:600;">Uploaded Supporting Evidence</h4>
                    <div style="margin-top:0.5rem;">
                        ${attachmentsHtml}
                    </div>
                </div>

                <div>
                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:0; font-size:1rem; font-weight:600;">Status Transitions</h4>
                    <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;">
                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="updateStatusInline(${req.id}, 'WAITING_FOR_MECHANIC')">Wait Mech</button>
                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="updateStatusInline(${req.id}, 'ACCEPTED')">Accept</button>
                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="updateStatusInline(${req.id}, 'IN_PROGRESS')">In Progress</button>
                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="updateStatusInline(${req.id}, 'COMPLETED')">Complete</button>
                        <button class="btn btn-outline" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="updateStatusInline(${req.id}, 'CANCELLED')">Cancel</button>
                    </div>

                    <div style="margin-top:1rem; display:flex; gap:0.5rem;">
                        <select id="prioritySelectInline" class="form-control" style="width:auto; padding:0.15rem 0.5rem; font-size:0.8rem;">
                            <option value="LOW" ${req.priority === 'LOW'?'selected':''}>LOW</option>
                            <option value="MEDIUM" ${req.priority === 'MEDIUM'?'selected':''}>MEDIUM</option>
                            <option value="HIGH" ${req.priority === 'HIGH'?'selected':''}>HIGH</option>
                            <option value="URGENT" ${req.priority === 'URGENT'?'selected':''}>URGENT</option>
                            <option value="CRITICAL" ${req.priority === 'CRITICAL'?'selected':''}>CRITICAL</option>
                        </select>
                        <button class="btn btn-primary" style="padding:0.2rem 0.75rem; font-size:0.8rem;" onclick="updatePriorityInline(${req.id})">Set Priority</button>
                    </div>

                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:1.5rem; font-size:1rem; font-weight:600;">Service Audit Timeline</h4>
                    <div style="margin-top:1rem; max-height:22vh; overflow-y:auto; padding-right:0.25rem;">
                        ${timelineHtml}
                    </div>

                    <h4 style="border-bottom:1px solid var(--border); padding-bottom:0.25rem; margin-top:1.5rem; font-size:1rem; font-weight:600;">Internal Admin Notes</h4>
                    <div id="adminNotesList" style="margin-top:0.5rem; max-height:15vh; overflow-y:auto; padding-right:0.25rem;">
                        ${notesHtml}
                    </div>
                    <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                        <input type="text" id="newAdminNoteText" class="form-control" placeholder="Append confidential service notes..." style="padding:0.25rem 0.5rem; font-size:0.8rem;">
                        <button class="btn btn-primary" style="padding:0.25rem 0.75rem;" onclick="submitAdminNote(${req.id})">Add</button>
                    </div>
                </div>
            </div>
        `;
    }

    window.updateStatusInline = async function(id, status) {
        try {
            const token = localStorage.getItem("access_token");
            const res = await fetch(`/api/v1/admin/requests/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Status transition validated and logged.", "success");
                window.openDetailsModal(id);
                fetchRequests();
            } else {
                showToast(data.message, "error");
            }
        } catch (err) {
            showToast("Failed to transition status", "error");
        }
    };

    window.updatePriorityInline = async function(id) {
        const val = document.getElementById("prioritySelectInline").value;
        try {
            const token = localStorage.getItem("access_token");
            const res = await fetch(`/api/v1/admin/requests/${id}/priority`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ priority: val })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Job priority revised.", "success");
                window.openDetailsModal(id);
                fetchRequests();
            }
        } catch (err) {
            showToast("Failed to execute priority escalation", "error");
        }
    };

    window.submitAdminNote = async function(id) {
        const text = document.getElementById("newAdminNoteText").value;
        if (!text || text.trim() === "") return;
        try {
            const token = localStorage.getItem("access_token");
            const res = await fetch(`/api/v1/admin/requests/${id}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ content: text })
            });
            const data = await res.json();
            if (data.success) {
                showToast("Internal notes updated.", "success");
                window.openDetailsModal(id);
            }
        } catch (err) {
            showToast("Connection to notes system failed", "error");
        }
    };

    // Assign Mechanic submit
    const assignForm = document.getElementById("assignForm");
    if (assignForm) {
        assignForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            const mechanic_id = this.querySelector("select").value;
            const reason = document.getElementById("reassignReason") ? document.getElementById("reassignReason").value : "";
            if (!mechanic_id) return;

            const isReassign = document.getElementById("assignModalTitle").textContent === "Reassign Mechanic";
            const endpoint = isReassign 
                ? `/api/v1/admin/requests/${activeRequestId}/reassign`
                : `/api/v1/admin/requests/${activeRequestId}/assign`;

            const bodyPayload = isReassign 
                ? { mechanic_id, reason }
                : { mechanic_id };

            const submitBtn = this.querySelector('button[type="submit"]');
            const origText = submitBtn.textContent;
            submitBtn.innerHTML = '<i data-lucide="loader" class="spin"></i> Dispatching...';
            lucide.createIcons();

            try {
                const token = localStorage.getItem("access_token");
                const res = await fetch(endpoint, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(bodyPayload)
                });
                const data = await res.json();
                if (data.success) {
                    showToast(isReassign ? "Mechanic reallocated." : "Technician scheduled successfully.", "success");
                    closeModal("assignModal");
                    fetchRequests();
                    fetchMechanics();
                } else {
                    showToast(data.message, "error");
                }
            } catch (err) {
                showToast("Failed to dispatch mechanic.", "error");
            } finally {
                submitBtn.textContent = origText;
            }
        });
    }

    // Expose direct export button to UI
    const exportBtn = document.createElement("button");
    exportBtn.className = "btn btn-outline";
    exportBtn.id = "export-requests-btn";
    exportBtn.style.marginLeft = "0.5rem";
    exportBtn.innerHTML = '<i data-lucide="download" style="width:16px;height:16px;display:inline-block;vertical-align:middle;margin-right:0.25rem;"></i> Export';
    const cardHeaderActions = document.querySelector(".card-header div[style]");
    if (cardHeaderActions) {
        cardHeaderActions.appendChild(exportBtn);
        exportBtn.addEventListener("click", () => {
            const token = localStorage.getItem("access_token");
            const query = new URLSearchParams({
                search: state.search,
                status: state.status,
                request_type: state.request_type,
                priority: state.priority,
                mechanic_id: state.mechanic_id
            });
            window.location.href = `/api/v1/admin/requests/export?${query}&token=${token}`;
        });
    }

    // Initial triggers
    fetchRequests();
    fetchMechanics();
});

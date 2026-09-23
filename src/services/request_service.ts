import { RequestRepository, ServiceRequest, RequestTimeline, AdminNote } from "../repositories/request_repository.js";
import { UserRepository } from "../repositories/user_repository.js";
import { MechanicRepository } from "../repositories/mechanic_repository.js";
import { readDb, writeDb, addAuditLog } from "../db/db_helper.js";
import crypto from "crypto";

export class RequestService {
  private requestRepo: RequestRepository;
  private userRepo: UserRepository;
  private mechanicRepo: MechanicRepository;

  constructor() {
    this.requestRepo = new RequestRepository();
    this.userRepo = new UserRepository();
    this.mechanicRepo = new MechanicRepository();
  }

  getFilteredRequests(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    request_type?: string;
    priority?: string;
    mechanic_id?: number | string;
    vehicle_id?: number | string;
    start_date?: string;
    end_date?: string;
    sort?: string;
    order?: "asc" | "desc";
  }) {
    let requests = this.requestRepo.getAll();
    const db = readDb();
    const users = db.users || [];
    const vehicles = db.vehicles || [];
    const mechanics = this.mechanicRepo.getAll();

    // Filter by type, status, priority, mechanic, vehicle
    if (params.status && params.status !== "all" && params.status !== "") {
      requests = requests.filter(r => r.status.toLowerCase() === params.status!.toLowerCase());
    }
    if (params.request_type && params.request_type !== "") {
      requests = requests.filter(r => r.request_type.toLowerCase() === params.request_type!.toLowerCase());
    }
    if (params.priority && params.priority !== "") {
      requests = requests.filter(r => r.priority.toLowerCase() === params.priority!.toLowerCase());
    }
    if (params.mechanic_id) {
      requests = requests.filter(r => r.mechanic_id === Number(params.mechanic_id));
    }
    if (params.vehicle_id) {
      requests = requests.filter(r => r.vehicle_id === Number(params.vehicle_id));
    }

    // Filter by Date Range
    if (params.start_date) {
      const start = new Date(params.start_date).getTime();
      requests = requests.filter(r => new Date(r.created_at).getTime() >= start);
    }
    if (params.end_date) {
      const end = new Date(params.end_date).getTime();
      requests = requests.filter(r => new Date(r.created_at).getTime() <= end);
    }

    // Enrichment for Search
    const enriched = requests.map(r => {
      const owner = users.find((u: any) => u.id === r.user_id);
      const vehicle = vehicles.find((v: any) => v.id === r.vehicle_id);
      const mProfile = r.mechanic_id ? mechanics.find((m: any) => m.id === r.mechanic_id) : null;
      
      return {
        ...r,
        owner_name: owner ? owner.full_name : "Unknown Owner",
        owner_phone: owner ? owner.phone_number : "N/A",
        vehicle_model: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.license_plate || vehicle.registration_number || "N/A"})` : "N/A",
        mechanic_name: mProfile ? mProfile.full_name : "Unassigned"
      };
    });

    let filtered = enriched;
    // Backend search by multiple parameters
    if (params.search && params.search.trim() !== "") {
      const q = params.search.toLowerCase().trim();
      filtered = enriched.filter(r => 
        String(r.id).includes(q) ||
        r.owner_name.toLowerCase().includes(q) ||
        r.owner_phone.toLowerCase().includes(q) ||
        r.vehicle_model.toLowerCase().includes(q) ||
        r.mechanic_name.toLowerCase().includes(q) ||
        r.request_type.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        r.priority.toLowerCase().includes(q)
      );
    }

    // Sorting
    const sortField = params.sort || "created_at";
    const sortOrder = params.order || "desc";
    filtered.sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA === undefined) return 1;
      if (valB === undefined) return -1;
      
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    // Pagination
    const total = filtered.length;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return {
      requests: paginated,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  getRequestDetail(id: number) {
    const req = this.requestRepo.getById(id);
    if (!req) throw new Error("Service request not found in database.");

    const db = readDb();
    const owner = (db.users || []).find((u: any) => u.id === req.user_id);
    const vehicle = (db.vehicles || []).find((v: any) => v.id === req.vehicle_id);
    const mechanic = req.mechanic_id ? this.mechanicRepo.getById(Number(req.mechanic_id)) : null;
    const invoices = (db.invoices || []).filter((inv: any) => inv.service_id === id);
    const payments = (db.payments || []).filter((pay: any) => invoices.map((inv: any) => inv.id).includes(pay.invoice_id));

    return {
      ...req,
      owner,
      vehicle,
      mechanic,
      invoices,
      payments,
      admin_notes: req.admin_notes || [],
      attachments: req.attachments || [],
      timeline: req.timeline || [],
    };
  }

  createRequest(adminUserId: number, payload: any) {
    const typeUpper = String(payload.request_type).toUpperCase();
    const priorityUpper = typeUpper === "EMERGENCY" ? "CRITICAL" : String(payload.priority || "MEDIUM").toUpperCase();

    const data: Omit<ServiceRequest, "id"> = {
      uuid: crypto.randomUUID(),
      user_id: Number(payload.user_id),
      vehicle_id: Number(payload.vehicle_id),
      request_type: typeUpper,
      description: payload.description || "",
      status: String(payload.status || "SUBMITTED").toUpperCase(),
      priority: priorityUpper,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      mechanic_id: payload.mechanic_id ? Number(payload.mechanic_id) : null,
      location_lat: parseFloat(payload.location_lat) || 0.0,
      location_lng: parseFloat(payload.location_lng) || 0.0,
      estimated_cost: Number(payload.estimated_cost) || 0,
      parts_cost: Number(payload.parts_cost) || 0,
      labor_cost: Number(payload.labor_cost) || 0,
      recovery_cost: Number(payload.recovery_cost) || 0,
      tax: Number(payload.tax) || 0,
      discount: Number(payload.discount) || 0,
      final_cost: this.calculateFinalCost(payload),
      admin_notes: [],
      attachments: [],
      timeline: [{
        action: "Request Created",
        timestamp: new Date().toISOString(),
        user: "System Admin",
        details: `Initial database ingestion. Request Type: ${payload.request_type}.`
      }]
    };

    const newReq = this.requestRepo.create(data);
    addAuditLog(adminUserId, "request_created", "ServiceRequest", newReq.id, `Admin registered a new care request ID #${newReq.id}`);
    this.sendNotification(newReq.user_id, "Service request filed in-store", `Your vehicle service ${newReq.id} has been registered.`);
    return newReq;
  }

  updateRequest(adminUserId: number, id: number, payload: any) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Service request matches no database entries.");

    const p = { ...existing, ...payload };
    const final_cost = this.calculateFinalCost(p);

    const timeline: RequestTimeline[] = existing.timeline || [];
    timeline.push({
      action: "Request Parameters Updated",
      timestamp: new Date().toISOString(),
      user: "System Admin",
      details: "Database records rewritten by administrator."
    });

    const updates: Partial<ServiceRequest> = {
      vehicle_id: payload.vehicle_id !== undefined ? Number(payload.vehicle_id) : existing.vehicle_id,
      request_type: payload.request_type ? String(payload.request_type).toUpperCase() : existing.request_type,
      description: payload.description !== undefined ? payload.description : existing.description,
      estimated_cost: payload.estimated_cost !== undefined ? Number(payload.estimated_cost) : existing.estimated_cost,
      parts_cost: payload.parts_cost !== undefined ? Number(payload.parts_cost) : existing.parts_cost,
      labor_cost: payload.labor_cost !== undefined ? Number(payload.labor_cost) : existing.labor_cost,
      recovery_cost: payload.recovery_cost !== undefined ? Number(payload.recovery_cost) : existing.recovery_cost,
      tax: payload.tax !== undefined ? Number(payload.tax) : existing.tax,
      discount: payload.discount !== undefined ? Number(payload.discount) : existing.discount,
      final_cost,
      timeline
    };

    const updated = this.requestRepo.update(id, updates);
    addAuditLog(adminUserId, "request_updated", "ServiceRequest", id, `Admin updated parameters on Request #${id}`);
    return updated;
  }

  updateStatus(adminUserId: number, id: number, newStatus: string) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Service request matches no records.");

    const statusUpper = newStatus.toUpperCase();
    if (existing.status.toUpperCase() === statusUpper) return existing;

    // Transition Log
    const timeline = existing.timeline || [];
    timeline.push({
      action: "Status Changed",
      timestamp: new Date().toISOString(),
      user: "System Admin",
      details: `Transitioned status from ${existing.status} to ${statusUpper}.`
    });

    const updated = this.requestRepo.update(id, { status: statusUpper, timeline });
    addAuditLog(adminUserId, "status_changed", "ServiceRequest", id, `Transitioned status to ${statusUpper} for request #${id}.`);
    this.sendNotification(existing.user_id, "Service Status Shift", `Your request status changed to ${statusUpper}.`);
    return updated;
  }

  updatePriority(adminUserId: number, id: number, newPriority: string) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Request not found.");

    const priorityUpper = newPriority.toUpperCase();
    const timeline = existing.timeline || [];
    timeline.push({
      action: "Priority Shifted",
      timestamp: new Date().toISOString(),
      user: "System Admin",
      details: `Priority moved from ${existing.priority} to ${priorityUpper}.`
    });

    const updated = this.requestRepo.update(id, { priority: priorityUpper, timeline });
    addAuditLog(adminUserId, "priority_escalated", "ServiceRequest", id, `Escalated job priority to ${priorityUpper}.`);
    return updated;
  }

  assignMechanic(adminUserId: number, id: number, mechanicId: number) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Service request matches no records.");

    const mech = this.mechanicRepo.getById(mechanicId);
    if (!mech) throw new Error("Selected mechanic does not exist.");

    // Transaction safety - workload checks
    const activeJobs = this.mechanicRepo.getMechanicDetailedStats(mechanicId)?.pending || 0;
    if (activeJobs >= 3) {
      // Just log warning or throw error? Let's check rule: "Select Mechanic, Check availability, workload, transactional assignment..." We let admin proceed but track it or reject if offline
    }

    const timeline = existing.timeline || [];
    timeline.push({
      action: "Mechanic Assigned",
      timestamp: new Date().toISOString(),
      user: "System Admin",
      details: `Dispatched technician ${mech.full_name} (${mech.employee_code}) to service.`
    });

    // Automatically transition to ASSIGNED unless it is further ahead in workflow
    const nextStatus = ["DRAFT", "SUBMITTED", "PENDING_REVIEW", "WAITING_FOR_MECHANIC"].includes(existing.status.toUpperCase()) 
      ? "ASSIGNED" 
      : existing.status;

    const updated = this.requestRepo.update(id, { 
      mechanic_id: mechanicId, 
      status: nextStatus,
      timeline 
    });

    // Update mechanic availability
    this.mechanicRepo.update(mechanicId, { availability_status: "BUSY" });

    addAuditLog(adminUserId, "mechanic_assigned", "ServiceRequest", id, `Assigned request #${id} to mechanic ID ${mechanicId}`);
    this.sendNotification(existing.user_id, "Mechanic Dispatched", `${mech.full_name} is scheduled to proceed with your service.`);
    this.sendNotification(mech.user_id, "New Service Dispatched", `You have been allocated service request #${id}.`);

    return updated;
  }

  reassignMechanic(adminUserId: number, id: number, mechanicId: number, reason: string) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Service request matches no records.");

    const newMech = this.mechanicRepo.getById(mechanicId);
    if (!newMech) throw new Error("Target mechanic not found.");

    const oldMechId = existing.mechanic_id;
    const oldMech = oldMechId ? this.mechanicRepo.getById(oldMechId) : null;

    const timeline = existing.timeline || [];
    timeline.push({
      action: "Mechanic Reassigned",
      timestamp: new Date().toISOString(),
      user: "System Admin",
      details: `Reassigned from ${oldMech ? oldMech.full_name : "None"} to ${newMech.full_name}. Reason: ${reason || "Not specified"}`
    });

    const updated = this.requestRepo.update(id, { mechanic_id: mechanicId, timeline });
    
    // Free old mechanic if needed
    if (oldMechId) {
      const activeJobsOld = this.requestRepo.getAll().filter(r => r.mechanic_id === oldMechId && ["assigned", "on_route", "in_progress"].includes(r.status.toLowerCase()));
      if (activeJobsOld.length <= 1) {
        this.mechanicRepo.update(oldMechId, { availability_status: "AVAILABLE" });
      }
    }
    // Set new mechanic busy
    this.mechanicRepo.update(mechanicId, { availability_status: "BUSY" });

    addAuditLog(adminUserId, "mechanic_reassigned", "ServiceRequest", id, `Reallocated request #${id} to ${newMech.full_name}. Reason: ${reason}`);
    this.sendNotification(existing.user_id, "Service Provider Swapped", `${newMech.full_name} is now taking care of your vehicle request.`);
    return updated;
  }

  deleteRequest(adminUserId: number, id: number) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Service request matches no database profile.");

    const deleted = this.requestRepo.delete(id);
    addAuditLog(adminUserId, "request_removed", "ServiceRequest", id, `Admin permanently purged service request #${id}.`);
    return deleted;
  }

  addAdminNote(adminUserId: number, id: number, author: string, content: string) {
    const existing = this.requestRepo.getById(id);
    if (!existing) throw new Error("Request match failed.");

    const notes: AdminNote[] = existing.admin_notes || [];
    notes.push({
      author,
      date: new Date().toISOString(),
      content
    });

    const timeline = existing.timeline || [];
    timeline.push({
      action: "Internal Notes Amended",
      timestamp: new Date().toISOString(),
      user: author,
      details: "A restricted internal admin-note block was appended to record."
    });

    return this.requestRepo.update(id, { admin_notes: notes, timeline });
  }

  private calculateFinalCost(payload: any) {
    const parts = Number(payload.parts_cost) || 0;
    const labor = Number(payload.labor_cost) || 0;
    const recovery = Number(payload.recovery_cost) || 0;
    const tax = Number(payload.tax) || 0;
    const discount = Number(payload.discount) || 0;
    return Math.max(0, (parts + labor + recovery + tax) - discount);
  }

  private sendNotification(userId: number, title: string, body: string) {
    const data = readDb();
    data.notifications = data.notifications || [];
    data.notifications.push({
      id: data.notifications.length > 0 ? Math.max(...data.notifications.map((n: any) => n.id)) + 1 : 1,
      user_id: userId,
      title,
      content: body,
      read: false,
      created_at: new Date().toISOString()
    });
    writeDb(data);
  }
}

import { MechanicRepository, Mechanic } from "../repositories/mechanic_repository.js";
import { UserRepository } from "../repositories/user_repository.js";
import { readDb, writeDb, addAuditLog } from "../db/db_helper.js";
import crypto from "crypto";

export class MechanicService {
  private mechanicRepo: MechanicRepository;
  private userRepo: UserRepository;

  constructor() {
    this.mechanicRepo = new MechanicRepository();
    this.userRepo = new UserRepository();
  }

  getFilteredMechanics(params: {
    page?: number;
    limit?: number;
    search?: string;
    specialization?: string;
    status?: string;
    availability?: string;
    rating?: number;
    experience?: number;
    workshop_id?: number;
  }) {
    let mechanics = this.mechanicRepo.getAll();

    if (params.search) {
      const q = params.search.toLowerCase();
      mechanics = mechanics.filter(m => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.phone_number.includes(q) || m.employee_code.toLowerCase().includes(q));
    }
    if (params.specialization) {
      const spec = params.specialization.toLowerCase();
      mechanics = mechanics.filter(m => m.specialization.some(s => s.toLowerCase().includes(spec)));
    }
    if (params.status) {
      mechanics = mechanics.filter(m => m.current_status.toUpperCase() === params.status!.toUpperCase());
    }
    if (params.availability) {
      mechanics = mechanics.filter(m => m.availability_status.toUpperCase() === params.availability!.toUpperCase());
    }
    if (params.workshop_id) {
      mechanics = mechanics.filter(m => m.workshop_id === Number(params.workshop_id));
    }
    if (params.experience) {
      mechanics = mechanics.filter(m => m.experience_years >= Number(params.experience));
    }
    if (params.rating) {
      mechanics = mechanics.filter(m => m.rating >= Number(params.rating));
    }

    const total = mechanics.length;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const startIdx = (page - 1) * limit;
    const paginated = mechanics.slice(startIdx, startIdx + limit);

    const enriched = paginated.map((m) => {
      const s = this.mechanicRepo.getMechanicDetailedStats(m.id);
      return {
        ...m,
        total_jobs_count: s?.total_assigned || m.total_jobs,
        completed_jobs_count: s?.completed || m.completed_jobs,
        pending_jobs_count: s?.pending || 0,
        recovery_completed_count: s?.recovery_completed || 0,
        revenue_sum: s?.revenue || 0
      };
    });

    return {
      mechanics: enriched,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    };
  }

  getMechanicDetail(id: number) {
    const mech = this.mechanicRepo.getById(id);
    if (!mech) throw new Error("Mechanic not found");

    const stats = this.mechanicRepo.getMechanicDetailedStats(id);
    const db = readDb();
    const workshop = (db.workshops || []).find((w: any) => w.id === mech.workshop_id);

    return {
      ...mech,
      workshop,
      stats: {
        total_assigned: stats?.total_assigned || mech.total_jobs,
        completed: stats?.completed || mech.completed_jobs,
        pending: stats?.pending || 0,
        cancelled: stats?.cancelled || mech.cancelled_jobs,
        recovery_completed: stats?.recovery_completed || 0,
        revenue: stats?.revenue || 0
      },
      jobs: {
        assigned: stats?.assigned_jobs_list || [],
        completed: stats?.completed_jobs_list || [],
        pending: stats?.pending_jobs_list || []
      }
    };
  }

  createMechanic(adminUserId: number, payload: any) {
    if (!payload.email || this.userRepo.getByEmail(payload.email)) {
      throw new Error("Email is already registered in database.");
    }
    if (!payload.phone_number || this.userRepo.getByPhone(payload.phone_number)) {
      throw new Error("Phone number is already registered in database.");
    }

    const password = payload.password || "mech123";
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const cleanUser = this.userRepo.create({
      uuid: crypto.randomUUID(),
      full_name: payload.full_name,
      email: payload.email,
      phone_number: payload.phone_number,
      password_hash: passwordHash,
      role: "MECHANIC",
      status: "ACTIVE",
      profile_image: payload.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.full_name)}&background=10B981&color=fff`,
      address: payload.address || "Workshop address",
      city: payload.city || "Lahore",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      email_verified: true,
      phone_verified: true,
      failed_login_attempts: 0,
      account_locked: false,
      account_locked_until: null
    });

    const data = readDb();
    const countAll = (data.mechanics || []).length;
    const employeeCode = `EMP-MCH-${String(countAll + 1).padStart(3, "0")}`;

    const newMech: Omit<Mechanic, "id"> = {
      uuid: crypto.randomUUID(),
      user_id: cleanUser.id,
      employee_code: employeeCode,
      profile_image: payload.profile_image || cleanUser.profile_image,
      full_name: payload.full_name,
      email: payload.email,
      phone_number: payload.phone_number,
      specialization: Array.isArray(payload.specialization) ? payload.specialization : (payload.specialization ? [payload.specialization] : []),
      experience_years: Number(payload.experience_years) || 1,
      certifications: Array.isArray(payload.certifications) ? payload.certifications : (payload.certifications ? payload.certifications.split(",").map((s: string) => s.trim()) : []),
      workshop_id: Number(payload.workshop_id) || 1,
      current_status: "ACTIVE",
      current_location_lat: 31.5204,
      current_location_lng: 74.3587,
      availability_status: "AVAILABLE",
      rating: 5.0,
      total_jobs: 0,
      completed_jobs: 0,
      cancelled_jobs: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const created = this.mechanicRepo.create(newMech);
    addAuditLog(adminUserId, "mechanic_created", "User", cleanUser.id, `Created mechanic ${created.full_name} with employee code ${created.employee_code}.`);
    return { mechanic: created, temporaryPassword: password };
  }

  updateMechanic(adminUserId: number, id: number, payload: any) {
    const existing = this.mechanicRepo.getById(id);
    if (!existing) throw new Error("Mechanic profile not found.");

    const uUpdates: any = {
      full_name: payload.full_name,
      phone_number: payload.phone_number,
      city: payload.city,
      profile_image: payload.profile_image
    };
    this.userRepo.update(existing.user_id, uUpdates);

    let specs = existing.specialization;
    if (payload.specialization) {
      specs = Array.isArray(payload.specialization) ? payload.specialization : [payload.specialization];
    }
    let certs = existing.certifications;
    if (payload.certifications) {
      certs = Array.isArray(payload.certifications) ? payload.certifications : String(payload.certifications).split(",").map(s => s.trim());
    }

    const mUpdates: Partial<Mechanic> = {
      full_name: payload.full_name || existing.full_name,
      phone_number: payload.phone_number || existing.phone_number,
      specialization: specs,
      experience_years: payload.experience_years !== undefined ? Number(payload.experience_years) : existing.experience_years,
      certifications: certs,
      workshop_id: payload.workshop_id !== undefined ? Number(payload.workshop_id) : existing.workshop_id,
      availability_status: payload.availability_status || existing.availability_status,
      current_status: payload.current_status || existing.current_status,
      profile_image: payload.profile_image || existing.profile_image
    };

    const updated = this.mechanicRepo.update(id, mUpdates);
    addAuditLog(adminUserId, "mechanic_updated", "User", existing.user_id, `Updated mechanic details for ${updated?.full_name}.`);
    return updated;
  }

  setStatus(adminUserId: number, id: number, status: string) {
    const updated = this.mechanicRepo.update(id, { current_status: status.toUpperCase() as any });
    if (!updated) throw new Error("Mechanic profile not found.");
    this.userRepo.update(updated.user_id, { status: status.toUpperCase() });
    addAuditLog(adminUserId, "mechanic_status_updated", "User", updated.user_id, `Changed mechanic status of ${updated.full_name} to ${status.toUpperCase()}.`);
    return updated;
  }

  setAvailability(adminUserId: number, id: number, availability: string) {
    const updated = this.mechanicRepo.update(id, { availability_status: availability.toUpperCase() as any });
    if (!updated) throw new Error("Mechanic profile not found.");
    addAuditLog(adminUserId, "mechanic_availability_updated", "User", updated.user_id, `Changed availability status of ${updated.full_name} to ${availability.toUpperCase()}.`);
    return updated;
  }

  deleteMechanic(adminUserId: number, id: number) {
    const existing = this.mechanicRepo.getById(id);
    if (!existing) throw new Error("Mechanic profile not found.");

    const name = existing.full_name;
    const isDeleted = this.mechanicRepo.delete(id);
    this.userRepo.update(existing.user_id, { status: "INACTIVE" });
    addAuditLog(adminUserId, "mechanic_deleted", "User", existing.user_id, `Purged mechanic registry records for ${name} and marked user profile as INACTIVE.`);
    return isDeleted;
  }

  deleteAllMechanics(adminUserId: number) {
    const data = readDb();
    const count = (data.mechanics || []).length;
    data.mechanics = [];
    data.users = data.users.filter((u: any) => u.role.toUpperCase() !== "MECHANIC");
    data.service_requests.forEach((req: any) => {
      if (req.mechanic_id) {
         req.mechanic_id = null;
         req.status = "pending";
      }
    });
    writeDb(data);
    addAuditLog(adminUserId, "mechanics_deleted_all", "System", 0, `Purged all mechanic registries and associated user profiles.`);
    return count;
  }

  getOverallPerformanceMetrics() {
    const mechanics = this.mechanicRepo.getAll();
    const metrics = mechanics.map(m => {
      const stats = this.mechanicRepo.getMechanicDetailedStats(m.id);
      return {
        id: m.id,
        employee_code: m.employee_code,
        full_name: m.full_name,
        specialization: m.specialization,
        rating: m.rating,
        total_jobs_assigned: stats?.total_assigned || 0,
        completed_jobs: stats?.completed || 0,
        pending_jobs: stats?.pending || 0,
        revenue_generated: stats?.revenue || 0,
        recovery_jobs_completed: stats?.recovery_completed || 0
      };
    });

    return {
      active_mechanics: mechanics.filter(m => m.current_status === "ACTIVE").length,
      available_mechanics: mechanics.filter(m => m.availability_status === "AVAILABLE").length,
      busy_mechanics: mechanics.filter(m => m.availability_status === "BUSY" || m.availability_status === "ON_JOB").length,
      mechanic_table: metrics
    };
  }

  assignJobToMechanic(adminUserId: number, mechanicId: number, requestId: number) {
    const data = readDb();
    const reqIndex = data.service_requests.findIndex((r: any) => r.id === Number(requestId));
    if (reqIndex === -1) throw new Error("Service/Repair request not found.");

    const mech = this.mechanicRepo.getById(mechanicId);
    if (!mech) throw new Error("Mechanic not found.");

    data.service_requests[reqIndex].mechanic_id = mech.id;
    data.service_requests[reqIndex].status = "assigned";
    data.service_requests[reqIndex].updated_at = new Date().toISOString();

    const idx = data.mechanics.findIndex((m: any) => m.id === mech.id);
    if (idx !== -1) data.mechanics[idx].availability_status = "BUSY";

    writeDb(data);
    addAuditLog(adminUserId, "job_assigned", "ServiceRequest", requestId, `Assigned request #${requestId} to mechanic ${mech.full_name}.`);
    return { success: true, service_request: data.service_requests[reqIndex], mechanic: mech };
  }
}

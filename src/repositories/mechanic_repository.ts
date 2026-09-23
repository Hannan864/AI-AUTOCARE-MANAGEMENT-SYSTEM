import { readDb, writeDb, addAuditLog } from "../db/db_helper.js";
import crypto from "crypto";

export interface Mechanic {
  id: number;
  uuid: string;
  user_id: number;
  employee_code: string;
  profile_image: string;
  full_name: string;
  email: string;
  phone_number: string;
  specialization: string[];
  experience_years: number;
  certifications: string[];
  workshop_id: number;
  current_status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BLOCKED";
  current_location_lat: number;
  current_location_lng: number;
  availability_status: "AVAILABLE" | "BUSY" | "ON_JOB" | "OFFLINE" | "ON_LEAVE";
  rating: number;
  total_jobs: number;
  completed_jobs: number;
  cancelled_jobs: number;
  created_at: string;
  updated_at: string;
}

export class MechanicRepository {
  getAll(): Mechanic[] {
    const data = readDb();
    const rawMechanics = data.mechanics || [];
    const users = data.users || [];
    const mechanicsDb = data.mechanics_db || [];

    return rawMechanics.filter((m: any) => {
      const emailLower = (m.email || "").toLowerCase();
      // Can log in if:
      // 1. There is a user account in data.users with role "MECHANIC"
      // 2. Or present in mechanics_db
      const inUsers = users.some((u: any) => (u.email || "").toLowerCase() === emailLower && (u.role || "").toUpperCase() === "MECHANIC");
      const inMechanicsDb = mechanicsDb.some((dm: any) => (dm.email || "").toLowerCase() === emailLower);
      
      return inUsers || inMechanicsDb;
    });
  }

  getById(id: number): Mechanic | null {
    const mechanics = this.getAll();
    return mechanics.find((m) => m.id === id) || null;
  }

  getByUserId(userId: number): Mechanic | null {
    const mechanics = this.getAll();
    return mechanics.find((m) => m.user_id === userId) || null;
  }

  getByEmail(email: string): Mechanic | null {
    const mechanics = this.getAll();
    return mechanics.find((m) => m.email.toLowerCase() === email.toLowerCase()) || null;
  }

  getByPhone(phone: string): Mechanic | null {
    const mechanics = this.getAll();
    return mechanics.find((m) => m.phone_number === phone) || null;
  }

  create(mechanic: Omit<Mechanic, "id">): Mechanic {
    const data = readDb();
    if (!data.mechanics) data.mechanics = [];
    const nextId = data.mechanics.length > 0 ? Math.max(...data.mechanics.map((m: any) => m.id)) + 1 : 1;
    const newMechanic: Mechanic = {
      ...mechanic,
      id: nextId
    };
    data.mechanics.push(newMechanic);
    writeDb(data);
    return newMechanic;
  }

  update(id: number, updates: Partial<Mechanic>): Mechanic | null {
    const data = readDb();
    if (!data.mechanics) data.mechanics = [];
    const index = data.mechanics.findIndex((m: any) => m.id === id);
    if (index === -1) return null;

    const updatedMechanic = {
      ...data.mechanics[index],
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };
    data.mechanics[index] = updatedMechanic;
    writeDb(data);
    return updatedMechanic;
  }

  delete(id: number): boolean {
    const data = readDb();
    if (!data.mechanics) return false;
    const index = data.mechanics.findIndex((m: any) => m.id === id);
    if (index === -1) return false;

    data.mechanics.splice(index, 1);
    writeDb(data);
    return true;
  }

  getMechanicDetailedStats(id: number) {
    const data = readDb();
    const mechanic = this.getById(id);
    if (!mechanic) return null;

    // Filter service requests assigned to this mechanic
    const requests = (data.service_requests || []).filter(
      (sr: any) => sr.mechanic_id === mechanic.id || sr.mechanic_id === mechanic.user_id
    );

    const assignedCount = requests.length;
    const completedList = requests.filter((r: any) => r.status === "completed" || r.status === "resolved");
    const completedCount = completedList.length;
    const pendingList = requests.filter((r: any) => r.status && ["pending", "in_progress", "assigned"].includes(r.status.toLowerCase()));
    const pendingCount = pendingList.length;
    const cancelledCount = requests.filter((r: any) => r.status === "cancelled").length;

    // Recovery list
    const recoveryCount = requests.filter((r: any) => r.request_type === "recovery").length;

    // Let's filter invoices related to this mechanic's assignments
    const requestIds = requests.map((r: any) => r.id);
    const relatedInvoices = (data.invoices || []).filter((inv: any) => requestIds.includes(inv.service_id));
    const revenueGenerated = relatedInvoices
      .filter((inv: any) => inv.status === "paid")
      .reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

    return {
      total_assigned: assignedCount,
      completed: completedCount,
      pending: pendingCount,
      cancelled: cancelledCount,
      recovery_completed: recoveryCount,
      revenue: revenueGenerated,
      assigned_jobs_list: requests,
      completed_jobs_list: completedList,
      pending_jobs_list: pendingList,
      invoices_list: relatedInvoices
    };
  }
}

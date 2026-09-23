import { UserRepository, User } from "../repositories/user_repository.js";
import { addAuditLog } from "../db/db_helper.js";
import crypto from "crypto";

export class UserService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  getPaginatedUsers(params: {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    role?: string;
    status?: string;
    city?: string;
    startDate?: string;
    endDate?: string;
  }) {
    let users = this.userRepo.getAll();

    // 1. Backend Search Engine Filtering
    if (params.search) {
      const q = params.search.toLowerCase();
      users = users.filter(u => 
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone_number.toLowerCase().includes(q)
      );
    }
    if (params.role) {
      users = users.filter(u => u.role.toUpperCase() === params.role!.toUpperCase());
    }
    if (params.status) {
      users = users.filter(u => u.status.toUpperCase() === params.status!.toUpperCase());
    }
    if (params.city) {
      const c = params.city.toLowerCase();
      users = users.filter(u => u.city.toLowerCase().includes(c));
    }
    if (params.startDate) {
      const start = new Date(params.startDate).getTime();
      users = users.filter(u => new Date(u.created_at).getTime() >= start);
    }
    if (params.endDate) {
      const end = new Date(params.endDate).getTime();
      users = users.filter(u => new Date(u.created_at).getTime() <= end);
    }

    // 2. Sorting
    const sortField = (params.sort || "created_at") as keyof User;
    const order = params.order || "desc";
    users.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (valA < valB) return order === "asc" ? -1 : 1;
      if (valA > valB) return order === "asc" ? 1 : -1;
      return 0;
    });

    // 3. Pagination stats
    const total = users.length;
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const startIdx = (page - 1) * limit;
    const paginatedUsers = users.slice(startIdx, startIdx + limit);

    // Dynamic relational status addition for table requirements
    const usersWithStats = paginatedUsers.map(u => {
      const counts = this.userRepo.getUserRelationsCount(u.id);
      return {
        ...u,
        ...counts
      };
    });

    return {
      users: usersWithStats,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  getUserById(id: number) {
    const user = this.userRepo.getById(id);
    if (!user) throw new Error("User not found");
    const relations = this.userRepo.getUserDetailedData(id);
    const counts = this.userRepo.getUserRelationsCount(id);
    return {
      id: user.id,
      uuid: user.uuid,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      status: user.status,
      profile_image: user.profile_image,
      address: user.address,
      city: user.city,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      failed_login_attempts: user.failed_login_attempts,
      account_locked: user.account_locked,
      account_locked_until: user.account_locked_until,
      ...counts,
      relationships: relations
    };
  }

  createUser(adminUserId: number, payload: Partial<User>) {
    if (!payload.email || this.userRepo.getByEmail(payload.email)) {
      throw new Error("Unique and valid Email is required and must not already be registered");
    }
    if (!payload.phone_number || this.userRepo.getByPhone(payload.phone_number)) {
      throw new Error("Unique and valid Phone Number is required and must not already be registered");
    }
    const role = (payload.role || "VEHICLE_OWNER").toUpperCase();
    if (!["ADMIN", "MECHANIC", "VEHICLE_OWNER", "WORKSHOP_MANAGER"].includes(role)) {
      throw new Error(`Invalid role. MUST be one of: ADMIN, MECHANIC, VEHICLE_OWNER, WORKSHOP_MANAGER`);
    }

    const tempPassword = payload.password_hash || Math.random().toString(36).substring(2, 10);
    const hash = crypto.createHash("sha256").update(tempPassword).digest("hex");

    const newUserObj: Omit<User, "id"> = {
      uuid: crypto.randomUUID(),
      full_name: payload.full_name || "New Employee",
      email: payload.email,
      phone_number: payload.phone_number,
      password_hash: hash,
      role: role,
      status: (payload.status || "ACTIVE").toUpperCase(),
      profile_image: payload.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(payload.full_name || "User")}&background=random&color=fff`,
      address: payload.address || "Main Street Address",
      city: payload.city || "Islamabad",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      email_verified: true,
      phone_verified: true,
      failed_login_attempts: 0,
      account_locked: false,
      account_locked_until: null
    };

    const created = this.userRepo.create(newUserObj);
    addAuditLog(adminUserId, "user_created", "User", created.id, `Created ${created.role} user: ${created.full_name} (${created.email}) with temporary password.`);
    return { user: created, tempPassword };
  }

  updateUser(adminUserId: number, id: number, payload: Partial<User>) {
    const existing = this.userRepo.getById(id);
    if (!existing) throw new Error("User not found");

    if (payload.email && payload.email !== existing.email) {
      const conflict = this.userRepo.getByEmail(payload.email);
      if (conflict) throw new Error("Email lies in system registry already");
    }
    if (payload.phone_number && payload.phone_number !== existing.phone_number) {
      const conflict = this.userRepo.getByPhone(payload.phone_number);
      if (conflict) throw new Error("Phone number lies in system registry already");
    }

    // Filter off attempts to edit restricted attributes
    const allowed: Partial<User> = {
      full_name: payload.full_name,
      phone_number: payload.phone_number,
      address: payload.address,
      city: payload.city,
      status: payload.status,
      profile_image: payload.profile_image,
      role: payload.role
    };

    const updated = this.userRepo.update(id, allowed);
    if (!updated) throw new Error("Update failed");

    addAuditLog(adminUserId, "user_updated", "User", id, `Updated account information for ${updated.full_name}.`);
    return updated;
  }

  setUserStatus(adminUserId: number, id: number, status: string) {
    const updated = this.userRepo.update(id, { status: status.toUpperCase() });
    if (!updated) throw new Error("User not found");

    let action = "user_updated";
    if (status === "ACTIVE") action = "user_activated";
    else if (status === "SUSPENDED") action = "user_suspended";
    else if (status === "BLOCKED") action = "user_blocked";

    addAuditLog(adminUserId, action, "User", id, `Updated user status of [${updated.full_name}] to ${status}.`);
    return updated;
  }

  unlockAccount(adminUserId: number, id: number) {
    const updated = this.userRepo.update(id, {
      account_locked: false,
      account_locked_until: null,
      failed_login_attempts: 0
    });
    if (!updated) throw new Error("User not found");
    addAuditLog(adminUserId, "account_unlocked", "User", id, `Admin unlocked profile or reset attempts of [${updated.full_name}].`);
    return updated;
  }

  resetPassword(adminUserId: number, id: number) {
    const existing = this.userRepo.getById(id);
    if (!existing) throw new Error("User not found");

    const tempPassword = Math.random().toString(36).substring(2, 10);
    const hash = crypto.createHash("sha256").update(tempPassword).digest("hex");

    this.userRepo.update(id, { password_hash: hash });
    addAuditLog(adminUserId, "password_reset", "User", id, `Forced random temporary password credentials update on ${existing.full_name}.`);
    return tempPassword;
  }

  deleteUser(adminUserId: number, id: number) {
    const counts = this.userRepo.getUserRelationsCount(id);
    // Safety verification check: prevent orphan records
    if (counts.vehiclesCount > 0 || counts.repairRequestsCount > 0 || counts.recoveryRequestsCount > 0) {
      // Relational database integrity constraint safety: soft delete instead of permanent deletion!
      const updated = this.userRepo.update(id, { status: "INACTIVE" });
      addAuditLog(adminUserId, "user_deleted", "User", id, `Soft deleted user [${existingName(id)}] by setting status to INACTIVE due to active vehicles/requests relationships.`);
      return { success: true, mode: "soft_delete" };
    }

    const name = existingName(id);
    const success = this.userRepo.delete(id);
    if (!success) throw new Error("User deletion registry operation failure");

    addAuditLog(adminUserId, "user_deleted", "User", id, `Permanently purged user registry record for [${name}].`);
    return { success: true, mode: "permanent_delete" };
  }
}

function existingName(id: number): string {
  try {
    const r = new UserRepository();
    const u = r.getById(id);
    return u ? u.full_name : `#${id}`;
  } catch {
    return `#${id}`;
  }
}

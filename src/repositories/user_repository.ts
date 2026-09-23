import { readDb, writeDb, addAuditLog } from "../db/db_helper.js";

export interface User {
  id: number;
  uuid: string;
  full_name: string;
  email: string;
  phone_number: string;
  password_hash: string;
  role: string;
  status: string;
  profile_image: string;
  address: string;
  city: string;
  created_at: string;
  updated_at: string;
  last_login: string;
  email_verified: boolean;
  phone_verified: boolean;
  failed_login_attempts: number;
  account_locked: boolean;
  account_locked_until: string | null;
}

export class UserRepository {
  getAll(): User[] {
    const data = readDb();
    return data.users;
  }

  getById(id: number): User | null {
    const users = this.getAll();
    const user = users.find((u) => u.id === id);
    return user || null;
  }

  getByEmail(email: string): User | null {
    const users = this.getAll();
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return user || null;
  }

  getByPhone(phone: string): User | null {
    const users = this.getAll();
    const user = users.find((u) => u.phone_number === phone);
    return user || null;
  }

  create(user: Omit<User, "id">): User {
    const data = readDb();
    const nextId = data.users.length > 0 ? Math.max(...data.users.map((u: any) => u.id)) + 1 : 1;
    const newUser: User = {
      ...user,
      id: nextId
    };
    data.users.push(newUser);
    writeDb(data);
    return newUser;
  }

  update(id: number, updates: Partial<User>): User | null {
    const data = readDb();
    const index = data.users.findIndex((u: any) => u.id === id);
    if (index === -1) return null;

    const updatedUser = {
      ...data.users[index],
      ...updates,
      id, // ensure ID is preserved
      updated_at: new Date().toISOString()
    };
    data.users[index] = updatedUser;
    writeDb(data);
    return updatedUser;
  }

  delete(id: number): boolean {
    const data = readDb();
    const index = data.users.findIndex((u: any) => u.id === id);
    if (index === -1) return false;

    data.users.splice(index, 1);
    writeDb(data);
    return true;
  }

  getUserRelationsCount(id: number) {
    const data = readDb();
    const vehiclesCount = (data.vehicles || []).filter((v: any) => v.user_id === id).length;
    
    const repairRequestsCount = (data.service_requests || []).filter(
      (sr: any) => sr.user_id === id && sr.request_type !== "recovery"
    ).length;

    const recoveryRequestsCount = (data.service_requests || []).filter(
      (sr: any) => sr.user_id === id && sr.request_type === "recovery"
    ).length;

    return {
      vehiclesCount,
      repairRequestsCount,
      recoveryRequestsCount
    };
  }

  getUserDetailedData(id: number) {
    const data = readDb();
    const vehicles = (data.vehicles || []).filter((v: any) => v.user_id === id);
    const services = (data.service_requests || []).filter((sr: any) => sr.user_id === id);
    const invoices = (data.invoices || []).filter((inv: any) => inv.user_id === id);
    
    return {
      vehicles,
      repair_requests: services.filter(sr => sr.request_type !== "recovery"),
      recovery_requests: services.filter(sr => sr.request_type === "recovery"),
      invoices,
      activity_timeline: (data.audit_logs || []).filter((log: any) => log.user_id === id)
    };
  }
}

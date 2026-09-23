import { readDb, writeDb } from "../db/db_helper.js";

export interface RequestTimeline {
  action: string;
  timestamp: string;
  user: string;
  details?: string;
}

export interface AdminNote {
  author: string;
  date: string;
  content: string;
}

export interface RequestAttachment {
  url: string;
  name: string;
  type: string;
  uploaded_at: string;
}

export interface ServiceRequest {
  id: number;
  uuid: string;
  user_id: number;
  vehicle_id: number;
  request_type: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  mechanic_id?: number | null;
  location_lat?: number;
  location_lng?: number;
  estimated_cost?: number;
  parts_cost?: number;
  labor_cost?: number;
  recovery_cost?: number;
  tax?: number;
  discount?: number;
  final_cost?: number;
  admin_notes?: AdminNote[];
  attachments?: RequestAttachment[];
  timeline?: RequestTimeline[];
}

export class RequestRepository {
  getAll(): ServiceRequest[] {
    const data = readDb();
    return data.service_requests || [];
  }

  getById(id: number): ServiceRequest | null {
    const requests = this.getAll();
    return requests.find((r) => r.id === id) || null;
  }

  create(req: Omit<ServiceRequest, "id">): ServiceRequest {
    const data = readDb();
    if (!data.service_requests) data.service_requests = [];
    const nextId = data.service_requests.length > 0 ? Math.max(...data.service_requests.map((r: any) => r.id)) + 1 : 1;
    const newRequest: ServiceRequest = {
      ...req,
      id: nextId
    };
    data.service_requests.push(newRequest);
    writeDb(data);
    return newRequest;
  }

  update(id: number, updates: Partial<ServiceRequest>): ServiceRequest | null {
    const data = readDb();
    if (!data.service_requests) data.service_requests = [];
    const index = data.service_requests.findIndex((r: any) => r.id === id);
    if (index === -1) return null;

    const updated = {
      ...data.service_requests[index],
      ...updates,
      id,
      updated_at: new Date().toISOString()
    };
    data.service_requests[index] = updated;
    writeDb(data);
    return updated;
  }

  delete(id: number): boolean {
    const data = readDb();
    if (!data.service_requests) return false;
    const index = data.service_requests.findIndex((r: any) => r.id === id);
    if (index === -1) return false;

    data.service_requests.splice(index, 1);
    writeDb(data);
    return true;
  }
}

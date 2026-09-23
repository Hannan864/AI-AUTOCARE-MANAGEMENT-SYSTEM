import fs from "fs";
import path from "path";
import crypto from "crypto";

const dbPath = path.join(process.cwd(), "db.json");
export const TOKEN_SECRET = "autocare-super-secret-key-signature";

export function signToken(payload: { id: number; email: string; role: string }) {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadStr).digest("base64");
  return `${payloadB64}.${signature}`;
}

export function readDb() {
  let data: any;
  if (!fs.existsSync(dbPath)) {
    data = {
      users: [],
      vehicles: [],
      service_requests: [],
      messages: [],
      invoices: [],
      payment_methods: [],
      audit_logs: []
    };
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } else {
    data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  }

  // Ensure default arrays
  if (!data.users) data.users = [];
  if (!data.vehicles) data.vehicles = [];
  if (!data.service_requests) data.service_requests = [];
  if (!data.messages) data.messages = [];
  if (!data.invoices) data.invoices = [];
  if (!data.payment_methods) data.payment_methods = [];
  if (!data.audit_logs) data.audit_logs = [];
  if (!data.workshops) data.workshops = [];
  if (!data.mechanics) data.mechanics = [];
  if (!data.gigs) data.gigs = [];
  if (!data.service_history) data.service_history = [];
  if (!data.parts_used) data.parts_used = [];
  if (!data.uploads) data.uploads = [];

  // Seed standard workshops if none exist
  if (data.workshops.length === 0) {
    data.workshops = [
      {
        id: 1,
        workshop_name: "Lahore AutoCare Pro Center",
        address: "72-B, Gulberg III, Ferozepur Road",
        city: "Lahore",
        phone: "042-35876543",
        manager_id: 3
      },
      {
        id: 2,
        workshop_name: "Islamabad Sector G-10 Workshop",
        address: "Plot 19, Street 4, I-10 Industrial Area",
        city: "Islamabad",
        phone: "051-44332211",
        manager_id: 3
      },
      {
        id: 3,
        workshop_name: "Karachi Clifton Flagship Hub",
        address: "Block 4, Scheme 5, Clifton",
        city: "Karachi",
        phone: "021-35308822",
        manager_id: 3
      }
    ];
  }

  // Migrate existing users to ensure all fields required by enterprise specification exist
  data.users = data.users.map((u: any) => {
    let r = u.role || "vehicle_owner";
    if (r === "mechanic") r = "MECHANIC";
    if (r === "admin") r = "ADMIN";
    if (r === "vehicle_owner") r = "VEHICLE_OWNER";
    
    // Auto-update names of default users for premium look
    let fName = u.full_name || u.name;
    if (u.id === 5 && fName === "mech") fName = "Zahid Ali";

    const { role: rawRole, ...restUser } = u;

    return {
      id: u.id,
      uuid: u.uuid || crypto.randomUUID(),
      full_name: fName || "Default Name",
      email: u.email || "",
      phone_number: u.phone_number || u.phone || "0300-1234567",
      password_hash: u.password_hash || (u.password ? crypto.createHash("sha256").update(u.password).digest("hex") : crypto.createHash("sha256").update("default123").digest("hex")),
      status: u.status || "ACTIVE",
      profile_image: u.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(fName || "User")}&background=random&color=fff`,
      address: u.address || "Street Address",
      city: u.city || "Lahore",
      created_at: u.created_at || new Date().toISOString(),
      updated_at: u.updated_at || new Date().toISOString(),
      last_login: u.last_login || new Date().toISOString(),
      email_verified: u.email_verified !== undefined ? u.email_verified : true,
      phone_verified: u.phone_verified !== undefined ? u.phone_verified : true,
      failed_login_attempts: u.failed_login_attempts || 0,
      account_locked: u.account_locked !== undefined ? u.account_locked : false,
      account_locked_until: u.account_locked_until || null,
      ...restUser,
      role: r // ensure strictly formatted role
    };
  });

  // Seed mechanics if empty
  if (data.mechanics.length === 0) {
    data.mechanics = [
      {
        id: 1,
        uuid: crypto.randomUUID(),
        user_id: 2,
        employee_code: "EMP-MCH-001",
        profile_image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
        full_name: "Tariq Mehmood",
        email: "mechanic@autocare.pk",
        phone_number: "0300-9876543",
        specialization: ["Engine Repair", "Maintenance", "Brake Systems"],
        experience_years: 6,
        certifications: ["ASE Master Automobile Technician", "Toyota Certified Expert"],
        workshop_id: 1,
        current_status: "ACTIVE",
        current_location_lat: 31.5204,
        current_location_lng: 74.3587,
        availability_status: "AVAILABLE",
        rating: 4.8,
        total_jobs: 142,
        completed_jobs: 139,
        cancelled_jobs: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        uuid: crypto.randomUUID(),
        user_id: 5,
        employee_code: "EMP-MCH-002",
        profile_image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200",
        full_name: "Zahid Ali",
        email: "mech@gmail.com",
        phone_number: "0321-7654321",
        specialization: ["Electrical", "AC Repair", "Diagnostics"],
        experience_years: 4,
        certifications: ["Automotive Electrical Certified Specialist"],
        workshop_id: 2,
        current_status: "ACTIVE",
        current_location_lat: 33.6844,
        current_location_lng: 73.0479,
        availability_status: "BUSY",
        rating: 4.5,
        total_jobs: 88,
        completed_jobs: 85,
        cancelled_jobs: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  return data;
}

export function writeDb(data: any) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

export function addAuditLog(userId: number, actionType: string, entityType: string, entityId: number, description: string, status: string = "success") {
  const data = readDb();
  const nextId = data.audit_logs.length > 0 
    ? Math.max(...data.audit_logs.map((log: any) => log.id)) + 1 
    : 1;
  const newLog = {
    id: nextId,
    user_id: userId,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    description,
    status,
    created_at: new Date().toISOString()
  };
  data.audit_logs.push(newLog);
  writeDb(data);
  return newLog;
}

export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;
    const payloadStr = Buffer.from(payloadB64, "base64").toString("utf8");
    const testSignature = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadStr).digest("base64");
    if (signature === testSignature) {
      return JSON.parse(payloadStr);
    }
  } catch (err) {
    // Return null on failure
  }
  return null;
}

export const authMiddleware = (req: any, res: any, next: any) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authorization token required" });
  }
  const token = header.substring(7);
  const userPayload = verifyToken(token);
  if (!userPayload) {
    return res.status(401).json({ success: false, message: "Invalid or expired authorization token" });
  }
  req.user = userPayload;
  next();
};

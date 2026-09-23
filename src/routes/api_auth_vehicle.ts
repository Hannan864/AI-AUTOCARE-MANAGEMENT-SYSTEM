import { Router } from "express";
import crypto from "crypto";
import { readDb, writeDb, addAuditLog, signToken, authMiddleware } from "../db/db_helper.js";

const router = Router();

interface User {
  id: number;
  full_name: string;
  email: string;
  password?: string;
  role: string;
}

interface Vehicle {
  id: number;
  user_id: number;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  registration_number: string;
  color: string;
  mileage: string;
}

// Auth: Update Profile
router.post("/auth/profile/update", authMiddleware, (req: any, res) => {
  const { full_name } = req.body;
  if (!full_name) {
    return res.status(400).json({ success: false, message: "Full name is required" });
  }

  const data = readDb();
  const userIndex = data.users.findIndex((u: User) => u.id === req.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  data.users[userIndex].full_name = full_name;

  const role = data.users[userIndex].role;
  if (role === "vehicle_owner" || role === "user") {
    if (!data.vehicle_owners_db) data.vehicle_owners_db = [];
    const idx = data.vehicle_owners_db.findIndex((u: User) => u.id === req.user.id);
    if (idx !== -1) data.vehicle_owners_db[idx].full_name = full_name;
  } else if (role === "mechanic") {
    if (!data.mechanics_db) data.mechanics_db = [];
    const idx = data.mechanics_db.findIndex((u: User) => u.id === req.user.id);
    if (idx !== -1) data.mechanics_db[idx].full_name = full_name;
  } else if (role === "admin") {
    if (!data.admins_db) data.admins_db = [];
    const idx = data.admins_db.findIndex((u: User) => u.id === req.user.id);
    if (idx !== -1) data.admins_db[idx].full_name = full_name;
  }

  writeDb(data);
  addAuditLog(req.user.id, "profile_updated", "User", req.user.id, `User ${full_name} updated their profile settings.`);

  res.json({
    success: true,
    message: "Profile synchronized with registry databases",
    data: {
      id: data.users[userIndex].id,
      full_name: data.users[userIndex].full_name,
      email: data.users[userIndex].email,
      role: data.users[userIndex].role
    }
  });
});

// Auth: Register
router.post("/auth/register", (req, res) => {
  const { full_name, email, password, role } = req.body;
  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: "Missing required registration parameters" });
  }

  const data = readDb();
  const existing = data.users.find((u: User) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, message: "Email already registered" });
  }

  const registeredRole = (role || "").trim().toLowerCase();
  const dbRoleToSave = registeredRole === "mechanic" ? "MECHANIC" : registeredRole === "admin" ? "ADMIN" : "VEHICLE_OWNER";

  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
  const phone = req.body.phone_number || req.body.phone || "0300-1234567";
  const newUser: any = {
    id: data.users.length > 0 ? Math.max(...data.users.map((u: User) => u.id)) + 1 : 1,
    full_name,
    email,
    password,
    phone_number: phone,
    password_hash: passwordHash,
    role: dbRoleToSave
  };

  if (!data.vehicle_owners_db) data.vehicle_owners_db = [];
  if (!data.mechanics_db) data.mechanics_db = [];
  if (!data.admins_db) data.admins_db = [];

  if (registeredRole === "vehicle_owner" || registeredRole === "user") {
    if (data.vehicle_owners_db.some((u: User) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Email already registered in Vehicle Owner database" });
    }
    data.vehicle_owners_db.push(newUser);
  } else if (registeredRole === "mechanic") {
    if (data.mechanics_db.some((u: User) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Email already registered in Mechanic database" });
    }
    data.mechanics_db.push(newUser);

    // Automatically create a fully active, assigned mechanic profile in the mechanics list
    if (!data.mechanics) data.mechanics = [];
    const nextMechId = data.mechanics.length > 0 ? Math.max(...data.mechanics.map((m: any) => m.id)) + 1 : 1;
    const employeeCode = `EMP-MCH-${String(nextMechId).padStart(3, "0")}`;
    const newMechanicProfile = {
      id: nextMechId,
      uuid: `mech-${nextMechId}-${Date.now()}`,
      user_id: newUser.id,
      employee_code: employeeCode,
      profile_image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200",
      full_name: newUser.full_name,
      email: newUser.email,
      phone_number: phone,
      specialization: ["General Repairs", "Maintenance"],
      experience_years: 3,
      certifications: ["AutoCare Standard Professional Certification"],
      workshop_id: 1,
      current_status: "ACTIVE",
      current_location_lat: 31.5204,
      current_location_lng: 74.3587,
      availability_status: "AVAILABLE",
      rating: 4.5,
      total_jobs: 0,
      completed_jobs: 0,
      cancelled_jobs: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    data.mechanics.push(newMechanicProfile);
  } else if (registeredRole === "admin") {
    if (data.admins_db.some((u: User) => u.email.toLowerCase() === email.toLowerCase())) {
      return res.status(400).json({ success: false, message: "Email already registered in Admin database" });
    }
    data.admins_db.push(newUser);
  }

  data.users.push(newUser);
  writeDb(data);
  addAuditLog(newUser.id, "user_created", "User", newUser.id, `User ${newUser.full_name} registered as ${registeredRole === "vehicle_owner" ? "Vehicle Owner" : registeredRole === "mechanic" ? "Mechanic" : "Admin"}.`);

  res.status(201).json({
    success: true,
    message: "Registration successful",
    data: {
      user: {
        id: newUser.id,
        full_name: newUser.full_name,
        email: newUser.email,
        role: newUser.role
      }
    }
  });
});

// Auth: Direct Login (Bypass password)
router.post("/auth/login-direct", (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ success: false, message: "Email and role are required" });
  }

  const data = readDb();
  // Find user by email. Note: db roles are uppercase (VEHICLE_OWNER, MECHANIC, ADMIN)
  let user = data.users.find((u: any) => 
    u.email.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    // Auto-create user for testing mode
    const registeredRole = (role || "").trim().toLowerCase();
    const dbRoleToSave = registeredRole === "mechanic" ? "MECHANIC" : registeredRole === "admin" ? "ADMIN" : "VEHICLE_OWNER";
    
    let fullName = "Ahmed Khan";
    if (email.toLowerCase().includes("hangg") || registeredRole === "admin") {
      fullName = "Hangg Admin";
    } else if (registeredRole === "mechanic") {
      fullName = "Zahid Ali";
    }

    const passwordHash = crypto.createHash("sha256").update("default123").digest("hex");
    const nextUserId = data.users.length > 0 ? Math.max(...data.users.map((u: any) => u.id)) + 1 : 1;
    
    const newUser: any = {
      id: nextUserId,
      uuid: crypto.randomUUID(),
      full_name: fullName,
      email: email,
      phone_number: "0300-1234567",
      password: "default123",
      password_hash: passwordHash,
      role: dbRoleToSave,
      status: "ACTIVE",
      profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`,
      address: "72-B, Gulberg III",
      city: "Lahore",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      email_verified: true,
      phone_verified: true,
      failed_login_attempts: 0,
      account_locked: false,
      account_locked_until: null
    };

    if (!data.vehicle_owners_db) data.vehicle_owners_db = [];
    if (!data.mechanics_db) data.mechanics_db = [];
    if (!data.admins_db) data.admins_db = [];

    if (dbRoleToSave === "VEHICLE_OWNER") {
      data.vehicle_owners_db.push(newUser);
    } else if (dbRoleToSave === "MECHANIC") {
      data.mechanics_db.push(newUser);
      
      // Also ensure a mechanic profile exists in data.mechanics so queries return properly
      if (!data.mechanics) data.mechanics = [];
      const nextMechId = data.mechanics.length > 0 ? Math.max(...data.mechanics.map((m: any) => m.id)) + 1 : 1;
      const employeeCode = `EMP-MCH-${String(nextMechId).padStart(3, "0")}`;
      const newMechanicProfile = {
        id: nextMechId,
        uuid: crypto.randomUUID(),
        user_id: newUser.id,
        employee_code: employeeCode,
        profile_image: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff`,
        full_name: newUser.full_name,
        email: newUser.email,
        phone_number: newUser.phone_number,
        specialization: ["Engine Repair", "Diagnostics", "Maintenance"],
        experience_years: 5,
        certifications: ["AutoCare Standard Professional Certification"],
        workshop_id: 1,
        current_status: "ACTIVE",
        current_location_lat: 31.5204,
        current_location_lng: 74.3587,
        availability_status: "AVAILABLE",
        rating: 4.8,
        total_jobs: 0,
        completed_jobs: 0,
        cancelled_jobs: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      data.mechanics.push(newMechanicProfile);
    } else if (dbRoleToSave === "ADMIN") {
      data.admins_db.push(newUser);
    }

    data.users.push(newUser);
    writeDb(data);
    user = newUser;
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.json({
    success: true,
    message: "Login successful",
    data: {
      access_token: token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    }
  });
});

// Auth: Login
router.post("/auth/login", (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required" });
  }

  const data = readDb();
  const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
  const user = data.users.find((u: any) => 
    u.email.toLowerCase() === email.toLowerCase() && 
    (u.password === password || u.password_hash === hashedPassword)
  );

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  // Validate that the user's registered role matches the selected role option
  const selectedRole = (role || "").toLowerCase();
  const dbRole = (user.role || "").toLowerCase();

  let roleMatches = false;
  if (selectedRole === "user") {
    roleMatches = (dbRole === "user" || dbRole === "vehicle_owner" || dbRole === "owner");
  } else {
    roleMatches = (dbRole === selectedRole);
  }

  if (!roleMatches) {
    const displaySelectedRole = selectedRole === "user" ? "Vehicle Owner" : selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1);
    return res.status(403).json({
      success: false,
      message: `Account is not registered with the selected role: ${displaySelectedRole}`
    });
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role });

  res.json({
    success: true,
    message: "Login successful",
    data: {
      access_token: token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    }
  });
});

export default router;

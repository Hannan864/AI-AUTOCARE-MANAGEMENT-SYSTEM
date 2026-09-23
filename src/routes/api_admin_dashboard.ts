import { Router } from "express";
import fs from "fs";
import path from "path";
import { readDb, writeDb, authMiddleware } from "../db/db_helper.js";

const router = Router();
const dbPath = path.join(process.cwd(), "db.json");

// Helper to retrieve system health
const getSystemHealth = () => {
  let db_status = "healthy";
  let api_status = "healthy";
  let storage_status = "healthy";
  let upload_service_status = "healthy";

  try {
    const dbExists = fs.existsSync(dbPath);
    if (!dbExists) db_status = "unhealthy";
    else {
      const content = fs.readFileSync(dbPath, "utf8");
      JSON.parse(content);
    }
  } catch (err) {
    db_status = "unhealthy";
  }

  try {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      storage_status = "unhealthy";
    }
  } catch (err) {
    storage_status = "unhealthy";
  }

  return {
    database: db_status,
    api: api_status,
    storage: storage_status,
    upload_service: upload_service_status
  };
};

// Admin Dashboard unified endpoint
const adminDashboardHandler = (req: any, res: any) => {
  const userRole = (req.user.role || "").toUpperCase();
  if (userRole !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin role required" });
  }

  const data = readDb();

  // 1. Statistics Cards
  const totalUsers = data.users.filter((u: any) => {
    const rRole = (u.role || "").toUpperCase();
    return rRole !== 'ADMIN' && 
      u.status !== 'suspended' && 
      u.status !== 'deleted' && 
      u.suspended !== true && 
      u.deleted !== true;
  }).length;

  const activeMechanics = data.users.filter((u: any) => {
    const rRole = (u.role || "").toUpperCase();
    return rRole === 'MECHANIC' && 
      u.status !== 'suspended' && 
      u.status !== 'deleted' && 
      u.status !== 'inactive' && 
      u.suspended !== true && 
      u.deleted !== true;
  }).length;

  const pendingStatuses = ['pending', 'submitted', 'waiting_assignment'];
  const pendingRequests = (data.service_requests || []).filter((r: any) => 
    r.status && pendingStatuses.includes(r.status.toLowerCase())
  ).length;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthlyInvoices = (data.invoices || []).filter((inv: any) => {
    if (inv.status !== 'paid') return false;
    const dateStr = inv.paid_at || inv.created_at;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlyRevenue = monthlyInvoices.reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

  // 2. Recent System Activity (show latest 20 actions from audit_logs)
  const recentActivity = (data.audit_logs || [])
    .slice()
    .reverse()
    .slice(0, 20)
    .map((log: any) => {
      const logUser = data.users.find((u: any) => u.id === log.user_id);
      return {
        id: log.id,
        user_name: logUser ? logUser.full_name : `User #${log.user_id}`,
        action_type: log.action_type,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        description: log.description,
        status: log.status,
        created_at: log.created_at
      };
    });

  // 3. Revenue Chart (last 7 days day-by-day)
  const invoices = data.invoices || [];
  const revenueChart: { date: string; value: number }[] = [];
  const days = 7;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    const dayStart = new Date(d.setHours(0,0,0,0)).getTime();
    const dayEnd = new Date(d.setHours(23,59,59,999)).getTime();
    
    const daySum = invoices
      .filter((inv: any) => {
        if (inv.status !== "paid") return false;
        const paidTime = new Date(inv.paid_at || inv.created_at).getTime();
        return paidTime >= dayStart && paidTime <= dayEnd;
      })
      .reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

    revenueChart.push({ date: dateStr, value: daySum });
  }

  const systemHealth = getSystemHealth();

  res.json({
    success: true,
    data: {
      dashboard_stats: {
        total_users: totalUsers,
        active_mechanics: activeMechanics,
        pending_requests: pendingRequests,
        monthly_revenue: monthlyRevenue
      },
      recent_activity: recentActivity,
      revenue_chart: revenueChart,
      system_health: systemHealth
    }
  });
};

router.get("/admin/dashboard", authMiddleware, adminDashboardHandler);
router.get("/v1/admin/dashboard", authMiddleware, adminDashboardHandler);

const adminRevenueHandler = (req: any, res: any) => {
  const userRole = (req.user.role || "").toUpperCase();
  if (userRole !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied" });
  }

  const data = readDb();
  const invoices = data.invoices || [];

  const result: { date: string; value: number }[] = [];
  const days = 7;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    
    const dayStart = new Date(d.setHours(0,0,0,0)).getTime();
    const dayEnd = new Date(d.setHours(23,59,59,999)).getTime();
    
    const daySum = invoices
      .filter((inv: any) => {
        if (inv.status !== "paid") return false;
        const paidTime = new Date(inv.paid_at || inv.created_at).getTime();
        return paidTime >= dayStart && paidTime <= dayEnd;
      })
      .reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);

    result.push({ date: dateStr, value: daySum });
  }

  res.json({ success: true, data: result });
};

router.get("/admin/dashboard/revenue", authMiddleware, adminRevenueHandler);
router.get("/v1/admin/dashboard/revenue", authMiddleware, adminRevenueHandler);

router.post("/admin/system/reset", authMiddleware, (req: any, res) => {
  if (req.user?.role?.toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Unauthorized: Admin access required for factory reset" });
  }

  const data = readDb();
  
  const emptyData = {
    users: [],
    vehicles: [],
    service_requests: [],
    messages: [],
    invoices: [],
    payment_methods: [],
    audit_logs: [],
    workshops: data.workshops || [],
    mechanics: [],
    vehicle_owners_db: [],
    mechanics_db: [],
    admins_db: []
  };

  writeDb(emptyData);

  res.json({ success: true, message: "System factory reset completed successfully. All data purged." });
});

export default router;

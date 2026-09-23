import { readDb } from "../db/db_helper.js";

export class OwnerDashboardService {
  getDashboardData(userId: number) {
    const data = readDb();

    // Find authenticated user
    const userObj = data.users.find((u: any) => u.id === userId) || {};
    const sanitizedUser = {
      id: userObj.id,
      full_name: userObj.full_name,
      email: userObj.email,
      role: userObj.role,
      profile_image: userObj.profile_image
    };

    // 1. Vehicles count
    const vehicles = data.vehicles || [];
    const ownerVehicles = vehicles.filter((v: any) => v.user_id === userId);
    const totalVehicles = ownerVehicles.length;

    // Create unique maps for easy lookup
    const vehiclesMap: Record<number, string> = {};
    ownerVehicles.forEach((v: any) => {
      vehiclesMap[v.id] = `${v.make} ${v.model}`;
    });

    // 2. Service Requests
    const serviceRequests = data.service_requests || [];
    const ownerRequests = serviceRequests.filter((r: any) => r.user_id === userId);

    const activeStatuses = ["pending", "assigned", "accepted", "in_progress", "scheduled", "on_the_way", "arrived"];
    const activeRequestsCount = ownerRequests.filter((r: any) => 
      activeStatuses.includes((r.status || "").toLowerCase())
    ).length;

    const completedServicesCount = ownerRequests.filter((r: any) => 
      (r.status || "").toLowerCase() === "completed"
    ).length;

    // 3. Calculating Paid Invoices (Spending)
    const invoices = data.invoices || [];
    const ownerInvoices = invoices.filter((inv: any) => 
      inv.user_id === userId && (inv.status || "").toLowerCase() === "paid"
    );
    const totalSpent = ownerInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amount || 0), 0);

    // List active requests
    const activeRequestsList = ownerRequests.filter((r: any) => 
      activeStatuses.includes((r.status || "").toLowerCase())
    ).map((r: any) => ({
      id: r.id,
      vehicle: vehiclesMap[r.vehicle_id] || `Vehicle #${r.vehicle_id}`,
      request_type: r.request_type,
      status: r.status ? r.status.toUpperCase() : "PENDING",
      created_at: r.created_at,
      description: r.description
    }));

    // Find Audit Logs or dynamic actions completed by/for user
    const auditLogs = data.audit_logs || [];
    const userLogs = auditLogs.filter((log: any) => log.user_id === userId);

    const recentActivity = userLogs.length > 0 
      ? [...userLogs].sort((a: any, b: any) => b.id - a.id).slice(0, 15).map((log: any) => {
          let actionLabel = "Activity";
          const action_type = (log.action_type || "").toLowerCase();
          if (action_type === "request_created" || action_type.includes("create")) {
            actionLabel = "Request created";
          } else if (action_type.includes("offer_received") || action_type.includes("bid") || action_type === "offer_received") {
            actionLabel = "Offer received";
          } else if (action_type.includes("accept") || action_type === "request_accepted") {
            actionLabel = "Request accepted";
          } else if (action_type.includes("start") || action_type.includes("progress")) {
            actionLabel = "Service started";
          } else if (action_type.includes("complete")) {
            actionLabel = "Service completed";
          } else {
            actionLabel = log.action_type || "Activity Updated";
          }

          return {
            id: log.id,
            action: actionLabel,
            description: log.description || "",
            timestamp: log.created_at
          };
        })
      : [...ownerRequests].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 15).map((r: any) => {
          let actionLabel = "Request Status";
          const status = (r.status || "").toLowerCase();
          if (status === "pending") {
            actionLabel = "Request created";
          } else if (status === "assigned") {
            actionLabel = "Request accepted";
          } else if (status === "in_progress") {
            actionLabel = "Service started";
          } else if (status === "completed") {
            actionLabel = "Service completed";
          }

          return {
            id: r.id,
            action: actionLabel,
            description: `REQ-${r.id}: Work for ${vehiclesMap[r.vehicle_id] || "your vehicle"} is ${r.status}.`,
            timestamp: r.created_at
          };
        });

    return {
      user: sanitizedUser,
      vehicles_count: totalVehicles,
      active_requests_count: activeRequestsCount,
      completed_services_count: completedServicesCount,
      total_spending: totalSpent,
      active_requests: activeRequestsList,
      recent_activity: recentActivity
    };
  }
}


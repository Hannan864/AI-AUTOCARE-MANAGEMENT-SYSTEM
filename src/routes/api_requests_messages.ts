import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { readDb, writeDb, addAuditLog, authMiddleware } from "../db/db_helper.js";

const router = Router();

interface ServiceRequest {
  id: number;
  vehicle_id: number;
  user_id: number;
  request_type: string;
  description: string;
  status: string;
  created_at: string;
  location_lat?: number;
  location_lng?: number;
  mechanic_id?: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({ storage });

// Service Requests: Create Service Request
router.post("/service_requests", authMiddleware, (req: any, res) => {
  const { vehicle_id, request_type, description, mechanic_id } = req.body;
  if (!vehicle_id || !request_type) {
    return res.status(400).json({ success: false, message: "Missing vehicle or service request type" });
  }

  const data = readDb();
  const newRequest: ServiceRequest = {
    id: data.service_requests.length > 0 ? Math.max(...data.service_requests.map((r: ServiceRequest) => r.id)) + 1 : 1,
    vehicle_id: parseInt(vehicle_id),
    user_id: req.user.id,
    request_type,
    description: description || "",
    status: mechanic_id ? "assigned" : "pending",
    created_at: new Date().toISOString()
  };

  if (mechanic_id) {
    newRequest.mechanic_id = parseInt(mechanic_id);
  }

  data.service_requests.push(newRequest);
  writeDb(data);
  addAuditLog(req.user.id, "request_created", "ServiceRequest", newRequest.id, `Service request created: ${newRequest.request_type} (${newRequest.description.substring(0, 40)}${newRequest.description.length > 40 ? '...' : ''}).`);

  res.status(201).json({
    success: true,
    message: "Request submitted successfully!",
    data: newRequest
  });
});

// Service Requests: Create Roadside Recovery Request
router.post("/service_requests/recovery", authMiddleware, (req: any, res) => {
  const { vehicle_id, location_lat, location_lng, description, mechanic_id } = req.body;
  if (!vehicle_id) {
    return res.status(400).json({ success: false, message: "Missing vehicle selection for recovery" });
  }

  const data = readDb();
  const newRequest: ServiceRequest = {
    id: data.service_requests.length > 0 ? Math.max(...data.service_requests.map((r: ServiceRequest) => r.id)) + 1 : 1,
    vehicle_id: parseInt(vehicle_id),
    user_id: req.user.id,
    request_type: "recovery",
    description: description || "",
    status: mechanic_id ? "assigned" : "pending",
    created_at: new Date().toISOString(),
    location_lat: parseFloat(location_lat) || 0.0,
    location_lng: parseFloat(location_lng) || 0.0
  };

  if (mechanic_id) {
    newRequest.mechanic_id = parseInt(mechanic_id);
  }

  data.service_requests.push(newRequest);
  writeDb(data);
  addAuditLog(req.user.id, "recovery_request_created", "ServiceRequest", newRequest.id, `Roadside recovery request submitted: ${newRequest.description.substring(0, 40)}${newRequest.description.length > 40 ? '...' : ''}.`);

  res.status(201).json({
    success: true,
    message: "Recovery request submitted successfully!",
    data: newRequest
  });
});

// Service Requests: Get My Service Requests (Excluding Recovery)
router.get("/service_requests/my_requests", authMiddleware, (req: any, res) => {
  const data = readDb();
  const requests = data.service_requests.filter(
    (r: ServiceRequest) => r.user_id === req.user.id && r.request_type !== "recovery"
  );

  res.json({
    success: true,
    data: requests
  });
});

// Service Requests: Get My Recovery Requests
router.get("/service_requests/my_recoveries", authMiddleware, (req: any, res) => {
  const data = readDb();
  const requests = data.service_requests.filter(
    (r: ServiceRequest) => r.user_id === req.user.id && r.request_type === "recovery"
  );

  res.json({
    success: true,
    data: requests
  });
});

// Service Requests: Delete a Service Request by Id (Vehicle Owner)
router.delete("/service_requests/:id", authMiddleware, (req: any, res) => {
  const reqId = parseInt(req.params.id);
  if (isNaN(reqId)) {
    return res.status(400).json({ success: false, message: "Invalid request ID" });
  }

  const data = readDb();
  if (!data.service_requests) {
    data.service_requests = [];
  }

  const reqIndex = data.service_requests.findIndex(
    (r: any) => r.id === reqId && r.user_id === req.user.id
  );

  if (reqIndex === -1) {
    return res.status(404).json({ success: false, message: "Service request not found or unauthorized access" });
  }

  const deletedRequest = data.service_requests[reqIndex];
  data.service_requests.splice(reqIndex, 1);

  // Clean up any associated invoices if they exist
  if (data.invoices) {
    data.invoices = data.invoices.filter((inv: any) => inv.service_id !== reqId);
  }

  writeDb(data);
  addAuditLog(
    req.user.id,
    "request_deleted",
    "ServiceRequest",
    reqId,
    `Service request #${reqId} of type '${deletedRequest.request_type}' was deleted by user.`
  );

  res.json({
    success: true,
    message: "Request has been deleted successfully"
  });
});

// Service Requests: Clear All Service Requests for Current User
router.post("/service_requests/clear_all", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.service_requests) {
    data.service_requests = [];
  }

  const initialCount = data.service_requests.length;
  // Keep requests that do NOT belong to the active user
  data.service_requests = data.service_requests.filter((r: any) => r.user_id !== req.user.id);
  const clearedCount = initialCount - data.service_requests.length;

  // Clean up associated invoices
  if (data.invoices) {
    data.invoices = data.invoices.filter((inv: any) => {
      // Find if invoice is associated with a deleted request
      const wasDeletedUserRequest = !data.service_requests.some((r: any) => r.id === inv.service_id) && inv.user_id === req.user.id;
      return !wasDeletedUserRequest;
    });
  }

  writeDb(data);
  addAuditLog(
    req.user.id,
    "requests_cleared_all",
    "User",
    req.user.id,
    `User purged all active and historic service requests (${clearedCount} requests).`
  );

  res.json({
    success: true,
    message: `All service requests (${clearedCount} requests) cleared successfully.`
  });
});

// Uploads: Upload attachment
router.post("/uploads", authMiddleware, upload.single("file"), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "File data is required" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    message: "Upload completed",
    data: { fileUrl }
  });
});

// Get eligible chat contacts with their last message
router.get("/messages/contacts", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.messages) {
    data.messages = [];
  }

  const currentUserId = req.user.id;
  const currentUserRole = (req.user.role || "").toUpperCase();

  let targetContacts = [];
  const vehicleOwners = data.vehicle_owners_db || [];
  const mechanics = data.mechanics_db || [];

  if (currentUserRole === "VEHICLE_OWNER" || currentUserRole === "USER" || currentUserRole === "OWNER") {
    // Show mechanics and admins
    targetContacts = data.users.filter((u: any) => 
      u.id !== currentUserId &&
      ((u.role || "").toUpperCase() === "MECHANIC" || (u.role || "").toUpperCase() === "ADMIN")
    );
  } else if (currentUserRole === "MECHANIC") {
    // Show owners, other users, and admins
    targetContacts = data.users.filter((u: any) => 
      u.id !== currentUserId &&
      ((u.role || "").toUpperCase() === "VEHICLE_OWNER" || (u.role || "").toUpperCase() === "USER" || (u.role || "").toUpperCase() === "OWNER" || (u.role || "").toUpperCase() === "ADMIN")
    );
  } else if (currentUserRole === "ADMIN") {
    // Admin can chat with any user
    targetContacts = data.users.filter((u: any) => u.id !== currentUserId);
  } else {
    targetContacts = data.users.filter((u: any) => u.id !== currentUserId);
  }

  const contactsWithLastMessage = targetContacts.map((user: any) => {
    const userMsgs = data.messages.filter(
      (m: Message) =>
        (m.sender_id === currentUserId && m.receiver_id === user.id) ||
        (m.sender_id === user.id && m.receiver_id === currentUserId)
    );

    userMsgs.sort((a: Message, b: Message) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastMessage = userMsgs.length > 0 ? userMsgs[0] : null;

    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      last_message: lastMessage
    };
  });

  res.json({
    success: true,
    data: contactsWithLastMessage
  });
});

// Get chat messages with a specific contact
router.get("/messages", authMiddleware, (req: any, res) => {
  const contactId = parseInt(req.query.contact_id as string);
  if (isNaN(contactId)) {
    return res.status(400).json({ success: false, message: "Invalid or missing contact_id query parameter" });
  }

  const data = readDb();
  if (!data.messages) {
    data.messages = [];
  }

  const currentUserId = req.user.id;
  const chatMessages = data.messages.filter(
    (m: Message) =>
      (m.sender_id === currentUserId && m.receiver_id === contactId) ||
      (m.sender_id === contactId && m.receiver_id === currentUserId)
  );

  chatMessages.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  res.json({
    success: true,
    data: chatMessages
  });
});

// Send a message
router.post("/messages", authMiddleware, (req: any, res) => {
  const { receiver_id, content } = req.body;
  if (!receiver_id || !content || content.trim() === "") {
    return res.status(400).json({ success: false, message: "receiver_id and non-empty content are required" });
  }

  const data = readDb();
  if (!data.messages) {
    data.messages = [];
  }

  const currentUserId = req.user.id;
  const receiverIdParsed = parseInt(receiver_id);

  const receiverExists = data.users.some((u: any) => u.id === receiverIdParsed);
  if (!receiverExists) {
    return res.status(404).json({ success: false, message: "Receiver not found" });
  }

  const newMessage: Message = {
    id: data.messages.length > 0 ? Math.max(...data.messages.map((m: Message) => m.id)) + 1 : 1,
    sender_id: currentUserId,
    receiver_id: receiverIdParsed,
    content: content.trim(),
    created_at: new Date().toISOString()
  };

  data.messages.push(newMessage);
  writeDb(data);

  res.status(201).json({
    success: true,
    message: "Message sent",
    data: newMessage
  });
});

// Mechanic dashboard statistics and priority tasks
router.get("/v1/mechanic/dashboard", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const data = readDb();
  const reqs = data.service_requests || [];
  
  // Filter for requests assigned to this mechanic (using both mechanic.id and user_id to map correctly)
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const isMyId = (mechanicId: any) => {
    if (!mechanicId) return false;
    return mechanicId === req.user.id || (mechanicRecord && mechanicId === mechanicRecord.id);
  };

  const myReqs = reqs.filter((r: any) => isMyId(r.mechanic_id));
  
  const activeJobsCount = myReqs.filter((r: any) => r.status && r.status !== "completed").length;
  const pendingRecoveryCount = myReqs.filter((r: any) => r.request_type === "recovery" && r.status !== "completed").length;
  const completedJobsCount = myReqs.filter((r: any) => r.status === "completed").length;

  // Calculate total earnings from completed jobs or linked invoices
  const completedJobIds = myReqs.filter((r: any) => r.status === "completed").map((r: any) => r.id);
  const invoiceEarnings = (data.invoices || [])
    .filter((inv: any) => completedJobIds.includes(inv.service_id))
    .reduce((sum: number, inv: any) => sum + (Number(inv.amount) || 0), 0);
  const directRequestEarnings = myReqs
    .filter((r: any) => r.status === "completed")
    .reduce((sum: number, r: any) => sum + (Number(r.final_cost) || 0), 0);
  
  // Choose whichever has non-zero values, default to standard workshop completion rate of 2500 per completed job if both are 0
  const totalRevenue = Math.max(invoiceEarnings, directRequestEarnings) || (completedJobsCount * 2500);

  // Hydrate priority jobs
  const priorityJobs = myReqs
    .map((r: any) => {
      const v = (data.vehicles || []).find((v: any) => v.id === r.vehicle_id);
      const u = (data.users || []).find((user: any) => user.id === r.user_id);
      return {
        id: r.id,
        request_type: r.request_type,
        description: r.description,
        status: r.status,
        created_at: r.created_at,
        location_lat: r.location_lat,
        location_lng: r.location_lng,
        vehicle: v ? {
          make: v.make,
          model: v.model,
          year: v.year,
          license_plate: v.license_plate || v.registration_number,
          color: v.color
        } : null,
        client: u ? {
          full_name: u.full_name,
          phone_number: u.phone_number,
          email: u.email
        } : null
      };
    })
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    success: true,
    data: {
      stats: {
        activeJobs: activeJobsCount,
        pendingRecovery: pendingRecoveryCount,
        completed: completedJobsCount,
        revenue: totalRevenue
      },
      priorityJobs
    }
  });
});

// Retrieve list of all jobs assigned to mechanic
router.get("/v1/mechanic/jobs", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const data = readDb();
  const reqs = data.service_requests || [];
  
  // Filter assigned jobs (using both mechanic.id and user_id to map correctly)
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const isMyId = (mechanicId: any) => {
    if (!mechanicId) return false;
    return mechanicId === req.user.id || (mechanicRecord && mechanicId === mechanicRecord.id);
  };

  const myReqs = reqs.filter((r: any) => isMyId(r.mechanic_id));
  
  const jobs = myReqs.map((r: any) => {
    const v = (data.vehicles || []).find((v: any) => v.id === r.vehicle_id);
    const u = (data.users || []).find((user: any) => user.id === r.user_id);
    return {
      id: r.id,
      request_type: r.request_type,
      description: r.description,
      status: r.status,
      created_at: r.created_at,
      location_lat: r.location_lat,
      location_lng: r.location_lng,
      vehicle: v ? {
        make: v.make,
        model: v.model,
        year: v.year,
        license_plate: v.license_plate || v.registration_number,
        color: v.color
      } : { make: "Unknown", model: "Vehicle", license_plate: "N/A" },
      client: u ? {
        full_name: u.full_name,
        phone_number: u.phone_number,
        email: u.email
      } : { full_name: "Customer", phone_number: "N/A" }
    };
  });

  res.json({
    success: true,
    data: jobs
  });
});

// Update the status of a specific job (Assigned -> Accepted -> In Progress -> Completed)
router.put("/v1/mechanic/jobs/:id/status", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const { status, progress_percent, current_stage, estimated_completion, status_notes } = req.body;
  if (!status) {
    return res.status(400).json({ success: false, message: "Missing parameter: status" });
  }

  const jobId = parseInt(req.params.id);
  const data = readDb();
  
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const isMyId = (mechanicId: any) => {
    if (!mechanicId) return false;
    return mechanicId === req.user.id || (mechanicRecord && mechanicId === mechanicRecord.id);
  };

  const job = (data.service_requests || []).find((r: any) => r.id === jobId && isMyId(r.mechanic_id));
  if (!job) {
    return res.status(404).json({ success: false, message: "Assigned service request not found" });
  }

  const oldStatus = job.status;
  
  // Enforce status flow structure: Assigned -> Accepted -> In Progress -> Completed
  const validStatuses = ["assigned", "accepted", "in_progress", "completed", "pending", "on_the_way", "arrived"];
  if (!validStatuses.includes(status.toLowerCase())) {
    return res.status(400).json({ success: false, message: `Invalid status target: ${status}` });
  }

  const targetStatus = status.toLowerCase();

  // Prevent starting work unless upfront invoice is paid
  if (["in_progress", "on_the_way", "arrived"].includes(targetStatus)) {
    const hasUnpaidInvoice = (data.invoices || []).some((inv: any) => inv.service_id === jobId && inv.status === "pending");
    if (hasUnpaidInvoice) {
      return res.status(400).json({ 
        success: false, 
        message: "Payment of the upfront invoice is required before starting work. Please ask the client to complete their payment." 
      });
    }
  }

  job.status = targetStatus;

  if (progress_percent !== undefined) {
    job.progress_percent = parseInt(progress_percent);
  } else if (targetStatus === "completed") {
    job.progress_percent = 100;
  } else if (targetStatus === "accepted") {
    job.progress_percent = 10;
  } else if (targetStatus === "on_the_way") {
    job.progress_percent = 25;
  } else if (targetStatus === "arrived") {
    job.progress_percent = 40;
  } else if (targetStatus === "in_progress") {
    job.progress_percent = Math.max(job.progress_percent || 0, 50);
  }

  if (current_stage !== undefined) {
    job.current_stage = current_stage;
  } else if (targetStatus === "completed") {
    job.current_stage = "Ready for Pick-up";
  } else if (targetStatus === "accepted") {
    job.current_stage = "Job Accepted & Queued";
  } else if (targetStatus === "on_the_way") {
    job.current_stage = "Mechanic En Route";
  } else if (targetStatus === "arrived") {
    job.current_stage = "Arrived on Scene / Diagnostic Stage";
  } else if (targetStatus === "in_progress") {
    job.current_stage = "Active Service Repair Stage";
  }

  if (estimated_completion !== undefined) {
    job.estimated_completion = estimated_completion;
  }

  if (!job.status_history) {
    job.status_history = [];
  }

  job.status_history.push({
    status: targetStatus,
    stage: job.current_stage || targetStatus,
    progress: job.progress_percent || 0,
    estimated_completion: job.estimated_completion || "",
    notes: status_notes || `Status transitioned to ${targetStatus}.`,
    timestamp: new Date().toISOString()
  });

  // If the job is accepted, generate an upfront payment invoice
  if (targetStatus === "accepted") {
    if (!data.invoices) data.invoices = [];
    const hasInvoice = data.invoices.some((inv: any) => inv.service_id === jobId);
    if (!hasInvoice) {
      const newInvoiceId = data.invoices.length > 0 ? Math.max(...data.invoices.map((i: any) => i.id)) + 1 : 1;
      let amount = 1500;
      if (job.description) {
        const priceMatch = job.description.match(/Price:\s*(?:Rs\.\s*)?(\d+)/i);
        if (priceMatch && priceMatch[1]) {
          amount = parseInt(priceMatch[1]);
        } else {
          const genericMatch = job.description.match(/(?:Rs\.|[\$\xA3\u20AC])\s*(\d+)/i);
          if (genericMatch && genericMatch[1]) {
            amount = parseInt(genericMatch[1]);
          }
        }
      }
      data.invoices.push({
        id: newInvoiceId,
        user_id: job.user_id,
        vehicle_id: job.vehicle_id,
        service_id: job.id,
        amount: amount,
        status: "pending",
        description: `Upfront payment invoice for accepted Service Request #${job.id}: ${job.description || job.request_type}`,
        created_at: new Date().toISOString()
      });
    }
  }
  
  // If the job is completed, generate a basic default invoice if a finalized one doesn't exist
  if (targetStatus === "completed") {
    const hasInvoice = (data.invoices || []).some((inv: any) => inv.service_id === jobId);
    if (!hasInvoice) {
      if (!data.invoices) data.invoices = [];
      const newInvoiceId = data.invoices.length > 0 ? Math.max(...data.invoices.map((i: any) => i.id)) + 1 : 1;
      
      data.invoices.push({
        id: newInvoiceId,
        user_id: job.user_id,
        vehicle_id: job.vehicle_id,
        service_id: job.id,
        amount: Number(job.final_cost) || 2500,
        status: "pending",
        description: `Professional AutoCare work completed for request #${job.id}: ${job.description || job.request_type}`,
        created_at: new Date().toISOString()
      });
    }
  }

  writeDb(data);
  addAuditLog(req.user.id, "job_status_updated", "ServiceRequest", jobId, `Job #${jobId} status updated from ${oldStatus} to ${status}.`);

  res.json({
    success: true,
    message: "Job status updated successfully",
    data: job
  });
});

// Complete Job and save details to ServiceHistory, PartsUsed, and Uploads
router.post("/v1/mechanic/jobs/:id/complete", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const jobId = parseInt(req.params.id);
  const { final_description, work_performed, parts_used, completion_images } = req.body;

  const data = readDb();
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const isMyId = (mechanicId: any) => {
    if (!mechanicId) return false;
    return mechanicId === req.user.id || (mechanicRecord && mechanicId === mechanicRecord.id);
  };

  const job = (data.service_requests || []).find((r: any) => r.id === jobId && isMyId(r.mechanic_id));
  if (!job) {
    return res.status(404).json({ success: false, message: "Assigned service request not found" });
  }

  // Update request status to completed
  job.status = "completed";
  job.progress_percent = 100;
  job.current_stage = "Service Completed";

  if (!job.status_history) {
    job.status_history = [];
  }
  job.status_history.push({
    status: "completed",
    stage: "Service Completed",
    progress: 100,
    estimated_completion: "",
    notes: work_performed || "Service finalized and approved by mechanic.",
    timestamp: new Date().toISOString()
  });
  
  // Total cost calculation: Parts used total + 1500 (Standard professional service flat rate)
  let calculatedCost = 0;
  if (parts_used && Array.isArray(parts_used)) {
    parts_used.forEach((pt: any) => {
      calculatedCost += (Number(pt.quantity) * Number(pt.price_per_part)) || 0;
    });
  }
  const laborCharges = 1500; 
  const totalCalculatedCost = calculatedCost + laborCharges;
  job.final_cost = totalCalculatedCost;

  // 1. Save into service_history
  if (!data.service_history) data.service_history = [];
  const nextHistoryId = data.service_history.length > 0 ? Math.max(...data.service_history.map((h: any) => h.id)) + 1 : 1;
  const historyEntry = {
    id: nextHistoryId,
    service_request_id: jobId,
    mechanic_id: mechanicRecord ? mechanicRecord.id : req.user.id,
    work_performed: work_performed || "Routine Technical Maintenance",
    final_description: final_description || job.description || "Completed successfully",
    final_cost: totalCalculatedCost,
    completed_at: new Date().toISOString()
  };
  data.service_history.push(historyEntry);

  // 2. Save into parts_used
  if (parts_used && Array.isArray(parts_used)) {
    if (!data.parts_used) data.parts_used = [];
    parts_used.forEach((pt: any) => {
      const nextPartId = data.parts_used.length > 0 ? Math.max(...data.parts_used.map((p: any) => p.id)) + 1 : 1;
      data.parts_used.push({
        id: nextPartId,
        service_request_id: jobId,
        part_name: pt.part_name,
        quantity: Number(pt.quantity),
        price_per_part: Number(pt.price_per_part),
        total_cost: Number(pt.quantity) * Number(pt.price_per_part),
        created_at: new Date().toISOString()
      });
    });
  }

  // 3. Save into uploads table (Completion photos)
  if (completion_images && Array.isArray(completion_images)) {
    if (!data.uploads) data.uploads = [];
    completion_images.forEach((imgUrl: string) => {
      const nextUploadId = data.uploads.length > 0 ? Math.max(...data.uploads.map((u: any) => u.id)) + 1 : 1;
      data.uploads.push({
        id: nextUploadId,
        service_request_id: jobId,
        url: imgUrl,
        uploaded_at: new Date().toISOString()
      });
    });
  }

  // 4. Update or generate invoice with finalized dynamic service costs
  if (!data.invoices) data.invoices = [];
  const existingInvoiceIdx = data.invoices.findIndex((inv: any) => inv.service_id === jobId);
  if (existingInvoiceIdx !== -1) {
    data.invoices[existingInvoiceIdx].amount = totalCalculatedCost;
    data.invoices[existingInvoiceIdx].description = `Final settlement for Request #${job.id}: ${work_performed || "Service Complete"}. Includes Parts + Labor.`;
  } else {
    const newInvoiceId = data.invoices.length > 0 ? Math.max(...data.invoices.map((i: any) => i.id)) + 1 : 1;
    data.invoices.push({
      id: newInvoiceId,
      user_id: job.user_id,
      vehicle_id: job.vehicle_id,
      service_id: job.id,
      amount: totalCalculatedCost,
      status: "pending",
      description: `Final settlement for Request #${job.id}: ${work_performed || "Service Complete"}. Includes Parts + Labor.`,
      created_at: new Date().toISOString()
    });
  }

  writeDb(data);
  addAuditLog(req.user.id, "job_completed_form", "ServiceRequest", jobId, `Job #${jobId} finalized by mechanic. Saved service history and billing invoice successfully.`);

  res.json({
    success: true,
    message: "Completion records successfully saved to persistent database registries.",
    data: job
  });
});

// GIG MANAGEMENT: Create service gig
router.post("/v1/mechanic/gigs", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const { title, description, category, experience, price_range, availability } = req.body;
  if (!title || !description || !category) {
    return res.status(400).json({ success: false, message: "Missing required gig attributes: title, description, category" });
  }

  const data = readDb();
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const mechId = mechanicRecord ? mechanicRecord.id : req.user.id;

  if (!data.gigs) data.gigs = [];
  const nextGigId = data.gigs.length > 0 ? Math.max(...data.gigs.map((g: any) => g.id)) + 1 : 1;

  const newGig = {
    id: nextGigId,
    mechanic_id: mechId,
    mechanic_name: mechanicRecord ? mechanicRecord.full_name : "Professional Mechanic",
    email: req.user.email,
    title,
    description,
    category,
    experience: experience || (mechanicRecord ? `${mechanicRecord.experience_years} Years` : "5 Years"),
    price_range: price_range || "Rs. 1500 - 5000",
    availability: availability || "Available",
    created_at: new Date().toISOString()
  };

  data.gigs.push(newGig);
  writeDb(data);

  addAuditLog(req.user.id, "gig_created", "Gig", nextGigId, `Mechanic created service gig profile: ${title}`);

  res.status(201).json({ success: true, message: "Service gig created successfully", data: newGig });
});

// GIG MANAGEMENT: Get active logged in mechanic's own gigs
router.get("/v1/mechanic/gigs", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const data = readDb();
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const mechId = mechanicRecord ? mechanicRecord.id : req.user.id;

  const myGigs = (data.gigs || []).filter((g: any) => g.mechanic_id === mechId);
  res.json({ success: true, data: myGigs });
});

// GIG MANAGEMENT: Edit owned service gig
router.put("/v1/mechanic/gigs/:id", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const gigId = parseInt(req.params.id);
  const { title, description, category, experience, price_range, availability } = req.body;

  const data = readDb();
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const mechId = mechanicRecord ? mechanicRecord.id : req.user.id;

  const gig = (data.gigs || []).find((g: any) => g.id === gigId && g.mechanic_id === mechId);
  if (!gig) {
    return res.status(404).json({ success: false, message: "Service gig not found or unauthorized to modify." });
  }

  gig.title = title || gig.title;
  gig.description = description || gig.description;
  gig.category = category || gig.category;
  gig.experience = experience || gig.experience;
  gig.price_range = price_range || gig.price_range;
  gig.availability = availability || gig.availability;

  writeDb(data);
  res.json({ success: true, message: "Service gig edited securely and saved successfully.", data: gig });
});

// GIG MANAGEMENT: Delete owned service gig
router.delete("/v1/mechanic/gigs/:id", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const gigId = parseInt(req.params.id);
  const data = readDb();
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  const mechId = mechanicRecord ? mechanicRecord.id : req.user.id;

  const initialLength = (data.gigs || []).length;
  data.gigs = (data.gigs || []).filter((g: any) => !(g.id === gigId && g.mechanic_id === mechId));

  if (data.gigs.length === initialLength) {
    return res.status(404).json({ success: false, message: "Service gig not found or unauthorized to erase." });
  }

  writeDb(data);
  res.json({ success: true, message: "Service gig erased from database successfully." });
});

// PUBLIC GIG LISTINGS: View all active mechanic service listings
router.get("/v1/gigs", authMiddleware, (req: any, res) => {
  const data = readDb();
  const enrichedGigs = (data.gigs || []).map((gig: any) => {
    const mech = (data.mechanics || []).find((m: any) => m.id === gig.mechanic_id);
    return {
      ...gig,
      mechanic_user_id: mech ? mech.user_id : gig.mechanic_id
    };
  });
  res.json({ success: true, data: enrichedGigs });
});

// NEW: GET unassigned / available requests for mechanics to claim
router.get("/v1/mechanic/available_requests", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const data = readDb();
  const reqs = data.service_requests || [];
  
  // Find requests that do not have any mechanic assigned yet, and are still pending
  const available = reqs.filter((r: any) => !r.mechanic_id && (r.status === "pending" || !r.status));

  const hydrated = available.map((r: any) => {
    const v = (data.vehicles || []).find((v: any) => v.id === r.vehicle_id);
    const u = (data.users || []).find((user: any) => user.id === r.user_id);
    return {
      id: r.id,
      request_type: r.request_type,
      description: r.description,
      status: r.status || "pending",
      created_at: r.created_at,
      location_lat: r.location_lat,
      location_lng: r.location_lng,
      vehicle: v ? {
        make: v.make,
        model: v.model,
        year: v.year,
        license_plate: v.license_plate || v.registration_number,
        color: v.color
      } : { make: "Unknown", model: "Vehicle" },
      client: u ? {
        full_name: u.full_name,
        phone_number: u.phone_number,
        email: u.email
      } : { full_name: "Customer" }
    };
  });

  res.json({
    success: true,
    data: hydrated
  });
});

// NEW: POST claim an unassigned request
router.post("/v1/mechanic/jobs/:id/claim", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "MECHANIC") {
    return res.status(403).json({ success: false, message: "Access Denied: Mechanic profile required" });
  }

  const jobId = parseInt(req.params.id);
  const data = readDb();
  
  const job = (data.service_requests || []).find((r: any) => r.id === jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: "Service request not found" });
  }

  if (job.mechanic_id) {
    return res.status(400).json({ success: false, message: "This service request has already been assigned or claimed" });
  }

  // Find mechanic reference
  const mechanicRecord = (data.mechanics || []).find((m: any) => m.user_id === req.user.id);
  // We can set mechanic_id to either the numeric ID of the mechanic in mechanics table, or user's ID.
  // In v1/mechanic/dashboard, mechanic_id search is:
  // "const isMyId = (mechanicId: any) => mechanicId === req.user.id || (mechanicRecord && mechanicId === mechanicRecord.id);"
  // Let's set it to mechanicRecord.id if exists, otherwise req.user.id.
  const mId = mechanicRecord ? mechanicRecord.id : req.user.id;

  job.mechanic_id = mId;
  job.status = "accepted"; // Claiming instantly ACCEPTS the job, so the mechanic can immediately proceed to do the work!

  // Generate upfront payment invoice for claimed request
  if (!data.invoices) data.invoices = [];
  const hasInvoice = data.invoices.some((inv: any) => inv.service_id === jobId);
  if (!hasInvoice) {
    const newInvoiceId = data.invoices.length > 0 ? Math.max(...data.invoices.map((i: any) => i.id)) + 1 : 1;
    let amount = 1500;
    if (job.description) {
      const priceMatch = job.description.match(/Price:\s*(?:Rs\.\s*)?(\d+)/i);
      if (priceMatch && priceMatch[1]) {
        amount = parseInt(priceMatch[1]);
      } else {
        const genericMatch = job.description.match(/(?:Rs\.|[\$\xA3\u20AC])\s*(\d+)/i);
        if (genericMatch && genericMatch[1]) {
          amount = parseInt(genericMatch[1]);
        }
      }
    }
    data.invoices.push({
      id: newInvoiceId,
      user_id: job.user_id,
      vehicle_id: job.vehicle_id,
      service_id: job.id,
      amount: amount,
      status: "pending",
      description: `Upfront payment invoice for accepted Service Request #${job.id}: ${job.description || job.request_type}`,
      created_at: new Date().toISOString()
    });
  }

  writeDb(data);
  addAuditLog(req.user.id, "job_claimed", "ServiceRequest", jobId, `Job #${jobId} was manually claimed & accepted by mechanic.`);

  res.json({
    success: true,
    message: "Service request successfully claimed!",
    data: job
  });
});

// NEW USER GIG ASSIGNMENT ENDPOINT
router.post("/v1/user/gigs/assign", authMiddleware, (req: any, res) => {
  const { gig_id, vehicle_id, description } = req.body;
  if (!gig_id || !vehicle_id) {
    return res.status(400).json({ success: false, message: "Missing required fields: gig_id, vehicle_id" });
  }

  const data = readDb();
  
  // Find the gig
  const gig = (data.gigs || []).find((g: any) => g.id === parseInt(gig_id));
  if (!gig) {
    return res.status(404).json({ success: false, message: "Gig not found" });
  }

  // Find mechanic reference (either from mechanics table or user)
  const mechRecord = (data.mechanics || []).find((m: any) => m.id === gig.mechanic_id || m.user_id === gig.mechanic_id);
  const mechId = mechRecord ? mechRecord.id : gig.mechanic_id;

  // Create new service request
  const nextReqId = data.service_requests.length > 0 ? Math.max(...data.service_requests.map((r: any) => r.id)) + 1 : 1;
  const newRequest = {
    id: nextReqId,
    vehicle_id: parseInt(vehicle_id),
    user_id: req.user.id,
    request_type: gig.category || "Gig Service",
    description: `Assigned via Gig "${gig.title}" (Price: ${gig.price_range}). User notes: ${description || "None."}`,
    status: "assigned", // Directly assign
    priority: "STANDARD",
    created_at: new Date().toISOString(),
    mechanic_id: mechId
  };

  data.service_requests.push(newRequest);
  writeDb(data);

  addAuditLog(req.user.id, "gig_assigned_to_mechanic", "ServiceRequest", nextReqId, `User assigned gig "${gig.title}" to mechanic ${gig.mechanic_name}.`);

  res.json({
    success: true,
    message: "Task assigned to mechanic successfully!",
    data: newRequest
  });
});

// NEW ENDPOINT: Get user basic info by ID
router.get("/v1/users/:id", authMiddleware, (req: any, res) => {
  const userId = parseInt(req.params.id);
  const data = readDb();
  const user = data.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  res.json({
    success: true,
    data: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role
    }
  });
});

// GET PRICE OFFERS BETWEEN CURRENT USER AND CONTACT OR ALL ACTIVE FOR USER
router.get("/v1/price_offers", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.price_offers) data.price_offers = [];
  
  const currentUserId = req.user.id;
  const contactId = req.query.contact_id ? parseInt(req.query.contact_id as string) : null;
  
  let offers = data.price_offers.filter((o: any) => o.sender_id === currentUserId || o.receiver_id === currentUserId);
  
  if (contactId) {
    offers = offers.filter((o: any) => o.sender_id === contactId || o.receiver_id === contactId);
  }
  
  res.json({ success: true, data: offers });
});

// CREATE A NEW PRICE OFFER (Vehicle Owner offers to Mechanic)
router.post("/v1/price_offers", authMiddleware, (req: any, res) => {
  const { receiver_id, amount, gig_title, gig_id } = req.body;
  if (!receiver_id || !amount) {
    return res.status(400).json({ success: false, message: "receiver_id and amount are required." });
  }

  const data = readDb();
  if (!data.price_offers) data.price_offers = [];
  if (!data.messages) data.messages = [];

  const currentUserId = req.user.id;
  const receiverIdParsed = parseInt(receiver_id);
  const offerAmount = parseFloat(amount);

  // Auto-decline any existing pending offers between these users to avoid clutter
  data.price_offers.forEach((o: any) => {
    if (
      o.status === "pending" &&
      ((o.sender_id === currentUserId && o.receiver_id === receiverIdParsed) ||
       (o.sender_id === receiverIdParsed && o.receiver_id === currentUserId))
    ) {
      o.status = "declined";
    }
  });

  const nextOfferId = data.price_offers.length > 0 ? Math.max(...data.price_offers.map((o: any) => o.id)) + 1 : 1;
  const newOffer = {
    id: nextOfferId,
    sender_id: currentUserId,
    receiver_id: receiverIdParsed,
    amount: offerAmount,
    status: "pending",
    gig_title: gig_title || "Custom Repair Job",
    gig_id: gig_id ? parseInt(gig_id) : null,
    created_at: new Date().toISOString()
  };

  data.price_offers.push(newOffer);

  // Send a system message indicating the offer
  const nextMsgId = data.messages.length > 0 ? Math.max(...data.messages.map((m: any) => m.id)) + 1 : 1;
  const systemMsg = {
    id: nextMsgId,
    sender_id: currentUserId,
    receiver_id: receiverIdParsed,
    content: `[SYSTEM OFFER] I proposed a price of Rs. ${offerAmount} for "${gig_title || 'Service'}"`,
    created_at: new Date().toISOString()
  };
  data.messages.push(systemMsg);

  writeDb(data);

  addAuditLog(currentUserId, "price_offer_created", "PriceOffer", nextOfferId, `User sent a price offer of Rs. ${offerAmount} to User #${receiverIdParsed}.`);

  res.status(201).json({ success: true, message: "Price offer sent successfully", data: newOffer });
});

// RESPOND TO A PRICE OFFER (Accept & Send Invoice / Decline)
router.post("/v1/price_offers/:id/respond", authMiddleware, (req: any, res) => {
  const offerId = parseInt(req.params.id);
  const { action, invoice_details, estimated_time, price } = req.body; // 'accept' or 'decline'
  if (!action || !["accept", "decline"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid action. Must be 'accept' or 'decline'." });
  }

  const data = readDb();
  if (!data.price_offers) data.price_offers = [];
  if (!data.messages) data.messages = [];
  if (!data.invoices) data.invoices = [];

  const offer = data.price_offers.find((o: any) => o.id === offerId);
  if (!offer) {
    return res.status(404).json({ success: false, message: "Price offer not found." });
  }

  // Verify receiver is current user
  if (offer.receiver_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "You are not authorized to respond to this offer." });
  }

  if (offer.status !== "pending") {
    return res.status(400).json({ success: false, message: `Offer is already ${offer.status}` });
  }

  offer.status = action === "accept" ? "accepted" : "declined";

  let systemMessageContent = "";
  if (action === "accept") {
    const finalPrice = price ? parseInt(price) : offer.amount;
    offer.amount = finalPrice;
    offer.invoice_details = invoice_details || "Standard mechanic services and inspection";
    offer.estimated_time = estimated_time || "1-2 hours";

    // Dynamically identify owner and mechanic users
    const userA = data.users.find((u: any) => u.id === offer.sender_id);
    const userB = data.users.find((u: any) => u.id === offer.receiver_id);
    const ownerUser = [userA, userB].find((u: any) => u && (u.role || "").toLowerCase() !== "mechanic");
    const mechanicUser = [userA, userB].find((u: any) => u && (u.role || "").toLowerCase() === "mechanic");
    const ownerId = ownerUser ? ownerUser.id : offer.sender_id;
    const mechanicId = mechanicUser ? mechanicUser.id : offer.receiver_id;

    // Auto generate a formal pending invoice for the owner's Payment Tab
    const newInvoiceId = data.invoices.length > 0 ? Math.max(...data.invoices.map((i: any) => i.id)) + 1 : 1;
    data.invoices.push({
      id: newInvoiceId,
      user_id: ownerId, // the vehicle owner receives the invoice
      service_id: null, // linked pre-service request
      price_offer_id: offer.id,
      amount: finalPrice,
      status: "pending",
      description: `Invoice from Mechanic for "${offer.gig_title}": ${offer.invoice_details} (Est. Time: ${offer.estimated_time})`,
      created_at: new Date().toISOString()
    });

    if (req.user.id === mechanicId) {
      systemMessageContent = `[SYSTEM OFFER ACCEPT] I have accepted your offer and sent a detailed invoice for Rs. ${finalPrice}!\n\n📋 **Invoice Details:** ${offer.invoice_details}\n⏱️ **Est. Completion Time:** ${offer.estimated_time}\n\n💳 Please go to your **Payments** section to settle this invoice and officially hire me!`;
    } else {
      systemMessageContent = `[SYSTEM OFFER ACCEPT] I have accepted your proposal of Rs. ${finalPrice}! Settle this invoice and let's get started on the job!`;
    }
  } else {
    systemMessageContent = `[SYSTEM OFFER DECLINE] I decline the price offer of Rs. ${offer.amount}.`;
  }

  // System message
  const nextMsgId = data.messages.length > 0 ? Math.max(...data.messages.map((m: any) => m.id)) + 1 : 1;
  const systemMsg = {
    id: nextMsgId,
    sender_id: req.user.id,
    receiver_id: req.user.id === offer.sender_id ? offer.receiver_id : offer.sender_id,
    content: systemMessageContent,
    created_at: new Date().toISOString()
  };
  data.messages.push(systemMsg);

  writeDb(data);

  addAuditLog(req.user.id, `price_offer_${action}ed`, "PriceOffer", offerId, `User ${action}ed price offer #${offerId}.`);

  res.json({ success: true, message: `Price offer successfully ${offer.status}.`, data: offer });
});

// SUBMIT A COUNTER OFFER (swaps sender and receiver, marks previous offer as declined/countered)
router.post("/v1/price_offers/:id/counter", authMiddleware, (req: any, res) => {
  const offerId = parseInt(req.params.id);
  const { counter_amount } = req.body;

  if (!counter_amount || isNaN(parseFloat(counter_amount))) {
    return res.status(400).json({ success: false, message: "Valid counter amount is required." });
  }

  const data = readDb();
  if (!data.price_offers) data.price_offers = [];
  if (!data.messages) data.messages = [];

  const offer = data.price_offers.find((o: any) => o.id === offerId);
  if (!offer) {
    return res.status(404).json({ success: false, message: "Price offer not found." });
  }

  // The caller must be the receiver of the offer to be able to counter it
  if (offer.receiver_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "You are not authorized to counter this offer." });
  }

  if (offer.status !== "pending") {
    return res.status(400).json({ success: false, message: "Only pending offers can be countered." });
  }

  const oldAmount = offer.amount;
  const newAmount = parseFloat(counter_amount);

  // Mark previous offer as countered
  offer.status = "declined";

  // Create a new offer with swapped sender and receiver
  const nextOfferId = data.price_offers.length > 0 ? Math.max(...data.price_offers.map((o: any) => o.id)) + 1 : 1;
  const counterOffer = {
    id: nextOfferId,
    sender_id: req.user.id, // now the counter offer sender
    receiver_id: offer.sender_id, // counter offer receiver
    amount: newAmount,
    status: "pending",
    gig_title: offer.gig_title || "Custom Repair Job",
    gig_id: offer.gig_id || null,
    created_at: new Date().toISOString()
  };

  data.price_offers.push(counterOffer);

  // Add system message to the chat
  const nextMsgId = data.messages.length > 0 ? Math.max(...data.messages.map((m: any) => m.id)) + 1 : 1;
  const systemMsg = {
    id: nextMsgId,
    sender_id: req.user.id,
    receiver_id: offer.sender_id,
    content: `[SYSTEM COUNTER OFFER] I proposed a counter-offer of Rs. ${newAmount} (original proposal was Rs. ${oldAmount}) for "${offer.gig_title || 'Service'}"`,
    created_at: new Date().toISOString()
  };
  data.messages.push(systemMsg);

  writeDb(data);

  addAuditLog(req.user.id, "price_offer_countered", "PriceOffer", nextOfferId, `User countered price offer #${offerId}: proposed Rs. ${newAmount} instead of Rs. ${oldAmount}.`);

  res.status(201).json({
    success: true,
    message: "Counter offer submitted successfully",
    data: counterOffer
  });
});

// HIRE A MECHANIC (Owner hires mechanic from an accepted price offer)
router.post("/v1/price_offers/:id/hire", authMiddleware, (req: any, res) => {
  const offerId = parseInt(req.params.id);

  const data = readDb();
  if (!data.price_offers) data.price_offers = [];
  if (!data.hired_mechanics) data.hired_mechanics = [];
  if (!data.messages) data.messages = [];

  const offer = data.price_offers.find((o: any) => o.id === offerId);
  if (!offer) {
    return res.status(404).json({ success: false, message: "Price offer not found." });
  }

  // Owner must be the sender
  if (offer.sender_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Only the offer sender can hire the expert." });
  }

  if (offer.status !== "accepted") {
    return res.status(400).json({ success: false, message: "You can only hire once the mechanic accepts the price offer." });
  }

  offer.status = "hired";

  // Get mechanic details
  const mechUser = data.users.find((u: any) => u.id === offer.receiver_id);
  const mechName = mechUser ? mechUser.full_name : "Expert Mechanic";

  const nextHireId = data.hired_mechanics.length > 0 ? Math.max(...data.hired_mechanics.map((h: any) => h.id)) + 1 : 1;
  const newHire = {
    id: nextHireId,
    user_id: req.user.id,
    mechanic_id: offer.receiver_id,
    mechanic_name: mechName,
    agreed_price: offer.amount,
    gig_title: offer.gig_title || "Custom Repair",
    gig_id: offer.gig_id,
    created_at: new Date().toISOString()
  };

  data.hired_mechanics.push(newHire);

  // Send system message
  const nextMsgId = data.messages.length > 0 ? Math.max(...data.messages.map((m: any) => m.id)) + 1 : 1;
  const systemMsg = {
    id: nextMsgId,
    sender_id: req.user.id,
    receiver_id: offer.receiver_id,
    content: `[SYSTEM HIRE] I have officially HIRED you for "${offer.gig_title}" at the agreed price of Rs. ${offer.amount}!`,
    created_at: new Date().toISOString()
  };
  data.messages.push(systemMsg);

  writeDb(data);

  addAuditLog(req.user.id, "mechanic_hired", "HiredMechanic", nextHireId, `Officially hired mechanic Zahid Ali / Tariq (User #${offer.receiver_id}) for ${offer.gig_title} at Rs. ${offer.amount}.`);

  res.json({ success: true, message: "Mechanic hired successfully!", data: newHire });
});

// GET ALL HIRED MECHANICS FOR CURRENT VEHICLE OWNER
router.get("/v1/hired_mechanics", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.hired_mechanics) data.hired_mechanics = [];
  
  const currentUserId = req.user.id;
  const myHired = data.hired_mechanics.filter((h: any) => h.user_id === currentUserId);
  
  res.json({ success: true, data: myHired });
});

// ADMIN ONLY: GET ALL SERVICE GIGS WITH MECHANIC NAMES
router.get("/v1/admin/gigs", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin profile required" });
  }

  const data = readDb();
  if (!data.gigs) data.gigs = [];
  
  const enriched = data.gigs.map((g: any) => {
    // Try to find user or mechanic record
    let mechanicName = "Unknown Mechanic";
    const mech = (data.mechanics || []).find((m: any) => m.id === g.mechanic_id);
    if (mech) {
      mechanicName = mech.name;
    } else {
      const u = (data.users || []).find((usr: any) => usr.id === g.mechanic_id);
      if (u) mechanicName = u.full_name;
    }
    return { ...g, mechanic_name: mechanicName };
  });

  res.json({ success: true, data: enriched });
});

// ADMIN ONLY: DELETE ANY GIG
router.delete("/v1/admin/gigs/:id", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin profile required" });
  }

  const gigId = parseInt(req.params.id);
  const data = readDb();
  if (!data.gigs) data.gigs = [];

  const initialLength = data.gigs.length;
  data.gigs = data.gigs.filter((g: any) => g.id !== gigId);

  if (data.gigs.length === initialLength) {
    return res.status(404).json({ success: false, message: "Gig not found" });
  }

  writeDb(data);
  addAuditLog(req.user.id, "admin_gig_deleted", "Gig", gigId, `Admin deleted service gig ID #${gigId}`);
  res.json({ success: true, message: "Gig deleted successfully by Administrator." });
});

// ADMIN ONLY: GET ALL PRICE NEGOTIATION OFFERS WITH NAMES
router.get("/v1/admin/price_offers", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin profile required" });
  }

  const data = readDb();
  if (!data.price_offers) data.price_offers = [];

  const enriched = data.price_offers.map((o: any) => {
    const sender = (data.users || []).find((u: any) => u.id === o.sender_id);
    const receiver = (data.users || []).find((u: any) => u.id === o.receiver_id);
    return {
      ...o,
      sender_name: sender ? sender.full_name : `User #${o.sender_id}`,
      receiver_name: receiver ? receiver.full_name : `User #${o.receiver_id}`
    };
  });

  res.json({ success: true, data: enriched });
});

// ADMIN ONLY: DELETE ANY PRICE OFFER
router.delete("/v1/admin/price_offers/:id", authMiddleware, (req: any, res) => {
  if ((req.user.role || "").toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin profile required" });
  }

  const offerId = parseInt(req.params.id);
  const data = readDb();
  if (!data.price_offers) data.price_offers = [];

  const initialLength = data.price_offers.length;
  data.price_offers = data.price_offers.filter((o: any) => o.id !== offerId);

  if (data.price_offers.length === initialLength) {
    return res.status(404).json({ success: false, message: "Price offer not found" });
  }

  writeDb(data);
  addAuditLog(req.user.id, "admin_offer_deleted", "PriceOffer", offerId, `Admin deleted price negotiation offer ID #${offerId}`);
  res.json({ success: true, message: "Price offer deleted successfully by Administrator." });
});

// MAP PLATFORM ENDPOINTS: Get All Map Location Pins
router.get("/v1/map_locations", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.map_locations || data.map_locations.length === 0) {
    data.map_locations = [
      {
        "id": 1,
        "type": "workshop",
        "name": "Lahore AutoCare Pro Center",
        "lat": 31.5204,
        "lng": 74.3587,
        "address": "72-B, Gulberg III, Ferozepur Road",
        "description": "Certified mechanic workshops and comprehensive service bay center."
      },
      {
        "id": 2,
        "type": "workshop",
        "name": "Islamabad Sector G-10 Workshop",
        "lat": 33.6844,
        "lng": 73.0479,
        "address": "Plot 19, Street 4, I-10 Industrial Area",
        "description": "High-tech engine diagnostic facility and electrical service hub."
      },
      {
        "id": 3,
        "type": "workshop",
        "name": "Karachi Clifton Flagship Hub",
        "lat": 24.8138,
        "lng": 67.0336,
        "address": "Block 4, Scheme 5, Clifton",
        "description": "Flagship 24/7 service station and emergency response dispatch unit."
      },
      {
        "id": 4,
        "type": "admin",
        "name": "Lahore Admin Headquarters",
        "lat": 31.5546,
        "lng": 74.3572,
        "address": "AutoCare Plaza, Mall Road, Lahore",
        "description": "Central administration office and service controller headquarters."
      },
      {
        "id": 5,
        "type": "admin",
        "name": "Karachi Operations Command",
        "lat": 24.8607,
        "lng": 67.0011,
        "address": "Tower House, I.I. Chundrigar Road, Karachi",
        "description": "Southern region dispatch control center and fleet coordination office."
      },
      {
        "id": 6,
        "type": "owner",
        "name": "Ahmed Khan (Home Location)",
        "lat": 31.5012,
        "lng": 74.3421,
        "address": "DHA Phase 5, Block J, Lahore",
        "description": "Registered vehicle owner profile base location."
      },
      {
        "id": 7,
        "type": "owner",
        "name": "Zahid Ali (Registered Base)",
        "lat": 33.6421,
        "lng": 73.0789,
        "address": "G-11/2, Street 35, Islamabad",
        "description": "Owner active vehicle base and garage location."
      }
    ];
    writeDb(data);
  }
  res.json({ success: true, data: data.map_locations });
});

// MAP PLATFORM ENDPOINTS: Register/Post New Map Location Pin
router.post("/v1/map_locations", authMiddleware, (req: any, res) => {
  const { type, name, lat, lng, address, description } = req.body;
  if (!type || !name || !lat || !lng) {
    return res.status(400).json({ success: false, message: "Type, Name, Latitude and Longitude are required." });
  }

  const data = readDb();
  if (!data.map_locations) {
    data.map_locations = [];
  }

  const newId = data.map_locations.length > 0 ? Math.max(...data.map_locations.map((m: any) => m.id)) + 1 : 1;
  const newLocation = {
    id: newId,
    type: type.toLowerCase(),
    name,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    address: address || "Custom Pin Address",
    description: description || "User-added location pin on map.",
    created_by: req.user.id,
    created_at: new Date().toISOString()
  };

  data.map_locations.push(newLocation);
  writeDb(data);

  addAuditLog(req.user.id, "map_location_added", "MapLocation", newId, `Added new ${type} location pin on map: ${name}`);

  res.status(201).json({ success: true, message: "New map pin registered successfully!", data: newLocation });
});

// FIVERR-STYLE NOTIFICATIONS: GET all notifications with dynamic seeder fallback
router.get("/v1/notifications", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.notifications) {
    data.notifications = [];
  }

  let userNotifications = data.notifications.filter((n: any) => n.user_id === req.user.id);

  if (userNotifications.length === 0) {
    const role = (req.user.role || "").toLowerCase();
    const mockNotifs = [];
    
    if (role === "admin") {
      mockNotifs.push(
        {
          id: 1001,
          user_id: req.user.id,
          title: "System Status Online",
          content: "AutoCare security protocols, DB transactions, and messaging queues are 100% operational.",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString()
        },
        {
          id: 1002,
          user_id: req.user.id,
          title: "Mechanic Registration Request",
          content: "A new mechanic applicant submitted credentials for account authorization.",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString()
        }
      );
    } else if (role === "mechanic") {
      mockNotifs.push(
        {
          id: 2001,
          user_id: req.user.id,
          title: "New Job Assignment",
          content: "You have been assigned to a scheduled maintenance request. Please review your job board.",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString()
        },
        {
          id: 2002,
          user_id: req.user.id,
          title: "Price Offer Countered",
          content: "An owner has proposed a counter-offer on your fixed price service card package.",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString()
        }
      );
    } else {
      mockNotifs.push(
        {
          id: 3001,
          user_id: req.user.id,
          title: "Welcome to AutoCare!",
          content: "Your account is active. Register your vehicles under 'My Vehicles' to book fast maintenance sessions.",
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString()
        }
      );
      
      const userVehicles = (data.vehicles || []).filter((v: any) => v.user_id === req.user.id);
      if (userVehicles.length > 0) {
        mockNotifs.push({
          id: 3002,
          user_id: req.user.id,
          title: "Vehicle Registered Successfully",
          content: `Your ${userVehicles[0].make} ${userVehicles[0].model} is configured. You can now book expert mechanic gigs.`,
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString()
        });
      }

      const userRequests = (data.service_requests || []).filter((r: any) => r.user_id === req.user.id);
      if (userRequests.length > 0) {
        mockNotifs.push({
          id: 3003,
          user_id: req.user.id,
          title: "Service Request Status Update",
          content: `Your request for ${userRequests[0].request_type} has been successfully registered on the secure network.`,
          read: false,
          created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString()
        });
      }
    }

    data.notifications.push(...mockNotifs);
    writeDb(data);
    userNotifications = data.notifications.filter((n: any) => n.user_id === req.user.id);
  }

  userNotifications.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json({ success: true, data: userNotifications });
});

// FIVERR-STYLE NOTIFICATIONS: Mark notification as read
router.post("/v1/notifications/:id/read", authMiddleware, (req: any, res) => {
  const notifId = parseInt(req.params.id);
  const data = readDb();
  if (data.notifications) {
    const notif = data.notifications.find((n: any) => n.id === notifId && n.user_id === req.user.id);
    if (notif) {
      notif.read = true;
      writeDb(data);
    }
  }
  res.json({ success: true });
});

// FIVERR-STYLE NOTIFICATIONS: Clear/Read All user notifications
router.post("/v1/notifications/clear", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (data.notifications) {
    data.notifications.forEach((n: any) => {
      if (n.user_id === req.user.id) {
        n.read = true;
      }
    });
    writeDb(data);
  }
  res.json({ success: true });
});

// Dynamic Admin Info endpoint
router.get("/v1/support/admin_info", authMiddleware, (req: any, res) => {
  const data = readDb();
  const adminUser = data.users.find((u: any) => (u.role || "").toUpperCase() === "ADMIN");
  if (adminUser) {
    res.json({ success: true, data: { id: adminUser.id, full_name: adminUser.full_name, role: "ADMIN" } });
  } else {
    res.json({ success: true, data: { id: 3, full_name: "System Administrator", role: "ADMIN" } });
  }
});

// GET mechanics for complaints
router.get("/v1/complaints/mechanics", authMiddleware, (req: any, res) => {
  const data = readDb();
  const mechanics = data.users.filter((u: any) => (u.role || "").toUpperCase() === "MECHANIC");
  res.json({
    success: true,
    data: mechanics.map((m: any) => ({ id: m.id, full_name: m.full_name, email: m.email }))
  });
});

// GET user service requests for complaints
router.get("/v1/complaints/requests", authMiddleware, (req: any, res) => {
  const data = readDb();
  const requests = (data.service_requests || []).filter((r: any) => r.user_id === req.user.id);
  res.json({
    success: true,
    data: requests.map((r: any) => ({ id: r.id, request_type: r.request_type, description: r.description }))
  });
});

// GET complaints list
router.get("/v1/complaints", authMiddleware, (req: any, res) => {
  const data = readDb();
  if (!data.complaints) data.complaints = [];
  const currentUserId = req.user.id;
  const role = (req.user.role || "").toUpperCase();

  let result = [];
  if (role === "ADMIN") {
    result = data.complaints.map((c: any) => {
      const customer = data.users.find((u: any) => u.id === c.user_id);
      const mechanic = data.users.find((u: any) => u.id === c.mechanic_id);
      return {
        ...c,
        customer_name: customer ? customer.full_name : `User #${c.user_id}`,
        user_name: customer ? customer.full_name : `User #${c.user_id}`,
        mechanic_name: mechanic ? mechanic.full_name : c.mechanic_id ? `Mechanic #${c.mechanic_id}` : "N/A"
      };
    });
  } else {
    result = data.complaints
      .filter((c: any) => c.user_id === currentUserId)
      .map((c: any) => {
        const mechanic = data.users.find((u: any) => u.id === c.mechanic_id);
        return {
          ...c,
          mechanic_name: mechanic ? mechanic.full_name : c.mechanic_id ? `Mechanic #${c.mechanic_id}` : "N/A"
        };
      });
  }

  // Sort complaints newest first
  result.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({ success: true, data: result });
});

// POST submit a complaint
router.post("/v1/complaints", authMiddleware, (req: any, res) => {
  const { mechanic_id, service_request_id, subject, description } = req.body;
  if (!subject || !description) {
    return res.status(400).json({ success: false, message: "Subject and description are required" });
  }

  const data = readDb();
  if (!data.complaints) data.complaints = [];

  const nextId = data.complaints.length > 0 ? Math.max(...data.complaints.map((c: any) => c.id)) + 1 : 1;
  const newComplaint = {
    id: nextId,
    user_id: req.user.id,
    mechanic_id: mechanic_id ? parseInt(mechanic_id) : null,
    service_request_id: service_request_id ? parseInt(service_request_id) : null,
    subject,
    description,
    status: "PENDING",
    admin_response: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  data.complaints.push(newComplaint);
  writeDb(data);

  // Notify Admin (add an audit log and mock notify)
  addAuditLog(req.user.id, "complaint_submitted", "Complaint", nextId, `User submitted complaint #${nextId} regarding: ${subject}`);

  if (!data.notifications) data.notifications = [];
  const adminUser = data.users.find((u: any) => (u.role || "").toUpperCase() === "ADMIN");
  if (adminUser) {
    const nextNotifId = data.notifications.length > 0 ? Math.max(...data.notifications.map((n: any) => n.id)) + 1 : 1;
    data.notifications.push({
      id: nextNotifId,
      user_id: adminUser.id,
      title: "New Complaint Submitted",
      content: `A user has filed a complaint regarding: "${subject}". Status: PENDING.`,
      read: false,
      created_at: new Date().toISOString()
    });
    writeDb(data);
  }

  res.status(201).json({ success: true, message: "Complaint submitted successfully", data: newComplaint });
});

// POST Admin responds to a complaint
router.post("/v1/complaints/:id/respond", authMiddleware, (req: any, res) => {
  const role = (req.user.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin profile required" });
  }

  const complaintId = parseInt(req.params.id);
  const { response, status } = req.body;
  if (!response || !status) {
    return res.status(400).json({ success: false, message: "Response content and status are required" });
  }

  const data = readDb();
  if (!data.complaints) data.complaints = [];

  const complaint = data.complaints.find((c: any) => c.id === complaintId);
  if (!complaint) {
    return res.status(404).json({ success: false, message: "Complaint not found" });
  }

  complaint.admin_response = response;
  complaint.status = status.toUpperCase();
  complaint.updated_at = new Date().toISOString();

  writeDb(data);

  addAuditLog(req.user.id, "complaint_resolved", "Complaint", complaintId, `Admin resolved/responded to complaint #${complaintId}`);

  // Send a notification back to the customer who submitted the complaint
  if (!data.notifications) data.notifications = [];
  const nextNotifId = data.notifications.length > 0 ? Math.max(...data.notifications.map((n: any) => n.id)) + 1 : 1;
  data.notifications.push({
    id: nextNotifId,
    user_id: complaint.user_id,
    title: `Complaint Update: ${complaint.status}`,
    content: `Admin responded: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`,
    read: false,
    created_at: new Date().toISOString()
  });
  writeDb(data);

  res.json({ success: true, message: "Complaint updated successfully", data: complaint });
});

// DELETE delete/withdraw a complaint
router.delete("/v1/complaints/:id", authMiddleware, (req: any, res) => {
  const complaintId = parseInt(req.params.id);
  const data = readDb();
  if (!data.complaints) data.complaints = [];

  const index = data.complaints.findIndex((c: any) => c.id === complaintId);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "Complaint not found" });
  }

  const complaint = data.complaints[index];
  const role = (req.user.role || "").toUpperCase();

  // Allow deleting if user is Admin or the owner of the complaint
  if (role !== "ADMIN" && complaint.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: "Unauthorized access to withdraw complaint" });
  }

  data.complaints.splice(index, 1);
  writeDb(data);

  addAuditLog(req.user.id, "complaint_withdrawn", "Complaint", complaintId, `Complaint #${complaintId} was deleted.`);

  res.json({ success: true, message: "Complaint withdrawn successfully" });
});

export default router;

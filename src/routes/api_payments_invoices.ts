import { Router } from "express";
import { readDb, writeDb, addAuditLog, authMiddleware } from "../db/db_helper.js";

const router = Router();

// Get all invoices (optionally filtered by logged in user)
router.get("/invoices", authMiddleware, (req: any, res) => {
  const data = readDb();
  const currentUserId = req.user.id;
  const currentUserRole = (req.user.role || "").toUpperCase();

  let userInvoices = [];
  if (currentUserRole === "ADMIN") {
    userInvoices = data.invoices || [];
  } else {
    userInvoices = (data.invoices || []).filter((inv: any) => inv.user_id === currentUserId);
  }

  res.json({
    success: true,
    data: userInvoices
  });
});

// Pay a pending invoice
router.post("/invoices/:id/pay", authMiddleware, (req: any, res) => {
  const invoiceId = parseInt(req.params.id);
  const { payment_method_id, payment_details } = req.body;
  const data = readDb();
  const currentUserId = req.user.id;

  const invoice = (data.invoices || []).find((inv: any) => inv.id === invoiceId);
  if (!invoice) {
    return res.status(404).json({ success: false, message: "Invoice not found" });
  }

  const userRole = (req.user.role || "").toUpperCase();
  if (invoice.user_id !== currentUserId && userRole !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Unauthorized to pay this invoice" });
  }

  if (invoice.status === "paid") {
    return res.status(400).json({ success: false, message: "Invoice is already paid" });
  }

  invoice.status = "paid";
  invoice.paid_at = new Date().toISOString();
  if (payment_method_id) {
    invoice.payment_method_id = parseInt(payment_method_id);
  } else if (payment_details) {
    invoice.paid_via = payment_details.type || "Cash";
    invoice.offline_reference = payment_details.reference || "N/A";
    invoice.offline_notes = payment_details.notes || "";
  }

  const request = (data.service_requests || []).find((r: any) => r.id === invoice.service_id);
  let statusMsg = "";
  if (request) {
    if (request.status === "accepted" || request.status === "assigned" || request.status === "pending") {
      request.status = "in_progress";
      statusMsg = `Service request #${invoice.service_id} is now In Progress (Paid Upfront).`;
    } else {
      request.status = "completed";
      statusMsg = `Service request #${invoice.service_id} has been marked as Completed.`;
    }
  }

  // Auto-hire mechanic if this is a custom price offer invoice
  if (invoice.price_offer_id) {
    if (!data.hired_mechanics) data.hired_mechanics = [];
    if (!data.messages) data.messages = [];
    
    const offer = (data.price_offers || []).find((o: any) => o.id === invoice.price_offer_id);
    if (offer && offer.status !== "hired") {
      offer.status = "hired";
      
      const mechUser = data.users.find((u: any) => u.id === offer.receiver_id);
      const mechName = mechUser ? mechUser.full_name : "Expert Mechanic";
      
      const nextHireId = data.hired_mechanics.length > 0 ? Math.max(...data.hired_mechanics.map((h: any) => h.id)) + 1 : 1;
      const newHire = {
        id: nextHireId,
        user_id: invoice.user_id,
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
        sender_id: invoice.user_id,
        receiver_id: offer.receiver_id,
        content: `[SYSTEM HIRE] I have officially HIRED you for "${offer.gig_title}" at the agreed price of Rs. ${offer.amount}!`,
        created_at: new Date().toISOString()
      };
      data.messages.push(systemMsg);
      addAuditLog(invoice.user_id, "mechanic_hired", "HiredMechanic", nextHireId, `Officially hired mechanic Zahid/Tariq (User #${offer.receiver_id}) for ${offer.gig_title} at Rs. ${offer.amount} via Invoice Payment.`);
    }
  }

  writeDb(data);
  addAuditLog(req.user.id, "payment_completed", "Invoice", invoice.id, `Payment of Rs. ${invoice.amount} completed for Invoice #${invoice.id}.`);
  if (request && statusMsg) {
    addAuditLog(req.user.id, "request_status_updated", "ServiceRequest", invoice.service_id, statusMsg);
  }

  res.json({
    success: true,
    message: "Payment successfully processed!",
    data: invoice
  });
});

// Renegotiate a pending price offer invoice
router.post("/invoices/:id/renegotiate", authMiddleware, (req: any, res) => {
  const invoiceId = parseInt(req.params.id);
  const { counter_amount, message } = req.body;

  if (!counter_amount || isNaN(parseInt(counter_amount))) {
    return res.status(400).json({ success: false, message: "Valid counter amount is required" });
  }

  const data = readDb();
  const currentUserId = req.user.id;

  const invoice = (data.invoices || []).find((inv: any) => inv.id === invoiceId);
  if (!invoice) {
    return res.status(404).json({ success: false, message: "Invoice not found" });
  }

  if (invoice.user_id !== currentUserId) {
    return res.status(403).json({ success: false, message: "Unauthorized to renegotiate this invoice" });
  }

  if (invoice.status !== "pending") {
    return res.status(400).json({ success: false, message: "Only pending invoices can be renegotiated" });
  }

  // Find associated price offer
  const offer = (data.price_offers || []).find((o: any) => o.id === invoice.price_offer_id);
  if (!offer) {
    return res.status(400).json({ success: false, message: "This invoice does not have an active negotiation channel to renegotiate" });
  }

  const oldAmount = invoice.amount;
  const newAmount = parseInt(counter_amount);

  // Mark the original price offer as declined/superseded
  offer.status = "declined";

  // Create a new price offer with the user as the sender and the mechanic as the receiver
  const nextOfferId = data.price_offers.length > 0 ? Math.max(...data.price_offers.map((o: any) => o.id)) + 1 : 1;
  const mechanicId = (offer.sender_id === currentUserId) ? offer.receiver_id : offer.sender_id;

  const counterOffer = {
    id: nextOfferId,
    sender_id: currentUserId,
    receiver_id: mechanicId,
    amount: newAmount,
    status: "pending",
    gig_title: offer.gig_title || "Custom Repair Job",
    gig_id: offer.gig_id || null,
    created_at: new Date().toISOString()
  };
  data.price_offers.push(counterOffer);

  // Mark the current invoice as cancelled so it doesn't show up in active payments list
  invoice.status = "cancelled";

  // Create a system message in the chat
  if (!data.messages) data.messages = [];
  const nextMsgId = data.messages.length > 0 ? Math.max(...data.messages.map((m: any) => m.id)) + 1 : 1;
  const systemMsg = {
    id: nextMsgId,
    sender_id: currentUserId,
    receiver_id: mechanicId,
    content: `[SYSTEM COUNTER OFFER] I would like to renegotiate the price. I proposed Rs. ${newAmount} instead of Rs. ${oldAmount}.\n\n💬 **Owner Note:** ${message || "Let's adjust the price for this job."}`,
    created_at: new Date().toISOString()
  };
  data.messages.push(systemMsg);

  writeDb(data);
  addAuditLog(currentUserId, "price_renegotiated", "Invoice", invoiceId, `Renegotiated invoice #${invoiceId}: Proposed counter-offer Rs. ${newAmount} (was Rs. ${oldAmount})`);

  res.json({
    success: true,
    message: "Renegotiation proposal sent to the mechanic successfully!",
    data: counterOffer
  });
});

// Get saved payment methods
router.get("/payment_methods", authMiddleware, (req: any, res) => {
  const data = readDb();
  const currentUserId = req.user.id;

  const userMethods = (data.payment_methods || []).filter((pm: any) => pm.user_id === currentUserId);

  res.json({
    success: true,
    data: userMethods
  });
});

// Add a new payment method
router.post("/payment_methods", authMiddleware, (req: any, res) => {
  const { type, title, account_number, is_default } = req.body;
  if (!type || !title || !account_number) {
    return res.status(400).json({ success: false, message: "Type, title, and account number are required fields" });
  }

  const data = readDb();
  const currentUserId = req.user.id;

  if (!data.payment_methods) {
    data.payment_methods = [];
  }

  const nextId = data.payment_methods.length > 0 
    ? Math.max(...data.payment_methods.map((pm: any) => pm.id)) + 1 
    : 1;

  const isDefaultBool = !!is_default;

  if (isDefaultBool) {
    data.payment_methods.forEach((pm: any) => {
      if (pm.user_id === currentUserId) {
        pm.is_default = false;
      }
    });
  }

  const newMethod = {
    id: nextId,
    user_id: currentUserId,
    type: type.toLowerCase(),
    title,
    account_number,
    is_default: isDefaultBool || (data.payment_methods.filter((pm: any) => pm.user_id === currentUserId).length === 0)
  };

  data.payment_methods.push(newMethod);
  writeDb(data);

  res.status(201).json({
    success: true,
    message: "Payment method added successfully!",
    data: newMethod
  });
});

// Set a payment method as default
router.post("/payment_methods/:id/default", authMiddleware, (req: any, res) => {
  const methodId = parseInt(req.params.id);
  const data = readDb();
  const currentUserId = req.user.id;

  const method = (data.payment_methods || []).find((pm: any) => pm.id === methodId && pm.user_id === currentUserId);
  if (!method) {
    return res.status(404).json({ success: false, message: "Payment method not found" });
  }

  data.payment_methods.forEach((pm: any) => {
    if (pm.user_id === currentUserId) {
      pm.is_default = (pm.id === methodId);
    }
  });

  writeDb(data);

  res.json({
    success: true,
    message: "Default payment method updated successfully!"
  });
});

// Delete a payment method
router.delete("/payment_methods/:id", authMiddleware, (req: any, res) => {
  const methodId = parseInt(req.params.id);
  const data = readDb();
  const currentUserId = req.user.id;

  const methodIndex = (data.payment_methods || []).findIndex((pm: any) => pm.id === methodId && pm.user_id === currentUserId);
  if (methodIndex === -1) {
    return res.status(404).json({ success: false, message: "Payment method not found" });
  }

  const wasDefault = data.payment_methods[methodIndex].is_default;
  data.payment_methods.splice(methodIndex, 1);

  if (wasDefault) {
    const remaining = data.payment_methods.filter((pm: any) => pm.user_id === currentUserId);
    if (remaining.length > 0) {
      remaining[0].is_default = true;
    }
  }

  writeDb(data);

  res.json({
    success: true,
    message: "Payment method removed successfully!"
  });
});

export default router;

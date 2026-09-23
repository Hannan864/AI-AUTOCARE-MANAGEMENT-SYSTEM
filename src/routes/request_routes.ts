import { Router } from "express";
import { RequestController } from "../controllers/request_controller.js";
import { authMiddleware } from "../db/db_helper.js";

const router = Router();
const controller = new RequestController();

// Admin auth middleware ensures only active and correct roles can progress, 
// let's create a strictly isolated admin guard or verify activeUser roles.
// Let's implement an admin-only middleware here to be extremely secure.
const adminOnly = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role.toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Restricted administrative zone access denied." });
  }
  next();
};

// Route structures mapped directly to clean specifications:
router.get("/requests/export", authMiddleware, adminOnly, controller.exportRequests.bind(controller));
router.get("/requests", authMiddleware, adminOnly, controller.getRequests.bind(controller));
router.get("/requests/:id", authMiddleware, adminOnly, controller.getRequestDetail.bind(controller));
router.post("/requests", authMiddleware, adminOnly, controller.createRequest.bind(controller));
router.put("/requests/:id", authMiddleware, adminOnly, controller.updateRequest.bind(controller));
router.delete("/requests/:id", authMiddleware, adminOnly, controller.deleteRequest.bind(controller));
router.patch("/requests/:id/status", authMiddleware, adminOnly, controller.updateStatus.bind(controller));
router.patch("/requests/:id/priority", authMiddleware, adminOnly, controller.updatePriority.bind(controller));
router.patch("/requests/:id/assign", authMiddleware, adminOnly, controller.assignMechanic.bind(controller));
router.patch("/requests/:id/reassign", authMiddleware, adminOnly, controller.reassignMechanic.bind(controller));
router.patch("/requests/:id/cancel", authMiddleware, adminOnly, (req: any, res: any) => {
  req.body.status = "CANCELLED";
  controller.updateStatus(req, res);
});
router.post("/requests/:id/notes", authMiddleware, adminOnly, controller.addAdminNote.bind(controller));

export default router;

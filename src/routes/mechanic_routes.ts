import { Router } from "express";
import { MechanicController } from "../controllers/mechanic_controller.js";
import { readDb, verifyToken } from "../db/db_helper.js";

const router = Router();
const mechanicController = new MechanicController();

// Direct Database Role and Status validation middleware - Never trust JWT role claims alone!
const adminAuthMiddleware = (req: any, res: any, next: any) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authorization token required" });
  }
  const token = header.substring(7);
  const userPayload = verifyToken(token);
  if (!userPayload) {
    return res.status(401).json({ success: false, message: "Invalid or expired authorization token" });
  }

  const db = readDb();
  const dbUser = db.users.find((u: any) => u.id === userPayload.id);
  if (!dbUser) {
    return res.status(403).json({ success: false, message: "Access Denied: User profile not registered" });
  }

  if (dbUser.role.toUpperCase() !== "ADMIN") {
    return res.status(403).json({ success: false, message: "Access Denied: Admin authorization required" });
  }

  if (dbUser.status.toUpperCase() !== "ACTIVE") {
    return res.status(403).json({ success: false, message: "Access Denied: User account is inactive/locked/suspended" });
  }

  req.user = dbUser;
  next();
};

// Route definitions matching the specifications
router.get("/mechanics/export", adminAuthMiddleware, mechanicController.exportMechanics);
router.get("/mechanics/performance", adminAuthMiddleware, mechanicController.getPerformance);
router.get("/mechanics/search", adminAuthMiddleware, mechanicController.searchMechanics);

router.get("/mechanics", adminAuthMiddleware, mechanicController.getMechanics);
router.post("/mechanics", adminAuthMiddleware, mechanicController.createMechanic);
router.delete("/mechanics/all", adminAuthMiddleware, mechanicController.deleteAllMechanics);
router.get("/mechanics/:id", adminAuthMiddleware, mechanicController.getMechanic);
router.put("/mechanics/:id", adminAuthMiddleware, mechanicController.updateMechanic);
router.delete("/mechanics/:id", adminAuthMiddleware, mechanicController.deleteMechanic);

router.patch("/mechanics/:id/status", adminAuthMiddleware, mechanicController.patchStatus);
router.patch("/mechanics/:id/availability", adminAuthMiddleware, mechanicController.patchAvailability);
router.post("/mechanics/:id/assign", adminAuthMiddleware, mechanicController.assignJob);

export default router;

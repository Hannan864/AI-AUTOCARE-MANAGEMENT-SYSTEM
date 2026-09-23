import { Router } from "express";
import { UserController } from "../controllers/user_controller.js";
import { readDb, verifyToken } from "../db/db_helper.js";

const router = Router();
const userController = new UserController();

// Database-validating Role and Token validation middleware
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

  // Validate ROLE against database directly - Never trust JWT claims alone!
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

  // Set verified DB user to request object
  req.user = dbUser;
  next();
};

// Route mapping
router.get("/users/export/csv", adminAuthMiddleware, userController.exportCsv);
router.get("/users/export/excel", adminAuthMiddleware, userController.exportExcel);
router.get("/users/search", adminAuthMiddleware, userController.getUsers); // alias of getUsers with custom filter support

router.get("/users", adminAuthMiddleware, userController.getUsers);
router.get("/users/:id", adminAuthMiddleware, userController.getUser);
router.post("/users", adminAuthMiddleware, userController.createUser);
router.put("/users/:id", adminAuthMiddleware, userController.updateUser);
router.delete("/users/:id", adminAuthMiddleware, userController.deleteUser);

router.patch("/users/:id/activate", adminAuthMiddleware, userController.activateUser);
router.patch("/users/:id/suspend", adminAuthMiddleware, userController.suspendUser);
router.patch("/users/:id/block", adminAuthMiddleware, userController.blockUser);
router.patch("/users/:id/unlock", adminAuthMiddleware, userController.unlockUser);
router.patch("/users/:id/reset-password", adminAuthMiddleware, userController.resetPassword);

export default router;

import { Router } from "express";
import { authMiddleware } from "../db/db_helper.js";
import { OwnerDashboardController } from "../controllers/owner_dashboard_controller.js";
import { VehicleController } from "../controllers/vehicle_controller.js";

const router = Router();
const dashboardController = new OwnerDashboardController();
const vehicleController = new VehicleController();

// Owner Dashboard Endpoint
router.get("/v1/owner/dashboard", authMiddleware, dashboardController.getDashboardData);

// Vehicle Endpoints (/api/v1/vehicles)
router.get("/v1/vehicles", authMiddleware, vehicleController.getVehicles);
router.post("/v1/vehicles", authMiddleware, vehicleController.createVehicle);
router.put("/v1/vehicles/:id", authMiddleware, vehicleController.updateVehicle);
router.delete("/v1/vehicles/:id", authMiddleware, vehicleController.deleteVehicle);

// Compatibility Fallback Endpoints (/api/vehicles)
router.get("/vehicles", authMiddleware, vehicleController.getVehicles);
router.post("/vehicles", authMiddleware, vehicleController.createVehicle);

export default router;

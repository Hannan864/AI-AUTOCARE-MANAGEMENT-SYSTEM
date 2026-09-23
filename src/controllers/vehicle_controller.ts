import { VehicleService } from "../services/vehicle_service.js";

export class VehicleController {
  private vehicleService: VehicleService;

  constructor() {
    this.vehicleService = new VehicleService();
  }

  getVehicles = (req: any, res: any) => {
    try {
      const vehicles = this.vehicleService.getUsersVehicles(req.user.id);
      res.json({
        success: true,
        message: "Vehicles retrieved",
        data: vehicles
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  getVehicle = (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const vehicle = this.vehicleService.getVehicleDetail(req.user.id, id);
      res.json({ success: true, data: vehicle });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  };

  createVehicle = (req: any, res: any) => {
    try {
      const vehicle = this.vehicleService.registerVehicle(req.user.id, req.body);
      res.status(201).json({
        success: true,
        message: "Vehicle added successfully",
        data: vehicle
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  updateVehicle = (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const vehicle = this.vehicleService.updateVehicle(req.user.id, id, req.body);
      res.json({
        success: true,
        message: "Vehicle updated successfully",
        data: vehicle
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  deleteVehicle = (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const success = this.vehicleService.deleteVehicle(req.user.id, id);
      res.json({
        success: true,
        message: "Vehicle deleted successfully",
        data: { id }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };
}

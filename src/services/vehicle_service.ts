import { VehicleRepository, Vehicle } from "../repositories/vehicle_repository.js";

export class VehicleService {
  private vehicleRepo: VehicleRepository;

  constructor() {
    this.vehicleRepo = new VehicleRepository();
  }

  getUsersVehicles(userId: number): Vehicle[] {
    return this.vehicleRepo.getAllByUserId(userId);
  }

  getVehicleDetail(userId: number, id: number): Vehicle {
    const vehicle = this.vehicleRepo.getById(id);
    if (!vehicle) {
      throw new Error("Vehicle not found.");
    }
    if (vehicle.user_id !== userId) {
      throw new Error("Access Denied: Owner security check failed.");
    }
    return vehicle;
  }

  registerVehicle(userId: number, vehicleData: Omit<Vehicle, "id" | "user_id">): Vehicle {
    if (!vehicleData.make || !vehicleData.model || !vehicleData.year || !vehicleData.registration_number) {
      throw new Error("Make, model, year, and registration number are strictly required.");
    }
    const yearParsed = Number(vehicleData.year);
    if (isNaN(yearParsed) || yearParsed < 1920 || yearParsed > new Date().getFullYear() + 2) {
      throw new Error("Please provide a valid manufacturing year.");
    }
    return this.vehicleRepo.create(userId, {
      ...vehicleData,
      year: yearParsed
    });
  }

  updateVehicle(userId: number, id: number, updates: Partial<Vehicle>): Vehicle {
    const existing = this.vehicleRepo.getById(id);
    if (!existing) {
      throw new Error("Vehicle not found.");
    }
    if (existing.user_id !== userId) {
      throw new Error("Access Denied: Owner security check failed.");
    }

    const updated = this.vehicleRepo.update(userId, id, updates);
    if (!updated) {
      throw new Error("Failed to update vehicle record.");
    }
    return updated;
  }

  deleteVehicle(userId: number, id: number): boolean {
    const existing = this.vehicleRepo.getById(id);
    if (!existing) {
      throw new Error("Vehicle not found.");
    }
    if (existing.user_id !== userId) {
      throw new Error("Access Denied: Owner security check failed.");
    }

    return this.vehicleRepo.delete(userId, id);
  }
}

import { readDb, writeDb, addAuditLog } from "../db/db_helper.js";

export interface Vehicle {
  id: number;
  user_id: number;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  registration_number: string;
  color: string;
  mileage: string;
  image?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export class VehicleRepository {
  getAllByUserId(userId: number): Vehicle[] {
    const data = readDb();
    const vehicles = data.vehicles || [];
    return vehicles.filter((v: any) => v.user_id === userId);
  }

  getById(id: number): Vehicle | null {
    const data = readDb();
    const vehicles = data.vehicles || [];
    const vehicle = vehicles.find((v: any) => v.id === id);
    return vehicle || null;
  }

  create(userId: number, vehicle: Omit<Vehicle, "id" | "user_id">): Vehicle {
    const data = readDb();
    if (!data.vehicles) {
      data.vehicles = [];
    }
    const nextId = data.vehicles.length > 0 ? Math.max(...data.vehicles.map((v: any) => v.id)) + 1 : 1;
    const plate = (vehicle.registration_number || vehicle.license_plate || "").toUpperCase();
    
    // Check uniqueness within the global vehicle list
    const existing = data.vehicles.find((v: any) => 
      (v.registration_number || v.license_plate || "").toUpperCase() === plate
    );
    if (existing) {
      throw new Error("A vehicle with this registration number already registered.");
    }

    const newVehicle: Vehicle = {
      ...vehicle,
      id: nextId,
      user_id: userId,
      license_plate: plate,
      registration_number: plate,
      color: vehicle.color || "Unknown",
      mileage: vehicle.mileage || "0",
      image: vehicle.image || "/uploads/placeholder_car.png",
      status: vehicle.status || "Active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    data.vehicles.push(newVehicle);
    writeDb(data);
    addAuditLog(userId, "vehicle_added", "Vehicle", newVehicle.id, `Registered vehicle: ${newVehicle.make} ${newVehicle.model} (${newVehicle.license_plate})`);
    
    return newVehicle;
  }

  update(userId: number, id: number, updates: Partial<Vehicle>): Vehicle | null {
    const data = readDb();
    if (!data.vehicles) data.vehicles = [];
    
    const index = data.vehicles.findIndex((v: any) => v.id === id);
    if (index === -1) return null;

    const vehicle = data.vehicles[index];
    if (vehicle.user_id !== userId) {
      throw new Error("Unauthorized to access or modify this vehicle.");
    }

    const updatedVehicle = {
      ...vehicle,
      ...updates,
      id, // original database identifier should remain immutable
      user_id: userId, // ownership is immutable
      updated_at: new Date().toISOString()
    };

    if (updates.registration_number || updates.license_plate) {
      const plate = (updates.registration_number || updates.license_plate || "").toUpperCase();
      const existing = data.vehicles.find((v: any) => 
        v.id !== id && (v.registration_number || v.license_plate || "").toUpperCase() === plate
      );
      if (existing) {
        throw new Error("Another vehicle with this registration number already exists.");
      }
      updatedVehicle.registration_number = plate;
      updatedVehicle.license_plate = plate;
    }

    data.vehicles[index] = updatedVehicle;
    writeDb(data);
    addAuditLog(userId, "vehicle_updated", "Vehicle", id, `Updated vehicle: ${updatedVehicle.make} ${updatedVehicle.model} (${updatedVehicle.license_plate})`);

    return updatedVehicle;
  }

  delete(userId: number, id: number): boolean {
    const data = readDb();
    if (!data.vehicles) return false;

    const index = data.vehicles.findIndex((v: any) => v.id === id);
    if (index === -1) return false;

    const vehicle = data.vehicles[index];
    if (vehicle.user_id !== userId) {
      throw new Error("Unauthorized to access or delete this vehicle.");
    }

    data.vehicles.splice(index, 1);
    writeDb(data);
    addAuditLog(userId, "vehicle_deleted", "Vehicle", id, `Deleted vehicle ID ${id}: ${vehicle.make} ${vehicle.model} (${vehicle.license_plate})`);

    return true;
  }
}

import { readDb, writeDb } from "../db/db_helper.js";

export interface Workshop {
  id: number;
  workshop_name: string;
  address: string;
  city: string;
  phone: string;
  manager_id: number;
}

export class WorkshopRepository {
  getAll(): Workshop[] {
    const data = readDb();
    return data.workshops || [];
  }

  getById(id: number): Workshop | null {
    const list = this.getAll();
    return list.find((w) => w.id === id) || null;
  }

  create(workshop: Omit<Workshop, "id">): Workshop {
    const data = readDb();
    if (!data.workshops) data.workshops = [];
    const nextId = data.workshops.length > 0 ? Math.max(...data.workshops.map((w: any) => w.id)) + 1 : 1;
    const newWorkshop: Workshop = {
      ...workshop,
      id: nextId
    };
    data.workshops.push(newWorkshop);
    writeDb(data);
    return newWorkshop;
  }
}

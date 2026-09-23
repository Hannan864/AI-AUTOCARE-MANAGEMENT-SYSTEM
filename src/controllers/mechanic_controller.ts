import { MechanicService } from "../services/mechanic_service.js";

export class MechanicController {
  private mechanicService: MechanicService;

  constructor() {
    this.mechanicService = new MechanicService();
  }

  // GET /api/v1/admin/mechanics
  getMechanics = (req: any, res: any) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const search = (req.query.search as string) || undefined;
      const specialization = (req.query.specialization as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const availability = (req.query.availability as string) || undefined;
      const rating = req.query.rating ? parseFloat(req.query.rating as string) : undefined;
      const experience = req.query.experience ? parseInt(req.query.experience as string) : undefined;
      const workshop_id = req.query.workshop_id ? parseInt(req.query.workshop_id as string) : undefined;

      const result = this.mechanicService.getFilteredMechanics({
        page,
        limit,
        search,
        specialization,
        status,
        availability,
        rating,
        experience,
        workshop_id
      });

      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // GET /api/v1/admin/mechanics/search (alias/helper)
  searchMechanics = (req: any, res: any) => {
    this.getMechanics(req, res);
  };

  // GET /api/v1/admin/mechanics/:id
  getMechanic = (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const data = this.mechanicService.getMechanicDetail(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  };

  // POST /api/v1/admin/mechanics
  createMechanic = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const { mechanic, temporaryPassword } = this.mechanicService.createMechanic(adminUserId, req.body);
      res.status(201).json({ success: true, data: mechanic, temporaryPassword });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PUT /api/v1/admin/mechanics/:id
  updateMechanic = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const updated = this.mechanicService.updateMechanic(adminUserId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // DELETE /api/v1/admin/mechanics/:id
  deleteMechanic = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const result = this.mechanicService.deleteMechanic(adminUserId, id);
      res.json({ success: true, deleted: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // DELETE /api/v1/admin/mechanics
  deleteAllMechanics = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const result = this.mechanicService.deleteAllMechanics(adminUserId);
      res.json({ success: true, deletedCount: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/mechanics/:id/status
  patchStatus = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const status = req.body.status || req.query.status as string;
      if (!status) {
        return res.status(400).json({ success: false, message: "Status parameter is required" });
      }
      const updated = this.mechanicService.setStatus(adminUserId, id, status);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/mechanics/:id/availability
  patchAvailability = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const availability = req.body.availability || req.query.availability as string;
      if (!availability) {
        return res.status(400).json({ success: false, message: "Availability parameter is required" });
      }
      const updated = this.mechanicService.setAvailability(adminUserId, id, availability);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // GET /api/v1/admin/mechanics/performance
  getPerformance = (req: any, res: any) => {
    try {
      const result = this.mechanicService.getOverallPerformanceMetrics();
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // POST /api/v1/admin/mechanics/:id/assign
  assignJob = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const mechanicId = parseInt(req.params.id);
      const { request_id } = req.body;
      if (!request_id) {
        return res.status(400).json({ success: false, message: "request_id parameter is required" });
      }
      const result = this.mechanicService.assignJobToMechanic(adminUserId, mechanicId, request_id);
      res.json({ success: true, message: "Job assigned successfully", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // GET /api/v1/admin/mechanics/export
  exportMechanics = (req: any, res: any) => {
    try {
      const { mechanics } = this.mechanicService.getFilteredMechanics({ page: 1, limit: 100000 });
      let csv = "ID,UUID,Employee Code,Full Name,Email,Phone Number,Specializations,Experience Years,Workshop ID,Status,Availability,Rating,Completed Jobs\n";
      mechanics.forEach(m => {
        const specs = m.specialization.join(" | ");
        csv += `"${m.id}","${m.uuid}","${m.employee_code}","${m.full_name}","${m.email}","${m.phone_number}","${specs}","${m.experience_years}","${m.workshop_id}","${m.current_status}","${m.availability_status}","${m.rating}","${m.completed_jobs}"\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=mechanics_database_export.csv");
      res.status(200).send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
}

import { Response } from "express";
import { RequestService } from "../services/request_service.js";

const service = new RequestService();

export class RequestController {
  async getRequests(req: any, res: Response) {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 1000;
      const result = service.getFilteredRequests({
        page,
        limit,
        search: req.query.search,
        status: req.query.status,
        request_type: req.query.request_type,
        priority: req.query.priority,
        mechanic_id: req.query.mechanic_id,
        vehicle_id: req.query.vehicle_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        sort: req.query.sort,
        order: req.query.order
      });
      res.json({ success: true, data: result.requests, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getRequestDetail(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid request registration index identifier." });
      }
      const data = service.getRequestDetail(id);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async createRequest(req: any, res: Response) {
    try {
      const result = service.createRequest(req.user.id, req.body);
      res.status(201).json({ success: true, message: "Request created successfully", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateRequest(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID parameter" });
      }
      const result = service.updateRequest(req.user.id, id, req.body);
      res.json({ success: true, message: "Request updated successfully", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async deleteRequest(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID parameter" });
      }
      service.deleteRequest(req.user.id, id);
      res.json({ success: true, message: "Service request permanently deleted from core registry systems." });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async updateStatus(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;
      if (isNaN(id) || !status) {
        return res.status(400).json({ success: false, message: "Missing required identifier or target status parameters." });
      }
      const result = service.updateStatus(req.user.id, id, status);
      res.json({ success: true, message: "Operational status transitioned successfully.", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async updatePriority(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      const { priority } = req.body;
      if (isNaN(id) || !priority) {
        return res.status(400).json({ success: false, message: "Missing request ID or priority level input." });
      }
      const result = service.updatePriority(req.user.id, id, priority);
      res.json({ success: true, message: "Job critical escalation revised.", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async assignMechanic(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      const { mechanic_id } = req.body;
      if (isNaN(id) || !mechanic_id) {
        return res.status(400).json({ success: false, message: "Missing request id or mechanic assignment parameter." });
      }
      const result = service.assignMechanic(req.user.id, id, Number(mechanic_id));
      res.json({ success: true, message: "Mechanic assigned to repair unit successfully.", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async reassignMechanic(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      const { mechanic_id, reason } = req.body;
      if (isNaN(id) || !mechanic_id) {
        return res.status(400).json({ success: false, message: "Missing request id or re-assignment specifications." });
      }
      const result = service.reassignMechanic(req.user.id, id, Number(mechanic_id), reason);
      res.json({ success: true, message: "Field technician reassigned dynamically.", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async addAdminNote(req: any, res: Response) {
    try {
      const id = Number(req.params.id);
      const { content } = req.body;
      if (isNaN(id) || !content) {
        return res.status(400).json({ success: false, message: "Content holds empty note specifications." });
      }
      const author = req.user.full_name || "Admin Agent";
      const result = service.addAdminNote(req.user.id, id, author, content);
      res.json({ success: true, message: "Internal note registered.", data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  }

  async exportRequests(req: any, res: Response) {
    try {
      const data = service.getFilteredRequests({
        limit: 10000, // Export all matching
        search: req.query.search,
        status: req.query.status,
        request_type: req.query.request_type,
        priority: req.query.priority,
        mechanic_id: req.query.mechanic_id,
        vehicle_id: req.query.vehicle_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      });

      let csv = "Request ID,Request Type,Owner Name,Owner Phone,Vehicle Details,Assigned Mechanic,Priority,Status,Estimated Cost,Final Cost,Created Date\n";
      data.requests.forEach((r: any) => {
        csv += `"${r.id}","${r.request_type}","${r.owner_name}","${r.owner_phone}","${r.vehicle_model}","${r.mechanic_name}","${r.priority}","${r.status}","${r.estimated_cost || 0}","${r.final_cost || 0}","${r.created_at}"\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=autocare_service_requests.csv");
      res.status(200).send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

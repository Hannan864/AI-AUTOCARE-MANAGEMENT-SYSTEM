import { OwnerDashboardService } from "../services/owner_dashboard_service.js";

export class OwnerDashboardController {
  private dashboardService: OwnerDashboardService;

  constructor() {
    this.dashboardService = new OwnerDashboardService();
  }

  getDashboardData = (req: any, res: any) => {
    try {
      const stats = this.dashboardService.getDashboardData(req.user.id);
      res.json({
        success: true,
        data: stats
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };
}

import { UserService } from "../services/user_service.js";

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // GET /api/v1/admin/users
  getUsers = (req: any, res: any) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const sort = (req.query.sort as string) || "created_at";
      const order = ((req.query.order as string) || "desc") as 'asc' | 'desc';
      const search = (req.query.search as string) || undefined;
      const role = (req.query.role as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const city = (req.query.city as string) || undefined;
      const startDate = (req.query.startDate as string) || undefined;
      const endDate = (req.query.endDate as string) || undefined;

      const result = this.userService.getPaginatedUsers({
        page,
        limit,
        sort,
        order,
        search,
        role,
        status,
        city,
        startDate,
        endDate
      });

      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // GET /api/v1/admin/users/:id
  getUser = (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const user = this.userService.getUserById(id);
      res.json({ success: true, data: user });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  };

  // POST /api/v1/admin/users
  createUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const { user, tempPassword } = this.userService.createUser(adminUserId, req.body);
      res.status(201).json({ success: true, data: user, temporaryPassword: tempPassword });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PUT /api/v1/admin/users/:id
  updateUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const updated = this.userService.updateUser(adminUserId, id, req.body);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // DELETE /api/v1/admin/users/:id
  deleteUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const result = this.userService.deleteUser(adminUserId, id);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/users/:id/activate
  activateUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const updated = this.userService.setUserStatus(adminUserId, id, "ACTIVE");
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/users/:id/suspend
  suspendUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const updated = this.userService.setUserStatus(adminUserId, id, "SUSPENDED");
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/users/:id/block
  blockUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const updated = this.userService.setUserStatus(adminUserId, id, "BLOCKED");
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/users/:id/unlock
  unlockUser = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const updated = this.userService.unlockAccount(adminUserId, id);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // PATCH /api/v1/admin/users/:id/reset-password
  resetPassword = (req: any, res: any) => {
    try {
      const adminUserId = req.user.id;
      const id = parseInt(req.params.id);
      const tempPassword = this.userService.resetPassword(adminUserId, id);
      res.json({ success: true, temporaryPassword: tempPassword });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  // GET /api/v1/admin/users/export/csv
  exportCsv = (req: any, res: any) => {
    try {
      const { users } = this.userService.getPaginatedUsers({ page: 1, limit: 100000 });
      let csv = "ID,UUID,Full Name,Email,Phone Number,Role,Status,City,Created At,Last Login\n";
      users.forEach(u => {
        csv += `"${u.id}","${u.uuid}","${u.full_name}","${u.email}","${u.phone_number}","${u.role}","${u.status}","${u.city}","${u.created_at}","${u.last_login}"\n`;
      });
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=users_export.csv");
      res.status(200).send(csv);
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

  // GET /api/v1/admin/users/export/excel
  exportExcel = (req: any, res: any) => {
    // Generate a tab-separated or standard spreadsheet compatible format
    this.exportCsv(req, res);
  };
}

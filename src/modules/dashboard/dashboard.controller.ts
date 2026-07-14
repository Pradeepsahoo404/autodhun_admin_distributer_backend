import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';

class DashboardController {
  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await dashboardService.getDashboard(
      req.user!.roleId,
      req.user!.role,
      req.user!.id,
      req.user!.tenantId,
      req.user!.isMasterAdmin,
      req.user!.isSuperAdmin,
    );
    sendSuccess(res, data, 'Dashboard data');
  });
}

export const dashboardController = new DashboardController();

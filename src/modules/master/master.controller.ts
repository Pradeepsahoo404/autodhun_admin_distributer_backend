import { Request, Response } from 'express';
import { masterDashboardService } from './master-dashboard.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';

class MasterController {
  dashboard = asyncHandler(async (req: Request, res: Response) => {
    const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
    const data = await masterDashboardService.getOverview(tenantId);
    sendSuccess(res, data, 'Master dashboard');
  });
}

export const masterController = new MasterController();

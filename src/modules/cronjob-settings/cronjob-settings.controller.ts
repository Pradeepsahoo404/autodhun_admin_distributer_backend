import { Request, Response } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { cronjobSettingsService } from './cronjob-settings.service';

class CronjobSettingsController {
  get = asyncHandler(async (_req: Request, res: Response) => {
    const settings = await cronjobSettingsService.getOrCreate();
    sendSuccess(res, settings, 'Cronjob settings fetched');
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const settings = await cronjobSettingsService.update(req.body, req.user!.id);
    sendSuccess(res, settings, 'Cronjob settings updated');
  });

  runNow = asyncHandler(async (_req: Request, res: Response) => {
    const result = await cronjobSettingsService.runNow();
    sendSuccess(res, result, 'Auto-delete job completed');
  });
}

export const cronjobSettingsController = new CronjobSettingsController();

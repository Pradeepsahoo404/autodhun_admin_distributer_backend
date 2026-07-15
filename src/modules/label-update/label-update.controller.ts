import { Request, Response } from 'express';
import { labelUpdateService } from './label-update.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { LabelUpdateListQueryDto } from './label-update.validator';

function updateActor(req: Request) {
  return {
    id: req.user!.id,
    isSuperAdmin: req.user!.isSuperAdmin,
    isSubAdmin: req.user!.isSubAdmin,
    roleSlug: req.user!.role,
  };
}

class LabelUpdateController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as LabelUpdateListQueryDto;
    const result = await labelUpdateService.list(query, updateActor(req));
    sendSuccess(res, result, 'Label updates fetched');
  });
}

export const labelUpdateController = new LabelUpdateController();

import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { labelUpdateService } from './label-update.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { LabelUpdateListQueryDto } from './label-update.validator';

function updateActor(req: Request) {
  return requestActor(req);
}

class LabelUpdateController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as LabelUpdateListQueryDto;
    const result = await labelUpdateService.list(query, updateActor(req));
    sendSuccess(res, result, 'Label updates fetched');
  });
}

export const labelUpdateController = new LabelUpdateController();

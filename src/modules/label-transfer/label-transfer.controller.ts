import { Request, Response } from 'express';
import { labelTransferService } from './label-transfer.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { TransferLabelDto } from './label-transfer.validator';

function releaseActor(req: Request) {
  return {
    id: req.user!.id,
    isSuperAdmin: req.user!.isSuperAdmin,
    name: req.user!.name,
  };
}

class LabelTransferController {
  overview = asyncHandler(async (req: Request, res: Response) => {
    const data = await labelTransferService.getOverview(releaseActor(req));
    sendSuccess(res, data, 'Label transfer overview fetched');
  });

  recipients = asyncHandler(async (req: Request, res: Response) => {
    const data = await labelTransferService.listRecipientOptions(releaseActor(req));
    sendSuccess(res, data, 'Transfer recipients fetched');
  });

  transfer = asyncHandler(async (req: Request, res: Response) => {
    const item = await labelTransferService.transfer(req.body as TransferLabelDto, releaseActor(req));
    sendSuccess(res, item, 'Label transferred successfully');
  });
}

export const labelTransferController = new LabelTransferController();

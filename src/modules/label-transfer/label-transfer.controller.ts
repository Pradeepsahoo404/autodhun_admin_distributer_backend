import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { labelTransferService } from './label-transfer.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { TransferLabelDto, LabelTransferListQueryDto } from './label-transfer.validator';

class LabelTransferController {
  overview = asyncHandler(async (req: Request, res: Response) => {
    const data = await labelTransferService.getOverview(requestActor(req));
    sendSuccess(res, data, 'Label transfer overview fetched');
  });

  recipients = asyncHandler(async (req: Request, res: Response) => {
    const data = await labelTransferService.listRecipientOptions(requestActor(req));
    sendSuccess(res, data, 'Transfer recipients fetched');
  });

  transfer = asyncHandler(async (req: Request, res: Response) => {
    const item = await labelTransferService.transfer(req.body as TransferLabelDto, requestActor(req));
    sendSuccess(res, item, 'Label transferred successfully');
  });

  history = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as LabelTransferListQueryDto;
    const result = await labelTransferService.listHistory(query, requestActor(req));
    sendSuccess(res, result, 'Label transfer history fetched');
  });
}

export const labelTransferController = new LabelTransferController();

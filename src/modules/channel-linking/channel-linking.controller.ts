import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { channelLinkingService } from './channel-linking.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './channel-linking.validator';

class ChannelLinkingController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await channelLinkingService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'Channel linking entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'Channel linking entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'Channel linking entry submitted — status set to In Process', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Channel linking entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await channelLinkingService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'Channel linking entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await channelLinkingService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `channel-linking-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const channelLinkingController = new ChannelLinkingController();

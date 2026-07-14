import { Request, Response } from 'express';
import { channelService } from './channel.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './channel.validator';

class ChannelController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await channelService.list(req.query as unknown as ListQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, result.items, 'Channels fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Channel fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Channel created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Channel updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await channelService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, null, 'Channel deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await channelService.exportCsv(req.query as unknown as ExportQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });

    const filename = `channels-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const channelController = new ChannelController();

import { Request, Response } from 'express';
import { channelLinkingService } from './channel-linking.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './channel-linking.validator';

class ChannelLinkingController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await channelLinkingService.list(req.query as unknown as ListQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, result.items, 'Channel linking entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Channel linking entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Channel linking entry submitted — status set to In Process', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Channel linking entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await channelLinkingService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await channelLinkingService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, null, 'Channel linking entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await channelLinkingService.exportCsv(req.query as unknown as ExportQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });

    const filename = `channel-linking-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const channelLinkingController = new ChannelLinkingController();

import { Request, Response } from 'express';
import { allowlistService } from './allowlist.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './allowlist.validator';

class AllowlistController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await allowlistService.list(req.query as unknown as ListQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, result.items, 'Allowlist entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await allowlistService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Allowlist entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await allowlistService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Allowlist entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await allowlistService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Allowlist entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await allowlistService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await allowlistService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, null, 'Allowlist entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await allowlistService.exportCsv(req.query as unknown as ExportQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });

    const filename = `allowlist-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const allowlistController = new AllowlistController();

import { Request, Response } from 'express';
import { manualClaimingService } from './manual-claiming.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './manual-claiming.validator';

class ManualClaimingController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await manualClaimingService.list(req.query as unknown as ListQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, result.items, 'Manual claiming entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Manual claiming entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Manual claiming entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Manual claiming entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await manualClaimingService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });
    sendSuccess(res, null, 'Manual claiming entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await manualClaimingService.exportCsv(req.query as unknown as ExportQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
      isSubAdmin: req.user!.isSubAdmin,
      roleSlug: req.user!.role,
    });

    const filename = `manual-claiming-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const manualClaimingController = new ManualClaimingController();

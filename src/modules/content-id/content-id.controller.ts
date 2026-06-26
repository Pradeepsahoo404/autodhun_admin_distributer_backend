import { Request, Response } from 'express';
import { contentIdService } from './content-id.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './content-id.validator';

class ContentIdController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await contentIdService.list(req.query as unknown as ListQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, result.items, 'Content ID entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await contentIdService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Content ID entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await contentIdService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Content ID entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await contentIdService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Content ID entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await contentIdService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await contentIdService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, null, 'Content ID entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await contentIdService.exportCsv(req.query as unknown as ExportQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });

    const filename = `content-id-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const contentIdController = new ContentIdController();

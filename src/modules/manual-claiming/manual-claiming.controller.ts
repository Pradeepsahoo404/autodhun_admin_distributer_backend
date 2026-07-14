import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { manualClaimingService } from './manual-claiming.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './manual-claiming.validator';

class ManualClaimingController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await manualClaimingService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'Manual claiming entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'Manual claiming entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'Manual claiming entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Manual claiming entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await manualClaimingService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await manualClaimingService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'Manual claiming entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await manualClaimingService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `manual-claiming-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const manualClaimingController = new ManualClaimingController();

import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { referenceOverlapsService } from './reference-overlaps.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './reference-overlaps.validator';

class ReferenceOverlapsController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await referenceOverlapsService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'Reference overlaps fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await referenceOverlapsService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'Reference overlap fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await referenceOverlapsService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'Reference overlap created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await referenceOverlapsService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Reference overlap updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await referenceOverlapsService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  updateOwnership = asyncHandler(async (req: Request, res: Response) => {
    const item = await referenceOverlapsService.updateOwnership(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Ownership updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await referenceOverlapsService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'Reference overlap deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await referenceOverlapsService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `reference-overlaps-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const referenceOverlapsController = new ReferenceOverlapsController();

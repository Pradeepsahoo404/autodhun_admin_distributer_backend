import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { takedownService } from './takedown.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './takedown.validator';

class TakedownController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await takedownService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'Takedown entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await takedownService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'Takedown entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await takedownService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'Takedown entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await takedownService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Takedown entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await takedownService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await takedownService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'Takedown entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await takedownService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `takedown-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const takedownController = new TakedownController();

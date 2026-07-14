import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { oacService } from './oac.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './oac.validator';

class OacController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await oacService.list(req.query as unknown as ListQueryDto, requestActor(req));
    sendSuccess(res, result.items, 'OAC entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await oacService.getById(req.params.id, requestActor(req));
    sendSuccess(res, item, 'OAC entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await oacService.create(req.body, requestActor(req));
    sendSuccess(res, item, 'OAC entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await oacService.update(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'OAC entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await oacService.updateStatus(req.params.id, req.body, requestActor(req));
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await oacService.remove(req.params.id, requestActor(req));
    sendSuccess(res, null, 'OAC entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await oacService.exportCsv(req.query as unknown as ExportQueryDto, requestActor(req));

    const filename = `oac-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const oacController = new OacController();

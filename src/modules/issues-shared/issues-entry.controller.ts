import { Request, Response } from 'express';
import { requestActor } from '@/utils/requestActor';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { IssuesEntryService } from './issues-entry.service';
import { IssuesEntryExportQueryDto, IssuesEntryListQueryDto } from './issues-entry.validator';

export function createIssuesEntryController(
  service: IssuesEntryService,
  labels: { singular: string; plural: string; exportFilePrefix: string },
) {
  class IssuesEntryController {
    list = asyncHandler(async (req: Request, res: Response) => {
      const result = await service.list(req.query as unknown as IssuesEntryListQueryDto, requestActor(req));
      sendSuccess(res, result.items, `${labels.plural} fetched`, 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    });

    getById = asyncHandler(async (req: Request, res: Response) => {
      const item = await service.getById(req.params.id, requestActor(req));
      sendSuccess(res, item, `${labels.singular} fetched`);
    });

    create = asyncHandler(async (req: Request, res: Response) => {
      const item = await service.create(req.body, requestActor(req));
      sendSuccess(res, item, `${labels.singular} created`, 201);
    });

    update = asyncHandler(async (req: Request, res: Response) => {
      const item = await service.update(req.params.id, req.body, requestActor(req));
      sendSuccess(res, item, `${labels.singular} updated`);
    });

    updateStatus = asyncHandler(async (req: Request, res: Response) => {
      const item = await service.updateStatus(req.params.id, req.body, requestActor(req));
      sendSuccess(res, item, 'Status updated');
    });

    updateOwnership = asyncHandler(async (req: Request, res: Response) => {
      const item = await service.updateOwnership(req.params.id, req.body, requestActor(req));
      sendSuccess(res, item, 'Ownership updated');
    });

    remove = asyncHandler(async (req: Request, res: Response) => {
      await service.remove(req.params.id, requestActor(req));
      sendSuccess(res, null, `${labels.singular} deleted`);
    });

    exportCsv = asyncHandler(async (req: Request, res: Response) => {
      const csv = await service.exportCsv(req.query as unknown as IssuesEntryExportQueryDto, requestActor(req));

      const filename = `${labels.exportFilePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(`\uFEFF${csv}`);
    });
  }

  return new IssuesEntryController();
}

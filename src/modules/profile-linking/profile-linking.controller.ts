import { Request, Response } from 'express';
import { profileLinkingService } from './profile-linking.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ExportQueryDto, ListQueryDto } from './profile-linking.validator';

class ProfileLinkingController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await profileLinkingService.list(req.query as unknown as ListQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, result.items, 'Profile linking entries fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const item = await profileLinkingService.getById(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Profile linking entry fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const item = await profileLinkingService.create(req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Profile linking entry created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const item = await profileLinkingService.update(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Profile linking entry updated');
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const item = await profileLinkingService.updateStatus(req.params.id, req.body, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, item, 'Status updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await profileLinkingService.remove(req.params.id, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });
    sendSuccess(res, null, 'Profile linking entry deleted');
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const csv = await profileLinkingService.exportCsv(req.query as unknown as ExportQueryDto, {
      id: req.user!.id,
      isSuperAdmin: req.user!.isSuperAdmin,
    });

    const filename = `profile-linking-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(`\uFEFF${csv}`);
  });
}

export const profileLinkingController = new ProfileLinkingController();

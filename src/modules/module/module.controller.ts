import { Request, Response } from 'express';
import { moduleService } from './module.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';

class ModuleController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const rootsOnly = req.query.rootsOnly === 'true';
    const activeOnly = req.query.activeOnly === 'true';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status =
      req.query.status === 'active' || req.query.status === 'inactive' ? req.query.status : undefined;

    const modules = await moduleService.list({
      rootsOnly,
      search,
      status: activeOnly ? 'active' : status,
    });

    sendSuccess(res, modules, 'Modules fetched');
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await moduleService.getById(req.params.id), 'Module fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await moduleService.create(req.body), 'Module created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await moduleService.update(req.params.id, req.body), 'Module updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await moduleService.remove(req.params.id);
    sendSuccess(res, null, 'Module deleted');
  });
}

export const moduleController = new ModuleController();

import { Request, Response } from 'express';
import { roleService } from './role.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { PaginationQuery } from '@/types';

class RoleController {
  list = asyncHandler(async (req: Request, res: Response) => {
    if (req.query.all === 'true') {
      const items = await roleService.listAll();
      sendSuccess(res, items, 'Roles fetched');
      return;
    }

    const result = await roleService.list(req.query as unknown as PaginationQuery);
    sendSuccess(res, result.items, 'Roles fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await roleService.getById(req.params.id), 'Role fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await roleService.create(req.body), 'Role created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await roleService.update(req.params.id, req.body), 'Role updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await roleService.remove(req.params.id);
    sendSuccess(res, null, 'Role deleted');
  });
}

export const roleController = new RoleController();

import { Request, Response } from 'express';
import { tenantService } from './tenant.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ListTenantsQueryDto } from './tenant.validator';

class TenantController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await tenantService.list(req.query as unknown as ListTenantsQueryDto);
    sendSuccess(res, result.items, 'Tenants fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await tenantService.getById(req.params.id), 'Tenant fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const result = await tenantService.createWithSuperAdmin(req.body, req.user!.id);
    sendSuccess(res, result, 'Tenant and Super Admin created', 201);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await tenantService.update(req.params.id, req.body, req.user?.id), 'Tenant updated');
  });
}

export const tenantController = new TenantController();

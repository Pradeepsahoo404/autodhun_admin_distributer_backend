import { Request, Response } from 'express';
import { permissionService } from './permission.service';
import { roleRepository } from '@/modules/role/role.repository';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ApiError } from '@/utils/ApiError';

class PermissionController {
  /** Resolved sidebar/permission matrix for the authenticated user. */
  mySidebar = asyncHandler(async (req: Request, res: Response) => {
    const data = await permissionService.resolveForUser(req.user!.roleId, req.user!.role, req.user!.id);
    sendSuccess(res, data, 'Sidebar resolved');
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const roleId = (req.query.roleId as string | undefined) ?? undefined;
    sendSuccess(res, await permissionService.list(roleId), 'Permissions fetched');
  });

  matrix = asyncHandler(async (req: Request, res: Response) => {
    const roleId = req.query.roleId as string;
    const role = await roleRepository.findById(roleId);
    if (!role) throw ApiError.notFound('Role not found');
    sendSuccess(res, await permissionService.getMatrix(roleId, role.slug), 'Permission matrix');
  });

  set = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await permissionService.setPermission(req.body), 'Permission saved', 201);
  });

  bulkSet = asyncHandler(async (req: Request, res: Response) => {
    const { roleId, permissions } = req.body;
    sendSuccess(res, await permissionService.bulkSet(roleId, permissions), 'Permissions saved');
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await permissionService.update(req.params.id, req.body), 'Permission updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await permissionService.remove(req.params.id);
    sendSuccess(res, null, 'Permission deleted');
  });
}

export const permissionController = new PermissionController();

import { Request, Response } from 'express';
import { permissionService, type PermissionActor } from './permission.service';
import { roleRepository } from '@/modules/role/role.repository';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { ApiError } from '@/utils/ApiError';
import { ROLES } from '@/constants';

function toActor(req: Request): PermissionActor {
  return {
    id: req.user!.id,
    role: req.user!.role,
    isMasterAdmin: req.user!.isMasterAdmin,
    isSuperAdmin: req.user!.isSuperAdmin,
    tenantId: req.user!.tenantId,
  };
}

class PermissionController {
  /** Resolved sidebar/permission matrix for the authenticated user. */
  mySidebar = asyncHandler(async (req: Request, res: Response) => {
    const data = await permissionService.resolveForRole(
      req.user!.roleId,
      req.user!.role,
      req.user!.tenantId,
    );
    sendSuccess(res, data, 'Sidebar resolved');
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActor(req);
    const roleId = (req.query.roleId as string | undefined) ?? undefined;
    const tenantId = actor.isMasterAdmin
      ? ((req.query.tenantId as string | undefined) ?? null)
      : actor.tenantId;
    sendSuccess(res, await permissionService.list(roleId, tenantId), 'Permissions fetched');
  });

  matrix = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActor(req);
    const roleId = req.query.roleId as string;
    const role = await roleRepository.findById(roleId);
    if (!role) throw ApiError.notFound('Role not found');

    if (!actor.isMasterAdmin) {
      if (role.slug !== ROLES.ADMIN) {
        throw ApiError.forbidden('You can only view the Admin permission matrix');
      }
    }

    const tenantId = actor.isMasterAdmin
      ? ((req.query.tenantId as string | undefined) ?? null)
      : actor.tenantId;

    sendSuccess(
      res,
      await permissionService.getMatrix(roleId, role.slug, tenantId),
      'Permission matrix',
    );
  });

  set = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActor(req);
    sendSuccess(
      res,
      await permissionService.setPermission(
        {
          ...req.body,
          tenantId: actor.isMasterAdmin ? (req.body.tenantId ?? null) : actor.tenantId,
        },
        actor,
      ),
      'Permission saved',
      201,
    );
  });

  bulkSet = asyncHandler(async (req: Request, res: Response) => {
    const actor = toActor(req);
    const { roleId, permissions, tenantId } = req.body;
    sendSuccess(
      res,
      await permissionService.bulkSet(
        roleId,
        permissions,
        actor,
        actor.isMasterAdmin ? (tenantId ?? null) : actor.tenantId,
      ),
      'Permissions saved',
    );
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await permissionService.update(req.params.id, req.body, toActor(req)),
      'Permission updated',
    );
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await permissionService.remove(req.params.id, toActor(req));
    sendSuccess(res, null, 'Permission deleted');
  });
}

export const permissionController = new PermissionController();

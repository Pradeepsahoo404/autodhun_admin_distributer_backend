import { RequestHandler } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiError } from '@/utils/ApiError';
import { permissionService } from '@/modules/permission/permission.service';
import { PermissionAction, ROLES } from '@/constants';

/** Restrict a route to one or more role slugs. Master always passes. */
export const requireRole = (...allowedRoles: string[]): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isMasterAdmin || req.user.isSuperAdmin || allowedRoles.includes(req.user.role)) {
      return next();
    }
    throw ApiError.forbidden('You do not have the required role to access this resource');
  });

/** Ensure the user's role has *view* access to the given module (sidebar gate). */
export const checkModule = (moduleSlug: string): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isMasterAdmin || req.user.isSuperAdmin) return next();

    const allowed = await permissionService.can(
      req.user.roleId,
      req.user.role,
      moduleSlug,
      'view',
      req.user.tenantId,
    );
    if (!allowed) throw ApiError.forbidden(`No access to module: ${moduleSlug}`);
    next();
  });

/** Ensure the user's role can perform a specific action on a module. */
export const checkPermission = (moduleSlug: string, action: PermissionAction): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isMasterAdmin || req.user.isSuperAdmin) return next();

    const allowed = await permissionService.can(
      req.user.roleId,
      req.user.role,
      moduleSlug,
      action,
      req.user.tenantId,
    );
    if (!allowed) {
      throw ApiError.forbidden(`You are not allowed to ${action} in module: ${moduleSlug}`);
    }
    next();
  });

/** Platform / elevated routes (Master + Super Admin). */
export const superAdminOnly = requireRole(ROLES.MASTER_ADMIN, ROLES.SUPER_ADMIN);

/** Strict Master Admin only (tenant Super Admins cannot pass). */
export const masterAdminOnly: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.isMasterAdmin) return next();
  throw ApiError.forbidden('Master Admin access required');
});

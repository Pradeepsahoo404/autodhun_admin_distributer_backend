import { RequestHandler } from 'express';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiError } from '@/utils/ApiError';
import { permissionService } from '@/modules/permission/permission.service';
import { PermissionAction, ROLES } from '@/constants';

/** Restrict a route to one or more role slugs. */
export const requireRole = (...allowedRoles: string[]): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isSuperAdmin || allowedRoles.includes(req.user.role)) return next();
    throw ApiError.forbidden('You do not have the required role to access this resource');
  });

/** Ensure the user's role has *view* access to the given module (sidebar gate). */
export const checkModule = (moduleSlug: string): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isSuperAdmin) return next();

    const allowed = await permissionService.can(req.user.roleId, req.user.role, moduleSlug, 'view');
    if (!allowed) throw ApiError.forbidden(`No access to module: ${moduleSlug}`);
    next();
  });

/** Ensure the user's role can perform a specific action on a module. */
export const checkPermission = (moduleSlug: string, action: PermissionAction): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.isSuperAdmin) return next();

    const allowed = await permissionService.can(req.user.roleId, req.user.role, moduleSlug, action);
    if (!allowed) {
      throw ApiError.forbidden(`You are not allowed to ${action} in module: ${moduleSlug}`);
    }
    next();
  });

/** Convenience guard for Super-Admin-only routes. */
export const superAdminOnly = requireRole(ROLES.SUPER_ADMIN);

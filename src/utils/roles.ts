import { ROLES } from '@/constants';

/** Platform owner (sees all tenants). */
export function isMasterAdminRole(roleSlug: string): boolean {
  return roleSlug === ROLES.MASTER_ADMIN;
}

/** Tenant owner role slug (after Phase 3 provisioning). */
export function isSuperAdminRole(roleSlug: string): boolean {
  return roleSlug === ROLES.SUPER_ADMIN;
}

/**
 * Elevated access: Master Admin or Super Admin.
 * Phase 2 bridge — Master inherits former Super Admin privileges so feature
 * services keep working until tenant scoping (Phase 6).
 */
export function isElevatedRole(roleSlug: string): boolean {
  return isMasterAdminRole(roleSlug) || isSuperAdminRole(roleSlug);
}

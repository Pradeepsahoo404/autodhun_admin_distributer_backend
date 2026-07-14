/**
 * Multi-tenant foundations.
 *
 * Role map:
 *   - Master Admin  → platform, tenantId = null, cross-tenant data access
 *   - Super Admin   → tenant owner, tenantId set, full access within one tenant
 *   - Admin         → tenant staff, tenantId set, module + own-row limits
 *
 * Phase 6: feature documents carry tenantId; list/write helpers live in
 * utils/tenantScope.ts. Elevated `isSuperAdmin` on Master remains for
 * permission/status actions only — data scope uses isMasterAdmin / tenantId.
 */

export const TENANT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];

/** Default tenant created for existing Admin accounts before real tenants exist. */
export const LEGACY_TENANT_SLUG = 'legacy';
export const LEGACY_TENANT_NAME = 'Legacy Tenant';

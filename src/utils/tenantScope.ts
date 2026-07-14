import { ApiError } from '@/utils/ApiError';
import { isMasterAdminRole, isSuperAdminRole } from '@/utils/roles';

/**
 * Actor shape used by tenant helpers. Compatible with Express `AuthUser`.
 */
export interface TenantActor {
  id: string;
  role: string;
  /** Elevated bridge — Master also has this true for permission/status actions. */
  isSuperAdmin: boolean;
  /** Platform owner — only Master sees cross-tenant data. */
  isMasterAdmin?: boolean;
  /** null for Master; set for Super Admin and Admin. */
  tenantId: string | null;
  name?: string;
}

/** True when the actor is the platform Master (cross-tenant). */
export function isPlatformMaster(actor: Pick<TenantActor, 'isMasterAdmin' | 'role'>): boolean {
  return Boolean(actor.isMasterAdmin) || isMasterAdminRole(actor.role);
}

/** Tenant Super Admin (not Master). */
export function isTenantSuperAdmin(actor: Pick<TenantActor, 'isMasterAdmin' | 'isSuperAdmin' | 'role'>): boolean {
  if (isPlatformMaster(actor)) return false;
  return Boolean(actor.isSuperAdmin) || isSuperAdminRole(actor.role);
}

/**
 * Mongo filter limiting rows to the actor's tenant.
 * Master → {}; Super Admin / Admin → { tenantId }; no tenant → match nothing.
 */
export function tenantScopeFilter(
  actor: TenantActor,
  options?: { tenantId?: string },
): Record<string, unknown> {
  if (isPlatformMaster(actor)) {
    if (options?.tenantId) return { tenantId: options.tenantId };
    return {};
  }
  if (!actor.tenantId) {
    return { tenantId: '__no_tenant__' };
  }
  return { tenantId: actor.tenantId };
}

/**
 * List/export filter for creator-owned feature docs.
 * Master → all (optional tenant); Super Admin → all in tenant; Admin → own rows in tenant.
 */
export function createdByFeatureScope(
  actor: TenantActor,
  options?: { tenantId?: string },
): Record<string, unknown> {
  const tenant = tenantScopeFilter(actor, options);
  if (isPlatformMaster(actor) || actor.isSuperAdmin) {
    return tenant;
  }
  return { ...tenant, createdBy: actor.id };
}

/**
 * List/export filter for assignee-owned issues docs.
 * Master → all; Super Admin → tenant; Admin → assigned to self within tenant.
 */
export function assignedToFeatureScope(
  actor: TenantActor,
  options?: { tenantId?: string },
): Record<string, unknown> {
  const tenant = tenantScopeFilter(actor, options);
  if (isPlatformMaster(actor) || actor.isSuperAdmin) {
    return tenant;
  }
  return { ...tenant, assignedTo: actor.id };
}

/** Ensures a document's tenant matches the actor (IDOR guard). Master bypasses. */
export function assertTenantAccess(
  actor: TenantActor,
  resourceTenantId: string | null | undefined,
): void {
  if (isPlatformMaster(actor)) return;
  const rid =
    resourceTenantId && typeof resourceTenantId === 'object' && 'toString' in resourceTenantId
      ? String(resourceTenantId)
      : resourceTenantId
        ? String(resourceTenantId)
        : null;
  if (!actor.tenantId || !rid || actor.tenantId !== rid) {
    throw ApiError.forbidden('You do not have access to this tenant resource');
  }
}

function ownerIdOf(item: { createdBy?: unknown; assignedTo?: unknown }, field: 'createdBy' | 'assignedTo'): string {
  const raw = item[field] as unknown;
  if (raw && typeof raw === 'object' && '_id' in (raw as object)) {
    return String((raw as { _id: { toString(): string } })._id);
  }
  return String(raw ?? '');
}

/**
 * Tenant + ownership guard for a single feature document.
 * Master: any. Super Admin: same tenant. Admin: same tenant + owner field.
 */
export function assertFeatureAccess(
  actor: TenantActor,
  item: {
    tenantId?: { toString(): string } | string | null;
    createdBy?: unknown;
    assignedTo?: unknown;
  },
  ownerField: 'createdBy' | 'assignedTo' = 'createdBy',
): void {
  const resourceTenantId =
    item.tenantId && typeof item.tenantId === 'object'
      ? item.tenantId.toString()
      : item.tenantId
        ? String(item.tenantId)
        : null;
  assertTenantAccess(actor, resourceTenantId);

  if (isPlatformMaster(actor) || actor.isSuperAdmin) return;

  if (ownerIdOf(item, ownerField) !== actor.id) {
    throw ApiError.forbidden(
      ownerField === 'assignedTo'
        ? 'You can only access issues assigned to you'
        : 'You can only modify your own records',
    );
  }
}

/**
 * Tenant id to stamp on create. Master may pass explicit; others locked to own tenant.
 */
export function resolveWriteTenantId(
  actor: TenantActor,
  explicitTenantId?: string | null,
): string | null {
  if (isPlatformMaster(actor)) {
    return explicitTenantId ?? actor.tenantId ?? null;
  }
  if (!actor.tenantId) {
    throw ApiError.forbidden('Your account is not assigned to a tenant');
  }
  if (explicitTenantId && explicitTenantId !== actor.tenantId) {
    throw ApiError.forbidden('Cannot write data for another tenant');
  }
  return actor.tenantId;
}

/** Same as resolveWriteTenantId but fails if no tenant can be resolved (feature creates). */
export function requireWriteTenantId(
  actor: TenantActor,
  explicitTenantId?: string | null,
): string {
  const tenantId = resolveWriteTenantId(actor, explicitTenantId);
  if (!tenantId) {
    throw ApiError.badRequest('tenantId is required to create this resource');
  }
  return tenantId;
}

import type { Request } from 'express';
import type { TenantActor } from '@/utils/tenantScope';

/** Build a TenantActor (+ name) from the authenticated request. */
export function requestActor(req: Request): TenantActor {
  const user = req.user!;
  return {
    id: user.id,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
    isMasterAdmin: user.isMasterAdmin,
    tenantId: user.tenantId,
    name: user.name,
  };
}

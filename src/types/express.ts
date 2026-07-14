import type { JwtPayload } from '@/utils/jwt';

/**
 * Authenticated principal attached to the request by the auth middleware.
 *
 * Phase 2+: Master sets `isMasterAdmin`. Master also sets `isSuperAdmin`
 * (elevated bridge) so permission/status actions that key off `isSuperAdmin`
 * keep working. Phase 6 splits data scoping via `tenantId` + tenantScope helpers;
 * the elevated bridge may remain for isSuperAdmin permission actions.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  role: string;
  isSuperAdmin: boolean;
  isMasterAdmin: boolean;
  tenantId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: JwtPayload;
    }
  }
}

export {};

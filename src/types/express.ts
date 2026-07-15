import type { JwtPayload } from '@/utils/jwt';

/**
 * Authenticated principal attached to the request by the auth middleware.
 * `isSuperAdmin` short-circuits all permission checks downstream.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  role: string;
  isSuperAdmin: boolean;
  isSubAdmin: boolean;
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

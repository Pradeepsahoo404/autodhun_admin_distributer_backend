import { RequestHandler } from 'express';
import { verifyAccessToken } from '@/utils/jwt';
import { ApiError } from '@/utils/ApiError';
import { asyncHandler } from '@/utils/asyncHandler';
import { userRepository } from '@/modules/user/user.repository';
import { ROLES, USER_STATUS } from '@/constants';
import { IRole } from '@/modules/role/role.model';

/**
 * Verifies the Bearer access token, re-validates the user against the DB
 * (so blocked/deleted accounts are rejected immediately) and attaches the
 * authenticated principal to `req.user`.
 */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token is missing');
  }

  const token = header.slice(7).trim();
  const payload = verifyAccessToken(token);

  const user = await userRepository.findByIdWithRole(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (user.status !== USER_STATUS.ACTIVE) throw ApiError.forbidden('Account is not active');

  const role = user.role as unknown as IRole;
  req.user = {
    id: user._id.toString(),
    email: user.email,
    roleId: role._id.toString(),
    role: role.slug,
    isSuperAdmin: role.slug === ROLES.SUPER_ADMIN,
  };
  req.token = payload;
  next();
});

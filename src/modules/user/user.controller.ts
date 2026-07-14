import { Request, Response } from 'express';
import { userService, type UserActor } from './user.service';
import { asyncHandler } from '@/utils/asyncHandler';
import { sendSuccess } from '@/utils/ApiResponse';
import { PaginationQuery } from '@/types';

function toActor(req: Request): UserActor {
  return {
    id: req.user!.id,
    role: req.user!.role,
    isMasterAdmin: req.user!.isMasterAdmin,
    isSuperAdmin: req.user!.isSuperAdmin,
    tenantId: req.user!.tenantId,
  };
}

class UserController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.list(req.query as unknown as PaginationQuery, toActor(req));
    sendSuccess(res, result.items, 'Users fetched', 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getById(req.params.id, toActor(req));
    sendSuccess(res, user, 'User fetched');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.create(req.body, toActor(req));
    sendSuccess(res, user, 'User created', 201);
  });

  inviteAdmin = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.inviteAdmin(req.body, toActor(req));
    sendSuccess(res, user, 'Admin invited successfully. Login credentials have been emailed.', 201);
  });

  resendInvite = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.resendInvite(req.params.id, req.body, toActor(req));
    sendSuccess(res, user, 'Invite resent with new credentials');
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.update(req.params.id, req.body, toActor(req));
    sendSuccess(res, user, 'User updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await userService.remove(req.params.id, toActor(req));
    sendSuccess(res, null, 'User deleted');
  });

  adminStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await userService.getAdminCreationStats(toActor(req));
    sendSuccess(res, stats, 'Admin stats fetched');
  });
}

export const userController = new UserController();

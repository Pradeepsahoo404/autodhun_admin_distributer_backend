import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { createUserSchema, inviteAdminSchema, resendInviteSchema, updateUserSchema } from './user.validator';
import { idParamSchema, paginationQuerySchema } from '@/validators/common.validator';

const MODULE = 'users';
const router = Router();

router.use(authenticate);

router.get('/', checkPermission(MODULE, 'view'), validate({ query: paginationQuerySchema }), userController.list);
router.get(
  '/stats/admins-created',
  superAdminOnly,
  checkPermission(MODULE, 'view'),
  userController.adminStats,
);
router.post(
  '/invite-admin',
  superAdminOnly,
  checkPermission(MODULE, 'create'),
  validate({ body: inviteAdminSchema }),
  userController.inviteAdmin,
);
router.post(
  '/:id/resend-invite',
  superAdminOnly,
  checkPermission(MODULE, 'create'),
  validate({ params: idParamSchema, body: resendInviteSchema }),
  userController.resendInvite,
);
router.get('/:id', checkPermission(MODULE, 'view'), validate({ params: idParamSchema }), userController.getById);
router.post('/', checkPermission(MODULE, 'create'), validate({ body: createUserSchema }), userController.create);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateUserSchema }),
  userController.update,
);
router.delete('/:id', checkPermission(MODULE, 'delete'), validate({ params: idParamSchema }), userController.remove);

export const userRoutes = router;

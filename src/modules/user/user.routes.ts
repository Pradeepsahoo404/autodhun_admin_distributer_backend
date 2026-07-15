import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createUserSchema,
  inviteAdminSchema,
  inviteSubAdminSchema,
  resendInviteSchema,
  updateSubAdminPermissionsSchema,
  updateUserSchema,
} from './user.validator';
import { idParamSchema, paginationQuerySchema } from '@/validators/common.validator';

const MODULE = 'users';
const SUB_ADMIN_MODULE = 'sub-admins';
const router = Router();

router.use(authenticate);

router.get('/issue-assignees', checkPermission('issues', 'view'), userController.issueAssignees);
router.get('/', checkPermission(MODULE, 'view'), validate({ query: paginationQuerySchema }), userController.list);
router.get(
  '/sub-admins',
  checkPermission(SUB_ADMIN_MODULE, 'view'),
  validate({ query: paginationQuerySchema }),
  userController.listSubAdmins,
);
router.get(
  '/stats/admins-created',
  superAdminOnly,
  checkPermission(MODULE, 'view'),
  userController.adminStats,
);
router.post(
  '/invite-admin',
  checkPermission(MODULE, 'create'),
  validate({ body: inviteAdminSchema }),
  userController.inviteAdmin,
);
router.post(
  '/invite-sub-admin',
  superAdminOnly,
  checkPermission(SUB_ADMIN_MODULE, 'create'),
  validate({ body: inviteSubAdminSchema }),
  userController.inviteSubAdmin,
);
router.get(
  '/:id/sub-admin-permissions',
  superAdminOnly,
  checkPermission(SUB_ADMIN_MODULE, 'view'),
  validate({ params: idParamSchema }),
  userController.getSubAdminPermissions,
);
router.put(
  '/:id/sub-admin-permissions',
  superAdminOnly,
  checkPermission(SUB_ADMIN_MODULE, 'update'),
  validate({ params: idParamSchema, body: updateSubAdminPermissionsSchema }),
  userController.updateSubAdminPermissions,
);
router.post(
  '/:id/resend-invite',
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

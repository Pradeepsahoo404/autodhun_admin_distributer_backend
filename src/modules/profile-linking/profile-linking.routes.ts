import { Router } from 'express';
import { profileLinkingController } from './profile-linking.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createProfileLinkingSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateProfileLinkingSchema,
} from './profile-linking.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'profile-linking';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  profileLinkingController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  profileLinkingController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  profileLinkingController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createProfileLinkingSchema }),
  profileLinkingController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateProfileLinkingSchema }),
  profileLinkingController.update,
);
router.patch(
  '/:id/status',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  profileLinkingController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  profileLinkingController.remove,
);

export const profileLinkingRoutes = router;

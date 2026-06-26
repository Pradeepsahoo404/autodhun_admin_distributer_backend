import { Router } from 'express';
import { allowlistController } from './allowlist.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createAllowlistSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateAllowlistSchema,
} from './allowlist.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'allowlist';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  allowlistController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  allowlistController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  allowlistController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createAllowlistSchema }),
  allowlistController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateAllowlistSchema }),
  allowlistController.update,
);
router.patch(
  '/:id/status',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateStatusSchema }),
  allowlistController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  allowlistController.remove,
);

export const allowlistRoutes = router;

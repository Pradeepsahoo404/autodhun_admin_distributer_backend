import { Router } from 'express';
import { takedownController } from './takedown.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createTakedownSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateTakedownSchema,
} from './takedown.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'takedown';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  takedownController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  takedownController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  takedownController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createTakedownSchema }),
  takedownController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateTakedownSchema }),
  takedownController.update,
);
router.patch(
  '/:id/status',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateStatusSchema }),
  takedownController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  takedownController.remove,
);

export const takedownRoutes = router;

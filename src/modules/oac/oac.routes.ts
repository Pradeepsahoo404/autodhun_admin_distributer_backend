import { Router } from 'express';
import { oacController } from './oac.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createOacSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateOacSchema,
} from './oac.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'oac';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  oacController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  oacController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  oacController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createOacSchema }),
  oacController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateOacSchema }),
  oacController.update,
);
router.patch(
  '/:id/status',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  oacController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  oacController.remove,
);

export const oacRoutes = router;

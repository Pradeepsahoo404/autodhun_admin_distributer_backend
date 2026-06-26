import { Router } from 'express';
import { manualClaimingController } from './manual-claiming.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createManualClaimingSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateManualClaimingSchema,
} from './manual-claiming.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'manual-claiming';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  manualClaimingController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  manualClaimingController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  manualClaimingController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createManualClaimingSchema }),
  manualClaimingController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateManualClaimingSchema }),
  manualClaimingController.update,
);
router.patch(
  '/:id/status',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateStatusSchema }),
  manualClaimingController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  manualClaimingController.remove,
);

export const manualClaimingRoutes = router;

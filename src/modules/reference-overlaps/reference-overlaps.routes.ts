import { Router } from 'express';
import { referenceOverlapsController } from './reference-overlaps.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createReferenceOverlapSchema,
  exportQuerySchema,
  listQuerySchema,
  updateOwnershipSchema,
  updateReferenceOverlapSchema,
  updateStatusSchema,
} from './reference-overlaps.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'reference-overlaps';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  referenceOverlapsController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  referenceOverlapsController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  referenceOverlapsController.getById,
);
router.post(
  '/',
  superAdminOnly,
  validate({ body: createReferenceOverlapSchema }),
  referenceOverlapsController.create,
);
router.put(
  '/:id',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateReferenceOverlapSchema }),
  referenceOverlapsController.update,
);
router.patch(
  '/:id/status',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateStatusSchema }),
  referenceOverlapsController.updateStatus,
);
router.patch(
  '/:id/ownership',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema, body: updateOwnershipSchema }),
  referenceOverlapsController.updateOwnership,
);
router.delete(
  '/:id',
  superAdminOnly,
  validate({ params: idParamSchema }),
  referenceOverlapsController.remove,
);

export const referenceOverlapsRoutes = router;

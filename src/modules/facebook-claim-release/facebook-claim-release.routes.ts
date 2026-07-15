import { Router } from 'express';
import { facebookClaimReleaseController } from './facebook-claim-release.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createFacebookClaimReleaseSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateFacebookClaimReleaseSchema,
} from './facebook-claim-release.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'facebook-claim-release';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  facebookClaimReleaseController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  facebookClaimReleaseController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  facebookClaimReleaseController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createFacebookClaimReleaseSchema }),
  facebookClaimReleaseController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateFacebookClaimReleaseSchema }),
  facebookClaimReleaseController.update,
);
router.patch(
  '/:id/status',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  facebookClaimReleaseController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  facebookClaimReleaseController.remove,
);

export const facebookClaimReleaseRoutes = router;

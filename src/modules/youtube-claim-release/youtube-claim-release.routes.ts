import { Router } from 'express';
import { youtubeClaimReleaseController } from './youtube-claim-release.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createYoutubeClaimReleaseSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateYoutubeClaimReleaseSchema,
} from './youtube-claim-release.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'youtube-claim-release';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  youtubeClaimReleaseController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  youtubeClaimReleaseController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  youtubeClaimReleaseController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createYoutubeClaimReleaseSchema }),
  youtubeClaimReleaseController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateYoutubeClaimReleaseSchema }),
  youtubeClaimReleaseController.update,
);
router.patch(
  '/:id/status',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  youtubeClaimReleaseController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  youtubeClaimReleaseController.remove,
);

export const youtubeClaimReleaseRoutes = router;

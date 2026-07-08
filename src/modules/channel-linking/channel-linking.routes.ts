import { Router } from 'express';
import { channelLinkingController } from './channel-linking.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createChannelLinkingSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateChannelLinkingSchema,
} from './channel-linking.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'channel-linking';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  channelLinkingController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  channelLinkingController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  channelLinkingController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createChannelLinkingSchema }),
  channelLinkingController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateChannelLinkingSchema }),
  channelLinkingController.update,
);
router.patch(
  '/:id/status',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateStatusSchema }),
  channelLinkingController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  channelLinkingController.remove,
);

export const channelLinkingRoutes = router;

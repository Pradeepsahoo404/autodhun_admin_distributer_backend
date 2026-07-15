import { Router } from 'express';
import { channelController } from './channel.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createChannelSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateChannelSchema,
} from './channel.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'create-channel';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  channelController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  channelController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  channelController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createChannelSchema }),
  channelController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateChannelSchema }),
  channelController.update,
);
router.patch(
  '/:id/status',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  channelController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  channelController.remove,
);

export const channelRoutes = router;

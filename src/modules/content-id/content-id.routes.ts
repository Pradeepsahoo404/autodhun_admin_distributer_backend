import { Router } from 'express';
import { contentIdController } from './content-id.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createContentIdSchema,
  exportQuerySchema,
  listQuerySchema,
  updateStatusSchema,
  updateContentIdSchema,
} from './content-id.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'content-id';
const router = Router();

router.use(authenticate);

router.get(
  '/export',
  checkPermission(MODULE, 'view'),
  validate({ query: exportQuerySchema }),
  contentIdController.exportCsv,
);
router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listQuerySchema }),
  contentIdController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  contentIdController.getById,
);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: createContentIdSchema }),
  contentIdController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateContentIdSchema }),
  contentIdController.update,
);
router.patch(
  '/:id/status',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateStatusSchema }),
  contentIdController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  contentIdController.remove,
);

export const contentIdRoutes = router;

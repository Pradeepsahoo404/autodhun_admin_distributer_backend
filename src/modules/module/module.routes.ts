import { Router } from 'express';
import { moduleController } from './module.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { createModuleSchema, updateModuleSchema } from './module.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'modules';
const router = Router();

router.use(authenticate);

router.get('/', checkPermission(MODULE, 'view'), moduleController.list);
router.get('/:id', checkPermission(MODULE, 'view'), validate({ params: idParamSchema }), moduleController.getById);
router.post('/', checkPermission(MODULE, 'create'), validate({ body: createModuleSchema }), moduleController.create);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateModuleSchema }),
  moduleController.update,
);
router.delete('/:id', checkPermission(MODULE, 'delete'), validate({ params: idParamSchema }), moduleController.remove);

export const moduleRoutes = router;

import { Router } from 'express';
import { z } from 'zod';
import { roleController } from './role.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { createRoleSchema, updateRoleSchema } from './role.validator';
import { idParamSchema, paginationQuerySchema } from '@/validators/common.validator';

const roleListQuerySchema = paginationQuerySchema.extend({
  all: z.enum(['true', 'false']).optional(),
});

const MODULE = 'roles';
const router = Router();

router.use(authenticate);

router.get('/', checkPermission(MODULE, 'view'), validate({ query: roleListQuerySchema }), roleController.list);
router.get('/:id', checkPermission(MODULE, 'view'), validate({ params: idParamSchema }), roleController.getById);
router.post('/', checkPermission(MODULE, 'create'), validate({ body: createRoleSchema }), roleController.create);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateRoleSchema }),
  roleController.update,
);
router.delete('/:id', checkPermission(MODULE, 'delete'), validate({ params: idParamSchema }), roleController.remove);

export const roleRoutes = router;

import { Router } from 'express';
import { permissionController } from './permission.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  setPermissionSchema,
  updatePermissionSchema,
  listPermissionQuerySchema,
  matrixPermissionQuerySchema,
  bulkSetPermissionSchema,
} from './permission.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'permissions';
const router = Router();

router.use(authenticate);

// Any authenticated user may resolve their own sidebar — no module gate.
router.get('/me/sidebar', permissionController.mySidebar);

router.get('/', checkPermission(MODULE, 'view'), validate({ query: listPermissionQuerySchema }), permissionController.list);
router.get(
  '/matrix',
  checkPermission(MODULE, 'view'),
  validate({ query: matrixPermissionQuerySchema }),
  permissionController.matrix,
);
router.post('/', checkPermission(MODULE, 'create'), validate({ body: setPermissionSchema }), permissionController.set);
router.post(
  '/bulk',
  checkPermission(MODULE, 'update'),
  validate({ body: bulkSetPermissionSchema }),
  permissionController.bulkSet,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updatePermissionSchema }),
  permissionController.update,
);
router.delete('/:id', checkPermission(MODULE, 'delete'), validate({ params: idParamSchema }), permissionController.remove);

export const permissionRoutes = router;

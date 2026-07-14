import { Router } from 'express';
import { tenantController } from './tenant.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { masterAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  createTenantSchema,
  listTenantsQuerySchema,
  updateTenantSchema,
} from './tenant.validator';
import { idParamSchema } from '@/validators/common.validator';

/** Master Admin only — provision and manage tenants. */
const router = Router();

router.use(authenticate, masterAdminOnly);

router.get('/', validate({ query: listTenantsQuerySchema }), tenantController.list);
router.get('/:id', validate({ params: idParamSchema }), tenantController.getById);
router.post('/', validate({ body: createTenantSchema }), tenantController.create);
router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateTenantSchema }),
  tenantController.update,
);

export const tenantRoutes = router;

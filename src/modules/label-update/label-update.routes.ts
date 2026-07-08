import { Router } from 'express';
import { labelUpdateController } from './label-update.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { labelUpdateListQuerySchema } from './label-update.validator';

const MODULE = 'label-update';
const router = Router();

router.use(authenticate);

router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: labelUpdateListQuerySchema }),
  labelUpdateController.list,
);

export const labelUpdateRoutes = router;

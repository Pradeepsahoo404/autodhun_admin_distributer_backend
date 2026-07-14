import { Router } from 'express';
import { z } from 'zod';
import { masterController } from './master.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { masterAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { objectId } from '@/validators/common.validator';

const dashboardQuerySchema = z.object({
  tenantId: objectId.optional(),
});

const router = Router();

router.use(authenticate, masterAdminOnly);

router.get('/dashboard', validate({ query: dashboardQuerySchema }), masterController.dashboard);

export const masterRoutes = router;

import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkModule } from '@/middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

// Requires view access to the dashboard module itself.
router.get('/', checkModule('dashboard'), dashboardController.getDashboard);

export const dashboardRoutes = router;

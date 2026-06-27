import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { cronjobSettingsController } from './cronjob-settings.controller';
import { updateCronjobSettingsSchema } from './cronjob-settings.validator';

const router = Router();

router.use(authenticate, superAdminOnly);

router.get('/', cronjobSettingsController.get);
router.put('/', validate({ body: updateCronjobSettingsSchema }), cronjobSettingsController.update);
router.post('/run', cronjobSettingsController.runNow);

export const cronjobSettingsRoutes = router;

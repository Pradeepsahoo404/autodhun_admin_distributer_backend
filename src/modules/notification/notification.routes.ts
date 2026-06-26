import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { listNotificationQuerySchema } from './notification.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'notifications';
const router = Router();

router.use(authenticate);
router.use(checkPermission(MODULE, 'view'));

router.get(
  '/',
  validate({ query: listNotificationQuerySchema }),
  notificationController.list,
);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', validate({ params: idParamSchema }), notificationController.markRead);

export const notificationRoutes = router;

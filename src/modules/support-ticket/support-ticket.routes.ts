import { Router } from 'express';
import { supportTicketController } from './support-ticket.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission, superAdminOnly } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { asyncHandler } from '@/utils/asyncHandler';
import { ApiError } from '@/utils/ApiError';
import {
  createSupportTicketSchema,
  listSupportTicketsQuerySchema,
  updateSupportTicketSchema,
  updateSupportTicketStatusSchema,
} from './support-ticket.validator';
import { idParamSchema } from '@/validators/common.validator';

const MODULE = 'help-support';
const router = Router();

const rejectSuperAdminCreate = asyncHandler(async (req, _res, next) => {
  if (req.user?.isSuperAdmin) {
    throw ApiError.forbidden('Super Admin cannot create support tickets');
  }
  next();
});

router.use(authenticate);

router.get(
  '/',
  checkPermission(MODULE, 'view'),
  validate({ query: listSupportTicketsQuerySchema }),
  supportTicketController.list,
);
router.get(
  '/:id',
  checkPermission(MODULE, 'view'),
  validate({ params: idParamSchema }),
  supportTicketController.getById,
);
router.post(
  '/',
  rejectSuperAdminCreate,
  checkPermission(MODULE, 'create'),
  validate({ body: createSupportTicketSchema }),
  supportTicketController.create,
);
router.put(
  '/:id',
  checkPermission(MODULE, 'update'),
  validate({ params: idParamSchema, body: updateSupportTicketSchema }),
  supportTicketController.update,
);
router.patch(
  '/:id/status',
  superAdminOnly,
  validate({ params: idParamSchema, body: updateSupportTicketStatusSchema }),
  supportTicketController.updateStatus,
);
router.delete(
  '/:id',
  checkPermission(MODULE, 'delete'),
  validate({ params: idParamSchema }),
  supportTicketController.remove,
);

export const supportTicketRoutes = router;

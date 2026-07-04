import { Router } from 'express';
import { labelTransferController } from './label-transfer.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { transferLabelSchema } from './label-transfer.validator';

const MODULE = 'label-transfer';
const router = Router();

router.use(authenticate);

router.get('/overview', checkPermission(MODULE, 'view'), labelTransferController.overview);
router.get('/recipients', checkPermission(MODULE, 'view'), labelTransferController.recipients);
router.post(
  '/',
  checkPermission(MODULE, 'create'),
  validate({ body: transferLabelSchema }),
  labelTransferController.transfer,
);

export const labelTransferRoutes = router;

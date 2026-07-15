import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/validators/common.validator';
import {
  createIssuesEntrySchema,
  issuesEntryExportQuerySchema,
  issuesEntryListQuerySchema,
  updateIssuesEntryOwnershipSchema,
  updateIssuesEntrySchema,
  updateIssuesEntryStatusSchema,
} from './issues-entry.validator';
import { createIssuesEntryController } from './issues-entry.controller';

export type IssuesEntryController = ReturnType<typeof createIssuesEntryController>;

export function createIssuesEntryRoutes(
  permissionModule: string,
  controller: IssuesEntryController,
): Router {
  const router = Router();

  router.use(authenticate);

  router.get(
    '/export',
    checkPermission(permissionModule, 'view'),
    validate({ query: issuesEntryExportQuerySchema }),
    controller.exportCsv,
  );
  router.get(
    '/',
    checkPermission(permissionModule, 'view'),
    validate({ query: issuesEntryListQuerySchema }),
    controller.list,
  );
  router.get(
    '/:id',
    checkPermission(permissionModule, 'view'),
    validate({ params: idParamSchema }),
    controller.getById,
  );
  router.post(
    '/',
    checkPermission(permissionModule, 'create'),
    validate({ body: createIssuesEntrySchema }),
    controller.create,
  );
  router.put(
    '/:id',
    checkPermission(permissionModule, 'update'),
    validate({ params: idParamSchema, body: updateIssuesEntrySchema }),
    controller.update,
  );
  router.patch(
    '/:id/status',
    checkPermission(permissionModule, 'update'),
    validate({ params: idParamSchema, body: updateIssuesEntryStatusSchema }),
    controller.updateStatus,
  );
  router.patch(
    '/:id/ownership',
    checkPermission(permissionModule, 'view'),
    validate({ params: idParamSchema, body: updateIssuesEntryOwnershipSchema }),
    controller.updateOwnership,
  );
  router.delete(
    '/:id',
    checkPermission(permissionModule, 'delete'),
    validate({ params: idParamSchema }),
    controller.remove,
  );

  return router;
}

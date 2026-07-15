import { Router } from 'express';
import { releaseCatalogController } from './release-catalog.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema } from '@/validators/common.validator';
import {
  catalogListQuerySchema,
  createCatalogNameSchema,
  labelManageQuerySchema,
  updateLabelSchema,
  updateLabelStatusSchema,
} from './release-catalog.validator';

const RELEASE_MODULE = 'release';
const router = Router();

router.use(authenticate);

router.get(
  '/languages',
  checkPermission(RELEASE_MODULE, 'view'),
  validate({ query: catalogListQuerySchema }),
  releaseCatalogController.listLanguages,
);

router.get(
  '/genres',
  checkPermission(RELEASE_MODULE, 'view'),
  validate({ query: catalogListQuerySchema }),
  releaseCatalogController.listGenres,
);

router.get(
  '/artists',
  checkPermission(RELEASE_MODULE, 'view'),
  validate({ query: catalogListQuerySchema }),
  releaseCatalogController.listArtists,
);

router.post(
  '/artists',
  checkPermission(RELEASE_MODULE, 'create'),
  validate({ body: createCatalogNameSchema }),
  releaseCatalogController.createArtist,
);

router.get(
  '/labels',
  validate({ query: catalogListQuerySchema }),
  releaseCatalogController.listLabels,
);

router.get(
  '/labels/manage',
  validate({ query: labelManageQuerySchema }),
  releaseCatalogController.listLabelsManage,
);

router.post(
  '/labels',
  checkPermission(RELEASE_MODULE, 'create'),
  validate({ body: createCatalogNameSchema }),
  releaseCatalogController.createLabel,
);

router.put(
  '/labels/:id',
  validate({ params: idParamSchema, body: updateLabelSchema }),
  releaseCatalogController.updateLabel,
);

router.patch(
  '/labels/:id/status',
  validate({ params: idParamSchema, body: updateLabelStatusSchema }),
  releaseCatalogController.updateLabelStatus,
);

router.delete(
  '/labels/:id',
  validate({ params: idParamSchema }),
  releaseCatalogController.deleteLabel,
);

export const releaseCatalogRoutes = router;

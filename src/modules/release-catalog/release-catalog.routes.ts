import { Router } from 'express';
import { releaseCatalogController } from './release-catalog.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { checkPermission } from '@/middlewares/rbac.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { catalogListQuerySchema, createCatalogNameSchema } from './release-catalog.validator';

const MODULE = 'release';
const router = Router();

router.use(authenticate);

router.get(
  '/artists',
  checkPermission(MODULE, 'view'),
  validate({ query: catalogListQuerySchema }),
  releaseCatalogController.listArtists,
);

router.post(
  '/artists',
  checkPermission(MODULE, 'create'),
  validate({ body: createCatalogNameSchema }),
  releaseCatalogController.createArtist,
);

router.get(
  '/labels',
  checkPermission(MODULE, 'view'),
  validate({ query: catalogListQuerySchema }),
  releaseCatalogController.listLabels,
);

router.post(
  '/labels',
  checkPermission(MODULE, 'create'),
  validate({ body: createCatalogNameSchema }),
  releaseCatalogController.createLabel,
);

export const releaseCatalogRoutes = router;

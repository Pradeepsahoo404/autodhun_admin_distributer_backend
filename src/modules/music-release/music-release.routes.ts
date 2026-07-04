import { Router } from 'express';
import { musicReleaseController, parseMusicReleaseBody, parseMusicReleaseUpdateBody } from './music-release.controller';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { uploadMusicRelease } from '@/middlewares/upload.middleware';
import { listQuerySchema, updateStatusSchema, bulkUpdateStatusSchema, exportQuerySchema, nextIsrcQuerySchema } from './music-release.validator';
import { idParamSchema } from '@/validators/common.validator';
import { z } from 'zod';

const router = Router();

router.get(
  '/files/:filename',
  authenticate,
  validate({ params: z.object({ filename: z.string().min(1) }) }),
  musicReleaseController.serveFile,
);

router.use(authenticate);

router.get('/export', validate({ query: exportQuerySchema }), musicReleaseController.exportCsv);

router.get('/isrc/next', validate({ query: nextIsrcQuerySchema }), musicReleaseController.previewNextIsrc);

router.get('/', validate({ query: listQuerySchema }), musicReleaseController.list);

router.patch(
  '/bulk/status',
  validate({ body: bulkUpdateStatusSchema }),
  musicReleaseController.bulkUpdateStatus,
);

router.get('/:id', validate({ params: idParamSchema }), musicReleaseController.getById);

router.post('/', uploadMusicRelease, parseMusicReleaseBody, musicReleaseController.create);

router.put(
  '/:id',
  uploadMusicRelease,
  validate({ params: idParamSchema }),
  parseMusicReleaseUpdateBody,
  musicReleaseController.update,
);

router.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateStatusSchema }),
  musicReleaseController.updateStatus,
);

router.delete('/:id', validate({ params: idParamSchema }), musicReleaseController.delete);

export const musicReleaseRoutes = router;

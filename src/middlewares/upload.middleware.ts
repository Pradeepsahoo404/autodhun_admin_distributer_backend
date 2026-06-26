import multer, { MulterError } from 'multer';
import { RequestHandler } from 'express';
import { ApiError } from '@/utils/ApiError';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/** Parses a single `avatar` file from multipart form data. */
export const uploadAvatar: RequestHandler = (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (error) => {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(ApiError.badRequest('Image must be under 5MB'));
        return;
      }
      next(ApiError.badRequest(error.message));
      return;
    }
    if (error) {
      next(ApiError.badRequest(error.message));
      return;
    }
    next();
  });
};

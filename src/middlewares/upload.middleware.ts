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

const MAX_COVER_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const MAX_AUDIO_FILES = 30;

const releaseUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_AUDIO_BYTES,
    files: MAX_AUDIO_FILES + 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'coverArt') {
      if (!file.mimetype.startsWith('image/')) {
        cb(new Error('Cover art must be an image'));
        return;
      }
      return cb(null, true);
    }
    if (file.fieldname === 'audioFiles') {
      const isWav =
        file.mimetype === 'audio/wav' ||
        file.mimetype === 'audio/x-wav' ||
        file.mimetype === 'audio/wave' ||
        /\.wav$/i.test(file.originalname);
      if (!isWav) {
        cb(new Error('Only WAV audio files are allowed'));
        return;
      }
      return cb(null, true);
    }
    cb(new Error('Unexpected upload field'));
  },
});

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const SPREADSHEET_EXTENSIONS = /\.(xlsx|xls|csv)$/i;

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!SPREADSHEET_EXTENSIONS.test(file.originalname)) {
      cb(new Error('Only .xlsx, .xls or .csv files are allowed'));
      return;
    }
    cb(null, true);
  },
});

/** Parses a single `file` spreadsheet for bulk release import. */
export const uploadReleaseImport: RequestHandler = (req, res, next) => {
  spreadsheetUpload.single('file')(req, res, (error) => {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(ApiError.badRequest('File must be under 5MB'));
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

/** Parses cover art + audio files for music release submission. */
export const uploadMusicRelease: RequestHandler = (req, res, next) => {
  releaseUpload.fields([
    { name: 'coverArt', maxCount: 1 },
    { name: 'audioFiles', maxCount: MAX_AUDIO_FILES },
  ])(req, res, (error) => {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(ApiError.badRequest('File exceeds maximum allowed size'));
        return;
      }
      next(ApiError.badRequest(error.message));
      return;
    }
    if (error) {
      next(ApiError.badRequest(error.message));
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const cover = files?.coverArt?.[0];
    if (cover && cover.size > MAX_COVER_BYTES) {
      next(ApiError.badRequest('Cover art must be under 10MB'));
      return;
    }
    next();
  });
};

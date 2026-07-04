import { cloudinary, isCloudinaryConfigured } from '@/config/cloudinary';
import { ApiError } from '@/utils/ApiError';

const RELEASE_FOLDER = 'autodhun-admin/releases';

function assertCloudinaryReady(): void {
  if (!isCloudinaryConfigured()) {
    throw ApiError.internal(
      'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to the backend .env file.',
    );
  }
}

function uploadToCloudinary(
  buffer: Buffer,
  options: { folder: string; publicId: string; resourceType: 'image' | 'video' | 'raw' },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType,
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve(result.secure_url);
      },
    );
    upload.end(buffer);
  });
}

export async function uploadReleaseCover(buffer: Buffer, releaseKey: string): Promise<string> {
  assertCloudinaryReady();
  return uploadToCloudinary(buffer, {
    folder: `${RELEASE_FOLDER}/covers`,
    publicId: `cover-${releaseKey}`,
    resourceType: 'image',
  });
}

export async function uploadReleaseAudio(
  buffer: Buffer,
  releaseKey: string,
  index: number,
  _originalName: string,
): Promise<string> {
  assertCloudinaryReady();
  return uploadToCloudinary(buffer, {
    folder: `${RELEASE_FOLDER}/audio`,
    publicId: `audio-${releaseKey}-${index}`,
    resourceType: 'video',
  });
}

/** @deprecated Local file serving kept for legacy URLs only */
export function resolveLocalReleaseFile(_filename: string): string {
  throw ApiError.notFound('File not found');
}

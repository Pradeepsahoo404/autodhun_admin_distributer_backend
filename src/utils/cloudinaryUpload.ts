import { cloudinary, isCloudinaryConfigured } from '@/config/cloudinary';
import { ApiError } from '@/utils/ApiError';

const AVATAR_FOLDER = 'autodhun-admin/avatars';

/** Uploads a profile image buffer to Cloudinary and returns its public delivery URL. */
export const uploadAvatarImage = async (buffer: Buffer, userId: string): Promise<string> => {
  if (!isCloudinaryConfigured()) {
    throw ApiError.internal('Cloudinary is not configured. Add CLOUDINARY_* variables to the backend .env file.');
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: AVATAR_FOLDER,
        public_id: `user-${userId}`,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
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
};

/** Removes a previously uploaded Cloudinary asset when the URL belongs to our folder. */
export const deleteCloudinaryImage = async (imageUrl?: string): Promise<void> => {
  if (!imageUrl || !isCloudinaryConfigured()) return;
  if (!imageUrl.includes('res.cloudinary.com') || !imageUrl.includes(AVATAR_FOLDER)) return;

  try {
    const marker = '/upload/';
    const afterUpload = imageUrl.split(marker)[1];
    if (!afterUpload) return;

    const withoutTransforms = afterUpload.replace(/^[^/]+\//, '').replace(/^v\d+\//, '');
    const publicId = withoutTransforms.replace(/\.[a-zA-Z0-9]+$/, '');
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  } catch {
    // Non-fatal — old asset cleanup should not block profile updates.
  }
};

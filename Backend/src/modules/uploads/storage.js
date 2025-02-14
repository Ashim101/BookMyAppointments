import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { IMAGE_TYPES } from '../../middlewares/upload.js';
import { AppError } from '../../utils/AppError.js';
import { randomToken } from '../../utils/crypto.js';

const SIGNATURES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

/** The declared MIME type is client controlled, so the file's magic bytes must agree with it. */
export function assertImageContent(file) {
  if (!SIGNATURES[file.mimetype]?.(file.buffer)) {
    throw new AppError('VALIDATION_ERROR', 'The uploaded file is not a valid image', [{ path: 'image', message: 'File content does not match its type' }]);
  }
}

/** Stores images on Cloudinary when configured, otherwise in the local uploads directory. */
export function createStorage({ config, logger }) {
  const uploadDir = path.resolve(config.uploadDir);

  if (config.cloudinary) {
    cloudinary.config({
      cloud_name: config.cloudinary.cloudName,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
  }

  async function toCloudinary(buffer) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'bookmyappointments', resource_type: 'image' }, (err, result) => (err ? reject(err) : resolve(result.secure_url)))
        .end(buffer);
    });
  }

  async function saveImage(file) {
    assertImageContent(file);
    if (config.cloudinary) return toCloudinary(file.buffer);
    await mkdir(uploadDir, { recursive: true });
    const name = `${randomToken(16)}.${IMAGE_TYPES.get(file.mimetype)}`;
    await writeFile(path.join(uploadDir, name), file.buffer);
    return `${config.publicUrl}/uploads/${name}`;
  }

  /** Best-effort removal of an image that has been replaced; failures are logged, never raised. */
  async function removeImage(url) {
    if (!url) return;
    try {
      const localPrefix = `${config.publicUrl}/uploads/`;
      if (url.startsWith(localPrefix)) {
        await unlink(path.join(uploadDir, path.basename(url.slice(localPrefix.length))));
      } else if (config.cloudinary) {
        const publicId = /\/upload\/(?:v\d+\/)?(.+)\.\w+$/.exec(url)?.[1];
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
    } catch (err) {
      logger?.warn({ err }, 'could not remove replaced image');
    }
  }

  return { saveImage, removeImage, uploadDir };
}

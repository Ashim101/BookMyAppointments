import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 30, fieldSize: 50_000 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(
      new AppError('VALIDATION_ERROR', 'Image must be a JPEG, PNG or WebP file', [
        { path: file.fieldname, message: 'Unsupported image type' },
      ]),
    );
  },
});

/** Accepts an optional `image` file alongside text fields (multipart). */
export const imageUpload = uploader.single('image');

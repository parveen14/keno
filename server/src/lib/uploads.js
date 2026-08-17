import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { put } from '@vercel/blob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// Vercel's serverless functions have a read-only filesystem, so local disk storage
// only works in local dev. When a Blob store is connected (BLOB_READ_WRITE_TOKEN set
// by Vercel), use that instead; multer keeps the file in memory rather than on disk.
const usingBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

const storage = usingBlob
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
    });

export const upload = multer({ storage });

// Resolves the public URL for an uploaded file, after multer has processed it.
export async function resolveUploadUrl(file) {
  if (usingBlob) {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const blob = await put(filename, file.buffer, { access: 'public', contentType: file.mimetype });
    return blob.url;
  }
  return `/uploads/${file.filename}`;
}

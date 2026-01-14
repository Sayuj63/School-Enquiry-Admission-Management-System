import multer from 'multer';
import { Readable } from 'stream';
import { getBucket } from '../config/db';
import { Types } from 'mongoose';

// Custom storage engine for GridFS
class GridFSStorage implements multer.StorageEngine {
  _handleFile(
    req: Express.Request,
    file: Express.Multer.File,
    callback: (error?: any, info?: Partial<Express.Multer.File>) => void
  ): void {
    try {
      const bucket = getBucket();
      const filename = `${Date.now()}-${file.originalname}`;

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date()
        }
      });

      // Convert buffer stream to readable stream and pipe to GridFS
      file.stream.pipe(uploadStream);

      uploadStream.on('error', (error) => {
        callback(error);
      });

      uploadStream.on('finish', () => {
        callback(null, {
          filename: filename,
          size: uploadStream.length,
          // Store the GridFS file ID
          id: uploadStream.id,
          fieldname: file.fieldname,
          originalname: file.originalname,
          encoding: file.encoding,
          mimetype: file.mimetype
        } as any);
      });
    } catch (error) {
      callback(error);
    }
  }

  _removeFile(
    req: Express.Request,
    file: Express.Multer.File & { id?: Types.ObjectId },
    callback: (error: Error | null) => void
  ): void {
    if (file.id) {
      const bucket = getBucket();
      bucket.delete(file.id)
        .then(() => callback(null))
        .catch((error) => callback(error));
    } else {
      callback(null);
    }
  }
}

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'));
  }
};

export const upload = multer({
  storage: new GridFSStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { storage } from '../config/cloudinary';

// File filter with detailed error messages
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];

  const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

  if (!allowedTypes.includes(file.mimetype)) {
    const error = new Error(`Invalid file type "${file.mimetype}". Only PDF, JPG, and PNG files are allowed.`);
    (error as any).code = 'INVALID_FILE_TYPE';
    return cb(error);
  }

  if (!allowedExtensions.includes(fileExtension)) {
    const error = new Error(`Invalid file extension "${fileExtension}". Only .pdf, .jpg, .jpeg, and .png files are allowed.`);
    (error as any).code = 'INVALID_FILE_EXTENSION';
    return cb(error);
  }

  cb(null, true);
};

export const upload = multer({
  storage: storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handling middleware for multer errors
export const handleUploadError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size exceeds the 5MB limit. Please upload a smaller file.',
        errorCode: 'FILE_TOO_LARGE'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field. Please ensure you are uploading to the correct field.',
        errorCode: 'UNEXPECTED_FILE'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
      errorCode: err.code
    });
  }

  // Custom file filter errors
  if (err && (err.code === 'INVALID_FILE_TYPE' || err.code === 'INVALID_FILE_EXTENSION')) {
    return res.status(400).json({
      success: false,
      error: err.message,
      errorCode: err.code
    });
  }

  // Cloudinary errors
  if (err && err.message && err.message.includes('cloudinary')) {
    return res.status(500).json({
      success: false,
      error: 'Failed to upload file to storage. Please try again or contact support if the issue persists.',
      errorCode: 'CLOUDINARY_ERROR'
    });
  }

  // Generic errors
  if (err) {
    console.error('Upload error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during file upload. Please try again.',
      errorCode: 'UPLOAD_ERROR'
    });
  }

  next();
};

import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

if (process.env.CLOUDINARY_URL) {
    // If URL is present, Cloudinary can often auto-configure, 
    // but we'll set it explicitly to be sure
    cloudinary.config({
        secure: true
    });
} else {
    cloudinary.config({
        cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
        api_secret: process.env.NEXT_PUBLIC_CLOUDINARY_API_SECRET,
        secure: true
    });
}

export const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'documents',
        upload_preset: 'documents',
        allowed_formats: ['jpg', 'png', 'pdf', 'jpeg'],
        public_id: (req: any, file: any) => {
            const name = file.originalname.split('.')[0];
            return `${Date.now()}-${name}`;
        },
    } as any,
});

export default cloudinary;

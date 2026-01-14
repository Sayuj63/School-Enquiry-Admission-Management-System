import mongoose from 'mongoose';

let bucket: mongoose.mongo.GridFSBucket;

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    // Initialize GridFS Bucket
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db as mongoose.mongo.Db, {
      bucketName: 'uploads'
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export function getBucket(): mongoose.mongo.GridFSBucket {
  if (!bucket) {
    throw new Error('GridFSBucket not initialized. Call connectDB first.');
  }
  return bucket;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}

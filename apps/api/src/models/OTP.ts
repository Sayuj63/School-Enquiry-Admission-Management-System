import mongoose, { Document, Schema } from 'mongoose';

export interface IOTP extends Document {
  mobile: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

const otpSchema = new Schema<IOTP>(
  {
    mobile: {
      type: String,
      required: true,
      index: true
    },
    otp: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    attempts: {
      type: Number,
      default: 0,
      max: 3
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// TTL index to auto-delete expired OTPs after 15 minutes
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTP = mongoose.model<IOTP>('OTP', otpSchema);

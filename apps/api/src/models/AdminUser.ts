import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IAdminUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'superadmin' | 'principal';
  createdAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const adminUserSchema = new Schema<IAdminUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'superadmin', 'principal'],
      default: 'admin'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Method to compare password
adminUserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Static method to hash password
adminUserSchema.statics.hashPassword = async function (password: string): Promise<string> {
  return bcrypt.hash(password, 10);
};

export const AdminUser = mongoose.model<IAdminUser>('AdminUser', adminUserSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IEnquiry extends Document {
  tokenId: string;
  parentName: string;
  childName: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  city: string;
  grade: string;
  message: string;
  status: 'new' | 'in_progress' | 'converted';
  whatsappSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    parentName: {
      type: String,
      required: true,
      trim: true
    },
    childName: {
      type: String,
      required: true,
      trim: true
    },
    mobile: {
      type: String,
      required: true,
      index: true
    },
    mobileVerified: {
      type: Boolean,
      default: false
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    grade: {
      type: String,
      required: true
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'converted'],
      default: 'new'
    },
    whatsappSent: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Index for searching
enquirySchema.index({ parentName: 'text', childName: 'text', mobile: 'text' });

export const Enquiry = mongoose.model<IEnquiry>('Enquiry', enquirySchema);

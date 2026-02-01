import mongoose, { Document, Schema } from 'mongoose';

export interface IEnquiry extends Document {
  tokenId?: string;
  parentName: string;
  childName: string;
  mobile: string;
  mobileVerified: boolean;
  email: string;
  city: string;
  grade: string;
  dob?: Date;
  status: 'draft' | 'new' | 'in_progress' | 'converted';
  slotBookingId?: mongoose.Types.ObjectId;
  message: string;
  additionalFields?: Record<string, any>;
  whatsappSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    tokenId: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true
    },
    parentName: {
      type: String,
      trim: true
    },
    childName: {
      type: String,
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
      lowercase: true,
      trim: true
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    grade: {
      type: String
    },
    dob: {
      type: Date
    },
    message: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['draft', 'new', 'in_progress', 'converted'],
      default: 'new'
    },
    slotBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'SlotBooking'
    },
    whatsappSent: {
      type: Boolean,
      default: false
    },
    additionalFields: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Index for searching
enquirySchema.index({ parentName: 'text', childName: 'text', mobile: 'text' });

export const Enquiry = mongoose.model<IEnquiry>('Enquiry', enquirySchema);

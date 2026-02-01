import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAdmissionDocument {
  _id?: Types.ObjectId;
  type: string;
  fileName: string;
  fileId: string; // Cloudinary public_id
  url: string;    // Cloudinary URL
  uploadedAt: Date;
}

export interface IAdmission extends Document {
  enquiryId: Types.ObjectId;
  tokenId: string;

  // Pre-filled from Enquiry
  studentName: string;
  parentName: string;
  mobile: string;
  email: string;
  city: string;
  grade: string;

  // Additional fields (admin fills)
  studentDob?: Date;
  parentAddress?: string;
  parentOccupation?: string;
  emergencyContact?: string;

  // Dynamic fields based on template
  additionalFields: Map<string, any>;

  // Documents
  documents: IAdmissionDocument[];

  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'waitlisted' | 'confirmed';
  noShowCount: number;
  notes?: string;
  slotBookingId?: Types.ObjectId;
  waitlistDate?: Date;
  waitlistType?: 'parent' | 'school';
  waitlistRemindersSent: number[]; // days sent: [2, 5]
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema({
  type: { type: String, required: true },
  fileName: { type: String, required: true },
  fileId: { type: String, required: true }, // Cloudinary public_id
  url: { type: String, required: true },    // Cloudinary URL
  uploadedAt: { type: Date, default: Date.now }
});

const admissionSchema = new Schema<IAdmission>(
  {
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: true,
      index: true
    },
    tokenId: {
      type: String,
      required: true,
      index: true
    },
    studentName: {
      type: String,
      required: true,
      trim: true
    },
    parentName: {
      type: String,
      required: true,
      trim: true
    },
    mobile: {
      type: String,
      required: true
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
    studentDob: {
      type: Date
    },
    parentAddress: {
      type: String,
      trim: true
    },
    parentOccupation: {
      type: String,
      trim: true
    },
    emergencyContact: {
      type: String
    },
    additionalFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map()
    },
    documents: [documentSchema],
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'waitlisted', 'confirmed'],
      default: 'draft'
    },
    noShowCount: {
      type: Number,
      default: 0
    },
    notes: {
      type: String,
      trim: true
    },
    slotBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'SlotBooking'
    },
    waitlistDate: {
      type: Date
    },
    waitlistType: {
      type: String,
      enum: ['parent', 'school']
    },
    waitlistRemindersSent: {
      type: [Number],
      default: []
    }
  },
  {
    timestamps: true
  }
);

export const Admission = mongoose.model<IAdmission>('Admission', admissionSchema);

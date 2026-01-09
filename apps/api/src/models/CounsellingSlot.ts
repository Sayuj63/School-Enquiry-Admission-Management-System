import mongoose, { Document, Schema } from 'mongoose';

export interface ICounsellingSlot extends Document {
  date: Date;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: 'available' | 'full' | 'disabled';
  createdAt: Date;
}

const counsellingSlotSchema = new Schema<ICounsellingSlot>(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    capacity: {
      type: Number,
      default: 3,
      min: 1
    },
    bookedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ['available', 'full', 'disabled'],
      default: 'available'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// Compound index for unique slot per date and time
counsellingSlotSchema.index({ date: 1, startTime: 1 }, { unique: true });

// Pre-save middleware to update status based on capacity
counsellingSlotSchema.pre('save', function (next) {
  if (this.bookedCount >= this.capacity) {
    this.status = 'full';
  } else if (this.status !== 'disabled') {
    this.status = 'available';
  }
  next();
});

export const CounsellingSlot = mongoose.model<ICounsellingSlot>('CounsellingSlot', counsellingSlotSchema);

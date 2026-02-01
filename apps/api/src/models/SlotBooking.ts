import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISlotBooking extends Document {
  slotId: Types.ObjectId;
  admissionId?: Types.ObjectId;
  enquiryId?: Types.ObjectId;
  tokenId: string;
  parentEmail: string;
  calendarInviteSent: boolean;
  principalInviteSent: boolean;
  remindersSent: number[]; // Array of days (e.g. [3, 1]) for which reminders were sent
  bookedAt: Date;
}

const slotBookingSchema = new Schema<ISlotBooking>(
  {
    slotId: {
      type: Schema.Types.ObjectId,
      ref: 'CounsellingSlot',
      required: true,
      index: true
    },
    admissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Admission',
      required: false,
      sparse: true,
      unique: true
    },
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: false,
      sparse: true,
      unique: true
    },
    tokenId: {
      type: String,
      required: true,
      index: true
    },
    parentEmail: {
      type: String,
      required: true
    },
    calendarInviteSent: {
      type: Boolean,
      default: false
    },
    principalInviteSent: {
      type: Boolean,
      default: false
    },
    remindersSent: {
      type: [Number],
      default: []
    },
    bookedAt: {
      type: Date,
      default: Date.now
    }
  }
);

export const SlotBooking = mongoose.model<ISlotBooking>('SlotBooking', slotBookingSchema);

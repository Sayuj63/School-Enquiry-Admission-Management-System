import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISlotBooking extends Document {
  slotId: Types.ObjectId;
  admissionId: Types.ObjectId;
  tokenId: string;
  parentEmail: string;
  calendarInviteSent: boolean;
  principalInviteSent: boolean;
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
      required: true,
      unique: true // One admission can only have one booking
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
    bookedAt: {
      type: Date,
      default: Date.now
    }
  }
);

export const SlotBooking = mongoose.model<ISlotBooking>('SlotBooking', slotBookingSchema);

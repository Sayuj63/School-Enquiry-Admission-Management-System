import mongoose, { Document, Schema } from 'mongoose';

export interface ISlotSettings extends Document {
    key: string;
    slotDuration: number; // default 30
    gapBetweenSlots: number; // default 0
    parentsPerSlot: number; // default 3
    maxDefaultSaturdaySlots: number; // default 3
}

const slotSettingsSchema = new Schema({
    key: { type: String, default: 'slots', unique: true },
    slotDuration: { type: Number, default: 30 },
    gapBetweenSlots: { type: Number, default: 0 },
    parentsPerSlot: { type: Number, default: 3 },
    maxDefaultSaturdaySlots: { type: Number, default: 3 }
});

export const SlotSettings = mongoose.model<ISlotSettings>('SlotSettings', slotSettingsSchema);

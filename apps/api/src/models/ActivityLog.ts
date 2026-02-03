import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IActivityLog extends Document {
    type: 'enquiry' | 'admission' | 'slot' | 'system' | 'reminder';
    action: string;
    description: string;
    refId: Types.ObjectId;
    tokenId?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
    {
        type: { type: String, required: true, enum: ['enquiry', 'admission', 'slot', 'system', 'reminder'] },
        action: { type: String, required: true },
        description: { type: String, required: true },
        refId: { type: Schema.Types.ObjectId, required: true },
        tokenId: { type: String, index: true },
        metadata: { type: Schema.Types.Mixed, default: {} }
    },
    {
        timestamps: { createdAt: true, updatedAt: false }
    }
);

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);

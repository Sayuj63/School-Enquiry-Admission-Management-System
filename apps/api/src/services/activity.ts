import { ActivityLog } from '../models';
import { Types } from 'mongoose';

export async function logActivity(params: {
    type: 'enquiry' | 'admission' | 'slot' | 'system' | 'reminder';
    action: string;
    description: string;
    refId: string | Types.ObjectId;
    tokenId?: string;
    metadata?: Record<string, any>;
}) {
    try {
        await ActivityLog.create({
            ...params,
            refId: new Types.ObjectId(params.refId.toString())
        });
    } catch (err) {
        console.error('Failed to log activity:', err);
    }
}

import mongoose, { Document, Schema } from 'mongoose';

export interface INotificationSettings extends Document {
    key: string;
    reminderDays: number[]; // e.g., [1, 3]
    whatsappProvider: 'twilio' | 'interakt' | 'mock';
    whatsappEnabled: boolean;
    brochureUrl: string;
    waitlistReminderDays: number[]; // e.g., [2, 5, 7]
    waitlistReminderTemplate: string;
}

const notificationSettingsSchema = new Schema({
    key: { type: String, default: 'notifications', unique: true },
    reminderDays: { type: [Number], default: [1, 3] },
    whatsappProvider: { type: String, default: 'mock' },
    whatsappEnabled: { type: Boolean, default: true },
    brochureUrl: { type: String, default: 'https://example.com/brochure.pdf' },
    waitlistReminderDays: { type: [Number], default: [2, 5, 7] },
    waitlistReminderTemplate: {
        type: String,
        default: 'Hello! This is a reminder that your application for childName is still on the waitlist. We will notify you once a seat becomes available.'
    }
});

export const NotificationSettings = mongoose.model<INotificationSettings>('NotificationSettings', notificationSettingsSchema);

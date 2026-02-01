import mongoose, { Document, Schema } from 'mongoose';

export interface IGradeRule extends Document {
    grade: string;
    minAge: number; // e.g., 5.5
    order: number;
    totalSeats?: number;
}

export interface IGradeSettings extends Document {
    cutOffDate: string; // MM-DD format, e.g., "07-31"
    additionalGradesAllowed: number;
}

const gradeRuleSchema = new Schema({
    grade: { type: String, required: true, unique: true },
    minAge: { type: Number, required: true },
    order: { type: Number, default: 0 },
    totalSeats: { type: Number, default: 50 }
});

const gradeSettingsSchema = new Schema({
    key: { type: String, default: 'global', unique: true },
    cutOffDate: { type: String, default: '07-31' },
    additionalGradesAllowed: { type: Number, default: 2 }
});

export const GradeRule = mongoose.model<IGradeRule>('GradeRule', gradeRuleSchema);
export const GradeSettings = mongoose.model<IGradeSettings>('GradeSettings', gradeSettingsSchema);

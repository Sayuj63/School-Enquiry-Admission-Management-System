import mongoose, { Document, Schema } from 'mongoose';

export interface IFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'date' | 'number' | 'checkbox';
  required: boolean;
  options?: string[];
  order: number;
  placeholder?: string;
}

export interface IFormTemplate extends Document {
  type: 'enquiry' | 'admission';
  fields: IFormField[];
  baseFields?: Record<string, boolean>; // Field name -> enabled
  updatedAt: Date;
}

const formFieldSchema = new Schema({
  name: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'email', 'tel', 'select', 'textarea', 'date', 'number', 'checkbox'],
    default: 'text'
  },
  required: { type: Boolean, default: false },
  options: [{ type: String }],
  order: { type: Number, default: 0 },
  placeholder: { type: String }
});

const formTemplateSchema = new Schema<IFormTemplate>(
  {
    type: {
      type: String,
      enum: ['enquiry', 'admission'],
      required: true,
      unique: true
    },
    fields: [formFieldSchema],
    baseFields: {
      type: Map,
      of: Boolean,
      default: {}
    }
  },
  {
    timestamps: { updatedAt: true, createdAt: false }
  }
);

export const FormTemplate = mongoose.model<IFormTemplate>('FormTemplate', formTemplateSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IRequiredDocument {
  name: string;
  required: boolean;
  order: number;
}

export interface IDocumentsList extends Document {
  documents: IRequiredDocument[];
  updatedAt: Date;
}

const requiredDocumentSchema = new Schema({
  name: { type: String, required: true },
  required: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const documentsListSchema = new Schema<IDocumentsList>(
  {
    documents: [requiredDocumentSchema]
  },
  {
    timestamps: { updatedAt: true, createdAt: false }
  }
);

export const DocumentsList = mongoose.model<IDocumentsList>('DocumentsList', documentsListSchema);

import { Schema, model, Document, Types } from 'mongoose';

export interface IReleaseLanguage extends Document {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const releaseLanguageSchema = new Schema<IReleaseLanguage>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const ReleaseLanguageModel = model<IReleaseLanguage>('ReleaseLanguage', releaseLanguageSchema);

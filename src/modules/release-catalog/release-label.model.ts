import { Schema, model, Document, Types } from 'mongoose';

export interface IReleaseLabel extends Document {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const releaseLabelSchema = new Schema<IReleaseLabel>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export const ReleaseLabelModel = model<IReleaseLabel>('ReleaseLabel', releaseLabelSchema);

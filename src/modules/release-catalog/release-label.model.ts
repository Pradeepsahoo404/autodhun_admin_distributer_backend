import { Schema, model, Document, Types } from 'mongoose';
import { LABEL_STATUS, LABEL_STATUS_VALUES, type LabelStatus } from './release-catalog.constants';

export interface IReleaseLabel extends Document {
  _id: Types.ObjectId;
  name: string;
  normalizedName: string;
  status: LabelStatus;
  createdBy: Types.ObjectId;
  ownedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const releaseLabelSchema = new Schema<IReleaseLabel>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    status: {
      type: String,
      enum: LABEL_STATUS_VALUES,
      default: LABEL_STATUS.ACTIVE,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ownedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const ReleaseLabelModel = model<IReleaseLabel>('ReleaseLabel', releaseLabelSchema);

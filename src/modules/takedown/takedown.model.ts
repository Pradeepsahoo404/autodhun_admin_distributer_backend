import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const TAKEDOWN_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type TakedownStatus = (typeof TAKEDOWN_STATUS)[keyof typeof TAKEDOWN_STATUS];

export interface ITakedown extends Document {
  _id: Types.ObjectId;
  labelName: string;
  isrcCode: string;
  songLink: string;
  status: TakedownStatus;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const takedownSchema = new Schema<ITakedown>(
  {
    labelName: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    songLink: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(TAKEDOWN_STATUS),
      default: TAKEDOWN_STATUS.IN_PROGRESS,
      index: true,
    },
    tenantId: tenantIdField,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const TakedownModel = model<ITakedown>('Takedown', takedownSchema);

import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const MANUAL_CLAIMING_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type ManualClaimingStatus = (typeof MANUAL_CLAIMING_STATUS)[keyof typeof MANUAL_CLAIMING_STATUS];

export interface IManualClaiming extends Document {
  _id: Types.ObjectId;
  labelName: string;
  originalSongLink: string;
  isrcCode: string;
  songLink: string;
  status: ManualClaimingStatus;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const manualClaimingSchema = new Schema<IManualClaiming>(
  {
    labelName: { type: String, required: true, trim: true },
    originalSongLink: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    songLink: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(MANUAL_CLAIMING_STATUS),
      default: MANUAL_CLAIMING_STATUS.IN_PROGRESS,
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

export const ManualClaimingModel = model<IManualClaiming>('ManualClaiming', manualClaimingSchema);

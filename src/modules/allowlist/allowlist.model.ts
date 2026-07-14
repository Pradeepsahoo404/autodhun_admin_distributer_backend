import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const ALLOWLIST_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type AllowlistStatus = (typeof ALLOWLIST_STATUS)[keyof typeof ALLOWLIST_STATUS];

export interface IAllowlist extends Document {
  _id: Types.ObjectId;
  labelName: string;
  channelLink: string;
  status: AllowlistStatus;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const allowlistSchema = new Schema<IAllowlist>(
  {
    labelName: { type: String, required: true, trim: true },
    channelLink: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(ALLOWLIST_STATUS),
      default: ALLOWLIST_STATUS.IN_PROGRESS,
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

export const AllowlistModel = model<IAllowlist>('Allowlist', allowlistSchema);

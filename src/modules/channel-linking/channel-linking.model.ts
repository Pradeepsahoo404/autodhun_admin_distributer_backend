import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const CHANNEL_LINKING_STATUS = {
  IN_PROCESS: 'in_process',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ChannelLinkingStatus =
  (typeof CHANNEL_LINKING_STATUS)[keyof typeof CHANNEL_LINKING_STATUS];

/** Revenue below this (USD) triggers automatic rejection after a short delay. */
export const CHANNEL_LINKING_MIN_REVENUE_USD = 100;

/** Minutes to wait before auto-rejecting low-revenue submissions. */
export const CHANNEL_LINKING_AUTO_REJECT_MINUTES = 3;

export interface IChannelLinking extends Document {
  _id: Types.ObjectId;
  channelLink: string;
  channelName: string;
  totalRevenue90Days: number;
  totalViews90Days: number;
  status: ChannelLinkingStatus;
  autoRejectAt?: Date | null;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const channelLinkingSchema = new Schema<IChannelLinking>(
  {
    channelLink: { type: String, required: true, trim: true },
    channelName: { type: String, required: true, trim: true },
    totalRevenue90Days: { type: Number, required: true, min: 0 },
    totalViews90Days: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(CHANNEL_LINKING_STATUS),
      default: CHANNEL_LINKING_STATUS.IN_PROCESS,
      index: true,
    },
    autoRejectAt: { type: Date, default: null, index: true },
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

export const ChannelLinkingModel = model<IChannelLinking>(
  'ChannelLinking',
  channelLinkingSchema,
);

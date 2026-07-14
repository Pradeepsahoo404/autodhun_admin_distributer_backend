import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const CHANNEL_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type ChannelStatus = (typeof CHANNEL_STATUS)[keyof typeof CHANNEL_STATUS];

export interface IChannel extends Document {
  _id: Types.ObjectId;
  channelName: string;
  channelLink: string;
  status: ChannelStatus;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    channelName: { type: String, required: true, trim: true },
    channelLink: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(CHANNEL_STATUS),
      default: CHANNEL_STATUS.ACTIVE,
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

export const ChannelModel = model<IChannel>('Channel', channelSchema);

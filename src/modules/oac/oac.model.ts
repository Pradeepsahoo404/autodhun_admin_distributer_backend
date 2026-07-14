import { Schema, model, Document, Types } from 'mongoose';

export const OAC_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type OacStatus = (typeof OAC_STATUS)[keyof typeof OAC_STATUS];

export interface IOac extends Document {
  _id: Types.ObjectId;
  artistChannelName: string;
  artistChannelLink: string;
  artistChannelTopicLink: string;
  isrcCode: string;
  status: OacStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const oacSchema = new Schema<IOac>(
  {
    artistChannelName: { type: String, required: true, trim: true },
    artistChannelLink: { type: String, required: true, trim: true },
    artistChannelTopicLink: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(OAC_STATUS),
      default: OAC_STATUS.IN_PROGRESS,
      index: true,
    },
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

export const OacModel = model<IOac>('Oac', oacSchema);

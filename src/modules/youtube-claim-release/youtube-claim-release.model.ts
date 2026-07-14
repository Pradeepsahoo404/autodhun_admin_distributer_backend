import { Schema, model, Document, Types } from 'mongoose';
import { tenantIdField } from '@/utils/tenantFields';

export const CLAIM_RELEASE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type ClaimReleaseStatus = (typeof CLAIM_RELEASE_STATUS)[keyof typeof CLAIM_RELEASE_STATUS];

export interface IYoutubeClaimRelease extends Document {
  _id: Types.ObjectId;
  senderLabelName: string;
  receiverLabelName: string;
  youtubeLink: string;
  isrcCode: string;
  status: ClaimReleaseStatus;
  tenantId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const youtubeClaimReleaseSchema = new Schema<IYoutubeClaimRelease>(
  {
    senderLabelName: { type: String, required: true, trim: true },
    receiverLabelName: { type: String, required: true, trim: true },
    youtubeLink: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(CLAIM_RELEASE_STATUS),
      default: CLAIM_RELEASE_STATUS.IN_PROGRESS,
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

export const YoutubeClaimReleaseModel = model<IYoutubeClaimRelease>(
  'YoutubeClaimRelease',
  youtubeClaimReleaseSchema,
);

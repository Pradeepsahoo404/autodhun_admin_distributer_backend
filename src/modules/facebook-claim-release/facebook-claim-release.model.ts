import { Schema, model, Document, Types } from 'mongoose';

export const CLAIM_RELEASE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  IN_PROGRESS: 'in_progress',
} as const;

export type ClaimReleaseStatus = (typeof CLAIM_RELEASE_STATUS)[keyof typeof CLAIM_RELEASE_STATUS];

export interface IFacebookClaimRelease extends Document {
  _id: Types.ObjectId;
  senderLabelName: string;
  receiverLabelName: string;
  facebookPageLink: string;
  isrcCode: string;
  status: ClaimReleaseStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const facebookClaimReleaseSchema = new Schema<IFacebookClaimRelease>(
  {
    senderLabelName: { type: String, required: true, trim: true },
    receiverLabelName: { type: String, required: true, trim: true },
    facebookPageLink: { type: String, required: true, trim: true },
    isrcCode: { type: String, required: true, trim: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(CLAIM_RELEASE_STATUS),
      default: CLAIM_RELEASE_STATUS.IN_PROGRESS,
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

export const FacebookClaimReleaseModel = model<IFacebookClaimRelease>(
  'FacebookClaimRelease',
  facebookClaimReleaseSchema,
);
